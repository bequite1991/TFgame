// 游戏引擎 —— 固定步长逻辑，无 DOM/React 依赖，可整体移植
import {
  buildLevelMap, CELL, DIFFICULTIES, ENEMIES, PREP_TIME, SELL_RATE, TOWERS,
} from './config';
import { getLevel } from './levels';
import { TECH_LIST } from './config';
import type {
  Command, Difficulty, EnemyState, GameEngine, GameEvent, GameState, SpawnItem, TechId, TowerState,
} from './types';

let uid = 1;

export function createEngine(difficulty: Difficulty, levelId: number = 1): GameEngine {
  const diff = DIFFICULTIES[difficulty];
  const level = getLevel(levelId);
  const map = buildLevelMap(level.paths);
  const lowSpec =
    typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 4;
  const particleScale = lowSpec ? 0.5 : 1;

  const state: GameState = {
    phase: 'prep',
    clock: 0,
    timeSec: 0,
    gold: diff.gold,
    lives: diff.lives,
    maxLives: diff.lives,
    wave: 1,
    totalWaves: level.waves.length,
    prepT: PREP_TIME,
    paused: false,
    speed: 1,
    enemies: [],
    towers: [],
    projectiles: [],
    beams: [],
    particles: [],
    rings: [],
    floaters: [],
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

  const techCount = (id: TechId) => state.techs.reduce((n, t) => n + (t === id ? 1 : 0), 0);
  const dmgMul = () => 1 + 0.15 * techCount('dmg');
  const rateMul = () => 1 + 0.12 * techCount('rate');
  const rangeMul = () => 1 + 0.1 * techCount('range');
  const goldMul = () => 1 + 0.25 * techCount('gold');
  const splashMul = () => 1 + 0.2 * techCount('splash');
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

  function addFloater(x: number, y: number, text: string, color: string) {
    state.floaters.push({ id: uid++, x, y, text, color, ttl: 0.9, maxTtl: 0.9 });
  }

  function addExplosion(x: number, y: number, color: string, count: number, power = 120) {
    const n = Math.max(4, Math.round(count * particleScale));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = power * (0.4 + Math.random() * 0.8);
      const ttl = 0.4 + Math.random() * 0.3;
      state.particles.push({
        id: uid++, x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        ttl, maxTtl: ttl, color,
        size: 2 + Math.random() * 3,
      });
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

  function scaledHp(type: EnemyState['type'], wave: number, override?: number): number {
    if (override !== undefined) return Math.round(override * diff.hpMul);
    return Math.round(ENEMIES[type].hp * (1 + 0.12 * (wave - 1)) * diff.hpMul);
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
      speed: def.speed * diff.speedMul,
      reward: item.rewardOverride ?? def.reward,
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
    };
    e.maxHp = scaledHp(item.type, state.wave, item.hpOverride);
    e.hp = e.maxHp;
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
    let rr = 0; // 未指定路径的组在所有路径间轮转（确定性）
    const pools = def.groups.map((g) => {
      const base = rr;
      if (g.path === undefined) rr += g.count;
      return Array.from({ length: g.count }, (_, i): SpawnItem => ({
        type: g.type,
        interval: g.interval,
        path: g.path ?? ((base + i) % pathCount),
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
    return queue;
  }

  // ---------- 伤害与击杀 ----------

  function applyDamage(e: EnemyState, raw: number, source: 'laser' | 'missile' | 'frost' | 'railgun' | 'tesla' | 'plasma', tower?: TowerState) {
    if (e.hp <= 0) return;
    let dmg = raw * dmgMul() * critMul();
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
    if (e.hp <= 0) killEnemy(e, tower);
  }

  function killEnemy(e: EnemyState, tower?: TowerState) {
    e.hp = 0;
    state.kills += 1;
    const earned = Math.max(1, Math.round(e.reward * goldMul()));
    state.gold += earned;
    state.goldEarned += earned;
    if (tower) tower.kills += 1;
    const p = map.posAt(e.path, e.dist);
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
    if (e.type === 'splitter') {
      // 分裂为 2 个爬行者，HP 为当前波爬行者 60%，继承父体路径
      for (let i = 0; i < 2; i++) {
        spawnEnemy(
          { type: 'crawler', interval: 0, path: e.path, hpOverride: Math.round(scaledHp('crawler', state.wave) * 0.6 / diff.hpMul) },
          Math.max(0, e.dist - i * 14),
        );
      }
    }
  }

  // ---------- 塔开火 ----------

  function towerCenter(t: TowerState) {
    return { x: (t.col + 0.5) * CELL, y: (t.row + 0.5) * CELL };
  }

  function inRange(t: TowerState, e: EnemyState): boolean {
    const def = TOWERS[t.type].levels[t.level];
    const c = towerCenter(t);
    const p = map.posAt(e.path, e.dist);
    return e.hp > 0 && Math.hypot(p.x - c.x, p.y - c.y) <= def.range * CELL * rangeMul();
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
    const c = towerCenter(t);
    const p = map.posAt(target.path, target.dist);
    addBeam(c.x, c.y, p.x, p.y, '#22E0FF', 2);
    applyDamage(target, lv.damage, 'laser', t);
    if (t.level === 2) {
      // Lv3 光束贯穿 1 个额外目标（50% 伤害）
      let second: EnemyState | null = null;
      for (const e of state.enemies) {
        if (e === target || e.hp <= 0 || isInvisible(e) || !inRange(t, e)) continue;
        if (!second || e.dist > second.dist) second = e;
      }
      if (second) {
        const p2 = map.posAt(second.path, second.dist);
        addBeam(p.x, p.y, p2.x, p2.y, '#22E0FF88', 1.5);
        applyDamage(second, lv.damage * 0.5, 'laser', t);
      }
    }
  }

  function fireMissile(t: TowerState, target: EnemyState) {
    const def = TOWERS.missile;
    const lv = def.levels[t.level];
    t.lastFireAt = state.clock;
    const c = towerCenter(t);
    const p = map.posAt(target.path, target.dist);
    state.projectiles.push({
      id: uid++, kind: 'missile',
      fromX: c.x, fromY: c.y, x: c.x, y: c.y,
      tx: p.x, ty: p.y, t: 0, dur: 0.35,
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
    const c = towerCenter(t);
    const jumps = def.chain![t.level]; // 主目标之外的连锁数
    const decay = def.chainDecay!;
    const hit = new Set<number>();
    let px = c.x;
    let py = c.y;
    let dmg = lv.damage;
    let cur: EnemyState | null = target;
    while (cur) {
      const p = map.posAt(cur.path, cur.dist);
      addLightning(px, py, p.x, p.y);
      applyDamage(cur, dmg, 'tesla', t);
      hit.add(cur.id);
      px = p.x;
      py = p.y;
      dmg *= decay;
      if (hit.size > jumps) break;
      // 距上一个命中目标 2.5 格内最近的未命中敌人（隐身不可被闪电锁定）
      let next: EnemyState | null = null;
      let best = Infinity;
      for (const e of state.enemies) {
        if (e.hp <= 0 || hit.has(e.id) || isInvisible(e)) continue;
        const ep = map.posAt(e.path, e.dist);
        const d = Math.hypot(ep.x - px, ep.y - py);
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
    const c = towerCenter(t);
    const p = map.posAt(target.path, target.dist);
    state.projectiles.push({
      id: uid++, kind: 'plasma',
      fromX: c.x, fromY: c.y, x: c.x, y: c.y,
      tx: p.x, ty: p.y, t: 0, dur: 0.45,
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
    const c = towerCenter(t);
    const p = map.posAt(target.path, target.dist);
    addBeam(c.x, c.y, p.x, p.y, '#3DF08C66', 1.5, 0.15);
    const pct = def.slowPct![t.level];
    const dur = def.slowDur![t.level];
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const ep = map.posAt(e.path, e.dist);
      if (Math.hypot(ep.x - p.x, ep.y - p.y) > CELL) continue; // 1 格脉冲
      let factor = pct + 0.06 * techCount('slow');
      if (factor > 0.8) factor = 0.8;
      if (e.isBoss) factor *= 0.5; // BOSS 减速减半
      if (e.type === 'speeder') factor = Math.min(0.8, factor * 1.2);
      e.slowPct = Math.max(e.slowPct, factor);
      e.slowUntil = state.clock + dur;
      applyDamage(e, lv.damage, 'frost', t);
    }
    // 冰蓝脉冲环粒子
    addExplosion(p.x, p.y, '#3DF08C', 8, 70);
  }

  function updateRailgun(t: TowerState, dt: number) {
    const def = TOWERS.railgun;
    const lv = def.levels[t.level];
    const c = towerCenter(t);
    if (t.charging) {
      const target = pickTarget(t, true);
      if (target) {
        const p = map.posAt(target.path, target.dist);
        t.aimX = p.x;
        t.aimY = p.y;
      }
      t.chargeT -= dt;
      if (t.chargeT <= 0) {
        t.charging = false;
        t.cooldown = 1 / lv.rate / rateMul();
        t.lastFireAt = state.clock;
        // 贯穿直线：从塔心沿瞄准方向 range 内所有敌人（含隐身）
        const dx = t.aimX - c.x;
        const dy = t.aimY - c.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const reach = lv.range * CELL * rangeMul();
        const ex = c.x + ux * reach;
        const ey = c.y + uy * reach;
        addBeam(c.x, c.y, ex, ey, '#8B5CF6', 6, 0.18);
        state.shake = Math.max(state.shake, 0.4);
        pushEvent({ type: 'sfx', name: 'railgun' });
        const hits = state.enemies
          .filter((e) => {
            if (e.hp <= 0) return false;
            const p = map.posAt(e.path, e.dist);
            const proj = (p.x - c.x) * ux + (p.y - c.y) * uy;
            if (proj < 0 || proj > reach) return false;
            const perp = Math.abs((p.x - c.x) * uy - (p.y - c.y) * ux);
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
    const p = map.posAt(target.path, target.dist);
    t.aimX = p.x;
    t.aimY = p.y;
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
    t.cooldown = 1 / lv.rate / rateMul();
    const p = map.posAt(target.path, target.dist);
    t.aimX = p.x;
    t.aimY = p.y;
    if (t.type === 'laser') fireLaser(t, target);
    else if (t.type === 'missile') fireMissile(t, target);
    else if (t.type === 'tesla') fireTesla(t, target);
    else if (t.type === 'plasma') firePlasma(t, target);
    else fireFrost(t, target);
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
    state.gold += def.bonus;
    state.goldEarned += def.bonus;
    addFloater(270, 120, `波次奖励 +${def.bonus}`, '#FFC94D');
    pushEvent({ type: 'waveClear', wave: state.wave, bonus: def.bonus });
    if (state.wave >= state.totalWaves) {
      state.phase = 'won';
      state.techChoices = null;
      pushEvent({ type: 'gameOver', won: true });
    } else {
      state.wave += 1;
      state.phase = 'tech'; // 波间科技三选一：选定后进入准备期
      state.techChoices = rollTechChoices();
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

      if (state.lives <= 0) {
        state.lives = 0;
        state.phase = 'lost';
        addExplosion(270, 930, '#FF5A5A', 30, 260);
        pushEvent({ type: 'gameOver', won: false });
      }

      // 塔
      for (const t of state.towers) updateTower(t, dt);
      state.enemies = state.enemies.filter((e) => e.hp > 0);

      // 导弹 / 等离子弹
      for (const pr of state.projectiles) {
        pr.t += dt / pr.dur;
        if (pr.t >= 1) {
          pr.x = pr.tx;
          pr.y = pr.ty;
          const tower = state.towers.find((tw) => tw.id === pr.towerId);
          if (pr.kind === 'plasma') {
            addExplosion(pr.tx, pr.ty, '#FF6B3D', 14, 130);
            addRing(pr.tx, pr.ty, '#FF6B3D', 8, Math.max(30, pr.splash * CELL * 0.9), 0.5);
            // 落点瞬时小溅射
            for (const e of state.enemies) {
              if (e.hp <= 0) continue;
              const p = map.posAt(e.path, e.dist);
              if (Math.hypot(p.x - pr.tx, p.y - pr.ty) <= pr.splash * CELL) {
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
          } else {
            addExplosion(pr.tx, pr.ty, '#FF9F43', 16, 150);
            addRing(pr.tx, pr.ty, '#FF9F43', 6, Math.max(26, pr.splash * CELL * 0.9), 0.45);
            for (const e of state.enemies) {
              if (e.hp <= 0) continue;
              const p = map.posAt(e.path, e.dist);
              if (Math.hypot(p.x - pr.tx, p.y - pr.ty) <= pr.splash * CELL) {
                if (pr.stun > 0 && !e.isBoss) e.stunUntil = state.clock + pr.stun;
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
            state.particles.push({
              id: uid++,
              x: pr.x + (Math.random() - 0.5) * 4,
              y: pr.y + (Math.random() - 0.5) * 4,
              vx: (Math.random() - 0.5) * 16,
              vy: (Math.random() - 0.5) * 16,
              ttl, maxTtl: ttl,
              color: pr.kind === 'plasma' ? '#FF6B3D' : '#FF9F43',
              size: 1.5 + Math.random() * 1.5,
            });
          }
        }
      }
      state.projectiles = state.projectiles.filter((pr) => pr.t < 1);

      // 灼烧区域 DoT
      for (const z of state.zones) {
        const tower = state.towers.find((tw) => tw.id === z.towerId);
        for (const e of state.enemies) {
          if (e.hp <= 0) continue;
          const p = map.posAt(e.path, e.dist);
          if (Math.hypot(p.x - z.x, p.y - z.y) <= z.r) {
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

    notify();
  }

  // ---------- 命令 ----------

  function dispatch(cmd: Command): boolean {
    if (state.phase === 'tech') {
      // 科技选择期间：只接受 PICK_TECH
      if (cmd.type !== 'PICK_TECH') return false;
      if (!state.techChoices?.includes(cmd.id)) return false;
      state.techs.push(cmd.id);
      state.techChoices = null;
      if (cmd.id === 'supply') {
        state.gold += 200;
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
      if (state.gold < cost) return false;
      state.gold -= cost;
      const c = { x: (cmd.col + 0.5) * CELL, y: (cmd.row + 0.5) * CELL };
      state.towers.push({
        id: uid++, type: cmd.tower, level: 0,
        col: cmd.col, row: cmd.row,
        cooldown: 0, charging: false, chargeT: 0,
        aimX: c.x, aimY: c.y - 60,
        lastFireAt: -999,
        kills: 0, invested: cost,
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
      const cost = TOWERS[t.type].levels[t.level + 1].cost;
      if (state.gold < cost) return false;
      state.gold -= cost;
      t.level += 1;
      t.invested += cost;
      state.maxTowerLevel = Math.max(state.maxTowerLevel, t.level + 1);
      const c = towerCenter(t);
      addExplosion(c.x, c.y, TOWERS[t.type].color, 14, 110);
      addFloater(c.x, c.y - 30, 'LEVEL UP', '#3DF08C');
      notify();
      return true;
    }

    if (cmd.type === 'SELL') {
      const i = state.towers.findIndex((tw) => tw.id === cmd.id);
      if (i < 0) return false;
      const t = state.towers[i];
      const refund = Math.floor(t.invested * SELL_RATE);
      state.gold += refund;
      const c = towerCenter(t);
      addFloater(c.x, c.y - 20, `+${refund}`, '#FFC94D');
      addExplosion(c.x, c.y, '#7C8DB0', 8, 80);
      state.towers.splice(i, 1);
      notify();
      return true;
    }
    return false;
  }

  return {
    state,
    difficulty,
    map,
    level,
    tick,
    dispatch,
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
