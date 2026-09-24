// 波次预告条 —— prep 阶段从 HUD 下缘滑出：敌人构成 + 倒计时 + 立即开战
import { AnimatePresence, motion } from 'framer-motion';
import { ENEMIES } from '../config';
import type { WaveDef } from '../config';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  waves: WaveDef[];
  pathCount: number; // 本关路径数（>1 时展示多路徽标与入口编号）
  onStart: () => void;
}

export default function WavePreviewBar({ state, waves, pathCount, onStart }: Props) {
  const show = state.phase === 'prep';
  const wave = waves[Math.min(state.wave, state.totalWaves) - 1];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 48, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={`relative z-10 shrink-0 overflow-hidden border-b ${
            wave.isBoss
              ? 'border-accent/50 bg-accent/15'
              : 'border-primary/15 bg-glass backdrop-blur-md'
          }`}
        >
          <div className="mx-auto flex h-12 max-w-[1280px] items-center gap-2 px-3 sm:gap-3">
            {wave.isBoss ? (
              <motion.span
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                className="shrink-0 font-orbitron text-xs font-bold text-accent"
              >
                ⚠ BOSS 来袭
              </motion.span>
            ) : (
              <span className="shrink-0 font-orbitron text-xs font-bold text-primary-dim">
                下一波
              </span>
            )}
            {pathCount > 1 && (
              <span className="shrink-0 rounded border border-gold/40 bg-gold/10 px-1.5 py-0.5 font-orbitron text-[10px] font-bold text-gold">
                ⚠ 多路进攻
              </span>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
              {wave.groups.map((g, i) => (
                <span key={i} className="flex shrink-0 items-center gap-1">
                  <img
                    src={`/enemy-${g.type}.png`}
                    alt={ENEMIES[g.type].name}
                    className="h-7 w-7 object-contain"
                    draggable={false}
                  />
                  <span className="font-orbitron text-xs text-text-dim">
                    ×{g.count}
                    {g.path !== undefined && (
                      <span className="text-primary">·{String.fromCharCode(65 + g.path)}</span>
                    )}
                  </span>
                </span>
              ))}
            </div>
            <span className="shrink-0 font-orbitron text-sm font-bold text-gold">
              {Math.max(0, state.prepT).toFixed(1)}s
            </span>
            <button
              type="button"
              onClick={onStart}
              className="clip-btn min-h-[44px] shrink-0 bg-primary/90 px-3 py-1.5 font-orbitron text-xs font-bold text-bg-deep transition hover:bg-primary active:scale-95"
            >
              立即开战
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
