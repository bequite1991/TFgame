// 出击简报覆盖层 —— 章节 / 剧情简报逐段淡入 / 「▶ 出击」
import { motion } from 'framer-motion';
import { NeonButton, PanelCard } from '@/components/ui';
import type { LevelDef } from '../levels';

interface Props {
  level: LevelDef;
  onLaunch: () => void;
}

export default function BriefingOverlay({ level, onLaunch }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-bg-deep/80 backdrop-blur-md"
    >
      <div className="flex min-h-full items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="w-full max-w-lg"
        >
          <PanelCard className="p-6 sm:p-8">
            <div className="font-orbitron text-xs font-bold uppercase tracking-[0.3em] text-primary">
              Chapter {String(level.id).padStart(2, '0')}
            </div>
            <h2 className="text-glow mt-2 font-orbitron text-2xl font-black text-primary sm:text-3xl">
              第 {level.id} 章 · {level.name}
            </h2>
            <p className="mt-1 text-xs tracking-widest text-text-dim">{level.sub}</p>
            <div className="mt-3 h-[2px] w-16 bg-gradient-to-r from-primary to-transparent" />

            <div className="mt-5 space-y-3">
              {level.briefing.map((p, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.35, duration: 0.5 }}
                  className="text-sm leading-relaxed text-text-dim"
                >
                  {p}
                </motion.p>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 + level.briefing.length * 0.35 }}
              className="mt-7"
            >
              <NeonButton className="animate-pulse-glow h-12 w-full text-base" onClick={onLaunch}>
                ▶ 出击
              </NeonButton>
            </motion.div>
          </PanelCard>
        </motion.div>
      </div>
    </motion.div>
  );
}
