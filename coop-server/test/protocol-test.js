'use strict';
/**
 * 协议全流程测试：本脚本拉起一个短超时的服务器实例，模拟两个客户端走完整协议。
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
    /* ---- 1. 建房 / 加房 ---- */
    console.log('1. create / join');
    const host = await connect();
    host.send({ t: 'create', nick: '主机A', levelId: 3, difficulty: 'hard' });
    const roomMsg = await host.next((m) => m.t === 'room');
    check('create 返回 roomId + role=host', /^[A-Z2-9]{6}$/.test(roomMsg.roomId) && roomMsg.role === 'host');
    const roomId = roomMsg.roomId;

    const guest = await connect();
    guest.send({ t: 'join', roomId, nick: '客机B' });
    const joinMsg = await guest.next((m) => m.t === 'room');
    check('join 返回 role=guest + levelId/difficulty/hostNick',
      joinMsg.role === 'guest' && joinMsg.levelId === 3 && joinMsg.difficulty === 'hard' && joinMsg.hostNick === '主机A');
    const peerMsg = await host.next((m) => m.t === 'peer');
    check('主机收到 peer joined', peerMsg.status === 'joined' && peerMsg.nick === '客机B');

    /* ---- 2. cmd 双向转发 / snap 转发 ---- */
    console.log('2. cmd / snap 转发');
    guest.send({ t: 'cmd', player: 1, cmd: { type: 'BUILD', tower: 'arrow' } });
    const cmdAtHost = await host.next((m) => m.t === 'cmd');
    check('guest cmd → host', cmdAtHost.player === 1 && cmdAtHost.cmd.type === 'BUILD');
    host.send({ t: 'cmd', player: 0, cmd: { type: 'START' } });
    const cmdAtGuest = await guest.next((m) => m.t === 'cmd');
    check('host cmd → guest', cmdAtGuest.player === 0 && cmdAtGuest.cmd.type === 'START');
    host.send({ t: 'snap', state: { wave: 5, lives: 18 } });
    const snapAtGuest = await guest.next((m) => m.t === 'snap');
    check('host snap → guest', snapAtGuest.state.wave === 5);
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
    check('第三人 join → room_full', (await c3.next((m) => m.t === 'error')).code === 'room_full');
    c3.send('{ 这不是 JSON');
    check('坏 JSON → bad_msg', (await c3.next((m) => m.t === 'error')).code === 'bad_msg');
    c3.ws.close();

    /* ---- 5. 客机断线通知主机 + rejoin ---- */
    console.log('5. guest 断线 / rejoin');
    guest.ws.terminate();
    const lostMsg = await host.next((m) => m.t === 'peer' && m.status === 'lost');
    check('guest 断开 → 主机收到 peer lost', lostMsg.nick === '客机B');
    await sleep(500);
    // 房间不拆：客机凭 roomId+role 重连
    const guest2 = await connect();
    guest2.send({ t: 'join', roomId, nick: '客机B', rejoin: true, role: 'guest' });
    const rejoinMsg = await guest2.next((m) => m.t === 'room');
    check('rejoin 成功', rejoinMsg.role === 'guest' && rejoinMsg.levelId === 3);
    const backMsg = await host.next((m) => m.t === 'peer' && m.status === 'back');
    check('主机收到 peer back', backMsg.nick === '客机B');

    /* ---- 6. 主机断线 60s（测试 2s）解散 ---- */
    console.log('6. host 断线宽限后解散');
    host.ws.terminate();
    const hostLostPeer = await guest2.next((m) => m.t === 'peer' && m.status === 'lost');
    check('host 断开 → 客机收到 peer lost', !!hostLostPeer);
    const endMsg = await guest2.next((m) => m.t === 'end', 5000);
    check('宽限到点广播 end host_lost', endMsg.won === false && endMsg.reason === 'host_lost');
    await closed(guest2.ws);
    check('解散后连接被关闭', true);

    /* ---- 7. end 仲裁 ---- */
    console.log('7. end 仲裁');
    const h2 = await connect();
    h2.send({ t: 'create', nick: 'H', levelId: 1, difficulty: 'easy' });
    const r2 = await h2.next((m) => m.t === 'room');
    const g2 = await connect();
    g2.send({ t: 'join', roomId: r2.roomId, nick: 'G' });
    await g2.next((m) => m.t === 'room');
    g2.send({ t: 'end', won: true });
    check('guest 发 end 被拒', (await g2.next((m) => m.t === 'error')).code === 'bad_msg');
    h2.send({ t: 'end', won: true });
    const endH = await h2.next((m) => m.t === 'end');
    const endG = await g2.next((m) => m.t === 'end');
    check('end 广播双方 won=true', endH.won === true && endG.won === true);

    /* ---- 8. leave 解散 ---- */
    console.log('8. leave');
    const h3 = await connect();
    h3.send({ t: 'create', nick: 'H3', levelId: 2, difficulty: 'normal' });
    const r3 = await h3.next((m) => m.t === 'room');
    const g3 = await connect();
    g3.send({ t: 'join', roomId: r3.roomId, nick: 'G3' });
    await g3.next((m) => m.t === 'room');
    g3.send({ t: 'leave' });
    const leftEnd = await h3.next((m) => m.t === 'end');
    check('leave → 对方收到 end peer_left', leftEnd.won === false && leftEnd.reason === 'peer_left');

    /* ---- 9. 限频 ---- */
    console.log('9. rate limit');
    const spammer = await connect();
    for (let i = 0; i < 40; i++) spammer.send({ t: 'ping' });
    await closed(spammer.ws);
    check('超过 30 条/秒被断开', true);
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
