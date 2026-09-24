// T3b 塔详情面板 —— 属性（当前→下级）/ 累计击杀 / 升级 / 出售
import { motion } from 'framer-motion';
import { SELL_RATE, TOWERS } from '../config';
import type { TowerState } from '../types';
import { NeonButton } from '@/components/ui';
import UnitIcon from '@/components/UnitIcon';

interface Props {
  tower: TowerState;
  gold: number;
  onUpgrade: () => void;
  onSell: () => void;
  onClose: () => void;
}

export default function TowerDetailPanel({ tower, gold, onUpgrade, onSell, onClose }: Props) {
  const def = TOWERS[tower.type];
  const lv = def.levels[tower.level];
  const next = tower.level < 2 ? def.levels[tower.level + 1] : null;
  const refund = Math.floor(tower.invested * SELL_RATE);

  const statRow = (label: string, cur: number, nxt: number | null, unit = '') => (
    <div key={label} className="flex items-center justify-between gap-1 text-xs">
      <span className="shrink-0 text-text-dim">{label}</span>
      <span className="whitespace-nowrap font-orbitron font-bold text-text">
        {cur}
        {unit}
        {nxt !== null && (
          <span className="ml-1 text-green">
            → {nxt}
            {unit}
          </span>
        )}
      </span>
    </div>
  );

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 26 }}
      className="border-t border-primary/20 bg-glass px-3 py-3 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1280px] items-stretch gap-3">
        <UnitIcon
          kind="tower"
          type={def.type}
          level={tower.level}
          size={80}
          className="shrink-0 self-center"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-text">{def.name}</span>
            <span
              className="clip-btn border px-1.5 font-orbitron text-[10px] font-bold"
              style={{
                color: tower.level >= 2 ? '#FFC94D' : def.color,
                borderColor: `${def.color}66`,
              }}
            >
              Lv{tower.level + 1}
            </span>
            <span className="ml-auto whitespace-nowrap text-[10px] text-text-dim">
              击杀 <span className="font-orbitron text-gold">{tower.kills}</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="px-1 text-text-dim transition hover:text-text"
            >
              ✕
            </button>
          </div>
          <div className="mt-1.5 grid max-w-md grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {statRow('伤害', lv.damage, next?.damage ?? null)}
            {statRow('射程', lv.range, next?.range ?? null, '格')}
            {statRow('射速', lv.rate, next?.rate ?? null, '/s')}
          </div>
          <div className="mt-1 text-[10px] text-text-dim">{def.role}</div>
        </div>
        <div className="flex w-32 shrink-0 flex-col justify-center gap-2 sm:w-36">
          {next ? (
            <NeonButton
              onClick={onUpgrade}
              disabled={gold < next.cost}
              className="!min-h-[36px] w-full px-2 py-1 text-xs"
            >
              <img src="/icon-upgrade.svg" alt="" className="h-3.5 w-3.5" />
              升级 {next.cost}
            </NeonButton>
          ) : (
            <NeonButton disabled className="!min-h-[36px] w-full px-2 py-1 font-orbitron text-xs">
              MAX
            </NeonButton>
          )}
          <NeonButton
            variant="danger"
            onClick={onSell}
            className="!min-h-[36px] w-full px-2 py-1 text-xs"
          >
            <img src="/icon-sell.svg" alt="" className="h-3.5 w-3.5" />
            出售 +{refund}
          </NeonButton>
        </div>
      </div>
    </motion.div>
  );
}
