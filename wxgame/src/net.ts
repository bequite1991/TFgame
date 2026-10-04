// 在线联机网络层（C 档 · 主机权威；协议见 design/coop-online.md §3）
// wx.connectSocket 封装：JSON 收发 + 25s 心跳 + 指数退避重连（1s/2s/4s 最多 3 次）。
// 重连成功后凭房间码自动发 rejoin join（缺省 role，服务器按离线槽位归位）。
// 所有异常静默降级，绝不影响游戏主流程。
import type { Command, GameEvent, NetGameState } from './game/types';

/** 服务器下发的 room 消息（guest 额外携带房间参数与主机昵称） */
export interface RoomInfo {
  roomId: string;
  role: 'host' | 'guest';
  levelId?: number;
  difficulty?: string;
  hostNick?: string;
}

export interface CoopCallbacks {
  /** 连接建立；reconnected=true 表示断线重连成功（首次为 false） */
  onOpen?(reconnected: boolean): void;
  onRoom?(info: RoomInfo): void;
  /** 对手状态：joined 加入 / lost 断线待重连 / back 重连回来 */
  onPeer?(nick: string, status: 'joined' | 'lost' | 'back'): void;
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
  /** 记录房间码：断线重连成功后自动 rejoin */
  setRejoinInfo(info: { roomId: string } | null): void;
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
    let rejoin: { roomId: string } | null = null;
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
        // 重连成功：凭房间码自动归位（role 缺省，服务器按离线槽位分配）
        if (rejoin) sendRaw({ t: 'join', roomId: rejoin.roomId, nick: opts.nick, rejoin: true });
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
            case 'room':
              cb.onRoom?.({
                roomId: String(msg.roomId ?? ''),
                role: msg.role === 'host' ? 'host' : 'guest',
                levelId: typeof msg.levelId === 'number' ? msg.levelId : undefined,
                difficulty: typeof msg.difficulty === 'string' ? msg.difficulty : undefined,
                hostNick: typeof msg.hostNick === 'string' ? msg.hostNick : undefined,
              });
              break;
            case 'peer':
              cb.onPeer?.(
                String(msg.nick ?? ''),
                msg.status === 'lost' ? 'lost' : msg.status === 'back' ? 'back' : 'joined',
              );
              break;
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
