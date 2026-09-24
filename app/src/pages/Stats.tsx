// 成就 / 统计页 —— 数据全部来自 localStorage
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Clock, Coins, Gamepad2, Lock, Play, Skull, Trash2, Trophy, Zap } from 'lucide-react';
import {
  ACHIEVEMENTS, clearAll, commanderLevel, formatDuration, loadAchievements, loadStats,
} from '@/game/stats';
import { NeonButton, PanelCard, SectionTitle } from '@/components/ui';

export default function Stats() {
  const [version, setVersion] = useState(0);
  const stats = useMemo(() => loadStats(), [version]);
  const unlocked = useMemo(() => loadAchievements(), [version]);
  const [confirming, setConfirming] = useState(false);

  const { level, progress } = commanderLevel(stats.kills);
  const R = 54;
  const CIRC = 2 * Math.PI * R;

  const cards = [
    { icon: Skull, label: '总击杀数', value: stats.kills, key: 'kills' },
    { icon: Gamepad2, label: '总游戏场次', value: stats.games, key: 'games' },
    { icon: Trophy, label: '胜场数', value: stats.wins, key: 'wins' },
    { icon: Zap, label: '最高波次', value: stats.bestWave, key: 'bestWave' },
    { icon: Coins, label: '累计金币赚取', value: stats.goldEarned, key: 'gold' },
    { icon: Clock, label: '总游戏时长', value: formatDuration(stats.playTimeSec), key: 'time' },
  ];

  const empty = stats.games === 0;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-24">
      <SectionTitle en="COMMANDER RECORD" zh="指挥官档案" />

      {empty ? (
        <PanelCard className="mt-10 flex flex-col items-center p-10 text-center">
          <Trophy className="h-16 w-16 text-text-dim/40" />
          <p className="mt-4 text-sm text-text-dim">尚未建立军功，去迎接你的第一场战斗吧</p>
          <Link to="/game" className="mt-4">
            <NeonButton><Play className="h-4 w-4" />开始游戏</NeonButton>
          </Link>
        </PanelCard>
      ) : (
        <>
          {/* P1 等级环 */}
          <div className="mt-8 flex justify-center">
            <div className="relative h-36 w-36">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r={R} fill="none" stroke="#0D1428" strokeWidth="8" />
                <motion.circle
                  cx="60" cy="60" r={R} fill="none"
                  stroke="url(#lvgrad)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={CIRC}
                  initial={{ strokeDashoffset: CIRC }}
                  animate={{ strokeDashoffset: CIRC * (1 - progress) }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id="lvgrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#22E0FF" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-orbitron text-3xl font-black text-primary">{level}</span>
                <span className="text-[10px] tracking-widest text-text-dim">指挥官等级</span>
              </div>
            </div>
          </div>

          {/* P2 生涯统计 */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cards.map((c, i) => (
              <motion.div
                key={c.key}
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <PanelCard className="p-4">
                  <c.icon className="h-5 w-5 text-primary" />
                  <div className="mt-2 font-orbitron text-2xl font-bold text-gold">{c.value}</div>
                  <div className="mt-1 text-xs text-text-dim">{c.label}</div>
                  {stats.recentKills.length > 1 && c.key === 'kills' && <Sparkline data={stats.recentKills} />}
                </PanelCard>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* P3 成就列表 */}
      <h3 className="mt-12 font-orbitron text-sm font-bold tracking-widest text-primary">
        成就 {Object.keys(unlocked).length}/{ACHIEVEMENTS.length}
      </h3>
      <div className="mt-4 space-y-2">
        {ACHIEVEMENTS.map((a, i) => {
          const date = unlocked[a.id];
          const prog = Math.min(a.progress(stats, null), a.target);
          return (
            <motion.div
              key={a.id}
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
            >
              <PanelCard className={`flex items-center gap-3 p-3 ${date ? 'border-gold/50 shadow-[0_0_12px_#FFC94D22]' : 'opacity-70'}`}>
                {date ? (
                  <Trophy className="h-8 w-8 shrink-0 text-gold" />
                ) : (
                  <span className="relative shrink-0">
                    <Trophy className="h-8 w-8 text-text-dim/40" />
                    <Lock className="absolute -bottom-1 -right-1 h-3.5 w-3.5 text-text-dim" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-sm font-bold ${date ? 'text-gold' : ''}`}>{a.name}</span>
                    {date && (
                      <span className="shrink-0 text-[10px] text-text-dim">
                        {new Date(date).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-dim">{a.desc}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-bg-deep">
                      <motion.div
                        className={`h-full rounded-full ${date ? 'bg-gold' : 'bg-primary'}`}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(date ? 1 : prog / a.target) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                    <span className="font-orbitron text-[10px] text-text-dim">
                      {date ? a.target : prog}/{a.target}
                    </span>
                  </div>
                </div>
              </PanelCard>
            </motion.div>
          );
        })}
      </div>

      {/* P4 数据管理 */}
      <PanelCard className="mt-12 border-accent/40 p-5">
        <h3 className="text-sm font-bold text-accent">危险区</h3>
        <p className="mt-1 text-xs text-text-dim">清除全部生涯统计与成就进度，此操作不可撤销。</p>
        <div className="mt-3 flex items-center gap-3">
          <NeonButton
            variant="danger"
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              clearAll();
              setConfirming(false);
              setVersion((v) => v + 1);
            }}
          >
            <Trash2 className="h-4 w-4" />
            {confirming ? '再次点击确认清除' : '清除全部存档数据'}
          </NeonButton>
          {confirming && (
            <button type="button" className="text-xs text-text-dim underline" onClick={() => setConfirming(false)}>
              取消
            </button>
          )}
        </div>
      </PanelCard>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => `${(i / Math.max(data.length - 1, 1)) * 100},${20 - (v / max) * 18}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 22" className="mt-2 h-5 w-full" preserveAspectRatio="none">
      <motion.polyline
        points={pts}
        fill="none"
        stroke="#22E0FF"
        strokeWidth="1.5"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
      />
    </svg>
  );
}
