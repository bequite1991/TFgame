// 客机幽灵引擎（C 档 · 主机权威；design/coop-online.md §1）
// 实现 GameEngine 接口：state = 主机快照整体覆盖 + 本地时钟连续推进 + 敌人/炮口插值 + 弹丸外推；
// dispatch 转为网络指令（乐观返回 true，权威判定在主机）；map/level 用本地 levels.ts 同款构建。
// 渲染层（render.ts + 三皮肤 battle 绘制）与塔栏/升级 UI 因此零改动。
import { CELL } from './game/config';
import { createEngine } from './game/engine';
import type { Command, Difficulty, GameEngine, GameEvent, GameState, NetGameState } from './game/types';

/** 快照广播间隔（与主机端 setInterval 一致），插值时长基准 */
export const SNAP_DT = 0.2;
/** 插值窗口：比广播间隔宽 25% 作抖动缓冲，快照略迟到时敌人不会"停顿-瞬接" */
const LERP_DT = SNAP_DT * 1.25;
/** 快照迟到时的位置外推上限（秒）：超过则认为连接异常，停在原地等快照/重连 UI */
const EXTRAP_MAX = 1.0;
/** 时钟硬同步阈值（秒）：误差小于它按比例软收敛（避免动画跳变），大于它直接跳变（暂停/重连场景） */
const CLOCK_HARD_SYNC = 0.6;

export interface GhostEngine extends GameEngine {
  /** 应用主机快照：整体覆盖玩法状态；事件入队待 drainEvents 取走 */
  applySnap(net: NetGameState, events: GameEvent[]): void;
}

export function createGhostEngine(
  difficulty: Difficulty,
  levelId: number,
  sendCmd: (cmd: Command) => void,
): GhostEngine {
  // 借一个真实协作引擎拿到同形初始 state / map / level（永不跑模拟，首个快照到达即整体覆盖）
  const base = createEngine(difficulty, levelId, { coop: true });
  const state: GameState = base.state;

  /** 快照外层事件缓冲（waveStart/waveClear/leak/bossDown/gameOver 等） */
  const evBuf: GameEvent[] = [];
  /** 敌人位置插值：id → {from, to}（from 为快照切换瞬间的渲染位置，to 为最新快照目标） */
  const lerp = new Map<number, { from: number; to: number }>();
  /** 塔炮口朝向插值：id → 快照切换瞬间朝向 → 最新快照朝向 */
  const aimLerp = new Map<number, { fx: number; fy: number; tx: number; ty: number }>();
  /** 机甲位置插值：id → 快照切换瞬间位置 → 最新快照位置 */
  const mechaLerp = new Map<number, { fx: number; fy: number; tx: number; ty: number }>();
  let lerpT = LERP_DT; // 距上一快照的本地秒数；初始视为插值已完成

  function applySnap(net: NetGameState, events: GameEvent[]) {
    // 快照覆盖前取渲染态作插值起点（含外推中的位置），保证切换连续
    const prevDist = new Map<number, number>();
    for (const e of state.enemies) prevDist.set(e.id, e.dist);
    const prevAim = new Map<number, { x: number; y: number }>();
    for (const t of state.towers) prevAim.set(t.id, { x: t.aimX, y: t.aimY });
    const prevMecha = new Map<number, { x: number; y: number }>();
    for (const m of state.mechas) prevMecha.set(m.id, { x: m.x, y: m.y });
    const localClock = state.clock;
    // 装饰数组保持本地空数组（快照本就不含；显式保留引用防意外覆盖）
    const { particles, beams, rings, floaters } = state;
    Object.assign(state, net);
    state.particles = particles;
    state.beams = beams;
    state.rings = rings;
    state.floaters = floaters;
    // 客机视角重映射：UI 统一读 state.gold → 显示自己的金币池（golds[1]）
    if (state.golds) state.gold = state.golds[1];
    // 时钟纠偏：本地 tick 已按墙钟连续推进（动画时间源），此处只消积累误差——
    // 小误差（≈网络延迟）软收敛避免动画回跳；大误差（暂停/倍速切换边界/重连）硬同步
    const clockErr = net.clock - localClock;
    if (Math.abs(clockErr) > CLOCK_HARD_SYNC) {
      state.clock = net.clock;
      state.timeSec = net.timeSec;
    } else {
      state.clock = localClock + clockErr * 0.1;
      state.timeSec += clockErr * 0.1;
    }
    lerp.clear();
    for (const e of state.enemies) {
      const p = prevDist.get(e.id);
      // 新出现的敌人：按速度回推一个插值窗口作为起点，避免从出口方向闪现
      lerp.set(e.id, { from: p ?? Math.max(0, e.dist - e.speed * CELL * LERP_DT), to: e.dist });
    }
    aimLerp.clear();
    for (const t of state.towers) {
      const p = prevAim.get(t.id);
      aimLerp.set(t.id, { fx: p?.x ?? t.aimX, fy: p?.y ?? t.aimY, tx: t.aimX, ty: t.aimY });
    }
    mechaLerp.clear();
    for (const m of state.mechas) {
      const p = prevMecha.get(m.id);
      mechaLerp.set(m.id, { fx: p?.x ?? m.x, fy: p?.y ?? m.y, tx: m.x, ty: m.y });
    }
    // 立刻把位置/朝向回置到插值起点（快照切换瞬间的渲染值）：
    // applySnap 由 WS 回调触发、渲染在下一帧 tick 后，不回置会有一帧跳到快照原始值的视觉断层
    for (const e of state.enemies) {
      const seg = lerp.get(e.id);
      if (seg) e.dist = seg.from;
    }
    for (const t of state.towers) {
      const seg = aimLerp.get(t.id);
      if (seg) { t.aimX = seg.fx; t.aimY = seg.fy; }
    }
    for (const m of state.mechas) {
      const seg = mechaLerp.get(m.id);
      if (seg) { m.x = seg.fx; m.y = seg.fy; }
    }
    lerpT = 0;
    evBuf.push(...events);
  }

  function tick(dt: number) {
    // 不跑任何玩法模拟（权威在主机），只做表现层推进：
    // 1) 引擎时钟随墙钟连续走（全场景动画/特效的时间源，快照只做纠偏）
    // 2) 敌人位置两快照间插值，快照迟到按速度外推（尊重眩晕/减速快照状态）
    // 3) 塔炮口朝向插值、弹丸按主机同款弧线外推
    const flowing = !state.paused
      && state.phase !== 'tech' && state.phase !== 'won' && state.phase !== 'lost';
    if (flowing) {
      const dtSim = dt * state.speed;
      state.clock += dtSim;
      state.timeSec += dtSim;
      for (const pr of state.projectiles) {
        pr.t = Math.min(1, pr.t + dtSim / pr.dur);
        const arcH = pr.kind === 'plasma' ? 52 : 40;
        pr.x = pr.fromX + (pr.tx - pr.fromX) * pr.t;
        pr.y = pr.fromY + (pr.ty - pr.fromY) * pr.t - Math.sin(pr.t * Math.PI) * arcH;
      }
    }
    lerpT += dt;
    const f = Math.min(1, lerpT / LERP_DT);
    for (const e of state.enemies) {
      const seg = lerp.get(e.id);
      if (!seg) continue;
      if (lerpT <= LERP_DT || !flowing) {
        e.dist = seg.from + (seg.to - seg.from) * f;
      } else {
        // 快照迟到：从目标位置按当前速度外推（眩晕/减速按快照状态取 0 或折减），封顶 EXTRAP_MAX
        const stunned = state.clock < e.stunUntil;
        const slowed = state.clock < e.slowUntil;
        const factor = stunned ? 0 : slowed ? 1 - e.slowPct : 1;
        const over = Math.min(lerpT - LERP_DT, EXTRAP_MAX);
        e.dist = seg.to + e.speed * factor * CELL * over;
      }
    }
    if (lerpT <= LERP_DT) {
      for (const t of state.towers) {
        const seg = aimLerp.get(t.id);
        if (!seg) continue;
        t.aimX = seg.fx + (seg.tx - seg.fx) * f;
        t.aimY = seg.fy + (seg.ty - seg.fy) * f;
      }
      for (const m of state.mechas) {
        const seg = mechaLerp.get(m.id);
        if (!seg) continue;
        m.x = seg.fx + (seg.tx - seg.fx) * f;
        m.y = seg.fy + (seg.ty - seg.fy) * f;
      }
    }
  }

  return {
    state,
    difficulty,
    map: base.map,
    level: base.level,
    tick,
    applySnap,
    // 指令上网（乐观返回 true；越权/非法指令由主机引擎拒绝，下个快照自然纠偏）
    dispatch(cmd) { sendCmd(cmd); return true; },
    dispatchAs(_player, cmd) { sendCmd(cmd); return true; },
    serializeNet() {
      const { particles, beams, rings, floaters, spawnQueue, events, ...rest } = state;
      return rest;
    },
    subscribe() { return () => {}; },
    drainEvents() { return evBuf.splice(0); },
  };
}
