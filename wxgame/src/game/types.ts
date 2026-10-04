// 引擎契约类型 —— 纯 TS，零 React 依赖
import type { LevelMap } from './config';
import type { LevelDef } from './levels';

export type TowerType = 'laser' | 'missile' | 'frost' | 'railgun' | 'tesla' | 'plasma';
export type EnemyType = 'crawler' | 'speeder' | 'tanker' | 'splitter' | 'lurker' | 'boss';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Phase = 'prep' | 'combat' | 'tech' | 'won' | 'lost';
export type TechId =
  | 'dmg' | 'rate' | 'range' | 'gold' | 'crit'
  | 'splash' | 'slow' | 'pierce' | 'supply' | 'repair';

export interface TowerState {
  id: number;
  type: TowerType;
  level: number; // 0 | 1 | 2 对应 Lv1/2/3
  col: number;
  row: number;
  cooldown: number; // 距下次开火剩余秒
  charging: boolean; // 电磁炮蓄能中
  chargeT: number; // 蓄能剩余
  aimX: number; // 当前瞄准方向（像素，世界坐标）
  aimY: number;
  lastFireAt: number; // 最近一次开火时刻（引擎时钟，驱动开火帧动画）
  kills: number;
  invested: number; // 累计投入金币（建造+升级）
  /** 塔的归属玩家：单人恒为 0；联机协作 0=主机 / 1=客机（建造/升级/出售鉴权与击杀分账依据） */
  owner: number;
}

export interface EnemyState {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  /** 沿路径已行进距离（像素） */
  dist: number;
  /** 所属路径索引 */
  path: number;
  speed: number; // 格/秒（已含难度修正）
  reward: number;
  leak: number;
  slowUntil: number; // 引擎时钟
  slowPct: number; // 减速幅度 0-1
  stunUntil: number;
  vulnUntil: number; // 破甲：受伤 +15%
  stealthT: number; // 隐匿者隐身循环计时
  isBoss: boolean;
  enraged: boolean;
  bornAt: number;
  lastHitAt: number; // 最近一次受伤时刻（引擎时钟，驱动受击闪光）
}

export interface ProjectileState {
  id: number;
  kind: 'missile' | 'plasma';
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  t: number; // 0-1 进度
  dur: number;
  damage: number;
  splash: number; // 格
  stun: number; // 秒
  towerId: number;
  dps?: number; // plasma：灼烧区每秒伤害
  zoneR?: number; // plasma：灼烧区半径（格）
}

export interface BeamState {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  ttl: number;
  maxTtl: number;
}

export interface ParticleState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  maxTtl: number;
  color: string;
  size: number;
}

/** 冲击波环：扩张的发光圆环（击杀/落点/BOSS/漏怪反馈） */
export interface RingState {
  id: number;
  x: number;
  y: number;
  color: string;
  r0: number; // 起始半径
  r1: number; // 终止半径
  ttl: number;
  maxTtl: number;
}

export interface FloaterState {  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  ttl: number;
  maxTtl: number;
}

/** 等离子灼烧区域：对范围内敌人持续造成 dps */
export interface ZoneState {
  id: number;
  x: number;
  y: number;
  r: number; // 像素
  dps: number;
  ttl: number;
  maxTtl: number;
  towerId: number;
}

export interface SpawnItem {
  type: EnemyType;
  interval: number;
  /** 路径索引（出怪时已解析，分裂体继承父体） */
  path?: number;
  hpOverride?: number;
  rewardOverride?: number;
}

export type GameEvent =
  | { type: 'waveStart'; wave: number }
  | { type: 'waveClear'; wave: number; bonus: number }
  | { type: 'leak'; lives: number }
  | { type: 'bossDown'; wave: number }
  | { type: 'comm'; wave: number; text: string }
  | { type: 'sfx'; name: 'missile' | 'railgun' | 'plasma' }
  | { type: 'gameOver'; won: boolean };

export interface GameState {
  phase: Phase;
  clock: number; // 引擎时钟（秒，受加速影响）
  timeSec: number; // 本局用时
  /** 单人：唯一金币池；联机协作：恒等于 golds[0] 的镜像（供 UI/兼容旧逻辑读取） */
  gold: number;
  lives: number; // 联机协作为双方共享生命
  maxLives: number;
  /** 联机协作：是否为双人协作局（createEngine opts.coop） */
  coop: boolean;
  /** 联机协作：双方独立金币池 [主机, 客机]；单人恒为 null */
  golds: [number, number] | null;
  /** 联机协作：双方各自击杀数 [主机, 客机]（仅塔击杀计数）；单人恒为 null */
  killsBy: [number, number] | null;
  wave: number; // 当前/即将开始波次
  totalWaves: number; // 本关总波数
  prepT: number; // 波次前倒计时
  paused: boolean;
  speed: 1 | 2;
  enemies: EnemyState[];
  towers: TowerState[];
  projectiles: ProjectileState[];
  beams: BeamState[];
  particles: ParticleState[];
  rings: RingState[];
  floaters: FloaterState[];
  zones: ZoneState[];
  spawnQueue: SpawnItem[];
  spawnT: number;
  kills: number;
  leaked: number;
  goldEarned: number;
  shake: number;
  // 成就追踪
  towerTypesBuilt: TowerType[];
  usedFrost: boolean;
  maxTowerLevel: number; // 1-3
  boss1Killed: boolean;
  /** 已获得的局内科技（可叠加同名） */
  techs: TechId[];
  /** 波次清空后的科技三选一；null 表示无待选 */
  techChoices: TechId[] | null;
  events: GameEvent[];
}

/** 联机快照类型：玩法状态全量，剔除纯装饰特效数组以省带宽（zones 保留——灼烧区是玩法数据） */
export type NetGameState = Omit<GameState, 'particles' | 'beams' | 'rings' | 'floaters'>;

export type Command =
  | { type: 'BUILD'; col: number; row: number; tower: TowerType }
  | { type: 'UPGRADE'; id: number }
  | { type: 'SELL'; id: number }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'SET_SPEED'; speed: 1 | 2 }
  | { type: 'SKIP_PREP' }
  | { type: 'PICK_TECH'; id: TechId };

export interface GameEngine {
  state: GameState;
  difficulty: Difficulty;
  map: LevelMap;
  level: LevelDef;
  tick(dtReal: number): void;
  dispatch(cmd: Command): boolean;
  /** 以指定玩家身份执行命令（联机协作鉴权：0=主机 / 1=客机）；dispatch(cmd) 等价于 dispatchAs(0, cmd) */
  dispatchAs(player: number, cmd: Command): boolean;
  /** 联机快照：剔除纯装饰数组（particles/beams/rings/floaters）后的玩法状态。
   *  快照里的 events 在 drainEvents 之后恒为空属正常——事件由联机层在快照消息外层附带 */
  serializeNet(): NetGameState;
  subscribe(fn: () => void): () => void;
  drainEvents(): GameEvent[];
}
