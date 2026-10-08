// 皮肤模块可插拔架构 · 类型定义
//
// immediate-mode 模型约定（与 main.ts 内置渲染完全一致）：
// - 每帧整屏重绘：绘制钩子每帧被调用一次，画面不留存，想动就改下一帧的画法；
// - 按钮 = 绘制 + 命中区：env.btn(b) 画按钮并把 b 推入本帧 hooks 命中表，
//   env.hitBox(b) 只注册透明命中区不绘制；hooks 数组每帧由主文件重建清空，
//   因此模块必须在每帧绘制时重新注册全部可点区域，且后注册者优先命中（从上往下盖）；
// - 模块允许持有模块级可变状态（动画相位、私有滚动偏移等），与主文件做法一致；
// - 所有坐标为 CSS 像素（主画布已按 DPR 预缩放，直接当普通 2D 画布用）。

import type { Command, Difficulty, GameEngine, TowerType } from '../game/types';
import type { LEVELS } from '../game/levels';
import type {
  DIFFICULTIES, ENEMIES, ENEMY_LIST, MECHA, TECHS, TOWERS, TOWER_LIST,
} from '../game/config';
import type { drawEnemy, drawMecha, drawTower } from '../game/render';
import type { hash01 } from '../game/fx';
import type { sfx } from '../audio';
import type { track } from '../analytics';

/** 界面屏幕标识（与 main.ts 的 Screen 一致；lobby 为在线联机大厅，皮肤无接管、走内置兜底） */
export type Screen = 'splash' | 'home' | 'briefing' | 'battle' | 'result' | 'codex' | 'lobby';

/** 玩法模式：单人 / 在线联机 */
export type PlayMode = 'single' | 'online';

/** 触屏点（CSS 像素） */
export interface TouchPoint { x: number; y: number }

/** 皮肤定义（main.ts 的 SKINS 条目；pressFx/transition 决定主文件内的按钮按压反馈与页面过渡风格） */
export interface Skin {
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

/** 可变调色板（applySkin 切换皮肤时整体改写，模块应持有引用而非快照） */
export interface Palette {
  cyan: string; gold: string; green: string; red: string; pink: string;
  text: string; sub: string; dim: string; panelLine: string;
}

/** 按钮描述（btn 注册 = 绘制 + 命中区；hitBox 注册 = 仅命中区） */
export interface Button {
  x: number; y: number; w: number; h: number; label: string; cb: () => void;
  color?: string; sub?: string; disabled?: boolean; active?: boolean; primary?: boolean;
}

/** 应用状态（可变对象，env 直接共享引用，模块可读写） */
export interface AppState {
  screen: Screen;
  splashAt: number;
  difficulty: Difficulty;
  levelId: number;
  engine: GameEngine | null;
  scroll: number;
  dragY: number | null;
  dragAcc: number;
  placing: TowerType | 'mecha' | null;
  selectedId: number | null;
  /** 选中的机甲 id（底部栏呈现升级/转移面板）；null 表示未选中 */
  selectedMecha: number | null;
  /** 转移阵地模式：待选目标格的机甲 id；null 表示未在转移 */
  movingMecha: number | null;
  result: { won: boolean } | null;
  techShownAt: number;
  techPickedAt: number;
  /** 玩法模式（§4.3 C 档；按会话保持，不落盘）：单人 / 在线联机 */
  mode: PlayMode;
  /** 分享卡片带入的待加入房间码（splash/home 顶部邀请横幅数据源；接受或关闭后清空） */
  pendingRoom: string | null;
}

/** 图鉴页签 */
export type CodexTab = 'story' | 'towers' | 'enemies';

/** 图鉴页状态（可变对象，env 直接共享引用） */
export interface CodexState { tab: CodexTab; scroll: number }

/** 用户信息 */
export interface Profile { nick: string; avatarUrl: string; real: boolean; openid?: string }

/** 积分档案（srd.score；与 main.ts 的 ScoreProfile 结构一致，经 env 只读访问） */
export interface ScoreProfile {
  points: number;        // 累计积分（历史总产出，不减）
  spendable: number;     // 消费积分（产出时与 points 同增；MVP 暂无消耗点）
  bestSingle: number;    // 单局最高积分
  perLevelBest: Record<number, number>; // 每关最高单局积分
  season: number;
  updatedAt: number;
}

/** 军衔档位与升级进度（按累计积分分档；满级时 next/nextName 为 null） */
export interface RankProgress {
  name: string; points: number; base: number; next: number | null; nextName: string | null;
}

/** 最近一局结算（gameOver 时由主文件写入，开局清空；结算页展示「积分 +N」用） */
export interface Settlement { score: number; grade: 'S' | 'A' | 'B' | 'D' }

/** fillText 的可选参数（与 main.ts 内部实现一致） */
export interface FillTextOpts {
  size?: number; color?: string; align?: CanvasTextAlign;
  weight?: string; baseline?: CanvasTextBaseline; font?: string;
}

/** 键值存储（wx.setStorageSync 的判空封装，与 H5 版共用键名） */
export interface Store {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

/**
 * SkinEnv：皮肤模块渲染任意屏幕所需的完整上下文。
 * 由 main.ts 构造单例并共享内部符号：可变对象（C/app/codex）直接引用，
 * 可变 let（skin/barScroll/techShownAt 等）经 getter/setter 转发，保证读到的永远是最新值。
 */
export interface SkinEnv {
  // ---- 画布与布局 ----
  ctx: CanvasRenderingContext2D;
  VW: number; VH: number; DPR: number;
  TOP_SAFE: number;        // 内容安全线上缘（胶囊底 + 8）
  CAP_MID: number;         // 胶囊按钮垂直中线（页头与之同线排布）
  CAP_LEFT: number;        // 胶囊左缘（页头右侧元素需让位）
  GAME_CENTER_PAD: number; // 体验版/开发版「游戏中心」入口额外让位
  MARGIN: number; RADIUS: number; BAR_H: number;
  mapScale: number; mapOX: number; mapOY: number;
  toMapX(vx: number): number;  // 屏幕坐标 → 地图逻辑坐标
  toMapY(vy: number): number;
  getMapPan(): number;         // 地图垂直平移偏移
  mapPanMin: number;           // 平移下限（<= 0；为 0 时地图不足一屏无需平移）
  homeTop: number; homeBottom: number; // 主页关卡列表可视区上下缘
  totalScrollMax(): number;    // 主页列表最大滚动量

  // ---- 配色 ----
  C: Palette;                  // 可变调色板（applySkin 会改写其字段）
  readonly skin: Skin;         // 当前皮肤（getter，切换后立即生效）
  ac(a: number): string;       // 当前主题色 + alpha 拼 rgba()

  // ---- 绘制助手 ----
  fillText(str: string, x: number, y: number, o?: FillTextOpts): void;
  rr(x: number, y: number, w: number, h: number, r: number): void; // 圆角/切角矩形路径（随 skin.chrome）
  panel(x: number, y: number, w: number, h: number, stroke?: string, r?: number): void;
  wrapBlock(str: string, x: number, y: number, w: number, o?: { size?: number; color?: string }): number;
  wrapCount(str: string, w: number, size: number): number;
  shade(hex: string): string;  // 主色压暗，用于渐变下端
  btn(b: Button): void;        // 画按钮 + 注册命中区
  hitBox(b: Button): void;     // 仅注册透明命中区
  chip(x: number, y: number, text: string, color: string): void;   // 状态小徽标（x 为右缘）
  segControl(x: number, y: number, w: number, items: string[], activeIdx: number, key: string, onPick: (i: number) => void): void;
  drawSwitch(x: number, y: number, on: boolean): void;             // 46×26 胶囊开关
  drawAvatar(cx: number, cy: number, r: number): void;             // 圆形头像/指挥官徽记
  drawCardArt(x: number, y: number, w: number, h: number, chapter: number, time: number, r?: number): void;
  drawSpaceBg(time: number): void;                                 // 页面底色：深空渐变 + 星云 + 网格
  drawStars(time: number, alpha?: number): void;
  RES_FONT(): string;          // Orbitron 加载完成后带字体的 font family，否则 sans-serif
  rng(seed: number): () => number;                                 // 固定伪随机（mulberry32）
  hash01: typeof hash01;       // 确定性 hash → [0,1)，闪烁/抖动一律用它保证帧间一致
  drawTower: typeof drawTower; // 引擎同款炮塔矢量绘制
  drawEnemy: typeof drawEnemy; // 引擎同款敌人矢量绘制
  drawMecha: typeof drawMecha; // 引擎同款机甲矢量绘制
  /** 塔栏末位的机甲槽（几何与主文件 barSlotAt 一致；皮肤在自家塔槽 forEach 之后、clip 区域内调用） */
  drawMechaBarSlot(engine: GameEngine): void;

  // ---- 状态访问 ----
  app: AppState;
  codex: CodexState;
  getScreenAt(): number;       // 页面切换时间戳（过渡动画驱动）
  showProfile(): boolean;
  setShowProfile(v: boolean): void;
  showSettings(): boolean;
  setShowSettings(v: boolean): void;
  getPressedBtn(): Button | null;   // 当前按下的按钮（按压反馈用）
  getTechShownAt(): number;         // 科技三选一入场动画时间戳（0 = 未展示）
  setTechShownAt(v: number): void;
  barScroll: number;                // 底部塔栏横向滚动偏移（get/set）
  getEngine(): GameEngine | null;

  // ---- 数据（引擎配置，直接引用共享） ----
  LEVELS: typeof LEVELS;
  DIFFICULTIES: typeof DIFFICULTIES;
  TOWER_LIST: typeof TOWER_LIST;
  ENEMY_LIST: typeof ENEMY_LIST;
  TOWERS: typeof TOWERS;
  ENEMIES: typeof ENEMIES;
  TECHS: typeof TECHS;
  TOWER_ORDER: TowerType[];
  TOWER_UNLOCK: Record<TowerType, number>;
  MECHA: typeof MECHA;
  SELL_RATE: number;
  STORY_PARAS: string[];
  CODEX_TABS: [CodexTab, string][];
  ENEMY_CATEGORY: Record<string, string>;
  SLOT_W: number; SLOT_GAP: number;
  stripMaxScroll: number;           // 塔栏最大横向滚动量
  SKINS: readonly Skin[];           // 全部皮肤定义（只读；设置页皮肤色卡的数据源）
  CELL: number; COLS: number; ROWS: number; // 地图网格几何（落格命中/拖拽建塔计算用）

  // ---- 进度与解锁 ----
  loadProgress(): { cleared: number[] };
  unlockedChapter(): number;        // 已解锁到的章节号
  towerUnlocked(t: TowerType): boolean;

  // ---- 动作 ----
  goto(s: Screen): void;
  gotoBriefing(levelId: number): void;
  stopNarration(): void;            // 停止简报旁白（简报页返回选关前必须调用，与默认实现一致）
  startBattle(): void;
  engineCmd(cmd: Command): boolean;
  applySkin(id: string): void;      // 切换皮肤（含持久化）
  authUser(): void;                 // 拉起微信头像昵称授权
  openFeedback(): void;             // 客服会话 → 回退复制反馈邮箱
  /** 切换玩法模式（单人/在线联机；track coop_toggle，mode 值域 0单人/2在线） */
  setMode(m: PlayMode): void;
  /** 在线局信息（结算页展示队友用）：联机会话存活时取会话，否则取最近一局结算快照；无在线局为 null */
  getOnlineInfo(): { peerNick: string; player: number } | null;
  /** 主动拉起微信分享（判空包装 wx.shareAppMessage；不支持的环境静默跳过） */
  shareAppMessage(o: { title: string; imageUrl?: string }): void;
  /** 资源 URL 换算：'assets/...' 包内路径 → CDN 远程地址（纯本地开发时原样返回） */
  assetUrl(path: string): string;
  commanderRank(): string;
  displayNick(): string;
  getProfile(): Profile;
  /** 积分档案（srd.score）只读访问：积分条/排行展示用 */
  getScore(): ScoreProfile;
  /** 当前军衔档位与升级进度（满级时 next/nextName 为 null） */
  getRankProgress(): RankProgress;
  /** 最近一局结算积分与评级（gameOver 写入、开局清空；结算页「积分 +N」数据源，无则为 null） */
  getLastSettlement(): Settlement | null;

  // ---- 反馈 ----
  sfx: typeof sfx;                  // 战斗音效（sfx.muted 为音效开关状态）
  buzz(type: 'heavy' | 'medium' | 'light'): void;   // 触感反馈（自带节流与静音判断）
  showToast(text: string): void;
  /** 当前轻提示（无则 null）；模块接管 drawToast 后，寿命与淡出由模块自行负责 */
  getToast(): { text: string; at: number } | null;
  track: typeof track;              // 埋点
  store: Store;

  // ---- 设置项状态（ getter + 切换动作成对） ----
  musicMuted(): boolean;
  toggleMusicMuted(): void;
  narrationMuted(): boolean;
  toggleNarrationMuted(): void;
  vibrateMuted(): boolean;
  toggleVibrateMuted(): void;
  readQualityHigh(): boolean;       // 读存储中的画质开关
  setQualityHigh(v: boolean): void; // 同时更新存储与内存 qualityHigh

  // ---- 触摸接管 ----
  /** 在 handleTouch('end') 里调用后，主循环当次不再执行内置 hooks 点击派发（用后自动清零） */
  consumeTap(): void;
}

/**
 * SkinModule：一个皮肤的可插拔渲染/交互模块。
 * 所有钩子均可选：缺省即走 main.ts 内置兜底渲染，行为与现状逐像素一致。
 * 分发模式统一为 `const m = SKIN_MODULES[skin.id]; if (m?.drawX) { m.drawX(env, ...); return/else 兜底 }`。
 */
export interface SkinModule {
  /** 与 main.ts 的 Skin.id 一一对应（'abyss' | 'ember' | 'matrix' | …） */
  id: string;

  /**
   * 欢迎页主菜单区（开场动画与背景仍由主文件统一绘制，只换菜单区）。
   * 仅在 menuA > 0（动画放完）后调用；menuA 为菜单淡入进度 0..1。
   * entries 数据由模块自己组装：图鉴（env.goto('codex')）/ 设置（env.setShowSettings(true)）/
   * 档案（env.setShowProfile(true)）+ 开始战役（env.goto('home')）。
   */
  drawSplashMenu?(env: SkinEnv, time: number, menuA: number): void;

  /** 主页整屏接管。hooks 清空由主循环做；模块需自绘背景（env.drawSpaceBg(time)）与页头 */
  drawHome?(env: SkinEnv, time: number): void;
  /** 简报页整屏接管（约定同 drawHome） */
  drawBriefing?(env: SkinEnv, time: number): void;
  /** 结算页整屏接管（约定同 drawHome） */
  drawResult?(env: SkinEnv, time: number): void;
  /** 图鉴页整屏接管（约定同 drawHome） */
  drawCodex?(env: SkinEnv, time: number): void;

  /** 战斗顶部 HUD + prep 阶段提示面板（状态区、暂停/倍速/菜单按钮、开战提示一整块） */
  drawBattleHUD?(env: SkinEnv, engine: GameEngine): void;
  /**
   * 底部塔栏 / 选中升级出售栏。
   * 注意：主文件触摸逻辑（towerSlotAt）假定塔槽位于底部 BAR_H 区内按 SLOT_W 排列；
   * 模块若改动槽位几何，需同时用 handleTouch 接管对应触摸判定。
   */
  drawBottomBar?(env: SkinEnv, engine: GameEngine): void;
  /** 科技三选一弹层（techShownAt 的置位/清零仍由主文件负责） */
  drawTechOverlay?(env: SkinEnv, engine: GameEngine): void;
  /** 设置中心弹层 */
  drawSettings?(env: SkinEnv): void;
  /** 指挥官档案弹层 */
  drawProfile?(env: SkinEnv): void;
  /** 轻提示 Toast（接管后主文件不再绘制/老化 toast） */
  drawToast?(env: SkinEnv): void;
  /** 拖拽建塔幽灵预览（type 为拖拽中的塔型，p 为手指屏幕坐标） */
  drawDragGhost?(env: SkinEnv, engine: GameEngine, type: TowerType, p: TouchPoint): void;

  /**
   * 触摸接管：在 wx.onTouchStart/Move/End 默认处理之前调用。
   * 返回 true 表示消费该事件，跳过该事件的全部默认处理（如 home/codex 滚动接管）。
   * 'end' 阶段可配合 env.consumeTap()：不整事件接管、仅抑制最后的内置 hooks 点击派发
   * （适用于完全接管触摸的皮肤自己做点击判定）。
   */
  handleTouch?(env: SkinEnv, phase: 'start' | 'move' | 'end', p: TouchPoint): boolean;
}
