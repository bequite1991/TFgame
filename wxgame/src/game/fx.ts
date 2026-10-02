// 渲染层特效 —— 星云底 / 视差星野 / 暗角 / 模拟 Bloom / 死亡灼痕·碎片·闪光 / 弹道拖尾（纯视觉，不触碰游戏逻辑与数值）
import { ENEMIES } from './config';
import type { LevelMap } from './config';
import type { GameState } from './types';

// ---------------- 可调常量区 ----------------

export const BLOOM_SCALE = 0.25; // 辉光层分辨率（相对逻辑分辨率，固定低分辨率省显存）
export const BLOOM_INTENSITY = 0.42; // 辉光叠回主画布的强度（压低避免雾气盖住单位）
export const BLOOM_BLUR_PASSES = 2; // 降采样-升采样模糊轮数（近似高斯）
export const BLOOM_MIN_CORES = 5; // CPU 逻辑核数低于此值时永久关闭 Bloom

const STAR_FAR_COUNT = 46; // 远景星：多、暗、慢
const STAR_FAR_SPEED = 3; // px/s
const STAR_NEAR_COUNT = 22; // 近景星：少、亮、快
const STAR_NEAR_SPEED = 9; // px/s

const VIGNETTE_ALPHA = 0.52; // 四边暗角强度
const BASE_GLOW_R = 130; // 基地青色环境光晕半径（px）
const BASE_GLOW_ALPHA = 0.1;

const SCORCH_TTL = 3; // 地面灼痕寿命（秒）
const SCORCH_MAX = 24; // 灼痕池大小
const KILL_FLASH_TTL = 0.1; // 击杀白闪寿命（秒）
const KILL_FLASH_MAX = 16;
export const BOSS_FLASH_TTL = 0.15; // BOSS 死亡全屏白闪寿命（秒）

const TRAIL_LEN = 10; // 导弹拖尾历史点数
const DEBRIS_MAX = 90; // 死亡碎片池
const DEBRIS_GRAVITY = 320; // 碎片重力 px/s²
const DEBRIS_DRAG = 2.4; // 碎片速度衰减（1/s）
const SPARK_MAX = 70; // 火花池（激光命中 / 导弹爆炸）
export const SPARKS_PER_HIT = 4; // 激光每次命中的火花数

const FX_RING_MAX = 12; // 渲染层补充冲击波环池
const LEAK_MARGIN = 10; // 距路径终点多少 px 内消失视为漏怪（不留灼痕）

/** 确定性伪随机（星野/环境尘埃用，避免每帧分配随机表） */
export const hash01 = (n: number) => {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

// ---------------- 平台适配层 ----------------

/** 平台无关的图片句柄（浏览器 Image / wx.createImage 均满足该结构） */
export interface FxImage {
  src: string;
  onload: (() => void) | null;
  onerror: ((e?: unknown) => void) | null;
}

/** 跨平台抽象：离屏 canvas / 图片加载 / 画质设置 / 硬件核数 / 星云贴图 URL。默认实现为浏览器 API，微信小游戏端通过 setFxPlatform 注入 wx 实现 */
export interface FxPlatform {
  createCanvas(): HTMLCanvasElement;
  createImage(): FxImage | null;
  /** 画质开关：高画质返回 true（浏览器读 localStorage，微信读 wx.getStorageSync） */
  readQualityHigh(): boolean;
  /** CPU 逻辑核数；平台无法获取时返回 null（视为有能力，由画质开关控制 Bloom） */
  hardwareConcurrency(): number | null;
  nebulaUrl(): string;
}

const browserPlatform: FxPlatform = {
  createCanvas: () => document.createElement('canvas'),
  createImage: () => (typeof Image === 'undefined' ? null : (new Image() as unknown as FxImage)),
  readQualityHigh: () => {
    try {
      const raw = localStorage.getItem('srd.settings');
      if (raw) return ((JSON.parse(raw) as { quality?: string }).quality ?? 'high') === 'high';
    } catch {
      /* ignore */
    }
    return true;
  },
  hardwareConcurrency: () => navigator.hardwareConcurrency ?? 8,
  nebulaUrl: () => {
    try {
      // Vite 注入 BASE_URL；非浏览器打包环境（iife 下 import.meta 为空对象）回退相对路径
      const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
      return `${base}nebula-texture.png`;
    } catch {
      return 'nebula-texture.png';
    }
  },
};

let platform = browserPlatform;

/** 非浏览器端（微信小游戏）在创建任何特效对象之前调用，注入平台实现 */
export function setFxPlatform(p: FxPlatform) {
  platform = p;
}

/** 读取画质开关（浏览器端为 TopHUD 写入 localStorage 的设置，这里低频轮询） */
export function readQualityHigh(): boolean {
  return platform.readQualityHigh();
}

// ---------------- 星云纹理 ----------------

/** 星云底图加载器：加载失败时 img 保持 null，调用方回退程序化深色底 */
export class NebulaBg {
  img: HTMLImageElement | null = null;

  constructor(url?: string) {
    const im = platform.createImage();
    if (!im) return;
    im.onload = () => {
      this.img = im as unknown as HTMLImageElement;
    };
    im.src = url ?? platform.nebulaUrl();
  }
}

// ---------------- 背景氛围 ----------------

/** 两层视差星野：远近星点以不同速度缓慢漂移（纯 time 驱动、确定性伪随机） */
export function drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  ctx.save();
  // 远景层
  ctx.fillStyle = '#8FA8E8';
  for (let i = 0; i < STAR_FAR_COUNT; i++) {
    const sx = (hash01(i * 7 + 11) * w + time * STAR_FAR_SPEED) % w;
    const sy = (hash01(i * 13 + 5) * h + time * STAR_FAR_SPEED * 0.4) % h;
    ctx.globalAlpha = 0.1 + 0.14 * (0.5 + 0.5 * Math.sin(time * 0.5 + i * 1.9));
    ctx.fillRect(sx, sy, 1, 1);
  }
  // 近景层
  for (let i = 0; i < STAR_NEAR_COUNT; i++) {
    const sx = (hash01(i * 17 + 31) * w + time * STAR_NEAR_SPEED) % w;
    const sy = (hash01(i * 23 + 47) * h + Math.sin(time * 0.1 + i) * 8 + time * STAR_NEAR_SPEED * 0.25 + h) % h;
    const r = 0.8 + hash01(i * 29 + 3) * 1.1;
    ctx.fillStyle = i % 5 === 0 ? '#BDF3FF' : '#D8E4FF';
    ctx.globalAlpha = 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(time * 0.8 + i * 2.7));
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** 四边暗角：径向渐变压暗边缘，收拢视线到战场中心 */
export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, 'rgba(3,5,12,0)');
  g.addColorStop(1, `rgba(3,5,12,${VIGNETTE_ALPHA})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** 基地附近的淡青色环境光晕（呼吸脉动） */
export function drawBaseGlow(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const pulse = 0.75 + 0.25 * Math.sin(time * 1.6);
  const g = ctx.createRadialGradient(x, y, 0, x, y, BASE_GLOW_R);
  g.addColorStop(0, `rgba(34,224,255,${BASE_GLOW_ALPHA * pulse})`);
  g.addColorStop(1, 'rgba(34,224,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, BASE_GLOW_R, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------- 模拟 Bloom ----------------

/** 离屏辉光层：发光元素画入低分辨率 canvas，模糊后以 lighter 叠回主画布 */
export class BloomLayer {
  private glow: HTMLCanvasElement;
  private tiny: HTMLCanvasElement;
  private gctx: CanvasRenderingContext2D;
  private tctx: CanvasRenderingContext2D;
  /** 硬件允许（核数足够或平台无法探测）；画质开关由调用方另行控制 */
  readonly hwOk: boolean;

  constructor(w: number, h: number) {
    this.glow = platform.createCanvas();
    this.glow.width = Math.max(1, Math.round(w * BLOOM_SCALE));
    this.glow.height = Math.max(1, Math.round(h * BLOOM_SCALE));
    this.tiny = platform.createCanvas();
    this.tiny.width = Math.max(1, this.glow.width >> 1);
    this.tiny.height = Math.max(1, this.glow.height >> 1);
    this.gctx = this.glow.getContext('2d') as CanvasRenderingContext2D;
    this.tctx = this.tiny.getContext('2d') as CanvasRenderingContext2D;
    const cores = platform.hardwareConcurrency();
    this.hwOk = cores === null || cores >= BLOOM_MIN_CORES;
  }

  /** 清层并套用与主画布一致的坐标系（含震屏偏移），返回绘制上下文 */
  begin(shakeX: number, shakeY: number): CanvasRenderingContext2D {
    const g = this.gctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.glow.width, this.glow.height);
    g.setTransform(BLOOM_SCALE, 0, 0, BLOOM_SCALE, shakeX * BLOOM_SCALE, shakeY * BLOOM_SCALE);
    return g;
  }

  /** 降采样-升采样近似高斯模糊，然后以 lighter 拉伸叠回主画布（调用后主画布变换被重置为单位矩阵）。
   *  默认铺满 w*dpr × h*dpr；竖屏端可用 dx/dy/dw/dh 指定设备像素下的目标区域（地图偏移/缩放） */
  composite(dst: CanvasRenderingContext2D, w: number, h: number, dpr: number, dx = 0, dy = 0, dw = w * dpr, dh = h * dpr) {
    const g = this.gctx;
    for (let i = 0; i < BLOOM_BLUR_PASSES; i++) {
      this.tctx.setTransform(1, 0, 0, 1, 0, 0);
      this.tctx.clearRect(0, 0, this.tiny.width, this.tiny.height);
      this.tctx.drawImage(this.glow, 0, 0, this.tiny.width, this.tiny.height);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(this.tiny, 0, 0, this.glow.width, this.glow.height);
    }
    dst.setTransform(1, 0, 0, 1, 0, 0);
    dst.globalCompositeOperation = 'lighter';
    dst.globalAlpha = BLOOM_INTENSITY;
    dst.drawImage(this.glow, dx, dy, dw, dh);
    dst.globalAlpha = 1;
    dst.globalCompositeOperation = 'source-over';
  }
}

// ---------------- 战斗特效层 ----------------

interface PrevEnemy {
  x: number;
  y: number;
  dist: number;
  path: number;
  isBoss: boolean;
  size: number;
  color: string;
}

interface Scorch { x: number; y: number; r: number; rot: number; ttl: number }
interface Flash { x: number; y: number; r: number; ttl: number }
interface Mote { x: number; y: number; vx: number; vy: number; size: number; color: string; ttl: number; maxTtl: number }
interface FxRing { x: number; y: number; color: string; r0: number; r1: number; ttl: number; maxTtl: number }
interface Trail { kind: string; pts: { x: number; y: number }[] }

/** 渲染层自维护的短寿命特效：灼痕/碎片/火花/闪光/拖尾/补充冲击波环，全部对象池预分配 */
export class FxLayer {
  /** BOSS 死亡全屏白闪剩余时间（秒），由 GameCanvas 读取绘制 */
  bossFlash = 0;

  private prevEnemies = new Map<number, PrevEnemy>();
  private seenIds = new Set<number>();
  private lastClock = -1;

  private scorches: Scorch[] = [];
  private flashes: Flash[] = [];
  private debris: Mote[] = [];
  private sparks: Mote[] = [];
  private rings: FxRing[] = [];
  private trails = new Map<number, Trail>();

  constructor() {
    for (let i = 0; i < SCORCH_MAX; i++) this.scorches.push({ x: 0, y: 0, r: 1, rot: 0, ttl: 0 });
    for (let i = 0; i < KILL_FLASH_MAX; i++) this.flashes.push({ x: 0, y: 0, r: 1, ttl: 0 });
    for (let i = 0; i < DEBRIS_MAX; i++) this.debris.push({ x: 0, y: 0, vx: 0, vy: 0, size: 1, color: '#FFF', ttl: 0, maxTtl: 1 });
    for (let i = 0; i < SPARK_MAX; i++) this.sparks.push({ x: 0, y: 0, vx: 0, vy: 0, size: 1, color: '#FFF', ttl: 0, maxTtl: 1 });
    for (let i = 0; i < FX_RING_MAX; i++) this.rings.push({ x: 0, y: 0, color: '#FFF', r0: 0, r1: 1, ttl: 0, maxTtl: 1 });
  }

  /** 每帧调用：同步敌人/弹丸列表做死亡 diff，并按引擎时钟衰减所有短寿命特效 */
  update(s: GameState, map: LevelMap) {
    const dt = this.lastClock < 0 ? 0 : Math.min(0.1, Math.max(0, s.clock - this.lastClock));
    this.lastClock = s.clock;

    // —— 敌人 diff：消失且未到达终点 = 被击杀（漏怪/进基地不留灼痕） ——
    const seen = this.seenIds;
    seen.clear();
    for (const e of s.enemies) {
      seen.add(e.id);
      const pos = map.posAt(e.path, e.dist);
      const prev = this.prevEnemies.get(e.id);
      if (prev) {
        prev.x = pos.x;
        prev.y = pos.y;
        prev.dist = e.dist;
      } else {
        this.prevEnemies.set(e.id, {
          x: pos.x, y: pos.y, dist: e.dist, path: e.path,
          isBoss: e.isBoss, size: ENEMIES[e.type].size, color: ENEMIES[e.type].color,
        });
      }
    }
    for (const [id, p] of this.prevEnemies) {
      if (seen.has(id)) continue;
      this.prevEnemies.delete(id);
      if (p.dist >= map.paths[p.path].length - LEAK_MARGIN) continue; // 漏怪
      this.onEnemyDeath(p);
    }

    // —— 弹丸 diff：记录拖尾；导弹消失时在其末位置补一团爆炸火花 ——
    seen.clear();
    for (const pr of s.projectiles) {
      seen.add(pr.id);
      let tr = this.trails.get(pr.id);
      if (!tr) {
        tr = { kind: pr.kind, pts: [] };
        this.trails.set(pr.id, tr);
      }
      const last = tr.pts[tr.pts.length - 1];
      if (!last || last.x !== pr.x || last.y !== pr.y) {
        tr.pts.push({ x: pr.x, y: pr.y });
        if (tr.pts.length > TRAIL_LEN) tr.pts.shift();
      }
    }
    for (const [id, tr] of this.trails) {
      if (seen.has(id)) continue;
      this.trails.delete(id);
      if (tr.kind === 'missile' && tr.pts.length > 0) {
        const end = tr.pts[tr.pts.length - 1];
        this.burst(end.x, end.y, '#FFC978', 9, 220, 0.45);
      }
    }

    // —— 衰减 ——
    if (dt > 0) {
      for (const sc of this.scorches) if (sc.ttl > 0) sc.ttl -= dt;
      for (const f of this.flashes) if (f.ttl > 0) f.ttl -= dt;
      for (const r of this.rings) if (r.ttl > 0) r.ttl -= dt;
      if (this.bossFlash > 0) this.bossFlash -= dt;
      const dragK = 1 / (1 + DEBRIS_DRAG * dt);
      for (const d of this.debris) {
        if (d.ttl <= 0) continue;
        d.ttl -= dt;
        d.vy += DEBRIS_GRAVITY * dt;
        d.vx *= dragK;
        d.vy *= dragK;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
      }
      for (const sp of this.sparks) {
        if (sp.ttl <= 0) continue;
        sp.ttl -= dt;
        sp.vy += 200 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
      }
    }
  }

  private onEnemyDeath(p: PrevEnemy) {
    this.spawnScorch(p.x, p.y, p.size * 1.7);
    this.spawnFlash(p.x, p.y, p.size * 2.4);
    // 碎片：带速度衰减 + 重力下坠
    const n = p.isBoss ? 16 : 7;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (p.isBoss ? 130 : 70) * (0.5 + Math.random());
      this.spawnMote(this.debris, p.x, p.y, Math.cos(a) * v, Math.sin(a) * v - 50, 1.5 + Math.random() * 2.5, p.color, 0.5 + Math.random() * 0.4);
    }
    if (p.isBoss) {
      // BOSS 死亡：全屏白闪 + 大型多层冲击波（震屏由引擎 shake=1.5 提供）
      this.bossFlash = BOSS_FLASH_TTL;
      this.spawnRing(p.x, p.y, '#FFFFFF', 12, 170, 0.5);
      this.spawnRing(p.x, p.y, '#FF3D81', 8, 250, 0.9);
      this.spawnRing(p.x, p.y, '#FFC94D', 4, 330, 1.3);
    }
  }

  /** 激光命中点火花溅射 */
  spawnSparks(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 90;
      this.spawnMote(this.sparks, x, y, Math.cos(a) * v, Math.sin(a) * v - 30, 1 + Math.random() * 1.2, color, 0.16 + Math.random() * 0.14);
    }
  }

  /** 亮火花喷发（导弹爆炸补花） */
  private burst(x: number, y: number, color: string, count: number, speed: number, ttl: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.spawnMote(this.sparks, x, y, Math.cos(a) * v, Math.sin(a) * v - 40, 1.2 + Math.random() * 1.6, i % 3 === 0 ? '#FFFFFF' : color, ttl * (0.7 + Math.random() * 0.6));
    }
  }

  private spawnMote(pool: Mote[], x: number, y: number, vx: number, vy: number, size: number, color: string, ttl: number) {
    let slot: Mote | null = null;
    for (const m of pool) {
      if (m.ttl <= 0) { slot = m; break; }
    }
    if (!slot) return; // 池满直接丢弃，特效不堆积
    slot.x = x; slot.y = y; slot.vx = vx; slot.vy = vy;
    slot.size = size; slot.color = color; slot.ttl = ttl; slot.maxTtl = ttl;
  }

  private spawnScorch(x: number, y: number, r: number) {
    let slot: Scorch | null = null;
    for (const s of this.scorches) {
      if (s.ttl <= 0) { slot = s; break; }
    }
    if (!slot) {
      slot = this.scorches[0];
      for (const s of this.scorches) if (s.ttl < slot.ttl) slot = s; // 池满淘汰最旧
    }
    slot.x = x; slot.y = y; slot.r = r;
    slot.rot = Math.random() * Math.PI;
    slot.ttl = SCORCH_TTL;
  }

  private spawnFlash(x: number, y: number, r: number) {
    for (const f of this.flashes) {
      if (f.ttl > 0) continue;
      f.x = x; f.y = y; f.r = r; f.ttl = KILL_FLASH_TTL;
      return;
    }
  }

  private spawnRing(x: number, y: number, color: string, r0: number, r1: number, ttl: number) {
    for (const r of this.rings) {
      if (r.ttl > 0) continue;
      r.x = x; r.y = y; r.color = color; r.r0 = r0; r.r1 = r1; r.ttl = ttl; r.maxTtl = ttl;
      return;
    }
  }

  /** 地面灼痕：暗色椭圆焦痕贴地，3s 淡出（画在路径之上、塔之下） */
  drawScorches(ctx: CanvasRenderingContext2D) {
    for (const s of this.scorches) {
      if (s.ttl <= 0) continue;
      const a = s.ttl / SCORCH_TTL;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.scale(1, 0.55);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.r);
      g.addColorStop(0, `rgba(8,6,12,${0.6 * a})`);
      g.addColorStop(0.6, `rgba(24,12,8,${0.35 * a})`);
      g.addColorStop(1, 'rgba(20,10,6,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 导弹烟雾拖尾：历史位置渐隐圆点链（越旧越大越淡） */
  drawTrails(ctx: CanvasRenderingContext2D) {
    for (const tr of this.trails.values()) {
      if (tr.kind !== 'missile') continue;
      const n = tr.pts.length;
      for (let i = 0; i < n; i++) {
        const f = (i + 1) / n; // 0=最旧 → 1=最新
        const pt = tr.pts[i];
        ctx.globalAlpha = 0.04 + 0.15 * f;
        ctx.fillStyle = '#C9CEDA';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.6 + (1 - f) * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** 死亡碎片（方块，与引擎粒子同风格，带重力） */
  drawDebris(ctx: CanvasRenderingContext2D) {
    for (const d of this.debris) {
      if (d.ttl <= 0) continue;
      ctx.globalAlpha = Math.max(0, d.ttl / d.maxTtl);
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size);
    }
    ctx.globalAlpha = 1;
  }

  /** 火花（激光命中 / 导弹爆炸，加色混合更亮） */
  drawSparks(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const sp of this.sparks) {
      if (sp.ttl <= 0) continue;
      ctx.globalAlpha = Math.max(0, sp.ttl / sp.maxTtl);
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /** 击杀瞬间白闪（径向渐变，0.1s） */
  drawFlashes(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flashes) {
      if (f.ttl <= 0) continue;
      const a = f.ttl / KILL_FLASH_TTL;
      const r = f.r * (1 + (1 - a) * 0.6);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.85 * a})`);
      g.addColorStop(0.5, `rgba(255,240,210,${0.4 * a})`);
      g.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 渲染层补充冲击波环（BOSS 多层环），风格同引擎 rings */
  drawRings(ctx: CanvasRenderingContext2D) {
    for (const r of this.rings) {
      if (r.ttl <= 0) continue;
      const life = Math.max(0, r.ttl / r.maxTtl);
      const k = 1 - life;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.globalAlpha = life * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1, 7 * life);
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  /** BOSS 全屏白闪（在 Bloom 合成之后绘制，保持纯白） */
  drawBossFlash(ctx: CanvasRenderingContext2D, w: number, h: number) {
    if (this.bossFlash <= 0) return;
    const a = Math.max(0, this.bossFlash / BOSS_FLASH_TTL);
    ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
    ctx.fillRect(-24, -24, w + 48, h + 48);
  }

  /** 辉光层绘制：发光元素的简化加色形状（低分辨率，主画布已有清晰版） */
  drawGlow(g: CanvasRenderingContext2D, s: GameState, paths: ReadonlyArray<ReadonlyArray<readonly [number, number]>>, exits: ReadonlyArray<{ centerX: number; centerY: number }>) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // 路径流光（压低透明度：模糊后不再糊成盖住怪物的青色雾气）
    g.strokeStyle = 'rgba(34,224,255,0.15)';
    g.lineWidth = 2.5;
    for (const px of paths) {
      g.beginPath();
      px.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
      g.stroke();
    }
    // 等离子灼烧区
    for (const z of s.zones) {
      g.globalAlpha = 0.5 * Math.max(0, z.ttl / z.maxTtl);
      g.fillStyle = '#FF6B3D';
      g.beginPath();
      g.arc(z.x, z.y, z.r * 0.8, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // 基地护罩
    for (const ex of exits) {
      g.globalAlpha = 0.28;
      g.fillStyle = '#22E0FF';
      g.beginPath();
      g.arc(ex.centerX, ex.centerY, 26, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // 弹丸
    for (const pr of s.projectiles) {
      if (pr.kind === 'plasma') {
        g.globalAlpha = 0.8;
        g.fillStyle = '#FF6B3D';
        g.beginPath();
        g.arc(pr.x, pr.y, 7, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#FFF3D6';
        g.beginPath();
        g.arc(pr.x, pr.y, 3, 0, Math.PI * 2);
        g.fill();
      } else {
        g.globalAlpha = 0.7;
        g.fillStyle = '#FF9F43';
        g.beginPath();
        g.arc(pr.x, pr.y, 4.5, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    // 光束（电磁炮额外一层粗紫晕）
    for (const b of s.beams) {
      const a = b.ttl / b.maxTtl;
      if (b.color === '#8B5CF6') {
        g.globalAlpha = a * 0.6;
        g.strokeStyle = b.color;
        g.lineWidth = b.width * 2.4;
        g.beginPath();
        g.moveTo(b.x1, b.y1);
        g.lineTo(b.x2, b.y2);
        g.stroke();
      }
      g.globalAlpha = a;
      g.strokeStyle = b.color;
      g.lineWidth = b.width;
      g.beginPath();
      g.moveTo(b.x1, b.y1);
      g.lineTo(b.x2, b.y2);
      g.stroke();
    }
    g.globalAlpha = 1;
    // 引擎粒子
    for (const pt of s.particles) {
      g.globalAlpha = (pt.ttl / pt.maxTtl) * 0.8;
      g.fillStyle = pt.color;
      g.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    g.globalAlpha = 1;
    // 引擎冲击波环 + 渲染层补充环
    for (const r of s.rings) {
      g.globalAlpha = Math.max(0, r.ttl / r.maxTtl) * 0.7;
      g.strokeStyle = r.color;
      g.lineWidth = 3;
      const k = 1 - Math.max(0, r.ttl / r.maxTtl);
      const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
      g.beginPath();
      g.arc(r.x, r.y, rad, 0, Math.PI * 2);
      g.stroke();
    }
    for (const r of this.rings) {
      if (r.ttl <= 0) continue;
      g.globalAlpha = Math.max(0, r.ttl / r.maxTtl) * 0.7;
      g.strokeStyle = r.color;
      g.lineWidth = 4;
      const k = 1 - Math.max(0, r.ttl / r.maxTtl);
      const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
      g.beginPath();
      g.arc(r.x, r.y, rad, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
    // 击杀白闪 / 火花 / 碎片
    for (const f of this.flashes) {
      if (f.ttl <= 0) continue;
      g.globalAlpha = (f.ttl / KILL_FLASH_TTL) * 0.9;
      g.fillStyle = '#FFF6E0';
      g.beginPath();
      g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      g.fill();
    }
    for (const sp of this.sparks) {
      if (sp.ttl <= 0) continue;
      g.globalAlpha = Math.max(0, sp.ttl / sp.maxTtl) * 0.8;
      g.fillStyle = sp.color;
      g.beginPath();
      g.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      g.fill();
    }
    for (const d of this.debris) {
      if (d.ttl <= 0) continue;
      g.globalAlpha = Math.max(0, d.ttl / d.maxTtl) * 0.5;
      g.fillStyle = d.color;
      g.fillRect(d.x - d.size / 2, d.y - d.size / 2, d.size, d.size);
    }
    g.globalAlpha = 1;
    // 浮字不进辉光层（模糊后会在怪物身上糊成白色光斑）
  }
}
