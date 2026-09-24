// 桌面侧栏（≥1024px）—— 左：当前波敌情速查 + 克制提示；右：本关波次列表
import { DIFFICULTIES, ENEMIES } from '../config';
import type { WaveDef } from '../config';
import type { Difficulty, EnemyType, GameState } from '../types';

function SidebarTitle({ en, zh }: { en: string; zh: string }) {
  return (
    <div>
      <h3 className="font-orbitron text-xs font-bold uppercase tracking-[0.2em] text-primary">
        {en}
      </h3>
      <p className="mt-0.5 text-xs text-text-dim">{zh}</p>
      <div className="mt-2 h-[2px] w-12 bg-gradient-to-r from-primary to-transparent" />
    </div>
  );
}

export function EnemyIntel({ state, waves, difficulty }: { state: GameState; waves: WaveDef[]; difficulty: Difficulty }) {
  const diff = DIFFICULTIES[difficulty];
  const wave = waves[Math.min(state.wave, state.totalWaves) - 1];
  const types: { type: EnemyType; hpOverride?: number }[] = [];
  for (const g of wave.groups) {
    if (!types.some((t) => t.type === g.type))
      types.push({ type: g.type, hpOverride: g.hpOverride });
  }

  return (
    <div className="space-y-3">
      <SidebarTitle en="Enemy Intel" zh={`第 ${wave.wave} 波 · 敌情速查`} />
      {types.map(({ type, hpOverride }) => {
        const def = ENEMIES[type];
        const hp =
          hpOverride !== undefined
            ? Math.round(hpOverride * diff.hpMul)
            : Math.round(def.hp * (1 + 0.12 * (wave.wave - 1)) * diff.hpMul);
        return (
          <div
            key={type}
            className={`clip-panel border bg-bg-panel/70 p-3 ${
              type === 'boss' ? 'border-accent/50' : 'border-primary/20'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <img
                src={`/enemy-${type}.png`}
                alt={def.name}
                className="h-11 w-11 object-contain"
                draggable={false}
              />
              <div>
                <div className="text-sm font-bold text-text">{def.name}</div>
                <div className="font-orbitron text-[10px] tracking-widest text-text-dim">
                  {def.nameEn}
                </div>
              </div>
              <div className="ml-auto text-right font-orbitron text-[10px] text-text-dim">
                <div>
                  HP <span className="text-hp">{hp}</span>
                </div>
                <div>
                  速度 <span className="text-text">{def.speed}</span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-text-dim">{def.desc}</p>
            <p className="mt-1.5 text-xs text-primary">克制：{def.weakness}</p>
          </div>
        );
      })}
    </div>
  );
}

export function WaveList({ state, waves }: { state: GameState; waves: WaveDef[] }) {
  const finished = state.phase === 'won';
  return (
    <div>
      <SidebarTitle en="Waves" zh={`波次列表 · 共 ${state.totalWaves} 波`} />
      <div className="mt-2 space-y-1">
        {waves.map((w) => {
          const done = finished || w.wave < state.wave;
          const current = !finished && w.wave === state.wave;
          return (
            <div
              key={w.wave}
              className={`flex items-center gap-2 border px-2 py-1.5 text-xs ${
                current
                  ? w.isBoss
                    ? 'border-accent/60 bg-accent/15'
                    : 'border-primary/60 bg-primary/10'
                  : 'border-transparent'
              } ${w.isBoss ? 'text-accent' : done ? 'text-text-dim' : 'text-text'}`}
            >
              <span className="w-6 font-orbitron font-bold">{w.wave}</span>
              <span className="flex flex-1 items-center gap-1">
                {w.groups.slice(0, 4).map((g, i) => (
                  <img
                    key={i}
                    src={`/enemy-${g.type}.png`}
                    alt=""
                    className="h-4 w-4 object-contain"
                    draggable={false}
                  />
                ))}
              </span>
              {w.isBoss && <span className="font-orbitron text-[10px] font-bold">⚠ BOSS</span>}
              {done && <span className="font-bold text-green">✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
