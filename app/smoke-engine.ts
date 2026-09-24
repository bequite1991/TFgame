// 引擎冒烟测试：tsx 直接跑纯 TS 引擎，逐关模拟整局游戏
import { createEngine } from './src/game/engine';
import { CELL, COLS, ROWS, TOWERS } from './src/game/config';
import { LEVELS } from './src/game/levels';

const dt = 1 / 60;

for (const level of LEVELS) {
  const engine = createEngine('normal', level.id);
  const s = engine.state;
  const { map } = engine;

  // 波次表完整性
  if (level.waves.length !== s.totalWaves) throw new Error(`level ${level.id}: wave table incomplete`);
  for (const w of level.waves) {
    if (w.groups.length === 0) throw new Error(`level ${level.id} wave ${w.wave}: empty groups`);
  }

  // 路径合法性：逐路径校验入屏/出屏/横平竖直/不自交；跨路径只允许共享后缀（合流），禁止交叉穿越
  const cellSeqs: string[][] = [];
  level.paths.forEach((pts, pi) => {
    const tag = `level ${level.id} path ${pi}`;
    const [fc, fr] = pts[0];
    if (fc !== -1 && fc !== COLS && fr !== -1) throw new Error(`${tag}: must enter from screen edge`);
    if (pts[pts.length - 1][1] !== ROWS) throw new Error(`${tag}: must exit bottom`);
    const seq: string[] = [`${fc},${fr}`];
    for (let i = 0; i < pts.length - 1; i++) {
      let [c, r] = pts[i];
      const [ec, er] = pts[i + 1];
      if (c !== ec && r !== er) throw new Error(`${tag}: diagonal segment`);
      const dc = Math.sign(ec - c);
      const dr = Math.sign(er - r);
      while (c !== ec || r !== er) {
        c += dc;
        r += dr;
        seq.push(`${c},${r}`);
      }
    }
    const seen = new Set<string>();
    for (const k of seq) {
      if (seen.has(k)) throw new Error(`${tag}: self-crossing at ${k}`);
      seen.add(k);
    }
    cellSeqs.push(seq);
  });
  // 两两路径：一旦相遇必须完全同路到底（T 型汇入 OK，X 型交叉/分叉禁止）
  for (let a = 0; a < cellSeqs.length; a++) {
    for (let b = a + 1; b < cellSeqs.length; b++) {
      const setB = new Set(cellSeqs[b]);
      const ai = cellSeqs[a].findIndex((k) => setB.has(k));
      if (ai === -1) continue; // 互不接触
      const bi = cellSeqs[b].indexOf(cellSeqs[a][ai]);
      const tailA = cellSeqs[a].slice(ai);
      const tailB = cellSeqs[b].slice(bi);
      const sharedSuffix = tailA.length === tailB.length && tailA.every((k, i) => k === tailB[i]);
      if (!sharedSuffix) {
        throw new Error(`level ${level.id}: paths ${a}/${b} cross or diverge at ${cellSeqs[a][ai]}`);
      }
    }
  }
  // 波次 group 的路径索引合法
  for (const w of level.waves) {
    for (const g of w.groups) {
      if (g.path !== undefined && (g.path < 0 || g.path >= level.paths.length)) {
        throw new Error(`level ${level.id} wave ${w.wave}: group path ${g.path} out of range`);
      }
    }
  }
  // 第 1 关基地区推导回归：必须与旧版手写 baseCells 一致
  if (level.id === 1) {
    const want = ['3,15', '4,15', '5,15'];
    if (want.some((k) => !map.baseCells.has(k)) || map.baseCells.size !== want.length) {
      throw new Error(`level 1: derived baseCells mismatch: ${[...map.baseCells].join(' ')}`);
    }
  }

  // 路径格上建造应被拒绝
  const pathCell = [...map.pathCells][0].split(',').map(Number);
  if (engine.dispatch({ type: 'BUILD', col: pathCell[0], row: pathCell[1], tower: 'laser' })) {
    throw new Error(`level ${level.id}: path cell build should fail`);
  }

  // 在路径旁格布阵（贴边火力位）
  const nearPath: [number, number][] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!map.isBuildable(col, row)) continue;
      const adjacent = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) =>
        map.pathCells.has(`${col + dc},${row + dr}`),
      );
      if (adjacent) nearPath.push([col, row]);
    }
  }
  let built = 0;
  const towerOrder = ['missile', 'frost', 'tesla', 'laser', 'plasma', 'railgun', 'laser', 'missile', 'tesla', 'plasma'] as const;
  outer: for (let row = 3; row < ROWS - 2; row++) {
    for (let col = 0; col < COLS; col++) {
      if (built >= towerOrder.length) break outer;
      if (engine.dispatch({ type: 'BUILD', col, row, tower: towerOrder[built] })) built++;
    }
  }
  console.log(`level ${level.id} "${level.name}": built ${built} towers, gold left ${s.gold}`);
  if (built < 3) throw new Error(`level ${level.id}: too few buildable cells`);

  let steps = 0;
  let wavesSeen = 0;
  let commsSeen = 0;
  let nearIdx = 0;
  const seenPaths = new Set<number>(); // 出怪实际覆盖的路径
  const wavePaths = new Map<number, Set<number>>(); // 每波实际出怪路径（验证轮转）
  while (s.phase !== 'won' && s.phase !== 'lost' && steps < 60 * 60 * 40) {
    engine.tick(dt);
    steps++;
    for (const e of s.enemies) {
      seenPaths.add(e.path);
      if (!wavePaths.has(s.wave)) wavePaths.set(s.wave, new Set());
      wavePaths.get(s.wave)!.add(e.path);
    }
    for (const ev of engine.drainEvents()) {
      if (ev.type === 'comm') commsSeen++;
    }
    if (s.phase === 'prep') {
      engine.dispatch({ type: 'SKIP_PREP' });
      wavesSeen = Math.max(wavesSeen, s.wave);
      const cycle = ['missile', 'railgun', 'frost', 'tesla', 'plasma', 'laser'] as const;
      while (s.gold >= TOWERS.railgun.levels[0].cost && nearIdx < nearPath.length) {
        const [col, row] = nearPath[nearIdx++];
        if (s.towers.some((t) => t.col === col && t.row === row)) continue;
        if (!engine.dispatch({ type: 'BUILD', col, row, tower: cycle[built % cycle.length] })) continue;
        built++;
      }
      for (const t of s.towers) engine.dispatch({ type: 'UPGRADE', id: t.id });
    }
  }
  console.log(
    `  phase: ${s.phase} | wave: ${s.wave}/${s.totalWaves} | kills: ${s.kills} | leaked: ${s.leaked} | lives: ${s.lives} | comms: ${commsSeen} | boss1Killed: ${s.boss1Killed} | paths: ${map.paths.map((p) => Math.round(p.length / CELL)).join('/')} 格 | 出怪路径: ${[...seenPaths].sort().join(',')}`,
  );
  if (wavesSeen < 1) throw new Error(`level ${level.id}: no wave started`);
  if (level.waves.some((w) => w.comm) && commsSeen === 0) throw new Error(`level ${level.id}: no comm events`);
  if (s.phase === 'won' && level.waves.some((w) => w.isBoss) && !s.boss1Killed) {
    throw new Error(`level ${level.id}: boss wave cleared but boss1Killed not set`);
  }
  // 多路径关卡：出怪必须覆盖所有路径；全组未指定路径的波次必须在该波内轮转覆盖所有路径
  if (level.paths.length > 1) {
    if (seenPaths.size !== level.paths.length) {
      throw new Error(`level ${level.id}: spawn did not cover all paths (${[...seenPaths].join(',')})`);
    }
    for (const w of level.waves) {
      if (w.wave > wavesSeen) continue; // 未打到的波不校验
      if (w.groups.every((g) => g.path === undefined)) {
        const seen = wavePaths.get(w.wave);
        if (!seen || seen.size !== level.paths.length) {
          throw new Error(`level ${level.id} wave ${w.wave}: round-robin did not cover all paths`);
        }
      }
    }
  }
}
console.log('SMOKE OK');

// 新塔机制验证：特斯拉连锁闪电 & 等离子灼烧区
{
  const engine = createEngine('easy', 1);
  const s = engine.state;
  const { map } = engine;
  const spots: [number, number][] = [];
  for (let row = 0; row < ROWS && spots.length < 2; row++) {
    for (let col = 0; col < COLS && spots.length < 2; col++) {
      if (!map.isBuildable(col, row)) continue;
      const adjacent = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) =>
        map.pathCells.has(`${col + dc},${row + dr}`),
      );
      if (adjacent) spots.push([col, row]);
    }
  }
  if (!engine.dispatch({ type: 'BUILD', col: spots[0][0], row: spots[0][1], tower: 'tesla' })) {
    throw new Error('tesla build failed');
  }
  if (!engine.dispatch({ type: 'BUILD', col: spots[1][0], row: spots[1][1], tower: 'plasma' })) {
    throw new Error('plasma build failed');
  }
  let sawTeslaBeam = false;
  let sawPlasmaShot = false;
  let sawZone = false;
  let steps = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && steps < 60 * 60 * 5) {
    engine.tick(dt);
    steps++;
    if (s.phase === 'prep') engine.dispatch({ type: 'SKIP_PREP' });
    if (s.beams.some((b) => b.color === '#FFE93D')) sawTeslaBeam = true;
    if (s.projectiles.some((p) => p.kind === 'plasma')) sawPlasmaShot = true;
    if (s.zones.length > 0) sawZone = true;
    if (sawTeslaBeam && sawZone && s.wave >= 2) break;
  }
  console.log(
    `tesla/plasma: teslaBeam=${sawTeslaBeam} plasmaShot=${sawPlasmaShot} zone=${sawZone} kills=${s.kills} wave=${s.wave}`,
  );
  if (!sawTeslaBeam) throw new Error('tesla never fired chain lightning');
  if (!sawPlasmaShot) throw new Error('plasma never fired');
  if (!sawZone) throw new Error('plasma never created burn zone');
  if (s.kills === 0) throw new Error('new towers got no kills');
  console.log('NEW TOWERS OK');
}
