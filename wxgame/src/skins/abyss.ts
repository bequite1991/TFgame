// 深空全息（abyss）· 全息科幻座舱皮肤 —— 完整独立实现
//
// 视觉语言：圆角玻璃面板叠加横向扫描线（缓慢下移的亮线）、边缘辉光（只给小元素）、
// 元素轻微上下漂浮（sin 驱动 1-3px）、数据流线；主色 cyan。
// abyss 是「原作」：布局骨架接近默认实现，但每个屏幕叠加明确的全息动效层。
//
// 交互：自绘全息按钮（按压时从按压中心扩散涟漪光环；按压缩放由主文件 pressFx=scale 覆盖
// env.btn，自绘按钮自行实现内缩+涟漪）、页面元素依次延迟淡入+上浮入场、
// 科技三选一卡片从屏幕深处由小到大推入（scale 0.7→1 + 淡入）、结算数字滚动 + 扫描光扫过。
//
// 几何约束：主页卡片尺寸（CARD_H/CARD_GAP）与塔栏槽位（SLOT_W/SLOT_GAP/MARGIN/BAR_H）
// 与默认完全一致——主文件触摸逻辑（totalScrollMax/towerSlotAt/barTouch 拖拽建塔）依赖它们。
// 图鉴页滚动由 handleTouch 接管（主文件内置 codexMaxScroll 未暴露给模块，自行跟踪上限）。

import { CELL, COLS, ROWS } from '../game/config';
import type { GameEngine, TowerType } from '../game/types';
import type { Button, SkinEnv, SkinModule, TouchPoint } from './types';

// ---------------- 模块级状态 ----------------

/** 最近一次按压点（涟漪光环中心；handleTouch('start') 捕获） */
let pressPt: { x: number; y: number; at: number } | null = null;
/** 自绘分段控件的高亮块滑动动画进度（key → 当前浮点位置） */
const segAnim: Record<string, number> = {};
/** 图鉴滚动接管状态 */
let codexDrag: { startY: number; lastY: number; scroll0: number; acc: number } | null = null;
/** 图鉴内容最大滚动量（每帧绘制时重算） */
let codexMaxScroll = 0;
/** 弹层打开时间戳（入场动画用；跟踪 showSettings/showProfile 的上升沿） */
let settingsOpenAt = 0;
let settingsWasOpen = false;
let profileOpenAt = 0;
let profileWasOpen = false;

// ---------------- 通用小工具 ----------------

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** easeOutCubic */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** 入场进度：进入当前屏幕后第 i 个元素依次延迟淡入（0..1，上浮量由调用方换算） */
function enterP(env: SkinEnv, i: number, step = 0.07): number {
  return easeOut(clamp01(((Date.now() - env.getScreenAt()) / 1000 - 0.06 - i * step) / 0.38));
}

/** 弹层开关沿跟踪：各屏幕绘制开头调用，关闭时复位以便下次重新放入场动画 */
function syncOverlayFlags(env: SkinEnv) {
  if (!env.showSettings()) settingsWasOpen = false;
  if (!env.showProfile()) profileWasOpen = false;
}

// ---------------- 全息视觉原语 ----------------

/**
 * 全息玻璃面板：竖向微渐变底 + 顶部受光亮边 + 横向细纹理 + 缓慢下移的扫描亮线 + 四角 L 形亮标。
 * 不用 shadowBlur（全屏发光会掉帧），辉感靠叠色与亮标。
 */
function holoPanel(env: SkinEnv, x: number, y: number, w: number, h: number, time: number, stroke?: string, r?: number) {
  const { ctx } = env;
  const rad = r ?? env.RADIUS;
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, env.skin.panelTop);
  g.addColorStop(1, env.skin.panelBottom);
  env.rr(x, y, w, h, rad);
  ctx.fillStyle = g;
  ctx.fill();
  // 内部效果统一裁剪到面板
  env.rr(x, y, w, h, rad);
  ctx.clip();
  // 横向细纹理（全息投影的行扫描质感）
  ctx.strokeStyle = env.ac(0.045);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let ly = y + 5; ly < y + h; ly += 8) {
    ctx.moveTo(x + 3, ly + 0.5);
    ctx.lineTo(x + w - 3, ly + 0.5);
  }
  ctx.stroke();
  // 缓慢下移的亮扫描线
  const sy = y + ((time * 24) % (h + 48)) - 24;
  const sg = ctx.createLinearGradient(0, sy - 9, 0, sy + 9);
  sg.addColorStop(0, env.ac(0));
  sg.addColorStop(0.5, env.ac(0.12));
  sg.addColorStop(1, env.ac(0));
  ctx.fillStyle = sg;
  ctx.fillRect(x, sy - 9, w, 18);
  // 顶部亮边（玻璃受光面）
  const tg = ctx.createLinearGradient(0, y, 0, y + Math.min(10, h));
  tg.addColorStop(0, env.ac(0.16));
  tg.addColorStop(1, env.ac(0));
  ctx.fillStyle = tg;
  ctx.fillRect(x, y, w, Math.min(10, h));
  ctx.restore();
  // 描边 + 四角 L 形亮标
  ctx.save();
  env.rr(x, y, w, h, rad);
  ctx.strokeStyle = stroke ?? env.C.panelLine;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = env.ac(0.7);
  ctx.lineWidth = 1.6;
  const cl = 7;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + cl); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x + cl, y + 1);
  ctx.moveTo(x + w - cl, y + 1); ctx.lineTo(x + w - 1, y + 1); ctx.lineTo(x + w - 1, y + cl);
  ctx.moveTo(x + w - 1, y + h - cl); ctx.lineTo(x + w - 1, y + h - 1); ctx.lineTo(x + w - cl, y + h - 1);
  ctx.moveTo(x + cl, y + h - 1); ctx.lineTo(x + 1, y + h - 1); ctx.lineTo(x + 1, y + h - cl);
  ctx.stroke();
  ctx.restore();
}

/**
 * 全息按钮：自绘玻璃按钮 + 命中注册（hitBox）。
 * 按压反馈：整体内缩 + 从按压中心扩散的双层涟漪光环（pressPt 由 handleTouch 捕获）。
 */
function holoBtn(env: SkinEnv, b: Button, time: number) {
  const { ctx } = env;
  const c = b.color ?? env.C.cyan;
  const r = Math.min(10, b.h / 2);
  const pb = env.getPressedBtn();
  const pressed = pb !== null && pb.x === b.x && pb.y === b.y && pb.w === b.w && pb.label === b.label;
  ctx.save();
  if (pressed) {
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale(0.95, 0.95);
    ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    ctx.globalAlpha *= 0.9;
  }
  if (b.disabled) ctx.globalAlpha *= 0.38;
  env.rr(b.x, b.y, b.w, b.h, r);
  if (b.primary && !b.disabled) {
    // 主按钮：主题色渐变 + 呼吸辉光（shadowBlur 只给这类小元素）
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    g.addColorStop(0, c);
    g.addColorStop(1, env.shade(c));
    ctx.shadowColor = c;
    ctx.shadowBlur = 8 + 5 * Math.sin(time * 2.6);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = b.active ? env.ac(0.22) : env.ac(0.07);
    ctx.fill();
    ctx.strokeStyle = b.active ? c : `${c}88`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // 按钮内扫描线
  ctx.save();
  env.rr(b.x, b.y, b.w, b.h, r);
  ctx.clip();
  const sy = b.y + ((time * 30) % (b.h + 24)) - 12;
  const sg = ctx.createLinearGradient(0, sy - 6, 0, sy + 6);
  sg.addColorStop(0, 'rgba(255,255,255,0)');
  sg.addColorStop(0.5, b.primary && !b.disabled ? 'rgba(255,255,255,0.18)' : env.ac(0.14));
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(b.x, sy - 6, b.w, 12);
  ctx.restore();
  // 按压涟漪：从按压中心扩散的双层光环
  if (pressed && pressPt) {
    const dt = (Date.now() - pressPt.at) / 1000;
    const a = Math.max(0, 0.55 - dt * 1.1);
    if (a > 0) {
      const px = Math.min(Math.max(pressPt.x, b.x), b.x + b.w);
      const py = Math.min(Math.max(pressPt.y, b.y), b.y + b.h);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.primary && !b.disabled ? '#FFFFFF' : c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 5 + dt * 160, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.5;
      ctx.beginPath();
      ctx.arc(px, py, 2 + dt * 90, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (b.label) {
    const labelColor = b.primary && !b.disabled ? '#081226' : b.active ? c : b.disabled ? '#9AA7C2' : env.C.text;
    env.fillText(b.label, b.x + b.w / 2, b.y + (b.sub ? b.h / 2 - 9 : b.h / 2), { size: 14, color: labelColor, align: 'center' });
    if (b.sub) env.fillText(b.sub, b.x + b.w / 2, b.y + b.h / 2 + 11, { size: 11, color: b.disabled ? '#C77A34' : env.C.gold, align: 'center' });
  }
  ctx.restore();
  env.hitBox(b);
}

/** 全屏全息氛围层：缓慢下移的扫描亮带 + 垂直数据流亮点（确定性伪随机） */
function holoAtmosphere(env: SkinEnv, time: number) {
  const { ctx, VW, VH } = env;
  ctx.save();
  const sy = (time * 30) % (VH + 160) - 80;
  const g = ctx.createLinearGradient(0, sy - 34, 0, sy + 34);
  g.addColorStop(0, env.ac(0));
  g.addColorStop(0.5, env.ac(0.05));
  g.addColorStop(1, env.ac(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, sy - 34, VW, 68);
  ctx.fillStyle = env.C.cyan;
  for (let i = 0; i < 6; i++) {
    const x = env.hash01(i * 13 + 5) * VW;
    const sp = 36 + env.hash01(i * 7 + 1) * 56;
    const yy = (time * sp + env.hash01(i * 31 + 3) * VH) % (VH + 40) - 20;
    ctx.globalAlpha = 0.08 + 0.08 * env.hash01(i * 17 + 9);
    ctx.fillRect(x, yy, 1.5, 12);
  }
  ctx.restore();
}

/** 全息页头：玻璃渐变条 + 底部流动数据线 + 标题；back 存在时带返回（设置入口只在欢迎页） */
function holoHeader(env: SkinEnv, time: number, title: string, back?: () => void) {
  const { ctx, VW, CAP_MID, TOP_SAFE, CAP_LEFT, GAME_CENTER_PAD, MARGIN } = env;
  const btnS = 36;
  const top = CAP_MID - btnS / 2;
  ctx.save();
  const g = ctx.createLinearGradient(0, top - 6, 0, TOP_SAFE);
  g.addColorStop(0, env.skin.panelTop);
  g.addColorStop(1, env.skin.panelBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, top - 6, VW, TOP_SAFE - top + 6);
  // 底边：静态细线 + 流动数据短划
  ctx.strokeStyle = env.ac(0.18);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, TOP_SAFE - 0.5);
  ctx.lineTo(VW, TOP_SAFE - 0.5);
  ctx.stroke();
  ctx.strokeStyle = env.ac(0.5);
  ctx.setLineDash([22, 74]);
  ctx.lineDashOffset = -time * 90;
  ctx.beginPath();
  ctx.moveTo(0, TOP_SAFE - 0.5);
  ctx.lineTo(VW, TOP_SAFE - 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  let tx = MARGIN;
  // 无齿轮：标题右界直接让到胶囊/游戏中心入口前
  const rightLimit = CAP_LEFT - 8 - GAME_CENTER_PAD;
  if (back) {
    holoBtn(env, { x: MARGIN, y: top, w: btnS, h: btnS, label: '‹', cb: back }, time);
    tx = MARGIN + btnS + 12;
  }
  // 标题：左对齐，随可用宽度自动缩字号
  const maxW = rightLimit - tx - 8;
  let tSize = 16;
  ctx.save();
  while (tSize > 11) {
    ctx.font = `bold ${tSize}px sans-serif`;
    if (ctx.measureText(title).width <= maxW) break;
    tSize--;
  }
  ctx.restore();
  env.fillText('TOWER LINE DEFENSE', tx, CAP_MID - 11, { size: 9, color: env.ac(0.7), weight: '600' });
  env.fillText(title, tx, CAP_MID + 8, { size: tSize });
}

/** 全息分段控件：玻璃舱 + 高亮块平滑滑动（替代 env.segControl 的默认样式） */
function holoSeg(env: SkinEnv, x: number, y: number, w: number, items: string[], activeIdx: number, key: string, onPick: (i: number) => void, time: number) {
  const { ctx } = env;
  const h = 34;
  holoPanel(env, x, y, w, h, time, env.ac(0.3), 17);
  const sw = w / items.length;
  const cur = segAnim[key] ?? activeIdx;
  const next = cur + (activeIdx - cur) * 0.28;
  segAnim[key] = Math.abs(activeIdx - next) < 0.01 ? activeIdx : next;
  ctx.save();
  env.rr(x + segAnim[key] * sw + 3, y + 3, sw - 6, h - 6, 14);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, env.C.cyan);
  g.addColorStop(1, env.shade(env.C.cyan));
  ctx.shadowColor = env.C.cyan;
  ctx.shadowBlur = 8;
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  items.forEach((label, i) => {
    env.fillText(label, x + i * sw + sw / 2, y + h / 2 + 0.5, { size: 13, color: i === activeIdx ? '#081226' : env.C.sub, align: 'center' });
    env.hitBox({ x: x + i * sw, y, w: sw, h, label: '', cb: () => { if (i !== activeIdx) { onPick(i); env.buzz('light'); } } });
  });
}

/** 整屏接管后内置弹层不再执行：模块自行绘制设置/档案弹层 */
function drawOverlays(env: SkinEnv, time: number) {
  if (env.showSettings()) drawSettings(env, time);
  if (env.showProfile()) drawProfile(env, time);
}

// ---------------- 欢迎页主菜单区 ----------------

function drawSplashMenu(env: SkinEnv, time: number, menuA: number) {
  syncOverlayFlags(env);
  const { ctx, VW, VH, MARGIN } = env;
  const slide = (1 - menuA) * 16;
  ctx.save();
  ctx.globalAlpha = menuA;
  // 与主文件 drawSplash 的标题锚点对齐：标题在徽标环下方
  const titleY = VH * 0.28 + (VW * 0.17 + 8) * 1.9;
  const menuY = titleY + 124 + slide;

  // 主按钮：呼吸光晕 + 双层脉冲环向外扩散
  const bw = 220;
  const bx = VW / 2 - bw / 2;
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
  const halo = ctx.createRadialGradient(VW / 2, menuY + 27, 0, VW / 2, menuY + 27, 130);
  halo.addColorStop(0, `rgba(255,201,77,${0.14 + 0.08 * pulse})`);
  halo.addColorStop(1, 'rgba(255,201,77,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(bx - 60, menuY - 70, bw + 120, 200);
  for (let k = 0; k < 2; k++) {
    const pt = (time * 0.55 + k * 0.5) % 1;
    ctx.save();
    ctx.globalAlpha = menuA * (1 - pt) * 0.4;
    ctx.strokeStyle = env.C.gold;
    ctx.lineWidth = 1.5;
    env.rr(bx - pt * 26, menuY - pt * 12, bw + pt * 52, 54 + pt * 24, 27 + pt * 12);
    ctx.stroke();
    ctx.restore();
  }
  holoBtn(env, { x: bx, y: menuY, w: bw, h: 54, label: '▶ 开始战役', color: env.C.gold, primary: true, cb: () => env.goto('home') }, time);

  // 三个入口：半透全息卡横排，各自错相位上下漂浮
  const entries: [icon: string, label: string, en: string, color: string, cb: () => void][] = [
    ['📖', '图鉴', 'CODEX', env.C.gold, () => { env.codex.scroll = 0; env.goto('codex'); }],
    ['⚙', '设置', 'SYSTEM', env.C.cyan, () => { env.setShowProfile(false); env.setShowSettings(true); }],
    ['', '档案', 'PROFILE', env.C.green, () => { env.setShowSettings(false); env.setShowProfile(true); }],
  ];
  const entryY = menuY + 54 + 18;
  const entryW = (VW - MARGIN * 2 - 20) / 3;
  entries.forEach(([icon, label, en, color, cb], i) => {
    const x = MARGIN + i * (entryW + 10);
    const fy = Math.sin(time * 1.3 + i * 2.1) * 3; // 错相位漂浮
    holoPanel(env, x, entryY + fy, entryW, 66, time + i * 3, `${color}44`, 12);
    if (icon) env.fillText(icon, x + entryW / 2, entryY + fy + 24, { size: 18, align: 'center' });
    else env.drawAvatar(x + entryW / 2, entryY + fy + 24, 12);
    env.fillText(label, x + entryW / 2, entryY + fy + 46, { size: 12, color: env.C.text, align: 'center' });
    env.fillText(en, x + entryW / 2, entryY + fy + 59, { size: 7, color: env.ac(0.55), align: 'center', weight: '600' });
    // 命中区覆盖漂浮范围（±3px 余量）
    env.hitBox({ x, y: entryY - 4, w: entryW, h: 74, label: '', cb });
  });
  ctx.restore();
}

// ---------------- 主页：选关 + 难度 ----------------

// 与主文件一致：主页滚动触摸（totalScrollMax）与命中区布局依赖该几何
const CARD_H = 116;
const CARD_GAP = 12;

function drawHome(env: SkinEnv, time: number) {
  syncOverlayFlags(env);
  const { ctx, VW, VH, MARGIN } = env;
  env.drawSpaceBg(time);
  holoAtmosphere(env, time);
  holoHeader(env, time, '高塔防线 · 战役选择', () => env.goto('splash'));

  // 难度分段（全息舱样式，行为与默认一致）+ 右侧 单人/双人同屏 切换（§4.1）
  const segW = VW - MARGIN * 2;
  const diffW = Math.round(segW * 0.6);
  holoSeg(env, MARGIN, env.TOP_SAFE + 4, diffW, env.DIFF_LIST.map((d) => env.DIFFICULTIES[d].name), env.DIFF_LIST.indexOf(env.app.difficulty), 'diff', (i) => {
    env.app.difficulty = env.DIFF_LIST[i];
    env.track('difficulty_select', { difficulty: env.app.difficulty });
  }, time);
  holoSeg(env, MARGIN + diffW + 10, env.TOP_SAFE + 4, segW - diffW - 10, ['单人', '同屏', '联机'], env.app.mode === 'coop' ? 1 : env.app.mode === 'online' ? 2 : 0, 'coop', (i) => { env.setMode(i === 1 ? 'coop' : i === 2 ? 'online' : 'single'); env.buzz('light'); }, time);

  // 关卡卡列表（几何与默认一致，滚动由主文件触摸驱动）
  const homeTop = env.homeTop;
  const homeBottom = env.homeBottom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, homeTop, VW, homeBottom - homeTop);
  ctx.clip();
  const cleared = env.loadProgress().cleared;
  const cardX = MARGIN;
  const cardW = VW - MARGIN * 2;
  env.LEVELS.forEach((lv, i) => {
    const unlock = i === 0 || cleared.includes(env.LEVELS[i - 1].id);
    const done = cleared.includes(lv.id);
    // 依次延迟淡入 + 上浮入场（滚动就位后动画已播完，不影响滑动）
    const p = enterP(env, Math.min(i, 8));
    const y = homeTop + 8 + i * (CARD_H + CARD_GAP) - env.app.scroll + (1 - p) * 18;
    if (y + CARD_H < homeTop - 20 || y > homeBottom + 20) return;

    ctx.save();
    ctx.globalAlpha = p;
    holoPanel(env, cardX, y, cardW, CARD_H, time + i, unlock ? env.C.panelLine : 'rgba(124,141,176,0.15)');
    // 宣传图缩略 + 全息描边
    const artX = cardX + 8;
    const artY = y + 8;
    const artW = 82;
    const artH = CARD_H - 16;
    env.drawCardArt(artX, artY, artW, artH, lv.id, time);
    ctx.save();
    env.rr(artX, artY, artW, artH, 10);
    ctx.strokeStyle = env.ac(0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    if (!unlock) {
      ctx.fillStyle = 'rgba(7,11,24,0.55)';
      ctx.fill();
    }
    ctx.restore();

    // 信息区
    const tx = artX + artW + 12;
    ctx.save();
    if (!unlock) ctx.globalAlpha *= 0.45;
    env.fillText(`CHAPTER ${String(lv.id).padStart(2, '0')}`, tx, y + 20, { size: 10, color: env.C.cyan, weight: '600' });
    env.fillText(lv.name, tx, y + 44, { size: 17 });
    env.fillText(lv.sub, tx, y + 66, { size: 11, color: env.C.sub, weight: 'normal' });
    const bossTxt = lv.waves.filter((w) => w.isBoss).map((w) => `W${w.wave}`).join(' ');
    env.fillText(`${lv.waves.length} 波 · BOSS ${bossTxt || '—'}`, tx, y + 88, { size: 10, color: env.C.dim, weight: 'normal' });
    ctx.restore();

    if (done) env.chip(cardX + cardW - 12, y + 18, '已通关', env.C.green);
    else if (!unlock) env.chip(cardX + cardW - 12, y + 18, '未解锁', env.C.dim);

    if (unlock) {
      holoBtn(env, {
        x: cardX + cardW - 92, y: y + CARD_H - 50, w: 80, h: 38,
        label: done ? '重玩' : '出击', color: done ? env.C.green : env.C.cyan, primary: !done,
        cb: () => env.gotoBriefing(lv.id),
      }, time);
      // 整卡可点（CTA 之后注册，让按钮优先命中）
      env.hitBox({ x: cardX, y, w: cardW - 104, h: CARD_H, label: '', cb: () => env.gotoBriefing(lv.id) });
    } else {
      // 锁图标 + 点击提示解锁条件
      const lx = cardX + cardW - 52;
      const ly = y + CARD_H - 34;
      ctx.save();
      ctx.strokeStyle = env.C.dim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(lx - 9, ly - 2, 18, 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(lx, ly - 2, 6, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
      env.hitBox({
        x: cardX, y, w: cardW, h: CARD_H, label: '',
        cb: () => { env.showToast(`通关「${env.LEVELS[i - 1].name}」后解锁`); env.buzz('light'); },
      });
    }
    ctx.restore();
  });
  ctx.restore();

  // 列表上下渐变遮罩 + 滚动条
  const fadeH = 18;
  const gf = ctx.createLinearGradient(0, homeTop, 0, homeTop + fadeH);
  gf.addColorStop(0, 'rgba(8,12,26,0.9)');
  gf.addColorStop(1, 'rgba(8,12,26,0)');
  ctx.fillStyle = gf;
  ctx.fillRect(0, homeTop, VW, fadeH);
  const gb = ctx.createLinearGradient(0, homeBottom - fadeH, 0, homeBottom);
  gb.addColorStop(0, 'rgba(10,15,36,0)');
  gb.addColorStop(1, 'rgba(10,15,36,0.9)');
  ctx.fillStyle = gb;
  ctx.fillRect(0, homeBottom - fadeH, VW, fadeH);
  const smax = env.totalScrollMax();
  if (smax > 0) {
    const viewH = homeBottom - homeTop;
    const thumbH = Math.max(30, viewH * (viewH / (viewH + smax)));
    const ty = homeTop + (viewH - thumbH) * (env.app.scroll / smax);
    ctx.save();
    ctx.fillStyle = env.ac(0.35);
    env.rr(VW - 4, ty, 3, thumbH, 1.5);
    ctx.fill();
    ctx.restore();
  }

  env.fillText('微信小游戏 · 试运营包', VW / 2, VH - 12, { size: 10, color: 'rgba(124,141,176,0.7)', align: 'center' });
  drawOverlays(env, time);
}

// ---------------- 简报 ----------------

function drawBriefing(env: SkinEnv, time: number) {
  syncOverlayFlags(env);
  const { ctx, VW, MARGIN } = env;
  env.drawSpaceBg(time);
  holoAtmosphere(env, time);
  const lv = env.LEVELS.find((l) => l.id === env.app.levelId) ?? env.LEVELS[0];

  holoHeader(env, time, '任务简报', () => { env.stopNarration(); env.goto('home'); });

  // 顶部宣传横幅（全息框 + 斜向扫描光）
  const p0 = enterP(env, 0);
  const bannerH = Math.min(168, Math.round(VW * 0.45));
  const bx = MARGIN;
  const bw = VW - MARGIN * 2;
  const by = env.TOP_SAFE + 6 + (1 - p0) * 14;
  ctx.save();
  ctx.globalAlpha = p0;
  env.drawCardArt(bx, by, bw, bannerH, lv.id, time, env.RADIUS);
  ctx.save();
  env.rr(bx, by, bw, bannerH, env.RADIUS);
  ctx.clip();
  // 标题压暗带
  const g = ctx.createLinearGradient(bx, by + bannerH * 0.4, bx, by + bannerH);
  g.addColorStop(0, 'rgba(7,11,24,0)');
  g.addColorStop(1, 'rgba(7,11,24,0.82)');
  ctx.fillStyle = g;
  ctx.fillRect(bx, by, bw, bannerH);
  // 斜向扫描光缓慢扫过横幅
  const swx = bx - 90 + ((time * 46) % (bw + 180));
  const sg = ctx.createLinearGradient(swx - 34, 0, swx + 34, 0);
  sg.addColorStop(0, env.ac(0));
  sg.addColorStop(0.5, env.ac(0.13));
  sg.addColorStop(1, env.ac(0));
  ctx.fillStyle = sg;
  ctx.fillRect(swx - 34, by, 68, bannerH);
  ctx.restore();
  ctx.save();
  env.rr(bx, by, bw, bannerH, env.RADIUS);
  ctx.strokeStyle = env.ac(0.4);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  env.fillText(`第 ${lv.id} 章`, bx + 16, by + bannerH - 44, { size: 11, color: env.C.cyan, weight: '600' });
  env.fillText(lv.name, bx + 16, by + bannerH - 20, { size: 19 });
  env.fillText(lv.sub, bx + bw - 16, by + bannerH - 20, { size: 11, color: env.C.sub, align: 'right', weight: 'normal' });
  // 旁白开关（与设置中心共享同一状态）
  holoBtn(env, {
    x: bx + bw - 88, y: by + 10, w: 78, h: 30,
    label: env.narrationMuted() ? '🔇 旁白' : '🔊 旁白', color: env.narrationMuted() ? env.C.sub : env.C.cyan,
    cb: () => env.toggleNarrationMuted(),
  }, time);
  ctx.restore();

  // 简报卡（行数测量与绘制共用同一字号，防溢出）
  const p1 = enterP(env, 1);
  const textSize = 12;
  const lineH = textSize * 1.65;
  const textW = VW - MARGIN * 2 - 32;
  let totalLines = 0;
  for (const para of lv.briefing) totalLines += env.wrapCount(para, textW, textSize) + 0.6;
  const boxY = by + bannerH + 12;
  const boxH = Math.ceil(totalLines * lineH) + 26;
  ctx.save();
  ctx.globalAlpha = p1;
  ctx.translate(0, (1 - p1) * 14);
  holoPanel(env, MARGIN, boxY, VW - MARGIN * 2, boxH, time, env.C.panelLine);
  let ty = boxY + 24;
  for (const para of lv.briefing) ty = env.wrapBlock(para, MARGIN + 16, ty, textW, { size: textSize }) + lineH * 0.6;
  ctx.restore();

  const p2 = enterP(env, 2);
  ctx.save();
  ctx.globalAlpha = p2;
  ctx.translate(0, (1 - p2) * 14);
  const afterY = boxY + boxH + 18;
  // 难度提示（呼吸胶囊）
  const diffTxt = `难度 ${env.DIFFICULTIES[env.app.difficulty].name} · ${env.DIFFICULTIES[env.app.difficulty].label}`;
  ctx.save();
  ctx.font = 'bold 11px sans-serif';
  const dw = ctx.measureText(diffTxt).width + 24;
  env.rr(VW / 2 - dw / 2, afterY - 11, dw, 22, 11);
  ctx.fillStyle = 'rgba(255,201,77,0.12)';
  ctx.fill();
  ctx.strokeStyle = `rgba(255,201,77,${0.3 + 0.2 * Math.sin(time * 2.2)})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  env.fillText(diffTxt, VW / 2, afterY + 0.5, { size: 11, color: env.C.gold, align: 'center' });
  // 双人同屏：注明分工（§4.1：P1 建造 · P2 指挥；绿色全息胶囊）
  if (env.app.coop) {
    const coopTxt = '双人同屏 · P1 建造 · P2 指挥';
    ctx.save();
    ctx.font = 'bold 11px sans-serif';
    const cw = ctx.measureText(coopTxt).width + 24;
    env.rr(VW / 2 - cw / 2, afterY + 13, cw, 22, 11);
    ctx.fillStyle = 'rgba(61,240,140,0.12)';
    ctx.fill();
    ctx.strokeStyle = `rgba(61,240,140,${0.3 + 0.2 * Math.sin(time * 2.2)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    env.fillText(coopTxt, VW / 2, afterY + 24.5, { size: 11, color: env.C.green, align: 'center' });
  }

  holoBtn(env, { x: VW / 2 - 100, y: afterY + 42, w: 200, h: 54, label: '▶ 出 击', primary: true, cb: () => env.startBattle() }, time);
  holoBtn(env, { x: VW / 2 - 100, y: afterY + 118, w: 200, h: 46, label: '返回选关', color: env.C.sub, cb: () => { env.stopNarration(); env.goto('home'); } }, time);
  ctx.restore();

  drawOverlays(env, time);
}

// ---------------- 战斗 HUD + prep ----------------

function drawBattleHUD(env: SkinEnv, engine: GameEngine) {
  syncOverlayFlags(env);
  const { ctx, VW } = env;
  const st = engine.state;
  const time = st.clock;

  // 34px 整体悬浮横条：TOP_SAFE 起（已避让胶囊），左右留白 12
  const barX = 12;
  const barY = env.TOP_SAFE;
  const barW = VW - barX * 2;
  const barH = 34;
  const midY = barY + barH / 2;
  holoPanel(env, barX, barY, barW, barH, time, env.C.panelLine, 12);

  // 段宽预量（与 fillText 同字号同字体）
  const resFont = env.RES_FONT();
  const livesTxt = `❤ ${st.lives}`;
  const goldTxt = `◈ ${st.gold}`;
  const waveTxt = `${st.wave}/${st.totalWaves}`;
  ctx.save();
  ctx.font = `bold 12px ${resFont}`;
  const livesW = ctx.measureText(livesTxt).width;
  const goldW = ctx.measureText(goldTxt).width;
  const waveW = ctx.measureText(waveTxt).width;
  ctx.restore();

  // 细分隔线（短）/ 竖分隔线（高，隔指令段）
  const divider = (x: number, tall: boolean) => {
    const dh = tall ? 22 : 14;
    ctx.save();
    ctx.strokeStyle = env.ac(tall ? 0.35 : 0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, midY - dh / 2);
    ctx.lineTo(x, midY + dh / 2);
    ctx.stroke();
    ctx.restore();
  };

  // 状态段：❤ 生命（≤5 时该段闪烁告警）| ◈ 金币 | 波次 + 2px 进度线
  let sx = barX + 14;
  ctx.save();
  if (st.lives <= 5) ctx.globalAlpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 6));
  env.fillText(livesTxt, sx, midY, { size: 12, color: env.C.red, font: resFont });
  ctx.restore();
  sx += livesW + 10;
  divider(sx, false);
  sx += 10;
  env.fillText(goldTxt, sx, midY, { size: 12, color: env.C.gold, font: resFont });
  sx += goldW + 10;
  divider(sx, false);
  sx += 10;
  env.fillText(waveTxt, sx, midY - 2, { size: 12, color: env.C.cyan, font: resFont });
  // 波次进度线：贴波次数字下方，宽与文字同宽
  const progY = midY + 8;
  ctx.save();
  ctx.fillStyle = env.ac(0.15);
  ctx.fillRect(sx, progY, waveW, 2);
  ctx.fillStyle = env.C.cyan;
  ctx.fillRect(sx, progY, waveW * clamp01(st.wave / st.totalWaves), 2);
  ctx.restore();

  // 指令段：三个 30×34 内嵌小按钮（横条内的图标段，非独立大按钮）
  const cmdW = 30;
  const btnsX = barX + barW - 6 - cmdW * 3;
  divider(btnsX - 8, true);
  const cmds: [label: string, active: boolean, color: string, cb: () => void][] = [
    [st.paused ? '▶' : '⏸', st.paused, st.paused ? env.C.gold : env.C.text, () => env.engineCmd({ type: 'TOGGLE_PAUSE' })],
    [st.speed === 2 ? '2x' : '1x', st.speed === 2, st.speed === 2 ? env.C.cyan : env.C.text, () => env.engineCmd({ type: 'SET_SPEED', speed: st.speed === 2 ? 1 : 2 })],
    ['≡', false, env.C.text, () => { env.app.engine = null; env.goto('home'); }],
  ];
  cmds.forEach(([label, active, color, cb], i) => {
    const bx = btnsX + i * cmdW;
    if (active) {
      ctx.save();
      env.rr(bx + 2, barY + 5, cmdW - 4, barH - 10, 8);
      ctx.fillStyle = env.ac(0.18);
      ctx.fill();
      ctx.restore();
    }
    env.fillText(label, bx + cmdW / 2, midY, { size: 13, color, align: 'center' });
    env.hitBox({ x: bx, y: barY, w: cmdW, h: barH, label: '', cb });
  });

  if (st.phase === 'prep') {
    // prep 面板锚在新横条底边下方 8px
    const by2 = barY + barH + 8;
    holoPanel(env, VW / 2 - 118, by2, 236, 56, time, env.C.panelLine, 19);
    // 倒计时 ≤3s 时数字脉冲放大
    const cd = Math.max(0, Math.ceil(st.prepT));
    const urgent = st.prepT <= 3;
    ctx.save();
    if (urgent) {
      const s = 1 + 0.08 * Math.sin(time * 10);
      ctx.translate(VW / 2, by2 + 15);
      ctx.scale(s, s);
      ctx.translate(-VW / 2, -(by2 + 15));
    }
    env.fillText(`第 ${st.wave} 波 · ${cd}s 后来袭`, VW / 2, by2 + 15, { size: 13, align: 'center', color: urgent ? env.C.gold : env.C.text, font: env.RES_FONT() });
    ctx.restore();
    // 下一波敌情预告（数量统计 + BOSS 警示）
    const groups = engine.level.waves[st.wave - 1]?.groups ?? [];
    const isBossWave = engine.level.waves[st.wave - 1]?.isBoss ?? false;
    const summary = [...new Set(groups.map((gsp) => `${env.ENEMIES[gsp.type].name}×${gsp.count}`))].join(' ');
    env.fillText(`${isBossWave ? '⚠ BOSS 波 · ' : ''}${summary}`, VW / 2, by2 + 34, { size: 9, color: isBossWave ? env.C.pink : '#FF9F43', align: 'center', weight: 'normal' });
    env.fillText(
      env.app.coop ? 'P1 建造防线 · P2 把握升级与科技时机' : isBossWave ? '建议留好金币与穿甲火力' : '据此提前调整布防',
      VW / 2, by2 + 47, { size: 9, color: env.C.sub, align: 'center', weight: 'normal' },
    );
    holoBtn(env, { x: VW / 2 - 62, y: by2 + 66, w: 124, h: 36, label: '▶ 立即开战', color: env.C.gold, primary: true, cb: () => env.engineCmd({ type: 'SKIP_PREP' }) }, time);
  }
}

// ---------------- 底部塔栏 / 选中升级出售栏 ----------------

function drawBottomBar(env: SkinEnv, engine: GameEngine) {
  const { ctx, VW, VH, MARGIN, BAR_H } = env;
  const st = engine.state;
  const time = st.clock;
  // 栏底：深玻璃渐变 + 顶部亮线 + 流动数据短划
  ctx.save();
  const bg = ctx.createLinearGradient(0, VH - BAR_H, 0, VH);
  bg.addColorStop(0, 'rgba(13,20,42,0.96)');
  bg.addColorStop(1, 'rgba(8,12,26,0.96)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, VH - BAR_H, VW, BAR_H);
  ctx.strokeStyle = env.ac(0.28);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, VH - BAR_H + 0.5);
  ctx.lineTo(VW, VH - BAR_H + 0.5);
  ctx.stroke();
  ctx.strokeStyle = env.ac(0.5);
  ctx.setLineDash([18, 66]);
  ctx.lineDashOffset = -time * 70;
  ctx.beginPath();
  ctx.moveTo(0, VH - BAR_H + 0.5);
  ctx.lineTo(VW, VH - BAR_H + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  if (st.phase === 'tech') return;

  // 选中炮塔：升级 / 出售
  const sel = env.app.selectedId != null ? st.towers.find((t) => t.id === env.app.selectedId) : undefined;
  if (sel) {
    const def = env.TOWERS[sel.type];
    env.fillText(`${def.name} Lv${sel.level + 1}`, MARGIN + 4, VH - BAR_H + 17, { size: 12, color: def.color });
    const upCost = sel.level < 2 ? def.levels[sel.level + 1].cost : -1;
    holoBtn(env, {
      x: MARGIN, y: VH - BAR_H + 30, w: VW / 2 - MARGIN - 6, h: 46,
      label: upCost >= 0 ? `升级 ◈ ${upCost}` : '已满级', disabled: upCost < 0 || st.gold < upCost,
      color: env.C.green, primary: upCost >= 0 && st.gold >= upCost,
      cb: () => { if (env.engineCmd({ type: 'UPGRADE', id: sel.id })) { env.sfx.play('upgrade'); env.buzz('light'); } },
    }, time);
    const refund = Math.floor(sel.invested * env.SELL_RATE);
    holoBtn(env, {
      x: VW / 2 + 6, y: VH - BAR_H + 30, w: VW / 2 - MARGIN - 6, h: 46, label: `出售 +${refund}`,
      color: '#FF9F43', cb: () => { if (env.engineCmd({ type: 'SELL', id: sel.id })) env.sfx.play('sell'); env.app.selectedId = null; },
    }, time);
    return;
  }

  // 点选放置模式提示
  if (env.app.placing) {
    const def = env.TOWERS[env.app.placing];
    env.fillText(`点击地图上绿色格建造「${def.name}」`, VW / 2, VH - BAR_H + 20, { size: 12, color: def.color, align: 'center' });
    holoBtn(env, { x: VW / 2 - 76, y: VH - BAR_H + 32, w: 152, h: 44, label: '取消放置', cb: () => { env.app.placing = null; } }, time);
    return;
  }

  // 塔栏：槽位几何与默认完全一致（towerSlotAt / barTouch 拖拽建塔依赖），仅重做视觉
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
    // 玻璃槽卡；可用时描边带呼吸辉光（小元素才用 shadowBlur）
    env.rr(bx, by, sw, slotH, 12);
    const gg = ctx.createLinearGradient(bx, by, bx, by + slotH);
    gg.addColorStop(0, 'rgba(24,34,66,0.92)');
    gg.addColorStop(1, 'rgba(13,19,40,0.92)');
    ctx.fillStyle = gg;
    ctx.fill();
    if (!disabled) {
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 5 + 3 * Math.sin(time * 2 + i * 1.3);
    }
    ctx.strokeStyle = disabled ? 'rgba(124,141,176,0.4)' : `${def.color}AA`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 槽内扫描线（各槽错相位）
    ctx.save();
    env.rr(bx, by, sw, slotH, 12);
    ctx.clip();
    const sy = by + ((time * 22 + i * 26) % (slotH + 20)) - 10;
    ctx.fillStyle = env.ac(0.08);
    ctx.fillRect(bx, sy, sw, 5);
    ctx.restore();
    // 炮塔图标（与地图上同款矢量造型；上半区居中，槽加宽后放大）
    ctx.translate(bx + sw / 2, by + 27);
    env.drawTower(ctx, type, 0, 40, Math.sin(time * 1.1) * 0.1, 0, time, { ticks: false });
    ctx.restore();
    // 价格（下半区居中；塔名移至放置提示 / 锁定 toast，槽内不再显示）
    env.fillText(`◈${cost}`, bx + sw / 2, by + 54, { size: 11, color: disabled ? '#C77A34' : env.C.gold, align: 'center' });
    if (locked) {
      // 锁遮罩：半透明压暗 + 锁图标 + 解锁章节
      ctx.save();
      env.rr(bx, by, sw, slotH, 12);
      ctx.fillStyle = 'rgba(7,11,24,0.55)';
      ctx.fill();
      ctx.strokeStyle = env.C.sub;
      ctx.lineWidth = 1.6;
      const lx = bx + sw / 2;
      const ly = by + 25;
      ctx.beginPath();
      ctx.rect(lx - 7, ly - 1, 14, 11);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(lx, ly - 1, 5, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
      env.fillText(`第${env.TOWER_UNLOCK[type]}章`, bx + sw / 2, by + 54, { size: 10, color: env.C.sub, align: 'center' });
    }
  });
  ctx.restore();
  // 两侧渐变暗示可滑动
  if (env.stripMaxScroll > 0) {
    if (env.barScroll > 0) {
      const gl = ctx.createLinearGradient(viewX - 4, 0, viewX + 18, 0);
      gl.addColorStop(0, 'rgba(10,15,32,0.95)');
      gl.addColorStop(1, 'rgba(10,15,32,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(viewX - 4, VH - BAR_H + 4, 22, BAR_H - 8);
    }
    if (env.barScroll < env.stripMaxScroll) {
      const gr = ctx.createLinearGradient(viewX + viewW - 18, 0, viewX + viewW + 4, 0);
      gr.addColorStop(0, 'rgba(10,15,32,0)');
      gr.addColorStop(1, 'rgba(10,15,32,0.95)');
      ctx.fillStyle = gr;
      ctx.fillRect(viewX + viewW - 18, VH - BAR_H + 4, 22, BAR_H - 8);
    }
  }
}

// ---------------- 拖拽建塔幽灵 ----------------

function drawDragGhost(env: SkinEnv, engine: GameEngine, type: TowerType, p: TouchPoint) {
  const { ctx, VW, VH } = env;
  const st = engine.state;
  const def = env.TOWERS[type];
  const gx = Math.floor(env.toMapX(p.x) / CELL);
  const gy = Math.floor(env.toMapY(p.y) / CELL);
  const inMap = gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS;
  const canBuild = inMap
    && engine.map.isBuildable(gx, gy)
    && !st.towers.some((tw) => tw.col === gx && tw.row === gy)
    && st.gold >= def.levels[0].cost;

  if (inMap) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, env.TOP_SAFE - 2, VW, VH - env.BAR_H - env.TOP_SAFE + 2);
    ctx.clip();
    const shk = st.shake > 0 ? Math.min(1.2, st.shake) * 7 : 0;
    ctx.translate(env.mapOX + (Math.random() - 0.5) * shk * 2, env.mapOY + env.getMapPan() + (Math.random() - 0.5) * shk);
    ctx.scale(env.mapScale, env.mapScale);
    const cx = gx * CELL;
    const cy = gy * CELL;
    // 全息落点：淡色填充 + 四角括号（替代整框描边）
    ctx.fillStyle = canBuild ? 'rgba(61,240,140,0.18)' : 'rgba(255,90,90,0.16)';
    ctx.fillRect(cx + 2, cy + 2, CELL - 4, CELL - 4);
    ctx.strokeStyle = canBuild ? env.C.green : env.C.red;
    ctx.lineWidth = 2.5;
    const cl = CELL * 0.24;
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy + 2 + cl); ctx.lineTo(cx + 2, cy + 2); ctx.lineTo(cx + 2 + cl, cy + 2);
    ctx.moveTo(cx + CELL - 2 - cl, cy + 2); ctx.lineTo(cx + CELL - 2, cy + 2); ctx.lineTo(cx + CELL - 2, cy + 2 + cl);
    ctx.moveTo(cx + CELL - 2, cy + CELL - 2 - cl); ctx.lineTo(cx + CELL - 2, cy + CELL - 2); ctx.lineTo(cx + CELL - 2 - cl, cy + CELL - 2);
    ctx.moveTo(cx + 2 + cl, cy + CELL - 2); ctx.lineTo(cx + 2, cy + CELL - 2); ctx.lineTo(cx + 2, cy + CELL - 2 - cl);
    ctx.stroke();
    if (canBuild) {
      // 射程环：旋转虚线（全息锁定感）
      ctx.save();
      ctx.strokeStyle = `${def.color}66`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -st.clock * 24;
      ctx.beginPath();
      ctx.arc(cx + CELL / 2, cy + CELL / 2, def.levels[0].range * CELL, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.85;
      ctx.translate(cx + CELL / 2, cy + CELL / 2);
      env.drawTower(ctx, type, 0, CELL * 0.92, 0, 0, st.clock, { ticks: false });
      ctx.restore();
    }
    ctx.restore();
  }

  // 底部全息提示胶囊
  const msg = canBuild ? '松手建造' : inMap ? '此处不可建造' : '拖到地图空格上';
  const mc = canBuild ? env.C.green : env.C.sub;
  ctx.save();
  ctx.font = 'bold 12px sans-serif';
  const mw = ctx.measureText(msg).width + 30;
  env.rr(VW / 2 - mw / 2, VH - env.BAR_H - 36, mw, 24, 12);
  ctx.fillStyle = 'rgba(10,16,34,0.85)';
  ctx.fill();
  ctx.strokeStyle = `${mc}66`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  env.fillText(msg, VW / 2, VH - env.BAR_H - 23.5, { size: 12, color: mc, align: 'center' });
}

// ---------------- 科技三选一 ----------------

function drawTechOverlay(env: SkinEnv, engine: GameEngine) {
  const { ctx, VW, VH, MARGIN } = env;
  const st = engine.state;
  const time = st.clock;
  ctx.fillStyle = 'rgba(7,11,24,0.92)';
  ctx.fillRect(0, 0, VW, VH);
  holoAtmosphere(env, time);
  env.fillText('TACTICAL MODULE', VW / 2, env.TOP_SAFE + 12, { size: 11, color: env.C.cyan, align: 'center', weight: '600' });
  env.fillText(`第 ${st.wave} 波前 · 选择战术模块`, VW / 2, env.TOP_SAFE + 42, { size: 19, align: 'center' });
  env.fillText(`三选一 · 同名可叠加 · 已装 ${st.techs.length}`, VW / 2, env.TOP_SAFE + 66, { size: 11, color: env.C.sub, align: 'center', weight: 'normal' });
  const taken: Record<string, number> = {};
  for (const t of st.techs) taken[t] = (taken[t] ?? 0) + 1;
  const cardH = 128;
  const top = env.TOP_SAFE + 92;
  st.techChoices!.forEach((id, i) => {
    const y = top + i * (cardH + 16);
    const def = env.TECHS[id];
    // 入场：从屏幕深处由小到大推入（scale 0.7→1 + 淡入，依次延迟）
    const at = (Date.now() - env.getTechShownAt()) / 1000 - 0.1 - i * 0.11;
    const e = easeOut(clamp01(at / 0.45));
    if (e <= 0) return;
    const cx = VW / 2;
    const cy = y + cardH / 2;
    ctx.save();
    ctx.globalAlpha = e;
    ctx.translate(cx, cy);
    ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e);
    ctx.translate(-cx, -cy);
    holoPanel(env, MARGIN, y, VW - MARGIN * 2, cardH, time + i, `${def.color}55`);
    // 图标格（glyph 呼吸微浮动）
    ctx.save();
    env.rr(MARGIN + 16, y + (cardH - 64) / 2, 64, 64, 12);
    ctx.fillStyle = `${def.color}1A`;
    ctx.fill();
    ctx.strokeStyle = `${def.color}88`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    env.fillText(def.glyph, MARGIN + 48, y + cardH / 2 + Math.sin(time * 2.4 + i * 1.7) * 2, { size: 30, color: def.color, align: 'center' });
    // 文字块（标题 + 描述）整体与图标垂直居中对齐
    const tx = MARGIN + 96;
    const textW = VW - MARGIN * 2 - 96 - 16;
    const descLines = env.wrapCount(def.desc, textW, 12);
    const blockH = 24 + descLines * 12 * 1.65;
    const ty0 = y + cardH / 2 - blockH / 2;
    env.fillText(def.name, tx, ty0 + 10, { size: 16, color: def.color });
    if (taken[id]) env.chip(MARGIN + (VW - MARGIN * 2) - 12, y + 22, `已装×${taken[id]}`, def.color);
    env.wrapBlock(def.desc, tx, ty0 + 34, textW, { color: 'rgba(141,160,198,1)', size: 12 });
    ctx.restore();
    env.hitBox({ x: MARGIN, y, w: VW - MARGIN * 2, h: cardH, label: '', cb: () => { if (env.engineCmd({ type: 'PICK_TECH', id })) env.sfx.play('tech'); } });
  });
  env.fillText('点选模块卡 · 装入防线系统', VW / 2, top + 3 * (cardH + 16) + 8, { size: 10, color: env.C.dim, align: 'center', weight: 'normal' });
}

// ---------------- 结算 ----------------

function drawResult(env: SkinEnv, time: number) {
  syncOverlayFlags(env);
  const { ctx, VW } = env;
  env.drawSpaceBg(time);
  holoAtmosphere(env, time);
  const won = env.app.result!.won;
  const st = env.app.engine!.state;
  const oi = env.getOnlineInfo(); // 在线局信息（结算页展示队友/个人击杀用）
  const t = (Date.now() - env.getScreenAt()) / 1000; // 进入结算页的时长（动画驱动）

  // 胜利彩带（无状态：粒子轨迹是 t 的确定函数）
  if (won && t < 3) {
    const r0 = env.rng(99);
    for (let i = 0; i < 56; i++) {
      const x0 = r0() * VW;
      const delay = r0() * 0.6;
      const vy = 130 + r0() * 170;
      const vx = (r0() - 0.5) * 70;
      const size = 3 + r0() * 4;
      const rot = r0() * Math.PI;
      const spin = (r0() - 0.5) * 9;
      const color = [env.C.cyan, env.C.gold, env.C.green, env.C.pink][Math.floor(r0() * 4)];
      const t2 = t - delay;
      if (t2 <= 0) continue;
      ctx.save();
      ctx.globalAlpha = t2 > 2.4 ? Math.max(0, (3 - t2) / 0.6) : 1;
      ctx.translate(x0 + vx * t2, -12 + vy * t2 + 60 * t2 * t2);
      ctx.rotate(rot + spin * t2);
      ctx.fillStyle = color;
      ctx.fillRect(-size / 2, -size / 2, size, size * 0.62);
      ctx.restore();
    }
  }
  // 战败红色边缘晕染
  if (!won) {
    ctx.save();
    ctx.globalAlpha = 0.22 + 0.08 * Math.sin(time * 2);
    const rg = ctx.createRadialGradient(VW / 2, env.VH / 2, Math.min(VW, env.VH) * 0.32, VW / 2, env.VH / 2, Math.max(VW, env.VH) * 0.72);
    rg.addColorStop(0, 'rgba(255,61,90,0)');
    rg.addColorStop(1, 'rgba(255,61,90,0.5)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, VW, env.VH);
    ctx.restore();
  }

  holoHeader(env, time, env.app.coop || oi ? '协同作战结算' : '战斗结算', () => env.goto('home'));
  const y0 = env.TOP_SAFE + 16;
  // 标题回弹入场 + 全息错位残影
  const bt = Math.min(1, t / 0.45);
  const bounce = 1 + 2.7 * (bt - 1) ** 3 + 1.7 * (bt - 1) ** 2;
  ctx.save();
  ctx.translate(VW / 2, y0);
  ctx.scale(bounce, bounce);
  env.fillText(won ? '★ 防线守住了' : '✕ 防线失守', -1.5, 0, { size: 26, color: env.ac(0.5), align: 'center' });
  env.fillText(won ? '★ 防线守住了' : '✕ 防线失守', 0, 0, { size: 26, color: won ? env.C.green : env.C.pink, align: 'center' });
  ctx.restore();
  env.fillText(
    won ? (oi ? '在线协同 · 双子星门' : `第 ${env.app.levelId} 章 · ${env.LEVELS.find((l) => l.id === env.app.levelId)?.name ?? ''}`) : `撑到了第 ${st.wave} / ${st.totalWaves} 波`,
    VW / 2, y0 + 32, { size: 13, color: env.C.sub, align: 'center', weight: 'normal' },
  );

  // 战绩面板（数字滚动递增 + 扫描光周期性扫过）；末行「积分 +N」金色
  const settle = env.getLastSettlement();
  // 在线局：击杀数按个人击杀分账显示
  const myKills = oi ? (st.killsBy?.[oi.player] ?? st.kills) : st.kills;
  const rows: [k: string, v: string, num: number | null, color?: string, plus?: boolean][] = [
    ['击杀', String(myKills), myKills],
    ['漏怪', String(st.leaked), st.leaked],
    ['剩余生命', `${st.lives} / ${st.maxLives}`, null],
    ['赚取金币', String(st.goldEarned), st.goldEarned],
    ['战术模块', String(st.techs.length), st.techs.length],
    ['积分', `+${settle?.score ?? 0}`, settle?.score ?? 0, env.C.gold, true],
  ];
  if (oi) rows.splice(1, 0, ['在线协同', `队友 ${oi.peerNick || '—'}`, null, env.C.cyan]);
  const px = 24;
  const pw = VW - 48;
  const py = y0 + 58;
  const rowH = 34;
  const panelH = rows.length * rowH + 20;
  holoPanel(env, px, py, pw, panelH, time, env.C.panelLine);
  ctx.save();
  env.rr(px, py, pw, panelH, env.RADIUS);
  ctx.clip();
  const sweepT = (t * 0.55) % 1.8;
  if (sweepT < 1) {
    const sx = px - 80 + sweepT * (pw + 160);
    const sgc = ctx.createLinearGradient(sx - 40, 0, sx + 40, 0);
    sgc.addColorStop(0, env.ac(0));
    sgc.addColorStop(0.5, env.ac(0.14));
    sgc.addColorStop(1, env.ac(0));
    ctx.fillStyle = sgc;
    ctx.fillRect(sx - 40, py, 80, panelH);
  }
  ctx.restore();
  rows.forEach(([k, v, num, color, plus], i) => {
    const ry = py + 27 + i * rowH;
    env.fillText(k, px + 22, ry, { size: 13, color: color ?? env.C.sub, weight: 'normal' });
    const shown = num === null ? v : `${plus ? '+' : ''}${Math.round(num * clamp01((t - 0.25 - i * 0.12) / 0.6))}`;
    env.fillText(shown, px + pw - 22, ry, { size: 16, align: 'right', font: env.RES_FONT(), color });
    if (i < rows.length - 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(124,141,176,0.12)';
      ctx.beginPath();
      ctx.moveTo(px + 22, ry + rowH / 2);
      ctx.lineTo(px + pw - 22, ry + rowH / 2);
      ctx.stroke();
      ctx.restore();
    }
  });

  // 战斗评价：S（零漏怪）A（漏 ≤2）B（其余）D（失败）；圆章缩放显影 + 旋转虚线环
  const grade = !won ? 'D' : st.leaked === 0 ? 'S' : st.leaked <= 2 ? 'A' : 'B';
  const gradeColor = grade === 'S' ? env.C.gold : grade === 'A' ? env.C.green : grade === 'B' ? env.C.cyan : env.C.pink;
  const gxp = px + 44;
  const gyp = py + panelH + 46;
  const ge = clamp01((t - 0.9) / 0.35);
  ctx.save();
  ctx.globalAlpha = ge;
  const gs = 1.6 - 0.6 * easeOut(ge);
  ctx.translate(gxp, gyp);
  ctx.scale(gs, gs);
  ctx.strokeStyle = gradeColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([6, 7]);
  ctx.lineDashOffset = -time * 16;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = ge * 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  env.fillText(grade, 0, -1, { size: 30, color: gradeColor, align: 'center', font: env.RES_FONT() });
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = ge;
  env.fillText(['完美防线', '防守好手', '守住防线', '防线失守'][['S', 'A', 'B', 'D'].indexOf(grade)], gxp + 46, gyp - 8, { size: 15, color: gradeColor });
  env.fillText(won ? (oi ? '协同加成 ×1.2 已入账' : '下一章解锁已记录') : '再挑战一次就能通过', gxp + 46, gyp + 12, { size: 10, color: env.C.sub, weight: 'normal' });
  // 军衔进度副文案（满级显示已达最高军衔）
  const rprog = env.getRankProgress();
  env.fillText(
    rprog.next === null
      ? `${rprog.name} · 已达最高军衔`
      : `${rprog.name} · 距「${rprog.nextName}」还差 ${(rprog.next - rprog.points).toLocaleString('en-US')} 分`,
    gxp + 46, gyp + 30, { size: 10, color: env.C.gold, weight: 'normal' },
  );
  ctx.restore();

  // 按钮组（依次延迟入场；与默认行为一致）
  let y = gyp + 48;
  const nextId = env.app.levelId + 1;
  const hasNext = !oi && env.LEVELS.some((l) => l.id === nextId); // 联机协作图不是战役关，无「进入下一章」
  const bp = enterP(env, 3);
  ctx.save();
  ctx.globalAlpha = bp;
  ctx.translate(0, (1 - bp) * 14);
  if (won) {
    // 激励视频广告位（流量主开通后接入 wx.createRewardedVideoAd 实现真翻倍）
    holoBtn(env, { x: px, y, w: pw, h: 44, label: '◈ 双倍战利 · 观看视频', color: env.C.gold, cb: () => env.showToast('广告模块开发中') }, time);
    y += 54;
  }
  if (won && hasNext) {
    holoBtn(env, { x: px, y, w: pw, h: 48, label: `▶ 进入第 ${nextId} 章`, color: env.C.green, primary: true, cb: () => env.gotoBriefing(nextId) }, time);
    y += 58;
  }
  // 炫耀战绩：主动拉起分享，标题带本局成绩（不落库，仅分享卡片 + 埋点）
  holoBtn(env, {
    x: px, y, w: pw, h: 42, label: '📣 炫耀战绩', color: env.C.pink,
    cb: () => {
      env.track('share_click', { channel: 'result', result: won ? 'win' : 'lose', wave: st.wave });
      env.shareAppMessage({
        title: won
          ? `我在《高塔防线》守住了第 ${env.app.levelId} 关 · 全 ${st.totalWaves} 波，漏怪 ${st.leaked}！`
          : `我在《高塔防线》第 ${env.app.levelId} 关撑到了第 ${st.wave} 波，求支援！`,
        imageUrl: 'assets/share-cover.jpg',
      });
    },
  }, time);
  y += 52;
  holoBtn(env, { x: px, y, w: (pw - 12) / 2, h: 42, label: won ? '再来一局' : '再战本关', color: env.C.gold, cb: () => env.gotoBriefing(env.app.levelId) }, time);
  holoBtn(env, { x: px + (pw - 12) / 2 + 12, y, w: (pw - 12) / 2, h: 42, label: '返回选关', cb: () => env.goto('home') }, time);
  ctx.restore();

  drawOverlays(env, time);
}

// ---------------- 设置中心 ----------------

function drawSettings(env: SkinEnv, time = Date.now() / 1000) {
  const { ctx, VW, VH } = env;
  if (!settingsWasOpen) { settingsOpenAt = Date.now(); settingsWasOpen = true; }
  const e = easeOut(clamp01((Date.now() - settingsOpenAt) / 220));
  ctx.fillStyle = 'rgba(7,11,24,0.78)';
  ctx.fillRect(0, 0, VW, VH);
  // 全屏透明热区：吞掉面板外的点击，避免穿透到底层页面（先于面板按钮注册，后注册者优先）
  env.hitBox({ x: 0, y: 0, w: VW, h: VH, label: '', cb: () => {} });
  const pw = VW - 72;
  const px = 36;
  const rowH = 56;
  const rows: [icon: string, label: string, desc: string, on: boolean, cb: () => void][] = [
    ['🔊', '音效', '攻击 / 爆炸 / 金币等战斗音效', !env.sfx.muted, () => env.sfx.setMuted(!env.sfx.muted)],
    ['🎵', '音乐', '主页与战斗背景音乐', !env.musicMuted(), () => env.toggleMusicMuted()],
    ['🎙', '旁白', '任务简报语音解说', !env.narrationMuted(), () => env.toggleNarrationMuted()],
    ['📳', '震动', '建造 / 漏怪 / BOSS 战触感反馈', !env.vibrateMuted(), () => env.toggleVibrateMuted()],
    ['✨', '高画质', 'Bloom 辉光特效，低端机建议关闭', env.readQualityHigh(), () => env.setQualityHigh(!env.readQualityHigh())],
  ];
  const skinH = 74;
  const ph = 72 + rows.length * rowH + skinH + 68;
  const py = VH / 2 - ph / 2;
  // 入场：整体缩放 0.94→1 + 淡入
  ctx.save();
  ctx.globalAlpha = e;
  ctx.translate(VW / 2, VH / 2);
  ctx.scale(0.94 + 0.06 * e, 0.94 + 0.06 * e);
  ctx.translate(-VW / 2, -VH / 2);
  holoPanel(env, px, py, pw, ph, time, env.C.panelLine);
  env.fillText('SETTINGS', VW / 2, py + 24, { size: 9, color: env.ac(0.7), weight: '600', align: 'center' });
  env.fillText('设置中心', VW / 2, py + 46, { size: 17, align: 'center' });
  rows.forEach(([icon, label, desc, on, cb], i) => {
    const y = py + 66 + i * rowH;
    if (i > 0) {
      ctx.save();
      ctx.strokeStyle = env.ac(0.1);
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
    env.hitBox({ x: px + 16, y, w: pw - 32, h: rowH, label: '', cb: () => { cb(); env.buzz('light'); } });
  });
  // 界面皮肤：三套主题色卡，点选即换并持久化
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
    ctx.fillStyle = on ? env.ac(0.18) : 'rgba(90,107,140,0.12)';
    ctx.fill();
    ctx.strokeStyle = on ? s.accent : 'rgba(124,141,176,0.35)';
    ctx.lineWidth = on ? 1.6 : 1;
    ctx.stroke();
    ctx.fillStyle = s.accent;
    ctx.beginPath();
    ctx.arc(cx0 + 13, cy0 + 15, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    env.fillText(s.name, cx0 + 23, cy0 + 15, { size: 11, color: on ? env.C.text : env.C.sub });
    env.hitBox({ x: cx0, y: cy0, w: chipW, h: 30, label: '', cb: () => { env.applySkin(s.id); env.buzz('light'); env.showToast(`已切换「${s.name}」`); } });
  });
  holoBtn(env, { x: px + 24, y: py + 66 + rows.length * rowH + skinH + 12, w: pw - 48, h: 40, label: '关闭', cb: () => env.setShowSettings(false) }, time);
  ctx.restore();
}

// ---------------- 指挥官档案 ----------------

function drawProfile(env: SkinEnv, time = Date.now() / 1000) {
  const { ctx, VW, VH } = env;
  if (!profileWasOpen) { profileOpenAt = Date.now(); profileWasOpen = true; }
  const e = easeOut(clamp01((Date.now() - profileOpenAt) / 220));
  ctx.fillStyle = 'rgba(7,11,24,0.78)';
  ctx.fillRect(0, 0, VW, VH);
  // 吞掉面板外点击（同设置中心）
  env.hitBox({ x: 0, y: 0, w: VW, h: VH, label: '', cb: () => {} });
  const pw = VW - 72;
  const ph = 456;
  const px = 36;
  const py = VH / 2 - ph / 2;
  ctx.save();
  ctx.globalAlpha = e;
  ctx.translate(VW / 2, VH / 2);
  ctx.scale(0.94 + 0.06 * e, 0.94 + 0.06 * e);
  ctx.translate(-VW / 2, -VH / 2);
  holoPanel(env, px, py, pw, ph, time, env.C.panelLine);
  // 头像 + 旋转全息虚线环
  env.drawAvatar(VW / 2, py + 60, 34);
  ctx.save();
  ctx.strokeStyle = env.ac(0.6);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = -time * 20;
  ctx.beginPath();
  ctx.arc(VW / 2, py + 60, 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  env.fillText(env.displayNick(), VW / 2, py + 116, { size: 18, align: 'center' });
  env.fillText(env.commanderRank(), VW / 2, py + 140, { size: 11, color: env.C.gold, align: 'center', weight: 'normal' });

  // 战役进度条（青色→金色渐变 + 前沿光点）
  const cleared = env.loadProgress().cleared.length;
  const bw = pw - 64;
  const bx = px + 32;
  const by = py + 162;
  env.fillText(`战役进度 ${cleared} / ${env.LEVELS.length}`, VW / 2, by - 8, { size: 11, color: env.C.sub, align: 'center', weight: 'normal' });
  env.rr(bx, by + 6, bw, 10, 5);
  ctx.fillStyle = env.ac(0.12);
  ctx.fill();
  if (cleared > 0) {
    const fw = Math.max(10, bw * (cleared / env.LEVELS.length));
    env.rr(bx, by + 6, fw, 10, 5);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, env.C.cyan);
    g.addColorStop(1, env.C.gold);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.shadowColor = env.C.cyan;
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#EAFBFF';
    ctx.beginPath();
    ctx.arc(bx + fw - 5, by + 11, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 军衔积分进度条（琥珀金渐变 + 前沿光点；满级显示已达最高军衔）
  const rp = env.getRankProgress();
  const ry = by + 42;
  env.fillText(
    rp.next === null
      ? `积分 ${rp.points.toLocaleString('en-US')} · 已达最高军衔`
      : `积分 ${rp.points.toLocaleString('en-US')} / ${rp.next.toLocaleString('en-US')} · 距「${rp.nextName}」还差 ${(rp.next - rp.points).toLocaleString('en-US')} 分`,
    VW / 2, ry - 8, { size: 11, color: env.C.sub, align: 'center', weight: 'normal' },
  );
  env.rr(bx, ry + 6, bw, 10, 5);
  ctx.fillStyle = 'rgba(255,201,77,0.12)';
  ctx.fill();
  const frac = rp.next === null ? 1 : Math.min(1, Math.max(0, (rp.points - rp.base) / (rp.next - rp.base)));
  if (frac > 0) {
    const fw2 = Math.max(10, bw * frac);
    env.rr(bx, ry + 6, fw2, 10, 5);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, env.shade(env.C.gold));
    g.addColorStop(1, env.C.gold);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.shadowColor = env.C.gold;
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#FFF3D6';
    ctx.beginPath();
    ctx.arc(bx + fw2 - 5, ry + 11, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 绑定状态行（静默登录成功后有 openid）
  const openid = env.getProfile().openid;
  if (openid) {
    env.fillText(`已绑定 · ${openid.slice(0, 12)}…`, VW / 2, ry + 34, { size: 10, color: env.C.green, align: 'center', weight: 'normal' });
  }

  // 意见反馈（客服会话 → 回退复制邮箱）
  holoBtn(env, { x: px + 24, y: py + 268, w: pw - 48, h: 40, label: '💬 意见反馈', color: env.C.gold, cb: () => env.openFeedback() }, time);
  let y = py + 320;
  if (!env.getProfile().real) {
    holoBtn(env, { x: px + 24, y, w: pw - 48, h: 44, label: '同步微信头像昵称', color: env.C.green, primary: true, cb: () => env.authUser() }, time);
    y += 56;
  }
  holoBtn(env, { x: px + 24, y, w: pw - 48, h: 40, label: '关闭', cb: () => env.setShowProfile(false) }, time);
  ctx.restore();
}

// ---------------- 图鉴（故事 / 炮塔 / 怪物；滚动由 handleTouch 接管） ----------------

function drawCodex(env: SkinEnv, time: number) {
  syncOverlayFlags(env);
  const { ctx, VW, VH, MARGIN } = env;
  env.drawSpaceBg(time);
  holoAtmosphere(env, time);
  holoHeader(env, time, '指挥官图鉴', () => env.goto('home'));

  // 页签（全息分段控件）
  const segY = env.TOP_SAFE + 6;
  holoSeg(
    env, MARGIN, segY, VW - MARGIN * 2,
    env.CODEX_TABS.map((t) => t[1]),
    env.CODEX_TABS.findIndex((t) => t[0] === env.codex.tab),
    'codex',
    (i) => { env.codex.tab = env.CODEX_TABS[i][0]; env.codex.scroll = 0; },
    time,
  );

  // 内容区（可滚动；滚动量由 handleTouch 维护）
  const top = segY + 46;
  const bottom = VH - 22;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, VW, bottom - top);
  ctx.clip();
  const y0 = top + 8 - env.codex.scroll;
  let endY: number;
  if (env.codex.tab === 'story') endY = codexStory(env, y0, time, top, bottom);
  else if (env.codex.tab === 'towers') endY = codexTowers(env, y0, time, top, bottom);
  else endY = codexEnemies(env, y0, time, top, bottom);
  ctx.restore();
  codexMaxScroll = Math.max(0, endY - y0 - (bottom - top) + 20);
  env.codex.scroll = Math.max(0, Math.min(codexMaxScroll, env.codex.scroll));

  // 上下渐变遮罩 + 滚动条
  const fadeH = 16;
  const gf = ctx.createLinearGradient(0, top, 0, top + fadeH);
  gf.addColorStop(0, 'rgba(8,12,26,0.9)');
  gf.addColorStop(1, 'rgba(8,12,26,0)');
  ctx.fillStyle = gf;
  ctx.fillRect(0, top, VW, fadeH);
  const gb = ctx.createLinearGradient(0, bottom - fadeH, 0, bottom);
  gb.addColorStop(0, 'rgba(10,15,36,0)');
  gb.addColorStop(1, 'rgba(10,15,36,0.9)');
  ctx.fillStyle = gb;
  ctx.fillRect(0, bottom - fadeH, VW, fadeH);
  if (codexMaxScroll > 0) {
    const viewH = bottom - top;
    const thumbH = Math.max(30, viewH * (viewH / (viewH + codexMaxScroll)));
    const ty = top + (viewH - thumbH) * (env.codex.scroll / codexMaxScroll);
    ctx.save();
    ctx.fillStyle = env.ac(0.35);
    env.rr(VW - 4, ty, 3, thumbH, 1.5);
    ctx.fill();
    ctx.restore();
  }

  drawOverlays(env, time);
}

function codexStory(env: SkinEnv, y0: number, time: number, top: number, bottom: number): number {
  const { ctx, VW, MARGIN } = env;
  const x = MARGIN;
  const w = VW - MARGIN * 2;
  const textSize = 12;
  const textW = w - 32;
  let totalLines = 0;
  for (const p of env.STORY_PARAS) totalLines += env.wrapCount(p, textW, textSize) + 0.6;
  const boxH = Math.ceil(totalLines * textSize * 1.65) + 46;
  holoPanel(env, x, y0, w, boxH, time, env.C.panelLine);
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
      holoPanel(env, x, y, w, rowH, time + i, unlock ? env.C.panelLine : 'rgba(124,141,176,0.15)', 12);
      env.drawCardArt(x + 8, y + 8, 74, rowH - 16, lv.id, time, 8);
      const tx = x + 94;
      ctx.save();
      if (!unlock) ctx.globalAlpha = 0.45;
      env.fillText(`CHAPTER ${String(lv.id).padStart(2, '0')}`, tx, y + 18, { size: 9, color: env.C.cyan, weight: '600' });
      env.fillText(lv.name, tx, y + 36, { size: 14 });
      env.fillText(lv.sub, tx, y + 52, { size: 10, color: env.C.sub, weight: 'normal' });
      ctx.restore();
      if (done) env.chip(x + w - 12, y + 16, '已通关', env.C.green);
      else if (!unlock) env.chip(x + w - 12, y + 16, '未解锁', env.C.dim);
      if (unlock) env.hitBox({ x, y, w, h: rowH, label: '', cb: () => env.gotoBriefing(lv.id) });
      else env.hitBox({ x, y, w, h: rowH, label: '', cb: () => { env.showToast(`通关「${env.LEVELS[i - 1].name}」后解锁`); env.buzz('light'); } });
    }
    y += rowH + 10;
  });
  return y;
}

function codexTowers(env: SkinEnv, y0: number, time: number, top: number, bottom: number): number {
  const { ctx, VW, MARGIN } = env;
  const x = MARGIN;
  const w = VW - MARGIN * 2;
  let y = y0;
  for (const def of env.TOWER_LIST) {
    const cardH = 134;
    const unlocked = env.towerUnlocked(def.type);
    if (y + cardH > top && y < bottom) {
      holoPanel(env, x, y, w, cardH, time, unlocked ? `${def.color}55` : 'rgba(124,141,176,0.15)');
      // 图标格（满级形态，电磁炮蓄能动画循环演示）
      const ib = 64;
      const ix = x + 14;
      const iy = y + (cardH - ib) / 2;
      ctx.save();
      env.rr(ix, iy, ib, ib, 12);
      ctx.fillStyle = `${def.color}14`;
      ctx.fill();
      ctx.strokeStyle = `${def.color}55`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.clip();
      ctx.translate(ix + ib / 2, iy + ib / 2);
      ctx.globalAlpha = unlocked ? 1 : 0.35;
      const charge = def.charge ? 0.5 + 0.5 * Math.sin(time * 1.4) : 0;
      env.drawTower(ctx, def.type, 2, 46, Math.sin(time * 1.1) * 0.12, charge, time, { ticks: false });
      ctx.restore();
      // 文本区
      const tx = ix + ib + 14;
      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.55;
      env.fillText(def.name, tx, y + 20, { size: 15 });
      env.fillText(def.nameEn, tx, y + 37, { size: 9, color: env.C.dim, weight: '600' });
      env.fillText(def.role, tx, y + 53, { size: 11, color: env.C.sub, weight: 'normal' });
      env.fillText(`伤害 ${def.levels.map((l) => l.damage).join(' → ')} · 射程 ${def.levels.map((l) => l.range).join(' → ')}`, tx, y + 71, { size: 10, weight: 'normal' });
      env.fillText(`射速 ${def.levels.map((l) => l.rate).join(' → ')}/s · 造价 ◈${def.levels[0].cost}`, tx, y + 87, { size: 10, weight: 'normal' });
      env.fillText(`克制 ${def.strong}`, tx, y + 105, { size: 10, color: env.C.green, weight: 'normal' });
      env.fillText(`短板 ${def.weak}`, tx, y + 121, { size: 10, color: env.C.sub, weight: 'normal' });
      ctx.restore();
      env.chip(x + w - 12, y + 17, def.tag, def.color);
      if (!unlocked) {
        env.fillText(`通关第 ${env.TOWER_UNLOCK[def.type]} 章解锁`, x + w - 12, y + cardH - 12, { size: 10, color: env.C.gold, align: 'right' });
      }
    }
    y += cardH + 12;
  }
  return y;
}

function codexEnemies(env: SkinEnv, y0: number, time: number, top: number, bottom: number): number {
  const { ctx, VW, MARGIN } = env;
  const x = MARGIN;
  const w = VW - MARGIN * 2;
  let y = y0;
  for (const def of env.ENEMY_LIST) {
    const textW = w - 92 - 14;
    const descLines = env.wrapCount(def.desc, textW, 10);
    const cardH = Math.ceil(92 + descLines * 13.2 + 22);
    if (y + cardH > top && y < bottom) {
      holoPanel(env, x, y, w, cardH, time, `${def.color}44`);
      // 图标格（活体贴图：缓慢上下游动）
      const ib = 64;
      const ix = x + 14;
      const iy = y + (cardH - ib) / 2;
      ctx.save();
      env.rr(ix, iy, ib, ib, 12);
      ctx.fillStyle = `${def.color}12`;
      ctx.fill();
      ctx.strokeStyle = `${def.color}44`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.clip();
      ctx.translate(ix + ib / 2, iy + ib / 2 + Math.sin(time * 2.2) * 2);
      env.drawEnemy(ctx, def.type, Math.min(21, def.size), time, {});
      ctx.restore();
      // 文本区
      const tx = ix + ib + 14;
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

// ---------------- 轻提示 Toast（全息面板：辉光描边 + 扫描亮条） ----------------

function drawToast(env: SkinEnv) {
  const toast = env.getToast();
  if (!toast) return;
  const { ctx, VW, VH } = env;
  // 寿命与默认实现一致（1.6s，0.15s 淡入 / 0.35s 淡出）；toast 对象由主文件下次 showToast 覆盖
  const t = (Date.now() - toast.at) / 1000;
  if (t > 1.6) return;
  const a = t < 0.15 ? t / 0.15 : t > 1.25 ? (1.6 - t) / 0.35 : 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = 'bold 12px sans-serif';
  const w = ctx.measureText(toast.text).width + 34;
  const x = VW / 2 - w / 2;
  const y = VH * 0.4;
  env.rr(x, y, w, 34, 17);
  ctx.fillStyle = env.skin.panelSolid;
  ctx.fill();
  ctx.save();
  ctx.shadowColor = env.C.cyan;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = env.ac(0.8);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  // 扫描亮条：夹在面板内向右循环扫过
  ctx.save();
  env.rr(x, y, w, 34, 17);
  ctx.clip();
  const sx = x + ((Date.now() / 6) % (w + 40)) - 20;
  const sg = ctx.createLinearGradient(sx - 12, 0, sx + 12, 0);
  sg.addColorStop(0, env.ac(0));
  sg.addColorStop(0.5, env.ac(0.25));
  sg.addColorStop(1, env.ac(0));
  ctx.fillStyle = sg;
  ctx.fillRect(sx - 12, y, 24, 34);
  ctx.restore();
  env.fillText(toast.text, VW / 2, y + 17, { size: 12, color: env.C.gold, align: 'center' });
  ctx.restore();
}

// ---------------- 触摸接管（图鉴滚动 + 按压涟漪捕获） ----------------

function handleTouch(env: SkinEnv, phase: 'start' | 'move' | 'end', p: TouchPoint): boolean {
  if (phase === 'start') {
    // 涟漪中心：记录按压点（全息按钮按压光环用），不消费事件
    pressPt = { x: p.x, y: p.y, at: Date.now() };
    // 图鉴页滚动接管：主文件内置滚动用未暴露的 codexMaxScroll 夹取，模块自行跟踪上限
    if (env.app.screen === 'codex' && !env.showSettings() && !env.showProfile()) {
      codexDrag = { startY: p.y, lastY: p.y, scroll0: env.codex.scroll, acc: 0 };
    }
    return false;
  }
  if (phase === 'move') {
    if (codexDrag && env.app.screen === 'codex') {
      codexDrag.acc += Math.abs(p.y - codexDrag.lastY);
      codexDrag.lastY = p.y;
      env.codex.scroll = Math.max(0, Math.min(codexMaxScroll, codexDrag.scroll0 + (codexDrag.startY - p.y)));
      return true; // 消费：阻止主文件用错误的 max 把 scroll 夹回 0
    }
    return false;
  }
  // end
  pressPt = null;
  if (codexDrag) {
    const dragged = codexDrag.acc > 8;
    codexDrag = null;
    if (dragged) env.consumeTap(); // 拖动不当成点击：仅抑制内置 hooks 点击派发，手势收尾仍走默认
  }
  return false;
}

// ---------------- 模块导出 ----------------

export const abyssSkin: SkinModule = {
  id: 'abyss',
  drawSplashMenu,
  drawHome,
  drawBriefing,
  drawResult,
  drawCodex,
  drawBattleHUD,
  drawBottomBar,
  drawTechOverlay,
  drawSettings,
  drawProfile,
  drawToast,
  drawDragGhost,
  handleTouch,
};
