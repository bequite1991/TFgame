// 客机幽灵引擎（C 档 · 主机权威；design/coop-online.md §1）
// 实现 GameEngine 接口：state = 主机快照整体覆盖 + 敌人位置两快照间线性插值；
// dispatch 转为网络指令（乐观返回 true，权威判定在主机）；map/level 用本地 levels.ts 同款构建。
// 渲染层（render.ts + 三皮肤 battle 绘制）与塔栏/升级 UI 因此零改动。
import { CELL } from './game/config';
import { createEngine } from './game/engine';
import type { Command, Difficulty, GameEngine, GameEvent, GameState, NetGameState } from './game/types';

/** 快照广播间隔（与主机端 setInterval 一致），插值时长基准 */
export const SNAP_DT = 0.2;

export interface GhostEngine extends GameEngine {
  /** 应用主机快照：整体覆盖玩法状态；事件入队待 drainEvents 取走 */
  applySnap(net: NetGameState, events: GameEvent[]): void;
}

export function createGhostEngine(
  difficulty: Difficulty,
  levelId: number,
  sendCmd: (cmd: Command) => void,
): GhostEngine {
  // 借一个真实协作引擎拿到同形初始 state / map / level（永不 tick，首个快照到达即整体覆盖）
  const base = createEngine(difficulty, levelId, { coop: true });
  const state: GameState = base.state;

  /** 快照外层事件缓冲（waveStart/waveClear/leak/bossDown/gameOver 等） */
  const evBuf: GameEvent[] = [];
  /** 敌人位置插值：id → {from, to}（from 为上帧渲染位置，to 为快照目标） */
  const lerp = new Map<number, { from: number; to: number }>();
  let lerpT = SNAP_DT; // 无快照期间视为插值完成

  function applySnap(net: NetGameState, events: GameEvent[]) {
    const prev = new Map<number, number>();
    for (const e of state.enemies) prev.set(e.id, e.dist);
    // 装饰数组保持本地空数组（快照本就不含；显式保留引用防意外覆盖）
    const { particles, beams, rings, floaters } = state;
    Object.assign(state, net);
    state.particles = particles;
    state.beams = beams;
    state.rings = rings;
    state.floaters = floaters;
    // 客机视角重映射：UI 统一读 state.gold → 显示自己的金币池（golds[1]）
    if (state.golds) state.gold = state.golds[1];
    lerp.clear();
    for (const e of state.enemies) {
      const p = prev.get(e.id);
      // 新出现的敌人：按速度回推一个快照间隔作为插值起点，避免从零距离闪现
      lerp.set(e.id, { from: p ?? Math.max(0, e.dist - e.speed * CELL * SNAP_DT), to: e.dist });
    }
    lerpT = 0;
    evBuf.push(...events);
  }

  function tick(dt: number) {
    // 只推进敌人位置插值，不跑任何模拟（模拟在主机）
    if (lerpT >= SNAP_DT) return;
    lerpT = Math.min(SNAP_DT, lerpT + dt);
    const f = lerpT / SNAP_DT;
    for (const e of state.enemies) {
      const seg = lerp.get(e.id);
      if (seg) e.dist = seg.from + (seg.to - seg.from) * f;
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
      const { particles, beams, rings, floaters, ...rest } = state;
      return rest;
    },
    subscribe() { return () => {}; },
    drainEvents() { return evBuf.splice(0); },
  };
}
