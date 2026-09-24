// 局内科技三选一 —— 波次清空后弹出（roguelike 模块），选定后进入准备期
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { TECHS } from '@/game/config';
import type { GameState, TechId } from '@/game/types';

interface Props {
  state: GameState;
  onPick: (id: TechId) => void;
}

export default function TechChoiceOverlay({ state, onPick }: Props) {
  if (state.phase !== 'tech' || !state.techChoices) return null;
  const nextWave = state.wave; // clearWave 已把 wave +1，即下一个波次
  const taken: Record<string, number> = {};
  for (const t of state.techs) taken[t] = (taken[t] ?? 0) + 1;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg-deep/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="font-orbitron text-[10px] font-bold uppercase tracking-[0.4em] text-primary">
            Tactical Module
          </div>
          <h2 className="mt-1 text-2xl font-black text-text">
            第 {nextWave} 波前 · 选择战术模块
          </h2>
          <div className="mt-1 text-xs text-text-dim">
            三选一 · 同名模块可叠加 · 已装载数 {state.techs.length}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {state.techChoices.map((id, i) => {
            const t = TECHS[id];
            const owned = taken[id] ?? 0;
            const instant = id === 'supply' || id === 'repair';
            return (
              <motion.button
                key={id}
                type="button"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onPick(id)}
                className="clip-btn group flex items-center gap-3 border bg-bg-panel/80 p-4 text-left transition hover:bg-primary/10"
                style={{
                  borderColor: `${t.color}55`,
                  boxShadow: `0 0 12px ${t.color}22`,
                }}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-xl font-black"
                  style={{
                    borderColor: `${t.color}66`,
                    color: t.color,
                    background: `${t.color}14`,
                    textShadow: `0 0 10px ${t.color}88`,
                  }}
                >
                  {t.glyph}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold" style={{ color: t.color }}>
                      {t.name}
                    </span>
                    {owned > 0 && (
                      <span className="rounded border border-gold/40 px-1 text-[10px] font-bold text-gold">
                        已装 ×{owned}
                      </span>
                    )}
                    {instant && (
                      <span className="text-[10px] tracking-widest text-text-dim">一次性</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed text-text-dim">{t.desc}</div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-text-dim transition group-hover:text-primary" />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
