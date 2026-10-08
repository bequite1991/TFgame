'use strict';
/**
 * 《高塔防线》在线联机房间服务（host-authoritative 纯转发）
 * 协议契约：design/coop-online.md §3
 *
 * 职责：房间管理（create/join/rejoin/leave）、cmd 与 snap 双向转发、
 * end 仲裁广播、心跳（30s 无消息标记断线）、主机断线 60s 解散、
 * 安全钳制（消息大小/频率/房间数/空置回收）。不跑任何游戏逻辑。
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
const MAX_MSG_PER_SEC = 30;
const MAX_NICK_LEN = 32;

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
 *
 * @typedef {Object} Room
 * @property {string} id
 * @property {number} levelId
 * @property {string} difficulty
 * @property {Member} host
 * @property {Member|null} guest
 * @property {NodeJS.Timeout|null} hostLostTimer
 * @property {number|null} emptySince 双方都断线的时间点（GC 用）
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

function sendTo(room, role, obj) {
  const m = role === 'host' ? room.host : room.guest;
  if (m) send(m.ws, obj);
}

function peerOf(room, role) {
  const m = role === 'host' ? room.guest : room.host;
  return m || null;
}

/** 通知对方成员状态变化：joined / lost / back */
function notifyPeer(room, role, status) {
  const member = role === 'host' ? room.host : room.guest;
  const peer = peerOf(room, role);
  if (peer) send(peer.ws, { t: 'peer', nick: member.nick, status });
}

/** 解散房间：清计时器、解绑并关闭连接、从表中删除 */
function destroyRoom(room) {
  if (room.hostLostTimer) clearTimeout(room.hostLostTimer);
  for (const m of [room.host, room.guest]) {
    if (m && m.ws) {
      unbind(m.ws);
      try { m.ws.close(1000, 'room_closed'); } catch { /* 已关闭 */ }
    }
  }
  rooms.delete(room.id);
}

/** 成员断线（心跳超时或 socket 关闭）：客机只通知主机，主机启动 60s 宽限计时 */
function markLost(room, role) {
  const member = role === 'host' ? room.host : room.guest;
  if (!member || !member.online) return;
  member.online = false;
  member.ws = null;
  notifyPeer(room, role, 'lost');

  if (role === 'host') {
    room.hostLostTimer = setTimeout(() => {
      // 主机 60s 未回：广播 end host_lost 并解散
      sendTo(room, 'host', { t: 'end', won: false, reason: 'host_lost' });
      sendTo(room, 'guest', { t: 'end', won: false, reason: 'host_lost' });
      destroyRoom(room);
    }, HOST_LOST_MS);
  }
  if (!room.host.online && !(room.guest && room.guest.online)) {
    room.emptySince = Date.now();
  }
}

/* ---------- 连接状态 ---------- */

/** 每个 socket 的绑定信息与限频计数 */
const connState = new WeakMap(); // ws -> { roomId, role, msgCount, windowStart }

function bind(ws, roomId, role) {
  connState.set(ws, { roomId, role, msgCount: 0, windowStart: Date.now() });
}

function unbind(ws) {
  const st = connState.get(ws);
  if (st) connState.set(ws, { roomId: null, role: null, msgCount: 0, windowStart: Date.now() });
}

function err(ws, code) {
  send(ws, { t: 'error', code });
}

/* ---------- 消息处理 ---------- */

function handleCreate(ws, msg) {
  if (rooms.size >= MAX_ROOMS) return err(ws, 'server_full');
  if (typeof msg.levelId !== 'number' || !VALID_DIFFICULTIES.has(msg.difficulty)) {
    return err(ws, 'bad_msg');
  }
  const id = makeRoomId();
  if (!id) return err(ws, 'server_full');

  /** @type {Room} */
  const room = {
    id,
    levelId: msg.levelId,
    difficulty: msg.difficulty,
    host: { nick: sanitizeNick(msg.nick), ws, online: true, lastMsgAt: Date.now() },
    guest: null,
    hostLostTimer: null,
    emptySince: null,
  };
  rooms.set(id, room);
  bind(ws, id, 'host');
  send(ws, { t: 'room', roomId: id, role: 'host' });
}

function handleJoin(ws, msg) {
  if (typeof msg.roomId !== 'string') return err(ws, 'bad_msg');
  const room = rooms.get(msg.roomId.toUpperCase());
  if (!room) return err(ws, 'room_not_found');

  const nick = sanitizeNick(msg.nick);

  if (msg.rejoin === true) {
    // 断线重连：凭 roomId + role  reclaim 离线槽位（role 缺省时取当前离线的槽位）
    const candidates = [];
    if (!room.host.online) candidates.push('host');
    if (room.guest && !room.guest.online) candidates.push('guest');
    let role = msg.role === 'host' || msg.role === 'guest' ? msg.role : null;
    if (role && !candidates.includes(role)) return err(ws, 'bad_msg');
    if (!role) {
      if (candidates.length !== 1) return err(ws, 'bad_msg');
      role = candidates[0];
    }
    const member = role === 'host' ? room.host : room.guest;
    // 旧 socket 可能还半开着，先关掉
    if (member.ws) { try { member.ws.close(1000, 'replaced'); } catch { /* ignore */ } }
    member.ws = ws;
    member.online = true;
    member.lastMsgAt = Date.now();
    if (nick) member.nick = nick;
    if (role === 'host' && room.hostLostTimer) {
      clearTimeout(room.hostLostTimer);
      room.hostLostTimer = null;
    }
    room.emptySince = null;
    bind(ws, room.id, role);
    if (role === 'host') {
      send(ws, { t: 'room', roomId: room.id, role: 'host' });
    } else {
      send(ws, {
        t: 'room', roomId: room.id, role: 'guest',
        levelId: room.levelId, difficulty: room.difficulty, hostNick: room.host.nick,
      });
    }
    notifyPeer(room, role, 'back');
    return;
  }

  // 新客机加入
  if (room.guest) return err(ws, 'room_full');
  room.guest = { nick, ws, online: true, lastMsgAt: Date.now() };
  room.emptySince = null;
  bind(ws, room.id, 'guest');
  send(ws, {
    t: 'room', roomId: room.id, role: 'guest',
    levelId: room.levelId, difficulty: room.difficulty, hostNick: room.host.nick,
  });
  notifyPeer(room, 'guest', 'joined');
}

function handleMessage(ws, raw) {
  // 限频：≤30 条/秒，超限断开
  const st = connState.get(ws);
  const now = Date.now();
  if (st) {
    if (now - st.windowStart >= 1000) {
      st.windowStart = now;
      st.msgCount = 0;
    }
    if (++st.msgCount > MAX_MSG_PER_SEC) {
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
    const member = room && (st.role === 'host' ? room.host : room.guest);
    if (member && member.ws === ws) member.lastMsgAt = now;
  }

  switch (msg.t) {
    case 'create':
      return handleCreate(ws, msg);
    case 'join':
      return handleJoin(ws, msg);
    case 'ping':
      return send(ws, { t: 'pong' });
    case 'leave': {
      if (!st || !st.roomId) return;
      const room = rooms.get(st.roomId);
      if (!room) return;
      // 主动离开：通知对方后解散房间
      const peer = peerOf(room, st.role);
      if (peer) send(peer.ws, { t: 'end', won: false, reason: 'peer_left' });
      destroyRoom(room);
      return;
    }
    case 'cmd':
    case 'snap':
    case 'end': {
      if (!st || !st.roomId || !st.role) return err(ws, 'bad_msg');
      const room = rooms.get(st.roomId);
      if (!room) return err(ws, 'room_not_found');

      if (msg.t === 'cmd') {
        // 大小钳制在入口已按消息类型检查；原样转发给对方
        if (msg.cmd === undefined || msg.cmd === null) return err(ws, 'bad_msg');
        const peerRole = st.role === 'host' ? 'guest' : 'host';
        sendTo(room, peerRole, { t: 'cmd', player: msg.player, cmd: msg.cmd });
        return;
      }
      if (msg.t === 'snap') {
        if (st.role !== 'host') return err(ws, 'bad_msg'); // 只有主机发快照
        // events（waveStart/leak/bossDown/sfx 等）一并转发，客机靠它播音效与波次提示
        sendTo(room, 'guest', { t: 'snap', state: msg.state, events: Array.isArray(msg.events) ? msg.events : [] });
        return;
      }
      // end：仅主机可仲裁，广播双方后解散
      if (st.role !== 'host') return err(ws, 'bad_msg');
      const won = msg.won === true;
      sendTo(room, 'host', { t: 'end', won });
      sendTo(room, 'guest', { t: 'end', won });
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
  connState.set(ws, { roomId: null, role: null, msgCount: 0, windowStart: Date.now() });

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
    if (st && st.roomId) {
      const room = rooms.get(st.roomId);
      if (room) {
        const member = st.role === 'host' ? room.host : room.guest;
        // rejoin 换新连接后旧 socket 的 close 不应误标记
        if (member && member.ws === ws) markLost(room, st.role);
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
    for (const role of ['host', 'guest']) {
      const m = role === 'host' ? room.host : room.guest;
      if (m && m.online && now - m.lastMsgAt > PING_TIMEOUT_MS) {
        if (m.ws) { try { m.ws.close(1001, 'ping_timeout'); } catch { /* ignore */ } }
        markLost(room, role);
      }
    }
  }
}, 5000).unref();

// 空置房间回收：双方都断线超过 10 分钟
setInterval(() => {
  const now = Date.now();
  for (const room of [...rooms.values()]) {
    if (room.emptySince && now - room.emptySince > IDLE_GC_MS) destroyRoom(room);
  }
}, 30_000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[srd-coop] listening on ${PORT} (ws + /health)`);
});
