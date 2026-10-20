// 在线联机网络层（C 档 · 主机权威 · 2–4 人槽位化；协议见 design/coop-online.md §3 + design/coop-multi.md §2）
// wx.connectSocket 封装：JSON 收发 + 25s 心跳 + 指数退避重连（1s/2s/4s 最多 3 次）。
// 重连成功后凭房间码+槽位自动发 rejoin join（服务器按离线槽位归位）。
// 所有异常静默降级，绝不影响游戏主流程。
import type { Command, GameEvent, NetGameState } from './game/types';

/** 名册成员（服务器 members 广播 / room·join 回包携带的全量名册） */
export interface MemberInfo {
  slot: number;
  nick: string;
  online: boolean;
  ready: boolean;
}

/** 服务器下发的 room 消息（guest 额外携带房间参数与主机昵称；多人房携带槽位与名册） */
export interface RoomInfo {
  roomId: string;
  role: 'host' | 'guest';
  /** 自己分配的槽位：主机恒 0；客机 1–3（旧服缺省：主机 0 / 客机 1） */
  slot: number;
  /** 房间人数上限（2–4；旧服缺省 2） */
  maxPlayers?: number;
  /** 全量名册（新服下发；旧服无此字段，客户端走 peer 兼容路径） */
  members?: MemberInfo[];
  levelId?: number;
  difficulty?: string;
  hostNick?: string;
}

export interface CoopCallbacks {
  /** 连接建立；reconnected=true 表示断线重连成功（首次为 false） */
  onOpen?(reconnected: boolean): void;
  onRoom?(info: RoomInfo): void;
  /** 对手状态：joined 加入 / lost 断线待重连 / back 重连回来 / left 主动离开 / ready 就绪变化 */
  onPeer?(nick: string, status: 'joined' | 'lost' | 'back' | 'left' | 'ready', slot: number): void;
  /** 全量名册刷新（任何成员加入/离开/断线/就绪变化时服务器下发，大厅与局内 HUD 以此渲染） */
  onMembers?(members: MemberInfo[]): void;
  /** 开局信号（满员自动或主机手动）：players 为实际开局名单，各端按 slot 确定守路 */
  onStart?(players: { slot: number; nick: string }[]): void;
  /** 主机收客机指令 */
  onCmd?(player: number, cmd: Command): void;
  /** 客机收主机快照（events 为快照间产生的游戏事件） */
  onSnap?(state: NetGameState, events: GameEvent[]): void;
  /** 结算仲裁 / 房间解散通知（reason: host_lost / peer_left） */
  onEnd?(won: boolean, reason?: string): void;
  /** 服务器错误码：room_full / room_not_found / bad_msg / server_full */
  onError?(code: string): void;
  /** 发起第 n 次重连（1 起，最多 3 次） */
  onReconnecting?(attempt: number): void;
  /** 重连耗尽，连接彻底断开（主动 close 不触发） */
  onClose?(): void;
}

export interface CoopConn {
  readonly connected: boolean;
  send(msg: Record<string, unknown>): boolean;
  /** 记录房间码与槽位：断线重连成功后自动 rejoin（slot 让服务器精确归位） */
  setRejoinInfo(info: { roomId: string; slot?: number } | null): void;
  close(): void;
}

interface WxSocketTask {
  onOpen(cb: () => void): void;
  onMessage(cb: (r: { data: unknown }) => void): void;
  onClose(cb: () => void): void;
  onError(cb: (e?: unknown) => void): void;
  send(o: { data: string; success?: () => void; fail?: (e?: unknown) => void }): void;
  close(o?: Record<string, unknown>): void;
}
/** wx 由调用方注入（main.ts 持有 declare；本模块不重复声明全局，浏览器 preview 也可注入 stub） */
export interface WxSocketLike {
  connectSocket?(o: { url: string }): WxSocketTask;
}

/** https://x → wss://x/ws；http://x → ws://x/ws（§4：由 srd.apiBase 派生）；无法识别返回空串 */
export function wsUrlFromApiBase(base: string): string {
  const b = base.trim().replace(/\/+$/, '');
  if (b.startsWith('https://')) return `wss://${b.slice('https://'.length)}/ws`;
  if (b.startsWith('http://')) return `ws://${b.slice('http://'.length)}/ws`;
  return '';
}

const MAX_RECONNECT = 3;
const PING_MS = 25000;

/** 名册解析：坏消息静默丢弃（逐条校验，非法条目跳过） */
function parseMembers(v: unknown): MemberInfo[] {
  if (!Array.isArray(v)) return [];
  const out: MemberInfo[] = [];
  for (const m of v) {
    if (!m || typeof m !== 'object') continue;
    const mm = m as Record<string, unknown>;
    if (typeof mm.slot !== 'number') continue;
    out.push({
      slot: mm.slot,
      nick: String(mm.nick ?? ''),
      online: mm.online !== false,
      ready: !!mm.ready,
    });
  }
  return out;
}

/** 开局名单解析（start 消息 players 字段） */
function parsePlayers(v: unknown): { slot: number; nick: string }[] {
  if (!Array.isArray(v)) return [];
  const out: { slot: number; nick: string }[] = [];
  for (const p of v) {
    if (!p || typeof p !== 'object') continue;
    const pp = p as Record<string, unknown>;
    if (typeof pp.slot !== 'number') continue;
    out.push({ slot: pp.slot, nick: String(pp.nick ?? '') });
  }
  return out;
}

/** 建立联机连接；环境不支持 wx.connectSocket 或地址非法时返回 null（优雅失败） */
export function connectCoop(
  wxImpl: WxSocketLike,
  opts: { url: string; nick: string },
  cb: CoopCallbacks,
): CoopConn | null {
  try {
    if (typeof wxImpl?.connectSocket !== 'function' || !opts.url) return null;

    let task: WxSocketTask | null = null;
    let opened = false;
    let everOpened = false;
    let attempts = 0;
    let closed = false; // close() 后整体失效（不再重连、不再回调）
    let rejoin: { roomId: string; slot?: number } | null = null;
    let mySlot: number | null = null; // room 回包记录的自身槽位（旧服 peer 消息无 slot 时据此推断对方槽位）
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function stopPing() {
      if (pingTimer !== null) clearInterval(pingTimer);
      pingTimer = null;
    }

    function sendRaw(msg: Record<string, unknown>): boolean {
      if (!task || !opened || closed) return false;
      try {
        task.send({ data: JSON.stringify(msg) });
        return true;
      } catch {
        return false;
      }
    }

    function scheduleRetry() {
      if (closed) return;
      attempts += 1;
      if (attempts > MAX_RECONNECT) {
        closed = true;
        cb.onClose?.();
        return;
      }
      cb.onReconnecting?.(attempts);
      retryTimer = setTimeout(connect, 1000 * 2 ** (attempts - 1));
    }

    function onDead() {
      opened = false;
      stopPing();
      scheduleRetry(); // 微信 onError 后通常紧跟 onClose，统一在 close 路径处理
    }

    function connect() {
      if (closed) return;
      try {
        task = wxImpl.connectSocket!({ url: opts.url });
      } catch {
        scheduleRetry();
        return;
      }
      if (!task) { scheduleRetry(); return; }
      opened = false;
      task.onOpen(() => {
        if (closed) return;
        opened = true;
        const wasRetry = attempts > 0 || everOpened;
        attempts = 0;
        everOpened = true;
        // 重连成功：凭房间码+槽位自动归位（slot 缺省时服务器按离线槽位分配）
        if (rejoin) {
          sendRaw({
            t: 'join', roomId: rejoin.roomId, nick: opts.nick, rejoin: true,
            ...(rejoin.slot != null ? { slot: rejoin.slot } : {}),
          });
        }
        stopPing();
        pingTimer = setInterval(() => sendRaw({ t: 'ping' }), PING_MS);
        cb.onOpen?.(wasRetry);
      });
      task.onMessage((r) => {
        if (closed) return;
        try {
          const msg = typeof r.data === 'string' ? JSON.parse(r.data) as Record<string, unknown> : null;
          if (!msg || typeof msg.t !== 'string') return;
          switch (msg.t) {
            case 'room': {
              const role = msg.role === 'host' ? 'host' : 'guest';
              const members = parseMembers(msg.members);
              mySlot = typeof msg.slot === 'number' ? msg.slot : (role === 'host' ? 0 : 1);
              cb.onRoom?.({
                roomId: String(msg.roomId ?? ''),
                role,
                slot: mySlot,
                maxPlayers: typeof msg.maxPlayers === 'number' ? msg.maxPlayers : undefined,
                members: members.length ? members : undefined,
                levelId: typeof msg.levelId === 'number' ? msg.levelId : undefined,
                difficulty: typeof msg.difficulty === 'string' ? msg.difficulty : undefined,
                hostNick: typeof msg.hostNick === 'string' ? msg.hostNick : undefined,
              });
              break;
            }
            case 'peer': {
              const st = msg.status;
              // 旧服 peer 不带 slot：主机视角对方恒为 1 号槽，客机视角对方恒为主机 0 号槽
              const slot = typeof msg.slot === 'number' ? msg.slot : (mySlot === 0 ? 1 : 0);
              cb.onPeer?.(
                String(msg.nick ?? ''),
                st === 'lost' ? 'lost'
                  : st === 'back' ? 'back'
                    : st === 'left' ? 'left'
                      : st === 'ready' ? 'ready' : 'joined',
                slot,
              );
              break;
            }
            case 'members': {
              const members = parseMembers(msg.members);
              if (members.length) cb.onMembers?.(members);
              break;
            }
            case 'start': {
              const players = parsePlayers(msg.players);
              if (players.length) cb.onStart?.(players);
              break;
            }
            case 'cmd':
              if (msg.cmd && typeof msg.cmd === 'object') cb.onCmd?.(Number(msg.player) || 0, msg.cmd as Command);
              break;
            case 'snap':
              if (msg.state && typeof msg.state === 'object') {
                cb.onSnap?.(msg.state as NetGameState, Array.isArray(msg.events) ? msg.events as GameEvent[] : []);
              }
              break;
            case 'end':
              cb.onEnd?.(!!msg.won, typeof msg.reason === 'string' ? msg.reason : undefined);
              break;
            case 'error':
              cb.onError?.(String(msg.code ?? 'unknown'));
              break;
            default: break; // pong 等无需处理
          }
        } catch { /* 坏消息静默丢弃 */ }
      });
      task.onClose(onDead);
      task.onError(() => { /* 统一走 onClose → onDead 重连路径 */ });
    }

    connect();

    return {
      get connected() { return opened && !closed; },
      send: sendRaw,
      setRejoinInfo(info) { rejoin = info; },
      close() {
        closed = true;
        stopPing();
        if (retryTimer !== null) clearTimeout(retryTimer);
        retryTimer = null;
        try { task?.close({}); } catch { /* ignore */ }
      },
    };
  } catch {
    return null;
  }
}
