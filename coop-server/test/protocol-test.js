'use strict';
/**
 * 协议全流程测试：本脚本拉起一个短超时的服务器实例，模拟多个客户端走完整协议。
 * 覆盖：旧版双人兼容路径（create 不带 maxPlayers → join → 自动 start）与
 * 2–4 人槽位制扩展（ready/start/members/多客机路由/客机 leave 存续/rejoin 归位）。
 * 运行：node test/protocol-test.js
 */
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('ws');

const PORT = 3391;
const URL = `ws://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); }
}

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const inbox = [];
    const waiters = [];
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (waiters[i].pred(msg)) {
          const w = waiters.splice(i, 1)[0];
          w.resolve(msg);
          return;
        }
      }
      inbox.push(msg);
    });
    ws.on('open', () => resolve({
      ws,
      inbox,
      send: (obj) => ws.send(JSON.stringify(obj)),
      /** 等待一条满足条件的消息（先查已收缓存） */
      next(pred, timeoutMs = 3000) {
        for (let i = inbox.length - 1; i >= 0; i--) {
          if (pred(inbox[i])) return Promise.resolve(inbox.splice(i, 1)[0]);
        }
        return new Promise((res, rej) => {
          const timer = setTimeout(() => rej(new Error('timeout waiting message')), timeoutMs);
          waiters.push({ pred, resolve: (m) => { clearTimeout(timer); res(m); } });
        });
      },
      /** 清空已收缓存（用于「不应收到」断言前对齐） */
      drain() { inbox.length = 0; },
    }));
    ws.on('error', reject);
  });
}

function closed(ws) {
  return new Promise((res) => {
    if (ws.readyState === ws.CLOSED) return res();
    ws.on('close', () => res());
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 在名册里按 slot 取条目 */
function rosterEntry(membersMsg, slot) {
  return membersMsg.members.find((e) => e.slot === slot);
}

async function main() {
  // 短超时实例：断线判定 1.5s、主机宽限 2s、空置回收 3s
  const server = spawn('node', [path.join(__dirname, '..', 'server.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      PING_TIMEOUT_MS: '1500',
      HOST_LOST_MS: '2000',
      IDLE_GC_MS: '3000',
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  server.stdout.on('data', () => {});
  await sleep(800);

  try {
    /* ---- 1. 旧协议路径回归：create（不带 maxPlayers）/ join / 自动 start ---- */
    console.log('1. create / join / 自动 start（旧协议兼容）');
    const host = await connect();
    host.send({ t: 'create', nick: '主机A', levelId: 3, difficulty: 'normal' });
    const roomMsg = await host.next((m) => m.t === 'room');
    check('create 返回 roomId + role=host + slot=0 + maxPlayers=2',
      /^[A-Z2-9]{6}$/.test(roomMsg.roomId) && roomMsg.role === 'host' && roomMsg.slot === 0 && roomMsg.maxPlayers === 2);
    const roomId = roomMsg.roomId;

    const guest = await connect();
    guest.send({ t: 'join', roomId, nick: '客机B' });
    const joinMsg = await guest.next((m) => m.t === 'room');
    check('join 返回 role=guest + slot=1 + levelId/difficulty/hostNick',
      joinMsg.role === 'guest' && joinMsg.slot === 1 && joinMsg.levelId === 3
      && joinMsg.difficulty === 'normal' && joinMsg.hostNick === '主机A');
    check('join 回包带全量 members 名册',
      Array.isArray(joinMsg.members) && joinMsg.members.length === 2
      && joinMsg.members[0].slot === 0 && joinMsg.members[1].slot === 1);
    const peerMsg = await host.next((m) => m.t === 'peer');
    check('主机收到 peer joined（带 slot）', peerMsg.status === 'joined' && peerMsg.nick === '客机B' && peerMsg.slot === 1);
    const membersAtHost = await host.next((m) => m.t === 'members');
    check('主机收到 members 名册广播',
      membersAtHost.members.length === 2 && rosterEntry(membersAtHost, 1).online === true);
    const startAtHost = await host.next((m) => m.t === 'start');
    const startAtGuest = await guest.next((m) => m.t === 'start');
    check('满员自动广播 start（旧客户端零流程变化）',
      startAtHost.players.length === 2 && startAtGuest.players.length === 2
      && startAtHost.players[0].slot === 0 && startAtHost.players[1].slot === 1);

    /* ---- 2. cmd 转发 / snap 转发（2 人房已自动开局） ---- */
    console.log('2. cmd / snap 转发');
    guest.send({ t: 'cmd', player: 1, cmd: { type: 'BUILD', tower: 'arrow' } });
    const cmdAtHost = await host.next((m) => m.t === 'cmd');
    check('guest cmd → host', cmdAtHost.player === 1 && cmdAtHost.cmd.type === 'BUILD');
    host.send({ t: 'cmd', player: 0, cmd: { type: 'START' } });
    const cmdAtGuest = await guest.next((m) => m.t === 'cmd');
    check('host cmd → guest（旧协议兼容）', cmdAtGuest.player === 0 && cmdAtGuest.cmd.type === 'START');
    host.send({ t: 'snap', state: { wave: 5, lives: 18 }, events: [{ type: 'waveStart', wave: 5 }] });
    const snapAtGuest = await guest.next((m) => m.t === 'snap');
    check('host snap → guest', snapAtGuest.state.wave === 5);
    check('snap 外层 events 一并转发', Array.isArray(snapAtGuest.events) && snapAtGuest.events[0]?.type === 'waveStart');
    guest.send({ t: 'snap', state: {} });
    const snapErr = await guest.next((m) => m.t === 'error');
    check('guest 发 snap 被拒 bad_msg', snapErr.code === 'bad_msg');

    /* ---- 3. ping/pong ---- */
    console.log('3. ping/pong');
    host.send({ t: 'ping' });
    const pong = await host.next((m) => m.t === 'pong');
    check('ping → pong', pong.t === 'pong');

    /* ---- 4. 错误路径 ---- */
    console.log('4. error 分支');
    const c3 = await connect();
    c3.send({ t: 'join', roomId: 'ZZZZZZ', nick: 'x' });
    check('join 不存在的房间 → room_not_found', (await c3.next((m) => m.t === 'error')).code === 'room_not_found');
    c3.send({ t: 'join', roomId, nick: '第三人' });
    check('第三人 join 2 人房 → room_full', (await c3.next((m) => m.t === 'error')).code === 'room_full');
    c3.send({ t: 'create', nick: 'x', levelId: 1, difficulty: 'normal', maxPlayers: 5 });
    check('maxPlayers=5 → bad_msg', (await c3.next((m) => m.t === 'error')).code === 'bad_msg');
    c3.send({ t: 'create', nick: 'x', levelId: 1, difficulty: 'normal', maxPlayers: 1 });
    check('maxPlayers=1 → bad_msg', (await c3.next((m) => m.t === 'error')).code === 'bad_msg');
    c3.send('{ 这不是 JSON');
    check('坏 JSON → bad_msg', (await c3.next((m) => m.t === 'error')).code === 'bad_msg');
    c3.ws.close();

    /* ---- 5. 客机断线通知 + rejoin（旧协议 role 指认槽位） ---- */
    console.log('5. guest 断线 / rejoin（role 兼容）');
    guest.ws.terminate();
    const lostMsg = await host.next((m) => m.t === 'peer' && m.status === 'lost');
    check('guest 断开 → 主机收到 peer lost（带 slot）', lostMsg.nick === '客机B' && lostMsg.slot === 1);
    const lostMembers = await host.next((m) => m.t === 'members' && rosterEntry(m, 1)?.online === false);
    check('名册广播标记离线', !!lostMembers);
    await sleep(500);
    // 房间不拆：客机凭 roomId+role 重连（旧客户端写法）
    const guest2 = await connect();
    guest2.send({ t: 'join', roomId, nick: '客机B', rejoin: true, role: 'guest' });
    const rejoinMsg = await guest2.next((m) => m.t === 'room');
    check('rejoin 成功（按 slot 归位）', rejoinMsg.role === 'guest' && rejoinMsg.slot === 1 && rejoinMsg.levelId === 3);
    const backMsg = await host.next((m) => m.t === 'peer' && m.status === 'back');
    check('主机收到 peer back', backMsg.nick === '客机B' && backMsg.slot === 1);

    /* ---- 6. 主机断线 60s（测试 2s）解散 ---- */
    console.log('6. host 断线宽限后解散');
    host.ws.terminate();
    const hostLostPeer = await guest2.next((m) => m.t === 'peer' && m.status === 'lost');
    check('host 断开 → 客机收到 peer lost', hostLostPeer.slot === 0);
    guest2.send({ t: 'ping' }); // 等待 2s 宽限期间保持活跃（测试实例心跳判定 1.5s）
    const endMsg = await guest2.next((m) => m.t === 'end', 5000);
    check('宽限到点广播 end host_lost', endMsg.won === false && endMsg.reason === 'host_lost');
    await closed(guest2.ws);
    check('解散后连接被关闭', true);

    /* ---- 7. end 仲裁 ---- */
    console.log('7. end 仲裁');
    const h2 = await connect();
    h2.send({ t: 'create', nick: 'H', levelId: 1, difficulty: 'normal' });
    const r2 = await h2.next((m) => m.t === 'room');
    const g2 = await connect();
    g2.send({ t: 'join', roomId: r2.roomId, nick: 'G' });
    await g2.next((m) => m.t === 'room');
    await g2.next((m) => m.t === 'start'); // 满员自动 start
    g2.send({ t: 'end', won: true });
    check('guest 发 end 被拒', (await g2.next((m) => m.t === 'error')).code === 'bad_msg');
    h2.send({ t: 'end', won: true });
    const endH = await h2.next((m) => m.t === 'end');
    const endG = await g2.next((m) => m.t === 'end');
    check('end 广播双方 won=true', endH.won === true && endG.won === true);

    /* ---- 8. 2 人房 leave 解散（旧语义） ---- */
    console.log('8. leave（2 人房旧语义）');
    const h3 = await connect();
    h3.send({ t: 'create', nick: 'H3', levelId: 2, difficulty: 'normal' });
    const r3 = await h3.next((m) => m.t === 'room');
    const g3 = await connect();
    g3.send({ t: 'join', roomId: r3.roomId, nick: 'G3' });
    await g3.next((m) => m.t === 'room');
    g3.send({ t: 'leave' });
    const leftEnd = await h3.next((m) => m.t === 'end');
    check('2 人房 leave → 对方收到 end peer_left（兼容旧客户端）', leftEnd.won === false && leftEnd.reason === 'peer_left');

    /* ---- 9. 限频 ---- */
    console.log('9. rate limit');
    const spammer = await connect();
    for (let i = 0; i < 40; i++) spammer.send({ t: 'ping' });
    await closed(spammer.ws);
    check('客机连接超过 30 条/秒被断开', true);
    const hSpam = await connect();
    hSpam.send({ t: 'create', nick: 'HS', levelId: 1, difficulty: 'normal' });
    await hSpam.next((m) => m.t === 'room');
    hSpam.drain();
    for (let i = 0; i < 40; i++) hSpam.send({ t: 'ping' });
    const spamPong = await hSpam.next((m) => m.t === 'pong');
    check('主机连接 40 条/秒未断（上限 60）', spamPong.t === 'pong' && hSpam.ws.readyState === hSpam.ws.OPEN);
    hSpam.ws.close();

    /* ---- 10. 4 人房：建房 / 加入满员 / room_full / 自动 start ---- */
    console.log('10. 4 人房满员');
    const h4 = await connect();
    h4.send({ t: 'create', nick: 'H4', levelId: 6, difficulty: 'normal', maxPlayers: 4 });
    const r4 = await h4.next((m) => m.t === 'room');
    check('create maxPlayers=4 → slot=0 + maxPlayers=4', r4.slot === 0 && r4.maxPlayers === 4);
    const room4 = r4.roomId;
    const g4s = [];
    for (let i = 1; i <= 3; i++) {
      const g = await connect();
      g.send({ t: 'join', roomId: room4, nick: `G${i}` });
      const jm = await g.next((m) => m.t === 'room');
      check(`客机${i} 占最小空槽位 slot=${i}`, jm.slot === i && jm.members.length === i + 1);
      g4s.push(g);
    }
    const c5 = await connect();
    c5.send({ t: 'join', roomId: room4, nick: '第五人' });
    check('满员后第 5 人 join → room_full', (await c5.next((m) => m.t === 'error')).code === 'room_full');
    c5.ws.close();
    const start4 = await h4.next((m) => m.t === 'start');
    check('4 人满员自动 start，players 含 4 个槽位',
      start4.players.length === 4 && start4.players.map((p) => p.slot).join(',') === '0,1,2,3');
    for (let i = 0; i < 3; i++) {
      const s = await g4s[i].next((m) => m.t === 'start');
      check(`客机${i + 1} 收到自动 start`, s.players.length === 4);
    }
    const members4 = await h4.next((m) => m.t === 'members' && m.members.length === 4);
    check('名册内容：4 人在线且就绪',
      members4.members.every((e) => e.online === true && e.ready === true)
      && members4.members.map((e) => e.nick).join(',') === 'H4,G1,G2,G3');

    /* ---- 11. 4 人房路由：cmd 只到主机，snap 到全部客机 ---- */
    console.log('11. 多客机路由');
    for (const c of [h4, ...g4s]) c.drain();
    g4s[1].send({ t: 'cmd', player: 2, cmd: { type: 'BUILD', tower: 'cannon' } });
    const cmd4 = await h4.next((m) => m.t === 'cmd');
    check('slot2 客机 cmd → 主机', cmd4.player === 2 && cmd4.cmd.tower === 'cannon');
    await sleep(300);
    check('其余客机收不到该 cmd', g4s[0].inbox.every((m) => m.t !== 'cmd') && g4s[2].inbox.every((m) => m.t !== 'cmd'));
    for (const c of [h4, ...g4s]) c.drain();
    h4.send({ t: 'snap', state: { wave: 9 }, events: [] });
    for (let i = 0; i < 3; i++) {
      const s = await g4s[i].next((m) => m.t === 'snap');
      check(`snap 到达客机${i + 1}`, s.state.wave === 9);
    }

    /* ---- 12. 4 人房客机断线 → rejoin 按 slot 归位 ---- */
    console.log('12. 多客机断线 / rejoin 归位');
    g4s[1].ws.terminate();
    const lost4 = await h4.next((m) => m.t === 'peer' && m.status === 'lost');
    check('slot2 断开 → peer lost（带 slot）', lost4.slot === 2 && lost4.nick === 'G2');
    const lost4Members = await h4.next((m) => m.t === 'members' && rosterEntry(m, 2)?.online === false);
    check('名册标记 slot2 离线', !!lost4Members);
    await sleep(300);
    const g2back = await connect();
    g2back.send({ t: 'join', roomId: room4, nick: 'G2', rejoin: true, slot: 2 });
    const rejoin4 = await g2back.next((m) => m.t === 'room');
    check('rejoin 按 slot=2 归位', rejoin4.slot === 2 && rejoin4.role === 'guest' && rejoin4.members.length === 4);
    const back4 = await h4.next((m) => m.t === 'peer' && m.status === 'back');
    check('主机收到 peer back（slot=2）', back4.slot === 2);
    g4s[1] = g2back;

    /* ---- 13. 4 人房客机 leave：开局后保留槽位、房间存续 ---- */
    console.log('13. 客机 leave 房间存续（开局后）');
    g4s[2].send({ t: 'leave' });
    const left4 = await h4.next((m) => m.t === 'peer' && m.status === 'left');
    check('slot3 客机 leave → 其余成员收到 peer left', left4.slot === 3 && left4.nick === 'G3');
    const left4Members = await h4.next((m) => m.t === 'members' && rosterEntry(m, 3)?.online === false);
    check('开局后离开保留槽位（标记离线）', !!left4Members);
    // 房间存续：主机仍可下发 snap
    h4.send({ t: 'snap', state: { wave: 10 }, events: [] });
    check('房间存续，snap 正常下发', (await g4s[0].next((m) => m.t === 'snap')).state.wave === 10);
    // 保留的槽位可 rejoin
    const g3back = await connect();
    g3back.send({ t: 'join', roomId: room4, nick: 'G3', rejoin: true, slot: 3 });
    check('leave 后的槽位可 rejoin', (await g3back.next((m) => m.t === 'room')).slot === 3);
    await h4.next((m) => m.t === 'peer' && m.status === 'back' && m.slot === 3);
    g4s[2] = g3back;

    /* ---- 14. 4 人房主机断线 → 全体 end host_lost 解散 ---- */
    console.log('14. 多客机 host_lost 解散');
    // 清掉前序 sections 残留的 peer/members 广播，并 ping 刷新活跃时间
    // （测试实例 PING_TIMEOUT_MS=1.5s，静默客机会被心跳巡检误判断线）
    for (const g of g4s) { g.send({ t: 'ping' }); g.drain(); }
    h4.ws.terminate();
    for (let i = 0; i < 3; i++) {
      const lp = await g4s[i].next((m) => m.t === 'peer' && m.status === 'lost');
      check(`客机${i + 1} 收到主机 peer lost`, lp.slot === 0);
      g4s[i].send({ t: 'ping' }); // 等待 2s 宽限期间保持活跃
    }
    for (let i = 0; i < 3; i++) {
      const e = await g4s[i].next((m) => m.t === 'end', 5000);
      check(`客机${i + 1} 收到 end host_lost`, e.won === false && e.reason === 'host_lost');
      await closed(g4s[i].ws);
    }
    check('解散后全部连接被关闭', true);

    /* ---- 15. ready/start 大厅流程（3 人房） ---- */
    console.log('15. ready / start 流程');
    const hL = await connect();
    hL.send({ t: 'create', nick: 'HL', levelId: 4, difficulty: 'normal', maxPlayers: 3 });
    const rL = await hL.next((m) => m.t === 'room');
    hL.send({ t: 'start' });
    check('独自 1 人 start 被拒（≥2 人在线）', (await hL.next((m) => m.t === 'error')).code === 'bad_msg');
    const gL = await connect();
    gL.send({ t: 'join', roomId: rL.roomId, nick: 'GL' });
    const jL = await gL.next((m) => m.t === 'room');
    check('3 人房第 2 人加入不占满 → slot=1', jL.slot === 1);
    await sleep(300);
    check('未满员不自动 start', hL.inbox.every((m) => m.t !== 'start') && gL.inbox.every((m) => m.t !== 'start'));
    // 未开局发 cmd/snap → not_started
    gL.send({ t: 'cmd', player: 1, cmd: { type: 'BUILD' } });
    check('未开局 cmd → not_started', (await gL.next((m) => m.t === 'error')).code === 'not_started');
    hL.send({ t: 'snap', state: {} });
    check('未开局 snap → not_started', (await hL.next((m) => m.t === 'error')).code === 'not_started');
    // 取消就绪 → start 被拒
    gL.send({ t: 'ready', ready: false });
    const readyPeer = await hL.next((m) => m.t === 'peer' && m.status === 'ready');
    check('主机收到 peer ready（ready=false）', readyPeer.slot === 1 && readyPeer.ready === false);
    const readyMembers = await hL.next((m) => m.t === 'members' && rosterEntry(m, 1)?.ready === false);
    check('名册同步就绪态', !!readyMembers);
    hL.send({ t: 'start' });
    check('未全就绪 start 被拒', (await hL.next((m) => m.t === 'error')).code === 'bad_msg');
    // 恢复就绪 → 手动 start 成功
    gL.send({ t: 'ready', ready: true });
    await hL.next((m) => m.t === 'peer' && m.status === 'ready' && m.ready === true);
    hL.send({ t: 'start' });
    const startLH = await hL.next((m) => m.t === 'start');
    const startLG = await gL.next((m) => m.t === 'start');
    check('全就绪手动 start 广播（players=实际在线 2 人）',
      startLH.players.length === 2 && startLG.players.length === 2);
    // 客机 start 越权 & 重复 start
    gL.send({ t: 'start' });
    check('客机发 start 被拒', (await gL.next((m) => m.t === 'error')).code === 'bad_msg');
    // 开局后新 join 拒绝，rejoin 仍可用
    const cL = await connect();
    cL.send({ t: 'join', roomId: rL.roomId, nick: '迟到者' });
    check('started 后新 join → room_full', (await cL.next((m) => m.t === 'error')).code === 'room_full');
    cL.ws.close();

    /* ---- 16. ready:false 推迟满员自动 start ---- */
    console.log('16. ready:false 推迟自动 start');
    const hD = await connect();
    hD.send({ t: 'create', nick: 'HD', levelId: 5, difficulty: 'normal', maxPlayers: 2 });
    const rD = await hD.next((m) => m.t === 'room');
    const gD = await connect();
    gD.send({ t: 'join', roomId: rD.roomId, nick: 'GD' });
    await gD.next((m) => m.t === 'room');
    await hD.next((m) => m.t === 'start'); // 2 人房：join 即满员自动 start
    check('基线：2 人房 join 满员即自动 start', true);
    // 多人房：先加入的客机 ready:false，即使后来满员也不自动 start
    const hD2 = await connect();
    hD2.send({ t: 'create', nick: 'HD2', levelId: 5, difficulty: 'normal', maxPlayers: 3 });
    const rD2 = await hD2.next((m) => m.t === 'room');
    const gD1 = await connect();
    gD1.send({ t: 'join', roomId: rD2.roomId, nick: 'GD1' });
    await gD1.next((m) => m.t === 'room');
    gD1.send({ t: 'ready', ready: false });
    await hD2.next((m) => m.t === 'peer' && m.status === 'ready');
    const gD2 = await connect();
    gD2.send({ t: 'join', roomId: rD2.roomId, nick: 'GD2' });
    await gD2.next((m) => m.t === 'room');
    await sleep(300);
    check('满员但有客机未就绪 → 不自动 start', hD2.inbox.every((m) => m.t !== 'start'));
    gD1.send({ t: 'ready', ready: true });
    const autoStart = await hD2.next((m) => m.t === 'start');
    check('补就绪后满员自动 start', autoStart.players.length === 3);

    /* ---- 17. 开局前客机 leave 释放槽位 ---- */
    console.log('17. 开局前客机 leave 释放槽位');
    const hP = await connect();
    hP.send({ t: 'create', nick: 'HP', levelId: 2, difficulty: 'normal', maxPlayers: 3 });
    const rP = await hP.next((m) => m.t === 'room');
    const gP = await connect();
    gP.send({ t: 'join', roomId: rP.roomId, nick: 'GP' });
    await gP.next((m) => m.t === 'room');
    await hP.next((m) => m.t === 'peer' && m.status === 'joined');
    gP.send({ t: 'leave' });
    const leftP = await hP.next((m) => m.t === 'peer' && m.status === 'left');
    check('开局前 leave → peer left（房间存续）', leftP.slot === 1);
    const leftPM = await hP.next((m) => m.t === 'members' && m.members.length === 1);
    check('开局前离开释放槽位（名册不再含 slot1）', !!leftPM);
    const gP2 = await connect();
    gP2.send({ t: 'join', roomId: rP.roomId, nick: 'GP2' });
    const jP2 = await gP2.next((m) => m.t === 'room');
    check('释放的槽位可被新客机占用（slot=1）', jP2.slot === 1);

    /* ---- 18. rejoin 歧义与 bad_slot ---- */
    console.log('18. rejoin bad_msg / bad_slot');
    // 当前 17 的房：hP + gP2 在线，maxPlayers=3，第三个槽位为空 → 无离线槽位
    const cR = await connect();
    cR.send({ t: 'join', roomId: rP.roomId, nick: 'x', rejoin: true });
    check('无离线槽位 rejoin → bad_msg', (await cR.next((m) => m.t === 'error')).code === 'bad_msg');
    cR.send({ t: 'join', roomId: rP.roomId, nick: 'x', rejoin: true, slot: 9 });
    check('slot 越界 → bad_slot', (await cR.next((m) => m.t === 'error')).code === 'bad_slot');
    cR.send({ t: 'join', roomId: rP.roomId, nick: 'x', rejoin: true, slot: 1 });
    check('slot 在线 → bad_slot', (await cR.next((m) => m.t === 'error')).code === 'bad_slot');
    // 制造两个离线槽位：gP2 与主机都不断线不行——改用 4 人房两个客机断线
    const hA = await connect();
    hA.send({ t: 'create', nick: 'HA', levelId: 1, difficulty: 'normal', maxPlayers: 4 });
    const rA = await hA.next((m) => m.t === 'room');
    const gA1 = await connect();
    gA1.send({ t: 'join', roomId: rA.roomId, nick: 'GA1' });
    await gA1.next((m) => m.t === 'room');
    const gA2 = await connect();
    gA2.send({ t: 'join', roomId: rA.roomId, nick: 'GA2' });
    await gA2.next((m) => m.t === 'room');
    gA1.ws.terminate();
    gA2.ws.terminate();
    await hA.next((m) => m.t === 'peer' && m.status === 'lost' && m.slot === 1);
    await hA.next((m) => m.t === 'peer' && m.status === 'lost' && m.slot === 2);
    await sleep(300);
    cR.send({ t: 'join', roomId: rA.roomId, nick: 'x', rejoin: true });
    check('多个离线槽位且未指定 slot → bad_msg', (await cR.next((m) => m.t === 'error')).code === 'bad_msg');
    cR.send({ t: 'join', roomId: rA.roomId, nick: 'x', rejoin: true, slot: 2 });
    check('指定 slot=2 rejoin 成功', (await cR.next((m) => m.t === 'room')).slot === 2);
    cR.ws.close();
  } catch (e) {
    failed++;
    console.error('  ✗ 异常中断：', e.message);
  } finally {
    server.kill();
  }

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  process.exit(failed ? 1 : 0);
}

main();
