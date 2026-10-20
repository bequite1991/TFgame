// 游戏引擎 —— 固定步长逻辑，无 DOM/React 依赖，可整体移植
import {
  buildLevelMap, CELL, COOP_HP_MUL, COOP_LIVES_MUL, COOP_MAX_PLAYERS, DIFFICULTIES, ECONOMY, ENEMIES, LADDER, MECHA,
  MINI_BOSS, PREP_TIME, SELL_RATE, TOWERS,
  ladderCountMul, ladderHpMul, ladderSpeedMul,
} from './config';
import { getCoopLevel, getLevel } from './levels';
import { TECH_LIST } from './config';
import type {
  Command, Difficulty, EnemyState, GameEngine, GameEvent, GameState, MechaState, NetGameState, ParticleState, SpawnItem, TechId, TowerState,
} from './types';

let uid = 1;

/** 引擎粒子硬上限：超出后新粒子直接丢弃（随机数照常被消耗，不改变随机序列） */
const PARTICLE_MAX = 300;

// 低端机判定：微信小游戏无 navigator，优先读 wx.getDeviceInfo 的 benchmarkLevel（<=0 为未知不判低端）；浏览器预览回退核数
declare const wx: { getDeviceInfo?(): { benchmarkLevel?: number } } | undefined;

function detectLowSpec(): boolean {
  try {
    if (typeof wx !== 'undefined' && wx && wx.getDeviceInfo) {
      const lv = wx.getDeviceInfo().benchmarkLevel;
      if (typeof lv === 'number' && lv > 0) return lv <= 20;
      return false;
    }
  } catch { /* ignore */ }
  return typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 4;
}

export interface EngineOptions {
  /** 协作模式（2–4 人）：多路地图 + 共享生命 + 经济独立（golds）+ 科技主机为准 */
  coop?: boolean;
  /** 协作局玩家数（2–4，超界钳制）；coop:true 且未给 players 时按 2 处理（向后兼容双人调用方） */
  players?: number;
  /** 协作模式各玩家起始金币（长度 = players）；缺省各为 normal 难度标准起始金（难度系数仍经 hpMul/speedMul 生效） */
  startGold?: number[];
}

export function createEngine(difficulty: Difficulty, levelId: number = 1, opts?: EngineOptions): GameEngine {
  const diff = DIFFICULTIES[difficulty];
  // 玩家数：协作局 2–4（coop:true 缺省按 2），单人恒 1；coop = players > 1
  const coop = !!opts?.coop || (opts?.players ?? 1) > 1;
  const players = coop ? Math.min(COOP_MAX_PLAYERS, Math.max(2, Math.round(opts?.players ?? 2))) : 1;
  // 协作局按人数选图（2 人双路 / 3–4 人四路），levelId 仅在单人局生效
  const level = coop ? getCoopLevel(players) : getLevel(levelId);
  const map = buildLevelMap(level.paths);
  const lowSpec = detectLowSpec();
  const particleScale = lowSpec ? 0.5 : 1;
  // 起始金币随章节抬升：高章节怪物经阶梯加硬，开局需能立刻铺开更多火力
  const chapterGold = level.id >= 1 ? Math.round((level.id - 1) * LADDER.startGoldPerLevel) : 0;
  const startGolds: number[] | null = coop
    ? Array.from(
        { length: players },
        (_, i) => (opts?.startGold?.[i] ?? DIFFICULTIES.normal.gold) + chapterGold,
      )
    : null;
  // 协作局共享生命随人数微调（2 人 ×1.0 / 3 人 ×1.1 / 4 人 ×1.2），防止人数越多死得越快
  const startLives = coop ? Math.round(diff.lives * (COOP_LIVES_MUL[players] ?? 1)) : diff.lives;

  const state: GameState = {
    phase: 'prep',
    clock: 0,
    timeSec: 0,
    gold: startGolds ? startGolds[0] : diff.gold + chapterGold,
    lives: startLives,
    maxLives: startLives,
    coop,
    players,
    golds: startGolds,
    killsBy: coop ? new Array(players).fill(0) : null,
    wave: 1,
    totalWaves: level.waves.length,
    prepT: PREP_TIME,
    paused: false,
    speed: 1,
    enemies: [],
    towers: [],
    mechas: [],
    projectiles: [],
    beams: [],
    particles: [],
    rings: [],
    floaters: [],
    splits: [],
    zones: [],
    spawnQueue: [],
    spawnT: 0,
    kills: 0,
    leaked: 0,
    goldEarned: 0,
    shake: 0,
    towerTypesBuilt: [],
    usedFrost: false,
    maxTowerLevel: 1,
    boss1Killed: false,
    techs: [],
    techChoices: null,
    events: [],
  };

  // ---------- 局内科技加成 ----------

  // 科技计数/倍率缓存：techs 仅在指令阶段（tick 之间）变化，每 tick 开头重算一次，扫描热循环零 reduce
  const techCounts: Record<TechId, number> = {
    dmg: 0, rate: 0, range: 0, gold: 0, crit: 0,
    splash: 0, slow: 0, pierce: 0, supply: 0, repair: 0,
  };
  let dmgMulV = 1;
  let rateMulV = 1;
  let rangeMulV = 1;
  let goldMulV = 1;
  let splashMulV = 1;
  function refreshTechCache() {
    for (const k in techCounts) techCounts[k as TechId] = 0;
    for (const t of state.techs) techCounts[t] += 1;
    dmgMulV = 1 + 0.15 * techCounts.dmg;
    rateMulV = 1 + 0.12 * techCounts.rate;
    rangeMulV = 1 + 0.1 * techCounts.range;
    goldMulV = 1 + 0.25 * techCounts.gold;
    splashMulV = 1 + 0.2 * techCounts.splash;
  }

  const techCount = (id: TechId) => techCounts[id];
  const dmgMul = () => dmgMulV;
  const rateMul = () => rateMulV;
  const rangeMul = () => rangeMulV;
  const goldMul = () => goldMulV;
  const splashMul = () => splashMulV;
  /** 暴击倍率：roll 成功 → 双倍 */
  function critMul() {
    return Math.random() < 0.1 * techCount('crit') ? 2 : 1;
  }

  function rollTechChoices(): TechId[] {
    const pool = TECH_LIST.map((t) => t.id);
    // 战局后段不再出现单发补给类科技（收益随波次衰减）
    const late = state.wave > 6;
    const candidates = pool.filter((id) => !(late && (id === 'supply' || id === 'repair')));
    const picks: TechId[] = [];
    while (picks.length < 3 && candidates.length > 0) {
      const i = Math.floor(Math.random() * candidates.length);
      picks.push(candidates[i]);
      candidates.splice(i, 1);
    }
    return picks;
  }

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((f) => f());
  const pushEvent = (e: GameEvent) => state.events.push(e);

  // ---------- 工具 ----------

  /** 玩家金币池：协作读 golds[player]，单人读 state.gold；写回时同步 gold=golds[0] 镜像 */
  function goldOf(player: number): number {
    return state.golds ? state.golds[player] : state.gold;
  }

  function setGold(player: number, value: number) {
    if (state.golds) {
      state.golds[player] = value;
      state.gold = state.golds[0]; // 镜像主机池，供 UI 与兼容逻辑读取
    } else {
      state.gold = value;
    }
  }

  function addGold(player: number, delta: number) {
    setGold(player, goldOf(player) + delta);
  }

  function addFloater(x: number, y: number, text: string, color: string) {
    state.floaters.push({ id: uid++, x, y, text, color, ttl: 0.9, maxTtl: 0.9 });
  }

  function addExplosion(x: number, y: number, color: string, count: number, power = 120) {
    const n = Math.max(4, Math.round(count * particleScale));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = power * (0.4 + Math.random() * 0.8);
      const ttl = 0.4 + Math.random() * 0.3;
      const p: ParticleState = {
        id: uid++, x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        ttl, maxTtl: ttl, color,
        size: 2 + Math.random() * 3,
      };
      if (state.particles.length < PARTICLE_MAX) state.particles.push(p);
    }
  }

  function addBeam(x1: number, y1: number, x2: number, y2: number, color: string, width: number, ttl = 0.1) {
    state.beams.push({ id: uid++, x1, y1, x2, y2, color, width, ttl, maxTtl: ttl });
  }

  function addRing(x: number, y: number, color: string, r0: number, r1: number, ttl = 0.5) {
    state.rings.push({ id: uid++, x, y, color, r0, r1, ttl, maxTtl: ttl });
  }

  function isInvisible(e: EnemyState): boolean {
    return e.type === 'lurker' && e.stealthT % 4 >= 3;
  }

  /** 精英待遇（BOSS 与掠晶兽）：减速减半、免眩晕；不置 isBoss，避免误触发 bossDown/成就/结算 */
  function isElite(e: EnemyState): boolean {
    return e.isBoss || e.type === 'miniboss';
  }

  /** 掠晶兽增益是否生效（引擎时钟未过 buffUntil） */
  function towerBuffActive(t: TowerState): boolean {
    return state.clock < t.buffUntil;
  }

  function scaledHp(type: EnemyState['type'], wave: number, override?: number): number {
    // hpOverride 是手工编排的绝对血量（BOSS 波），不再叠加难度系数，避免双重放大
    if (override !== undefined) return override;
    // 怪物等级递增：血量 = 基础 × 难度阶梯（章节 × 波次）× 难度系数
    return Math.round(ENEMIES[type].hp * ladderHpMul(level.id, wave) * diff.hpMul);
  }

  function spawnEnemy(item: SpawnItem, dist = 0) {
    const def = ENEMIES[item.type];
    const e: EnemyState = {
      id: uid++,
      type: item.type,
      hp: 0,
      maxHp: 0,
      dist,
      path: item.path ?? 0,
      speed: def.speed * diff.speedMul * ladderSpeedMul(level.id, state.wave),
      // 击杀奖励随难度阶梯（章节×波次血量倍率）同步放大：金币产出始终与怪物硬度成比例，
      // 高章节经济能跟上火力需求；rewardOverride（BOSS 等）保持表记面值
      reward: item.rewardOverride ?? Math.max(1, Math.round(def.reward * ladderHpMul(level.id, state.wave))),
      leak: def.leak,
      slowUntil: 0,
      slowPct: 0,
      stunUntil: 0,
      vulnUntil: 0,
      lastHitAt: -999,
      stealthT: Math.random() * 2,
      isBoss: item.type === 'boss',
      enraged: false,
      bornAt: state.clock,
      ex: 0,
      ey: 0,
    };
    e.maxHp = scaledHp(item.type, state.wave, item.hpOverride);
    // 协作局虫群 HP 人数系数（含 hpOverride 的 BOSS，统一在此乘；单人 coop=false 不进入此分支）
    if (coop) e.maxHp = Math.round(e.maxHp * (COOP_HP_MUL[players] ?? 1));
    e.hp = e.maxHp;
    const ep = map.posAt(e.path, e.dist);
    e.ex = ep.x;
    e.ey = ep.y;
    state.enemies.push(e);
    if (e.isBoss) {
      state.shake = 1;
      pushEvent({ type: 'waveStart', wave: state.wave }); // BOSS 出场提示复用
    }
  }

  function buildSpawnQueue(wave: number): SpawnItem[] {
    const def = level.waves[wave - 1];
    // 各组交错（round-robin），BOSS 优先第一个出场
    const pathCount = map.paths.length;
    // 协作局活跃路数 = min(玩家数, 地图路径数)：显式 path 按活跃路数取模重映射
    // （如 3 人局四路图的 path 3 组落回 path 0，空路不出怪）；未指定路径的组在活跃路之间轮转。
    // 单人局 laneCount = pathCount，重映射为恒等，行为与现版一致。
    const laneCount = coop ? Math.min(players, pathCount) : pathCount;
    // 难度阶梯：普通怪数量随章节与波次递增（BOSS 只数不放大，血量见 hpOverride）
    const cntMul = ladderCountMul(level.id, wave);
    let rr = 0; // 未指定路径的组在所有路径间轮转（确定性）
    const pools = def.groups.map((g) => {
      const base = rr;
      const count = g.type === 'boss' ? g.count : Math.max(g.count, Math.round(g.count * cntMul));
      if (g.path === undefined) rr += count;
      return Array.from({ length: count }, (_, i): SpawnItem => ({
        type: g.type,
        // 节奏系数：整体拉长出怪间隔，单波持续时间更久、压力更持续
        interval: g.interval * LADDER.intervalMul,
        path: g.path !== undefined ? g.path % laneCount : (base + i) % laneCount,
        hpOverride: g.hpOverride,
        rewardOverride: g.rewardOverride,
      }));
    });
    pools.sort((a, b) => (b[0]?.type === 'boss' ? 1 : 0) - (a[0]?.type === 'boss' ? 1 : 0));
    const queue: SpawnItem[] = [];
    let added = true;
    while (added) {
      added = false;
      for (const pool of pools) {
        const item = pool.shift();
        if (item) {
          queue.push(item);
          added = true;
        }
      }
    }
    // 随机小 BOSS：非 BOSS 波按概率向队列随机位置注入一只掠晶兽（血量/奖励走标准难度阶梯管线；
    // interval 取 0 不拖长整波节奏，路径随机落到活跃路之一）。
    // 教学关（id < 1 的单人局）不注入：波次构成保持表记的 crawler/speeder 纯教学编排
    if (!def.isBoss && queue.length > 0 && (level.id >= 1 || coop) && Math.random() < MINI_BOSS.chance) {
      queue.splice(Math.floor(Math.random() * (queue.length + 1)), 0, {
        type: 'miniboss',
        interval: 0,
        path: Math.floor(Math.random() * laneCount),
      });
    }
    return queue;
  }

  // ---------- 伤害与击杀 ----------

  /** 击杀来源：塔或机甲（联机分账与击杀计数的依据） */
  type Killer = { owner: number; kills: number };

  function applyDamage(e: EnemyState, raw: number, source: 'laser' | 'missile' | 'frost' | 'railgun' | 'tesla' | 'plasma' | 'mecha', killer?: Killer) {
    if (e.hp <= 0) return;
    let dmg = raw * dmgMul() * critMul();
    // 掠晶兽增益：伤害加成在命中结算处统一乘一次（killer 为塔且增益未过期；机甲无 buffUntil 不受影响）
    if (killer && 'buffUntil' in killer && state.clock < (killer as TowerState).buffUntil) dmg *= MINI_BOSS.dmgMul;
    const armored = e.type === 'tanker' || e.isBoss;
    if (armored) dmg *= 1 + 0.25 * techCount('pierce'); // 穿甲：对甲壳/BOSS +25%/层
    if (source === 'laser' && e.type === 'tanker' && techCount('pierce') === 0) dmg *= 0.75; // 装甲
    if (state.clock < e.vulnUntil) dmg *= 1.15; // 破甲
    e.hp -= dmg;
    e.lastHitAt = state.clock; // 受击闪光
    if (e.isBoss && !e.enraged && e.hp <= e.maxHp * 0.5) {
      e.enraged = true;
      e.speed *= 1.4;
    }
    if (e.hp <= 0) killEnemy(e, killer);
  }

  function killEnemy(e: EnemyState, killer?: Killer) {
    e.hp = 0;
    state.kills += 1;
    const earned = Math.max(1, Math.round(e.reward * goldMul() * ECONOMY.rewardMul));
    if (state.golds) {
      // 协作：击杀金币归击杀单位的主人；单位被卖后飞行弹体/灼烧区命中时 killer 为 undefined，归主机
      const owner = killer?.owner ?? 0;
      state.golds[owner] += earned;
      state.gold = state.golds[0];
      if (killer) state.killsBy![owner] += 1;
    } else {
      state.gold += earned;
    }
    state.goldEarned += earned;
    if (killer) killer.kills += 1;
    const p = { x: e.ex, y: e.ey };
    const color = e.isBoss ? '#FF3D81' : '#FFC94D';
    addExplosion(p.x, p.y, e.isBoss ? '#FF3D81' : '#B8FF3D', e.isBoss ? 26 : 12, e.isBoss ? 200 : 120);
    addFloater(p.x, p.y - 10, `+${earned}`, color);
    // 击杀冲击波环
    addRing(p.x, p.y, color, 6, e.isBoss ? 90 : 34, e.isBoss ? 0.8 : 0.45);
    if (e.isBoss) {
      state.shake = 1.5;
      addExplosion(p.x, p.y, '#FFC94D', Math.round(20 / particleScale), 260);
      addRing(p.x, p.y, '#FFFFFF', 10, 60, 0.55);
      addRing(p.x, p.y, '#FF3D81', 4, 130, 1.0);
      state.boss1Killed = true; // 本关任意 BOSS 波击杀 BOSS 即置位
      pushEvent({ type: 'bossDown', wave: state.wave });
    }
    if (e.type === 'miniboss') {
      // 掠晶兽击杀：晶核能量强化死亡点周边炮塔（已有更长的增益不被缩短）
      const until = state.clock + MINI_BOSS.duration;
      for (const t of state.towers) {
        if (Math.hypot(t.cx - p.x, t.cy - p.y) <= MINI_BOSS.radius * CELL) {
          t.buffUntil = Math.max(t.buffUntil, until);
        }
      }
      addRing(p.x, p.y, '#FFC94D', 10, MINI_BOSS.radius * CELL, 0.7);
      addFloater(p.x, p.y - 24, '炮塔强化！', '#FFC94D');
      pushEvent({ type: 'miniBossDown', x: p.x, y: p.y });
    }
    if (e.type === 'splitter') {
      // 分裂动画特效（纯装饰，不进联机快照）：父体两瓣分离，幼体从裂口中爬出
      const ahead = map.posAt(e.path, e.dist + 10);
      state.splits.push({
        id: uid++,
        x: p.x,
        y: p.y,
        angle: Math.atan2(ahead.y - p.y, ahead.x - p.x),
        ttl: 0.65,
        maxTtl: 0.65,
      });
      // 分裂为 2 个爬行者，HP 为当前波爬行者 60%，继承父体路径
      for (let i = 0; i < 2; i++) {
        spawnEnemy(
          { type: 'crawler', interval: 0, path: e.path, hpOverride: Math.round(scaledHp('crawler', state.wave) * 0.6) },
          Math.max(0, e.dist - i * 14),
        );
      }
    }
  }

  // ---------- 塔开火 ----------

  function inRange(t: TowerState, e: EnemyState): boolean {
    const def = TOWERS[t.type].levels[t.level];
    return e.hp > 0 && Math.hypot(e.ex - t.cx, e.ey - t.cy) <= def.range * CELL * rangeMul();
  }

  function pickTarget(t: TowerState, ignoreStealth: boolean): EnemyState | null {
    let best: EnemyState | null = null;
    for (const e of state.enemies) {
      if (!ignoreStealth && isInvisible(e)) continue;
      if (!inRange(t, e)) continue;
      if (!best || e.dist > best.dist) best = e;
    }
    return best;
  }

  function fireLaser(t: TowerState, target: EnemyState) {
    const lv = TOWERS.laser.levels[t.level];
    t.lastFireAt = state.clock;
    const p = { x: target.ex, y: target.ey };
    addBeam(t.cx, t.cy, p.x, p.y, '#22E0FF', 2);
    applyDamage(target, lv.damage, 'laser', t);
    if (t.level === 2) {
      // Lv3 光束贯穿 1 个额外目标（50% 伤害）
      let second: EnemyState | null = null;
      for (const e of state.enemies) {
        if (e === target || e.hp <= 0 || isInvisible(e) || !inRange(t, e)) continue;
        if (!second || e.dist > second.dist) second = e;
      }
      if (second) {
        addBeam(p.x, p.y, second.ex, second.ey, '#22E0FF88', 1.5);
        applyDamage(second, lv.damage * 0.5, 'laser', t);
      }
    }
  }

  function fireMissile(t: TowerState, target: EnemyState) {
    const def = TOWERS.missile;
    const lv = def.levels[t.level];
    t.lastFireAt = state.clock;
    state.projectiles.push({
      id: uid++, kind: 'missile',
      fromX: t.cx, fromY: t.cy, x: t.cx, y: t.cy,
      tx: target.ex, ty: target.ey, t: 0, dur: 0.35,
      damage: lv.damage,
      splash: def.splash![t.level] * splashMul(),
      stun: def.stun![t.level],
      towerId: t.id,
    });
    pushEvent({ type: 'sfx', name: 'missile' });
  }

  /** 闪电折线：每跳拆成 2-3 段带随机折点的 beam */
  function addLightning(x1: number, y1: number, x2: number, y2: number) {
    const mids = Math.random() < 0.5 ? 1 : 2;
    const pts: [number, number][] = [[x1, y1]];
    for (let i = 1; i <= mids; i++) {
      const f = i / (mids + 1);
      pts.push([
        x1 + (x2 - x1) * f + (Math.random() - 0.5) * 26,
        y1 + (y2 - y1) * f + (Math.random() - 0.5) * 26,
      ]);
    }
    pts.push([x2, y2]);
    for (let i = 0; i < pts.length - 1; i++) {
      addBeam(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], '#FFE93D', 2, 0.14);
    }
  }

  function fireTesla(t: TowerState, target: EnemyState) {
    const def = TOWERS.tesla;
    t.lastFireAt = state.clock;
    const lv = def.levels[t.level];
    const jumps = def.chain![t.level]; // 主目标之外的连锁数
    const decay = def.chainDecay!;
    const hit = new Set<number>();
    let px = t.cx;
    let py = t.cy;
    let dmg = lv.damage;
    let cur: EnemyState | null = target;
    while (cur) {
      addLightning(px, py, cur.ex, cur.ey);
      applyDamage(cur, dmg, 'tesla', t);
      hit.add(cur.id);
      px = cur.ex;
      py = cur.ey;
      dmg *= decay;
      if (hit.size > jumps) break;
      // 距上一个命中目标 2.5 格内最近的未命中敌人（隐身不可被闪电锁定）
      let next: EnemyState | null = null;
      let best = Infinity;
      for (const e of state.enemies) {
        if (e.hp <= 0 || hit.has(e.id) || isInvisible(e)) continue;
        const d = Math.hypot(e.ex - px, e.ey - py);
        if (d <= 2.5 * CELL && d < best) {
          best = d;
          next = e;
        }
      }
      cur = next;
    }
    addExplosion(px, py, '#FFE93D', 6, 80);
  }

  function firePlasma(t: TowerState, target: EnemyState) {
    const def = TOWERS.plasma;
    t.lastFireAt = state.clock;
    const lv = def.levels[t.level];
    state.projectiles.push({
      id: uid++, kind: 'plasma',
      fromX: t.cx, fromY: t.cy, x: t.cx, y: t.cy,
      tx: target.ex, ty: target.ey, t: 0, dur: 0.45,
      damage: lv.damage,      splash: def.splash![t.level] * splashMul(),
      stun: 0,
      towerId: t.id,
      dps: def.dot![t.level],
      zoneR: def.zoneR![t.level],
    });
    pushEvent({ type: 'sfx', name: 'plasma' });
  }

  function fireFrost(t: TowerState, target: EnemyState) {
    const def = TOWERS.frost;
    t.lastFireAt = state.clock;
    const lv = def.levels[t.level];
    // 粘阻弹：弹体抛物线飞到目标点炸开，粘阻剂溅 2 格范围内的敌人（落地结算在弹丸更新循环）
    state.projectiles.push({
      id: uid++, kind: 'frost',
      fromX: t.cx, fromY: t.cy, x: t.cx, y: t.cy,
      tx: target.ex, ty: target.ey, t: 0, dur: 0.4,
      damage: lv.damage,
      splash: 2,
      stun: 0,
      towerId: t.id,
      slowPct: def.slowPct![t.level],
      slowDur: def.slowDur![t.level],
    });
    pushEvent({ type: 'sfx', name: 'frost' });
  }

  function updateRailgun(t: TowerState, dt: number) {
    const def = TOWERS.railgun;
    const lv = def.levels[t.level];
    if (t.charging) {
      const target = pickTarget(t, true);
      if (target) {
        t.aimX = target.ex;
        t.aimY = target.ey;
      }
      t.chargeT -= dt;
      if (t.chargeT <= 0) {
        t.charging = false;
        t.cooldown = 1 / lv.rate / rateMul() / (towerBuffActive(t) ? MINI_BOSS.rateMul : 1);
        t.lastFireAt = state.clock;
        // 贯穿直线：从塔心沿瞄准方向 range 内所有敌人（含隐身）
        const dx = t.aimX - t.cx;
        const dy = t.aimY - t.cy;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const reach = lv.range * CELL * rangeMul();
        const ex = t.cx + ux * reach;
        const ey = t.cy + uy * reach;
        addBeam(t.cx, t.cy, ex, ey, '#8B5CF6', 6, 0.18);
        state.shake = Math.max(state.shake, 0.4);
        pushEvent({ type: 'sfx', name: 'railgun' });
        const hits = state.enemies
          .filter((e) => {
            if (e.hp <= 0) return false;
            const proj = (e.ex - t.cx) * ux + (e.ey - t.cy) * uy;
            if (proj < 0 || proj > reach) return false;
            const perp = Math.abs((e.ex - t.cx) * uy - (e.ey - t.cy) * ux);
            return perp <= CELL * 0.5;
          })
          .sort((a, b) => a.dist - b.dist);
        hits.forEach((e, i) => {
          const decay = t.level === 2 ? 1 : Math.pow(def.pierceDecay!, i);
          applyDamage(e, lv.damage * decay, 'railgun', t);
          if (t.level === 2 && e.hp > 0) e.vulnUntil = state.clock + 3; // 破甲
        });
      }
      return;
    }
    if (t.cooldown > 0) return;
    const target = pickTarget(t, true); // 电磁炮可锁定隐身目标
    if (!target) return;
    t.aimX = target.ex;
    t.aimY = target.ey;
    t.charging = true;
    t.chargeT = def.charge!;
  }

  function updateTower(t: TowerState, dt: number) {
    if (t.type === 'railgun') {
      updateRailgun(t, dt);
      return;
    }
    t.cooldown -= dt;
    if (t.cooldown > 0) return;
    const target = pickTarget(t, false);
    if (!target) return;
    const lv = TOWERS[t.type].levels[t.level];
    t.cooldown = 1 / lv.rate / rateMul() / (towerBuffActive(t) ? MINI_BOSS.rateMul : 1);
    t.aimX = target.ex;
    t.aimY = target.ey;
    if (t.type === 'laser') fireLaser(t, target);
    else if (t.type === 'missile') fireMissile(t, target);
    else if (t.type === 'tesla') fireTesla(t, target);
    else if (t.type === 'plasma') firePlasma(t, target);
    else fireFrost(t, target);
  }

  // ---------- 机甲 ----------

  /** 机甲：锚点 leash 内自动迎敌（站位保持在机炮射程边沿），机炮点射 + 肩部导弹溅射 */
  function updateMecha(m: MechaState, dt: number) {
    const lv = MECHA.levels[m.level];
    const ax = (m.anchorCol + 0.5) * CELL;
    const ay = (m.anchorRow + 0.5) * CELL;
    // 巡逻目标：锚点巡逻半径内最前沿的敌人
    let anchorTarget: EnemyState | null = null;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.ex - ax, e.ey - ay) > MECHA.leash * CELL) continue;
      if (!anchorTarget || e.dist > anchorTarget.dist) anchorTarget = e;
    }
    // 期望站位：锚点 → 目标方向，停在机炮射程边沿；无敌时回锚点
    let dx0 = ax;
    let dy0 = ay;
    if (anchorTarget) {
      const ddx = anchorTarget.ex - ax;
      const ddy = anchorTarget.ey - ay;
      const dA = Math.hypot(ddx, ddy) || 1;
      const stand = Math.min(Math.max(0, dA - lv.range * CELL * 0.8), MECHA.leash * CELL);
      dx0 = ax + (ddx / dA) * stand;
      dy0 = ay + (ddy / dA) * stand;
    }
    const mx = dx0 - m.x;
    const my = dy0 - m.y;
    const md = Math.hypot(mx, my);
    if (md > 2) {
      const step = Math.min(md, MECHA.moveSpeed * CELL * dt);
      m.x += (mx / md) * step;
      m.y += (my / md) * step;
      m.walkT += dt;
      // 推进器尾焰
      if (Math.random() <= particleScale * 0.6) {
        const p: ParticleState = {
          id: uid++, x: m.x + (Math.random() - 0.5) * 8, y: m.y + 14,
          vx: (Math.random() - 0.5) * 14, vy: 26 + Math.random() * 18,
          ttl: 0.25, maxTtl: 0.25, color: '#9FD8FF', size: 1.5 + Math.random() * 1.5,
        };
        if (state.particles.length < PARTICLE_MAX) state.particles.push(p);
      }
    }
    // 攻击：当前位置射程内最前沿敌人（隐身不可锁定）
    m.cooldown -= dt;
    m.missileT -= dt;
    let target: EnemyState | null = null;
    for (const e of state.enemies) {
      if (e.hp <= 0 || isInvisible(e)) continue;
      if (Math.hypot(e.ex - m.x, e.ey - m.y) > lv.range * CELL) continue;
      if (!target || e.dist > target.dist) target = e;
    }
    if (!target) return;
    m.aimX = target.ex;
    m.aimY = target.ey;
    if (m.cooldown <= 0) {
      m.cooldown = 1 / lv.rate;
      m.lastFireAt = state.clock;
      addBeam(m.x, m.y - 8, target.ex, target.ey, '#9FD8FF', 2.5, 0.12);
      applyDamage(target, lv.damage, 'mecha', m);
    }
    if (m.missileT <= 0) {
      m.missileT = lv.missileEvery;
      state.projectiles.push({
        id: uid++, kind: 'missile',
        fromX: m.x - 10, fromY: m.y - 16, x: m.x - 10, y: m.y - 16,
        tx: target.ex, ty: target.ey, t: 0, dur: 0.4,
        damage: lv.missileDamage,
        splash: lv.missileSplash,
        stun: 0,
        towerId: m.id,
      });
      pushEvent({ type: 'sfx', name: 'missile' });
    }
  }

  // ---------- 波次流程 ----------

  function startWave() {
    state.phase = 'combat';
    state.spawnQueue = buildSpawnQueue(state.wave);
    state.spawnT = 0;
    pushEvent({ type: 'waveStart', wave: state.wave });
    const def = level.waves[state.wave - 1];
    if (def?.comm) pushEvent({ type: 'comm', wave: state.wave, text: def.comm });
  }

  function clearWave() {
    const def = level.waves[state.wave - 1];
    const bonus = Math.max(10, Math.round(def.bonus * ECONOMY.bonusMul));
    if (state.golds) {
      // 协作：波次奖励全员平分（除不尽的零头归末位玩家，保证各池之和精确等于 bonus）
      const share = Math.round(bonus / players);
      for (let i = 0; i < players - 1; i++) state.golds[i] += share;
      state.golds[players - 1] += bonus - share * (players - 1);
      state.gold = state.golds[0];
    } else {
      state.gold += bonus;
    }
    state.goldEarned += bonus;
    addFloater(270, 120, `波次奖励 +${bonus}`, '#FFC94D');
    pushEvent({ type: 'waveClear', wave: state.wave, bonus });
    if (state.wave >= state.totalWaves) {
      state.phase = 'won';
      state.techChoices = null;
      pushEvent({ type: 'gameOver', won: true });
    } else {
      state.wave += 1;
      // 科技三选一每 3 波发放一次（下一波为 4/7/10/13… 时）；其余波次直接进入准备期，避免每波打断节奏与战力叠乘失控
      if (state.wave % ECONOMY.techEvery === 1) {
        state.phase = 'tech';
        state.techChoices = rollTechChoices();
      } else {
        state.phase = 'prep';
        state.prepT = PREP_TIME;
      }
    }
  }

  // ---------- 主循环 ----------

  function tick(dtReal: number) {
    if (
      state.paused || state.phase === 'tech' ||
      state.phase === 'won' || state.phase === 'lost'
    ) {
      notify();
      return;
    }
    const dt = dtReal * state.speed;
    state.clock += dt;
    state.timeSec += dt;
    state.shake = Math.max(0, state.shake - dtReal * 2.2);
    refreshTechCache();

    if (state.phase === 'prep') {
      state.prepT -= dt;
      if (state.prepT <= 0) startWave();
    }

    if (state.phase === 'combat') {
      // 出怪
      if (state.spawnQueue.length > 0) {
        state.spawnT -= dt;
        while (state.spawnT <= 0 && state.spawnQueue.length > 0) {
          const item = state.spawnQueue.shift()!;
          spawnEnemy(item);
          state.spawnT += item.interval;
        }
      }

      // 敌人移动
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        if (e.type === 'lurker') e.stealthT += dt;
        if (state.clock < e.stunUntil) continue; // 眩晕
        const slowed = state.clock < e.slowUntil;
        const factor = slowed ? 1 - e.slowPct : 1;
        e.dist += e.speed * factor * CELL * dt;
        if (e.dist >= map.paths[e.path].length) {
          e.hp = 0; // 标记移除（不算击杀）
          state.lives -= e.leak;
          state.leaked += 1;
          state.shake = Math.max(state.shake, 0.5);
          const exit = map.exitOfPath[e.path];
          addFloater(exit.centerX, exit.centerY - 50, `-${e.leak} 生命`, '#FF5A5A');
          addRing(exit.centerX, exit.centerY, '#FF5A5A', 8, 70, 0.6); // 基地被漏怪红环
          pushEvent({ type: 'leak', lives: state.lives });
        }
      }
      state.enemies = state.enemies.filter((e) => e.hp > 0);

      // 命中坐标每 tick 解算一次写入 ex/ey，后续塔/机甲/溅射/灼烧扫描全部读缓存
      for (const e of state.enemies) {
        const p = map.posAt(e.path, e.dist);
        e.ex = p.x;
        e.ey = p.y;
      }

      if (state.lives <= 0) {
        state.lives = 0;
        state.phase = 'lost';
        addExplosion(270, 930, '#FF5A5A', 30, 260);
        pushEvent({ type: 'gameOver', won: false });
      }

      // 塔与机甲
      for (const t of state.towers) updateTower(t, dt);
      for (const m of state.mechas) updateMecha(m, dt);
      state.enemies = state.enemies.filter((e) => e.hp > 0);

      // 导弹 / 等离子弹
      for (const pr of state.projectiles) {
        pr.t += dt / pr.dur;
        if (pr.t >= 1) {
          pr.x = pr.tx;
          pr.y = pr.ty;
          // 弹丸归属：塔或机甲（机甲肩部导弹复用 missile 弹体）
          const tower = state.towers.find((tw) => tw.id === pr.towerId)
            ?? state.mechas.find((mc) => mc.id === pr.towerId);
          if (pr.kind === 'plasma') {
            addExplosion(pr.tx, pr.ty, '#FF6B3D', 14, 130);
            addRing(pr.tx, pr.ty, '#FF6B3D', 8, Math.max(30, pr.splash * CELL * 0.9), 0.5);
            // 落点瞬时小溅射
            for (const e of state.enemies) {
              if (e.hp <= 0) continue;
              if (Math.hypot(e.ex - pr.tx, e.ey - pr.ty) <= pr.splash * CELL) {
                applyDamage(e, pr.damage, 'plasma', tower);
              }
            }
            // 生成灼烧区域
            state.zones.push({
              id: uid++, x: pr.tx, y: pr.ty,
              r: (pr.zoneR ?? 1) * CELL,
              dps: pr.dps ?? 0,
              ttl: TOWERS.plasma.zoneDur ?? 2.5,
              maxTtl: TOWERS.plasma.zoneDur ?? 2.5,
              towerId: pr.towerId,
            });
          } else if (pr.kind === 'frost') {
            // 粘阻弹炸开：粘液溅射 2 格范围，减速 + 小额伤害（精英减半、迅捷兽加成的修正在落地时结算）
            addExplosion(pr.tx, pr.ty, '#3DF08C', 12, 110);
            addRing(pr.tx, pr.ty, '#3DF08C', 6, Math.max(26, pr.splash * CELL * 0.9), 0.45);
            for (const e of state.enemies) {
              if (e.hp <= 0) continue;
              if (Math.hypot(e.ex - pr.tx, e.ey - pr.ty) > pr.splash * CELL) continue;
              let factor = (pr.slowPct ?? 0.35) + 0.06 * techCount('slow');
              if (factor > 0.8) factor = 0.8;
              if (isElite(e)) factor *= 0.5; // BOSS/掠晶兽减速减半
              if (e.type === 'speeder') factor = Math.min(0.8, factor * 1.2);
              e.slowPct = Math.max(e.slowPct, factor);
              e.slowUntil = state.clock + (pr.slowDur ?? 1.5);
              applyDamage(e, pr.damage, 'frost', tower);
            }
          } else {
            addRing(pr.tx, pr.ty, '#FF9F43', 6, Math.max(26, pr.splash * CELL * 0.9), 0.45);
            for (const e of state.enemies) {
              if (e.hp <= 0) continue;
              if (Math.hypot(e.ex - pr.tx, e.ey - pr.ty) <= pr.splash * CELL) {
                if (pr.stun > 0 && !isElite(e)) e.stunUntil = state.clock + pr.stun;
                applyDamage(e, pr.damage, 'missile', tower);
              }
            }
          }
        } else {
          const arcH = pr.kind === 'plasma' ? 52 : 40;
          pr.x = pr.fromX + (pr.tx - pr.fromX) * pr.t;
          pr.y = pr.fromY + (pr.ty - pr.fromY) * pr.t - Math.sin(pr.t * Math.PI) * arcH;
          // 飞行拖尾（尊重低配 particleScale）
          const trailN = pr.kind === 'plasma' ? 2 : 1;
          for (let i = 0; i < trailN; i++) {
            if (Math.random() > particleScale) continue;
            const ttl = 0.22 + Math.random() * 0.14;
            const p: ParticleState = {
              id: uid++,
              x: pr.x + (Math.random() - 0.5) * 4,
              y: pr.y + (Math.random() - 0.5) * 4,
              vx: (Math.random() - 0.5) * 16,
              vy: (Math.random() - 0.5) * 16,
              ttl, maxTtl: ttl,
              color: pr.kind === 'plasma' ? '#FF6B3D' : pr.kind === 'frost' ? '#3DF08C' : '#FF9F43',
              size: 1.5 + Math.random() * 1.5,
            };
            if (state.particles.length < PARTICLE_MAX) state.particles.push(p);
          }
        }
      }
      state.projectiles = state.projectiles.filter((pr) => pr.t < 1);

      // 灼烧区域 DoT
      for (const z of state.zones) {
        const tower = state.towers.find((tw) => tw.id === z.towerId);
        for (const e of state.enemies) {
          if (e.hp <= 0) continue;
          if (Math.hypot(e.ex - z.x, e.ey - z.y) <= z.r) {
            applyDamage(e, z.dps * dt, 'plasma', tower);
          }
        }
      }
      state.enemies = state.enemies.filter((e) => e.hp > 0);

      // 波次清空判定
      if (
        state.phase === 'combat' &&
        state.spawnQueue.length === 0 &&
        state.enemies.length === 0
      ) {
        clearWave();
      }
    }

    // 视觉特效（随游戏速度同步）
    for (const z of state.zones) z.ttl -= dt;
    state.zones = state.zones.filter((z) => z.ttl > 0);
    for (const b of state.beams) b.ttl -= dt;
    state.beams = state.beams.filter((b) => b.ttl > 0);
    for (const r of state.rings) r.ttl -= dt;
    state.rings = state.rings.filter((r) => r.ttl > 0);
    for (const pt of state.particles) {
      pt.ttl -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
    }
    state.particles = state.particles.filter((pt) => pt.ttl > 0);
    for (const f of state.floaters) {
      f.ttl -= dt;
      f.y -= 44 * dt;
    }
    state.floaters = state.floaters.filter((f) => f.ttl > 0);
    for (const s of state.splits) s.ttl -= dt;
    state.splits = state.splits.filter((s) => s.ttl > 0);

    notify();
  }

  // ---------- 命令 ----------

  function dispatchAs(player: number, cmd: Command): boolean {
    // 玩家索引越界直接拒绝（合法身份为 0..players-1；联机层按 slot 转发，坏包不能越权分账）
    if (player < 0 || player >= players) return false;
    if (state.phase === 'tech') {
      // 科技选择期间：只接受 PICK_TECH
      if (cmd.type !== 'PICK_TECH') return false;
      // 协作：科技三选一以主机（player 0）为准，客机不可代选
      if (state.coop && player !== 0) return false;
      if (!state.techChoices?.includes(cmd.id)) return false;
      state.techs.push(cmd.id);
      state.techChoices = null;
      if (cmd.id === 'supply') {
        // 协作 MVP：空投归主机池（简化处理）
        addGold(0, 200);
        state.goldEarned += 200;
        addFloater(270, 120, '后勤空投 +200', '#FFC94D');
      }
      if (cmd.id === 'repair') {
        state.lives = Math.min(state.maxLives, state.lives + 3);
        addFloater(270, 120, '基地修复 +3', '#3DF08C');
      }
      state.phase = 'prep';
      state.prepT = PREP_TIME;
      notify();
      return true;
    }
    if (cmd.type === 'TOGGLE_PAUSE') {
      if (state.phase === 'won' || state.phase === 'lost') return false;
      state.paused = !state.paused;
      notify();
      return true;
    }
    if (cmd.type === 'SET_SPEED') {
      state.speed = cmd.speed;
      notify();
      return true;
    }
    if (cmd.type === 'SKIP_PREP') {
      if (state.phase !== 'prep') return false;
      state.prepT = 0;
      notify();
      return true;
    }
    if (state.phase === 'won' || state.phase === 'lost') return false;

    if (cmd.type === 'BUILD') {
      const def = TOWERS[cmd.tower];
      const cost = def.levels[0].cost;
      if (!map.isBuildable(cmd.col, cmd.row)) return false;
      if (state.towers.some((t) => t.col === cmd.col && t.row === cmd.row)) return false;
      if (state.mechas.some((m) => m.anchorCol === cmd.col && m.anchorRow === cmd.row)) return false;
      if (goldOf(player) < cost) return false;
      setGold(player, goldOf(player) - cost);
      const c = { x: (cmd.col + 0.5) * CELL, y: (cmd.row + 0.5) * CELL };
      state.towers.push({
        id: uid++, type: cmd.tower, level: 0,
        col: cmd.col, row: cmd.row,
        cooldown: 0, charging: false, chargeT: 0,
        aimX: c.x, aimY: c.y - 60,
        lastFireAt: -999,
        kills: 0, invested: cost,
        owner: player,
        cx: c.x, cy: c.y,
        buffUntil: 0,
      });
      if (!state.towerTypesBuilt.includes(cmd.tower)) state.towerTypesBuilt.push(cmd.tower);
      if (cmd.tower === 'frost') state.usedFrost = true;
      addExplosion(c.x, c.y, def.color, 10, 90);
      notify();
      return true;
    }

    if (cmd.type === 'UPGRADE') {
      const t = state.towers.find((tw) => tw.id === cmd.id);
      if (!t || t.level >= 2) return false;
      // 协作：只能操作自己的塔
      if (state.coop && t.owner !== player) return false;
      const cost = TOWERS[t.type].levels[t.level + 1].cost;
      if (goldOf(player) < cost) return false;
      setGold(player, goldOf(player) - cost);
      t.level += 1;
      t.invested += cost;
      state.maxTowerLevel = Math.max(state.maxTowerLevel, t.level + 1);
      addExplosion(t.cx, t.cy, TOWERS[t.type].color, 14, 110);
      addFloater(t.cx, t.cy - 30, 'LEVEL UP', '#3DF08C');
      notify();
      return true;
    }

    if (cmd.type === 'DEPLOY_MECHA') {
      const cost = MECHA.levels[0].cost;
      // 每名玩家限一台
      if (state.mechas.some((m) => m.owner === player)) return false;
      if (!map.isBuildable(cmd.col, cmd.row)) return false;
      if (state.towers.some((t) => t.col === cmd.col && t.row === cmd.row)) return false;
      if (state.mechas.some((m) => m.anchorCol === cmd.col && m.anchorRow === cmd.row)) return false;
      if (goldOf(player) < cost) return false;
      setGold(player, goldOf(player) - cost);
      const x = (cmd.col + 0.5) * CELL;
      const y = (cmd.row + 0.5) * CELL;
      state.mechas.push({
        id: uid++, level: 0, x, y,
        anchorCol: cmd.col, anchorRow: cmd.row,
        cooldown: 0, missileT: 2, moveCdUntil: 0,
        aimX: x, aimY: y - 60,
        lastFireAt: -999, walkT: 0,
        kills: 0, invested: cost,
        owner: player,
      });
      addExplosion(x, y, MECHA.color, 18, 140);
      addRing(x, y, MECHA.color, 10, 60, 0.5);
      addFloater(x, y - 34, MECHA.name, MECHA.color);
      notify();
      return true;
    }

    if (cmd.type === 'MOVE_MECHA') {
      const m = state.mechas.find((mm) => mm.id === cmd.id);
      if (!m) return false;
      // 协作：只能操作自己的机甲
      if (state.coop && m.owner !== player) return false;
      if (state.clock < m.moveCdUntil) return false; // 转移冷却中
      if (!map.isBuildable(cmd.col, cmd.row)) return false;
      if (state.towers.some((t) => t.col === cmd.col && t.row === cmd.row)) return false;
      if (state.mechas.some((mm) => mm.id !== m.id && mm.anchorCol === cmd.col && mm.anchorRow === cmd.row)) return false;
      m.anchorCol = cmd.col;
      m.anchorRow = cmd.row;
      m.moveCdUntil = state.clock + MECHA.moveCooldown;
      const x = (cmd.col + 0.5) * CELL;
      const y = (cmd.row + 0.5) * CELL;
      addRing(x, y, MECHA.color, 8, 46, 0.4);
      notify();
      return true;
    }

    if (cmd.type === 'UPGRADE_MECHA') {
      const m = state.mechas.find((mm) => mm.id === cmd.id);
      if (!m || m.level >= 2) return false;
      // 协作：只能操作自己的机甲
      if (state.coop && m.owner !== player) return false;
      const cost = MECHA.levels[m.level + 1].cost;
      if (goldOf(player) < cost) return false;
      setGold(player, goldOf(player) - cost);
      m.level += 1;
      m.invested += cost;
      addExplosion(m.x, m.y, MECHA.color, 14, 110);
      addFloater(m.x, m.y - 34, 'LEVEL UP', '#3DF08C');
      notify();
      return true;
    }

    if (cmd.type === 'SELL') {
      const i = state.towers.findIndex((tw) => tw.id === cmd.id);
      if (i < 0) return false;
      const t = state.towers[i];
      // 协作：只能操作自己的塔
      if (state.coop && t.owner !== player) return false;
      const refund = Math.floor(t.invested * SELL_RATE);
      addGold(player, refund);
      addFloater(t.cx, t.cy - 20, `+${refund}`, '#FFC94D');
      addExplosion(t.cx, t.cy, '#7C8DB0', 8, 80);
      state.towers.splice(i, 1);
      notify();
      return true;
    }
    return false;
  }

  /** 单人入口：恒以 player 0 执行，行为与联机改造前完全一致 */
  function dispatch(cmd: Command): boolean {
    return dispatchAs(0, cmd);
  }

  function serializeNet(): NetGameState {
    // 剔除粒子（量大，客机由击杀 diff 兜底）+ 客机不读的 spawnQueue/events 省带宽（事件由联机层在快照外层附带）
    const { particles, spawnQueue, events, ...rest } = state;
    return rest;
  }

  return {
    state,
    difficulty,
    map,
    level,
    tick,
    dispatch,
    dispatchAs,
    serializeNet,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    drainEvents() {
      const ev = state.events.slice();
      state.events.length = 0;
      return ev;
    },
  };
}
