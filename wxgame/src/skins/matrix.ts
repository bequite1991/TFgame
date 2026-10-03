// 紫晶矩阵（matrix）皮肤模块 —— 赛博朋克霓虹风完整接管
// 视觉语言：紫→粉渐变描边、圆形/六边形元素、透视网格地平线、缓慢下移扫描线、
//           偶发 glitch 抖动（量化时间种子 + hash01，帧间确定）；小元素发光用 shadowBlur，面板不全屏发光。
// 布局差异：欢迎页=放射轮盘；主页=横向章节轮盘（handleTouch 接管横滑 + 惯性吸附）；
//           简报/结算=终端逐行打印 + 光标闪烁；科技三选一=卡片 glitch 入场（错位 + 色散）。
// 签名交互：重要按钮（出击/开战）长按 0.6s 充能环充满才触发（env.getPressedBtn 按矩形+文案匹配）。
// env 缺口已全部补齐：皮肤卡用 env.SKINS，简报返回用 env.stopNarration，分享用 env.shareAppMessage；
// 不接管 drawToast（走默认绘制）与 drawDragGhost（走默认；网格几何经 env.CELL/COLS/ROWS 可取）。
import type { SkinEnv, SkinModule, TouchPoint } from './types';
import type { GameEngine, TowerType } from '../game/types';

// ---------------- 模块级状态 ----------------

/** 主页章节轮盘：当前位置（浮点索引）与惯性吸附目标 */
let carPos = 0;
let carTarget = 0;
let carInit = false;

/** 主页横滑跟踪（handleTouch 接管；主文件竖向滚动被横滑取代） */
let homeDrag: {
  startX: number; startY: number; startPos: number;
  lastX: number; lastT: number; vx: number; moved: boolean;
} | null = null;

/** 图鉴竖滑跟踪（主文件 codexMaxScroll 只在内置实现里更新，接管后滚动量由本模块自算） */
let codexDrag: { startY: number; scroll0: number; moved: boolean } | null = null;
/** 图鉴内容最大滚动量（本模块绘制时自算并自行 clamp codex.scroll） */
let codexMax = 0;

/** 长按充能按钮状态（同一时刻至多一个在充能） */
const HOLD_MS = 600;
let charge: { key: string; startT: number; fired: boolean } | null = null;

/** 简报逐行打印缓存（按 章节+宽度+皮肤+难度 失效，避免每帧重排字符串） */
let briefCache: { key: string; lines: [string, string][] } | null = null;

// ---------------- 霓虹视觉工具 ----------------

/** 紫→粉渐变描边（叠加在面板之上的一层霓虹边框） */
function neonStroke(env: SkinEnv, x: number, y: number, w: number, h: number, r: number, a = 0.8) {
  const { ctx } = env;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, env.ac(a));
  g.addColorStop(1, `rgba(255,61,129,${a * 0.75})`);
  ctx.save();
  env.rr(x, y, w, h, r);
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

/** 霓虹面板 = 主文件面板底（随皮肤的紫黑渐变）+ 渐变描边 */
function neonPanel(env: SkinEnv, x: number, y: number, w: number, h: number, r = 14) {
  env.panel(x, y, w, h, env.ac(0.16), r);
  neonStroke(env, x, y, w, h, r);
}

/** 六边形路径（页头按钮 / 章节指示点用） */
function hexPath(env: SkinEnv, cx: number, cy: number, r: number) {
  const { ctx } = env;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (Math.PI * 2 * i) / 6;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** 皮肤专属背景：紫黑深空 + 透视网格地平线 + 缓慢下移扫描线 + 偶发 glitch 横带 */
function matrixBg(env: SkinEnv, time: number) {
  const { ctx, VW, VH } = env;
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#0D0719');
  g.addColorStop(0.55, '#070310');
  g.addColorStop(1, '#130A26');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, VH);
  // 远景霓虹雾（紫 + 粉两团）
  const fog1 = ctx.createRadialGradient(VW * 0.85, VH * 0.1, 0, VW * 0.85, VH * 0.1, VW * 0.9);
  fog1.addColorStop(0, env.ac(0.10));
  fog1.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fog1;
  ctx.fillRect(0, 0, VW, VH);
  const fog2 = ctx.createRadialGradient(VW * 0.12, VH * 0.82, 0, VW * 0.12, VH * 0.82, VW * 0.75);
  fog2.addColorStop(0, 'rgba(255,61,129,0.07)');
  fog2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fog2;
  ctx.fillRect(0, 0, VW, VH);
  env.drawStars(time, 0.45);

  // 透视网格地平线（下半屏，竖线向中线收拢，横线按平方间距排布并缓慢滚动）
  const horizon = VH * 0.62;
  ctx.save();
  ctx.strokeStyle = env.ac(0.07);
  ctx.lineWidth = 1;
  for (let i = -7; i <= 7; i++) {
    ctx.beginPath();
    ctx.moveTo(VW / 2 + i * VW * 0.028, horizon);
    ctx.lineTo(VW / 2 + i * VW * 0.19, VH);
    ctx.stroke();
  }
  const scroll = (time * 0.06) % 0.125;
  for (let k = 0; k < 8; k++) {
    const f = k / 8 + scroll;
    if (f > 1) break;
    const yy = horizon + (VH - horizon) * f * f;
    ctx.globalAlpha = 0.05 + f * 0.06;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(VW, yy);
    ctx.stroke();
  }
  ctx.restore();
  // 地平线辉光带（窄渐变条，不用 shadowBlur）
  const hg = ctx.createLinearGradient(0, horizon - 14, 0, horizon + 14);
  hg.addColorStop(0, 'rgba(255,61,129,0)');
  hg.addColorStop(0.5, 'rgba(255,61,129,0.10)');
  hg.addColorStop(1, 'rgba(255,61,129,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, horizon - 14, VW, 28);

  // 缓慢下移的扫描线
  const sy = ((time * 26) % (VH + 120)) - 60;
  const sg = ctx.createLinearGradient(0, sy - 24, 0, sy + 24);
  sg.addColorStop(0, env.ac(0));
  sg.addColorStop(0.5, env.ac(0.05));
  sg.addColorStop(1, env.ac(0));
  ctx.fillStyle = sg;
  ctx.fillRect(0, sy - 24, VW, 48);

  // 偶发 glitch：量化时间种子 + hash01，帧间确定
  const seed = Math.floor(time / 5.3);
  const gt = time - seed * 5.3;
  if (env.hash01(seed * 17 + 5) > 0.4 && gt < 0.22) {
    for (let i = 0; i < 3; i++) {
      const gy = env.hash01(seed * 31 + i * 7) * VH;
      const gh = 4 + env.hash01(seed * 13 + i) * 20;
      const gx = (env.hash01(seed * 7 + i * 3) - 0.5) * 36;
      ctx.fillStyle = i % 2
        ? `rgba(255,61,129,${0.05 + env.hash01(seed + i) * 0.05})`
        : env.ac(0.05 + env.hash01(seed + i * 11) * 0.05);
      ctx.fillRect(gx, gy, VW, gh);
    }
  }
}

/** 矩阵页头：霓虹渐变底线 + 流动光点 + 六边形返回按钮，避开微信胶囊 */
function drawMxHeader(env: SkinEnv, title: string, back?: () => void) {
  const { ctx, VW, CAP_MID, CAP_LEFT, GAME_CENTER_PAD, MARGIN, TOP_SAFE } = env;
  const btnS = 36;
  const top = CAP_MID - btnS / 2;
  const g = ctx.createLinearGradient(0, top - 6, 0, TOP_SAFE);
  g.addColorStop(0, 'rgba(20,10,40,0.94)');
  g.addColorStop(1, 'rgba(10,5,22,0.88)');
  ctx.fillStyle = g;
  ctx.fillRect(0, top - 6, VW, TOP_SAFE - top + 6);
  // 底部渐变霓虹线 + 循环流动的光点
  const lg = ctx.createLinearGradient(0, 0, VW, 0);
  lg.addColorStop(0, env.ac(0.55));
  lg.addColorStop(0.55, 'rgba(255,61,129,0.35)');
  lg.addColorStop(1, env.ac(0.04));
  ctx.fillStyle = lg;
  ctx.fillRect(0, TOP_SAFE - 1, VW, 1.5);
  const dotX = ((Date.now() / 14) % (VW + 40)) - 20;
  ctx.save();
  ctx.shadowColor = env.C.pink;
  ctx.shadowBlur = 6;
  ctx.fillStyle = env.C.pink;
  ctx.beginPath();
  ctx.arc(dotX, TOP_SAFE - 0.5, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 六边形小按钮（按压态自绘：主文件 pressedBtn 按矩形+文案匹配）
  const hexBtn = (cx: number, glyph: string, cb: () => void) => {
    const pressed = env.getPressedBtn();
    const isP = pressed !== null && pressed.label === glyph
      && Math.abs(pressed.x - (cx - btnS / 2)) < 1 && Math.abs(pressed.y - top) < 1;
    const r = isP ? btnS * 0.40 : btnS * 0.46;
    ctx.save();
    hexPath(env, cx, CAP_MID, r);
    ctx.fillStyle = isP ? env.ac(0.30) : env.ac(0.10);
    ctx.fill();
    ctx.strokeStyle = env.ac(0.7);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    env.fillText(glyph, cx, CAP_MID + 1, { size: 16, color: env.C.text, align: 'center' });
    env.hitBox({ x: cx - btnS / 2, y: top, w: btnS, h: btnS, label: glyph, cb });
  };

  let tx = MARGIN;
  const rightLimit = CAP_LEFT - 8 - GAME_CENTER_PAD;
  if (back) {
    hexBtn(MARGIN + btnS / 2, '‹', back);
    tx = MARGIN + btnS + 12;
  }

  // 标题：左对齐，随可用宽度自动缩字号
  let tSize = 16;
  ctx.save();
  while (tSize > 11) {
    ctx.font = `bold ${tSize}px sans-serif`;
    if (ctx.measureText(title).width <= rightLimit - tx - 8) break;
    tSize--;
  }
  ctx.restore();
  env.fillText('MATRIX // TOWER LINE DEFENSE', tx, CAP_MID - 11, { size: 8, color: env.ac(0.7), weight: '600' });
  env.fillText(title, tx, CAP_MID + 8, { size: tSize });
}

/**
 * 长按充能按钮：按住 0.6s 充能充满才真正执行 cb。
 * 通过 env.getPressedBtn()（矩形+文案匹配）感知按压；松手/移出即取消；
 * 轻点走 hitBox 回调给出提示（长按 ≥0.6s 后主文件 quick 判定已过期，不会重复派发）。
 */
function chargeButton(env: SkinEnv, x: number, y: number, w: number, h: number, label: string, cb: () => void) {
  const { ctx } = env;
  const pressed = env.getPressedBtn();
  const match = pressed !== null && pressed.x === x && pressed.y === y && pressed.w === w && pressed.label === label;
  if (match) {
    if (!charge || charge.key !== label) charge = { key: label, startT: Date.now(), fired: false };
  } else if (charge && charge.key === label) {
    charge = null; // 松手或滑出：充能取消
  }
  const prog = charge && charge.key === label ? Math.min(1, (Date.now() - charge.startT) / HOLD_MS) : 0;
  if (prog >= 1 && charge && !charge.fired) {
    charge.fired = true;
    env.buzz('heavy');
    cb();
  }
  // 底 + 自下而上的充能填充
  ctx.save();
  env.rr(x, y, w, h, 12);
  ctx.fillStyle = env.skin.panelSolid;
  ctx.fill();
  if (prog > 0) {
    ctx.save();
    env.rr(x, y, w, h, 12);
    ctx.clip();
    const fg = ctx.createLinearGradient(x, y + h, x, y);
    fg.addColorStop(0, env.ac(0.55));
    fg.addColorStop(1, 'rgba(255,61,129,0.45)');
    ctx.fillStyle = fg;
    ctx.fillRect(x, y + h * (1 - prog), w, h * prog);
    ctx.restore();
  }
  // 渐变描边（充能时给小发光，面板不发光）
  const lg = ctx.createLinearGradient(x, y, x + w, y);
  lg.addColorStop(0, env.ac(0.9));
  lg.addColorStop(1, 'rgba(255,61,129,0.8)');
  env.rr(x, y, w, h, 12);
  ctx.strokeStyle = lg;
  ctx.lineWidth = 1.6;
  ctx.shadowColor = env.C.cyan;
  ctx.shadowBlur = prog > 0 ? 10 : 0;
  ctx.stroke();
  ctx.restore();
  env.fillText(prog > 0 ? `充能 ${Math.round(prog * 100)}%` : label, x + w / 2, y + h / 2, {
    size: 15, color: prog > 0 ? '#FFFFFF' : env.C.text, align: 'center',
  });
  if (prog === 0) {
    env.fillText('HOLD TO CONFIRM', x + w / 2, y + h + 12, { size: 8, color: env.C.dim, align: 'center', weight: '600' });
  }
  env.hitBox({ x, y, w, h, label, cb: () => { env.showToast('长按 0.6s 充能确认'); env.buzz('light'); } });
}

/** 弹层收尾：整屏接管的页面需自绘档案/设置弹层（主文件分发到本模块的对应钩子） */
function drawOverlays(env: SkinEnv) {
  if (env.showProfile()) drawProfile(env);
  if (env.showSettings()) drawSettings(env);
}

// ---------------- 欢迎页：放射轮盘菜单 ----------------

function drawSplashMenu(env: SkinEnv, time: number, menuA: number) {
  const { ctx, VW, VH } = env;
  const slide = (1 - menuA) * 16;
  ctx.save();
  ctx.globalAlpha = menuA;

  // 中心主按钮：双层脉冲光环 + 圆形霓虹按钮
  const cx = VW / 2;
  const cy = VH * 0.80 + slide;
  for (let k = 0; k < 2; k++) {
    const ph = (time * 0.7 + k * 0.5) % 1;
    ctx.save();
    ctx.globalAlpha = menuA * (1 - ph) * 0.5;
    ctx.strokeStyle = k ? env.C.pink : env.C.cyan;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 46 + ph * 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const pressed = env.getPressedBtn();
  const mainP = pressed !== null && pressed.label === '▶ 开始战役';
  const R = mainP ? 42 : 45;
  ctx.save();
  const bg = ctx.createRadialGradient(cx, cy - R * 0.4, R * 0.1, cx, cy, R);
  bg.addColorStop(0, env.ac(0.5));
  bg.addColorStop(1, 'rgba(20,10,40,0.95)');
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = bg;
  ctx.fill();
  const rg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  rg.addColorStop(0, env.ac(0.95));
  rg.addColorStop(1, 'rgba(255,61,129,0.85)');
  ctx.strokeStyle = rg;
  ctx.lineWidth = 2;
  ctx.shadowColor = env.C.cyan;
  ctx.shadowBlur = 12; // 小元素发光
  ctx.stroke();
  ctx.restore();
  env.fillText('▶', cx, cy - 9, { size: 22, color: '#FFFFFF', align: 'center' });
  env.fillText('开始战役', cx, cy + 14, { size: 13, align: 'center' });
  env.hitBox({ x: cx - 48, y: cy - 48, w: 96, h: 96, label: '▶ 开始战役', cb: () => env.goto('home') });

  // 三枚卫星入口：上半弧环绕，各自错相位微浮动
  const entries: [glyph: string, label: string, color: string, cb: () => void][] = [
    ['✦', '图鉴', env.C.gold, () => { env.codex.scroll = 0; env.goto('codex'); }],
    ['⚙', '设置', env.C.cyan, () => { env.setShowProfile(false); env.setShowSettings(true); }],
    ['◈', '档案', env.C.green, () => { env.setShowSettings(false); env.setShowProfile(true); }],
  ];
  const satR = Math.min(84, VW * 0.24);
  const angles = [-Math.PI * 0.86, -Math.PI * 0.5, -Math.PI * 0.14];
  entries.forEach(([glyph, label, color, cb], i) => {
    const bx = cx + Math.cos(angles[i]) * satR * 1.5;
    const by = cy + Math.sin(angles[i]) * satR + Math.sin(time * 1.2 + i * 2.1) * 3;
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx, by, 24, 0, Math.PI * 2);
    ctx.fillStyle = env.skin.panelSolid;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
    env.fillText(glyph, bx, by, { size: 15, color, align: 'center' });
    env.fillText(label, bx, by + 36, { size: 11, color: env.C.sub, align: 'center' });
    env.hitBox({ x: bx - 26, y: by - 26, w: 52, h: 52, label: `sat-${label}`, cb });
  });
  ctx.restore();
}

// ---------------- 主页：横向章节轮盘 + 难度霓虹 tab ----------------

/** 轮盘几何：卡片宽/步长（handleTouch 与绘制共用，保证吸附与视觉一致） */
const carCardW = (env: SkinEnv) => env.VW * 0.74;
const carStep = (env: SkinEnv) => carCardW(env) + 20;

function drawHome(env: SkinEnv, time: number) {
  const { ctx, VW, VH, MARGIN, TOP_SAFE } = env;
  matrixBg(env, time);
  drawMxHeader(env, '战役选择', () => env.goto('splash'));

  // —— 难度霓虹 tab（钉在顶部）+ 右侧 单人/双人 切换（§4.1） ——
  const tabY = TOP_SAFE + 8;
  const tabH = 36;
  const fullW = VW - MARGIN * 2;
  const diffW = Math.round(fullW * 0.62);
  const tabW = (diffW - 16) / 3;
  env.DIFF_LIST.forEach((d, i) => {
    const x = MARGIN + i * (tabW + 8);
    const on = env.app.difficulty === d;
    ctx.save();
    env.rr(x, tabY, tabW, tabH, 10);
    ctx.fillStyle = on ? env.ac(0.16) : 'rgba(20,12,36,0.85)';
    ctx.fill();
    ctx.strokeStyle = on ? env.ac(0.8) : 'rgba(110,92,142,0.4)';
    ctx.lineWidth = on ? 1.5 : 1;
    ctx.stroke();
    if (on) {
      // 激活下划线：紫→粉渐变 + 小发光
      const ug = ctx.createLinearGradient(x, 0, x + tabW, 0);
      ug.addColorStop(0, env.ac(0.9));
      ug.addColorStop(1, 'rgba(255,61,129,0.9)');
      ctx.fillStyle = ug;
      ctx.shadowColor = env.C.cyan;
      ctx.shadowBlur = 6;
      ctx.fillRect(x + 10, tabY + tabH - 3, tabW - 20, 2);
    }
    ctx.restore();
    env.fillText(env.DIFFICULTIES[d].name, x + tabW / 2, tabY + tabH / 2, {
      size: 13, color: on ? env.C.text : env.C.dim, align: 'center',
    });
    env.hitBox({
      x, y: tabY, w: tabW, h: tabH, label: `diff-${d}`,
      cb: () => {
        if (env.app.difficulty === d) return;
        env.app.difficulty = d;
        env.track('difficulty_select', { difficulty: d });
        env.buzz('light');
      },
    });
  });

  // —— 单人/双人同屏霓虹 tab（激活下划线：双人档用绿→粉渐变区分难度档） ——
  const coopX = MARGIN + diffW + 10;
  const coopTabW = (fullW - diffW - 10 - 8) / 2;
  (['单人', '双人'] as const).forEach((label, i) => {
    const x = coopX + i * (coopTabW + 8);
    const on = (env.app.coop ? 1 : 0) === i;
    ctx.save();
    env.rr(x, tabY, coopTabW, tabH, 10);
    ctx.fillStyle = on ? env.ac(0.16) : 'rgba(20,12,36,0.85)';
    ctx.fill();
    ctx.strokeStyle = on ? env.ac(0.8) : 'rgba(110,92,142,0.4)';
    ctx.lineWidth = on ? 1.5 : 1;
    ctx.stroke();
    if (on) {
      const ug = ctx.createLinearGradient(x, 0, x + coopTabW, 0);
      ug.addColorStop(0, i === 1 ? 'rgba(61,240,140,0.9)' : env.ac(0.9));
      ug.addColorStop(1, 'rgba(255,61,129,0.9)');
      ctx.fillStyle = ug;
      ctx.shadowColor = env.C.cyan;
      ctx.shadowBlur = 6;
      ctx.fillRect(x + 8, tabY + tabH - 3, coopTabW - 16, 2);
    }
    ctx.restore();
    env.fillText(label, x + coopTabW / 2, tabY + tabH / 2, {
      size: 13, color: on ? env.C.text : env.C.dim, align: 'center',
    });
    env.hitBox({
      x, y: tabY, w: coopTabW, h: tabH, label: `coop-${i}`,
      cb: () => { if ((env.app.coop ? 1 : 0) !== i) { env.toggleCoop(); env.buzz('light'); } },
    });
  });

  // —— 章节轮盘 ——
  const N = env.LEVELS.length;
  if (!carInit) {
    carInit = true;
    carPos = carTarget = Math.max(0, Math.min(env.unlockedChapter() - 1, N - 1));
  }
  // 松手后向目标吸附（拖拽中由 handleTouch 直接写 carPos）
  if (!homeDrag) {
    carPos += (carTarget - carPos) * 0.18;
    if (Math.abs(carTarget - carPos) < 0.002) carPos = carTarget;
  }

  const regionTop = tabY + tabH + 16;
  const regionBottom = VH - 52;
  const cardW = carCardW(env);
  const cardH = Math.min(330, regionBottom - regionTop - 30);
  const step = carStep(env);
  const cy = (regionTop + regionBottom) / 2;
  const cleared = env.loadProgress().cleared;

  // 远卡先画、当前卡最后画（其按钮命中区自然盖在上层）
  const order = env.LEVELS.map((_, i) => i).sort((a, b) => Math.abs(b - carPos) - Math.abs(a - carPos));
  for (const i of order) {
    const off = i - carPos;
    if (Math.abs(off) > 1.7) continue;
    const lv = env.LEVELS[i];
    const unlock = i === 0 || cleared.includes(env.LEVELS[i - 1].id);
    const done = cleared.includes(lv.id);
    const scale = 1 - Math.min(0.16, Math.abs(off) * 0.13);
    const w = cardW * scale;
    const h = cardH * scale;
    const x = VW / 2 + off * step - w / 2;
    const y = cy - h / 2;
    const isCurrent = Math.abs(off) < 0.5;

    ctx.save();
    ctx.globalAlpha = Math.max(0.3, 1 - Math.abs(off) * 0.45);
    neonPanel(env, x, y, w, h, 14);
    // 宣传图（顶部，霓虹描边）
    const artH = h * 0.42;
    env.drawCardArt(x + 8, y + 8, w - 16, artH, lv.id, time, 10);
    env.rr(x + 8, y + 8, w - 16, artH, 10);
    ctx.strokeStyle = env.ac(0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
    if (!unlock) {
      env.rr(x + 8, y + 8, w - 16, artH, 10);
      ctx.fillStyle = 'rgba(7,4,14,0.55)';
      ctx.fill();
    }
    // 信息区
    const tx = x + 18;
    const iy = y + artH + 24;
    ctx.save();
    if (!unlock) ctx.globalAlpha *= 0.5;
    env.fillText(`CH-${String(lv.id).padStart(2, '0')} // SECTOR`, tx, iy + 8, { size: 9, color: env.C.cyan, weight: '600' });
    env.fillText(lv.name, tx, iy + 30, { size: 18 });
    env.fillText(lv.sub, tx, iy + 50, { size: 11, color: env.C.sub, weight: 'normal' });
    const bossTxt = lv.waves.filter((wv) => wv.isBoss).map((wv) => `W${wv.wave}`).join(' ');
    env.fillText(`${lv.waves.length} 波 · BOSS ${bossTxt || '—'}`, tx, iy + 68, { size: 10, color: env.C.dim, weight: 'normal' });
    ctx.restore();
    if (done) env.chip(x + w - 12, y + 16, '已通关', env.C.green);
    else if (!unlock) env.chip(x + w - 12, y + 16, '未解锁', env.C.dim);

    if (isCurrent) {
      if (unlock) {
        env.btn({
          x: x + 20, y: y + h - 54, w: w - 40, h: 40,
          label: done ? '重玩' : '▶ 出击', color: done ? env.C.green : env.C.cyan, primary: !done,
          cb: () => env.gotoBriefing(lv.id),
        });
      } else {
        // 锁定：斜纹压暗 + 解锁条件提示
        env.fillText('🔒', x + w / 2, y + h - 46, { size: 16, align: 'center' });
        env.fillText(`通关「${env.LEVELS[i - 1].name}」后解锁`, x + w / 2, y + h - 24, { size: 10, color: env.C.sub, align: 'center', weight: 'normal' });
        env.hitBox({
          x, y, w, h, label: `lock-${lv.id}`,
          cb: () => { env.showToast(`通关「${env.LEVELS[i - 1].name}」后解锁`); env.buzz('light'); },
        });
      }
    } else {
      // 侧卡：轻点切换到该章
      env.hitBox({ x, y, w, h, label: `nav-${lv.id}`, cb: () => { carTarget = i; env.buzz('light'); } });
    }
    ctx.restore();
  }

  // 章节指示点（六边形小点，当前章发光）
  const dotY = cy + cardH / 2 + 20;
  const dotGap = 16;
  const dotsX = VW / 2 - ((N - 1) * dotGap) / 2;
  for (let i = 0; i < N; i++) {
    const on = i === Math.round(carPos);
    ctx.save();
    hexPath(env, dotsX + i * dotGap, dotY, on ? 4.5 : 3);
    ctx.fillStyle = on ? env.ac(0.95) : 'rgba(110,92,142,0.45)';
    if (on) { ctx.shadowColor = env.C.cyan; ctx.shadowBlur = 6; }
    ctx.fill();
    ctx.restore();
  }

  env.fillText('◀ 左右滑动切换章节 ▶', VW / 2, VH - 30, { size: 9, color: env.C.dim, align: 'center', weight: 'normal' });
  env.fillText('微信小游戏 · 试运营包', VW / 2, VH - 12, { size: 10, color: 'rgba(110,92,142,0.7)', align: 'center' });

  drawOverlays(env);
}

// ---------------- 简报：终端逐行打印 ----------------

/** 简报打印行缓存（段落按宽度重排一次，后续每帧只做切片） */
function briefLines(env: SkinEnv, lv: SkinEnv['LEVELS'][number], textW: number, size: number): [string, string][] {
  const key = `${lv.id}|${textW}|${env.skin.id}|${env.app.difficulty}|${env.app.coop ? 1 : 0}`;
  if (briefCache && briefCache.key === key) return briefCache.lines;
  const per = Math.max(6, Math.floor(textW / size));
  const body = 'rgba(164,143,200,0.95)';
  const lines: [string, string][] = [
    [`> OPERATION BRIEFING // CH-${String(lv.id).padStart(2, '0')}`, env.C.cyan],
    [`> 目标区域：${lv.name} · ${lv.sub}`, env.C.text],
    ['', body],
  ];
  for (const para of lv.briefing) {
    for (let i = 0; i < para.length; i += per) lines.push([para.slice(i, i + per), body]);
    lines.push(['', body]);
  }
  const bossTxt = lv.waves.filter((w) => w.isBoss).map((w) => `W${w.wave}`).join(' ');
  lines.push([`> 波次 ${lv.waves.length} · BOSS ${bossTxt || '—'}`, '#FF9F43']);
  lines.push([`> 难度 ${env.DIFFICULTIES[env.app.difficulty].name} · ${env.DIFFICULTIES[env.app.difficulty].label}`, env.C.gold]);
  // 双人同屏：终端行注明分工（§4.1）
  if (env.app.coop) lines.push(['> CO-OP 双人同屏 // P1 建造 · P2 指挥', env.C.green]);
  briefCache = { key, lines };
  return lines;
}

function drawBriefing(env: SkinEnv, time: number) {
  const { ctx, VW, VH, MARGIN, TOP_SAFE } = env;
  matrixBg(env, time);
  const lv = env.LEVELS.find((l) => l.id === env.app.levelId) ?? env.LEVELS[0];
  drawMxHeader(env, '任务简报', () => { env.stopNarration(); env.goto('home'); });

  // 顶部宣传横幅（霓虹描边 + 横幅内扫描线）
  const bannerH = Math.min(112, Math.round(VW * 0.3));
  const bx = MARGIN;
  const bw = VW - MARGIN * 2;
  const by = TOP_SAFE + 6;
  env.drawCardArt(bx, by, bw, bannerH, lv.id, time, 10);
  ctx.save();
  env.rr(bx, by, bw, bannerH, 10);
  ctx.clip();
  const scanY = by + ((time * 34) % (bannerH + 30)) - 15;
  const sg = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
  sg.addColorStop(0, env.ac(0));
  sg.addColorStop(0.5, env.ac(0.18));
  sg.addColorStop(1, env.ac(0));
  ctx.fillStyle = sg;
  ctx.fillRect(bx, scanY - 10, bw, 20);
  ctx.restore();
  neonStroke(env, bx, by, bw, bannerH, 10);
  // 标题压暗带 + 章节号
  ctx.save();
  env.rr(bx, by, bw, bannerH, 10);
  ctx.clip();
  const tg = ctx.createLinearGradient(0, by + bannerH * 0.4, 0, by + bannerH);
  tg.addColorStop(0, 'rgba(7,4,14,0)');
  tg.addColorStop(1, 'rgba(7,4,14,0.85)');
  ctx.fillStyle = tg;
  ctx.fillRect(bx, by, bw, bannerH);
  ctx.restore();
  env.fillText(`CH-${String(lv.id).padStart(2, '0')}`, bx + 14, by + bannerH - 34, { size: 10, color: env.C.cyan, weight: '600' });
  env.fillText(lv.name, bx + 14, by + bannerH - 14, { size: 17 });
  // 旁白开关（与默认实现同一状态/动作）
  env.btn({
    x: bx + bw - 88, y: by + 10, w: 78, h: 30,
    label: env.narrationMuted() ? '🔇 旁白' : '🔊 旁白', color: env.narrationMuted() ? env.C.sub : env.C.cyan,
    cb: env.toggleNarrationMuted,
  });

  // 终端面板：等宽字风格逐行打印 + 光标闪烁
  const textSize = 12;
  const lineH = textSize * 1.6;
  const textW = VW - MARGIN * 2 - 32;
  const lines = briefLines(env, lv, textW, textSize);
  const boxY = by + bannerH + 12;
  const boxH = Math.ceil(lines.length * lineH) + 30;
  neonPanel(env, MARGIN, boxY, VW - MARGIN * 2, boxH, 12);
  // 逐行打印：0.35s 延迟后每秒 30 字符
  const t = (Date.now() - env.getScreenAt()) / 1000 - 0.35;
  let budget = Math.max(0, Math.floor(t * 30));
  let cy0 = boxY + 24;
  let cursorX = MARGIN + 16;
  let cursorY = cy0;
  let typingDone = true;
  for (const [text, color] of lines) {
    if (budget <= 0) { typingDone = false; break; }
    const shown = text.slice(0, budget);
    env.fillText(shown, MARGIN + 16, cy0, { size: textSize, color, weight: 'normal' });
    cursorX = MARGIN + 16 + shown.length * textSize;
    cursorY = cy0;
    budget -= text.length;
    cy0 += lineH;
    if (shown.length < text.length) { typingDone = false; break; }
  }
  // 光标（0.5s 闪烁）
  if (Math.floor(Date.now() / 500) % 2 === 0) {
    env.fillText('▌', Math.min(cursorX + 2, MARGIN + 16 + textW), cursorY, { size: textSize, color: env.C.cyan, weight: 'normal' });
  }

  const afterY = boxY + boxH + 26;
  // 出击：长按充能确认
  chargeButton(env, VW / 2 - 110, afterY, 220, 52, '▶ 长 按 出 击', () => env.startBattle());
  env.btn({
    x: VW / 2 - 110, y: afterY + 78, w: 220, h: 42, label: '返回选关', color: env.C.sub,
    cb: () => { env.stopNarration(); env.goto('home'); },
  });
  if (!typingDone && t > 0) {
    // 打印中轻点加速：全屏透明命中区（放在按钮之后注册会盖住按钮，故不注册——仅视觉提示）
    env.fillText('DECODING…', VW / 2, VH - 14, { size: 8, color: env.C.dim, align: 'center', weight: '600' });
  }

  drawOverlays(env);
}

// ---------------- 战斗 HUD：34px 整体悬浮横条（状态段 + 内嵌指令段）+ prep 充能开战 ----------------

function drawBattleHUD(env: SkinEnv, engine: GameEngine) {
  const { ctx, VW, TOP_SAFE, CAP_LEFT, GAME_CENTER_PAD } = env;
  const st = engine.state;
  const hudY = TOP_SAFE;
  const barH = 34;
  const barX = 12;
  const barR = CAP_LEFT - 8 - GAME_CENTER_PAD; // 右侧给微信胶囊留位
  const barW = barR - barX;
  const numFont = env.RES_FONT();

  // 整条横条：霓虹面板 + 循环扫描线
  neonPanel(env, barX, hudY, barW, barH, 17);
  ctx.save();
  env.rr(barX, hudY, barW, barH, 17);
  ctx.clip();
  const sx = barX + ((Date.now() / 18) % (barW + 60)) - 30;
  const sg = ctx.createLinearGradient(sx - 14, 0, sx + 14, 0);
  sg.addColorStop(0, env.ac(0));
  sg.addColorStop(0.5, env.ac(0.14));
  sg.addColorStop(1, env.ac(0));
  ctx.fillStyle = sg;
  ctx.fillRect(sx - 14, hudY, 28, barH);
  ctx.restore();

  const cy = hudY + barH / 2;
  const measure = (s: string) => {
    ctx.save();
    ctx.font = `bold 12px ${numFont}`;
    const w = ctx.measureText(s).width;
    ctx.restore();
    return w;
  };
  const hairline = (x: number) => { // 细分隔线
    ctx.fillStyle = env.ac(0.3);
    ctx.fillRect(x, hudY + 11, 1, barH - 22);
  };

  // 状态段：❤ 生命（≤5 闪烁告警） / ◈ 金币 / 波次 + 2px 进度线
  let tx = barX + 14;
  const lifeTxt = `❤ ${st.lives}`;
  ctx.save();
  if (st.lives <= 5) ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(Date.now() / 180));
  env.fillText(lifeTxt, tx, cy, { size: 12, color: env.C.red, font: numFont });
  ctx.restore();
  tx += measure(lifeTxt) + 10;
  hairline(tx);
  tx += 10;
  const goldTxt = `◈ ${st.gold}`;
  env.fillText(goldTxt, tx, cy, { size: 12, color: env.C.gold, font: numFont });
  tx += measure(goldTxt) + 10;
  hairline(tx);
  tx += 10;
  const waveTxt = `${st.wave}/${st.totalWaves}`;
  env.fillText(waveTxt, tx, cy - 2, { size: 12, color: env.C.cyan, font: numFont });
  const waveW = Math.max(measure(waveTxt), 26);
  ctx.fillStyle = env.ac(0.25);
  ctx.fillRect(tx, hudY + barH - 8, waveW, 2);
  const pg = ctx.createLinearGradient(tx, 0, tx + waveW, 0);
  pg.addColorStop(0, env.ac(0.9));
  pg.addColorStop(1, 'rgba(255,61,129,0.9)');
  ctx.fillStyle = pg;
  ctx.fillRect(tx, hudY + barH - 8, waveW * Math.min(1, st.wave / st.totalWaves), 2);

  // 指令段：三个 30×34 内嵌小按钮（⏸/▶ · 1x/2x · ≡），横条内的文字段
  const btnW = 30;
  const btns: [label: string, active: boolean, cb: () => void][] = [
    [st.paused ? '▶' : '⏸', st.paused, () => env.engineCmd({ type: 'TOGGLE_PAUSE' })],
    [st.speed === 2 ? '2x' : '1x', st.speed === 2, () => env.engineCmd({ type: 'SET_SPEED', speed: st.speed === 2 ? 1 : 2 })],
    ['≡', false, () => { env.app.engine = null; env.goto('home'); }],
  ];
  const segX = barR - 2 - btnW * btns.length;
  ctx.fillStyle = env.ac(0.45); // 竖分隔线
  ctx.fillRect(segX - 6, hudY + 7, 1, barH - 14);
  btns.forEach(([label, active, cb], i) => {
    const bx = segX + i * btnW;
    const pressed = env.getPressedBtn();
    const isP = pressed !== null && pressed.label === `hud-${label}`
      && Math.abs(pressed.x - bx) < 1 && Math.abs(pressed.y - hudY) < 1;
    if (active || isP) {
      ctx.fillStyle = active ? env.ac(0.22) : env.ac(0.14);
      ctx.fillRect(bx, hudY + 2, btnW, barH - 4);
    }
    env.fillText(label, bx + btnW / 2, cy, {
      size: 12, color: active ? env.C.cyan : env.C.text, align: 'center', font: numFont,
    });
    env.hitBox({ x: bx, y: hudY, w: btnW, h: barH, label: `hud-${label}`, cb });
  });

  // prep 阶段：来袭预告 + 长按充能开战（y 从横条底边起留 8px 缝）
  if (st.phase === 'prep') {
    const py = hudY + barH + 8;
    neonPanel(env, VW / 2 - 128, py, 256, 74, 14);
    env.fillText(`第 ${st.wave} 波 · ${Math.max(0, Math.ceil(st.prepT))}s 后来袭`, VW / 2, py + 17, { size: 13, align: 'center', font: env.RES_FONT() });
    const wave = engine.level.waves[st.wave - 1];
    const groups = wave?.groups ?? [];
    const isBossWave = wave?.isBoss ?? false;
    const summary = [...new Set(groups.map((g) => `${env.ENEMIES[g.type].name}×${g.count}`))].join(' ');
    env.fillText(`${isBossWave ? '⚠ BOSS 波 · ' : ''}${summary}`, VW / 2, py + 38, {
      size: 9, color: isBossWave ? env.C.pink : '#FF9F43', align: 'center', weight: 'normal',
    });
    env.fillText(
      env.app.coop ? 'P1 建造防线 · P2 把握升级与科技时机' : isBossWave ? '建议留好金币与穿甲火力' : '据此提前调整布防',
      VW / 2, py + 54, { size: 9, color: env.C.sub, align: 'center', weight: 'normal' },
    );
    chargeButton(env, VW / 2 - 85, py + 84, 170, 42, '▶ 长按开战', () => env.engineCmd({ type: 'SKIP_PREP' }));
  }
}

// ---------------- 底部塔栏（槽位几何读 env 常量自动跟随，视觉霓虹化 + 槽内按新栏高配平） ----------------

function drawBottomBar(env: SkinEnv, engine: GameEngine) {
  const { ctx, VW, VH, BAR_H, MARGIN } = env;
  const st = engine.state;

  // 底：深紫渐变 + 顶部紫→粉渐变霓虹线
  const g = ctx.createLinearGradient(0, VH - BAR_H, 0, VH);
  g.addColorStop(0, '#150B28');
  g.addColorStop(1, '#0A0516');
  ctx.fillStyle = g;
  ctx.fillRect(0, VH - BAR_H, VW, BAR_H);
  const lg = ctx.createLinearGradient(0, 0, VW, 0);
  lg.addColorStop(0, env.ac(0.5));
  lg.addColorStop(0.5, 'rgba(255,61,129,0.4)');
  lg.addColorStop(1, env.ac(0.1));
  ctx.fillStyle = lg;
  ctx.fillRect(0, VH - BAR_H, VW, 1.5);

  if (st.phase === 'tech') return;

  // 选中炮塔：升级 / 出售（语义与默认一致；栏高变扁后压缩为更扁的横排按钮）
  const sel = env.app.selectedId != null ? st.towers.find((t) => t.id === env.app.selectedId) : undefined;
  if (sel) {
    const def = env.TOWERS[sel.type];
    env.fillText(`${def.name} Lv${sel.level + 1}`, MARGIN + 4, VH - BAR_H + 15, { size: 13, color: def.color });
    const upCost = sel.level < 2 ? env.TOWERS[sel.type].levels[sel.level + 1].cost : -1;
    env.btn({
      x: MARGIN, y: VH - BAR_H + 32, w: VW / 2 - MARGIN - 6, h: 46,
      label: upCost >= 0 ? `升级 ◈ ${upCost}` : '已满级', disabled: upCost < 0 || st.gold < upCost,
      color: env.C.green, primary: upCost >= 0 && st.gold >= upCost,
      cb: () => { if (env.engineCmd({ type: 'UPGRADE', id: sel.id })) { env.sfx.play('upgrade'); env.buzz('light'); } },
    });
    const refund = Math.floor(sel.invested * env.SELL_RATE);
    env.btn({
      x: VW / 2 + 6, y: VH - BAR_H + 32, w: VW / 2 - MARGIN - 6, h: 46, label: `出售 +${refund}`,
      color: '#FF9F43', cb: () => { if (env.engineCmd({ type: 'SELL', id: sel.id })) env.sfx.play('sell'); env.app.selectedId = null; },
    });
    return;
  }

  // 点选放置模式：提示 + 取消（按新栏高垂直配平）
  if (env.app.placing) {
    const def = env.TOWERS[env.app.placing];
    env.fillText(`点击地图上绿色格建造「${def.name}」`, VW / 2, VH - BAR_H + 18, { size: 12, color: def.color, align: 'center' });
    env.btn({ x: VW / 2 - 76, y: VH - BAR_H + 36, w: 152, h: 40, label: '取消放置', cb: () => { env.app.placing = null; } });
    return;
  }

  // 塔栏槽位：几何与默认完全一致（towerSlotAt/barTouch 依赖），只换霓虹视觉
  const sw = env.SLOT_W;
  const slotH = BAR_H - 24;
  const viewX = MARGIN;
  const viewW = VW - MARGIN * 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(viewX - 4, VH - BAR_H + 4, viewW + 8, BAR_H - 8);
  ctx.clip();
  env.TOWER_ORDER.forEach((type, i) => {
    const def = env.TOWERS[type];
    const cost = def.levels[0].cost;
    const locked = !env.towerUnlocked(type);
    const bx = viewX + i * (sw + env.SLOT_GAP) - env.barScroll;
    const by = VH - BAR_H + 12;
    if (bx + sw < viewX - 4 || bx > viewX + viewW + 4) return;
    const disabled = locked || st.gold < cost;
    ctx.save();
    ctx.globalAlpha = disabled ? 0.55 : 1;
    env.rr(bx, by, sw, slotH, 12);
    const sg2 = ctx.createLinearGradient(bx, by, bx, by + slotH);
    sg2.addColorStop(0, 'rgba(36,20,60,0.96)');
    sg2.addColorStop(1, 'rgba(18,10,34,0.96)');
    ctx.fillStyle = sg2;
    ctx.fill();
    if (disabled) {
      ctx.strokeStyle = 'rgba(110,92,142,0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      // 可用：塔色→粉渐变描边（不发光，保帧率）
      const bg2 = ctx.createLinearGradient(bx, by, bx + sw, by + slotH);
      bg2.addColorStop(0, `${def.color}CC`);
      bg2.addColorStop(1, 'rgba(255,61,129,0.7)');
      ctx.strokeStyle = bg2;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // 炮塔图标（与地图上同款矢量造型；槽内仅保留图标+价格，槽变矮变宽后图标放大至 38、中心上移到 by+27，与价格垂直配平不溢出槽底）
    ctx.translate(bx + sw / 2, by + 27);
    env.drawTower(ctx, type, 0, 38, Math.sin(st.clock * 1.1) * 0.1, 0, st.clock, { ticks: false });
    ctx.restore();
    env.fillText(`◈${cost}`, bx + sw / 2, by + 54, { size: 11, color: disabled ? '#9A6A34' : env.C.gold, align: 'center', font: env.RES_FONT() });
    if (locked) {
      ctx.save();
      env.rr(bx, by, sw, slotH, 12);
      ctx.fillStyle = 'rgba(7,4,14,0.6)';
      ctx.fill();
      ctx.restore();
      env.fillText('🔒', bx + sw / 2, by + 22, { size: 14, align: 'center' });
      env.fillText(`第${env.TOWER_UNLOCK[type]}章`, bx + sw / 2, by + 54, { size: 10, color: env.C.sub, align: 'center' });
    }
  });
  ctx.restore();
  // 两侧渐变暗示可滑动
  if (env.stripMaxScroll > 0) {
    if (env.barScroll > 0) {
      const gl2 = ctx.createLinearGradient(viewX - 4, 0, viewX + 18, 0);
      gl2.addColorStop(0, 'rgba(13,7,25,0.95)');
      gl2.addColorStop(1, 'rgba(13,7,25,0)');
      ctx.fillStyle = gl2;
      ctx.fillRect(viewX - 4, VH - BAR_H + 4, 22, BAR_H - 8);
    }
    if (env.barScroll < env.stripMaxScroll) {
      const gr2 = ctx.createLinearGradient(viewX + viewW - 18, 0, viewX + viewW + 4, 0);
      gr2.addColorStop(0, 'rgba(13,7,25,0)');
      gr2.addColorStop(1, 'rgba(13,7,25,0.95)');
      ctx.fillStyle = gr2;
      ctx.fillRect(viewX + viewW - 18, VH - BAR_H + 4, 22, BAR_H - 8);
    }
  }
}

// ---------------- 科技三选一：卡片 glitch 入场 ----------------

function drawTechOverlay(env: SkinEnv, engine: GameEngine) {
  const { ctx, VW, VH, MARGIN, TOP_SAFE } = env;
  const st = engine.state;
  ctx.fillStyle = 'rgba(8,4,16,0.94)';
  ctx.fillRect(0, 0, VW, VH);
  env.fillText('TACTICAL MODULE', VW / 2, TOP_SAFE + 12, { size: 11, color: env.C.cyan, align: 'center', weight: '600' });
  env.fillText(`第 ${st.wave} 波前 · 选择战术模块`, VW / 2, TOP_SAFE + 42, { size: 19, align: 'center' });
  env.fillText(`三选一 · 同名可叠加 · 已装 ${st.techs.length}`, VW / 2, TOP_SAFE + 66, { size: 11, color: env.C.sub, align: 'center', weight: 'normal' });

  const taken: Record<string, number> = {};
  for (const t of st.techs) taken[t] = (taken[t] ?? 0) + 1;
  const cardH = 128;
  const top = TOP_SAFE + 92;
  st.techChoices!.forEach((id, i) => {
    const y = top + i * (cardH + 16);
    const def = env.TECHS[id];
    // glitch 入场：量化时间种子驱动左右错位 + 色散，0.4s 收敛
    const at = (Date.now() - env.getTechShownAt()) / 1000 - i * 0.12;
    const k = Math.min(1, Math.max(0, at / 0.4));
    const seed = Math.floor(Math.max(0, at) * 24);
    const xOff = k < 1 ? (env.hash01(seed * 31 + i * 7) - 0.5) * 46 * (1 - k) : 0;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, at / 0.15));
    ctx.translate(xOff, 0);
    neonPanel(env, MARGIN, y, VW - MARGIN * 2, cardH, 12);
    // 图标格（六边形 + 塔色）
    const igx = MARGIN + 48;
    const igy = y + cardH / 2;
    ctx.save();
    hexPath(env, igx, igy, 34);
    ctx.fillStyle = `${def.color}1A`;
    ctx.fill();
    ctx.strokeStyle = `${def.color}99`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
    env.fillText(def.glyph, igx, igy, { size: 26, color: def.color, align: 'center' });
    // 文字块
    const tx = MARGIN + 96;
    const textW = VW - MARGIN * 2 - 96 - 16;
    const descLines = env.wrapCount(def.desc, textW, 12);
    const blockH = 24 + descLines * 12 * 1.65;
    const ty0 = y + cardH / 2 - blockH / 2;
    if (k < 0.7) {
      // 色散残影：粉/紫各偏 2px 压在主标题下
      env.fillText(def.name, tx - 2, ty0 + 10, { size: 16, color: 'rgba(255,61,129,0.55)' });
      env.fillText(def.name, tx + 2, ty0 + 10, { size: 16, color: env.ac(0.55) });
    }
    env.fillText(def.name, tx, ty0 + 10, { size: 16, color: def.color });
    if (taken[id]) env.chip(MARGIN + (VW - MARGIN * 2) - 12, y + 22, `已装×${taken[id]}`, def.color);
    env.wrapBlock(def.desc, tx, ty0 + 34, textW, { color: 'rgba(164,143,200,1)', size: 12 });
    ctx.restore();
    env.hitBox({ x: MARGIN, y, w: VW - MARGIN * 2, h: cardH, label: `tech-${id}`, cb: () => { if (env.engineCmd({ type: 'PICK_TECH', id })) env.sfx.play('tech'); } });
  });
}

// ---------------- 结算：终端打印战绩 + 评级 glitch 显影 ----------------

const GRADE_GLYPHS = 'SABCDX#%@&';

function drawResult(env: SkinEnv, time: number) {
  const { ctx, VW, TOP_SAFE } = env;
  matrixBg(env, time);
  const won = env.app.result!.won;
  const st = env.app.engine!.state;
  const t = (Date.now() - env.getScreenAt()) / 1000;
  drawMxHeader(env, env.app.coop ? '协同作战结算 // CO-OP' : '战斗结算', () => env.goto('home'));

  // 终端战绩面板：逐行打印，数字滚动递增
  const lvName = env.LEVELS.find((l) => l.id === env.app.levelId)?.name ?? '';
  const head: [string, string][] = won
    ? [[`> MISSION ${env.app.levelId} // ${lvName}`, env.C.cyan], ['> STATUS: 防线守住了 ✓', env.C.green]]
    : [[`> MISSION ${env.app.levelId} // ${lvName}`, env.C.cyan], [`> STATUS: 防线失守 · 撑到第 ${st.wave}/${st.totalWaves} 波`, env.C.pink]];
  const stats: [label: string, num: number, color?: string, plus?: boolean][] = [
    ['击杀', st.kills],
    ['漏怪', st.leaked],
    ['赚取金币', st.goldEarned],
    ['战术模块', st.techs.length],
    ['积分', env.getLastSettlement()?.score ?? 0, env.C.gold, true],
  ];
  const px = 24;
  const pw = VW - 48;
  const py = TOP_SAFE + 14;
  const lineH = 26;
  const panelH = (head.length + stats.length + 1) * lineH + 22;
  neonPanel(env, px, py, pw, panelH, 12);
  let ly = py + 24;
  head.forEach(([text, color], i) => {
    const at = t - 0.2 - i * 0.3;
    if (at <= 0) return;
    const n = Math.min(text.length, Math.floor(at * 34));
    env.fillText(text.slice(0, n), px + 18, ly, { size: 13, color, weight: 'normal' });
    ly += lineH;
  });
  ly += 4;
  stats.forEach(([label, num, color, plus], i) => {
    const at = t - 0.8 - i * 0.28;
    if (at <= 0) return;
    const shown = Math.round(num * Math.min(1, at / 0.55));
    env.fillText(`> ${label}`, px + 18, ly, { size: 12, color: color ?? env.C.sub, weight: 'normal' });
    // 数字滚动 + 扫过的亮光
    env.fillText(`${plus ? '+' : ''}${shown}`, px + pw - 18, ly, { size: 15, align: 'right', font: env.RES_FONT(), color });
    if (at < 0.55) {
      const sx = px + pw - 60 + at * 40;
      ctx.save();
      ctx.fillStyle = env.ac(0.15 * (1 - at / 0.55));
      ctx.fillRect(sx, ly - 8, 3, 16);
      ctx.restore();
    }
    ly += lineH;
  });
  env.fillText(`> 剩余生命 ${st.lives}/${st.maxLives}`, px + 18, ly, { size: 12, color: env.C.sub, weight: 'normal' });

  // 评级：glitch 显影（随机字符轮闪 → 定格，定格瞬间前带色散）
  const grade = !won ? 'D' : st.leaked === 0 ? 'S' : st.leaked <= 2 ? 'A' : 'B';
  const gradeColor = grade === 'S' ? env.C.gold : grade === 'A' ? env.C.green : grade === 'B' ? env.C.cyan : env.C.pink;
  const gStart = 0.9 + stats.length * 0.28;
  const gt = t - gStart;
  if (gt > 0) {
    const settle = gt > 1.1;
    const gx = px + 52;
    const gy = py + panelH + 56;
    const ch = settle ? grade : GRADE_GLYPHS[Math.floor(env.hash01(Math.floor(t * 18) * 7 + 3) * GRADE_GLYPHS.length)];
    const jx = settle ? 0 : (env.hash01(Math.floor(t * 18) * 13 + 5) - 0.5) * 10;
    ctx.save();
    if (!settle) {
      env.fillText(ch, gx + jx - 3, gy, { size: 44, color: 'rgba(255,61,129,0.6)', align: 'center', font: env.RES_FONT() });
      env.fillText(ch, gx + jx + 3, gy, { size: 44, color: env.ac(0.6), align: 'center', font: env.RES_FONT() });
    } else {
      ctx.shadowColor = gradeColor;
      ctx.shadowBlur = 16; // 小元素发光
    }
    env.fillText(ch, gx + jx, gy, { size: 44, color: settle ? gradeColor : env.C.text, align: 'center', font: env.RES_FONT() });
    ctx.restore();
    // 外圈圆环
    ctx.save();
    ctx.strokeStyle = gradeColor;
    ctx.globalAlpha = settle ? 0.9 : 0.4;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(gx, gy, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    env.fillText(['完美防线', '防守好手', '守住防线', '防线失守'][['S', 'A', 'B', 'D'].indexOf(grade)], gx + 52, gy - 8, { size: 15, color: gradeColor });
    env.fillText(won ? '下一章解锁已记录' : '再挑战一次就能通过', gx + 52, gy + 14, { size: 10, color: env.C.sub, weight: 'normal' });
    // 军衔进度副文案（终端风格前缀；满级显示已达最高军衔）
    const rprog = env.getRankProgress();
    env.fillText(
      rprog.next === null
        ? `> RANK: ${rprog.name} · 已达最高军衔`
        : `> RANK: ${rprog.name} · 距「${rprog.nextName}」还差 ${(rprog.next - rprog.points).toLocaleString('en-US')} 分`,
      gx + 52, gy + 32, { size: 10, color: env.C.gold, weight: 'normal' },
    );
  }

  // 动作按钮（语义与默认一致）
  let y = py + panelH + 108;
  const nextId = env.app.levelId + 1;
  const hasNext = env.LEVELS.some((l) => l.id === nextId);
  if (won) {
    env.btn({ x: px, y, w: pw, h: 48, label: '◈ 双倍战利 · 观看视频', color: env.C.gold, cb: () => env.showToast('广告模块开发中') });
    y += 60;
  }
  if (won && hasNext) {
    env.btn({ x: px, y, w: pw, h: 52, label: `▶ 进入第 ${nextId} 章`, color: env.C.green, primary: true, cb: () => env.gotoBriefing(nextId) });
    y += 64;
  }
  env.btn({
    x: px, y, w: pw, h: 44, label: '📣 炫耀战绩', color: env.C.pink,
    cb: () => {
      env.track('share_click', { channel: 'result', result: won ? 'win' : 'lose', wave: st.wave });
      env.shareAppMessage({
        title: won
          ? `我在《高塔防线》守住了第 ${env.app.levelId} 关 · 全 ${st.totalWaves} 波，漏怪 ${st.leaked}！`
          : `我在《高塔防线》第 ${env.app.levelId} 关撑到了第 ${st.wave} 波，求支援！`,
        imageUrl: 'assets/share-cover.jpg',
      });
    },
  });
  y += 56;
  env.btn({ x: px, y, w: (pw - 12) / 2, h: 44, label: won ? '再来一局' : '再战本关', color: env.C.gold, cb: () => env.gotoBriefing(env.app.levelId) });
  env.btn({ x: px + (pw - 12) / 2 + 12, y, w: (pw - 12) / 2, h: 44, label: '返回选关', cb: () => env.goto('home') });

  drawOverlays(env);
}

// ---------------- 设置中心（霓虹面板；皮肤切换卡保留） ----------------

function drawSettings(env: SkinEnv) {
  const { ctx, VW, VH } = env;
  ctx.fillStyle = 'rgba(6,3,12,0.82)';
  ctx.fillRect(0, 0, VW, VH);
  // 全屏透明热区：吞掉面板外点击，避免穿透到底层页面
  env.hitBox({ x: 0, y: 0, w: VW, h: VH, label: '', cb: () => {} });
  const pw = VW - 72;
  const px = 36;
  const rowH = 56;
  const rows: [icon: string, label: string, desc: string, on: boolean, cb: () => void][] = [
    ['🔊', '音效', '攻击 / 爆炸 / 金币等战斗音效', !env.sfx.muted, () => env.sfx.setMuted(!env.sfx.muted)],
    ['🎵', '音乐', '主页与战斗背景音乐', !env.musicMuted(), env.toggleMusicMuted],
    ['🎙', '旁白', '任务简报语音解说', !env.narrationMuted(), env.toggleNarrationMuted],
    ['📳', '震动', '建造 / 漏怪 / BOSS 战触感反馈', !env.vibrateMuted(), env.toggleVibrateMuted],
    ['✨', '高画质', 'Bloom 辉光特效，低端机建议关闭', env.readQualityHigh(), () => env.setQualityHigh(!env.readQualityHigh())],
  ];
  const skinH = 74;
  const ph = 72 + rows.length * rowH + skinH + 68;
  const py = VH / 2 - ph / 2;
  neonPanel(env, px, py, pw, ph, 16);
  env.fillText('SETTINGS', VW / 2, py + 24, { size: 9, color: env.ac(0.7), weight: '600', align: 'center' });
  env.fillText('设置中心', VW / 2, py + 46, { size: 17, align: 'center' });
  rows.forEach(([icon, label, desc, on, cb], i) => {
    const y = py + 66 + i * rowH;
    if (i > 0) {
      ctx.save();
      ctx.strokeStyle = env.ac(0.12);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 20, y + 0.5);
      ctx.lineTo(px + pw - 20, y + 0.5);
      ctx.stroke();
      ctx.restore();
    }
    env.fillText(icon, px + 34, y + rowH / 2, { size: 16, align: 'center' });
    env.fillText(label, px + 56, y + 19, { size: 14 });
    env.fillText(desc, px + 56, y + 39, { size: 10, color: env.C.sub, weight: 'normal' });
    env.drawSwitch(px + pw - 20 - 46, y + rowH / 2 - 13, on);
    env.hitBox({ x: px + 16, y, w: pw - 32, h: rowH, label: `set-${label}`, cb: () => { cb(); env.buzz('light'); } });
  });
  // —— 界面皮肤：色卡点选即换并持久化 ——
  const skY = py + 66 + rows.length * rowH;
  env.fillText('🎨', px + 34, skY + 15, { size: 16, align: 'center' });
  env.fillText('界面皮肤', px + 56, skY + 10, { size: 14 });
  env.fillText(env.skin.ref, px + 56, skY + 30, { size: 10, color: env.C.sub, weight: 'normal' });
  const chipW = (pw - 40 - 12) / env.SKINS.length;
  env.SKINS.forEach((s, i) => {
    const cx0 = px + 20 + i * (chipW + 6);
    const cy0 = skY + 38;
    const on = s.id === env.skin.id;
    ctx.save();
    env.rr(cx0, cy0, chipW, 30, 8);
    ctx.fillStyle = on ? env.ac(0.18) : 'rgba(110,92,142,0.12)';
    ctx.fill();
    ctx.strokeStyle = on ? s.accent : 'rgba(110,92,142,0.4)';
    ctx.lineWidth = on ? 1.6 : 1;
    if (on) { ctx.shadowColor = s.accent; ctx.shadowBlur = 6; }
    ctx.stroke();
    ctx.fillStyle = s.accent;
    ctx.beginPath();
    ctx.arc(cx0 + 13, cy0 + 15, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    env.fillText(s.name, cx0 + 23, cy0 + 15, { size: 11, color: on ? env.C.text : env.C.sub });
    env.hitBox({
      x: cx0, y: cy0, w: chipW, h: 30, label: `skin-${s.id}`,
      cb: () => { env.applySkin(s.id); env.buzz('light'); env.showToast(`已切换「${s.name}」`); },
    });
  });
  env.btn({ x: px + 24, y: py + 66 + rows.length * rowH + skinH + 12, w: pw - 48, h: 40, label: '关闭', cb: () => env.setShowSettings(false) });
}

// ---------------- 指挥官档案（霓虹卡片） ----------------

function drawProfile(env: SkinEnv) {
  const { ctx, VW, VH } = env;
  ctx.fillStyle = 'rgba(6,3,12,0.82)';
  ctx.fillRect(0, 0, VW, VH);
  const pw = VW - 72;
  const ph = 456;
  const px = 36;
  const py = VH / 2 - ph / 2;
  neonPanel(env, px, py, pw, ph, 16);
  // 头像外圈：六边形霓虹环
  ctx.save();
  hexPath(env, VW / 2, py + 60, 44);
  ctx.strokeStyle = env.ac(0.5);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
  env.drawAvatar(VW / 2, py + 60, 34);
  env.fillText(env.displayNick(), VW / 2, py + 116, { size: 18, align: 'center' });
  env.fillText(env.commanderRank(), VW / 2, py + 140, { size: 11, color: env.C.gold, align: 'center', weight: 'normal' });

  // 战役进度条（紫→粉渐变）
  const cleared = env.loadProgress().cleared.length;
  const bw = pw - 64;
  const bx = px + 32;
  const by = py + 162;
  env.fillText(`战役进度 ${cleared} / ${env.LEVELS.length}`, VW / 2, by - 8, { size: 11, color: env.C.sub, align: 'center', weight: 'normal' });
  ctx.save();
  env.rr(bx, by + 6, bw, 10, 5);
  ctx.fillStyle = env.ac(0.12);
  ctx.fill();
  if (cleared > 0) {
    env.rr(bx, by + 6, Math.max(10, bw * (cleared / env.LEVELS.length)), 10, 5);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, env.C.cyan);
    g.addColorStop(1, env.C.pink);
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();

  // 军衔积分进度条（金→粉霓虹渐变 + 端点发光；满级显示已达最高军衔）
  const rp = env.getRankProgress();
  const ry = by + 42;
  env.fillText(
    rp.next === null
      ? `积分 ${rp.points.toLocaleString('en-US')} · 已达最高军衔`
      : `积分 ${rp.points.toLocaleString('en-US')} / ${rp.next.toLocaleString('en-US')} · 距「${rp.nextName}」还差 ${(rp.next - rp.points).toLocaleString('en-US')} 分`,
    VW / 2, ry - 8, { size: 11, color: env.C.sub, align: 'center', weight: 'normal' },
  );
  ctx.save();
  env.rr(bx, ry + 6, bw, 10, 5);
  ctx.fillStyle = env.ac(0.12);
  ctx.fill();
  const frac = rp.next === null ? 1 : Math.min(1, Math.max(0, (rp.points - rp.base) / (rp.next - rp.base)));
  if (frac > 0) {
    const fw2 = Math.max(10, bw * frac);
    env.rr(bx, ry + 6, fw2, 10, 5);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, env.C.gold);
    g.addColorStop(1, env.C.pink);
    ctx.fillStyle = g;
    ctx.shadowColor = env.C.pink;
    ctx.shadowBlur = 8; // 小元素发光
    ctx.fill();
  }
  ctx.restore();

  // 绑定状态行（静默登录成功后有 openid）
  const openid = env.getProfile().openid;
  if (openid) {
    env.fillText(`> LINKED: ${openid.slice(0, 12)}…`, VW / 2, ry + 34, { size: 10, color: env.C.green, align: 'center', weight: 'normal' });
  }

  env.btn({ x: px + 24, y: py + 268, w: pw - 48, h: 40, label: '💬 意见反馈', color: env.C.gold, cb: () => env.openFeedback() });
  let y = py + 320;
  if (!env.getProfile().real) {
    env.btn({ x: px + 24, y, w: pw - 48, h: 44, label: '同步微信头像昵称', color: env.C.green, primary: true, cb: () => env.authUser() });
    y += 56;
  }
  env.btn({ x: px + 24, y, w: pw - 48, h: 40, label: '关闭', cb: () => env.setShowProfile(false) });
}

// ---------------- 图鉴：三页签（滚动由 handleTouch 自管） ----------------

function drawCodex(env: SkinEnv, time: number) {
  const { ctx, VW, VH, MARGIN, TOP_SAFE } = env;
  matrixBg(env, time);
  drawMxHeader(env, '指挥官图鉴', () => env.goto('home'));

  // 霓虹页签
  const segY = TOP_SAFE + 6;
  const segW = (VW - MARGIN * 2 - 16) / 3;
  env.CODEX_TABS.forEach(([tab, label], i) => {
    const x = MARGIN + i * (segW + 8);
    const on = env.codex.tab === tab;
    ctx.save();
    env.rr(x, segY, segW, 34, 10);
    ctx.fillStyle = on ? env.ac(0.16) : 'rgba(20,12,36,0.85)';
    ctx.fill();
    ctx.strokeStyle = on ? env.ac(0.8) : 'rgba(110,92,142,0.4)';
    ctx.lineWidth = on ? 1.5 : 1;
    ctx.stroke();
    ctx.restore();
    env.fillText(label, x + segW / 2, segY + 17, { size: 13, color: on ? env.C.text : env.C.dim, align: 'center' });
    env.hitBox({
      x, y: segY, w: segW, h: 34, label: `codex-${tab}`,
      cb: () => { if (env.codex.tab !== tab) { env.codex.tab = tab; env.codex.scroll = 0; env.buzz('light'); } },
    });
  });

  // 内容区（滚动量由 handleTouch 写入 env.codex.scroll，这里自算上限并 clamp）
  const top = segY + 46;
  const bottom = VH - 22;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, VW, bottom - top);
  ctx.clip();
  const y0 = top + 8 - env.codex.scroll;
  let endY: number;
  if (env.codex.tab === 'story') endY = codexStory(env, time, y0, top, bottom);
  else if (env.codex.tab === 'towers') endY = codexTowers(env, time, y0, top, bottom);
  else endY = codexEnemies(env, time, y0, top, bottom);
  ctx.restore();
  codexMax = Math.max(0, endY - (top + 8) - (bottom - top) + 20);
  env.codex.scroll = Math.max(0, Math.min(codexMax, env.codex.scroll));

  // 上下渐变遮罩 + 滚动条
  const fadeH = 16;
  const gf = ctx.createLinearGradient(0, top, 0, top + fadeH);
  gf.addColorStop(0, 'rgba(10,5,22,0.9)');
  gf.addColorStop(1, 'rgba(10,5,22,0)');
  ctx.fillStyle = gf;
  ctx.fillRect(0, top, VW, fadeH);
  const gb = ctx.createLinearGradient(0, bottom - fadeH, 0, bottom);
  gb.addColorStop(0, 'rgba(13,7,25,0)');
  gb.addColorStop(1, 'rgba(13,7,25,0.9)');
  ctx.fillStyle = gb;
  ctx.fillRect(0, bottom - fadeH, VW, fadeH);
  if (codexMax > 0) {
    const viewH = bottom - top;
    const thumbH = Math.max(30, viewH * (viewH / (viewH + codexMax)));
    const ty = top + (viewH - thumbH) * (env.codex.scroll / codexMax);
    ctx.save();
    ctx.fillStyle = env.ac(0.3);
    env.rr(VW - 4, ty, 3, thumbH, 1.5);
    ctx.fill();
    ctx.restore();
  }

  drawOverlays(env);
}

function codexStory(env: SkinEnv, time: number, y0: number, top: number, bottom: number): number {
  const x = env.MARGIN;
  const w = env.VW - env.MARGIN * 2;
  const textSize = 12;
  const textW = w - 32;
  let totalLines = 0;
  for (const p of env.STORY_PARAS) totalLines += env.wrapCount(p, textW, textSize) + 0.6;
  const boxH = Math.ceil(totalLines * textSize * 1.65) + 46;
  neonPanel(env, x, y0, w, boxH, 12);
  env.fillText('世界观档案', x + 16, y0 + 20, { size: 13, color: env.C.cyan });
  let ty = y0 + 44;
  for (const p of env.STORY_PARAS) ty = env.wrapBlock(p, x + 16, ty, textW, { size: textSize }) + textSize * 1.65 * 0.6;

  let y = y0 + boxH + 20;
  env.fillText('战役编年史', x + 4, y + 8, { size: 14 });
  env.fillText('点击已解锁章节直接出击', x + w - 4, y + 9, { size: 10, color: env.C.dim, align: 'right', weight: 'normal' });
  y += 28;
  const cleared = env.loadProgress().cleared;
  env.LEVELS.forEach((lv, i) => {
    const unlock = i === 0 || cleared.includes(env.LEVELS[i - 1].id);
    const done = cleared.includes(lv.id);
    const rowH = 60;
    if (y + rowH > top && y < bottom) {
      env.panel(x, y, w, rowH, unlock ? env.ac(0.3) : 'rgba(110,92,142,0.2)', 12);
      env.drawCardArt(x + 8, y + 8, 74, rowH - 16, lv.id, time, 8);
      const tx = x + 94;
      env.ctx.save();
      if (!unlock) env.ctx.globalAlpha = 0.45;
      env.fillText(`CH-${String(lv.id).padStart(2, '0')}`, tx, y + 18, { size: 9, color: env.C.cyan, weight: '600' });
      env.fillText(lv.name, tx, y + 36, { size: 14 });
      env.fillText(lv.sub, tx, y + 52, { size: 10, color: env.C.sub, weight: 'normal' });
      env.ctx.restore();
      if (done) env.chip(x + w - 12, y + 16, '已通关', env.C.green);
      else if (!unlock) env.chip(x + w - 12, y + 16, '未解锁', env.C.dim);
      if (unlock) env.hitBox({ x, y, w, h: rowH, label: `cx-${lv.id}`, cb: () => env.gotoBriefing(lv.id) });
      else env.hitBox({ x, y, w, h: rowH, label: `cx-lock-${lv.id}`, cb: () => { env.showToast(`通关「${env.LEVELS[i - 1].name}」后解锁`); env.buzz('light'); } });
    }
    y += rowH + 10;
  });
  return y;
}

function codexTowers(env: SkinEnv, time: number, y0: number, top: number, bottom: number): number {
  const x = env.MARGIN;
  const w = env.VW - env.MARGIN * 2;
  let y = y0;
  for (const def of env.TOWER_LIST) {
    const cardH = 134;
    const unlocked = env.towerUnlocked(def.type);
    if (y + cardH > top && y < bottom) {
      env.panel(x, y, w, cardH, unlocked ? `${def.color}55` : 'rgba(110,92,142,0.2)', 12);
      if (unlocked) neonStroke(env, x, y, w, cardH, 12, 0.35);
      // 图标格：六边形 + 满级形态演示
      const igx = x + 14 + 32;
      const igy = y + cardH / 2;
      env.ctx.save();
      hexPath(env, igx, igy, 34);
      env.ctx.fillStyle = `${def.color}14`;
      env.ctx.fill();
      env.ctx.strokeStyle = `${def.color}55`;
      env.ctx.lineWidth = 1.2;
      env.ctx.stroke();
      hexPath(env, igx, igy, 33);
      env.ctx.clip();
      env.ctx.translate(igx, igy);
      env.ctx.globalAlpha = unlocked ? 1 : 0.35;
      const chargeV = def.charge ? 0.5 + 0.5 * Math.sin(time * 1.4) : 0;
      env.drawTower(env.ctx, def.type, 2, 46, Math.sin(time * 1.1) * 0.12, chargeV, time, { ticks: false });
      env.ctx.restore();
      // 文本区
      const tx = x + 14 + 64 + 14;
      env.ctx.save();
      if (!unlocked) env.ctx.globalAlpha = 0.55;
      env.fillText(def.name, tx, y + 20, { size: 15 });
      env.fillText(def.nameEn, tx, y + 37, { size: 9, color: env.C.dim, weight: '600' });
      env.fillText(def.role, tx, y + 53, { size: 11, color: env.C.sub, weight: 'normal' });
      env.fillText(`伤害 ${def.levels.map((l) => l.damage).join(' → ')} · 射程 ${def.levels.map((l) => l.range).join(' → ')}`, tx, y + 71, { size: 10, weight: 'normal' });
      env.fillText(`射速 ${def.levels.map((l) => l.rate).join(' → ')}/s · 造价 ◈${def.levels[0].cost}`, tx, y + 87, { size: 10, weight: 'normal' });
      env.fillText(`克制 ${def.strong}`, tx, y + 105, { size: 10, color: env.C.green, weight: 'normal' });
      env.fillText(`短板 ${def.weak}`, tx, y + 121, { size: 10, color: env.C.sub, weight: 'normal' });
      env.ctx.restore();
      env.chip(x + w - 12, y + 17, def.tag, def.color);
      if (!unlocked) {
        env.fillText(`通关第 ${env.TOWER_UNLOCK[def.type]} 章解锁`, x + w - 12, y + cardH - 12, { size: 10, color: env.C.gold, align: 'right' });
      }
    }
    y += cardH + 12;
  }
  return y;
}

function codexEnemies(env: SkinEnv, time: number, y0: number, top: number, bottom: number): number {
  const x = env.MARGIN;
  const w = env.VW - env.MARGIN * 2;
  let y = y0;
  for (const def of env.ENEMY_LIST) {
    const textW = w - 92 - 14;
    const descLines = env.wrapCount(def.desc, textW, 10);
    const cardH = Math.ceil(92 + descLines * 13.2 + 22);
    if (y + cardH > top && y < bottom) {
      env.panel(x, y, w, cardH, `${def.color}44`, 12);
      neonStroke(env, x, y, w, cardH, 12, 0.25);
      // 图标格：六边形活体贴图（缓慢上下游动）
      const igx = x + 14 + 32;
      const igy = y + (cardH - 64) / 2 + 32;
      env.ctx.save();
      hexPath(env, igx, igy, 34);
      env.ctx.fillStyle = `${def.color}12`;
      env.ctx.fill();
      env.ctx.strokeStyle = `${def.color}44`;
      env.ctx.lineWidth = 1.2;
      env.ctx.stroke();
      hexPath(env, igx, igy, 33);
      env.ctx.clip();
      env.ctx.translate(igx, igy + Math.sin(time * 2.2) * 2);
      env.drawEnemy(env.ctx, def.type, Math.min(21, def.size), time, {});
      env.ctx.restore();
      // 文本区
      const tx = x + 14 + 64 + 14;
      env.fillText(def.name, tx, y + 20, { size: 15 });
      env.fillText(def.nameEn, tx, y + 37, { size: 9, color: env.C.dim, weight: '600' });
      env.chip(x + w - 12, y + 17, env.ENEMY_CATEGORY[def.category] ?? def.category, def.color);
      env.fillText(`威胁 ${'★'.repeat(def.threat)}`, tx, y + 54, { size: 10, color: env.C.gold });
      env.fillText(`生命 ${def.hp} · 速度 ${def.speed} · 击杀 ◈${def.reward} · 漏怪 -${def.leak}`, tx, y + 70, { size: 10, color: env.C.sub, weight: 'normal' });
      const dy = env.wrapBlock(def.desc, tx, y + 86, textW, { size: 10, color: 'rgba(232,241,255,0.75)' });
      env.fillText(`弱点：${def.weakness}`, tx, dy + 2, { size: 10, color: env.C.cyan, weight: 'normal' });
    }
    y += cardH + 12;
  }
  return y;
}

// ---------------- 触摸接管：主页横向轮盘 + 图鉴竖向滚动 ----------------

function handleTouch(env: SkinEnv, phase: 'start' | 'move' | 'end', p: TouchPoint): boolean {
  const screen = env.app.screen;
  // 换屏即清理拖拽状态，避免残留状态冻结轮盘吸附
  if (screen !== 'home') homeDrag = null;
  if (screen !== 'codex') codexDrag = null;
  // 弹层打开时不接管：触摸全部交还主文件（hooks 派发弹层按钮）
  if (env.showSettings() || env.showProfile()) return false;

  if (screen === 'home') {
    if (phase === 'start') {
      homeDrag = { startX: p.x, startY: p.y, startPos: carPos, lastX: p.x, lastT: Date.now(), vx: 0, moved: false };
      // 返回 false：让主文件记录 touchTime/pressedBtn，轻点时 hooks 派发才能生效
      return false;
    }
    if (!homeDrag) return false;
    if (phase === 'move') {
      const now = Date.now();
      const dx = p.x - homeDrag.startX;
      const dy = p.y - homeDrag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 10) homeDrag.moved = true;
      // 平滑速度估计（用于松手惯性）
      const dt = Math.max(1, now - homeDrag.lastT);
      homeDrag.vx = homeDrag.vx * 0.7 + ((p.x - homeDrag.lastX) / dt) * 1000 * 0.3;
      homeDrag.lastX = p.x;
      homeDrag.lastT = now;
      // 横滑直接驱动轮盘（两端带过拽余量）
      const N = env.LEVELS.length;
      carPos = Math.max(-0.35, Math.min(N - 1 + 0.35, homeDrag.startPos - dx / carStep(env)));
      carTarget = carPos;
      return true; // 接管横滑，抑制主文件竖向滚动
    }
    // end：拖动 → 惯性吸附并消费事件；轻点 → 交还主文件派发按钮点击
    const d = homeDrag;
    homeDrag = null;
    if (d.moved) {
      const N = env.LEVELS.length;
      const fling = (-d.vx / carStep(env)) * 0.22;
      carTarget = Math.max(0, Math.min(N - 1, Math.round(carPos + fling)));
      return true;
    }
    return false;
  }

  if (screen === 'codex') {
    if (phase === 'start') {
      codexDrag = { startY: p.y, scroll0: env.codex.scroll, moved: false };
      return false;
    }
    if (!codexDrag) return false;
    if (phase === 'move') {
      if (Math.abs(p.y - codexDrag.startY) > 8) codexDrag.moved = true;
      env.codex.scroll = Math.max(0, Math.min(codexMax, codexDrag.scroll0 + (codexDrag.startY - p.y)));
      return true;
    }
    const moved = codexDrag.moved;
    codexDrag = null;
    return moved; // 拖动消费事件；轻点交还主文件派发（章节行/页签点击）
  }

  return false;
}

// ---------------- 模块导出 ----------------

export const matrixSkin: SkinModule = {
  id: 'matrix',
  drawSplashMenu,
  drawHome,
  drawBriefing,
  drawBattleHUD,
  drawBottomBar,
  drawTechOverlay,
  drawResult,
  drawSettings,
  drawCodex,
  drawProfile,
  handleTouch,
};
