// 高塔防线 · 微信小游戏版 —— 引擎层直接复用 H5 版（纯 TS 零 DOM）
// UI 层以 Canvas 自绘实现：开场动画 / 选关(带宣传图) / 简报 / 战斗 / 科技三选一 / 结算
import {
  CELL, COLS, ROWS, W, H, TOWERS, ENEMIES, DIFFICULTIES, SELL_RATE, TECHS, TOWER_LIST, ENEMY_LIST,
} from '../../app/src/game/config';
import { LEVELS } from '../../app/src/game/levels';
import { createEngine } from '../../app/src/game/engine';
import {
  drawTower, drawEnemy, drawMapBackground, drawPath, drawBase,
} from '../../app/src/game/render';
import {
  BloomLayer, FxLayer, NebulaBg, setFxPlatform,
  drawBaseGlow, drawStarfield, drawVignette, hash01, readQualityHigh, SPARKS_PER_HIT,
} from '../../app/src/game/fx';
import type { Command, Difficulty, GameEngine, TowerType } from '../../app/src/game/types';
import type { TechId } from '../../app/src/game/types';
import { sfx } from './audio';

// ---------------- 运行环境 ----------------

interface TouchLike { clientX: number; clientY: number }
interface TouchEventLike { touches: TouchLike[]; changedTouches?: TouchLike[] }

interface WxImage {
  src: string; width: number; height: number;
  onload: (() => void) | null; onerror: ((e?: unknown) => void) | null;
}

declare const wx: {
  createCanvas(): HTMLCanvasElement;
  getSystemInfoSync(): { windowWidth: number; windowHeight: number; pixelRatio: number };
  onTouchStart(cb: (e: TouchEventLike) => void): void;
  onTouchMove(cb: (e: TouchEventLike) => void): void;
  onTouchEnd(cb: (e: TouchEventLike) => void): void;
  setStorageSync(key: string, value: unknown): void;
  getStorageSync(key: string): unknown;
  getMenuButtonBoundingClientRect?(): { top: number; bottom: number; left: number; right: number };
  createImage(): WxImage;
  createInnerAudioContext(): {
    src: string; volume: number; autoplay: boolean; obeyMuteSwitch: boolean; loop: boolean;
    play(): void; stop(): void; destroy(): void;
    onError(cb: (e?: unknown) => void): void;
    onCanplay(cb: () => void): void;
  };
  loadSubpackage(o: { name: string; success?: () => void; fail?: (e?: unknown) => void }): void;
  vibrateShort?(o: { type?: 'heavy' | 'medium' | 'light' }): void;
  getUserInfo?(o: {
    success?: (r: { userInfo: { nickName: string; avatarUrl: string } }) => void;
    fail?: (e?: unknown) => void;
  }): void;
};

const canvas = wx.createCanvas();
const info = wx.getSystemInfoSync();
const VW = info.windowWidth;
const VH = info.windowHeight;
const DPR = Math.min(info.pixelRatio ?? 2, 2);
canvas.width = VW * DPR;
canvas.height = VH * DPR;
const ctx = canvas.getContext('2d')!;
ctx.scale(DPR, DPR);

// ---------------- 字体 ----------------
let fontLoaded = false;
try {
  (wx as unknown as {
    loadFontFace(o: { familyName: string; source: string; global?: boolean; success?: () => void; fail?: () => void }): void;
  }).loadFontFace({
    familyName: 'Orbitron',
    source: 'assets/orbitron-700.woff2',
    global: true,
    success: () => { fontLoaded = true; },
    fail: () => { fontLoaded = false; },
  });
} catch { /* ignore */ }
const RES_FONT = () => (fontLoaded ? 'Orbitron, sans-serif' : 'sans-serif');

// 进度持久化（与 H5 版共用键名）
const store = {
  get(key: string): unknown { try { return wx.getStorageSync(key); } catch { return null; } },
  set(key: string, value: unknown) { try { wx.setStorageSync(key, value); } catch { /* ignore */ } },
};
interface ProgressData { cleared: number[] }
function loadProgress(): ProgressData {
  const raw = store.get('srd.progress') as Partial<ProgressData> | undefined;
  return { cleared: Array.isArray(raw?.cleared) ? raw!.cleared : [] };
}
function recordLevelClear(levelId: number) {
  const p = loadProgress();
  if (p.cleared.includes(levelId)) return;
  p.cleared.push(levelId);
  store.set('srd.progress', p);
}

// 画质设置（与 H5 版共用键名）：微信端默认低画质（关闭 Bloom 辉光），档案页可切换
function readWxQualityHigh(): boolean {
  const s = store.get('srd.settings') as { quality?: string } | undefined;
  return s?.quality === 'high';
}
function setWxQualityHigh(high: boolean) {
  store.set('srd.settings', { quality: high ? 'high' : 'low' });
}

// 特效层平台适配：fx.ts 的浏览器 API 全部替换为 wx 等价实现
// 注意：首个 wx.createCanvas() 是屏幕主画布（上方已创建），此后调用均为离屏画布
setFxPlatform({
  createCanvas: () => wx.createCanvas(),
  createImage: () => wx.createImage(),
  readQualityHigh: readWxQualityHigh,
  hardwareConcurrency: () => null, // 微信无核数 API：不硬关 Bloom，交由画质开关控制（默认低画质=关）
  nebulaUrl: () => 'assets/nebula-texture.jpg',
});

// ---------------- 用户信息 ----------------

interface Profile { nick: string; avatarUrl: string; real: boolean }
let profile: Profile = (() => {
  const raw = store.get('srd.profile') as Partial<Profile> | undefined;
  return { nick: raw?.nick ?? '', avatarUrl: raw?.avatarUrl ?? '', real: raw?.real === true };
})();

/** 按通关数授予军衔（未授权微信信息时的默认身份） */
function commanderRank(): string {
  const n = loadProgress().cleared.length;
  if (n >= 13) return '传奇统帅';
  if (n >= 8) return '星环将星';
  if (n >= 4) return '战地指挥官';
  if (n >= 1) return '见习指挥官';
  return '新晋学员';
}
const displayNick = () => (profile.real && profile.nick ? profile.nick : commanderRank());

let avatarImg: ArtImage | null = null;
function loadAvatar() {
  if (avatarImg || !profile.avatarUrl) return;
  const img = wx.createImage();
  const a: ArtImage = { img, ok: false };
  img.onload = () => { a.ok = true; };
  img.onerror = () => { a.ok = false; };
  img.src = profile.avatarUrl;
  avatarImg = a;
}
loadAvatar();

function authUser() {
  try {
    wx.getUserInfo?.({
      success: (r) => {
        profile = { nick: r.userInfo.nickName, avatarUrl: r.userInfo.avatarUrl, real: true };
        store.set('srd.profile', profile);
        avatarImg = null;
        loadAvatar();
      },
      fail: () => { /* 用户拒绝授权，保留军衔身份 */ },
    });
  } catch { /* ignore */ }
}

/** 圆形头像：已授权用微信头像，否则画指挥官徽记 */
function drawAvatar(cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg?.ok) {
    ctx.drawImage(avatarImg.img as unknown as CanvasImageSource, cx - r, cy - r, r * 2, r * 2);
  } else {
    const g = ctx.createRadialGradient(cx, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#1C3D66');
    g.addColorStop(1, '#0A0F20');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // 盾徽：菱形星芒
    ctx.fillStyle = C.cyan;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.52);
    ctx.lineTo(cx + r * 0.34, cy);
    ctx.lineTo(cx, cy + r * 0.52);
    ctx.lineTo(cx - r * 0.34, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#081226';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------------- 视口布局 ----------------

const BAR_H = 122;
// 顶部让位微信胶囊按钮：胶囊底 + 8（内容安全线；战斗 HUD 等用）
const capsule = wx.getMenuButtonBoundingClientRect?.();
const TOP_SAFE = capsule ? Math.ceil(capsule.bottom) + 8 : 96;
// 页头与胶囊同一水平线排布，消除胶囊左侧的空白带
const CAP_MID = capsule ? (capsule.top + capsule.bottom) / 2 : 48;
const CAP_LEFT = capsule ? capsule.left : VW - 94;
// 地图宽度铺满屏幕两侧；高度超出可视区时允许垂直拖动平移
const mapScale = VW / W;
const mapViewH = VH - BAR_H - TOP_SAFE;
const mapH = H * mapScale;
const mapOX = 0;
const mapOY = TOP_SAFE;
// 超高屏（地图不足一屏）时垂直居中；否则初始底对齐，保证基地出口可见
const mapPanMin = Math.min(0, mapViewH - mapH);
let mapPan = mapPanMin === 0 ? (mapViewH - mapH) / 2 : mapPanMin;
const toMapX = (vx: number) => (vx - mapOX) / mapScale;
const toMapY = (vy: number) => (vy - mapOY - mapPan) / mapScale;

// ---------------- 设计规范 ----------------

const C = {
  cyan: '#22E0FF',
  gold: '#FFC94D',
  green: '#3DF08C',
  red: '#FF5A5A',
  pink: '#FF3D81',
  text: '#E8F1FF',
  sub: '#8DA0C6',
  dim: '#5A6B8C',
  panelBg: 'rgba(15,23,46,0.92)',
  panelLine: 'rgba(34,224,255,0.25)',
};
const MARGIN = 16;
const RADIUS = 14;

// ---------------- 简易 UI 框架 ----------------

interface Button {
  x: number; y: number; w: number; h: number; label: string; cb: () => void;
  color?: string; sub?: string; disabled?: boolean; active?: boolean; primary?: boolean;
}
let hooks: Button[] = [];
const btn = (b: Button) => { drawButton(b); hooks.push(b); };
/** 透明命中区（不绘制、只响应点击） */
const hitBox = (b: Button) => { hooks.push(b); };

/** 当前按下的按钮（按压反馈；hooks 每帧重建，按矩形+文案匹配） */
let pressedBtn: Button | null = null;

/** 轻提示 Toast */
let toast: { text: string; at: number } | null = null;
function showToast(text: string) {
  toast = { text, at: Date.now() };
}
function drawToast() {
  if (!toast) return;
  const t = (Date.now() - toast.at) / 1000;
  if (t > 1.6) { toast = null; return; }
  const a = t < 0.15 ? t / 0.15 : t > 1.25 ? (1.6 - t) / 0.35 : 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = 'bold 12px sans-serif';
  const w = ctx.measureText(toast.text).width + 34;
  rr(VW / 2 - w / 2, VH * 0.4, w, 34, 17);
  ctx.fillStyle = 'rgba(15,23,46,0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,201,77,0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  fillText(toast.text, VW / 2, VH * 0.4 + 17, { size: 12, color: C.gold, align: 'center' });
  ctx.restore();
}

interface TouchPoint { x: number; y: number }
const touchPoint = (t: TouchLike): TouchPoint => ({ x: t.clientX, y: t.clientY });
const hit = (p: TouchPoint, r: Button) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

function fillText(str: string, x: number, y: number, o: {
  size?: number; color?: string; align?: CanvasTextAlign; weight?: string; baseline?: CanvasTextBaseline; font?: string;
} = {}) {
  ctx.save();
  ctx.fillStyle = o.color ?? C.text;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'middle';
  ctx.font = `${o.weight ?? 'bold'} ${o.size ?? 14}px ${o.font ?? 'sans-serif'}`;
  ctx.fillText(str, x, y);
  ctx.restore();
}

/** 圆角矩形路径 */
function rr(x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function wrapCount(str: string, w: number, size: number): number {
  return Math.ceil(str.length / Math.max(6, Math.floor(w / size)));
}

function wrapBlock(str: string, x: number, y: number, w: number, o?: { size?: number; color?: string }): number {
  const size = o?.size ?? 13;
  const charsPerLine = Math.max(6, Math.floor(w / size));
  for (let i = 0; i < str.length; i += charsPerLine) {
    fillText(str.slice(i, i + charsPerLine), x, y, { size, color: o?.color ?? 'rgba(232,241,255,0.85)', weight: 'normal' });
    y += size * 1.65;
  }
  return y;
}

function panel(x: number, y: number, w: number, h: number, stroke = C.panelLine, r = RADIUS) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(20,30,58,0.94)');
  g.addColorStop(1, 'rgba(11,17,36,0.94)');
  rr(x, y, w, h, r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function drawButton(b: Button) {
  const c = b.color ?? C.cyan;
  const r = Math.min(10, b.h / 2);
  const pressed = pressedBtn !== null
    && pressedBtn.x === b.x && pressedBtn.y === b.y && pressedBtn.w === b.w && pressedBtn.label === b.label;
  if (pressed) {
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale(0.93, 0.93);
    ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    ctx.globalAlpha = 0.82;
  }
  ctx.save();
  ctx.globalAlpha = b.disabled ? 0.38 : 1;
  rr(b.x, b.y, b.w, b.h, r);
  if (b.primary && !b.disabled) {
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    g.addColorStop(0, c);
    g.addColorStop(1, shade(c));
    ctx.fillStyle = g;
    ctx.fill();
  } else {
    ctx.fillStyle = b.active ? `${c}30` : 'rgba(15,23,46,0.92)';
    ctx.fill();
    ctx.strokeStyle = b.active ? c : `${c}77`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
  if (b.label) {
    const labelColor = b.primary && !b.disabled ? '#081226' : b.active ? c : b.disabled ? '#9AA7C2' : C.text;
    fillText(b.label, b.x + b.w / 2, b.y + (b.sub ? b.h / 2 - 9 : b.h / 2), {
      size: 14, color: labelColor, align: 'center',
    });
    if (b.sub) fillText(b.sub, b.x + b.w / 2, b.y + b.h / 2 + 11, { size: 11, color: b.disabled ? '#C77A34' : C.gold, align: 'center' });
  }
  if (pressed) ctx.restore();
}

/** 主色压暗，用于渐变下端 */
function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * 0.62);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** 分段控件：高亮块随切换平滑滑动，带轻震动 */
const segAnim: Record<string, number> = {};
function segControl(x: number, y: number, w: number, items: string[], activeIdx: number, key: string, onPick: (i: number) => void) {
  panel(x, y, w, 34, 'rgba(255,201,77,0.25)', 17);
  const sw = w / items.length;
  const cur = segAnim[key] ?? activeIdx;
  const next = cur + (activeIdx - cur) * 0.28;
  segAnim[key] = Math.abs(activeIdx - next) < 0.01 ? activeIdx : next;
  ctx.save();
  rr(x + segAnim[key] * sw + 3, y + 3, sw - 6, 28, 14);
  const g = ctx.createLinearGradient(0, y, 0, y + 34);
  g.addColorStop(0, C.gold);
  g.addColorStop(1, shade(C.gold));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  items.forEach((label, i) => {
    fillText(label, x + i * sw + sw / 2, y + 17, { size: 13, color: i === activeIdx ? '#081226' : C.sub, align: 'center' });
    hitBox({ x: x + i * sw, y, w: sw, h: 34, label: '', cb: () => { if (i !== activeIdx) { onPick(i); buzz('light'); } } });
  });
}

/** 状态小徽标 */
function chip(x: number, y: number, text: string, color: string) {
  ctx.save();
  ctx.font = 'bold 10px sans-serif';
  const w = ctx.measureText(text).width + 16;
  rr(x - w, y - 9, w, 18, 9);
  ctx.fillStyle = `${color}22`;
  ctx.fill();
  ctx.strokeStyle = `${color}88`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  fillText(text, x - w / 2, y + 0.5, { size: 10, color, align: 'center' });
}

// ---------------- 统一页头：与胶囊按钮同一水平线，标题 + 返回/图鉴 + 用户信息 + 静音 ----------------

let showProfile = false;

function drawHeader(title: string, opts: { back?: () => void } = {}) {
  const btnS = 36;
  const top = CAP_MID - btnS / 2;
  // 背景条（从胶囊行上缘延伸到内容安全线）+ 底部细线
  ctx.save();
  const g = ctx.createLinearGradient(0, top - 6, 0, TOP_SAFE);
  g.addColorStop(0, 'rgba(10,16,34,0.92)');
  g.addColorStop(1, 'rgba(10,16,34,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, top - 6, VW, TOP_SAFE - top + 6);
  ctx.strokeStyle = 'rgba(34,224,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, TOP_SAFE - 0.5);
  ctx.lineTo(VW, TOP_SAFE - 0.5);
  ctx.stroke();
  ctx.restore();

  // 左：返回（有上级页面）或图鉴入口（主页）
  if (opts.back) {
    btn({ x: MARGIN, y: top, w: btnS, h: btnS, label: '‹', cb: opts.back });
  } else {
    btn({ x: MARGIN, y: top, w: btnS, h: btnS, label: '📖', color: C.gold, cb: () => { codex.scroll = 0; goto('codex'); } });
  }

  // 右：静音 + 用户头像（贴胶囊左侧）
  const muteX = CAP_LEFT - 8 - btnS;
  btn({ x: muteX, y: top, w: btnS, h: btnS, label: musicMuted ? '🔇' : '🔊', cb: toggleMusicMuted });
  const ax = muteX - 8 - 15;
  drawAvatar(ax, CAP_MID, 15);
  hitBox({ x: ax - 17, y: top, w: 34, h: btnS, label: '', cb: () => { showProfile = true; } });

  // 标题：左对齐于返回键右侧，随可用宽度自动缩字号
  const tx = MARGIN + btnS + 12;
  const maxW = ax - 17 - tx - 8;
  let tSize = 16;
  ctx.save();
  while (tSize > 11) {
    ctx.font = `bold ${tSize}px sans-serif`;
    if (ctx.measureText(title).width <= maxW) break;
    tSize--;
  }
  ctx.restore();
  fillText('TOWER LINE DEFENSE', tx, CAP_MID - 11, { size: 9, color: 'rgba(34,224,255,0.7)', weight: '600' });
  fillText(title, tx, CAP_MID + 8, { size: tSize });
}

/** 指挥官档案弹层（画在主页/图鉴之上） */
function drawProfileOverlay() {
  ctx.fillStyle = 'rgba(7,11,24,0.78)';
  ctx.fillRect(0, 0, VW, VH);
  const pw = VW - 72;
  const ph = 372;
  const px = 36;
  const py = VH / 2 - ph / 2;
  panel(px, py, pw, ph, C.panelLine);
  drawAvatar(VW / 2, py + 60, 34);
  fillText(displayNick(), VW / 2, py + 116, { size: 18, align: 'center' });
  fillText(commanderRank(), VW / 2, py + 140, { size: 11, color: C.gold, align: 'center', weight: 'normal' });

  // 战役进度条
  const cleared = loadProgress().cleared.length;
  const bw = pw - 64;
  const bx = px + 32;
  const by = py + 162;
  fillText(`战役进度 ${cleared} / ${LEVELS.length}`, VW / 2, by - 8, { size: 11, color: C.sub, align: 'center', weight: 'normal' });
  rr(bx, by + 6, bw, 10, 5);
  ctx.fillStyle = 'rgba(34,224,255,0.12)';
  ctx.fill();
  if (cleared > 0) {
    rr(bx, by + 6, Math.max(10, bw * (cleared / LEVELS.length)), 10, 5);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, C.cyan);
    g.addColorStop(1, C.gold);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // 画质开关（低画质关闭 Bloom 辉光，战斗内每 30 帧轮询一次生效）
  const qHigh = readWxQualityHigh();
  btn({
    x: px + 24, y: py + 192, w: pw - 48, h: 40,
    label: qHigh ? '画质：高（辉光）' : '画质：低', color: qHigh ? C.cyan : C.sub, active: qHigh,
    cb: () => { setWxQualityHigh(!qHigh); qualityHigh = !qHigh; buzz('light'); },
  });

  let y = py + 246;
  if (!profile.real) {
    btn({
      x: px + 24, y, w: pw - 48, h: 44, label: '同步微信头像昵称', color: C.green, primary: true,
      cb: () => authUser(),
    });
    y += 56;
  }
  btn({ x: px + 24, y, w: pw - 48, h: 40, label: '关闭', cb: () => { showProfile = false; } });
}

// ---------------- 章节宣传图（MiniMax 生成，本地资产） ----------------

interface ArtImage { img: WxImage; ok: boolean }
const ART: Record<number, ArtImage> = {};
function artwork(chapter: number): ArtImage {
  const cached = ART[chapter];
  if (cached) return cached;
  const img = wx.createImage();
  const a: ArtImage = { img, ok: false };
  const file = `assets/lv${String(chapter).padStart(2, '0')}.jpg`;
  let retried = false;
  img.onload = () => { a.ok = true; };
  img.onerror = (e?: unknown) => {
    if (!retried) {
      // 部分开发者工具版本对裸相对路径解析失败，补 './' 重试一次
      retried = true;
      img.src = `./${file}`;
    } else {
      console.error('[SRD] 章节宣传图加载失败:', file, e ?? '');
    }
  };
  img.src = file;
  ART[chapter] = a;
  return a;
}
// 启动即预载全部宣传图，避免进选关页才按需加载出现空窗
LEVELS.forEach((lv) => artwork(lv.id));

// ---------------- 星空与装饰 ----------------

// 固定伪随机（mulberry32）
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star { x: number; y: number; r: number; tw: number; speed: number }
function makeStars(seed: number, n: number, w: number, h: number): Star[] {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({
    x: r() * w, y: r() * h, r: 0.6 + r() * 1.6, tw: r() * Math.PI * 2, speed: 0.8 + r() * 2,
  }));
}
const bgStars = makeStars(41, 70, VW, VH);

function drawStars(time: number, alpha = 1) {
  ctx.save();
  for (const s of bgStars) {
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * s.speed + s.tw));
    ctx.globalAlpha = alpha * tw;
    ctx.fillStyle = C.text;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 页面底色：深空渐变 + 星云 */
function drawSpaceBg(time: number) {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#0B1230');
  g.addColorStop(0.4, '#070B18');
  g.addColorStop(1, '#0A0F24');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, VH);
  const nebR = VW * 0.9;
  const gg = ctx.createRadialGradient(VW * 0.8, VH * 0.1, 0, VW * 0.8, VH * 0.1, nebR);
  gg.addColorStop(0, 'rgba(34,224,255,0.10)');
  gg.addColorStop(0.5, 'rgba(34,224,255,0.05)');
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg;
  ctx.fillRect(0, 0, VW, VH);
  const gg2 = ctx.createRadialGradient(VW * 0.15, VH * 0.75, 0, VW * 0.15, VH * 0.75, nebR * 0.8);
  gg2.addColorStop(0, 'rgba(139,92,246,0.10)');
  gg2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg2;
  ctx.fillRect(0, 0, VW, VH);
  drawStars(time, 0.9);
  // 战术网格
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 1;
  for (let x = 0; x < VW; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VH); ctx.stroke(); }
  for (let y = 0; y < VH; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke(); }
  ctx.restore();
}

// ---------------- 章节配色（宣传图加载失败时的程序化兜底） ----------------

interface ChapterTheme { hue1: string; hue2: string; enemy: keyof typeof ENEMIES; planet: string; ring: string }
const CHAPTER_THEME: ChapterTheme[] = [
  { hue1: '#0E2440', hue2: '#16203A', enemy: 'crawler', planet: '#22E0FF', ring: '#7C8DB0' },
  { hue1: '#331208', hue2: '#40200E', enemy: 'splitter', planet: '#FF9F43', ring: '#FF6B3D' },
  { hue1: '#241040', hue2: '#33154F', enemy: 'boss', planet: '#8B5CF6', ring: '#22E0FF' },
  { hue1: '#1A2A33', hue2: '#20303A', enemy: 'speeder', planet: '#4FD0C8', ring: '#22E0FF' },
  { hue1: '#0F2A2A', hue2: '#10352F', enemy: 'lurker', planet: '#3DF08C', ring: '#B8FF3D' },
  { hue1: '#2A2A12', hue2: '#35351A', enemy: 'tanker', planet: '#FFC94D', ring: '#FF9F43' },
  { hue1: '#120A2E', hue2: '#1C1038', enemy: 'boss', planet: '#8B5CF6', ring: '#FF3D81' },
  { hue1: '#0A2340', hue2: '#0F2E50', enemy: 'lurker', planet: '#22E0FF', ring: '#B8FF3D' },
  { hue1: '#30101E', hue2: '#3D1626', enemy: 'splitter', planet: '#FF3D81', ring: '#8B5CF6' },
  { hue1: '#2E1230', hue2: '#3A1A3D', enemy: 'boss', planet: '#FF3D81', ring: '#22E0FF' },
  { hue1: '#31140F', hue2: '#401C14', enemy: 'tanker', planet: '#FF6B3D', ring: '#FFC94D' },
  { hue1: '#2E0F14', hue2: '#3B1A1C', enemy: 'boss', planet: '#FF3D81', ring: '#FFC94D' },
  { hue1: '#0B0B2E', hue2: '#141440', enemy: 'boss', planet: '#FFC94D', ring: '#FF3D81' },
];

/** 关卡宣传图：优先本地图片，失败时程序化绘制兜底 */
function drawCardArt(x: number, y: number, w: number, h: number, chapter: number, time: number, r = 10) {
  const art = artwork(chapter);
  if (art.ok) {
    // cover-crop 居中 + Ken Burns 缓慢推镜
    const iw = art.img.width > 0 ? art.img.width : 512;
    const ih = art.img.height > 0 ? art.img.height : 768;
    const s = Math.max(w / iw, h / ih) * (1.03 + 0.035 * Math.sin(time * 0.12));
    const dw = iw * s;
    const dh = ih * s;
    ctx.save();
    rr(x, y, w, h, r);
    ctx.clip();
    ctx.drawImage(art.img as unknown as CanvasImageSource, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    // 底部压暗保证前景文字可读
    const g = ctx.createLinearGradient(x, y + h * 0.55, x, y + h);
    g.addColorStop(0, 'rgba(7,11,24,0)');
    g.addColorStop(1, 'rgba(7,11,24,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    return;
  }
  drawCardArtProcedural(x, y, w, h, chapter, time, r);
}

function drawCardArtProcedural(x: number, y: number, w: number, h: number, chapter: number, time: number, r = 10) {
  const th = CHAPTER_THEME[(chapter - 1) % CHAPTER_THEME.length];
  ctx.save();
  rr(x, y, w, h, r);
  ctx.clip();
  // 底色
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, th.hue1);
  g.addColorStop(1, th.hue2);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // 星点
  const stars = CARD_STARS[chapter] ?? (CARD_STARS[chapter] = makeStars(chapter * 97, 16, Math.max(2, w), Math.max(2, h)));
  for (const s of stars) {
    ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(time * 2 + s.tw));
    ctx.fillStyle = C.text;
    ctx.beginPath();
    ctx.arc(x + s.x, y + s.y, s.r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // 星球 + 光环
  const px = x + w * 0.68;
  const py = y + h * 0.42;
  const pr = h * 0.26;
  ctx.save();
  ctx.strokeStyle = `${th.ring}AA`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(px, py, pr * 1.9, pr * 0.62, -0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
  pg.addColorStop(0, `${th.planet}CC`);
  pg.addColorStop(1, '#0A0F20');
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
  // 敌人剪影
  ctx.save();
  ctx.translate(x + w * 0.82, y + h * 0.72);
  drawEnemy(ctx, th.enemy, h * 0.009, time, {});
  ctx.restore();
  // 塔剪影
  ctx.save();
  ctx.translate(x + w * 0.16, y + h * 0.78);
  drawTower(ctx, 'laser', 0, h * 0.5, Math.atan2(-1, 1) + Math.PI / 2, 0, time);
  ctx.restore();
  ctx.restore();
}
const CARD_STARS: Record<number, Star[]> = {};

// ---------------- 应用状态 ----------------

type Screen = 'splash' | 'home' | 'briefing' | 'battle' | 'result' | 'codex';
const app = {
  screen: 'splash' as Screen,
  splashAt: Date.now(),
  difficulty: (loadProgress().cleared.length > 0 ? 'normal' : 'easy') as Difficulty,
  levelId: 1,
  engine: null as GameEngine | null,
  scroll: 0,
  dragY: null as number | null,
  dragAcc: 0,
  placing: null as TowerType | null,
  selectedId: null as number | null,
  result: null as { won: boolean } | null,
  techShownAt: 0,
  techPickedAt: 0,
};

/** 页面切换时间戳（淡入过渡用） */
let screenAt = Date.now();
function goto(s: Screen) {
  if (app.screen === s) return;
  app.screen = s;
  screenAt = Date.now();
}

const TOWER_ORDER: TowerType[] = TOWER_LIST.map((t) => t.type);
// 炮塔随战役进度解锁：通过第 N 章后解锁对应炮塔
const TOWER_UNLOCK: Record<TowerType, number> = {
  laser: 1, missile: 1, frost: 2, railgun: 3, tesla: 5, plasma: 7,
};
const unlockedChapter = () => Math.max(0, ...loadProgress().cleared) + 1;
const towerUnlocked = (t: TowerType) => TOWER_UNLOCK[t] <= unlockedChapter();
const DIFF_LIST: Difficulty[] = ['easy', 'normal', 'hard'];
const engineCmd = (cmd: Command): boolean => (app.engine ? app.engine.dispatch(cmd) : false);

// ---------------- 图鉴状态与世界观文案 ----------------

type CodexTab = 'story' | 'towers' | 'enemies';
const codex = { tab: 'story' as CodexTab, scroll: 0 };
let codexMaxScroll = 0;

const STORY_PARAS = [
  '2242 年，人类在柯伊伯带外沿建起星环殖民地群，依靠轨道护盾与自动炮塔网络维系存亡。湮灭虫群——以恒星能量为食的硅基虫族——撕开了外环预警网，沿引力走廊直扑殖民地。',
  '你是防线指挥官。工程部已在虫群路径两侧清空建造位：激光、导弹、减速、电磁、特斯拉、等离子六系炮塔任你调遣，弹药与能源无限——代价是，没有退路。',
  '每守住一道防线，星环护盾的重启进度就推进一格。十三章战役之后，要么殖民地迎来黎明，要么星环永远沉寂。指挥官，殖民地在你身后。',
];

const ENEMY_CATEGORY: Record<string, string> = {
  normal: '普通', fast: '快速', tank: '重装', special: '特殊', boss: '首领',
};

// ---------------- 战斗触控状态 ----------------

/** 底部塔栏横向滚动偏移 */
let barScroll = 0;
/** 底部塔栏触摸：pending 待定 / scroll 滚动 / drag 拖拽建塔 */
let barTouch: { mode: 'pending' | 'scroll' | 'drag'; type: TowerType | null; unusable: string | null; startX: number; startY: number; lastX: number } | null = null;
/** 拖拽建塔时的手指位置（屏幕坐标） */
let dragPos: TouchPoint | null = null;
/** 地图垂直平移手势 */
let mapTouch: { startY: number; pan0: number } | null = null;
/** 本次战斗触摸的累计位移（抑制误触点击） */
let battleMoved = 0;
/** 科技三选一入场动画时间戳 */
let techShownAt = 0;
/** 漏怪红闪时间戳 */
let leakFlashAt = -9999;

// 塔栏槽位几何
const SLOT_W = 64;
const SLOT_GAP = 8;
const stripContentW = TOWER_ORDER.length * (SLOT_W + SLOT_GAP) - SLOT_GAP;
const stripMaxScroll = Math.max(0, stripContentW - (VW - MARGIN * 2));
/** 命中检测：屏幕坐标是否落在某个塔卡片上，返回塔类型 */
function towerSlotAt(p: TouchPoint): TowerType | null {
  if (p.y < VH - BAR_H) return null;
  for (let i = 0; i < TOWER_ORDER.length; i++) {
    const bx = MARGIN + i * (SLOT_W + SLOT_GAP) - barScroll;
    if (p.x >= bx && p.x <= bx + SLOT_W) return TOWER_ORDER[i];
  }
  return null;
}

// ---------------- 音频分包加载 ----------------

const pkgState: Record<string, 'loading' | 'ok' | 'fail'> = {};
const pkgCbs: Record<string, ((ok: boolean) => void)[]> = {};
function ensurePkg(name: string, cb?: (ok: boolean) => void) {
  const s = pkgState[name];
  if (s === 'ok') { cb?.(true); return; }
  if (s === 'fail') { cb?.(false); return; }
  if (cb) (pkgCbs[name] ??= []).push(cb);
  if (s === 'loading') return;
  pkgState[name] = 'loading';
  try {
    wx.loadSubpackage({
      name,
      success: () => { pkgState[name] = 'ok'; (pkgCbs[name] ?? []).splice(0).forEach((f) => f(true)); },
      fail: (e?: unknown) => {
        pkgState[name] = 'fail';
        console.error('[SRD] 分包加载失败:', name, e ?? '');
        (pkgCbs[name] ?? []).splice(0).forEach((f) => f(false));
      },
    });
  } catch {
    pkgState[name] = 'fail';
    cb?.(false);
  }
}
// 启动即后台预载两个音频分包
ensurePkg('bgm');
ensurePkg('audio');

// ---------------- 背景音乐（音频文件，循环播放） ----------------

interface InnerAudio {
  src: string; volume: number; autoplay: boolean; obeyMuteSwitch: boolean; loop: boolean;
  play(): void; stop(): void; destroy(): void;
  onError(cb: (e?: unknown) => void): void;
  onCanplay(cb: () => void): void;
}

let bgmAc: { ac: InnerAudio; name: string } | null = null;
let musicTarget = ''; // '' 表示不播
let musicMuted = store.get('srd.muted') === '1';

function stopMusic() {
  if (!bgmAc) return;
  try { bgmAc.ac.destroy(); } catch { /* ignore */ }
  bgmAc = null;
}

function playMusic(name: 'home' | 'battle') {
  stopMusic();
  ensurePkg('bgm', (ok) => {
    if (!ok || musicTarget !== name || bgmAc) return;
    try {
      const ac = wx.createInnerAudioContext();
      ac.loop = true;
      ac.autoplay = true;
      ac.obeyMuteSwitch = false;
      ac.volume = name === 'battle' ? 0.5 : 0.45;
      ac.onError((e?: unknown) => console.error('[SRD] BGM 播放失败:', ac.src, e ?? ''));
      ac.onCanplay(() => { try { ac.play(); } catch { /* ignore */ } });
      ac.src = `assets/bgm/bgm-${name}.mp3`;
      bgmAc = { ac, name };
    } catch { /* ignore */ }
  });
}

/** 每帧调用：按当前界面切换音乐（splash 无声，战斗 battle，其余 home） */
function syncMusic() {
  const want = musicMuted ? ''
    : app.screen === 'splash' ? ''
    : app.screen === 'battle' ? 'battle' : 'home';
  if (want === musicTarget) return;
  musicTarget = want;
  if (!want) { stopMusic(); return; }
  playMusic(want);
}

function toggleMusicMuted() {
  musicMuted = !musicMuted;
  sfx.setMuted(musicMuted);
  store.set('srd.muted', musicMuted ? '1' : '0');
  // syncMusic 对 ''→'' 会短路，静音时必须立即停掉当前 BGM
  if (musicMuted) stopMusic();
  musicTarget = ''; // 强制 syncMusic 重新评估
}

/** 触感反馈（不支持的端静默降级） */
function buzz(type: 'heavy' | 'medium' | 'light') {
  try { wx.vibrateShort?.({ type }); } catch { /* ignore */ }
}

// ---------------- 简报旁白（MiniMax TTS 生成的本地音频，缺失时静默降级） ----------------

let narration: { ac: InnerAudio; levelId: number } | null = null;
let narrationMuted = store.get('srd.narrationMuted') === '1';

function stopNarration() {
  if (!narration) return;
  try { narration.ac.destroy(); } catch { /* ignore */ }
  narration = null;
}

function startNarration(levelId: number) {
  stopNarration();
  if (narrationMuted) return;
  ensurePkg('audio', (ok) => {
    if (!ok || narration || narrationMuted) return;
    try {
      const ac = wx.createInnerAudioContext();
      // 顺序敏感：先设 autoplay / 事件，最后设 src（设 src 即开始加载）
      ac.autoplay = true;
      ac.obeyMuteSwitch = false; // 不随手机静音键静默（游戏内有独立开关）
      ac.onError((e?: unknown) => console.error('[SRD] 旁白播放失败:', ac.src, e ?? ''));
      ac.onCanplay(() => { try { ac.play(); } catch { /* ignore */ } });
      ac.src = `assets/audio/lv${String(levelId).padStart(2, '0')}.mp3`;
      narration = { ac, levelId };
    } catch { /* ignore */ }
  });
}

function gotoBriefing(levelId: number) {
  app.levelId = levelId;
  goto('briefing');
  startNarration(levelId);
}

// ---------------- 开场动画 ----------------

function drawSplash(time: number) {
  hooks = [];
  drawSpaceBg(time);
  const t = (Date.now() - app.splashAt) / 1000;
  // 中央星环
  const cx = VW / 2;
  const cy = VH * 0.36;
  const ringR = Math.min(1.6, Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.5) * VW * 0.26 + 8);
  ctx.save();
  ctx.strokeStyle = C.cyan;
  ctx.globalAlpha = Math.min(1, t) * 0.8;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, ringR * 1.7, ringR * 0.42, -0.5, 0, Math.PI * 2);
  ctx.stroke();
  const pg = ctx.createRadialGradient(cx - 12, cy - 12, 4, cx, cy, ringR);
  pg.addColorStop(0, '#1C3D66');
  pg.addColorStop(0.7, '#0D1836');
  pg.addColorStop(1, '#070B18');
  ctx.globalAlpha = Math.min(1, t * 1.6);
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.fill();
  // 盾徽激光
  ctx.globalAlpha = Math.min(1, Math.max(0, t - 0.35)) * (0.7 + 0.3 * Math.sin(t * 4));
  ctx.strokeStyle = C.cyan;
  ctx.shadowColor = C.cyan; ctx.shadowBlur = 16;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(cx, cy - ringR * 1.6); ctx.lineTo(cx, cy + ringR * 0.9); ctx.stroke();
  ctx.restore();

  // 标题渐显
  const fade = Math.min(1, Math.max(0, (t - 0.5) / 0.8));
  ctx.globalAlpha = fade;
  fillText('TOWER LINE DEFENSE', VW / 2, cy + ringR * 1.15, { size: 13, color: C.cyan, align: 'center', weight: '600' });
  const titleSize = Math.min(30, VW * 0.082);
  fillText('高 塔 防 线', VW / 2, cy + ringR * 1.15 + 34, { size: titleSize, align: 'center' });
  fillText('TACTICAL TOWER DEFENSE', VW / 2, cy + ringR * 1.15 + 58, { size: 10, color: C.sub, align: 'center' });
  ctx.globalAlpha = 1;

  // 点击提示（1s 后）
  if (t > 1.0) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 3.4);
    fillText('— 点击开始巡逻 —', VW / 2, cy + ringR * 1.15 + 92, {
      size: 13, color: `rgba(255,201,77,${pulse})`, align: 'center',
    });
  }
  hitBox({ x: 0, y: 0, w: VW, h: VH, label: '', cb: () => goto('home') });
}

// ---------------- 主页：选关 + 难度 ----------------

const CARD_H = 116;
const CARD_GAP = 12;
const homeTop = TOP_SAFE + 48;
const homeBottom = VH - 26;
const totalScrollMax = () => Math.max(0, LEVELS.length * (CARD_H + CARD_GAP) - (homeBottom - homeTop) + 8);

function drawHome(time: number) {
  hooks = [];
  drawSpaceBg(time);

  drawHeader('高塔防线 · 战役选择');

  // 难度分段控件（高亮块滑动动画 + 轻震动）
  const segW = VW - MARGIN * 2;
  const segY = TOP_SAFE + 4;
  segControl(MARGIN, segY, segW, DIFF_LIST.map((d) => DIFFICULTIES[d].name), DIFF_LIST.indexOf(app.difficulty), 'diff', (i) => { app.difficulty = DIFF_LIST[i]; });

  // 关卡卡片列表（可滚动）
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, homeTop, VW, homeBottom - homeTop);
  ctx.clip();
  const cleared = loadProgress().cleared;
  const cardX = MARGIN;
  const cardW = VW - MARGIN * 2;
  LEVELS.forEach((lv, i) => {
    const unlock = i === 0 || cleared.includes(LEVELS[i - 1].id);
    const done = cleared.includes(lv.id);
    const y = homeTop + 8 + i * (CARD_H + CARD_GAP) - app.scroll;
    if (y + CARD_H < homeTop || y > homeBottom) return;

    // 卡底
    panel(cardX, y, cardW, CARD_H, unlock ? C.panelLine : 'rgba(124,141,176,0.15)');
    // 宣传图（左侧圆角缩略图）
    const artX = cardX + 8;
    const artY = y + 8;
    const artW = 82;
    const artH = CARD_H - 16;
    drawCardArt(artX, artY, artW, artH, lv.id, time);
    if (!unlock) {
      ctx.save();
      rr(artX, artY, artW, artH, 10);
      ctx.fillStyle = 'rgba(7,11,24,0.55)';
      ctx.fill();
      ctx.restore();
    }

    // 信息区
    const tx = artX + artW + 12;
    ctx.save();
    if (!unlock) ctx.globalAlpha = 0.45;
    fillText(`CHAPTER ${String(lv.id).padStart(2, '0')}`, tx, y + 20, { size: 10, color: C.cyan, weight: '600' });
    fillText(lv.name, tx, y + 44, { size: 17 });
    fillText(lv.sub, tx, y + 66, { size: 11, color: C.sub, weight: 'normal' });
    const bossTxt = lv.waves.filter((w) => w.isBoss).map((w) => `W${w.wave}`).join(' ');
    fillText(`${lv.waves.length} 波 · BOSS ${bossTxt || '—'}`, tx, y + 88, { size: 10, color: C.dim, weight: 'normal' });
    ctx.restore();

    // 右上状态徽标
    if (done) chip(cardX + cardW - 12, y + 18, '已通关', C.green);
    else if (!unlock) chip(cardX + cardW - 12, y + 18, '未解锁', C.dim);

    // CTA / 锁
    if (unlock) {
      btn({
        x: cardX + cardW - 92, y: y + CARD_H - 50, w: 80, h: 38,
        label: done ? '重玩' : '出击', color: done ? C.green : C.cyan, primary: !done,
        cb: () => gotoBriefing(lv.id),
      });
      // 整卡可点（透明命中区盖在上层，CTA 之后注册以让整卡兜底）
      hitBox({ x: cardX, y, w: cardW - 104, h: CARD_H, label: '', cb: () => gotoBriefing(lv.id) });
    } else {
      // 锁图标
      const lx = cardX + cardW - 52;
      const ly = y + CARD_H - 34;
      ctx.save();
      ctx.strokeStyle = C.dim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(lx - 9, ly - 2, 18, 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(lx, ly - 2, 6, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
      // 锁定卡点击提示解锁条件
      hitBox({
        x: cardX, y, w: cardW, h: CARD_H, label: '',
        cb: () => { showToast(`通关「${LEVELS[i - 1].name}」后解锁`); buzz('light'); },
      });
    }
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
  const smax = totalScrollMax();
  if (smax > 0) {
    const viewH = homeBottom - homeTop;
    const thumbH = Math.max(30, viewH * (viewH / (viewH + smax)));
    const ty = homeTop + (viewH - thumbH) * (app.scroll / smax);
    ctx.save();
    ctx.fillStyle = 'rgba(34,224,255,0.25)';
    rr(VW - 4, ty, 3, thumbH, 1.5);
    ctx.fill();
    ctx.restore();
  }

  fillText('微信小游戏 · 试运营包', VW / 2, VH - 12, { size: 10, color: 'rgba(124,141,176,0.7)', align: 'center' });

  if (showProfile) drawProfileOverlay();
}


// ---------------- 简报 ----------------

function drawBriefing(time: number) {
  hooks = [];
  drawSpaceBg(time);
  const lv = LEVELS.find((l) => l.id === app.levelId) ?? LEVELS[0];

  drawHeader('任务简报', { back: () => { stopNarration(); goto('home'); } });

  // 顶部宣传横幅
  const bannerH = Math.min(168, Math.round(VW * 0.45));
  const bx = MARGIN;
  const bw = VW - MARGIN * 2;
  const by = TOP_SAFE + 6;
  drawCardArt(bx, by, bw, bannerH, lv.id, time, RADIUS);
  ctx.save();
  rr(bx, by, bw, bannerH, RADIUS);
  ctx.strokeStyle = C.panelLine;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // 标题压暗带
  const g = ctx.createLinearGradient(bx, by + bannerH * 0.4, bx, by + bannerH);
  g.addColorStop(0, 'rgba(7,11,24,0)');
  g.addColorStop(1, 'rgba(7,11,24,0.82)');
  rr(bx, by, bw, bannerH, RADIUS);
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(bx, by, bw, bannerH);
  ctx.restore();
  fillText(`第 ${lv.id} 章`, bx + 16, by + bannerH - 44, { size: 11, color: C.cyan, weight: '600' });
  fillText(lv.name, bx + 16, by + bannerH - 20, { size: 19 });
  fillText(lv.sub, bx + bw - 16, by + bannerH - 20, { size: 11, color: C.sub, align: 'right', weight: 'normal' });
  // 旁白开关（带文字，与页头的全局音乐/音效静音区分开）
  btn({
    x: bx + bw - 88, y: by + 10, w: 78, h: 30,
    label: narrationMuted ? '🔇 旁白' : '🔊 旁白', color: narrationMuted ? C.sub : C.cyan,
    cb: () => {
      narrationMuted = !narrationMuted;
      store.set('srd.narrationMuted', narrationMuted ? '1' : '0');
      if (narrationMuted) stopNarration();
      else startNarration(app.levelId);
    },
  });

  // 简报卡片（行数测量与绘制共用同一字号，防溢出）
  const textSize = 12;
  const lineH = textSize * 1.65;
  const textW = VW - MARGIN * 2 - 32;
  let totalLines = 0;
  for (const para of lv.briefing) totalLines += wrapCount(para, textW, textSize) + 0.6;
  const boxY = by + bannerH + 12;
  const boxH = Math.ceil(totalLines * lineH) + 26;
  panel(MARGIN, boxY, VW - MARGIN * 2, boxH, C.panelLine);
  let ty = boxY + 24;
  for (const para of lv.briefing) ty = wrapBlock(para, MARGIN + 16, ty, textW, { size: textSize }) + lineH * 0.6;

  const afterY = boxY + boxH + 18;
  // 难度提示
  const diffTxt = `难度 ${DIFFICULTIES[app.difficulty].name} · ${DIFFICULTIES[app.difficulty].label}`;
  ctx.save();
  ctx.font = 'bold 11px sans-serif';
  const dw = ctx.measureText(diffTxt).width + 24;
  rr(VW / 2 - dw / 2, afterY - 11, dw, 22, 11);
  ctx.fillStyle = 'rgba(255,201,77,0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,201,77,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  fillText(diffTxt, VW / 2, afterY + 0.5, { size: 11, color: C.gold, align: 'center' });

  btn({ x: VW / 2 - 100, y: afterY + 42, w: 200, h: 54, label: '▶ 出 击', primary: true, cb: startBattle });
  btn({ x: VW / 2 - 100, y: afterY + 118, w: 200, h: 46, label: '返回选关', color: C.sub, cb: () => { stopNarration(); goto('home'); } });
}

// ---------------- 战斗视觉特效（与 H5 版共用 app/src/game/fx.ts） ----------------

// 星云底图：异步加载，未就绪时 drawMapBackground 自动回退程序化深色底
const nebulaBg = new NebulaBg('assets/nebula-texture.jpg');
// 每场战斗重建（随 engine 生命周期），击杀检测与 H5 一致：diff 敌人列表
let fx: FxLayer | null = null;
let bloom: BloomLayer | null = null;
let pathPixels: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [];
let qualityHigh = readWxQualityHigh(); // 低频轮询存储，避免每帧读 storage
let fxFrame = 0;

function startBattle() {
  stopNarration();
  app.engine = createEngine(app.difficulty, app.levelId);
  app.placing = null;
  app.selectedId = null;
  app.result = null;
  barScroll = 0;
  fx = new FxLayer();
  bloom = new BloomLayer(W, H);
  pathPixels = app.engine.map.paths.map((p) => p.pixels);
  goto('battle');
}

// ---------------- 战斗 ----------------

function drawBattle() {
  hooks = [];
  ctx.fillStyle = '#070B18';
  ctx.fillRect(0, 0, VW, VH); // 整屏清底，避免顶部安全区残留上一帧内容
  const engine = app.engine!;
  const st = engine.state;

  drawBattleScene();

  // 顶部 HUD（位于胶囊下方安全区）：左面板 + 右侧三个方形按钮，垂直居中对齐
  const hudY = TOP_SAFE;
  const btnSize = 40;
  const btnGap = 8;
  const btnsW = btnSize * 3 + btnGap * 2;
  const px = 12;
  const pw = VW - px - btnsW - 20;
  panel(px, hudY, pw, 44, C.panelLine, 12);
  fillText(`❤ ${st.lives}`, px + 16, hudY + 22, { size: 14, color: C.red, font: RES_FONT() });
  fillText(`◈ ${st.gold}`, px + 92, hudY + 22, { size: 14, color: C.gold, font: RES_FONT() });
  fillText(`${st.wave}/${st.totalWaves} 波`, px + pw - 14, hudY + 22, { size: 12, color: C.cyan, align: 'right', font: RES_FONT() });
  const bxs = VW - 12 - btnsW;
  btn({ x: bxs, y: hudY + 2, w: btnSize, h: btnSize, label: st.paused ? '▶' : '⏸', cb: () => engineCmd({ type: 'TOGGLE_PAUSE' }) });
  btn({ x: bxs + btnSize + btnGap, y: hudY + 2, w: btnSize, h: btnSize, label: st.speed === 2 ? '2x' : '1x', active: st.speed === 2, cb: () => engineCmd({ type: 'SET_SPEED', speed: st.speed === 2 ? 1 : 2 }) });
  btn({ x: bxs + (btnSize + btnGap) * 2, y: hudY + 2, w: btnSize, h: btnSize, label: '≡', cb: () => { app.engine = null; goto('home'); } });

  if (st.phase === 'prep') {
    const by2 = hudY + 56;
    panel(VW / 2 - 118, by2, 236, 56, C.panelLine, 19);
    fillText(`第 ${st.wave} 波 · ${Math.max(0, Math.ceil(st.prepT))}s 后来袭`, VW / 2, by2 + 15, { size: 13, align: 'center', font: RES_FONT() });
    // 下一波敌情预告（数量统计 + BOSS 警示）
    const groups = engine.level.waves[st.wave - 1]?.groups ?? [];
    const isBossWave = engine.level.waves[st.wave - 1]?.isBoss ?? false;
    const summary = [...new Set(groups.map(g => `${ENEMIES[g.type].name}×${g.count}`))].join(' ');
    const cCol = isBossWave ? C.pink : '#FF9F43';
    fillText(`${isBossWave ? '⚠ BOSS 波 · ' : ''}${summary}`, VW / 2, by2 + 34, { size: 9, color: isBossWave ? C.pink : '#FF9F43', align: 'center', weight: 'normal' });
    fillText(isBossWave ? '建议留好金币与穿甲火力' : '据此提前调整布防', VW / 2, by2 + 47, { size: 9, color: C.sub, align: 'center', weight: 'normal' });
    btn({ x: VW / 2 - 62, y: by2 + 66, w: 124, h: 36, label: '▶ 立即开战', color: C.gold, primary: true, cb: () => engineCmd({ type: 'SKIP_PREP' }) });
  }

  drawBottomBar(st);

  // 拖拽建塔幽灵预览
  if (barTouch?.mode === 'drag' && dragPos && barTouch.type) drawDragGhost(st, barTouch.type, dragPos);

  if (st.paused) {
    ctx.fillStyle = 'rgba(7,11,24,0.6)';
    ctx.fillRect(0, 0, VW, VH);
    const pw2 = 220;
    const ph2 = 84;
    const px2 = VW / 2 - pw2 / 2;
    const py2 = (VH - BAR_H) / 2 - ph2 / 2;
    panel(px2, py2, pw2, ph2, 'rgba(255,201,77,0.5)');
    fillText('已暂停', VW / 2, py2 + 30, { size: 16, color: C.gold, align: 'center' });
    fillText('点击 ▶ 继续战斗', VW / 2, py2 + 58, { size: 12, color: C.sub, align: 'center', weight: 'normal' });
  }

  // 漏怪红色边缘闪光
  const lt = (Date.now() - leakFlashAt) / 550;
  if (lt < 1) {
    ctx.save();
    ctx.globalAlpha = (1 - lt) * 0.45;
    const rg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.3, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
    rg.addColorStop(0, 'rgba(255,61,90,0)');
    rg.addColorStop(1, 'rgba(255,61,90,0.55)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }

  if (st.phase === 'tech' && st.techChoices) {
    if (!techShownAt) techShownAt = Date.now();
    drawTechOverlay(st);
  } else {
    techShownAt = 0;
  }
}

// ---------------- 拖拽建塔 ----------------

function drawDragGhost(st: NonNullable<GameEngine>['state'], type: TowerType, p: TouchPoint) {
  const engine = app.engine!;
  const def = TOWERS[type];
  const gx = Math.floor(toMapX(p.x) / CELL);
  const gy = Math.floor(toMapY(p.y) / CELL);
  const inMap = gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS;
  const canBuild = inMap
    && engine.map.isBuildable(gx, gy)
    && !st.towers.some((tw) => tw.col === gx && tw.row === gy)
    && st.gold >= def.levels[0].cost;

  if (inMap) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TOP_SAFE - 2, VW, VH - BAR_H - TOP_SAFE + 2);
    ctx.clip();
    const shk = st.shake > 0 ? Math.min(1.2, st.shake) * 7 : 0;
    ctx.translate(mapOX + (Math.random() - 0.5) * shk * 2, mapOY + mapPan + (Math.random() - 0.5) * shk);
    ctx.scale(mapScale, mapScale);
    const cx = gx * CELL;
    const cy = gy * CELL;
    ctx.fillStyle = canBuild ? 'rgba(61,240,140,0.22)' : 'rgba(255,90,90,0.20)';
    ctx.strokeStyle = canBuild ? C.green : C.red;
    ctx.lineWidth = 2;
    ctx.fillRect(cx + 2, cy + 2, CELL - 4, CELL - 4);
    ctx.strokeRect(cx + 2, cy + 2, CELL - 4, CELL - 4);
    if (canBuild) {
      // 射程环 + 塔预览
      ctx.strokeStyle = `${def.color}55`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx + CELL / 2, cy + CELL / 2, def.levels[0].range * CELL, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.translate(cx + CELL / 2, cy + CELL / 2);
      drawTower(ctx, type, 0, CELL * 0.92, 0, 0, st.clock, { ticks: false });
      ctx.restore();
    }
    ctx.restore();
  }

  // 底部提示文案
  fillText(
    canBuild ? '松手建造' : inMap ? '此处不可建造' : '拖到地图空格上',
    VW / 2, VH - BAR_H - 18, { size: 12, color: canBuild ? C.green : C.sub, align: 'center' },
  );
}

function drawBottomBar(st: NonNullable<GameEngine>['state']) {
  ctx.fillStyle = '#0A0F20';
  ctx.fillRect(0, VH - BAR_H, VW, BAR_H);
  ctx.strokeStyle = 'rgba(34,224,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(0, VH - BAR_H + 0.5);
  ctx.lineTo(VW, VH - BAR_H + 0.5);
  ctx.stroke();

  if (st.phase === 'tech') return;

  const sel = app.selectedId != null ? st.towers.find((t) => t.id === app.selectedId) : undefined;
  if (sel) {
    const def = TOWERS[sel.type];
    fillText(`${def.name} Lv${sel.level + 1}`, MARGIN + 4, VH - BAR_H + 20, { size: 14, color: def.color });
    const upCost = sel.level < 2 ? TOWERS[sel.type].levels[sel.level + 1].cost : -1;
    btn({
      x: MARGIN, y: VH - BAR_H + 42, w: VW / 2 - MARGIN - 6, h: 52,
      label: upCost >= 0 ? `升级 ◈ ${upCost}` : '已满级', disabled: upCost < 0 || st.gold < upCost,
      color: C.green, primary: upCost >= 0 && st.gold >= upCost,
      cb: () => { if (engineCmd({ type: 'UPGRADE', id: sel.id })) { sfx.play('upgrade'); buzz('light'); } },
    });
    const refund = Math.floor(sel.invested * SELL_RATE);
    btn({
      x: VW / 2 + 6, y: VH - BAR_H + 42, w: VW / 2 - MARGIN - 6, h: 52, label: `出售 +${refund}`,
      color: '#FF9F43', cb: () => { if (engineCmd({ type: 'SELL', id: sel.id })) sfx.play('sell'); app.selectedId = null; },
    });
    return;
  }

  if (app.placing) {
    const def = TOWERS[app.placing];
    fillText(`点击地图上绿色格建造「${def.name}」`, VW / 2, VH - BAR_H + 24, { size: 13, color: def.color, align: 'center' });
    btn({ x: VW / 2 - 76, y: VH - BAR_H + 48, w: 152, h: 48, label: '取消放置', cb: () => { app.placing = null; } });
    return;
  }

  // 塔栏：固定槽宽，超出屏幕时允许左右滑动
  const sw = SLOT_W;
  const slotH = BAR_H - 24;
  const viewX = MARGIN;
  const viewW = VW - MARGIN * 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(viewX - 4, VH - BAR_H + 4, viewW + 8, BAR_H - 8);
  ctx.clip();
  TOWER_ORDER.forEach((type, i) => {
    const def = TOWERS[type];
    const cost = def.levels[0].cost;
    const locked = !towerUnlocked(type);
    const bx = viewX + i * (sw + SLOT_GAP) - barScroll;
    const by = VH - BAR_H + 12;
    if (bx + sw < viewX - 4 || bx > viewX + viewW + 4) return;
    const disabled = locked || st.gold < cost;
    ctx.save();
    ctx.globalAlpha = disabled ? 0.55 : 1;
    rr(bx, by, sw, slotH, 12);
    const g = ctx.createLinearGradient(bx, by, bx, by + slotH);
    g.addColorStop(0, 'rgba(28,40,76,0.96)');
    g.addColorStop(1, 'rgba(16,24,48,0.96)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = disabled ? 'rgba(124,141,176,0.4)' : `${def.color}AA`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // 炮塔图标（与地图上同款矢量造型；关闭外围刻度环，炮口朝上轻微摆动）
    ctx.translate(bx + sw / 2, by + 27);
    drawTower(ctx, type, 0, 30, Math.sin(st.clock * 1.1) * 0.1, 0, st.clock, { ticks: false });
    ctx.restore();
    fillText(def.name, bx + sw / 2, by + 56, { size: 12, color: disabled ? '#9AA7C2' : C.text, align: 'center' });
    fillText(`◈${cost}`, bx + sw / 2, by + 74, { size: 11, color: disabled ? '#C77A34' : C.gold, align: 'center' });
    if (locked) {
      // 锁遮罩：半透明压暗 + 锁图标 + 解锁章节
      ctx.save();
      rr(bx, by, sw, slotH, 12);
      ctx.fillStyle = 'rgba(7,11,24,0.55)';
      ctx.fill();
      ctx.strokeStyle = C.sub;
      ctx.lineWidth = 1.6;
      const lx = bx + sw / 2;
      const ly = by + 26;
      ctx.beginPath();
      ctx.rect(lx - 7, ly - 1, 14, 11);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(lx, ly - 1, 5, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
      fillText(`第${TOWER_UNLOCK[type]}章`, bx + sw / 2, by + 74, { size: 10, color: C.sub, align: 'center' });
    }
  });
  ctx.restore();
  // 两侧渐变暗示可滑动
  if (stripMaxScroll > 0) {
    if (barScroll > 0) {
      const gl = ctx.createLinearGradient(viewX - 4, 0, viewX + 18, 0);
      gl.addColorStop(0, 'rgba(10,15,32,0.95)');
      gl.addColorStop(1, 'rgba(10,15,32,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(viewX - 4, VH - BAR_H + 4, 22, BAR_H - 8);
    }
    if (barScroll < stripMaxScroll) {
      const gr = ctx.createLinearGradient(viewX + viewW - 18, 0, viewX + viewW + 4, 0);
      gr.addColorStop(0, 'rgba(10,15,32,0)');
      gr.addColorStop(1, 'rgba(10,15,32,0.95)');
      ctx.fillStyle = gr;
      ctx.fillRect(viewX + viewW - 18, VH - BAR_H + 4, 22, BAR_H - 8);
    }
  }
}

// ---------------- 科技三选一 ----------------

function drawTechOverlay(st: NonNullable<GameEngine>['state']) {
  ctx.fillStyle = 'rgba(7,11,24,0.92)';
  ctx.fillRect(0, 0, VW, VH);
  fillText('TACTICAL MODULE', VW / 2, TOP_SAFE + 12, { size: 11, color: C.cyan, align: 'center', weight: '600' });
  fillText(`第 ${st.wave} 波前 · 选择战术模块`, VW / 2, TOP_SAFE + 42, { size: 19, align: 'center' });
  fillText(`三选一 · 同名可叠加 · 已装 ${st.techs.length}`, VW / 2, TOP_SAFE + 66, { size: 11, color: C.sub, align: 'center', weight: 'normal' });
  const taken: Record<string, number> = {};
  for (const t of st.techs) taken[t] = (taken[t] ?? 0) + 1;
  const cardH = 128;
  const top = TOP_SAFE + 92;
  st.techChoices!.forEach((id: TechId, i: number) => {
    const y = top + i * (cardH + 16);
    const def = TECHS[id];
    // 入场动画：依次上滑淡入
    const at = (Date.now() - techShownAt) / 1000 - i * 0.09;
    const ease = Math.min(1, Math.max(0, at / 0.3));
    const eo = 1 - (1 - ease) ** 3;
    ctx.save();
    ctx.globalAlpha = eo;
    ctx.translate(0, (1 - eo) * 26);
    panel(MARGIN, y, VW - MARGIN * 2, cardH, `${def.color}55`);
    // 图标格（垂直居中）
    ctx.save();
    rr(MARGIN + 16, y + (cardH - 64) / 2, 64, 64, 12);
    ctx.fillStyle = `${def.color}1A`;
    ctx.fill();
    ctx.strokeStyle = `${def.color}88`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    fillText(def.glyph, MARGIN + 48, y + cardH / 2, { size: 30, color: def.color, align: 'center' });
    // 文字块（标题 + 描述）整体与图标垂直居中对齐
    const tx = MARGIN + 96;
    const textW = VW - MARGIN * 2 - 96 - 16;
    const descLines = wrapCount(def.desc, textW, 12);
    const blockH = 24 + descLines * 12 * 1.65;
    const ty0 = y + cardH / 2 - blockH / 2;
    fillText(def.name, tx, ty0 + 10, { size: 16, color: def.color });
    if (taken[id]) chip(MARGIN + (VW - MARGIN * 2) - 12, y + 22, `已装×${taken[id]}`, def.color);
    wrapBlock(def.desc, tx, ty0 + 34, textW, { color: 'rgba(141,160,198,1)', size: 12 });
    ctx.restore();
    hitBox({ x: MARGIN, y, w: VW - MARGIN * 2, h: cardH, label: '', cb: () => { if (engineCmd({ type: 'PICK_TECH', id })) sfx.play('tech'); } });
  });
}

// ---------------- 结算 ----------------

function drawResult(time: number) {
  hooks = [];
  drawSpaceBg(time);
  const won = app.result!.won;
  const st = app.engine!.state;
  const t = (Date.now() - screenAt) / 1000; // 进入结算页的时长（动画驱动）

  // 胜利彩带（无状态：粒子轨迹是 t 的确定函数）
  if (won && t < 3) {
    const r0 = rng(99);
    for (let i = 0; i < 56; i++) {
      const x0 = r0() * VW;
      const delay = r0() * 0.6;
      const vy = 130 + r0() * 170;
      const vx = (r0() - 0.5) * 70;
      const size = 3 + r0() * 4;
      const rot = r0() * Math.PI;
      const spin = (r0() - 0.5) * 9;
      const color = [C.cyan, C.gold, C.green, C.pink][Math.floor(r0() * 4)];
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
    const rg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.32, VW / 2, VH / 2, Math.max(VW, VH) * 0.72);
    rg.addColorStop(0, 'rgba(255,61,90,0)');
    rg.addColorStop(1, 'rgba(255,61,90,0.5)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }

  drawHeader('战斗结算', { back: () => goto('home') });
  const y0 = TOP_SAFE + 16;
  // 标题回弹入场
  const bt = Math.min(1, t / 0.45);
  const bounce = 1 + 2.7 * (bt - 1) ** 3 + 1.7 * (bt - 1) ** 2;
  ctx.save();
  ctx.translate(VW / 2, y0);
  ctx.scale(bounce, bounce);
  fillText(won ? '★ 防线守住了' : '✕ 防线失守', 0, 0, { size: 26, color: won ? C.green : C.pink, align: 'center' });
  ctx.restore();
  fillText(
    won ? `第 ${app.levelId} 章 · ${LEVELS.find((l) => l.id === app.levelId)?.name ?? ''}` : `撑到了第 ${st.wave} / ${st.totalWaves} 波`,
    VW / 2, y0 + 32, { size: 13, color: C.sub, align: 'center', weight: 'normal' },
  );

  // 战绩面板（数字滚动递增）
  const rows: [string, string, number | null][] = [
    ['击杀', String(st.kills), st.kills],
    ['漏怪', String(st.leaked), st.leaked],
    ['剩余生命', `${st.lives} / ${st.maxLives}`, null],
    ['赚取金币', String(st.goldEarned), st.goldEarned],
    ['战术模块', String(st.techs.length), st.techs.length],
  ];
  const px = 24;
  const pw = VW - 48;
  const py = y0 + 58;
  const rowH = 36;
  panel(px, py, pw, rows.length * rowH + 20, C.panelLine);
  rows.forEach(([k, v, num], i) => {
    const ry = py + 28 + i * rowH;
    fillText(k, px + 22, ry, { size: 13, color: C.sub, weight: 'normal' });
    const shown = num === null ? v : String(Math.round(num * Math.min(1, Math.max(0, (t - 0.25 - i * 0.12) / 0.6))));
    fillText(shown, px + pw - 22, ry, { size: 16, align: 'right', font: RES_FONT() });
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

  // 战斗评价：S（零漏怪）A（漏 ≤2）B（其余）D（失败）
  const grade = !won ? 'D' : st.leaked === 0 ? 'S' : st.leaked <= 2 ? 'A' : 'B';
  const gradeColor = grade === 'S' ? C.gold : grade === 'A' ? C.green : grade === 'B' ? C.cyan : C.pink;
  const gx = px + 40;
  const gy3 = py + rows.length * rowH + 40;
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, (t - 0.9) / 0.35));
  ctx.strokeStyle = gradeColor;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(gx, gy3 + 10, 26, 0, Math.PI * 2); ctx.stroke();
  fillText(grade, gx, gy3 + 8, { size: 30, color: gradeColor, align: 'center', font: RES_FONT() });
  fillText(['完美防线', '防守好手', '守住防线', '防线失守'][['S','A','B','D'].indexOf(grade)], gx + 44, gy3 - 4, { size: 15, color: gradeColor });
  fillText(won ? '下一章解锁已记录' : '再挑战一次就能通过', gx + 44, gy3 + 18, { size: 10, color: C.sub, align: 'center', weight: 'normal' });
  ctx.restore();

  let y = py + rows.length * rowH + 40;
  const nextId = app.levelId + 1;
  const hasNext = LEVELS.some((l) => l.id === nextId);
  if (won) {
    // 激励视频广告位（流量主开通后接入 wx.createRewardedVideoAd 实现真翻倍）
    btn({ x: px, y, w: pw, h: 50, label: '◈ 双倍战利 · 观看视频', color: C.gold, cb: () => { showToast('广告模块开发中'); } });
    y += 62;
  }
  if (won && hasNext) {
    btn({ x: px, y, w: pw, h: 54, label: `▶ 进入第 ${nextId} 章`, color: C.green, primary: true, cb: () => gotoBriefing(nextId) });
    y += 68;
  }
  btn({ x: px, y, w: (pw - 12) / 2, h: 46, label: won ? '再来一局' : '再战本关', color: C.gold, cb: () => gotoBriefing(app.levelId) });
  btn({ x: px + (pw - 12) / 2 + 12, y, w: (pw - 12) / 2, h: 46, label: '返回选关', cb: () => goto('home') });
}

// ---------------- 战斗场景（地图坐标） ----------------

function drawBattleScene() {
  const engine = app.engine!;
  const st = engine.state;
  const time = st.clock;

  if (++fxFrame % 30 === 0) qualityHigh = readWxQualityHigh();
  const bloomOn = bloom !== null && bloom.hwOk && qualityHigh;

  // 屏幕震动（主画布与辉光层共用同一偏移；偏移量以地图逻辑像素计，随 mapScale 缩放）
  let shakeX = 0;
  let shakeY = 0;
  if (st.shake > 0) {
    const m = st.shake * 6;
    shakeX = (Math.random() - 0.5) * m;
    shakeY = (Math.random() - 0.5) * m;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, TOP_SAFE - 2, VW, VH - BAR_H - TOP_SAFE + 2);
  ctx.clip(); // 裁剪到可视区，防止地图底对齐时顶部内容越界渲染到状态栏
  ctx.fillStyle = '#070B18';
  ctx.fillRect(0, TOP_SAFE - 2, VW, VH - BAR_H - TOP_SAFE + 2);
  ctx.save();
  ctx.translate(mapOX + shakeX * mapScale, mapOY + mapPan + shakeY * mapScale);
  ctx.scale(mapScale, mapScale);

  drawMapBackground(ctx, W, H, nebulaBg.img);
  drawStarfield(ctx, W, H, time);
  drawVignette(ctx, W, H);
  for (const ex of engine.map.exits) drawBaseGlow(ctx, ex.centerX, ex.centerY, time);

  // 环境星尘：缓慢漂浮的微光点（纯 time 驱动、确定性伪随机）
  ctx.save();
  ctx.fillStyle = '#A9C7FF';
  for (let i = 0; i < 26; i++) {
    const sx = (hash01(i * 3 + 1) * W + time * (2 + hash01(i + 40) * 6)) % W;
    const sy = (hash01(i * 7 + 2) * H + Math.sin(time * 0.15 + i * 1.7) * 14 + H) % H;
    const sr = 0.6 + hash01(i * 5 + 3) * 1.1;
    ctx.globalAlpha = 0.04 + 0.09 * (0.5 + 0.5 * Math.sin(time * 0.7 + i * 2.3));
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  // 进攻路线走廊：宽半透明底 + 青色虚线中线（比 drawPath 更醒目）
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const pts of engine.level.paths) {
    ctx.beginPath();
    pts.forEach(([c, r], i) => {
      const x = (c + 0.5) * CELL;
      const y = (r + 0.5) * CELL;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(34,224,255,0.10)';
    ctx.lineWidth = CELL * 0.92;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(34,224,255,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 12]);
    ctx.lineDashOffset = -time * 30;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  drawPath(ctx, engine.level.paths, time);
  // 地面灼痕（击杀残留焦痕，贴地、在基地/塔/敌人之下）
  fx?.drawScorches(ctx);
  for (const ex of engine.map.exits) drawBase(ctx, time, st.lives / st.maxLives, ex.centerX, ex.centerY);

  if (app.placing) {
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (!engine.map.isBuildable(c, r)) continue;
        if (st.towers.some((tw) => tw.col === c && tw.row === r)) continue;
        ctx.fillStyle = 'rgba(61,240,140,0.10)';
        ctx.strokeStyle = 'rgba(61,240,140,0.35)';
        ctx.fillRect(c * CELL + 4, r * CELL + 4, CELL - 8, CELL - 8);
        ctx.strokeRect(c * CELL + 4, r * CELL + 4, CELL - 8, CELL - 8);
      }
    }
  }

  for (const z of st.zones) {
    ctx.fillStyle = 'rgba(255,107,61,0.18)';
    ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
  }

  for (const e of st.enemies) {
    const p = engine.map.posAt(e.path, e.dist);
    const invisible = e.type === 'lurker' && e.stealthT % 4 >= 3;
    ctx.save();
    ctx.translate(p.x, p.y);
    // 朝向下一个路径点，拐弯时身体跟随转向
    const ahead = engine.map.posAt(e.path, e.dist + 10);
    ctx.rotate(Math.atan2(ahead.y - p.y, ahead.x - p.x));
    drawEnemy(ctx, e.type, ENEMIES[e.type].size, time, {
      alpha: invisible ? 0.12 : 1, enraged: e.enraged, slowed: st.clock < e.slowUntil,
    });
    ctx.restore();
    if (!invisible && e.hp > 0 && e.hp < e.maxHp) {
      const bw = e.isBoss ? 66 : 30;
      const ratio = e.hp / e.maxHp;
      ctx.fillStyle = 'rgba(7,11,24,0.85)';
      ctx.fillRect(p.x - bw / 2, p.y - ENEMIES[e.type].size - 12, bw, 5);
      ctx.fillStyle = e.isBoss ? '#FF3D81' : ratio > 0.5 ? '#3DF08C' : '#FF5A5A';
      ctx.fillRect(p.x - bw / 2, p.y - ENEMIES[e.type].size - 12, bw * ratio, 5);
    }
  }

  for (const t of st.towers) {
    const c = { x: (t.col + 0.5) * CELL, y: (t.row + 0.5) * CELL };
    const def = TOWERS[t.type];
    const lv = TOWERS[t.type].levels[t.level];
    if (app.selectedId === t.id) {
      ctx.save();
      ctx.strokeStyle = `${def.color}55`;
      ctx.beginPath(); ctx.arc(c.x, c.y, lv.range * CELL, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(c.x, c.y);
    drawTower(ctx, t.type, t.level, CELL * 0.92, Math.atan2(t.aimY - c.y, t.aimX - c.x) + Math.PI / 2, t.charging ? 1 - t.chargeT / (TOWERS[t.type].charge ?? 1) : 0, time);
    ctx.restore();
    if (t.level > 0) {
      for (let i = 0; i <= t.level; i++) {
        ctx.fillStyle = '#FFC94D';
        ctx.beginPath(); ctx.arc(c.x + 10 + i * 8, c.y - CELL * 0.38, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // 导弹烟雾拖尾（画在弹丸本体之下）
  fx?.drawTrails(ctx);

  for (const pr of st.projectiles) {
    ctx.save();
    ctx.fillStyle = pr.kind === 'plasma' ? '#FF6B3D' : '#FF9F43';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.kind === 'plasma' ? 5 : 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 光束（每帧 1px 随机抖动；电磁炮双层结构；命中点径向光斑；激光命中火花溅射）
  for (const b of st.beams) {
    const a = Math.max(0, b.ttl / b.maxTtl);
    const isRail = b.color === '#8B5CF6';
    const isLaser = b.color.startsWith('#22E0FF');
    const jx = (Math.random() - 0.5) * 2;
    const jy = (Math.random() - 0.5) * 2;
    if (isRail) {
      // 电磁炮：外层紫色光晕（粗、半透明）
      ctx.save();
      ctx.globalAlpha = a * 0.35;
      ctx.strokeStyle = b.color; ctx.lineWidth = b.width * 2.4;
      ctx.shadowColor = b.color; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.moveTo(b.x1 + jx, b.y1 + jy); ctx.lineTo(b.x2 + jx, b.y2 + jy); ctx.stroke();
      ctx.restore();
      // 内层白芯（细、高亮）
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#F4F0FF'; ctx.lineWidth = Math.max(1.5, b.width * 0.4);
      ctx.beginPath(); ctx.moveTo(b.x1 + jx, b.y1 + jy); ctx.lineTo(b.x2 + jx, b.y2 + jy); ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.color; ctx.lineWidth = b.width * (0.5 + a * 0.5);
      ctx.shadowColor = b.color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(b.x1 + jx, b.y1 + jy); ctx.lineTo(b.x2 + jx, b.y2 + jy); ctx.stroke();
      ctx.restore();
    }
    // 命中点径向光斑（beam 端点即命中点；电磁炮加大加亮）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.9;
    const gr = (8 + b.width * 1.5) * (isRail ? 1.9 : 1);
    const bg = ctx.createRadialGradient(b.x2, b.y2, 0, b.x2, b.y2, gr);
    bg.addColorStop(0, '#FFFFFF');
    bg.addColorStop(0.35, b.color);
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(b.x2, b.y2, gr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (isLaser) fx?.spawnSparks(b.x2, b.y2, '#BDF3FF', SPARKS_PER_HIT);
  }

  for (const r of st.rings) {
    ctx.save();
    ctx.globalAlpha = (r.ttl / r.maxTtl) * 0.85;
    ctx.strokeStyle = r.color; ctx.lineWidth = 2.5;
    const t = 1 - r.ttl / r.maxTtl;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * t, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  for (const pt of st.particles) {
    ctx.save();
    ctx.globalAlpha = pt.ttl / pt.maxTtl;
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 渲染层补充特效：BOSS 多层冲击波环 / 死亡碎片 / 火花 / 击杀白闪
  fx?.drawRings(ctx);
  fx?.drawDebris(ctx);
  fx?.drawSparks(ctx);
  fx?.drawFlashes(ctx);

  for (const f of st.floaters) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.ttl / 0.2);
    fillText(f.text, f.x, f.y, { size: 14, color: f.color, align: 'center' });
    ctx.restore();
  }

  // 特效层更新（敌人/弹丸 diff 检测击杀与爆炸 + 短寿命特效衰减）
  fx?.update(st, engine.map);

  // 模拟 Bloom：发光元素画入低分辨率离屏层，模糊后以 lighter 叠回（默认低画质关闭）
  if (bloomOn && fx) {
    const g = bloom!.begin(shakeX, shakeY);
    fx.drawGlow(g, st, pathPixels, engine.map.exits);
    // composite 会把主画布变换重置为单位矩阵（设备像素），故以设备像素指定地图区域
    bloom!.composite(
      ctx, W, H, DPR,
      (mapOX + shakeX * mapScale) * DPR,
      (mapOY + mapPan + shakeY * mapScale) * DPR,
      W * mapScale * DPR, H * mapScale * DPR,
    );
    // 恢复地图坐标系，供 BOSS 白闪继续绘制
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.translate(mapOX + shakeX * mapScale, mapOY + mapPan + shakeY * mapScale);
    ctx.scale(mapScale, mapScale);
  }

  // BOSS 死亡全屏白闪（最后绘制，保持纯白不被辉光染色）
  fx?.drawBossFlash(ctx, W, H);

  ctx.restore();
  ctx.restore();
}

// ---------------- 图鉴（故事 / 炮塔 / 怪物） ----------------

const CODEX_TABS: [CodexTab, string][] = [['story', '故事'], ['towers', '炮塔'], ['enemies', '怪物']];

function drawCodex(time: number) {
  hooks = [];
  drawSpaceBg(time);
  drawHeader('指挥官图鉴', { back: () => goto('home') });

  // 页签分段控件（高亮块滑动动画 + 轻震动）
  const segY = TOP_SAFE + 6;
  const segW = VW - MARGIN * 2;
  segControl(
    MARGIN, segY, segW,
    CODEX_TABS.map((t) => t[1]),
    CODEX_TABS.findIndex((t) => t[0] === codex.tab),
    'codex',
    (i) => { codex.tab = CODEX_TABS[i][0]; codex.scroll = 0; },
  );

  // 内容区（可滚动）
  const top = segY + 46;
  const bottom = VH - 22;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, VW, bottom - top);
  ctx.clip();
  const y0 = top + 8 - codex.scroll;
  let endY: number;
  if (codex.tab === 'story') endY = drawCodexStory(y0, time, top, bottom);
  else if (codex.tab === 'towers') endY = drawCodexTowers(y0, time, top, bottom);
  else endY = drawCodexEnemies(y0, time, top, bottom);
  ctx.restore();
  codexMaxScroll = Math.max(0, endY - y0 - (bottom - top) + 20);
  codex.scroll = Math.max(0, Math.min(codexMaxScroll, codex.scroll));

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
    const ty = top + (viewH - thumbH) * (codex.scroll / codexMaxScroll);
    ctx.save();
    ctx.fillStyle = 'rgba(34,224,255,0.25)';
    rr(VW - 4, ty, 3, thumbH, 1.5);
    ctx.fill();
    ctx.restore();
  }

  if (showProfile) drawProfileOverlay();
}

function drawCodexStory(y0: number, time: number, top: number, bottom: number): number {
  const x = MARGIN;
  const w = VW - MARGIN * 2;
  const textSize = 12;
  const textW = w - 32;
  let totalLines = 0;
  for (const p of STORY_PARAS) totalLines += wrapCount(p, textW, textSize) + 0.6;
  const boxH = Math.ceil(totalLines * textSize * 1.65) + 46;
  panel(x, y0, w, boxH, C.panelLine);
  fillText('世界观档案', x + 16, y0 + 20, { size: 13, color: C.cyan });
  let ty = y0 + 44;
  for (const p of STORY_PARAS) ty = wrapBlock(p, x + 16, ty, textW, { size: textSize }) + textSize * 1.65 * 0.6;

  let y = y0 + boxH + 20;
  fillText('战役编年史', x + 4, y + 8, { size: 14 });
  fillText('点击已解锁章节直接出击', x + w - 4, y + 9, { size: 10, color: C.dim, align: 'right', weight: 'normal' });
  y += 28;
  const cleared = loadProgress().cleared;
  LEVELS.forEach((lv, i) => {
    const unlock = i === 0 || cleared.includes(LEVELS[i - 1].id);
    const done = cleared.includes(lv.id);
    const rowH = 60;
    if (y + rowH > top && y < bottom) {
      panel(x, y, w, rowH, unlock ? C.panelLine : 'rgba(124,141,176,0.15)', 12);
      drawCardArt(x + 8, y + 8, 74, rowH - 16, lv.id, time, 8);
      const tx = x + 94;
      ctx.save();
      if (!unlock) ctx.globalAlpha = 0.45;
      fillText(`CHAPTER ${String(lv.id).padStart(2, '0')}`, tx, y + 18, { size: 9, color: C.cyan, weight: '600' });
      fillText(lv.name, tx, y + 36, { size: 14 });
      fillText(lv.sub, tx, y + 52, { size: 10, color: C.sub, weight: 'normal' });
      ctx.restore();
      if (done) chip(x + w - 12, y + 16, '已通关', C.green);
      else if (!unlock) chip(x + w - 12, y + 16, '未解锁', C.dim);
      if (unlock) hitBox({ x, y, w, h: rowH, label: '', cb: () => gotoBriefing(lv.id) });
      else hitBox({ x, y, w, h: rowH, label: '', cb: () => { showToast(`通关「${LEVELS[i - 1].name}」后解锁`); buzz('light'); } });
    }
    y += rowH + 10;
  });
  return y;
}

function drawCodexTowers(y0: number, time: number, top: number, bottom: number): number {
  const x = MARGIN;
  const w = VW - MARGIN * 2;
  let y = y0;
  for (const def of TOWER_LIST) {
    const cardH = 134;
    const unlocked = towerUnlocked(def.type);
    if (y + cardH > top && y < bottom) {
      panel(x, y, w, cardH, unlocked ? `${def.color}55` : 'rgba(124,141,176,0.15)');
      // 图标格（满级形态，电磁炮蓄能动画循环演示）
      const ib = 64;
      const ix = x + 14;
      const iy = y + (cardH - ib) / 2;
      ctx.save();
      rr(ix, iy, ib, ib, 12);
      ctx.fillStyle = `${def.color}14`;
      ctx.fill();
      ctx.strokeStyle = `${def.color}55`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.clip();
      ctx.translate(ix + ib / 2, iy + ib / 2);
      ctx.globalAlpha = unlocked ? 1 : 0.35;
      const charge = def.charge ? 0.5 + 0.5 * Math.sin(time * 1.4) : 0;
      drawTower(ctx, def.type, 2, 46, Math.sin(time * 1.1) * 0.12, charge, time, { ticks: false });
      ctx.restore();
      // 文本区
      const tx = ix + ib + 14;
      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.55;
      fillText(def.name, tx, y + 20, { size: 15 });
      fillText(def.nameEn, tx, y + 37, { size: 9, color: C.dim, weight: '600' });
      fillText(def.role, tx, y + 53, { size: 11, color: C.sub, weight: 'normal' });
      fillText(`伤害 ${def.levels.map((l) => l.damage).join(' → ')} · 射程 ${def.levels.map((l) => l.range).join(' → ')}`, tx, y + 71, { size: 10, weight: 'normal' });
      fillText(`射速 ${def.levels.map((l) => l.rate).join(' → ')}/s · 造价 ◈${def.levels[0].cost}`, tx, y + 87, { size: 10, weight: 'normal' });
      fillText(`克制 ${def.strong}`, tx, y + 105, { size: 10, color: C.green, weight: 'normal' });
      fillText(`短板 ${def.weak}`, tx, y + 121, { size: 10, color: C.sub, weight: 'normal' });
      ctx.restore();
      chip(x + w - 12, y + 17, def.tag, def.color);
      if (!unlocked) {
        fillText(`通关第 ${TOWER_UNLOCK[def.type]} 章解锁`, x + w - 12, y + cardH - 12, { size: 10, color: C.gold, align: 'right' });
      }
    }
    y += cardH + 12;
  }
  return y;
}

function drawCodexEnemies(y0: number, time: number, top: number, bottom: number): number {
  const x = MARGIN;
  const w = VW - MARGIN * 2;
  let y = y0;
  for (const def of ENEMY_LIST) {
    const textW = w - 92 - 14;
    const descLines = wrapCount(def.desc, textW, 10);
    const cardH = Math.ceil(92 + descLines * 13.2 + 22);
    if (y + cardH > top && y < bottom) {
      panel(x, y, w, cardH, `${def.color}44`);
      // 图标格（活体贴图：缓慢上下游动）
      const ib = 64;
      const ix = x + 14;
      const iy = y + (cardH - ib) / 2;
      ctx.save();
      rr(ix, iy, ib, ib, 12);
      ctx.fillStyle = `${def.color}12`;
      ctx.fill();
      ctx.strokeStyle = `${def.color}44`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.clip();
      ctx.translate(ix + ib / 2, iy + ib / 2 + Math.sin(time * 2.2) * 2);
      drawEnemy(ctx, def.type, Math.min(21, def.size), time, {});
      ctx.restore();
      // 文本区
      const tx = ix + ib + 14;
      fillText(def.name, tx, y + 20, { size: 15 });
      fillText(def.nameEn, tx, y + 37, { size: 9, color: C.dim, weight: '600' });
      chip(x + w - 12, y + 17, ENEMY_CATEGORY[def.category] ?? def.category, def.color);
      fillText(`威胁 ${'★'.repeat(def.threat)}`, tx, y + 54, { size: 10, color: C.gold });
      fillText(`生命 ${def.hp} · 速度 ${def.speed} · 击杀 ◈${def.reward} · 漏怪 -${def.leak}`, tx, y + 70, { size: 10, color: C.sub, weight: 'normal' });
      const dy = wrapBlock(def.desc, tx, y + 86, textW, { size: 10, color: 'rgba(232,241,255,0.75)' });
      fillText(`弱点：${def.weakness}`, tx, dy + 2, { size: 10, color: C.cyan, weight: 'normal' });
    }
    y += cardH + 12;
  }
  return y;
}

// ---------------- 主循环 ----------------

let last = Date.now();

let RENDER_ERR: unknown = null;
function frame() {
  const now = Date.now();
  try {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (app.screen === 'battle' && app.engine) {
    app.engine.tick(dt);
    for (const ev of app.engine.drainEvents()) {
      if (ev.type === 'leak') { sfx.play('leak'); buzz('heavy'); leakFlashAt = Date.now(); }
      else if (ev.type === 'waveStart') sfx.play('waveStart');
      else if (ev.type === 'waveClear') sfx.play('waveClear');
      else if (ev.type === 'bossDown') { sfx.play('boss'); buzz('heavy'); }
      else if (ev.type === 'sfx') sfx.play(ev.name);
      else if (ev.type === 'gameOver') {
        sfx.play(ev.won ? 'victory' : 'defeat');
        buzz(ev.won ? 'medium' : 'heavy');
        app.result = { won: ev.won };
        if (ev.won) recordLevelClear(app.engine.level.id);
        goto('result');
      }
    }
  }

    syncMusic();
    if (app.screen === 'splash') drawSplash(now / 1000);
    else if (app.screen === 'home') drawHome(now / 1000);
    else if (app.screen === 'briefing') drawBriefing(now / 1000);
    else if (app.screen === 'battle' && app.engine) drawBattle();
    else if (app.screen === 'codex') drawCodex(now / 1000);
    else if (app.screen === 'result' && app.engine) drawResult(now / 1000);

    // 页面切换淡入
    const ft = (Date.now() - screenAt) / 240;
    if (ft < 1) {
      ctx.fillStyle = `rgba(7,11,24,${(1 - ft).toFixed(3)})`;
      ctx.fillRect(0, 0, VW, VH);
    }
    drawToast();
  } catch (e) {
    RENDER_ERR = e;
    console.error('[SRD]', (e as Error)?.stack ?? e);
  }
  if (RENDER_ERR) {
    const msg = String((RENDER_ERR as Error)?.message ?? RENDER_ERR);
    fillText('UI 异常:', 10, 22, { size: 12, color: '#FF5A5A' });
    fillText(msg, 10, 40, { size: 10, color: '#FF9F43', weight: 'normal' });
    const ln = String((RENDER_ERR as Error)?.stack ?? '').split('\n')[1] ?? '';
    fillText(ln, 10, 56, { size: 10, color: '#9AA7C2', weight: 'normal' });
  }

  requestAnimationFrame(frame);
}

// ---------------- 触控 ----------------

let touchTime = 0;

wx.onTouchStart((e) => {
  const p0 = e.touches[0];
  if (!p0) return;
  sfx.init(); // 首次用户手势时初始化 WebAudio
  const p = touchPoint(p0);
  touchTime = Date.now();

  // 按钮按压反馈：记录当前按下的按钮（命中最新一帧的 hooks）
  pressedBtn = null;
  for (let i = hooks.length - 1; i >= 0; i--) {
    const b = hooks[i];
    if (!b.disabled && hit(p, b)) { pressedBtn = b; break; }
  }

  if (app.screen === 'home' || app.screen === 'codex') { app.dragY = p.y; app.dragAcc = 0; return; }

  if (app.screen === 'battle') {
    battleMoved = 0;
    const engine = app.engine;
    if (!engine || engine.state.phase === 'tech') return;

    // 命中 HUD 按钮（暂停/倍速/菜单/立即开战等）时不进入地图手势，交由 touchend 的 hooks 触发按钮
    if (pressedBtn) return;

    // 底部塔栏：记录起点，等移动方向判定是滚动还是拖拽建塔
    if (p.y >= VH - BAR_H) {
      if (!app.placing && app.selectedId == null) {
        const t = towerSlotAt(p);
        const unusable = !t ? null
          : !towerUnlocked(t) ? `通关第 ${TOWER_UNLOCK[t]} 章后解锁「${TOWERS[t].name}」`
          : engine.state.gold < TOWERS[t].levels[0].cost ? '金币不足，先攒一攒' : null;
        barTouch = { mode: 'pending', type: unusable ? null : t, unusable, startX: p.x, startY: p.y, lastX: p.x };
      }
      return;
    }

    // 地图区：点选放置模式下直接建造
    if (app.placing) {
      const st = engine.state;
      const cx = Math.floor(toMapX(p.x) / CELL);
      const cy = Math.floor(toMapY(p.y) / CELL);
      if (
        cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS &&
        engine.map.isBuildable(cx, cy) &&
        !st.towers.some((tw) => tw.col === cx && tw.row === cy)
      ) {
        if (engine.dispatch({ type: 'BUILD', col: cx, row: cy, tower: app.placing })) { sfx.play('build'); buzz('light'); }
      }
      app.placing = null;
      return;
    }

    // 地图区：记录触摸（用于垂直平移 / 轻点选中炮塔）
    mapTouch = { startY: p.y, pan0: mapPan };
  }
});

wx.onTouchMove((e) => {
  const p0 = e.touches[0];
  if (!p0) return;
  const p = touchPoint(p0);

  if (app.screen === 'home' || app.screen === 'codex') {
    if (app.dragY == null) return;
    const max = app.screen === 'home' ? totalScrollMax() : codexMaxScroll;
    const next = Math.max(0, Math.min(max, (app.screen === 'home' ? app.scroll : codex.scroll) + (app.dragY - p.y)));
    if (app.screen === 'home') app.scroll = next;
    else codex.scroll = next;
    app.dragAcc = Math.abs(app.dragY - p.y) + (app.dragAcc ?? 0);
    app.dragY = p.y;
    return;
  }

  if (app.screen !== 'battle') return;

  if (barTouch) {
    const dx = p.x - barTouch.startX;
    const dy = p.y - barTouch.startY;
    if (barTouch.mode === 'pending') {
      // 横向为主 → 滚动塔栏；纵向/斜向 → 拖拽建塔
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2 && stripMaxScroll > 0) barTouch.mode = 'scroll';
      else if (dx * dx + dy * dy > 144 && barTouch.type) barTouch.mode = 'drag';
    }
    if (barTouch.mode === 'scroll') {
      barScroll = Math.max(0, Math.min(stripMaxScroll, barScroll - (p.x - barTouch.lastX)));
      barTouch.lastX = p.x;
      battleMoved += Math.abs(dx);
    } else if (barTouch.mode === 'drag') {
      dragPos = p;
      battleMoved += Math.abs(dx) + Math.abs(dy);
    }
    return;
  }

  if (mapTouch) {
    if (mapPanMin >= 0) return; // 地图不需平移时，位移不计入（保留轻点选中）
    const dy = p.y - mapTouch.startY;
    mapPan = Math.max(mapPanMin, Math.min(0, mapTouch.pan0 + dy));
    battleMoved += Math.abs(dy);
  }
});

wx.onTouchEnd((e) => {
  pressedBtn = null;
  const p0 = (e.changedTouches ?? e.touches)[0];
  if (!p0) return;
  const p = touchPoint(p0);
  const isScrollPage = app.screen === 'home' || app.screen === 'codex';
  if (isScrollPage) {
    // 拖动滚动超过了阈值则不视为点击
    if (app.dragAcc > 8) { app.dragY = null; app.dragAcc = 0; return; }
    app.dragY = null;
  }

  if (app.screen === 'battle') {
    // 塔栏手势收尾
    if (barTouch) {
      const bt = barTouch;
      barTouch = null;
      dragPos = null;
      if (bt.mode === 'scroll') return;
      if (bt.mode === 'drag') {
        // 松手落格建造
        if (bt.type && app.engine) {
          const st = app.engine.state;
          const cx = Math.floor(toMapX(p.x) / CELL);
          const cy = Math.floor(toMapY(p.y) / CELL);
          if (
            cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS &&
            app.engine.map.isBuildable(cx, cy) &&
            !st.towers.some((tw) => tw.col === cx && tw.row === cy)
          ) {
            if (app.engine.dispatch({ type: 'BUILD', col: cx, row: cy, tower: bt.type })) { sfx.play('build'); buzz('light'); }
          }
        }
        return;
      }
      // pending 轻点：可用则进入点选放置模式，否则提示原因
      if (bt.type) { app.placing = bt.type; app.selectedId = null; }
      else if (bt.unusable) { showToast(bt.unusable); buzz('light'); }
      return;
    }
    // 地图平移超过了阈值则不视为点击
    if (mapTouch) {
      const moved = battleMoved > 8;
      mapTouch = null;
      if (moved) return;
      // 轻点地图：选中/取消选中炮塔（选中后底部栏出现升级/出售）
      if (app.engine && !app.placing) {
        const cx = Math.floor(toMapX(p.x) / CELL);
        const cy = Math.floor(toMapY(p.y) / CELL);
        const tw = app.engine.state.towers.find((t) => t.col === cx && t.row === cy);
        app.selectedId = tw ? tw.id : null;
        if (tw) sfx.play('select');
        return;
      }
    }
  }

  const quick = Date.now() - touchTime < 600;
  if (!quick) return;

  for (let i = hooks.length - 1; i >= 0; i--) {
    const b = hooks[i];
    if (!b.disabled && hit(p, b)) {
      sfx.play('click');
      b.cb();
      return;
    }
  }
});

// 主循环启动
frame();

// 调试钩子（正式版可删）：微信开发者工具 Console 中敲 __SRD 查看内部状态
try {
  (globalThis as { __SRD?: unknown }).__SRD = app;
  (globalThis as { __SRD_HOOKS?: object }).__SRD_HOOKS = { get: () => hooks };
} catch { /* ignore */ }
