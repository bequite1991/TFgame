// T4 结算覆盖层 —— 胜利 / 失败：插画、战绩 6 行、新成就、下一关 / 再来一局 / 返回主页
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { NeonButton, PanelCard } from '@/components/ui';
import { ACHIEVEMENTS, formatDuration } from '../stats';
import { getLevel, LEVELS } from '../levels';
import type { LevelDef } from '../levels';
import type { Difficulty, GameState } from '../types';

interface Props {
  state: GameState;
  level: LevelDef;
  difficulty: Difficulty;
  achievements: string[];
  onRestart: () => void;
}

export default function ResultOverlay({ state, level, difficulty, achievements, onRestart }: Props) {
  const won = state.phase === 'won';
  const hasNext = LEVELS.some((l) => l.id === level.id + 1);
  const rows: [string, string][] = [
    ['波次', `第 ${state.wave} / ${state.totalWaves} 波`],
    ['击杀数', `${state.kills}`],
    ['漏怪数', `${state.leaked}`],
    ['剩余生命', `${state.lives} / ${state.maxLives}`],
    ['金币赚取', `${state.goldEarned}`],
    ['用时', formatDuration(state.timeSec)],
  ];
  const unlocked = ACHIEVEMENTS.filter((a) => achievements.includes(a.id));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-glass backdrop-blur-xl"
    >
      {/* 胜利金色粒子飘落 3s */}
      {won && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute top-0 h-1.5 w-1.5 rounded-full bg-gold"
              style={{ left: `${(i * 41) % 100}%` }}
              initial={{ y: -12, opacity: 1 }}
              animate={{ y: '100vh', opacity: 0 }}
              transition={{ duration: 3, delay: (i % 8) * 0.3, ease: 'easeIn' }}
            />
          ))}
        </div>
      )}

      <div className="flex min-h-full items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="w-full max-w-md"
        >
          <PanelCard className="p-5 sm:p-6">
            <img
              src={won ? '/victory-art.png' : '/defeat-art.png'}
              alt=""
              className="clip-panel aspect-[3/2] w-full object-cover"
              draggable={false}
            />
            <h2
              className={`mt-4 text-center font-orbitron text-2xl font-black sm:text-[32px] ${
                won ? 'text-glow text-primary' : 'text-accent'
              }`}
            >
              {won ? '防线守住了！' : '殖民地陷落…'}
            </h2>

            {won && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="clip-panel mt-4 border border-primary/25 bg-primary/5 p-3.5"
              >
                <div className="font-orbitron text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
                  第 {level.id} 章 · {level.name} · 战役记录
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-text-dim">{level.epilogue}</p>
                {!hasNext && (
                  <p className="mt-2 text-xs font-bold text-gold">—— 战役完结 · 星环永固 ——</p>
                )}
              </motion.div>
            )}

            <div className="mt-4 space-y-1.5">
              {rows.map(([k, v], i) => (
                <motion.div
                  key={k}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.08 }}
                  className="flex items-center justify-between border-b border-primary/10 pb-1.5 text-sm"
                >
                  <span className="text-text-dim">{k}</span>
                  <span className="font-orbitron font-bold text-text">{v}</span>
                </motion.div>
              ))}
            </div>

            {unlocked.length > 0 && (
              <div className="mt-4 space-y-2">
                {unlocked.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ x: 80, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.7 + i * 0.15, type: 'spring', damping: 18 }}
                    className="clip-panel flex items-center gap-3 border border-gold/50 bg-gold/10 px-3 py-2"
                  >
                    <motion.img
                      src="/icon-trophy.svg"
                      alt=""
                      className="h-8 w-8"
                      initial={{ rotate: -180 }}
                      animate={{ rotate: 0 }}
                      transition={{ delay: 0.7 + i * 0.15, type: 'spring', damping: 10 }}
                    />
                    <div>
                      <div className="text-sm font-bold text-gold">新成就 · {a.name}</div>
                      <div className="text-xs text-text-dim">{a.desc}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="mt-5 flex gap-3">
              {won && hasNext ? (
                <Link to={`/game?level=${getLevel(level.id + 1).id}&difficulty=${difficulty}`} className="flex-1">
                  <NeonButton className="w-full">
                    下一关 ▶
                  </NeonButton>
                </Link>
              ) : (
                <NeonButton onClick={onRestart} className="flex-1">
                  再来一局
                </NeonButton>
              )}
              <Link to="/" className="flex-1">
                <NeonButton variant="ghost" className="w-full">
                  返回主页
                </NeonButton>
              </Link>
            </div>
            {won && hasNext && (
              <button
                type="button"
                onClick={onRestart}
                className="mt-3 w-full text-center text-xs text-text-dim transition hover:text-primary"
              >
                重打本关
              </button>
            )}
          </PanelCard>
        </motion.div>
      </div>
    </motion.div>
  );
}
