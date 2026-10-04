// 高塔防线 · 微信小游戏版 —— 引擎层位于 src/game（纯 TS 零 DOM）
// UI 层以 Canvas 自绘实现：开场动画 / 选关(带宣传图) / 简报 / 战斗 / 科技三选一 / 结算
import {
  CELL, COLS, ROWS, W, H, TOWERS, ENEMIES, DIFFICULTIES, SELL_RATE, TECHS, TOWER_LIST, ENEMY_LIST,
} from './game/config';
import { LEVELS } from './game/levels';
import { createEngine } from './game/engine';
import {
  drawTower, drawEnemy, drawMapBackground, drawPath, drawBase,
} from './game/render';
import {
  BloomLayer, FxLayer, NebulaBg, setFxPlatform,
  drawBaseGlow, drawStarfield, drawVignette, hash01, readQualityHigh, SPARKS_PER_HIT,
} from './game/fx';
import type { Command, Difficulty, GameEngine, GameEvent, GameState, TowerType } from './game/types';
import type { TechId } from './game/types';
import { sfx } from './audio';
import { track, configureAnalytics } from './analytics';
import { connectCoop, wsUrlFromApiBase } from './net';
import type { CoopCallbacks, CoopConn } from './net';
import { createGhostEngine } from './ghost';
import type { GhostEngine } from './ghost';
import { SKIN_MODULES } from './skins';
import type { PlayMode, SkinEnv } from './skins/types';

// ---------------- 运行环境 ----------------

interface TouchLike { clientX: number; clientY: number; identifier?: number }
interface TouchEventLike { touches: TouchLike[]; changedTouches?: TouchLike[] }

interface WxImage {
  src: string; width: number; height: number;
  onload: (() => void) | null; onerror: ((e?: unknown) => void) | null;
}

/** 打包注入的构建号（build.mjs define；非构建环境为 undefined） */
declare const __BUILD_ID__: string | undefined;

declare const wx: {
  createCanvas(): HTMLCanvasElement;
  getSystemInfoSync(): { windowWidth: number; windowHeight: number; pixelRatio: number };
  onTouchStart(cb: (e: TouchEventLike) => void): void;
  onTouchMove(cb: (e: TouchEventLike) => void): void;
  onTouchEnd(cb: (e: TouchEventLike) => void): void;
  setStorageSync(key: string, value: unknown): void;
  getStorageSync(key: string): unknown;
  getMenuButtonBoundingClientRect?(): { top: number; bottom: number; left: number; right: number };
  getAccountInfoSync?(): { miniProgram?: { envVersion?: string } };
  createImage(): WxImage;
  createInnerAudioContext(): {
    src: string; volume: number; autoplay: boolean; obeyMuteSwitch: boolean; loop: boolean;
    play(): void; stop(): void; destroy(): void;
    onError(cb: (e?: unknown) => void): void;
    onCanplay(cb: () => void): void;
  };
  loadSubpackage(o: { name: string; success?: () => void; fail?: (e?: unknown) => void }): void;
  vibrateShort?(o: { type?: 'heavy' | 'medium' | 'light'; success?: () => void; fail?: (e?: { errMsg?: string }) => void }): void;
  getUserInfo?(o: {
    success?: (r: { userInfo: { nickName: string; avatarUrl: string } }) => void;
    fail?: (e?: unknown) => void;
  }): void;
  getUpdateManager?(): {
    onCheckForUpdate(cb: (r: { hasUpdate: boolean }) => void): void;
    onUpdateReady(cb: () => void): void;
    onUpdateFailed(cb: () => void): void;
    applyUpdate(): void;
  };
  showModal?(o: {
    title: string; content: string; showCancel?: boolean;
    success?: (r: { confirm: boolean; cancel: boolean }) => void;
    fail?: (e?: unknown) => void;
  }): void;
  showShareMenu?(o: { withShareTicket?: boolean; menus?: string[]; success?: () => void; fail?: (e?: unknown) => void }): void;
  onShareAppMessage?(cb: () => { title: string; imageUrl?: string }): void;
  onShareTimeline?(cb: () => { title: string; imageUrl?: string }): void;
  shareAppMessage?(o: { title: string; imageUrl?: string; query?: string }): void;
  connectSocket?(o: { url: string }): {
    onOpen(cb: () => void): void;
    onMessage(cb: (r: { data: unknown }) => void): void;
    onClose(cb: () => void): void;
    onError(cb: (e?: unknown) => void): void;
    send(o: { data: string; success?: () => void; fail?: (e?: unknown) => void }): void;
    close(o?: Record<string, unknown>): void;
  };
  getLaunchOptionsSync?(): { query?: Record<string, unknown> };
  openCustomerServiceChat?(o: {
    extInfo: { url: string }; corpId: string;
    success?: () => void; fail?: (e?: unknown) => void;
  }): void;
  setClipboardData?(o: { data: string; success?: () => void; fail?: (e?: unknown) => void }): void;
  login?(o: { success?: (r: { code: string }) => void; fail?: (e?: unknown) => void }): void;
  request?(o: {
    url: string; method?: string; data?: unknown; header?: Record<string, string>;
    success?: (r: { statusCode: number; data: unknown }) => void;
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

// ---------------- 版本更新提示（启动时检查，全部判空保护） ----------------
try {
  const um = wx.getUpdateManager?.();
  if (um) {
    um.onCheckForUpdate((r) => { if (r.hasUpdate) console.log('[SRD] 发现新版本，下载中…'); });
    um.onUpdateReady(() => {
      wx.showModal?.({
        title: '更新提示',
        content: '新版本已就绪，重启后立即生效？',
        success: (r) => { if (r.confirm) um.applyUpdate(); },
      });
    });
    um.onUpdateFailed(() => { /* 静默：网络异常等场景不打扰玩家 */ });
  }
} catch { /* ignore */ }

// ---------------- 分享能力（菜单常驻 + 被动分享回调，判空保护） ----------------
try {
  wx.showShareMenu?.({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
} catch { /* ignore */ }
/** 被动分享文案：带上当前战役进度（无进度时用默认钩子文案） */
function shareTitle(): string {
  const n = Math.max(0, ...loadProgress().cleared);
  return n > 0
    ? `我在《高塔防线》守到了第 ${n} 关，你能撑到第几波？`
    : '虫群压境，星环告急！来《高塔防线》指挥你的第一座炮塔';
}
try {
  wx.onShareAppMessage?.(() => {
    track('share_click', { channel: 'menu' });
    return { title: shareTitle(), imageUrl: 'assets/share-cover.jpg' };
  });
  wx.onShareTimeline?.(() => ({
    title: `《高塔防线》—— 十三章星环战役塔防：${shareTitle()}`,
    imageUrl: 'assets/share-cover.jpg',
  }));
} catch { /* ignore */ }

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

// ---------------- 用户体系 + 积分体系（MVP，design/multiplayer.md §2/§3） ----------------

// 服务端 API 基址：默认指向线上管理端；置空字符串则纯本地模式（不登录、不同步云端）。
// 开发联调：开发者工具 Console 执行 wx.setStorageSync('srd.apiBase', 'http://<开发机IP>:<端口>') 可覆盖，重启生效
const API_BASE: string = (() => {
  try {
    const saved = store.get('srd.apiBase');
    if (typeof saved === 'string' && saved.trim()) return saved.trim();
  } catch { /* ignore */ }
  return 'https://game.chujian.site';
})();

/** 登录态（srd.user）：静默登录成功后落盘 */
interface UserSession { openid: string; token: string; loginAt: number }
let session: UserSession | null = (() => {
  try {
    const raw = store.get('srd.user') as Partial<UserSession> | undefined;
    if (raw && typeof raw.openid === 'string' && raw.openid) {
      return { openid: raw.openid, token: String(raw.token ?? ''), loginAt: Number(raw.loginAt ?? 0) || 0 };
    }
  } catch { /* ignore */ }
  return null;
})();

/** 积分档案（srd.score）：本地为准即时展示，登录后与云端 max 合并 */
interface ScoreProfile {
  points: number;        // 累计积分（历史总产出，不减）
  spendable: number;     // 消费积分（产出时与 points 同增；消耗只减它，MVP 暂无消耗点）
  bestSingle: number;    // 单局最高积分
  perLevelBest: Record<number, number>; // 每关最高单局积分
  season: number;        // 赛季编号（预留，初始 1）
  updatedAt: number;
}
const numOr = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
function loadScore(): ScoreProfile {
  const raw = store.get('srd.score') as Partial<ScoreProfile> | undefined;
  const per: Record<number, number> = {};
  if (raw?.perLevelBest && typeof raw.perLevelBest === 'object') {
    for (const [k, v] of Object.entries(raw.perLevelBest)) {
      const key = Number(k);
      if (Number.isFinite(key) && typeof v === 'number' && Number.isFinite(v)) per[key] = v;
    }
  }
  return {
    points: numOr(raw?.points),
    spendable: numOr(raw?.spendable),
    bestSingle: numOr(raw?.bestSingle),
    perLevelBest: per,
    season: numOr(raw?.season) || 1,
    updatedAt: numOr(raw?.updatedAt),
  };
}
let scoreProfile: ScoreProfile = loadScore();
function saveScore() { store.set('srd.score', scoreProfile); }

// 老用户迁移（一次性）：无积分档案但有通关记录 → 按旧军衔档补保底积分，避免升级后军衔倒退
if (!store.get('srd.score')) {
  const n = loadProgress().cleared.length;
  if (n > 0) {
    scoreProfile.points = scoreProfile.spendable = n >= 13 ? 15000 : n >= 8 ? 6000 : n >= 4 ? 2000 : 500;
    scoreProfile.updatedAt = Date.now();
    saveScore();
  }
}

// 军衔表：累计积分门槛（§3.2；星海元帅为长期目标位，防硬核玩家封顶）
const RANKS: [threshold: number, name: string][] = [
  [0, '新晋学员'],
  [500, '见习指挥官'],
  [2000, '战地指挥官'],
  [6000, '星环将星'],
  [15000, '传奇统帅'],
  [40000, '星海元帅'],
];
/** 当前军衔档位与升级进度（满级时 next/nextName 为 null） */
function rankProgress(): { name: string; points: number; base: number; next: number | null; nextName: string | null } {
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (scoreProfile.points >= RANKS[k][0]) i = k;
  const nxt = i + 1 < RANKS.length ? RANKS[i + 1] : null;
  return {
    name: RANKS[i][1], points: scoreProfile.points, base: RANKS[i][0],
    next: nxt ? nxt[0] : null, nextName: nxt ? nxt[1] : null,
  };
}

// ---------------- 单局结算积分（§3.1；字段以 engine GameState 为准） ----------------

type Grade = 'S' | 'A' | 'B' | 'D';
/** 战斗评级：S 零漏怪 / A 漏 ≤2 / B 其余 / D 失败（与结算页评级圈同一规则） */
function battleGrade(st: GameState, won: boolean): Grade {
  return !won ? 'D' : st.leaked === 0 ? 'S' : st.leaked <= 2 ? 'A' : 'B';
}
const DIFF_MUL: Record<Difficulty, number> = { easy: 0.8, normal: 1.0, hard: 1.4 };
const GRADE_BONUS: Record<Grade, number> = { S: 1.25, A: 1.1, B: 1.0, D: 0.4 };
/** 单局结算积分：击杀/波次/科技/剩余生命/章节权重 − 漏怪惩罚，乘难度系数与评级加成 */
function calcScore(st: GameState, difficulty: Difficulty, levelId: number, won: boolean): number {
  const base = st.kills * 10        // 击杀：每只 10 分
    + st.wave * 60                  // 进度：每到达一波 60 分
    + st.techs.length * 40          // 构筑深度：每个战术模块 40 分
    + st.lives * 15                 // 防守质量：每剩 1 点生命 15 分
    + levelId * 50                  // 章节权重
    - st.leaked * 30;               // 漏怪惩罚
  return Math.max(0, Math.round(base * DIFF_MUL[difficulty] * GRADE_BONUS[battleGrade(st, won)]));
}

// ---------------- 云端同步（全部网络异常静默 catch，绝不影响游戏主流程） ----------------

/** 云端档案 → 本地逐字段 max 合并并写盘；返回本地是否存在更大字段（需回传服务端） */
function applyCloudScore(cp: Partial<ScoreProfile>): boolean {
  let localBigger = false;
  const cPoints = numOr(cp.points);
  const cBest = numOr(cp.bestSingle);
  if (scoreProfile.points > cPoints || scoreProfile.bestSingle > cBest) localBigger = true;
  // 云端多出的累计积分同额计入消费积分（本地已消耗的部分不受影响）
  scoreProfile.spendable += Math.max(0, cPoints - scoreProfile.points);
  scoreProfile.points = Math.max(scoreProfile.points, cPoints);
  scoreProfile.bestSingle = Math.max(scoreProfile.bestSingle, cBest);
  if (cp.perLevelBest && typeof cp.perLevelBest === 'object') {
    for (const [k, v] of Object.entries(cp.perLevelBest)) {
      const key = Number(k);
      const nv = numOr(v);
      if (!Number.isFinite(key)) continue;
      if (nv > (scoreProfile.perLevelBest[key] ?? 0)) scoreProfile.perLevelBest[key] = nv;
      else if ((scoreProfile.perLevelBest[key] ?? 0) > nv) localBigger = true;
    }
  }
  scoreProfile.updatedAt = Date.now();
  saveScore();
  return localBigger;
}

/** 已登录时把本地积分档案 POST 回服务端（服务端 max 合并），失败静默 */
function syncScoreToCloud() {
  try {
    if (!API_BASE || !session || typeof wx.request !== 'function') return;
    wx.request({
      url: `${API_BASE}/api/user/score`,
      method: 'POST',
      header: { Authorization: `Bearer ${session.token}` },
      data: {
        points: scoreProfile.points,
        bestSingle: scoreProfile.bestSingle,
        perLevelBest: scoreProfile.perLevelBest,
      },
      success: (r) => {
        try {
          const d = r.data as { ok?: boolean; profile?: Partial<ScoreProfile> };
          if (r.statusCode === 200 && d?.ok && d.profile) applyCloudScore(d.profile);
        } catch { /* ignore */ }
      },
      fail: () => { /* 静默 */ },
    });
  } catch { /* ignore */ }
}

/** 登录成功后的积分云合并：GET 云端档案 → 本地 max 合并 → 本地更大则 POST 回传 */
function mergeScoreWithCloud() {
  try {
    if (!API_BASE || !session || typeof wx.request !== 'function') return;
    wx.request({
      url: `${API_BASE}/api/user/score`,
      method: 'GET',
      header: { Authorization: `Bearer ${session.token}` },
      success: (r) => {
        try {
          const d = r.data as { ok?: boolean; profile?: Partial<ScoreProfile> };
          if (r.statusCode === 200 && d?.ok && d.profile) {
            if (applyCloudScore(d.profile)) syncScoreToCloud();
          } else if (r.statusCode === 401) {
            // token 失效：清登录态，保持游客（403 banned 等其余情况不动本地数据）
            session = null;
            store.set('srd.user', '');
          }
        } catch { /* ignore */ }
      },
      fail: () => { /* 静默 */ },
    });
  } catch { /* ignore */ }
}

/** 静默登录（splash 期间并行发起）：wx.login 换 code → POST /api/login 换 openid/token。
 *  无后端 / 无 wx.login / 任何失败：静默保持游客，不打断进游戏 */
function silentLogin() {
  try {
    if (!API_BASE || typeof wx.login !== 'function' || typeof wx.request !== 'function') return;
    wx.login({
      success: (r) => {
        try {
          if (!r?.code || typeof wx.request !== 'function') return;
          wx.request({
            url: `${API_BASE}/api/login`,
            method: 'POST',
            data: { code: r.code },
            success: (res) => {
              try {
                const d = res.data as { ok?: boolean; openid?: string; token?: string };
                if (res.statusCode !== 200 || !d?.ok || !d.openid || !d.token) return;
                session = { openid: d.openid, token: d.token, loginAt: Date.now() };
                store.set('srd.user', session);
                profile.openid = d.openid; // 冗余一份便于 UI 展示「已绑定」状态
                store.set('srd.profile', profile);
                configureAnalytics({
                  endpoint: API_BASE,
                  getOpenid: () => session?.openid ?? '',
                  getBuildId: () => (typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'),
                });
                track('login_ok', { level: 1 });
                mergeScoreWithCloud();
              } catch { /* ignore */ }
            },
            fail: () => { /* 静默 */ },
          });
        } catch { /* ignore */ }
      },
      fail: () => { /* 静默 */ },
    });
  } catch { /* ignore */ }
}

// ---------------- 用户信息 ----------------

interface Profile { nick: string; avatarUrl: string; real: boolean; openid?: string }
let profile: Profile = (() => {
  const raw = store.get('srd.profile') as Partial<Profile> | undefined;
  return {
    nick: raw?.nick ?? '', avatarUrl: raw?.avatarUrl ?? '', real: raw?.real === true,
    openid: typeof raw?.openid === 'string' ? raw.openid : '',
  };
})();

/** 按累计积分授予军衔（未授权微信信息时的默认身份；签名不变，全 UI 自动生效） */
function commanderRank(): string {
  return rankProgress().name;
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

// 启动即静默登录（splash 动画期间并行发起）；API_BASE 为空或任何失败都保持游客，不打断进游戏
silentLogin();

function authUser() {
  try {
    wx.getUserInfo?.({
      success: (r) => {
        // 授权只更新昵称头像，保留静默登录绑定的 openid
        profile = { nick: r.userInfo.nickName, avatarUrl: r.userInfo.avatarUrl, real: true, openid: profile.openid };
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

const BAR_H = 92;
// 顶部让位微信胶囊按钮：胶囊底 + 8（内容安全线；战斗 HUD 等用）
const capsule = wx.getMenuButtonBoundingClientRect?.();
const TOP_SAFE = capsule ? Math.ceil(capsule.bottom) + 8 : 96;
// 页头与胶囊同一水平线排布，消除胶囊左侧的空白带
const CAP_MID = capsule ? (capsule.top + capsule.bottom) / 2 : 48;
const CAP_LEFT = capsule ? capsule.left : VW - 94;
// 体验版/开发版中，胶囊左侧可能出现微信自带的「游戏中心」手柄入口
// （客户端行为，代码无法关闭，且不计入胶囊矩形），页头右侧按钮需额外让位
const envVersion = (() => { try { return wx.getAccountInfoSync?.().miniProgram?.envVersion; } catch { return undefined; } })();
const GAME_CENTER_PAD = envVersion === 'develop' || envVersion === 'trial' ? 46 : 0;
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
  panelLine: 'rgba(34,224,255,0.25)',
};
const MARGIN = 16;
const RADIUS = 14;

// ---------------- 界面皮肤（参考市面塔防/科幻游戏的视觉语言；只换 UI 外观，不动战斗地图配色） ----------------

interface Skin {
  id: string; name: string; ref: string;
  accent: string;                  // 主强调色
  rgb: [number, number, number];   // accent 的 rgb 分量（拼 rgba 用）
  danger: string; gold: string; green: string; red: string;
  text: string; sub: string; dim: string;
  panelTop: string; panelBottom: string;  // 面板渐变两端
  panelSolid: string;                     // 按钮/Toast 的纯色底
  chrome: 'round' | 'chamfer';            // 圆角 / 切角（布局语言差异）
  pressFx: 'scale' | 'stamp' | 'glitch';  // 按钮按压反馈：缩放 / 盖章 / 故障错位
  transition: 'fade' | 'wipe' | 'glitch'; // 页面切换过渡：淡入 / 切角挡板横扫 / 故障色带
}
const SKINS: Skin[] = [
  {
    id: 'abyss', name: '深空全息', ref: '原作 · 全息科幻',
    accent: '#22E0FF', rgb: [34, 224, 255], danger: '#FF3D81',
    gold: '#FFC94D', green: '#3DF08C', red: '#FF5A5A',
    text: '#E8F1FF', sub: '#8DA0C6', dim: '#5A6B8C',
    panelTop: 'rgba(20,30,58,0.94)', panelBottom: 'rgba(11,17,36,0.94)', panelSolid: 'rgba(15,23,46,0.94)', chrome: 'round',
    pressFx: 'scale', transition: 'fade',
  },
  {
    id: 'ember', name: '琥珀工业', ref: '参考《明日方舟》工业指挥风',
    accent: '#FFB020', rgb: [255, 176, 32], danger: '#FF5A3D',
    gold: '#FFC94D', green: '#7ED957', red: '#FF5A5A',
    text: '#FFF3E2', sub: '#C0A98A', dim: '#8A765C',
    panelTop: 'rgba(40,30,18,0.94)', panelBottom: 'rgba(22,16,10,0.94)', panelSolid: 'rgba(26,19,10,0.94)', chrome: 'chamfer',
    pressFx: 'stamp', transition: 'wipe',
  },
  {
    id: 'matrix', name: '紫晶矩阵', ref: '参考《赛博朋克2077》霓虹风',
    accent: '#B16CFF', rgb: [177, 108, 255], danger: '#FF3D81',
    gold: '#FFD75E', green: '#3DF08C', red: '#FF5A5A',
    text: '#F1E9FF', sub: '#A48FC8', dim: '#6E5C8E',
    panelTop: 'rgba(34,20,54,0.94)', panelBottom: 'rgba(16,9,30,0.94)', panelSolid: 'rgba(20,12,36,0.94)', chrome: 'round',
    pressFx: 'glitch', transition: 'glitch',
  },
];
let skin: Skin = SKINS[0];
/** 当前主题色 + alpha 拼 rgba() */
const ac = (a: number) => `rgba(${skin.rgb[0]},${skin.rgb[1]},${skin.rgb[2]},${a})`;
function applySkin(id: string) {
  skin = SKINS.find((s) => s.id === id) ?? SKINS[0];
  C.cyan = skin.accent;
  C.pink = skin.danger;
  C.gold = skin.gold;
  C.green = skin.green;
  C.red = skin.red;
  C.text = skin.text;
  C.sub = skin.sub;
  C.dim = skin.dim;
  C.panelLine = ac(0.25);
  store.set('srd.skin', skin.id);
}
// 启动恢复上次选择的皮肤
applySkin(String(store.get('srd.skin') || 'abyss'));

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
  // 皮肤模块可插拔：接管 Toast 绘制
  const m = SKIN_MODULES[skin.id];
  if (m?.drawToast) { m.drawToast(env); return; }
  if (!toast) return;
  const t = (Date.now() - toast.at) / 1000;
  if (t > 1.6) { toast = null; return; }
  const a = t < 0.15 ? t / 0.15 : t > 1.25 ? (1.6 - t) / 0.35 : 1;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = 'bold 12px sans-serif';
  const w = ctx.measureText(toast.text).width + 34;
  rr(VW / 2 - w / 2, VH * 0.4, w, 34, 17);
  ctx.fillStyle = skin.panelSolid;
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

/** 圆角矩形路径（琥珀工业皮肤切换为切角八边形，呈现硬派工业布局语言） */
function rr(x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (skin.chrome === 'chamfer') {
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.lineTo(x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.lineTo(x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.lineTo(x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.closePath();
    return;
  }
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
  g.addColorStop(0, skin.panelTop);
  g.addColorStop(1, skin.panelBottom);
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
    // 按压反馈随皮肤：scale 缩放 / stamp 盖章下移变暗 / glitch 故障抖动（错位残影在标签绘制处叠加）
    ctx.save();
    if (skin.pressFx === 'stamp') {
      // 琥珀工业 · 盖章：整体下移 2px + 压暗
      ctx.translate(0, 2);
      ctx.globalAlpha = 0.72;
    } else if (skin.pressFx === 'glitch') {
      // 紫晶矩阵 · 故障：轻微水平抖动（量化时间 + hash01，帧间确定性）
      ctx.translate((hash01(Math.floor(Date.now() / 60)) - 0.5) * 4, 0);
      ctx.globalAlpha = 0.9;
    } else {
      // 深空全息 · 缩放
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
      ctx.scale(0.93, 0.93);
      ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
      ctx.globalAlpha = 0.82;
    }
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
    ctx.fillStyle = b.active ? `${c}30` : skin.panelSolid;
    ctx.fill();
    ctx.strokeStyle = b.active ? c : `${c}77`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
  if (b.label) {
    const labelColor = b.primary && !b.disabled ? '#081226' : b.active ? c : b.disabled ? '#9AA7C2' : C.text;
    const labelY = b.y + (b.sub ? b.h / 2 - 9 : b.h / 2);
    if (pressed && skin.pressFx === 'glitch') {
      // 故障错位残影：红/青各偏 2px，压在主标签之下
      fillText(b.label, b.x + b.w / 2 - 2, labelY, { size: 14, color: 'rgba(255,61,129,0.7)', align: 'center' });
      fillText(b.label, b.x + b.w / 2 + 2, labelY, { size: 14, color: ac(0.7), align: 'center' });
    }
    fillText(b.label, b.x + b.w / 2, labelY, {
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

// ---------------- 统一页头：与胶囊按钮同一水平线；主页仅标题，子页面为 标题 + 返回 + 设置 ----------------

let showProfile = false;
let showSettings = false;

function drawHeader(title: string, opts: { back?: () => void } = {}) {
  const btnS = 36;
  const top = CAP_MID - btnS / 2;
  // 背景条（从胶囊行上缘延伸到内容安全线）+ 底部细线
  ctx.save();
  const g = ctx.createLinearGradient(0, top - 6, 0, TOP_SAFE);
  g.addColorStop(0, skin.panelTop);
  g.addColorStop(1, skin.panelBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, top - 6, VW, TOP_SAFE - top + 6);
  ctx.strokeStyle = ac(0.15);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, TOP_SAFE - 0.5);
  ctx.lineTo(VW, TOP_SAFE - 0.5);
  ctx.stroke();
  ctx.restore();

  // 页头只保留 返回 + 标题（设置入口仅保留在欢迎页菜单）
  let tx = MARGIN;
  const rightLimit = CAP_LEFT - 8 - GAME_CENTER_PAD;
  if (opts.back) {
    btn({ x: MARGIN, y: top, w: btnS, h: btnS, label: '‹', cb: opts.back });
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
  fillText('TOWER LINE DEFENSE', tx, CAP_MID - 11, { size: 9, color: ac(0.7), weight: '600' });
  fillText(title, tx, CAP_MID + 8, { size: tSize });
}

/** 意见反馈：优先企业微信客服会话（需 mp 后台配置），失败/不支持时回退复制反馈邮箱 */
function copyFeedbackMail() {
  const mail = 'feedback@example.com'; // TODO 上线前替换为真实反馈邮箱
  try {
    wx.setClipboardData?.({ data: mail, success: () => showToast('反馈邮箱已复制') });
  } catch { /* ignore */ }
}
function openFeedback() {
  try {
    if (typeof wx.openCustomerServiceChat === 'function') {
      wx.openCustomerServiceChat({
        corpId: '', // TODO 替换为 mp 后台「客服」企业微信的 corpId
        extInfo: { url: '' }, // TODO 替换为客服链接（mp 后台生成）
        fail: () => copyFeedbackMail(),
      });
      return;
    }
  } catch { /* fallthrough 到邮箱兜底 */ }
  copyFeedbackMail();
}

/** 指挥官档案弹层（画在主页/图鉴之上） */
function drawProfileOverlay() {
  // 皮肤模块可插拔：接管档案弹层
  const m = SKIN_MODULES[skin.id];
  if (m?.drawProfile) { m.drawProfile(env); return; }
  ctx.fillStyle = 'rgba(7,11,24,0.78)';
  ctx.fillRect(0, 0, VW, VH);
  const pw = VW - 72;
  const ph = 456;
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
  ctx.fillStyle = ac(0.12);
  ctx.fill();
  if (cleared > 0) {
    rr(bx, by + 6, Math.max(10, bw * (cleared / LEVELS.length)), 10, 5);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, C.cyan);
    g.addColorStop(1, C.gold);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // 军衔积分进度条（points / 下一档门槛；满级显示已达最高军衔）
  const rp = rankProgress();
  const ry = by + 42;
  fillText(
    rp.next === null
      ? `积分 ${rp.points.toLocaleString('en-US')} · 已达最高军衔`
      : `积分 ${rp.points.toLocaleString('en-US')} / ${rp.next.toLocaleString('en-US')} · 距「${rp.nextName}」还差 ${(rp.next - rp.points).toLocaleString('en-US')} 分`,
    VW / 2, ry - 8, { size: 11, color: C.sub, align: 'center', weight: 'normal' },
  );
  rr(bx, ry + 6, bw, 10, 5);
  ctx.fillStyle = 'rgba(255,201,77,0.12)';
  ctx.fill();
  const frac = rp.next === null ? 1 : Math.min(1, Math.max(0, (rp.points - rp.base) / (rp.next - rp.base)));
  if (frac > 0) {
    rr(bx, ry + 6, Math.max(10, bw * frac), 10, 5);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, shade(C.gold));
    g.addColorStop(1, C.gold);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // 绑定状态行（静默登录成功后有 openid）
  if (profile.openid) {
    fillText(`已绑定 · ${profile.openid.slice(0, 12)}…`, VW / 2, ry + 34, { size: 10, color: C.green, align: 'center', weight: 'normal' });
  }

  // 意见反馈（客服会话 → 回退复制邮箱）
  btn({
    x: px + 24, y: py + 266, w: pw - 48, h: 40, label: '💬 意见反馈', color: C.gold,
    cb: () => openFeedback(),
  });

  let y = py + 318;
  if (!profile.real) {
    btn({
      x: px + 24, y, w: pw - 48, h: 44, label: '同步微信头像昵称', color: C.green, primary: true,
      cb: () => authUser(),
    });
    y += 56;
  }
  btn({ x: px + 24, y, w: pw - 48, h: 40, label: '关闭', cb: () => { showProfile = false; } });
}

// ---------------- 设置中心（音效/音乐/旁白/震动/画质，欢迎页菜单「⚙ 设置」进入） ----------------

/** 开关控件：46×26 胶囊滑块，(x,y) 为左上角 */
function drawSwitch(x: number, y: number, on: boolean) {
  ctx.save();
  rr(x, y, 46, 26, 13);
  ctx.fillStyle = on ? ac(0.85) : 'rgba(90,107,140,0.45)';
  ctx.fill();
  ctx.strokeStyle = on ? C.cyan : 'rgba(124,141,176,0.4)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + (on ? 32 : 14), y + 13, 9.5, 0, Math.PI * 2);
  ctx.fillStyle = on ? '#081226' : '#C7D2EA';
  ctx.fill();
  ctx.restore();
}

function drawSettingsOverlay() {
  // 皮肤模块可插拔：接管设置中心
  const m = SKIN_MODULES[skin.id];
  if (m?.drawSettings) { m.drawSettings(env); return; }
  ctx.fillStyle = 'rgba(7,11,24,0.78)';
  ctx.fillRect(0, 0, VW, VH);
  // 全屏透明热区：吞掉面板外的点击，避免穿透到底层页面
  hitBox({ x: 0, y: 0, w: VW, h: VH, label: '', cb: () => {} });
  const pw = VW - 72;
  const px = 36;
  const rowH = 56;
  const rows: [icon: string, label: string, desc: string, on: boolean, cb: () => void][] = [
    ['🔊', '音效', '攻击 / 爆炸 / 金币等战斗音效', !sfx.muted, () => sfx.setMuted(!sfx.muted)],
    ['🎵', '音乐', '主页与战斗背景音乐', !musicMuted, toggleMusicMuted],
    ['🎙', '旁白', '任务简报语音解说', !narrationMuted, toggleNarrationMuted],
    ['📳', '震动', '建造 / 漏怪 / BOSS 战触感反馈', !vibrateMuted, toggleVibrateMuted],
    ['✨', '高画质', 'Bloom 辉光特效，低端机建议关闭', readWxQualityHigh(), () => {
      const q = !readWxQualityHigh();
      setWxQualityHigh(q);
      qualityHigh = q;
    }],
  ];
  const skinH = 74; // 皮肤切换区高度
  const ph = 72 + rows.length * rowH + skinH + 68;
  const py = VH / 2 - ph / 2;
  panel(px, py, pw, ph, C.panelLine);
  fillText('SETTINGS', VW / 2, py + 24, { size: 9, color: ac(0.7), weight: '600', align: 'center' });
  fillText('设置中心', VW / 2, py + 46, { size: 17, align: 'center' });
  rows.forEach(([icon, label, desc, on, cb], i) => {
    const y = py + 66 + i * rowH;
    if (i > 0) {
      ctx.save();
      ctx.strokeStyle = ac(0.1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 20, y + 0.5);
      ctx.lineTo(px + pw - 20, y + 0.5);
      ctx.stroke();
      ctx.restore();
    }
    fillText(icon, px + 34, y + rowH / 2, { size: 16, align: 'center' });
    fillText(label, px + 56, y + 19, { size: 14 });
    fillText(desc, px + 56, y + 39, { size: 10, color: C.sub, weight: 'normal' });
    drawSwitch(px + pw - 20 - 46, y + rowH / 2 - 13, on);
    hitBox({ x: px + 16, y, w: pw - 32, h: rowH, label: '', cb: () => { cb(); buzz('light'); } });
  });
  // —— 界面皮肤：三套主题色卡，点选即换并持久化 ——
  const skY = py + 66 + rows.length * rowH;
  fillText('🎨', px + 34, skY + 15, { size: 16, align: 'center' });
  fillText('界面皮肤', px + 56, skY + 10, { size: 14 });
  fillText(SKINS.find((s) => s.id === skin.id)?.ref ?? '', px + 56, skY + 30, { size: 10, color: C.sub, weight: 'normal' });
  const chipW = (pw - 40 - 12) / SKINS.length;
  SKINS.forEach((s, i) => {
    const cx0 = px + 20 + i * (chipW + 6);
    const cy0 = skY + 38;
    const on = s.id === skin.id;
    ctx.save();
    rr(cx0, cy0, chipW, 30, 8);
    ctx.fillStyle = on ? ac(0.18) : 'rgba(90,107,140,0.12)';
    ctx.fill();
    ctx.strokeStyle = on ? s.accent : 'rgba(124,141,176,0.35)';
    ctx.lineWidth = on ? 1.6 : 1;
    ctx.stroke();
    ctx.fillStyle = s.accent;
    ctx.beginPath();
    ctx.arc(cx0 + 13, cy0 + 15, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    fillText(s.name, cx0 + 23, cy0 + 15, { size: 11, color: on ? C.text : C.sub });
    hitBox({ x: cx0, y: cy0, w: chipW, h: 30, label: '', cb: () => { applySkin(s.id); buzz('light'); showToast(`已切换「${s.name}」`); } });
  });
  btn({ x: px + 24, y: py + 66 + rows.length * rowH + skinH + 12, w: pw - 48, h: 40, label: '关闭', cb: () => { showSettings = false; } });
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

type Screen = 'splash' | 'home' | 'briefing' | 'battle' | 'result' | 'codex' | 'lobby';
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
  // 玩法模式（§4.3 C 档）：单人 / 在线联机
  mode: 'single' as PlayMode,
  // 分享卡片带入的待加入房间码（邀请横幅数据源）
  pendingRoom: null as string | null,
};

/** 切换玩法模式（home 模式控件调用；埋点 mode 值域：0 单人 / 2 在线联机） */
function setMode(m: PlayMode) {
  if (app.mode === m) return;
  app.mode = m;
  track('coop_toggle', { mode: m === 'online' ? 2 : 0 });
}

// 分享卡片邀请直达：启动参数 query.room（6 位房间码），splash/home 顶部弹邀请横幅
try {
  const room = wx.getLaunchOptionsSync?.().query?.room;
  if (typeof room === 'string' && /^[A-Z0-9]{4,8}$/.test(room)) app.pendingRoom = room;
} catch { /* ignore */ }

/** 页面切换时间戳（淡入过渡用） */
let screenAt = Date.now();
function goto(s: Screen) {
  if (app.screen === s) return;
  // 联机会话集中清理：离开战斗屏即退房（已结算的房间静默关闭，未结算的通知对方）
  if (app.screen === 'battle' && online) teardownOnline(!online.ended);
  // 离开结算页：清掉结算快照的联机信息
  if (app.screen === 'result' && s !== 'result') onlineResultInfo = null;
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
/** 底部塔栏触摸状态机：pending 待定 / scroll 滚动 / drag 拖拽建塔 */
interface BarTouch { mode: 'pending' | 'scroll' | 'drag'; type: TowerType | null; unusable: string | null; startX: number; startY: number; lastX: number }
let barTouch: BarTouch | null = null;
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
// 旧版 'srd.muted' 是音效+音乐总开关：拆分为独立开关时按旧值各迁移一次
const legacyMuted = store.get('srd.muted') === '1';
if (legacyMuted) {
  if (store.get('srd.musicMuted') === '') store.set('srd.musicMuted', '1');
  if (store.get('srd.sfxMuted') === '') sfx.setMuted(true);
}
let musicMuted = store.get('srd.musicMuted') === '1';

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

/** 每帧调用：按当前界面切换音乐（战斗 battle，其余界面含欢迎页 home） */
function syncMusic() {
  const want = musicMuted ? ''
    : app.screen === 'battle' ? 'battle' : 'home';
  if (want === musicTarget) return;
  musicTarget = want;
  if (!want) { stopMusic(); return; }
  playMusic(want);
}

function toggleMusicMuted() {
  musicMuted = !musicMuted;
  store.set('srd.musicMuted', musicMuted ? '1' : '0');
  // syncMusic 对 ''→'' 会短路，静音时必须立即停掉当前 BGM
  if (musicMuted) stopMusic();
  musicTarget = ''; // 强制 syncMusic 重新评估
}

/** 触感反馈（不支持的端静默降级；设置中心可关闭） */
let vibrateMuted = store.get('srd.vibrateMuted') === '1';
let vibrateLastError = '';
function toggleVibrateMuted() {
  vibrateMuted = !vibrateMuted;
  store.set('srd.vibrateMuted', vibrateMuted ? '1' : '0');
  // 开启时立即试震一次，并把 API 结果反馈出来（iOS 上失败通常是静默的，需要主动诊断）
  if (!vibrateMuted) {
    vibrateLastError = '';
    lastBuzzAt = 0;
    buzz('medium');
    setTimeout(() => {
      showToast(vibrateLastError ? `震动调用失败：${vibrateLastError}` : '已试震一次 · 若无震感请检查「设置-声音与触感-系统触感反馈」');
    }, 350);
  }
}
let lastBuzzAt = 0;
function buzz(type: 'heavy' | 'medium' | 'light') {
  if (vibrateMuted) return;
  const now = Date.now();
  if (now - lastBuzzAt < 90) return; // iOS 会静默丢弃过于密集的触感调用
  lastBuzzAt = now;
  try {
    wx.vibrateShort?.({ type, fail: (e?: { errMsg?: string }) => { vibrateLastError = e?.errMsg || 'fail'; } });
  } catch { vibrateLastError = 'exception'; }
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

function toggleNarrationMuted() {
  narrationMuted = !narrationMuted;
  store.set('srd.narrationMuted', narrationMuted ? '1' : '0');
  if (narrationMuted) stopNarration();
  else if (app.screen === 'briefing') startNarration(app.levelId);
}

function gotoBriefing(levelId: number) {
  // 在线联机模式：所有关卡卡 CTA 统一拦截进联机大厅（双子星门固定图，无简报页）
  if (app.mode === 'online') { enterLobby(); return; }
  app.levelId = levelId;
  track('chapter_select', { level_id: levelId });
  goto('briefing');
  startNarration(levelId);
}

// ---------------- 开场动画（深空星海恐怖风 · 最后信号） ----------------

/** 欢迎页专属死寂星野（部分恒星会被"吞噬"般周期性熄灭） */
const splashStars = makeStars(97, 110, VW, VH);
/** 欢迎页背景图（tools/gen-welcome-bg.mjs 程序化渲染；加载完成前用程序化底图兜底） */
const welcomeBgImg = wx.createImage();
const welcomeBg = { ok: false };
welcomeBgImg.onload = () => { welcomeBg.ok = true; };
welcomeBgImg.onerror = () => { welcomeBg.ok = false; };
welcomeBgImg.src = 'assets/welcome-bg.jpg';
/** 虫群孢子：从右上星云渗向蚀星，轨迹全部确定性伪随机 */
const splashSwarm = Array.from({ length: 42 }, (_, i) => ({
  ox: hash01(i * 3 + 11), oy: hash01(i * 7 + 23),
  sp: 0.5 + hash01(i * 13 + 5) * 0.9,
  wob: hash01(i * 17 + 3) * Math.PI * 2,
  big: hash01(i * 29 + 7) < 0.18,
}));

function drawSplash(time: number) {
  hooks = [];
  const t = (Date.now() - app.splashAt) / 1000;

  // 深渊底色：任何情况下先铺底，杜绝边缘露白
  ctx.fillStyle = '#04060E';
  ctx.fillRect(0, 0, VW, VH);
  if (welcomeBg.ok) {
    // 生成的深空恐怖背景（等比铺满，居中裁剪；外加 2px 过扫防止浮点缝隙露白边）
    const iw = welcomeBgImg.width || 720;
    const ih = welcomeBgImg.height || 1280;
    const sc = Math.max(VW / iw, VH / ih);
    const dw = iw * sc;
    const dh = ih * sc;
    ctx.drawImage(welcomeBgImg as unknown as CanvasImageSource, (VW - dw) / 2 - 1, (VH - dh) / 2 - 1, dw + 2, dh + 2);
  } else {
    // 兜底程序化底图（图片未加载完成时）：深渊底色 + 渗血星云 + 蚀星剪影
    const bg = ctx.createLinearGradient(0, 0, 0, VH);
    bg.addColorStop(0, '#04060E');
    bg.addColorStop(0.5, '#060A18');
    bg.addColorStop(1, '#02040A');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);
    const nebPulse = 0.75 + 0.25 * Math.sin(t * 0.4);
    const neb1 = ctx.createRadialGradient(VW * 1.05, -VH * 0.08, 0, VW * 1.05, -VH * 0.08, VW * 1.15);
    neb1.addColorStop(0, `rgba(255,61,129,${0.14 * nebPulse})`);
    neb1.addColorStop(0.55, `rgba(122,79,208,${0.07 * nebPulse})`);
    neb1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb1;
    ctx.fillRect(0, 0, VW, VH);
    const neb2 = ctx.createRadialGradient(VW * 0.1, VH * 0.85, 0, VW * 0.1, VH * 0.85, VW * 0.9);
    neb2.addColorStop(0, 'rgba(139,92,246,0.05)');
    neb2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb2;
    ctx.fillRect(0, 0, VW, VH);

    // 蚀星：右下角被侵染的殖民行星剪影，裂痕随呼吸脉动
    const px = VW * 1.28;
    const py = VH * 1.12;
    const pr = VW * 0.95;
    ctx.save();
    const pg = ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.35, pr * 0.1, px, py, pr);
    pg.addColorStop(0, '#0B1124');
    pg.addColorStop(1, '#02040A');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    const crackA = 0.35 + 0.3 * Math.sin(t * 0.9);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a0 = Math.PI * (1.02 + hash01(i * 41) * 0.44);
      const r0 = pr * (0.55 + hash01(i * 17) * 0.35);
      let tx = px + Math.cos(a0) * r0;
      let ty = py + Math.sin(a0) * r0;
      ctx.strokeStyle = i % 2 ? `rgba(184,255,61,${crackA * 0.5})` : `rgba(255,61,129,${crackA * 0.45})`;
      ctx.lineWidth = 1.2 + hash01(i * 5) * 1.4;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      for (let k = 1; k <= 4; k++) {
        tx += Math.cos(a0 + k) * (6 + hash01(i * 53 + k) * 14);
        ty += Math.sin(a0 + k * 1.7) * (6 + hash01(i * 71 + k) * 14);
        ctx.lineTo(tx, ty);
      }
      ctx.stroke();
    }
    // 轮廓冷光：上缘一线，青 → 品红（正被侵蚀的一侧）
    ctx.lineWidth = 2;
    ctx.strokeStyle = ac(0.28);
    ctx.beginPath(); ctx.arc(px, py, pr, Math.PI, Math.PI * 1.25); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,61,129,0.34)';
    ctx.beginPath(); ctx.arc(px, py, pr, Math.PI * 1.25, Math.PI * 1.5); ctx.stroke();
    ctx.restore();
  }

  // —— 死寂星野：零星恒星周期性熄灭，像被什么东西吃掉 ——
  ctx.save();
  for (let i = 0; i < splashStars.length; i++) {
    const s = splashStars[i];
    let a = 0.25 + 0.5 * Math.abs(Math.sin(t * s.speed * 0.6 + s.tw));
    if (hash01(i * 31 + 1) < 0.12) {
      const cycle = 9 + hash01(i * 7 + 2) * 8;
      const ph = (t + hash01(i * 13 + 4) * 30) % cycle;
      if (ph < 0.9) a *= Math.abs(ph / 0.45 - 1); // 暗灭 → 复明
    }
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = '#CFE0FF';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // —— 虫群孢子：从星云渗出的细小剪影，缓缓压向蚀星 ——
  ctx.save();
  for (let i = 0; i < splashSwarm.length; i++) {
    const sp = splashSwarm[i];
    const prog = (t * 0.03 * sp.sp + sp.ox) % 1.15;
    const sx = VW * (1.12 - prog * 1.05) + Math.sin(t * 0.7 + sp.wob) * 14;
    const sy = VH * (-0.06 + prog * 0.78 + sp.oy * 0.12) + Math.cos(t * 0.5 + sp.wob * 1.3) * 10;
    const tw = 0.5 + 0.5 * Math.sin(t * (2 + sp.sp * 3) + sp.wob * 5);
    ctx.globalAlpha = 0.2 + 0.45 * tw;
    ctx.fillStyle = sp.big ? '#B8FF3D' : '#FF3D81';
    ctx.beginPath();
    ctx.arc(sx, sy, sp.big ? 2.1 : 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // —— 信号干扰：每 6.5s 左右一次短促 glitch（暗带 + 扫描线 + 全局变暗） ——
  const gSeed = Math.floor(t / 6.5);
  const gT = t - gSeed * 6.5;
  const glitch = t > 0.8 && hash01(gSeed * 13 + 7) > 0.25 && gT < 0.3;
  if (glitch) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 3; i++) {
      const gy = hash01(gSeed * 31 + i * 7) * VH;
      ctx.fillStyle = `rgba(2,4,10,${0.25 + hash01(gSeed + i) * 0.3})`;
      ctx.fillRect(0, gy, VW, 6 + hash01(gSeed * 7 + i) * 26);
      ctx.fillStyle = ac(0.05 + hash01(gSeed * 11 + i) * 0.08);
      ctx.fillRect(0, gy - 1, VW, 1.5);
    }
    ctx.restore();
  }

  // —— 破碎星环徽标：断裂的轨道环残段缓缓旋转，中心只剩一粒电压不稳的信标 ——
  const cx = VW / 2;
  const cy = VH * 0.28;
  const ringR = Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.5) * VW * 0.17 + 8;
  const stutter = hash01(Math.floor(t * 6) * 3 + 1) < 0.12 ? 0.15 : 1;
  const emA = Math.min(1, t);
  ctx.save();
  ctx.lineCap = 'round';
  // 主环三段残弧，缓慢转动，弧间是「被咬掉」的缺口
  const rot = t * 0.12;
  for (let i = 0; i < 3; i++) {
    const a0 = rot + i * (Math.PI * 2 / 3) + hash01(i * 7 + 1) * 0.3;
    const span = Math.PI * 2 / 3 - 0.55 - hash01(i * 13 + 2) * 0.25;
    const arcColor = glitch ? C.pink : C.cyan;
    ctx.globalAlpha = emA * 0.85;
    ctx.strokeStyle = arcColor;
    ctx.shadowColor = arcColor;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, a0, a0 + span);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  // 侵蚀弧：外侧品红残段，反向缓转，暗示环已被染指
  ctx.globalAlpha = emA * 0.5;
  ctx.strokeStyle = C.pink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR * 1.18, -rot * 1.6 + 0.6, -rot * 1.6 + 1.5);
  ctx.stroke();
  // 倾斜轨道细线
  ctx.globalAlpha = emA * 0.32;
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, ringR * 1.7, ringR * 0.42, -0.5, 0, Math.PI * 2);
  ctx.stroke();
  // 中心信标：柔光晕 + 脉动亮点
  const pulse = 0.6 + 0.4 * Math.sin(t * 3.2);
  const beaconGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringR * 0.55);
  beaconGlow.addColorStop(0, ac(0.26 * pulse * emA));
  beaconGlow.addColorStop(1, ac(0));
  ctx.globalAlpha = 1;
  ctx.fillStyle = beaconGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = emA * stutter;
  ctx.fillStyle = '#EAFBFF';
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, 3.2 + pulse * 1.6, 0, Math.PI * 2);
  ctx.fill();
  // 求救光束：从信标向上打出，带「电压不稳」的抽动
  ctx.globalAlpha = Math.min(1, Math.max(0, t - 0.35)) * stutter * (0.5 + 0.3 * Math.sin(t * 4));
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - ringR * 1.45);
  ctx.lineTo(cx, cy - 8);
  ctx.stroke();
  ctx.restore();

  // —— 标题：glitch 瞬间红青抖色；副题为"最后信号" ——
  const titleY = cy + ringR * 1.9;
  const titleSize = Math.min(30, VW * 0.082);
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, (t - 0.5) / 0.8));
  if (glitch) {
    fillText('高 塔 防 线', VW / 2 - 2, titleY + 34, { size: titleSize, color: 'rgba(255,61,129,0.65)', align: 'center' });
    fillText('高 塔 防 线', VW / 2 + 2, titleY + 34, { size: titleSize, color: ac(0.65), align: 'center' });
  }
  fillText('TOWER LINE DEFENSE', VW / 2, titleY, { size: 13, color: C.cyan, align: 'center', weight: '600' });
  fillText('高 塔 防 线', VW / 2, titleY + 34, { size: titleSize, align: 'center' });
  fillText('LAST SIGNAL FROM THE RIM', VW / 2, titleY + 58, { size: 9, color: 'rgba(255,61,129,0.8)', align: 'center', weight: '600' });
  ctx.restore();

  // —— 失联讯息：终端打字效果逐行浮现 ——
  const msgs: [text: string, color: string][] = [
    ['» 外环预警网 …… 已失联', 'rgba(61,240,140,0.75)'],
    ['» 它们正从星海深处而来', 'rgba(255,61,129,0.85)'],
  ];
  msgs.forEach(([m, color], i) => {
    const start = 1.2 + i * 1.1;
    const n = Math.max(0, Math.min(m.length, Math.floor((t - start) * 12)));
    if (n > 0) fillText(m.slice(0, n) + (n < m.length ? '▌' : ''), VW / 2, titleY + 82 + i * 20, { size: 11, color, align: 'center', weight: 'normal' });
  });

  // —— 呼吸暗角：四周边缘的黑暗缓慢收缩逼近 ——
  const vg = ctx.createRadialGradient(VW / 2, VH * 0.42, Math.min(VW, VH) * 0.25, VW / 2, VH * 0.42, Math.max(VW, VH) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(1,2,6,${(welcomeBg.ok ? 0.45 : 0.8) + 0.08 * Math.sin(t * 0.5)})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VW, VH);

  // —— 底部监听站标识 ——
  const dim = 0.4 + 0.3 * Math.sin(t * 1.1);
  fillText('深空监听站 · 第 41 轨道周期', VW / 2, VH - 46, { size: 9, color: `rgba(124,141,176,${dim})`, align: 'center', weight: 'normal' });
  fillText('SIGNAL FADING', VW / 2, VH - 30, { size: 8, color: `rgba(255,61,129,${dim * 0.8})`, align: 'center', weight: '600' });
  // 构建号水印：确认真机/预览跑的是哪次打包
  fillText(typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev', VW - 10, VH - 10, { size: 8, color: 'rgba(124,141,176,0.4)', align: 'right', weight: 'normal' });

  // 主菜单（动画放完后上滑浮现）：开始战役 + 图鉴/设置/档案
  const menuA = Math.min(1, Math.max(0, (t - 1.0) / 0.5));
  if (menuA <= 0) {
    // 动画未放完：点击跳过直接进菜单
    if (t > 0.2) hitBox({ x: 0, y: 0, w: VW, h: VH, label: '', cb: () => { app.splashAt = Date.now() - 1500; } });
    return;
  }
  const slide = (1 - menuA) * 16;
  // 皮肤模块可插拔：仅接管主菜单区（开场动画与背景仍由主文件统一绘制；menuA>0 才会走到这里）
  const sm = SKIN_MODULES[skin.id];
  if (sm?.drawSplashMenu) {
    sm.drawSplashMenu(env, time, menuA);
  } else {
  const entries: [icon: string, label: string, color: string, cb: () => void][] = [
    ['📖', '图鉴', C.gold, () => { codex.scroll = 0; goto('codex'); }],
    ['⚙', '设置', C.cyan, () => { showProfile = false; showSettings = true; }],
    ['', '档案', C.green, () => { showSettings = false; showProfile = true; }],
  ];
  ctx.save();
  ctx.globalAlpha = menuA;
  if (skin.id === 'ember') {
    // 琥珀工业 · 指挥台布局：四条全宽切角指令条竖排堆叠，左侧色块引导
    const x0 = MARGIN;
    const w0 = VW - MARGIN * 2;
    const y0 = titleY + 100 + slide;
    panel(x0, y0, w0, 52, `${C.gold}66`);
    ctx.fillStyle = C.gold;
    ctx.fillRect(x0, y0, 6, 52);
    fillText('▶', x0 + 30, y0 + 26, { size: 16, color: C.gold, align: 'center' });
    fillText('开始战役', x0 + 56, y0 + 26, { size: 16 });
    fillText('START OPERATION', x0 + w0 - 16, y0 + 26, { size: 9, color: C.sub, align: 'right', weight: 'normal' });
    hitBox({ x: x0, y: y0, w: w0, h: 52, label: '', cb: () => goto('home') });
    entries.forEach(([icon, label, color, cb], i) => {
      const y = y0 + 62 + i * 54;
      panel(x0, y, w0, 44, `${color}44`);
      ctx.fillStyle = color;
      ctx.fillRect(x0, y, 6, 44);
      if (icon) fillText(icon, x0 + 30, y + 22, { size: 15, align: 'center' });
      else drawAvatar(x0 + 30, y + 22, 11);
      fillText(label, x0 + 56, y + 22, { size: 14 });
      fillText('›', x0 + w0 - 20, y + 22, { size: 15, color: C.sub, align: 'center' });
      hitBox({ x: x0, y, w: w0, h: 44, label: '', cb });
    });
  } else if (skin.id === 'matrix') {
    // 紫晶矩阵 · 放射轮盘布局：主按钮居中，三个霓虹卫星按钮弧线环绕
    const menuY = titleY + 118 + slide;
    btn({ x: VW / 2 - 110, y: menuY, w: 220, h: 54, label: '▶ 开始战役', color: C.gold, primary: true, cb: () => goto('home') });
    const offs: [number, number][] = [[-108, -4], [0, 18], [108, -4]];
    entries.forEach(([icon, label, color, cb], i) => {
      const bx = VW / 2 + offs[i][0];
      const by = menuY + 122 + offs[i][1];
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(bx, by, 26, 0, Math.PI * 2);
      ctx.fillStyle = skin.panelSolid;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
      if (icon) fillText(icon, bx, by, { size: 16, align: 'center' });
      else drawAvatar(bx, by, 11);
      fillText(label, bx, by + 40, { size: 11, color: C.sub, align: 'center' });
      hitBox({ x: bx - 28, y: by - 28, w: 56, h: 56, label: '', cb });
    });
  } else {
    // 深空全息 · 舞台布局：主按钮居中 + 三入口卡横排
    const menuY = titleY + 124 + slide;
    btn({ x: VW / 2 - 110, y: menuY, w: 220, h: 54, label: '▶ 开始战役', color: C.gold, primary: true, cb: () => goto('home') });
    const entryY = menuY + 54 + 16;
    const entryW = (VW - MARGIN * 2 - 20) / 3;
    entries.forEach(([icon, label, color, cb], i) => {
      const x = MARGIN + i * (entryW + 10);
      panel(x, entryY, entryW, 60, `${color}44`);
      if (icon) fillText(icon, x + entryW / 2, entryY + 22, { size: 18, align: 'center' });
      else drawAvatar(x + entryW / 2, entryY + 22, 12);
      fillText(label, x + entryW / 2, entryY + 45, { size: 12, color: C.sub, align: 'center' });
      hitBox({ x, y: entryY, w: entryW, h: 60, label: '', cb });
    });
  }
  ctx.restore();
  }

  if (showProfile) drawProfileOverlay();
  if (showSettings) drawSettingsOverlay();
}

// ---------------- 主页：选关 + 难度 ----------------

const CARD_H = 116;
const CARD_GAP = 12;
const homeTop = TOP_SAFE + 48;
const homeBottom = VH - 26;
const totalScrollMax = () => Math.max(0, LEVELS.length * (CARD_H + CARD_GAP) - (homeBottom - homeTop) + 8);

function drawHome(time: number) {
  hooks = [];
  // 皮肤模块可插拔：整屏接管（模块自绘背景与页头）
  const m = SKIN_MODULES[skin.id];
  if (m?.drawHome) { m.drawHome(env, time); return; }
  drawSpaceBg(time);

  drawHeader('高塔防线 · 战役选择', { back: () => goto('splash') });

  // 难度分段控件（高亮块滑动动画 + 轻震动）+ 右侧 单人/联机 切换
  const segW = VW - MARGIN * 2;
  const segY = TOP_SAFE + 4;
  const diffW = Math.round(segW * 0.6);
  segControl(MARGIN, segY, diffW, DIFF_LIST.map((d) => DIFFICULTIES[d].name), DIFF_LIST.indexOf(app.difficulty), 'diff', (i) => {
    app.difficulty = DIFF_LIST[i];
    track('difficulty_select', { difficulty: app.difficulty });
  });
  segControl(MARGIN + diffW + 10, segY, segW - diffW - 10, ['单人', '联机'], app.mode === 'online' ? 1 : 0, 'mode', (i) => setMode(i === 1 ? 'online' : 'single'));

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
    ctx.fillStyle = ac(0.25);
    rr(VW - 4, ty, 3, thumbH, 1.5);
    ctx.fill();
    ctx.restore();
  }

  fillText('微信小游戏 · 试运营包', VW / 2, VH - 12, { size: 10, color: 'rgba(124,141,176,0.7)', align: 'center' });

  if (showProfile) drawProfileOverlay();
  if (showSettings) drawSettingsOverlay();
}


// ---------------- 简报 ----------------

function drawBriefing(time: number) {
  hooks = [];
  // 皮肤模块可插拔：整屏接管（模块自绘背景与页头）
  const m = SKIN_MODULES[skin.id];
  if (m?.drawBriefing) { m.drawBriefing(env, time); return; }
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
  // 旁白开关（与设置中心共享同一状态）
  btn({
    x: bx + bw - 88, y: by + 10, w: 78, h: 30,
    label: narrationMuted ? '🔇 旁白' : '🔊 旁白', color: narrationMuted ? C.sub : C.cyan,
    cb: toggleNarrationMuted,
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

  if (showSettings) drawSettingsOverlay();
}

// ---------------- 战斗视觉特效（引擎层 game/fx.ts） ----------------

// 星云底图：异步加载，未就绪时 drawMapBackground 自动回退程序化深色底
const nebulaBg = new NebulaBg('assets/nebula-texture.jpg');
// 每场战斗重建（随 engine 生命周期），击杀检测与 H5 一致：diff 敌人列表
let fx: FxLayer | null = null;
let bloom: BloomLayer | null = null;
let pathPixels: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [];
let qualityHigh = readWxQualityHigh(); // 低频轮询存储，避免每帧读 storage
let fxFrame = 0;
/** 本局开战时间戳（结算埋点算时长） */
let battleStartAt = 0;
/** 最近一局结算积分与评级（gameOver 写入，皮肤结算页经 env.getLastSettlement() 读取） */
let lastSettlement: { score: number; grade: Grade } | null = null;

/** 战斗视图初始化（fx/bloom/路径像素/选中态）；单局与联机局（主机/客机）共用 */
function initBattleView() {
  app.placing = null;
  app.selectedId = null;
  app.result = null;
  lastSettlement = null;
  barScroll = 0;
  fx = new FxLayer();
  bloom = new BloomLayer(W, H);
  pathPixels = app.engine!.map.paths.map((p) => p.pixels);
  battleStartAt = Date.now();
}

function startBattle() {
  stopNarration();
  app.engine = createEngine(app.difficulty, app.levelId);
  initBattleView();
  track('game_start', { level_id: app.levelId, difficulty: app.difficulty, coop: 0 });
  goto('battle');
}

// ---------------- 在线联机（C 档 · 主机权威；design/coop-online.md） ----------------
// 主机：跑唯一真实引擎（createEngine coop:true），200ms 广播裁剪快照，双方指令都进它的 dispatchAs；
// 客机：GhostEngine 渲染快照、指令上网。断线重连/心跳/退房由 net.ts 承载，此处只管会话状态机。

interface OnlineSession {
  conn: CoopConn | null;
  /** 入口意图：首次 onOpen 时据此发 create / join */
  intent: { action: 'create' } | { action: 'join'; roomId: string };
  roomId: string;
  player: number;          // 0 主机 / 1 客机
  peerNick: string;
  peerReady: boolean;      // 客机已加入（主机端「开始战斗」前置条件）
  peerLost: boolean;       // 对手断线待重连（战斗内持续横幅）
  started: boolean;        // 已开局（主机点开始 / 客机收到首个快照）
  ended: boolean;          // 结算仲裁已发出/收到（end 已发或游戏已结束）
  connecting: boolean;     // 连接/重连进行中（大厅状态文案）
  snapTimer: ReturnType<typeof setInterval> | null;
}
let online: OnlineSession | null = null;
/** 快照附带事件的帧间缓冲（主机：frame drainEvents 后推入，200ms 广播时 splice 带走） */
const snapEvents: GameEvent[] = [];
/** 结算页展示用的最近一局联机信息（settleOnline 写入，离开 result 时清空） */
let onlineResultInfo: { peerNick: string; player: number } | null = null;

/** 在线局信息：联机会话存活时取会话，否则取结算快照（结算页展示队友昵称/分工用） */
function getOnlineInfo(): { peerNick: string; player: number } | null {
  if (online) return { peerNick: online.peerNick, player: online.player };
  return onlineResultInfo;
}

/** 房间码哈希（埋点脱敏：逐字符累加取模，不上报原码） */
function roomHash(roomId: string): number {
  let h = 0;
  for (const ch of roomId) h = (h + ch.charCodeAt(0)) % 100000;
  return h;
}

/** 结束联机会话：可选先通知服务器退房，再断连清定时器 */
function teardownOnline(sendLeave: boolean) {
  const sess = online;
  if (!sess) return;
  online = null;
  if (sess.snapTimer !== null) clearInterval(sess.snapTimer);
  const conn = sess.conn;
  if (conn) {
    if (sendLeave) conn.send({ t: 'leave' });
    conn.close();
  }
}

/** 联机结算（双方共用入口：gameOver 事件 / end 消息双通道，app.result 防重复）。
 *  各人按个人击杀计分 ×1.2 协同加成；协作图不计战役通关与各关最高 */
function settleOnline(won: boolean) {
  const sess = online;
  if (app.result || !app.engine || !sess) return;
  app.result = { won };
  // 主机权威：由主机广播结算仲裁（客机等到服务器 end 或快照 gameOver 后本地结算）
  if (sess.player === 0 && !sess.ended) sess.conn?.send({ t: 'end', won });
  sess.ended = true; // 游戏结束意味着 end 已发/将至，离开战斗屏时无需再 leave
  onlineResultInfo = { peerNick: sess.peerNick, player: sess.player };
  const st0 = app.engine.state;
  const myKills = st0.killsBy?.[sess.player] ?? st0.kills;
  const gained = Math.round(calcScore({ ...st0, kills: myKills }, app.difficulty, 0, won) * 1.2);
  const grade = battleGrade(st0, won);
  lastSettlement = { score: gained, grade };
  const rankBefore = commanderRank();
  scoreProfile.points += gained;
  scoreProfile.spendable += gained;
  if (gained > scoreProfile.bestSingle) scoreProfile.bestSingle = gained;
  scoreProfile.updatedAt = Date.now();
  saveScore();
  syncScoreToCloud(); // 已登录则同步服务端（静默失败）
  track('score_gain', { score: gained, grade, level_id: 0, coop: 2 });
  track('game_end', {
    level_id: 0,
    difficulty: app.difficulty,
    result: won ? 'win' : 'lose',
    wave_reached: st0.wave,
    duration_sec: Math.round((Date.now() - battleStartAt) / 1000),
    kills: myKills,
    leaks: st0.leaked,
    score: gained,
    grade,
    coop: 2,
  });
  track('room_finish', { room_id: roomHash(sess.roomId), result: won ? 'win' : 'lose', wave: st0.wave });
  const rankAfter = commanderRank();
  if (rankAfter !== rankBefore) showToast(`晋升 · ${rankAfter}`);
  goto('result');
}

/** 联机网络回调（建房/加入共用；sess 闭包绑定，会话被替换后旧回调一律忽略） */
function makeNetHandlers(sess: OnlineSession): CoopCallbacks {
  return {
    onOpen: (reconnected) => {
      if (online !== sess) return;
      sess.connecting = false;
      if (reconnected) { showToast('已重新连接'); return; }
      // 首次连接：按入口意图发建房/加房
      if (sess.intent.action === 'create') {
        sess.conn?.send({ t: 'create', nick: displayNick(), levelId: 0, difficulty: app.difficulty });
      } else {
        sess.conn?.send({ t: 'join', roomId: sess.intent.roomId, nick: displayNick() });
      }
    },
    onRoom: (info) => {
      if (online !== sess) return;
      if (sess.roomId) return; // 重连归位确认，忽略
      sess.roomId = info.roomId;
      sess.conn?.setRejoinInfo({ roomId: info.roomId });
      if (info.role === 'host') {
        sess.player = 0;
        track('room_create', { room_id: roomHash(info.roomId) });
      } else {
        sess.player = 1;
        sess.peerNick = info.hostNick ?? '';
        sess.peerReady = true;
        if (info.difficulty === 'easy' || info.difficulty === 'normal' || info.difficulty === 'hard') {
          app.difficulty = info.difficulty; // 客机难度以房间为准
        }
        track('room_join', { room_id: roomHash(info.roomId) });
        showToast(`已加入 ${sess.peerNick || '好友'} 的房间`);
      }
    },
    onPeer: (nick, status) => {
      if (online !== sess) return;
      if (status === 'joined') {
        sess.peerNick = nick;
        sess.peerReady = true;
        sess.peerLost = false;
        showToast(`${nick} 加入了房间`);
        buzz('light');
      } else if (status === 'lost') {
        sess.peerLost = true;
        showToast('对手断线，等待重连…');
      } else {
        sess.peerLost = false;
        showToast('对手已重连');
      }
    },
    onCmd: (player, cmd) => {
      if (online !== sess) return;
      // 主机收客机指令：以客机身份进引擎（UPGRADE/SELL 越权由引擎拒绝）
      if (sess.player === 0 && app.engine && app.screen === 'battle') app.engine.dispatchAs(player, cmd);
    },
    onSnap: (netState, events) => {
      if (online !== sess || sess.player !== 1) return;
      if (!app.engine) {
        // 首个快照 = 主机已开局：客机建幽灵引擎进战斗（渲染层零改动）
        app.levelId = 0;
        const conn = sess.conn;
        app.engine = createGhostEngine(app.difficulty, 0, (cmd) => {
          conn?.send({ t: 'cmd', player: 1, cmd });
        });
        initBattleView();
        sess.started = true;
        track('game_start', { level_id: 0, difficulty: app.difficulty, coop: 2 });
        goto('battle');
      }
      (app.engine as GhostEngine).applySnap(netState, events);
    },
    onEnd: (won, reason) => {
      if (online !== sess) return;
      sess.ended = true;
      if (app.result) return; // 已结算（本地 gameOver 先行）
      if (app.screen === 'battle' && app.engine) {
        // 对局中被仲裁/解散：按当前进度结算
        settleOnline(won);
      } else {
        // 大厅中房间解散
        showToast(reason === 'peer_left' ? '对手离开了房间' : '房间已解散');
        teardownOnline(false);
        goto('home');
      }
    },
    onError: (code) => {
      if (online !== sess) return;
      showToast(
        code === 'room_full' ? '房间已满'
          : code === 'room_not_found' ? '房间不存在或已解散'
            : code === 'server_full' ? '服务器繁忙，请稍后再试'
              : '联机异常，请稍后再试',
      );
      if (!sess.started) teardownOnline(false); // 未开局直接清会话留在大厅；局中错误不打断战斗
    },
    onReconnecting: (n) => {
      if (online !== sess) return;
      sess.connecting = true;
      showToast(`连接中断，正在重连（${n}/3）…`);
    },
    onClose: () => {
      // 重连耗尽，连接彻底断开
      if (online !== sess) return;
      if (sess.started && app.screen === 'battle' && app.engine) {
        if (sess.player === 0) {
          settleOnline(false); // 主机在战斗中掉线：按当前进度判负结算
        } else {
          showToast('连接已断开');
          app.engine = null;
          teardownOnline(false);
          goto('home');
        }
      } else {
        showToast('连接失败，请检查网络');
        teardownOnline(false);
      }
    },
  };
}

/** 建立联机会话（建房/加入共用入口）；环境不支持联机时 toast 并返回 false */
function openOnlineSession(intent: OnlineSession['intent']): boolean {
  if (online) teardownOnline(false); // 防御：替换旧会话
  const sess: OnlineSession = {
    conn: null, intent, roomId: '', player: intent.action === 'create' ? 0 : 1,
    peerNick: '', peerReady: false, peerLost: false, started: false, ended: false,
    connecting: true, snapTimer: null,
  };
  online = sess;
  const conn = connectCoop(wx, { url: wsUrlFromApiBase(API_BASE), nick: displayNick() }, makeNetHandlers(sess));
  if (!conn) {
    online = null;
    showToast('当前环境不支持联机');
    return false;
  }
  sess.conn = conn;
  return true;
}

function hostCreateRoom() {
  openOnlineSession({ action: 'create' }); // room_create 埋点在 onRoom 拿到房号后打
}

function joinRoom(code: string) {
  app.pendingRoom = null;
  openOnlineSession({ action: 'join', roomId: code }); // room_join 埋点在 onRoom 确认后打
}

/** 进入联机大厅（在线模式的 gotoBriefing 拦截点 / 邀请横幅接受点共用） */
function enterLobby() {
  goto('lobby');
  // 邀请链接直达：自动加入好友房间
  if (app.pendingRoom && !online) joinRoom(app.pendingRoom);
}

/** 邀请好友：分享卡片带 query room=CODE，好友点开即进邀请横幅 */
function shareInvite(roomId: string) {
  track('share_click', { channel: 'coop_invite' });
  try {
    wx.shareAppMessage?.({
      title: `来《高塔防线》和我协同防守「双子星门」！房间码 ${roomId}`,
      imageUrl: 'assets/share-cover.jpg',
      query: `room=${roomId}`,
    });
  } catch { /* ignore */ }
  showToast('分享后好友点开卡片即可加入');
}

/** 主机开局：建协作引擎 + 200ms 快照广播 */
function startOnlineBattle() {
  const sess = online;
  if (!sess || sess.player !== 0 || !sess.peerReady || sess.started) return;
  stopNarration();
  app.levelId = 0; // 协作图「双子星门」
  app.engine = createEngine(app.difficulty, 0, { coop: true });
  initBattleView();
  sess.started = true;
  snapEvents.length = 0;
  sess.snapTimer = setInterval(() => {
    const eng = app.engine;
    if (online !== sess || !eng || !sess.conn?.connected) return;
    // serializeNet 剔除装饰数组；JSON.stringify 同步取值，引用安全
    sess.conn.send({ t: 'snap', state: eng.serializeNet(), events: snapEvents.splice(0) });
  }, 200);
  track('game_start', { level_id: 0, difficulty: app.difficulty, coop: 2 });
  goto('battle');
}

// ---------------- 联机大厅（内置兜底渲染，皮肤无接管） ----------------

function drawLobby() {
  hooks = [];
  drawSpaceBg(Date.now() / 1000);
  drawHeader('在线联机 · 双子星门', { back: () => { teardownOnline(true); goto('home'); } });
  const sess = online;
  const px = MARGIN;
  const pw = VW - MARGIN * 2;
  let y = TOP_SAFE + 24;

  // 玩法说明卡
  panel(px, y, pw, 96, C.panelLine);
  fillText('CO-OP ONLINE', px + 16, y + 20, { size: 10, color: C.cyan, weight: '600' });
  fillText('与好友各守一条防线', px + 16, y + 42, { size: 15 });
  fillText('共享生命 · 经济独立 · 击杀各计 · 结算 ×1.2', px + 16, y + 66, { size: 11, color: C.sub, weight: 'normal' });
  y += 116;

  if (!sess) {
    // 入口状态：建房 / 加房（加房走邀请卡片直达，无手输房码）
    if (app.pendingRoom) {
      btn({
        x: px, y, w: pw, h: 52, label: `加入好友的房间 ${app.pendingRoom}`, color: C.green, primary: true,
        cb: () => joinRoom(app.pendingRoom!),
      });
      y += 66;
    }
    btn({ x: px, y, w: pw, h: 52, label: '✚ 创建房间', color: C.cyan, primary: !app.pendingRoom, cb: hostCreateRoom });
    y += 66;
    fillText('建房后邀请好友，好友点开分享卡片即可加入', VW / 2, y + 10, { size: 11, color: C.dim, align: 'center', weight: 'normal' });
    return;
  }

  if (sess.player === 0) {
    // 主机：房间码大字 + 邀请 + 状态 + 开始
    panel(px, y, pw, 132, C.panelLine);
    fillText('房间码', px + 16, y + 22, { size: 11, color: C.sub, weight: 'normal' });
    fillText(sess.roomId || '······', VW / 2, y + 62, { size: 34, color: C.gold, align: 'center', font: RES_FONT() });
    fillText(
      sess.connecting ? '连接服务器中…' : sess.peerReady ? `${sess.peerNick} 已就位` : '等待好友加入…',
      VW / 2, y + 102, { size: 12, color: sess.peerReady ? C.green : C.sub, align: 'center', weight: 'normal' },
    );
    y += 150;
    btn({ x: px, y, w: pw, h: 46, label: '📣 邀请好友', color: C.pink, disabled: !sess.roomId, cb: () => shareInvite(sess.roomId) });
    y += 60;
    btn({
      x: px, y, w: pw, h: 54, label: '▶ 开始战斗', color: C.green, primary: true,
      disabled: !sess.peerReady || sess.connecting, cb: startOnlineBattle,
    });
    y += 68;
    fillText(`难度 ${DIFFICULTIES[app.difficulty].name}（建房时选定）`, VW / 2, y + 8, { size: 11, color: C.dim, align: 'center', weight: 'normal' });
  } else {
    // 客机：已加入，等待主机开始
    panel(px, y, pw, 120, C.panelLine);
    fillText(`已加入 ${sess.peerNick || '好友'} 的房间`, VW / 2, y + 32, { size: 16, align: 'center' });
    fillText(`房间码 ${sess.roomId} · 难度 ${DIFFICULTIES[app.difficulty].name}`, VW / 2, y + 60, { size: 11, color: C.sub, align: 'center', weight: 'normal' });
    // 等待动画：三点轮换
    const dots = '.'.repeat(1 + (Math.floor(Date.now() / 500) % 3));
    fillText(sess.connecting ? '连接服务器中…' : `等待主机开始战斗${dots}`, VW / 2, y + 90, { size: 12, color: C.gold, align: 'center', weight: 'normal' });
    y += 140;
  }
  if (sess.peerLost) {
    fillText('⚠ 对手断线，等待重连（60s 内）…', VW / 2, y + 10, { size: 12, color: C.red, align: 'center' });
  }
}

/** 客机 tech 阶段：科技三选一以主机为准，客机画等待面板（引擎本就拒绝 player 1 的 PICK_TECH） */
function drawTechWaiting() {
  ctx.fillStyle = 'rgba(7,11,24,0.85)';
  ctx.fillRect(0, 0, VW, VH);
  const pw2 = VW - 96;
  const ph2 = 108;
  const py2 = VH / 2 - ph2 / 2;
  panel(48, py2, pw2, ph2, C.panelLine);
  fillText('战术模块整备中', VW / 2, py2 + 34, { size: 16, align: 'center' });
  const dots = '.'.repeat(1 + (Math.floor(Date.now() / 500) % 3));
  fillText(`等待主机选择战术模块${dots}`, VW / 2, py2 + 66, { size: 12, color: C.sub, align: 'center', weight: 'normal' });
}

/** 邀请进入横幅（分享卡片 query.room 带入；皮肤无关，帧尾绘制盖在当前页之上） */
function drawInviteBanner() {
  const bx = MARGIN;
  const bw = VW - MARGIN * 2;
  const by = TOP_SAFE + 4;
  panel(bx, by, bw, 64, 'rgba(61,240,140,0.45)');
  fillText('🤝 好友邀你联机协作', bx + 16, by + 20, { size: 13, color: C.green });
  fillText(`房间码 ${app.pendingRoom} · 双子星门`, bx + 16, by + 42, { size: 11, color: C.sub, weight: 'normal' });
  btn({
    x: bx + bw - 140, y: by + 14, w: 96, h: 36, label: '接受邀请', color: C.green, primary: true,
    cb: () => { setMode('online'); enterLobby(); },
  });
  btn({ x: bx + bw - 36, y: by + 14, w: 30, h: 36, label: '✕', color: C.sub, cb: () => { app.pendingRoom = null; } });
}

// ---------------- 战斗 ----------------

function drawBattle() {
  hooks = [];
  ctx.fillStyle = '#070B18';
  ctx.fillRect(0, 0, VW, VH); // 整屏清底，避免顶部安全区残留上一帧内容
  const engine = app.engine!;
  const st = engine.state;

  drawBattleScene();

  // 皮肤模块可插拔：HUD+prep / 底部塔栏 / 拖拽幽灵 / 科技三选一 可分别接管
  const bm = SKIN_MODULES[skin.id];

  // 顶部 HUD（位于胶囊下方安全区）：34px 整体悬浮横条，从左到右 生命 / 金币 / 波次+进度线 / 三个内嵌指令按钮
  if (bm?.drawBattleHUD) {
    bm.drawBattleHUD(env, engine);
  } else {
  const hudY = TOP_SAFE;
  const hudH = 34;
  const hudX = 12;
  const hudR = Math.min(VW - 12, CAP_LEFT - 8 - GAME_CENTER_PAD); // 右缘避让胶囊
  const hudW = hudR - hudX;
  panel(hudX, hudY, hudW, hudH, C.panelLine, 10);
  const midY = hudY + hudH / 2;
  const vDiv = (x: number, inset = 8) => {
    ctx.save();
    ctx.strokeStyle = ac(0.2);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, hudY + inset);
    ctx.lineTo(x + 0.5, hudY + hudH - inset);
    ctx.stroke();
    ctx.restore();
  };

  // 右侧：三个 30×34 内嵌指令按钮（⏸/▶、1x/2x、≡ 返回选关）
  const segW = 30;
  const btnX0 = hudR - segW * 3;
  const segBtns: [label: string, color: string, cb: () => void][] = [
    [st.paused ? '▶' : '⏸', C.text, () => engineCmd({ type: 'TOGGLE_PAUSE' })],
    [st.speed === 2 ? '2x' : '1x', st.speed === 2 ? C.gold : C.text, () => engineCmd({ type: 'SET_SPEED', speed: st.speed === 2 ? 1 : 2 })],
    ['≡', C.text, () => { app.engine = null; goto('home'); }],
  ];
  segBtns.forEach(([label, color, cb], i) => {
    fillText(label, btnX0 + i * segW + segW / 2, midY, { size: 12, color, align: 'center', font: RES_FONT() });
    if (i > 0) vDiv(btnX0 + i * segW, 10);
    hitBox({ x: btnX0 + i * segW, y: hudY, w: segW, h: hudH, label: '', cb });
  });
  vDiv(btnX0 - 8);

  // 左侧状态段：❤ 生命（≤5 闪烁告警）/ ◈ 金币 / 波次+2px 进度线，细分隔线相隔
  const livesTxt = `❤ ${st.lives}`;
  const goldTxt = `◈ ${st.gold}`;
  const waveTxt = `${st.wave}/${st.totalWaves}`;
  ctx.save();
  ctx.font = `bold 12px ${RES_FONT()}`;
  const livesW = ctx.measureText(livesTxt).width;
  const goldW = ctx.measureText(goldTxt).width;
  const waveW = ctx.measureText(waveTxt).width;
  ctx.restore();
  const blinkOff = st.lives <= 5 && Math.floor(Date.now() / 400) % 2 === 1;
  let cx = hudX + 12;
  fillText(livesTxt, cx, midY, { size: 12, color: blinkOff ? 'rgba(255,61,90,0.35)' : C.red, font: RES_FONT() });
  cx += livesW + 8;
  vDiv(cx);
  cx += 8;
  fillText(goldTxt, cx, midY, { size: 12, color: C.gold, font: RES_FONT() });
  cx += goldW + 8;
  vDiv(cx);
  cx += 8;
  const waveCx = Math.min(cx + (btnX0 - 16 - cx) / 2, btnX0 - 16 - waveW / 2);
  fillText(waveTxt, waveCx, midY - 2, { size: 12, color: C.cyan, align: 'center', font: RES_FONT() });
  const progW = waveW + 10;
  const progX = waveCx - progW / 2;
  const progY = hudY + hudH - 5;
  ctx.save();
  ctx.fillStyle = ac(0.18);
  ctx.fillRect(progX, progY, progW, 2);
  ctx.fillStyle = C.cyan;
  ctx.fillRect(progX, progY, progW * Math.min(1, st.wave / st.totalWaves), 2);
  ctx.restore();

  if (st.phase === 'prep') {
    // prep 面板尺寸不变，y 按新横条底边重排（34 高 + 8px 缝）
    const by2 = hudY + hudH + 8;
    panel(VW / 2 - 118, by2, 236, 56, C.panelLine, 19);
    fillText(`第 ${st.wave} 波 · ${Math.max(0, Math.ceil(st.prepT))}s 后来袭`, VW / 2, by2 + 15, { size: 13, align: 'center', font: RES_FONT() });
    // 下一波敌情预告（数量统计 + BOSS 警示）
    const groups = engine.level.waves[st.wave - 1]?.groups ?? [];
    const isBossWave = engine.level.waves[st.wave - 1]?.isBoss ?? false;
    const summary = [...new Set(groups.map(g => `${ENEMIES[g.type].name}×${g.count}`))].join(' ');
    const cCol = isBossWave ? C.pink : '#FF9F43';
    fillText(`${isBossWave ? '⚠ BOSS 波 · ' : ''}${summary}`, VW / 2, by2 + 34, { size: 9, color: isBossWave ? C.pink : '#FF9F43', align: 'center', weight: 'normal' });
    fillText(
      isBossWave ? '建议留好金币与穿甲火力' : '据此提前调整布防',
      VW / 2, by2 + 47, { size: 9, color: C.sub, align: 'center', weight: 'normal' },
    );
    btn({ x: VW / 2 - 62, y: by2 + 66, w: 124, h: 36, label: '▶ 立即开战', color: C.gold, primary: true, cb: () => engineCmd({ type: 'SKIP_PREP' }) });
  }
  }

  // 底部塔栏 / 选中升级出售栏
  if (bm?.drawBottomBar) bm.drawBottomBar(env, engine);
  else drawBottomBar(st);

  // 拖拽建塔幽灵预览
  if (barTouch?.mode === 'drag' && dragPos && barTouch.type) {
    if (bm?.drawDragGhost) bm.drawDragGhost(env, engine, barTouch.type, dragPos);
    else drawDragGhost(st, barTouch.type, dragPos);
  }

  if (st.paused) {
    ctx.fillStyle = 'rgba(7,11,24,0.6)';
    ctx.fillRect(0, 0, VW, VH);
    const pw2 = 220;
    const ph2 = 84;
    const px2 = VW / 2 - pw2 / 2;
    const py2 = (VH - BAR_H) / 2 - ph2 / 2;
    panel(px2, py2, pw2, ph2, 'rgba(255,201,77,0.5)');
    fillText('已暂停', VW / 2, py2 + 32, { size: 16, color: C.gold, align: 'center' });
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
    if (online?.started && online.player === 1) drawTechWaiting(); // 联机客机：科技以主机为准
    else if (bm?.drawTechOverlay) bm.drawTechOverlay(env, engine);
    else drawTechOverlay(st);
  } else {
    techShownAt = 0;
  }

  // 在线联机：对手断线持续横幅（帧尾绘制，盖在所有皮肤 HUD 之上）
  if (online?.peerLost) {
    panel(40, VH * 0.16, VW - 80, 40, 'rgba(255,90,90,0.5)');
    fillText('⚠ 对手断线，等待重连（60s 内）…', VW / 2, VH * 0.16 + 20, { size: 12, color: C.red, align: 'center' });
  }

  if (showSettings) drawSettingsOverlay();
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
  ctx.strokeStyle = ac(0.22);
  ctx.beginPath();
  ctx.moveTo(0, VH - BAR_H + 0.5);
  ctx.lineTo(VW, VH - BAR_H + 0.5);
  ctx.stroke();

  if (st.phase === 'tech') return;

  const sel = app.selectedId != null ? st.towers.find((t) => t.id === app.selectedId) : undefined;
  if (sel) {
    const def = TOWERS[sel.type];
    fillText(`${def.name} Lv${sel.level + 1}`, MARGIN + 4, VH - BAR_H + 17, { size: 13, color: def.color });
    const upCost = sel.level < 2 ? TOWERS[sel.type].levels[sel.level + 1].cost : -1;
    btn({
      x: MARGIN, y: VH - BAR_H + 34, w: VW / 2 - MARGIN - 6, h: 46,
      label: upCost >= 0 ? `升级 ◈ ${upCost}` : '已满级', disabled: upCost < 0 || st.gold < upCost,
      color: C.green, primary: upCost >= 0 && st.gold >= upCost,
      cb: () => { if (engineCmd({ type: 'UPGRADE', id: sel.id })) { sfx.play('upgrade'); buzz('light'); } },
    });
    const refund = Math.floor(sel.invested * SELL_RATE);
    btn({
      x: VW / 2 + 6, y: VH - BAR_H + 34, w: VW / 2 - MARGIN - 6, h: 46, label: `出售 +${refund}`,
      color: '#FF9F43', cb: () => { if (engineCmd({ type: 'SELL', id: sel.id })) sfx.play('sell'); app.selectedId = null; },
    });
    return;
  }

  if (app.placing) {
    const def = TOWERS[app.placing];
    fillText(`点击地图上绿色格建造「${def.name}」`, VW / 2, VH - BAR_H + 19, { size: 13, color: def.color, align: 'center' });
    btn({ x: VW / 2 - 76, y: VH - BAR_H + 38, w: 152, h: 42, label: '取消放置', cb: () => { app.placing = null; } });
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
    // 槽内仅保留图标 + 价格，图标放大居中于上半区，价格贴近槽底
    ctx.translate(bx + sw / 2, by + 27);
    drawTower(ctx, type, 0, 38, Math.sin(st.clock * 1.1) * 0.1, 0, st.clock, { ticks: false });
    ctx.restore();
    fillText(`◈${cost}`, bx + sw / 2, by + 54, { size: 11, color: disabled ? '#C77A34' : C.gold, align: 'center' });
    if (locked) {
      // 锁遮罩：半透明压暗 + 锁图标 + 解锁章节
      ctx.save();
      rr(bx, by, sw, slotH, 12);
      ctx.fillStyle = 'rgba(7,11,24,0.55)';
      ctx.fill();
      ctx.strokeStyle = C.sub;
      ctx.lineWidth = 1.6;
      const lx = bx + sw / 2;
      const ly = by + 27;
      ctx.beginPath();
      ctx.rect(lx - 7, ly - 1, 14, 11);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(lx, ly - 1, 5, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
      fillText(`第${TOWER_UNLOCK[type]}章`, bx + sw / 2, by + 54, { size: 10, color: C.sub, align: 'center' });
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
  // 皮肤模块可插拔：整屏接管（模块自绘背景与页头）
  const m = SKIN_MODULES[skin.id];
  if (m?.drawResult) { m.drawResult(env, time); return; }
  drawSpaceBg(time);
  const won = app.result!.won;
  const st = app.engine!.state;
  const oi = getOnlineInfo(); // 在线局信息（结算页展示队友/个人击杀用）
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

  drawHeader(oi ? '协同作战结算' : '战斗结算', { back: () => goto('home') });
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
    won ? (oi ? '在线协同 · 双子星门' : `第 ${app.levelId} 章 · ${LEVELS.find((l) => l.id === app.levelId)?.name ?? ''}`) : `撑到了第 ${st.wave} / ${st.totalWaves} 波`,
    VW / 2, y0 + 32, { size: 13, color: C.sub, align: 'center', weight: 'normal' },
  );

  // 本局积分（优先取 gameOver 入账的结算值；联机局为个人击杀 ×1.2，重算公式会失真）
  const gained = lastSettlement ? lastSettlement.score : calcScore(st, app.difficulty, app.levelId, won);
  // 在线局：击杀数按个人击杀分账显示
  const myKills = oi ? (st.killsBy?.[oi.player] ?? st.kills) : st.kills;
  // 战绩面板（数字滚动递增）；末行「积分 +N」金色（随同一 count-up 节奏滚动）
  const rows: [k: string, v: string, num: number | null, color?: string, plus?: boolean][] = [
    ['击杀', String(myKills), myKills],
    ['漏怪', String(st.leaked), st.leaked],
    ['剩余生命', `${st.lives} / ${st.maxLives}`, null],
    ['赚取金币', String(st.goldEarned), st.goldEarned],
    ['战术模块', String(st.techs.length), st.techs.length],
    ['积分', `+${gained}`, gained, C.gold, true],
  ];
  if (oi) rows.splice(1, 0, ['在线协同', `队友 ${oi.peerNick || '—'}`, null, C.cyan]);
  const px = 24;
  const pw = VW - 48;
  const py = y0 + 58;
  const rowH = 36;
  panel(px, py, pw, rows.length * rowH + 20, C.panelLine);
  rows.forEach(([k, v, num, color, plus], i) => {
    const ry = py + 28 + i * rowH;
    fillText(k, px + 22, ry, { size: 13, color: color ?? C.sub, weight: 'normal' });
    const shown = num === null
      ? v
      : `${plus ? '+' : ''}${Math.round(num * Math.min(1, Math.max(0, (t - 0.25 - i * 0.12) / 0.6)))}`;
    fillText(shown, px + pw - 22, ry, { size: 16, align: 'right', font: RES_FONT(), color });
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
  const grade = battleGrade(st, won);
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
  fillText(won ? (oi ? '协同加成 ×1.2 已入账' : '下一章解锁已记录') : '再挑战一次就能通过', gx + 44, gy3 + 18, { size: 10, color: C.sub, align: 'center', weight: 'normal' });
  // 军衔进度副文案：当前军衔 · 距下一档差额（满级显示已达最高军衔）
  const rp = rankProgress();
  fillText(
    rp.next === null
      ? `${rp.name} · 已达最高军衔`
      : `${rp.name} · 距「${rp.nextName}」还差 ${(rp.next - rp.points).toLocaleString('en-US')} 分`,
    gx + 44, gy3 + 34, { size: 10, color: C.gold, align: 'center', weight: 'normal' },
  );
  ctx.restore();

  let y = py + rows.length * rowH + 40;
  const nextId = app.levelId + 1;
  const hasNext = !oi && LEVELS.some((l) => l.id === nextId); // 联机协作图不是战役关，无「进入下一章」
  if (won) {
    // 激励视频广告位（流量主开通后接入 wx.createRewardedVideoAd 实现真翻倍）
    btn({ x: px, y, w: pw, h: 50, label: '◈ 双倍战利 · 观看视频', color: C.gold, cb: () => { showToast('广告模块开发中'); } });
    y += 62;
  }
  if (won && hasNext) {
    btn({ x: px, y, w: pw, h: 54, label: `▶ 进入第 ${nextId} 章`, color: C.green, primary: true, cb: () => gotoBriefing(nextId) });
    y += 68;
  }
  // 炫耀战绩：主动拉起分享，标题带本局成绩（不落库，仅分享卡片 + 埋点）
  btn({
    x: px, y, w: pw, h: 46, label: '📣 炫耀战绩', color: C.pink,
    cb: () => {
      track('share_click', { channel: 'result', result: won ? 'win' : 'lose', wave: st.wave });
      try {
        wx.shareAppMessage?.({
          title: won
            ? `我在《高塔防线》守住了第 ${app.levelId} 关 · 全 ${st.totalWaves} 波，漏怪 ${st.leaked}！`
            : `我在《高塔防线》第 ${app.levelId} 关撑到了第 ${st.wave} 波，求支援！`,
          imageUrl: 'assets/share-cover.jpg',
        });
      } catch { /* ignore */ }
    },
  });
  y += 58;
  btn({ x: px, y, w: (pw - 12) / 2, h: 46, label: won ? '再来一局' : '再战本关', color: C.gold, cb: () => gotoBriefing(app.levelId) });
  btn({ x: px + (pw - 12) / 2 + 12, y, w: (pw - 12) / 2, h: 46, label: '返回选关', cb: () => goto('home') });

  if (showSettings) drawSettingsOverlay();
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
  ctx.restore();
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
  // 皮肤模块可插拔：整屏接管（模块自绘背景与页头）
  const m = SKIN_MODULES[skin.id];
  if (m?.drawCodex) { m.drawCodex(env, time); return; }
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
    ctx.fillStyle = ac(0.25);
    rr(VW - 4, ty, 3, thumbH, 1.5);
    ctx.fill();
    ctx.restore();
  }

  if (showProfile) drawProfileOverlay();
  if (showSettings) drawSettingsOverlay();
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
    const evs = app.engine.drainEvents();
    // 主机：事件随下一次快照广播给客机（客机 drainEvents 出来的是快照外层事件，不回填）
    if (online?.player === 0 && online.started && evs.length) snapEvents.push(...evs);
    for (const ev of evs) {
      if (ev.type === 'leak') { sfx.play('leak'); buzz('heavy'); leakFlashAt = Date.now(); }
      else if (ev.type === 'waveStart') sfx.play('waveStart');
      else if (ev.type === 'waveClear') sfx.play('waveClear');
      else if (ev.type === 'bossDown') { sfx.play('boss'); buzz('heavy'); }
      else if (ev.type === 'sfx') sfx.play(ev.name);
      else if (ev.type === 'gameOver') {
        if (app.result) continue; // 联机双通道（end 消息 / 快照事件）防重复结算
        sfx.play(ev.won ? 'victory' : 'defeat');
        buzz(ev.won ? 'medium' : 'heavy');
        // 在线联机：走联机结算（个人击杀 ×1.2、不计战役进度；主机先发 end 仲裁）
        if (online) { settleOnline(ev.won); continue; }
        app.result = { won: ev.won };
        // 结算埋点（wave_fail 并入：失败时 result=lose + wave_reached 即失败波次，不重复打）
        const st0 = app.engine.state;
        const levelId = app.engine.level.id;
        // 积分入账（公式见 design/multiplayer.md §3.1）：累计/消费积分同增，刷榜单局与各关最高
        const gained = calcScore(st0, app.difficulty, levelId, ev.won);
        const grade = battleGrade(st0, ev.won);
        lastSettlement = { score: gained, grade };
        const rankBefore = commanderRank();
        scoreProfile.points += gained;
        scoreProfile.spendable += gained;
        if (gained > scoreProfile.bestSingle) scoreProfile.bestSingle = gained;
        if (gained > (scoreProfile.perLevelBest[levelId] ?? 0)) scoreProfile.perLevelBest[levelId] = gained;
        scoreProfile.updatedAt = Date.now();
        saveScore();
        syncScoreToCloud(); // 已登录则同步服务端（静默失败）
        track('score_gain', { score: gained, grade, level_id: levelId, coop: 0 });
        track('game_end', {
          level_id: levelId,
          difficulty: app.difficulty,
          result: ev.won ? 'win' : 'lose',
          wave_reached: st0.wave,
          duration_sec: Math.round((Date.now() - battleStartAt) / 1000),
          kills: st0.kills,
          leaks: st0.leaked,
          score: gained,
          grade,
          coop: 0,
        });
        if (ev.won) recordLevelClear(levelId);
        const rankAfter = commanderRank();
        if (rankAfter !== rankBefore) showToast(`晋升 · ${rankAfter}`);
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
    else if (app.screen === 'lobby') drawLobby();

    // 邀请进入横幅（分享卡片 query.room 带入；皮肤无关，盖在 splash/home 之上）
    if (app.pendingRoom && (app.screen === 'home' || app.screen === 'splash')) drawInviteBanner();

    // 页面切换过渡：风格随皮肤（fade 淡入 / wipe 切角挡板横扫 / glitch 黑场色带）
    const ft = (Date.now() - screenAt) / 240;
    if (ft < 1) {
      if (skin.transition === 'wipe') {
        // 切角挡板：三块斜切遮罩（rr 随 skin.chrome 出切角）错峰从右向左扫出屏幕，进度驱动
        const bands = 3;
        const bh = VH / bands;
        for (let i = 0; i < bands; i++) {
          const p = Math.min(1, Math.max(0, ft * 1.7 - i * 0.22));
          if (p >= 1) continue;
          const e = 1 - (1 - p) ** 3; // easeOutCubic
          const x = -e * (VW + 96);
          rr(x, i * bh - 1, VW + 96, bh + 2, 26);
          ctx.fillStyle = skin.panelSolid;
          ctx.fill();
          ctx.strokeStyle = ac(0.55);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else if (skin.transition === 'glitch') {
        // 故障：黑场渐散 + accent 低透明度水平色带离散跳变（量化进度 + hash01，帧间确定性）
        const a = 1 - ft;
        ctx.fillStyle = `rgba(2,4,10,${a.toFixed(3)})`;
        ctx.fillRect(0, 0, VW, VH);
        const frameSeed = Math.floor(ft * 14) * 31;
        for (let i = 0; i < 5; i++) {
          const gy = hash01(frameSeed + i * 7 + 3) * VH;
          const gh = 3 + hash01(frameSeed + i * 13 + 5) * 22;
          const gx = (hash01(frameSeed + i * 17 + 9) - 0.5) * 48 * a;
          ctx.fillStyle = ac(0.32 * a * (0.4 + hash01(frameSeed + i * 5 + 1) * 0.6));
          ctx.fillRect(gx, gy, VW, gh);
        }
      } else {
        ctx.fillStyle = `rgba(7,11,24,${(1 - ft).toFixed(3)})`;
        ctx.fillRect(0, 0, VW, VH);
      }
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

// ---------------- 皮肤模块环境（单例） ----------------
// 对象字面量 + getter/setter：可变对象（C/app/codex）直接引用共享，可变 let（skin/barScroll/
// techShownAt/qualityHigh 等）经 getter/setter 转发，保证模块读到的永远是最新值。
// 放在触摸注册之前：模块顶层求值到此行时，上面所有 let 均已初始化（避开 TDZ），
// 而 env 首次被使用是在 frame()/触摸回调里，时机安全。

/** 皮肤在 handleTouch('end') 里 env.consumeTap() 置位，主循环当次跳过内置 hooks 点击派发，用后清零 */
let tapConsumed = false;

const env: SkinEnv = {
  // 画布与布局
  ctx, VW, VH, DPR, TOP_SAFE, CAP_MID, CAP_LEFT, GAME_CENTER_PAD, MARGIN, RADIUS, BAR_H,
  mapScale, mapOX, mapOY, toMapX, toMapY,
  getMapPan: () => mapPan,
  mapPanMin, homeTop, homeBottom, totalScrollMax,
  // 配色
  C,
  get skin() { return skin; },
  ac,
  // 绘制助手
  fillText, rr, panel, wrapBlock, wrapCount, shade, btn, hitBox, chip, segControl, drawSwitch,
  drawAvatar, drawCardArt, drawSpaceBg, drawStars, RES_FONT, rng, hash01, drawTower, drawEnemy,
  // 状态访问
  app, codex,
  getScreenAt: () => screenAt,
  showProfile: () => showProfile,
  setShowProfile: (v) => { showProfile = v; },
  showSettings: () => showSettings,
  setShowSettings: (v) => { showSettings = v; },
  getPressedBtn: () => pressedBtn,
  getTechShownAt: () => techShownAt,
  setTechShownAt: (v) => { techShownAt = v; },
  get barScroll() { return barScroll; },
  set barScroll(v: number) { barScroll = v; },
  getEngine: () => app.engine,
  // 数据
  LEVELS, DIFF_LIST, DIFFICULTIES, TOWER_LIST, ENEMY_LIST, TOWERS, ENEMIES, TECHS,
  TOWER_ORDER, TOWER_UNLOCK, SELL_RATE, STORY_PARAS, CODEX_TABS, ENEMY_CATEGORY,
  SLOT_W, SLOT_GAP, stripMaxScroll, SKINS, CELL, COLS, ROWS,
  // 进度与解锁
  loadProgress, unlockedChapter, towerUnlocked,
  // 动作
  goto, gotoBriefing, stopNarration, startBattle, engineCmd, applySkin, authUser, openFeedback,
  setMode, getOnlineInfo,
  // 主动拉起分享（判空包装 wx.shareAppMessage）
  shareAppMessage: (o) => { try { wx.shareAppMessage?.(o); } catch { /* ignore */ } },
  commanderRank, displayNick,
  getProfile: () => profile,
  getScore: () => scoreProfile,
  getRankProgress: rankProgress,
  getLastSettlement: () => lastSettlement,
  // 反馈
  sfx, buzz, showToast, track, store,
  getToast: () => toast,
  // 设置项状态
  musicMuted: () => musicMuted,
  toggleMusicMuted,
  narrationMuted: () => narrationMuted,
  toggleNarrationMuted,
  vibrateMuted: () => vibrateMuted,
  toggleVibrateMuted,
  readQualityHigh: readWxQualityHigh,
  setQualityHigh: (v) => { setWxQualityHigh(v); qualityHigh = v; },
  // 触摸接管
  consumeTap: () => { tapConsumed = true; },
};

// ---------------- 触控 ----------------

let touchTime = 0;

wx.onTouchStart((e) => {
  const p0 = e.touches[0];
  if (!p0) return;
  sfx.init(); // 首次用户手势时初始化 WebAudio
  const p = touchPoint(p0);
  // 皮肤模块可插拔：返回 true 表示消费该事件，跳过默认处理
  if (SKIN_MODULES[skin.id]?.handleTouch?.(env, 'start', p)) return;
  touchTime = Date.now();

  // 按钮按压反馈：记录当前按下的按钮（命中最新一帧的 hooks）
  pressedBtn = null;
  for (let i = hooks.length - 1; i >= 0; i--) {
    const b = hooks[i];
    if (!b.disabled && hit(p, b)) { pressedBtn = b; break; }
  }

  // 弹层（设置中心/指挥官档案）打开时，底层页面不响应滑动与战斗手势；面板按钮由 touchend 的 hooks 触发
  if (showSettings || showProfile) return;

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
        if (engine.dispatch({ type: 'BUILD', col: cx, row: cy, tower: app.placing })) {
          sfx.play('build'); buzz('light');
          track('tower_build', { tower_type: app.placing, level_id: app.levelId, wave: engine.state.wave });
        }
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
  // 皮肤模块可插拔：返回 true 表示消费该事件，跳过默认处理
  if (SKIN_MODULES[skin.id]?.handleTouch?.(env, 'move', p)) return;

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
  // 皮肤模块可插拔：返回 true 消费整个事件；返回 falsy 时若模块调用了 env.consumeTap()，
  // 仍走默认手势收尾，但跳过最后的内置 hooks 点击派发
  tapConsumed = false;
  if (SKIN_MODULES[skin.id]?.handleTouch?.(env, 'end', p)) { tapConsumed = false; return; }
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
            if (app.engine.dispatch({ type: 'BUILD', col: cx, row: cy, tower: bt.type })) {
              sfx.play('build'); buzz('light');
              track('tower_build', { tower_type: bt.type, level_id: app.levelId, wave: st.wave });
            }
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
  // 模块在 handleTouch('end') 里 consumeTap() 后，当次不再派发内置按钮点击
  if (tapConsumed) { tapConsumed = false; return; }

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
  // 联机调试：会话只读视图 + 联机动作（CDP 双端联调驱动用）
  (globalThis as { __SRD_NET?: object }).__SRD_NET = {
    get session() { return online; },
    setMode, enterLobby, hostCreateRoom, joinRoom, startOnlineBattle,
  };
} catch { /* ignore */ }
