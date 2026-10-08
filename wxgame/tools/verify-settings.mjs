// 验证设置中心：桩 wx 环境，驱动 game.js 走 主页→设置中心→战斗→暂停→设置中心
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const VW = 430, VH = 932, DPR = 3;
let drawLog = [];
let logging = false;
let stateDepth = 0;
function makeCtx(canvas) {
  const grad = { addColorStop() {} };
  const ctx = {
    canvas,
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    globalCompositeOperation: 'source-over', font: '', textAlign: 'left', textBaseline: 'alphabetic',
    lineJoin: '', lineCap: '', shadowBlur: 0, shadowColor: '', filter: 'none',
    save() { stateDepth++; }, restore() { stateDepth--; },
    translate() {}, scale() {}, rotate() {}, setTransform() {}, resetTransform() {},
    beginPath() {}, closePath() {}, rect() {}, clip() {}, fill() {}, stroke() {},
    moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, ellipse() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, setLineDash() {}, clearRect() {},
    fillRect(x, y, w, h) { if (logging) drawLog.push({ op: 'fillRect', x, y, w, h }); },
    strokeRect() {},
    fillText(t, x, y) { if (logging) drawLog.push({ op: 'text', t, x, y }); },
    measureText(t) { return { width: String(t).length * 10 }; },
    drawImage(img) { if (logging) drawLog.push({ op: 'img', src: img?._src || 'canvas' }); },
    createLinearGradient() { return grad; },
    createRadialGradient() { return grad; },
    createPattern() { return null; },
    getImageData() { return { data: new Uint8ClampedArray(4) }; },
  };
  return ctx;
}
function makeCanvas() {
  const c = { width: 0, height: 0, style: {} };
  c.getContext = () => (c._ctx ??= makeCtx(c));
  c.toDataURL = () => '';
  return c;
}

const handlers = {};
const rafQueue = [];
const storage = {};
if (process.env.LEGACY_MUTE) storage['srd.muted'] = '1';

let vibrated = 0;
globalThis.wx = {
  createCanvas: () => makeCanvas(),
  createImage: () => {
    const img = { _src: '', width: 720, height: 1280, onload: null, onerror: null };
    Object.defineProperty(img, 'src', {
      get() { return img._src; },
      set(v) { img._src = v; img.onload?.(); }, // 同步触发，模拟图片已缓存秒加载
    });
    return img;
  },
  getSystemInfoSync: () => ({ windowWidth: VW, windowHeight: VH, pixelRatio: DPR, platform: 'devtools' }),
  getMenuButtonBoundingClientRect: () => ({ top: 59, bottom: 91, left: 330, right: 420 }),
  getStorageSync: (k) => storage[k] ?? '',
  setStorageSync: (k, v) => { storage[k] = v; },
  onTouchStart: (fn) => { handlers.start = fn; },
  onTouchMove: (fn) => { handlers.move = fn; },
  onTouchEnd: (fn) => { handlers.end = fn; },
  onShow: () => {}, onHide: () => {}, onError: () => {},
  loadFontFace: () => {},
  vibrateShort: () => { vibrated++; },
  setClipboardData: () => {},
  loadSubpackage: (o) => o?.fail?.(new Error('no subpackage')),
  createInnerAudioContext: () => ({ src: '', play() {}, pause() {}, stop() {}, destroy() {}, onEnded() {}, onError() {}, onCanplay() {}, volume: 1, loop: false, paused: true }),
  env: { USER_DATA_PATH: '/tmp' },
};
globalThis.requestAnimationFrame = (fn) => { rafQueue.push(fn); };
globalThis.GameGlobal = globalThis;

let now = 1000;
const realDateNow = Date.now;
Date.now = () => now; // 必须在加载包之前 mock，否则 splashAt 用的是真实时间

new Function(readFileSync(new URL('../game.js', import.meta.url), 'utf8'))();

let imbalanced = 0;
function frames(n, log = false) {
  for (let i = 0; i < n; i++) {
    now += 16.7;
    const fn = rafQueue.shift();
    if (!fn) throw new Error('rAF empty');
    const d0 = stateDepth;
    if (log) { drawLog = []; logging = true; }
    fn();
    logging = false;
    if (stateDepth !== d0) imbalanced++;
  }
}
function tap(x, y) {
  const t = { clientX: x, clientY: y };
  handlers.start?.({ touches: [t], changedTouches: [t] });
  now += 30;
  handlers.end?.({ touches: [], changedTouches: [t] });
  frames(1);
}
const texts = () => drawLog.filter((d) => d.op === 'text').map((d) => d.t);
const has = (re) => texts().some((t) => re.test(t));
const rowY = (label) => drawLog.find((d) => d.op === 'text' && d.t === label).y + 9; // 标签在行内 y+19，行中心 +28
const tapText = (label) => { const d = drawLog.find((e) => e.op === 'text' && e.t === label); tap(d.x, d.y); };
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name); }
}

// 旧版总开关迁移：启动后即写入两个新键（在任何交互之前检查）
if (process.env.LEGACY_MUTE) {
  frames(2);
  check('旧版 srd.muted 已迁移到音乐', storage['srd.musicMuted'] === '1');
  check('旧版 srd.muted 已迁移到音效', storage['srd.sfxMuted'] === '1');
  console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
  process.exit(fail ? 1 : 0);
}

// 欢迎页（主菜单）
frames(30);
tap(VW / 2, VH * 0.8); // 点击跳过开场动画 → 主菜单
frames(10);
frames(1, true);
console.log('— 欢迎页主菜单 —');
check('生成背景图已加载并绘制', drawLog.some((d) => d.op === 'img' && /welcome-bg\.jpg$/.test(d.src)));
check('开始战役按钮', has(/开始战役/));
check('入口 图鉴/设置/档案', has(/图鉴/) && has(/设置/) && has(/档案/));

// 1) 欢迎页入口「设置」→ 设置中心
const setEntry = drawLog.find((d) => d.op === 'text' && d.t === '设置');
tap(setEntry.x, setEntry.y);
frames(1, true);
console.log('— 设置中心（主页 ⚙）—');
check('标题 设置中心', has(/设置中心/));
for (const label of ['音效', '音乐', '旁白', '震动', '高画质']) check(`行 ${label}`, has(new RegExp(label)));

// 1.5) 皮肤色卡：三套齐全，切换并切回
check('皮肤色卡 深空全息/琥珀工业/紫晶矩阵', has(/深空全息/) && has(/琥珀工业/) && has(/紫晶矩阵/));
tapText('琥珀工业');
frames(1, true);
check('皮肤切换已持久化', storage['srd.skin'] === 'ember');
tapText('深空全息');
frames(1, true);
check('皮肤切回默认', storage['srd.skin'] === 'abyss');
check('皮肤切换后弹层仍在', has(/设置中心/));

// 2) 关掉「音乐」行 → 写入 srd.musicMuted
tap(215, rowY('音乐'));
frames(1, true);
check('音乐关闭已持久化', storage['srd.musicMuted'] === '1');
check('行仍渲染（弹层未关闭）', has(/设置中心/));

// 3) 关掉「震动」→ vibrateShort 不再被调用
tap(215, rowY('震动'));
check('震动关闭已持久化', storage['srd.vibrateMuted'] === '1');
const v0 = vibrated;
tap(215, rowY('音效')); // 点音效行（会尝试 buzz）
check('震动已生效（buzz 被拦截）', vibrated === v0);
check('音效关闭已持久化', storage['srd.sfxMuted'] === '1');

// 4) 关闭弹层（回到欢迎页菜单）
frames(1, true);
tapText('关闭'); // 关闭按钮
frames(1, true);
check('弹层已关闭', !has(/设置中心/));

// 4.5) 开始战役 → 选关页：页头精简、无入口卡
frames(1, true);
const startBtn2 = drawLog.find((d) => d.op === 'text' && /开始战役/.test(d.t || ''));
tap(startBtn2.x, startBtn2.y);
frames(10);
frames(1, true);
console.log('— 选关页 —');
const hd = drawLog.filter((d) => d.op === 'text' && d.y < 100).map((d) => d.t);
check('页头无 ⚙', !hd.includes('⚙'));
check('页头无 📖', !hd.includes('📖'));
check('选关页无入口卡', !drawLog.some((d) => d.op === 'text' && d.t === '设置' || d.t === '档案'));

// 5) 进入战斗 → 暂停 → 设置中心
frames(1, true);
const cta = drawLog.find((d) => d.op === 'text' && /^(出击|重玩)$/.test(d.t || ''));
tap(cta.x, cta.y); frames(10); // 第一章 CTA → 简报
frames(1, true);
if (process.env.DEBUG_FLOW) console.log('CTA后画面:', JSON.stringify(texts().slice(0, 30)));
check('简报页已打开', has(/任务简报/));
const go = drawLog.find((d) => d.op === 'text' && /出\s*击/.test(d.t));
tap(go.x, go.y); frames(10);
if (process.env.DEBUG_FLOW) { frames(1, true); console.log('出击后画面:', JSON.stringify(texts().slice(0, 25))); }
// 暂停按钮（按文本定位，兼容三套 HUD 布局）
frames(1, true);
tapText('⏸');
frames(1, true);
console.log('— 战斗暂停面板 —');
check('已暂停', has(/已暂停/));
// 恢复战斗（HUD 上 ⏸ 变为 ▶）
tapText('▶');
frames(1, true);
check('已恢复战斗', !has(/已暂停/));

console.log('— 音频合成 —');
// 微信 WebAudio 的 connect 不返回目标节点（与浏览器规范不同），
// 用忠实桩驱动 src/audio.ts，防止链式 connect 回归（曾导致战斗中白屏）
{
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = () => ({ connect() { return undefined; } });
  let oscStarted = 0, noiseStarted = 0;
  wx.createWebAudioContext = () => ({
    currentTime: 0, sampleRate: 8000, state: 'running', destination: node(),
    resume() {},
    createGain: () => ({ ...node(), gain: param() }),
    createOscillator: () => ({ ...node(), type: '', frequency: param(), start() { oscStarted++; }, stop() {} }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => ({ ...node(), buffer: null, start() { noiseStarted++; } }),
    createBiquadFilter: () => ({ ...node(), type: '', frequency: param() }),
  });
  storage['srd.sfxMuted'] = '0';
  const audioCode = esbuild.buildSync({
    entryPoints: [fileURLToPath(new URL('../src/audio.ts', import.meta.url))],
    bundle: true, write: false, format: 'iife', globalName: '__audioTest',
  }).outputFiles[0].text;
  const testSfx = new Function(`${audioCode}\n;return __audioTest;`)().sfx;
  testSfx.init();
  let threw = false;
  try {
    for (const s of ['missile', 'railgun', 'boss', 'kill', 'plasma', 'tesla']) testSfx.play(s);
  } catch { threw = true; }
  check('噪声类音效合成不抛异常', !threw);
  check('噪声与振荡音源均已调度（connect 链完整）', noiseStarted > 0 && oscStarted > 0);
}

console.log('— 全局 —');
check('save/restore 无泄漏', imbalanced === 0);
console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
Date.now = realDateNow;
process.exit(fail ? 1 : 0);
