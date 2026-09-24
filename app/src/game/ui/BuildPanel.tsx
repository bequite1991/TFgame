// T3a 建塔面板 —— 塔卡片横滑（scroll-snap）；放置模式收起为提示条
import { motion } from 'framer-motion';
import { TOWER_LIST } from '../config';
import type { TowerType } from '../types';
import UnitIcon from '@/components/UnitIcon';

interface Props {
  gold: number;
  placing: TowerType | null;
  onSelect: (t: TowerType) => void;
  onCancel: () => void;
}

export default function BuildPanel({ gold, placing, onSelect, onCancel }: Props) {
  if (placing) {
    return (
      <div className="flex h-14 items-center justify-center gap-4 border-t border-primary/20 bg-glass px-3 text-sm text-primary backdrop-blur-md">
        <span className="animate-pulse">按住地图拖动预览 · 松手放置 · 滑出地图取消</span>
        <button
          type="button"
          onClick={onCancel}
          className="clip-btn min-h-[44px] border border-primary/40 px-3 py-1 text-xs text-primary transition hover:bg-primary/10 active:scale-95"
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 26 }}
      className="border-t border-primary/20 bg-glass px-3 py-3 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1280px] snap-x snap-mandatory gap-3 overflow-x-auto pb-1 lg:justify-center">
        {TOWER_LIST.map((def) => {
          const cost = def.levels[0].cost;
          const afford = gold >= cost;
          return (
            <button
              key={def.type}
              type="button"
              disabled={!afford}
              onClick={() => onSelect(def.type)}
              className={`clip-panel flex w-24 shrink-0 snap-center flex-col items-center gap-1 border px-2 py-2 transition active:scale-95 ${
                afford
                  ? 'border-primary/25 bg-bg-panel/80 hover:scale-105 hover:border-primary/70 hover:shadow-[0_0_8px_#22E0FF88,0_0_24px_#22E0FF33]'
                  : 'cursor-not-allowed border-primary/10 bg-bg-panel/50 opacity-50 grayscale'
              }`}
            >
              <UnitIcon kind="tower" type={def.type} size={64} className="h-16 w-16" />
              <span className="text-xs font-bold text-text">{def.name}</span>
              <span className="flex items-center gap-1">
                <img src="/icon-coin.svg" alt="" className="h-3.5 w-3.5" />
                <span className={`font-orbitron text-xs font-bold ${afford ? 'text-gold' : 'text-hp'}`}>
                  {cost}
                </span>
              </span>
              <span
                className="border px-1.5 text-[10px] leading-4"
                style={{ color: def.color, borderColor: `${def.color}55` }}
              >
                {def.tag}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
