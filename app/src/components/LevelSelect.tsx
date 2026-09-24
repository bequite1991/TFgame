// 选关弹窗 —— 三章战役卡（解锁进度）+ 难度三选一 → /game?level=&difficulty=
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { NeonButton, PanelCard } from '@/components/ui';
import { DIFFICULTIES } from '@/game/config';
import { LEVELS } from '@/game/levels';
import { loadProgress } from '@/game/stats';
import type { Difficulty } from '@/game/types';

const DIFF_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LevelSelect({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [levelId, setLevelId] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const { cleared } = loadProgress();

  const isUnlocked = (id: number) => id === 1 || cleared.includes(id - 1);
  const selected = LEVELS.find((l) => l.id === levelId) ?? LEVELS[0];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 overflow-y-auto bg-bg-deep/80 backdrop-blur-md"
          onClick={onClose}
        >
          <div className="flex min-h-full items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 22 }}
              className="w-full max-w-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <PanelCard className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
                <div className="font-orbitron text-xs font-bold uppercase tracking-[0.3em] text-primary">
                  Campaign Select
                </div>
                <h2 className="mt-1 text-xl font-black text-text">选择战役章节</h2>
                <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-primary to-transparent" />

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {LEVELS.map((lv) => {
                    const unlocked = isUnlocked(lv.id);
                    const done = cleared.includes(lv.id);
                    const active = levelId === lv.id;
                    return (
                      <button
                        key={lv.id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => setLevelId(lv.id)}
                        className="text-left disabled:cursor-not-allowed"
                      >
                        <PanelCard
                          className={`h-full p-4 transition-all duration-200 ${
                            !unlocked
                              ? 'opacity-45'
                              : active
                                ? 'neon-glow scale-[1.02] border-primary'
                                : 'hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-orbitron text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
                              Chapter {String(lv.id).padStart(2, '0')}
                            </span>
                            {done ? (
                              <span className="flex items-center gap-1 text-xs font-bold text-green">
                                <Check className="h-3.5 w-3.5" /> 已通关
                              </span>
                            ) : !unlocked ? (
                              <span className="flex items-center gap-1 text-xs text-text-dim">
                                <Lock className="h-3.5 w-3.5" /> 未解锁
                              </span>
                            ) : null}
                          </div>
                          <div className={`mt-2 text-lg font-bold ${active ? 'text-primary' : 'text-text'}`}>
                            第 {lv.id} 章 · {lv.name}
                          </div>
                          <div className="mt-0.5 text-[10px] tracking-widest text-text-dim">{lv.sub}</div>
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-dim">
                            {lv.briefing[0]}
                          </p>
                          <div className="mt-2 font-orbitron text-[10px] text-text-dim">
                            {lv.waves.length} 波 · BOSS 波：
                            {lv.waves.filter((w) => w.isBoss).map((w) => `W${w.wave}`).join(' / ')}
                          </div>
                        </PanelCard>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5">
                  <div className="text-xs text-text-dim">难度</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {DIFF_ORDER.map((id) => {
                      const d = DIFFICULTIES[id];
                      const active = difficulty === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setDifficulty(id)}
                          className={`clip-btn border px-3 py-2.5 text-sm transition active:scale-95 ${
                            active
                              ? 'border-primary bg-primary/15 font-bold text-primary'
                              : 'border-primary/20 text-text-dim hover:border-primary/50 hover:text-text'
                          }`}
                        >
                          {d.name}
                          <span className="block text-[10px] font-normal tracking-widest opacity-70">
                            {d.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <NeonButton
                    className="h-12 flex-1 text-base"
                    onClick={() => navigate(`/game?level=${selected.id}&difficulty=${difficulty}`)}
                  >
                    ▶ 出击 · 第 {selected.id} 章
                  </NeonButton>
                  <NeonButton variant="ghost" onClick={onClose}>
                    取消
                  </NeonButton>
                </div>
              </PanelCard>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
