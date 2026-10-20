'use strict';
/**
 * 《高塔防线》在线联机房间服务（host-authoritative 纯转发，2–4 人槽位制）
 * 协议契约：design/coop-online.md §3（双人基线）+ design/coop-multi.md §2（多人扩展）
 *
 * 职责：房间管理（create/join/rejoin/ready/start/leave）、cmd 与 snap 转发、
 * end 仲裁广播、心跳（30s 无消息标记断线）、主机断线 60s 解散、
 * 安全钳制（消息大小/频率/房间数/空置回收）。不跑任何游戏逻辑。
 *
 * 向后兼容语义（关键）：maxPlayers 缺省为 2，此时旧版双人客户端零改动可用——
 * 旧客户端没有 ready/start 流程，故约定「客机 join 成功即视为就绪（ready 缺省 true），
 * 房间满员（在线成员数 == maxPlayers）且全员就绪时服务器自动广播 start」；
 * 新协议客户端的大厅 ready/start 只是额外 UI 层（客机可用 ready:false 推迟自动 start）。
 * 2 人房（maxPlayers === 2）保留旧语义：任何一方 leave → 对方收 end peer_left 并解散；
 * 多人房（maxPlayers > 2）客机 leave 不再散房，仅广播 peer left、释放或保留槽位。
 */

const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 3301);
// 超时参数可用环境变量覆盖（测试用）
const PING_TIMEOUT_MS = Number(process.env.PING_TIMEOUT_MS || 30_000); // 无消息判定断线
const HOST_LOST_MS = Number(process.env.HOST_LOST_MS || 60_000); // 主机断线宽限
const IDLE_GC_MS = Number(process.env.IDLE_GC_MS || 600_000); // 空置房间回收

const MAX_ROOMS = 500;
const MAX_SNAP_BYTES = 512 * 1024;
const MAX_CMD_BYTES = 8 * 1024;
const MAX_MSG_BYTES = MAX_SNAP_BYTES + 1024; // 任何消息的最大原始字节
const MAX_MSG_PER_SEC = 30; // 客机限频
const MAX_MSG_PER_SEC_HOST = 60; // 主机限频（承载多份 snap 上行转发回压下的指令流）
const MAX_NICK_LEN = 32;
const MAX_PLAYERS = 4;

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆 0O1I
const VALID_DIFFICULTIES = new Set(['normal']); // 难度已收敛为单一「普通」，挑战度由客户端关卡阶梯承载

/** @type {Map<string, Room>} */
const rooms = new Map();

/**
 * @typedef {Object} Member
 * @property {string} nick
 * @property {import('ws').WebSocket|null} ws
 * @property {boolean} online
 * @property {number} lastMsgAt
 * @property {boolean} ready 客机就绪标记（join 缺省 true，见文件头兼容语义）；主机恒 true
 *
 * @typedef {Object} Room
 * @property {string} id
 * @property {number} levelId
 * @property {string} difficulty
 * @property {number} maxPlayers 2–4，建房时定
 * @property {(Member|null)[]} members 槽位数组，长度 maxPlayers；members[0] 恒为主机
 * @property {boolean} started 开局后不再接受新 join（只接受 rejoin）
 * @property {NodeJS.Timeout|null} hostLostTimer
 * @property {number|null} emptySince 全员都断线的时间点（GC 用）
 */

function makeRoomId() {
  for (let tries = 0; tries < 100; tries++) {
    let id = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) id += ROOM_CHARS[bytes[i] % ROOM_CHARS.length];
    if (!rooms.has(id)) return id;
  }
  return null;
}

function sanitizeNick(v) {
  return typeof v === 'string' ? v.slice(0, MAX_NICK_LEN) : '';
}

function send(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

/** 全量名册（members 广播与 join 回包共用） */
function roster(room) {
  const list = [];
  for (let i = 0; i < room.members.length; i++) {
    const m = room.members[i];
    if (m) list.push({ slot: i, nick: m.nick, online: m.online, ready: m.ready });
  }
  return list;
}

/** 向房间内所有在线成员广播（exceptSlot 可排除发送者自己） */
function broadcast(room, obj, exceptSlot = -1) {
  for (let i = 0; i < room.members.length; i++) {
    const m = room.members[i];
    if (m && m.online && i !== exceptSlot) send(m.ws, obj);
  }
}

/** 名册全量广播：任何加入/离开/断线/重连/就绪变化时下发 */
function broadcastMembers(room) {
  broadcast(room, { t: 'members', members: roster(room) });
}

/** 通知其余成员某槽位状态变化：joined / lost / back / left / ready（一律带 slot） */
function notifyPeer(room, slot, status, extra) {
  const m = room.members[slot];
  if (!m) return;
  broadcast(room, { t: 'peer', nick: m.nick, slot, status, ...extra }, slot);
}

/** 解散房间：清计时器、解绑并关闭连接、从表中删除 */
function destroyRoom(room) {
  if (room.hostLostTimer) clearTimeout(room.hostLostTimer);
  for (const m of room.members) {
    if (m && m.ws) {
      unbind(m.ws);
      try { m.ws.close(1000, 'room_closed'); } catch { /* 已关闭 */ }
    }
  }
  rooms.delete(room.id);
}

/** 广播 start 并把房间置为 started（自动 start 与主机手动 start 共用） */
function startRoom(room) {
  room.started = true;
  const players = [];
  for (let i = 0; i < room.members.length; i++) {
    const m = room.members[i];
    if (m && m.online) players.push({ slot: i, nick: m.nick });
  }
  broadcast(room, { t: 'start', players });
}

/**
 * 自动 start：房间满员（在线成员数 == maxPlayers）且全员就绪时触发。
 * 兼容旧版双人客户端「建房→客机加入→开打」零流程变化（见文件头注释）。
 */
function maybeAutoStart(room) {
  if (room.started) return;
  let online = 0;
  for (const m of room.members) {
    if (!m || !m.online) return; // 尚有空槽位，未满员
    online++;
    if (!m.ready) return; // 有在线成员未就绪（新协议客机可用 ready:false 推迟）
  }
  if (online === room.maxPlayers) startRoom(room);
}

/** 成员断线（心跳超时或 socket 关闭）：广播 peer lost；主机启动 60s 宽限计时 */
function markLost(room, slot) {
  const member = room.members[slot];
  if (!member || !member.online) return;
  member.online = false;
  member.ws = null;
  notifyPeer(room, slot, 'lost');
  broadcastMembers(room);

  if (slot === 0) {
    room.hostLostTimer = setTimeout(() => {
      // 主机 60s 未回：广播 end host_lost 并解散
      broadcast(room, { t: 'end', won: false, reason: 'host_lost' });
      destroyRoom(room);
    }, HOST_LOST_MS);
  }
  if (!room.members.some((m) => m && m.online)) {
    room.emptySince = Date.now();
  }
}

/* ---------- 连接状态 ---------- */

/** 每个 socket 的绑定信息与限频计数 */
const connState = new WeakMap(); // ws -> { roomId, slot, msgCount, windowStart }

function bind(ws, roomId, slot) {
  connState.set(ws, { roomId, slot, msgCount: 0, windowStart: Date.now() });
}

function unbind(ws) {
  const st = connState.get(ws);
  if (st) connState.set(ws, { roomId: null, slot: null, msgCount: 0, windowStart: Date.now() });
}

function err(ws, code) {
  send(ws, { t: 'error', code });
}

/* ---------- 消息处理 ---------- */

function handleCreate(ws, msg) {
  if (rooms.size >= MAX_ROOMS) return err(ws, 'server_full');
  const maxPlayers = msg.maxPlayers === undefined ? 2 : msg.maxPlayers;
  if (typeof msg.levelId !== 'number' || !VALID_DIFFICULTIES.has(msg.difficulty)
    || !Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > MAX_PLAYERS) {
    return err(ws, 'bad_msg');
  }
  const id = makeRoomId();
  if (!id) return err(ws, 'server_full');

  const members = new Array(maxPlayers).fill(null);
  members[0] = { nick: sanitizeNick(msg.nick), ws, online: true, lastMsgAt: Date.now(), ready: true };
  /** @type {Room} */
  const room = {
    id,
    levelId: msg.levelId,
    difficulty: msg.difficulty,
    maxPlayers,
    members,
    started: false,
    hostLostTimer: null,
    emptySince: null,
  };
  rooms.set(id, room);
  bind(ws, id, 0);
  send(ws, { t: 'room', roomId: id, role: 'host', slot: 0, maxPlayers, members: roster(room) });
}

function handleJoin(ws, msg) {
  if (typeof msg.roomId !== 'string') return err(ws, 'bad_msg');
  const room = rooms.get(msg.roomId.toUpperCase());
  if (!room) return err(ws, 'room_not_found');

  const nick = sanitizeNick(msg.nick);

  if (msg.rejoin === true) {
    // 断线重连：凭 roomId + slot reclaim 离线槽位（slot 缺省时取唯一离线槽位）
    let slot = null;
    if (Number.isInteger(msg.slot)) {
      slot = msg.slot;
    } else if (msg.role === 'host' || msg.role === 'guest') {
      // 兼容旧客户端：以 role 指认槽位（host→0，guest→1；旧客户端只会出现在 2 人房）
      slot = msg.role === 'host' ? 0 : 1;
    }
    if (slot !== null) {
      const m = slot >= 0 && slot < room.maxPlayers ? room.members[slot] : null;
      if (!m || m.online) return err(ws, 'bad_slot');
    } else {
      const candidates = [];
      for (let i = 0; i < room.members.length; i++) {
        if (room.members[i] && !room.members[i].online) candidates.push(i);
      }
      if (candidates.length !== 1) return err(ws, 'bad_msg');
      slot = candidates[0];
    }
    const member = room.members[slot];
    // 旧 socket 可能还半开着，先关掉
    if (member.ws) { try { member.ws.close(1000, 'replaced'); } catch { /* ignore */ } }
    member.ws = ws;
    member.online = true;
    member.lastMsgAt = Date.now();
    if (nick) member.nick = nick;
    if (slot === 0 && room.hostLostTimer) {
      clearTimeout(room.hostLostTimer);
      room.hostLostTimer = null;
    }
    room.emptySince = null;
    bind(ws, room.id, slot);
    send(ws, {
      t: 'room', roomId: room.id, role: slot === 0 ? 'host' : 'guest', slot,
      levelId: room.levelId, difficulty: room.difficulty, hostNick: room.members[0].nick,
      maxPlayers: room.maxPlayers, members: roster(room),
    });
    notifyPeer(room, slot, 'back');
    broadcastMembers(room);
    return;
  }

  // 新客机加入：占最小空槽位；开局后只接受 rejoin
  if (room.started) return err(ws, 'room_full');
  let slot = -1;
  for (let i = 0; i < room.members.length; i++) {
    if (!room.members[i]) { slot = i; break; }
  }
  if (slot === -1) return err(ws, 'room_full');
  // ready 缺省 true：客机 join 成功即视为就绪（旧客户端无 ready 流程，见文件头兼容语义）
  room.members[slot] = { nick, ws, online: true, lastMsgAt: Date.now(), ready: true };
  room.emptySince = null;
  bind(ws, room.id, slot);
  send(ws, {
    t: 'room', roomId: room.id, role: 'guest', slot,
    levelId: room.levelId, difficulty: room.difficulty, hostNick: room.members[0].nick,
    maxPlayers: room.maxPlayers, members: roster(room),
  });
  notifyPeer(room, slot, 'joined');
  broadcastMembers(room);
  maybeAutoStart(room);
}

function handleMessage(ws, raw) {
  // 限频：主机 ≤60 条/秒、客机 ≤30 条/秒，超限断开
  const st = connState.get(ws);
  const now = Date.now();
  if (st) {
    if (now - st.windowStart >= 1000) {
      st.windowStart = now;
      st.msgCount = 0;
    }
    const limit = st.slot === 0 ? MAX_MSG_PER_SEC_HOST : MAX_MSG_PER_SEC;
    if (++st.msgCount > limit) {
      ws.close(1008, 'rate_limit');
      return;
    }
  }

  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return err(ws, 'bad_msg');
  }
  if (!msg || typeof msg.t !== 'string') return err(ws, 'bad_msg');

  // 更新活跃时间（心跳判定基于任何消息，不只是 ping）
  if (st && st.roomId) {
    const room = rooms.get(st.roomId);
    const member = room && st.slot !== null ? room.members[st.slot] : null;
    if (member && member.ws === ws) member.lastMsgAt = now;
  }

  switch (msg.t) {
    case 'create':
      return handleCreate(ws, msg);
    case 'join':
      return handleJoin(ws, msg);
    case 'ping':
      return send(ws, { t: 'pong' });
    case 'ready': {
      // 客机就绪/取消就绪（仅开局前；主机恒就绪）
      if (!st || !st.roomId || st.slot === null || st.slot === 0) return err(ws, 'bad_msg');
      const room = rooms.get(st.roomId);
      if (!room) return err(ws, 'room_not_found');
      if (room.started) return err(ws, 'bad_msg');
      const member = room.members[st.slot];
      if (!member || member.ws !== ws) return err(ws, 'bad_msg');
      const ready = msg.ready === true;
      if (member.ready !== ready) {
        member.ready = ready;
        notifyPeer(room, st.slot, 'ready', { ready });
        broadcastMembers(room);
        maybeAutoStart(room); // 满员房最后一人补就绪时自动 start
      }
      return;
    }
    case 'start': {
      // 仅主机可发；校验 ≥2 人在线且全部在线客机已就绪
      if (!st || !st.roomId || st.slot === null) return err(ws, 'bad_msg');
      const room = rooms.get(st.roomId);
      if (!room) return err(ws, 'room_not_found');
      if (st.slot !== 0 || room.started) return err(ws, 'bad_msg');
      let online = 0;
      for (const m of room.members) {
        if (m && m.online) {
          online++;
          if (!m.ready) return err(ws, 'bad_msg'); // 有在线客机未就绪
        }
      }
      if (online < 2) return err(ws, 'bad_msg');
      startRoom(room);
      return;
    }
    case 'leave': {
      if (!st || !st.roomId || st.slot === null) return;
      const room = rooms.get(st.roomId);
      if (!room) return;
      const slot = st.slot;
      // 主机离开仍解散；2 人房保留旧语义（任何一方离开即散房），兼容旧客户端
      if (slot === 0 || room.maxPlayers === 2) {
        broadcast(room, { t: 'end', won: false, reason: 'peer_left' }, slot);
        destroyRoom(room);
        return;
      }
      // 多人房客机离开：房间存续。开局前释放槽位，开局后保留槽位供 rejoin（标记离线）
      const member = room.members[slot];
      if (!member) return;
      notifyPeer(room, slot, 'left');
      if (room.started) {
        member.online = false;
        member.ws = null;
      } else {
        room.members[slot] = null;
      }
      unbind(ws);
      broadcastMembers(room);
      if (!room.members.some((m) => m && m.online)) room.emptySince = Date.now();
      return;
    }
    case 'cmd':
    case 'snap':
    case 'end': {
      if (!st || !st.roomId || st.slot === null) return err(ws, 'bad_msg');
      const room = rooms.get(st.roomId);
      if (!room) return err(ws, 'room_not_found');
      const member = room.members[st.slot];
      if (!member || member.ws !== ws) return err(ws, 'bad_msg');

      if (msg.t === 'cmd') {
        if (!room.started) return err(ws, 'not_started');
        // 大小钳制在入口已按消息类型检查
        if (msg.cmd === undefined || msg.cmd === null) return err(ws, 'bad_msg');
        if (st.slot === 0) {
          // 主机指令本不应上网（走本地 dispatch）；兼容旧协议仍转发给所有在线客机
          broadcast(room, { t: 'cmd', player: msg.player, cmd: msg.cmd }, 0);
        } else {
          // 任何客机指令只发主机
          const host = room.members[0];
          if (host && host.online) send(host.ws, { t: 'cmd', player: msg.player, cmd: msg.cmd });
        }
        return;
      }
      if (msg.t === 'snap') {
        if (st.slot !== 0) return err(ws, 'bad_msg'); // 只有主机发快照
        if (!room.started) return err(ws, 'not_started');
        // events（waveStart/leak/bossDown/sfx 等）一并转发，客机靠它播音效与波次提示
        broadcast(room, { t: 'snap', state: msg.state, events: Array.isArray(msg.events) ? msg.events : [] }, 0);
        return;
      }
      // end：仅主机可仲裁，广播全体后解散
      if (st.slot !== 0) return err(ws, 'bad_msg');
      const won = msg.won === true;
      broadcast(room, { t: 'end', won });
      destroyRoom(room);
      return;
    }
    default:
      return err(ws, 'bad_msg');
  }
}

/* ---------- HTTP + WS 服务 ---------- */

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  connState.set(ws, { roomId: null, slot: null, msgCount: 0, windowStart: Date.now() });

  ws.on('message', (data, isBinary) => {
    if (isBinary || data.length > MAX_MSG_BYTES) {
      ws.close(1009, 'too_big');
      return;
    }
    const raw = data.toString('utf8');
    // 类型化大小钳制：snap ≤512KB、cmd ≤8KB（在 JSON 解析前粗判，解析后按类型确认）
    let t = null;
    const m = /"t"\s*:\s*"(\w+)"/.exec(raw.slice(0, 64));
    if (m) t = m[1];
    if (t === 'cmd' && data.length > MAX_CMD_BYTES) {
      ws.close(1009, 'cmd_too_big');
      return;
    }
    if (t === 'snap' && data.length > MAX_SNAP_BYTES) {
      ws.close(1009, 'snap_too_big');
      return;
    }
    handleMessage(ws, raw);
  });

  ws.on('close', () => {
    const st = connState.get(ws);
    if (st && st.roomId !== null && st.slot !== null) {
      const room = rooms.get(st.roomId);
      if (room) {
        const member = room.members[st.slot];
        // rejoin 换新连接后旧 socket 的 close 不应误标记
        if (member && member.ws === ws) markLost(room, st.slot);
      }
    }
    connState.delete(ws);
  });

  ws.on('error', () => { /* close 事件会跟进 */ });
});

// 心跳巡检：30s 无任何消息 → 标记断线
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    for (let slot = 0; slot < room.members.length; slot++) {
      const m = room.members[slot];
      if (m && m.online && now - m.lastMsgAt > PING_TIMEOUT_MS) {
        if (m.ws) { try { m.ws.close(1001, 'ping_timeout'); } catch { /* ignore */ } }
        markLost(room, slot);
      }
    }
  }
}, 5000).unref();

// 空置房间回收：全员断线超过 10 分钟
setInterval(() => {
  const now = Date.now();
  for (const room of [...rooms.values()]) {
    if (room.emptySince && now - room.emptySince > IDLE_GC_MS) destroyRoom(room);
  }
}, 30_000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[srd-coop] listening on ${PORT} (ws + /health)`);
});
