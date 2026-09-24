// 全部数值表（design.md §3）—— 单一数据源，引擎与图鉴/说明页共享
import type { Difficulty, EnemyType, TechId, TowerType } from './types';

export const CELL = 60;
export const COLS = 9;
export const ROWS = 16;
export const W = COLS * CELL; // 540
export const H = ROWS * CELL; // 960
export const SELL_RATE = 0.7;

/** 单条路径：像素折线、长度与分段（dist → 像素的插值依据） */
export interface PathInfo {
  pixels: ReadonlyArray<readonly [number, number]>;
  length: number;
  segs: { x1: number; y1: number; x2: number; y2: number; len: number; acc: number }[];
}

/** 路径终点出口：基地装饰中心（像素）与禁建格 */
export interface ExitInfo {
  centerX: number;
  centerY: number;
  cells: string[]; // key = col,row
}

/** 单关地图：多路径、合并禁建判定等，由 buildLevelMap 按关卡路径点生成 */
export interface LevelMap {
  paths: PathInfo[];
  pathCells: Set<string>; // 所有路径经过的格子 key = col,row
  baseCells: Set<string>; // 所有出口的基地区格子
  exits: ExitInfo[]; // 去重后的出口（基地装饰），合流共享出口只含一座
  exitOfPath: ExitInfo[]; // 逐路径的出口（与 paths 一一对应，漏怪定位用）
  posAt(pathIdx: number, dist: number): { x: number; y: number };
  isBuildable(col: number, row: number): boolean;
}

export function buildLevelMap(
  paths: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
): LevelMap {
  const pathInfos: PathInfo[] = paths.map((points) => {
    const pixels = points.map(([c, r]) => [(c + 0.5) * CELL, (r + 0.5) * CELL] as const);
    let length = 0;
    const segs: PathInfo['segs'] = [];
    for (let i = 0; i < pixels.length - 1; i++) {
      const [x1, y1] = pixels[i];
      const [x2, y2] = pixels[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      segs.push({ x1, y1, x2, y2, len, acc: length });
      length += len;
    }
    return { pixels, length, segs };
  });

  function posAt(pathIdx: number, dist: number): { x: number; y: number } {
    const { segs, length } = pathInfos[pathIdx] ?? pathInfos[0];
    const d = Math.max(0, Math.min(dist, length));
    for (const s of segs) {
      if (d <= s.acc + s.len) {
        const t = s.len === 0 ? 0 : (d - s.acc) / s.len;
        return { x: s.x1 + (s.x2 - s.x1) * t, y: s.y1 + (s.y2 - s.y1) * t };
      }
    }
    const last = segs[segs.length - 1];
    return { x: last.x2, y: last.y2 };
  }

  const pathCells = new Set<string>();
  for (const points of paths) {
    for (let i = 0; i < points.length - 1; i++) {
      let [c, r] = points[i];
      const [ec, er] = points[i + 1];
      const dc = Math.sign(ec - c);
      const dr = Math.sign(er - r);
      while (c !== ec || r !== er) {
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS) pathCells.add(`${c},${r}`);
        c += dc;
        r += dr;
      }
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) pathCells.add(`${c},${r}`);
    }
  }

  // 出口（基地区）从路径自动推导：每条路径在网格内的最后一个格子为基地中心，左右邻格一并禁建
  // exitOfPath 逐路径各一份（漏怪定位用）；exits 按中心去重（合流共享出口只画一座基地）
  const exitOfPath: ExitInfo[] = [];
  const exitMap = new Map<string, ExitInfo>();
  for (const points of paths) {
    let lastC = 0;
    let lastR = 0;
    for (let i = 0; i < points.length - 1; i++) {
      let [c, r] = points[i];
      const [ec, er] = points[i + 1];
      const dc = Math.sign(ec - c);
      const dr = Math.sign(er - r);
      for (;;) {
        if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
          lastC = c;
          lastR = r;
        }
        if (c === ec && r === er) break;
        c += dc;
        r += dr;
      }
    }
    const key = `${lastC},${lastR}`;
    let exit = exitMap.get(key);
    if (!exit) {
      const cells = [lastC - 1, lastC, lastC + 1]
        .filter((c) => c >= 0 && c < COLS)
        .map((c) => `${c},${lastR}`);
      exit = { centerX: (lastC + 0.5) * CELL, centerY: (lastR + 0.5) * CELL, cells };
      exitMap.set(key, exit);
    }
    exitOfPath.push(exit);
  }
  const exits = [...exitMap.values()];

  const base = new Set<string>();
  for (const ex of exits) for (const k of ex.cells) base.add(k);

  function isBuildable(col: number, row: number): boolean {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    const k = `${col},${row}`;
    return !pathCells.has(k) && !base.has(k);
  }

  return { paths: pathInfos, pathCells, baseCells: base, exits, exitOfPath, posAt, isBuildable };
}

// ---------------- 防御塔 ----------------

export interface TowerLevel {
  damage: number;
  range: number; // 格
  rate: number; // 发/秒
  cost: number; // 建造或升级费用
}

export interface TowerDef {
  type: TowerType;
  name: string;
  nameEn: string;
  tag: string; // 特性标签
  color: string;
  role: string; // 定位一句话
  strong: string; // 擅长
  weak: string; // 乏力
  levels: [TowerLevel, TowerLevel, TowerLevel];
  splash?: [number, number, number]; // 溅射半径（格）
  stun?: [number, number, number]; // 眩晕秒
  slowPct?: [number, number, number];
  slowDur?: [number, number, number];
  charge?: number; // 电磁炮蓄能秒
  pierceDecay?: number; // 电磁炮 Lv1/2 贯穿衰减
  chain?: [number, number, number]; // 特斯拉连锁跳跃的额外目标数
  chainDecay?: number; // 特斯拉每跳伤害衰减系数
  dot?: [number, number, number]; // 等离子灼烧区每秒伤害
  zoneR?: [number, number, number]; // 等离子灼烧区半径（格）
  zoneDur?: number; // 等离子灼烧区持续秒
}

export const TOWERS: Record<TowerType, TowerDef> = {
  laser: {
    type: 'laser',
    name: '激光塔',
    nameEn: 'LASER',
    tag: '精准',
    color: '#22E0FF',
    role: '精准点杀的哨戒之瞳',
    strong: '爬行者 / 迅捷兽',
    weak: '甲壳兽（装甲抗激光）',
    levels: [
      { damage: 12, range: 2.5, rate: 2.0, cost: 100 },
      { damage: 22, range: 2.7, rate: 2.2, cost: 120 },
      { damage: 40, range: 3.0, rate: 2.5, cost: 200 },
    ],
  },
  missile: {
    type: 'missile',
    name: '导弹塔',
    nameEn: 'MISSILE',
    tag: '溅射',
    color: '#FF9F43',
    role: '范围轰炸的火力堡垒',
    strong: '成群敌人 / 甲壳兽',
    weak: '迅捷兽（易脱靶）',
    levels: [
      { damage: 30, range: 3.5, rate: 0.5, cost: 150 },
      { damage: 55, range: 3.7, rate: 0.55, cost: 180 },
      { damage: 95, range: 4.0, rate: 0.6, cost: 300 },
    ],
    splash: [1, 1.2, 1.5],
    stun: [0, 0, 0.5],
  },
  frost: {
    type: 'frost',
    name: '减速塔',
    nameEn: 'FROST',
    tag: '减速',
    color: '#3DF08C',
    role: '迟滞虫群的冰晶力场',
    strong: '迅捷兽 / BOSS 辅助',
    weak: '单独输出极低',
    levels: [
      { damage: 4, range: 2.2, rate: 1.0, cost: 80 },
      { damage: 8, range: 2.4, rate: 1.0, cost: 100 },
      { damage: 15, range: 2.6, rate: 1.2, cost: 160 },
    ],
    slowPct: [0.35, 0.45, 0.55],
    slowDur: [1.5, 2, 2.5],
  },
  railgun: {
    type: 'railgun',
    name: '电磁炮',
    nameEn: 'RAILGUN',
    tag: '贯穿',
    color: '#8B5CF6',
    role: '贯穿直线的重型裁决者',
    strong: '甲壳兽 / 隐匿者 / BOSS',
    weak: '射速慢，怕散兵',
    levels: [
      { damage: 90, range: 4.5, rate: 0.25, cost: 260 },
      { damage: 170, range: 4.7, rate: 0.28, cost: 320 },
      { damage: 320, range: 5.0, rate: 0.3, cost: 480 },
    ],
    charge: 1.2,
    pierceDecay: 0.85,
  },
  tesla: {
    type: 'tesla',
    name: '特斯拉塔',
    nameEn: 'TESLA',
    tag: '连锁',
    color: '#FFE93D',
    role: '连锁闪电的群攻风暴',
    strong: '成群轻甲敌人',
    weak: '单体高血目标 / 隐匿者',
    levels: [
      { damage: 18, range: 2.8, rate: 1.2, cost: 140 },
      { damage: 32, range: 3.0, rate: 1.3, cost: 170 },
      { damage: 55, range: 3.2, rate: 1.5, cost: 280 },
    ],
    chain: [2, 3, 4],
    chainDecay: 0.7,
  },
  plasma: {
    type: 'plasma',
    name: '等离子炮',
    nameEn: 'PLASMA',
    tag: '灼烧',
    color: '#FF6B3D',
    role: '熔浆弹幕的区域封锁者',
    strong: '成群慢速敌人 / 阵地封锁',
    weak: '迅捷兽（易脱离灼烧区）',
    levels: [
      { damage: 20, range: 3.2, rate: 0.4, cost: 180 },
      { damage: 35, range: 3.4, rate: 0.45, cost: 220 },
      { damage: 60, range: 3.6, rate: 0.5, cost: 340 },
    ],
    splash: [0.8, 0.9, 1.0],
    dot: [10, 18, 32],
    zoneR: [1, 1.2, 1.5],
    zoneDur: 2.5,
  },
};

export const TOWER_LIST: TowerDef[] = [
  TOWERS.laser, TOWERS.missile, TOWERS.frost, TOWERS.railgun, TOWERS.tesla, TOWERS.plasma,
];

// ---------------- 敌人 ----------------

export type EnemyCategory = 'normal' | 'fast' | 'tank' | 'special' | 'boss';

export interface EnemyDef {
  type: EnemyType;
  name: string;
  nameEn: string;
  category: EnemyCategory;
  hp: number;
  speed: number; // 格/秒
  reward: number;
  leak: number;
  threat: number; // 1-5
  color: string;
  size: number; // 绘制半径 px
  desc: string;
  weakness: string;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  crawler: {
    type: 'crawler', name: '爬行者', nameEn: 'CRAWLER', category: 'normal',
    hp: 60, speed: 1.0, reward: 8, leak: 1, threat: 1, color: '#7A4FD0', size: 16,
    desc: '最基础的虫群单位，成群结队涌向基地。', weakness: '任意火力',
  },
  speeder: {
    type: 'speeder', name: '迅捷兽', nameEn: 'SPEEDER', category: 'fast',
    hp: 40, speed: 1.9, reward: 10, leak: 1, threat: 2, color: '#4FD0C8', size: 13,
    desc: '体型小、移动极快，受到的减速效果 ×1.2。', weakness: '减速塔 + 溅射',
  },
  tanker: {
    type: 'tanker', name: '甲壳兽', nameEn: 'TANKER', category: 'tank',
    hp: 320, speed: 0.55, reward: 25, leak: 3, threat: 3, color: '#5B3FA8', size: 21,
    desc: '厚重甲壳提供装甲：受到的激光伤害 −25%。', weakness: '导弹溅射 / 电磁炮破甲',
  },
  splitter: {
    type: 'splitter', name: '分裂体', nameEn: 'SPLITTER', category: 'special',
    hp: 150, speed: 0.9, reward: 18, leak: 2, threat: 3, color: '#9D6FE8', size: 18,
    desc: '死亡时分裂为 2 个爬行者（HP 为当前波爬行者的 60%）。', weakness: '在远离基地处击杀',
  },
  lurker: {
    type: 'lurker', name: '隐匿者', nameEn: 'LURKER', category: 'special',
    hp: 110, speed: 1.2, reward: 15, leak: 2, threat: 4, color: '#B8FF3D', size: 15,
    desc: '每 3s 隐身 1s，隐身时不可被锁定（电磁炮贯穿仍可命中）。', weakness: '电磁炮贯穿光束',
  },
  boss: {
    type: 'boss', name: '湮灭巨兽', nameEn: 'ANNIHILATOR', category: 'boss',
    hp: 4000, speed: 0.45, reward: 300, leak: 10, threat: 5, color: '#FF3D81', size: 34,
    desc: '免疫眩晕，减速效果减半。血量 50% 以下狂暴：速度 +40%，外壳变为品红。',
    weakness: '满级电磁炮 + 减速牵制',
  },
};

export const ENEMY_LIST: EnemyDef[] = [
  ENEMIES.crawler, ENEMIES.speeder, ENEMIES.tanker, ENEMIES.splitter, ENEMIES.lurker, ENEMIES.boss,
];

// ---------------- 波次 ----------------

export interface WaveGroup {
  type: EnemyType;
  count: number;
  interval: number;
  /** 指定路径索引；未指定则在所有路径间轮转（round-robin） */
  path?: number;
  hpOverride?: number;
  rewardOverride?: number;
}

export interface WaveDef {
  wave: number;
  groups: WaveGroup[];
  bonus: number;
  isBoss: boolean;
  /** 该波开始时的剧情通讯台词 */
  comm?: string;
}

// ---------------- 难度 ----------------

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  gold: number;
  lives: number;
  hpMul: number;
  speedMul: number;
  label: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: { id: 'easy', name: '简单', gold: 500, lives: 25, hpMul: 0.85, speedMul: 1, label: '新兵训练' },
  normal: { id: 'normal', name: '普通', gold: 400, lives: 20, hpMul: 1, speedMul: 1, label: '标准战役' },
  hard: { id: 'hard', name: '困难', gold: 320, lives: 15, hpMul: 1.15, speedMul: 1.05, label: '老兵试炼' },
};

export const PREP_TIME = 3;

// ---------------- 局内科技（roguelike 三选一） ----------------

/** 科技全局加成开关：同名科技可叠加，数值随叠加次数线性增长 */
export interface TechDef {
  id: TechId;
  name: string;
  nameEn: string;
  desc: string;
  glyph: string; // 面板大字符
  color: string;
}

export const TECHS: Record<TechId, TechDef> = {
  dmg: {
    id: 'dmg', name: '火力校准', nameEn: 'FIRE CALIB', color: '#FF6B3D', glyph: '攻',
    desc: '全体防御塔伤害 +15%（可叠加）',
  },
  rate: {
    id: 'rate', name: '超频协议', nameEn: 'OVERCLOCK', color: '#FFC94D', glyph: '速',
    desc: '全体防御塔攻速 +12%（可叠加）',
  },
  range: {
    id: 'range', name: '广域同步', nameEn: 'WIDE SYNC', color: '#22E0FF', glyph: '域',
    desc: '全体防御塔射程 +10%（可叠加）',
  },
  gold: {
    id: 'gold', name: '战利品协议', nameEn: 'WAR LOOT', color: '#FFC94D', glyph: '财',
    desc: '击杀金币收益 +25%（可叠加）',
  },
  crit: {
    id: 'crit', name: '临界穿透弹', nameEn: 'CRIT ROUNDS', color: '#FF3D81', glyph: '爆',
    desc: '所有伤害 10% 概率造成双倍（可叠加）',
  },
  splash: {
    id: 'splash', name: '扩装弹头', nameEn: 'HEAVY WARHEAD', color: '#FF9F43', glyph: '溅',
    desc: '导弹/等离子溅射半径 +20%（可叠加）',
  },
  slow: {
    id: 'slow', name: '强化力场', nameEn: 'AMP FIELD', color: '#3DF08C', glyph: '缓',
    desc: '减速塔的减速幅度 +6%（可叠加）',
  },
  pierce: {
    id: 'pierce', name: '穿甲弹药', nameEn: 'AP AMMO', color: '#8B5CF6', glyph: '穿',
    desc: '对甲壳兽与 BOSS 伤害 +25%，激光不再被装甲减免（可叠加）',
  },
  supply: {
    id: 'supply', name: '后勤空投', nameEn: 'AIRDROP', color: '#FFC94D', glyph: '补',
    desc: '立即获得 200 金币',
  },
  repair: {
    id: 'repair', name: '纳米维修', nameEn: 'NANO REPAIR', color: '#3DF08C', glyph: '修',
    desc: '立即修复 3 点基地生命值',
  },
};

export const TECH_LIST = Object.values(TECHS);
