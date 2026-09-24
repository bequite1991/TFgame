// 图鉴页 —— 防御系统 / 虫群档案（数据与游戏配置同源）
import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Home } from 'lucide-react';
import { ENEMY_LIST, TOWER_LIST, type EnemyCategory } from '@/game/config';
import { NeonButton, PanelCard, SectionTitle } from '@/components/ui';
import UnitIcon from '@/components/UnitIcon';

type Tab = 'towers' | 'enemies';
const FILTERS: { id: EnemyCategory | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'normal', label: '普通' },
  { id: 'fast', label: '快速' },
  { id: 'tank', label: '坦克' },
  { id: 'special', label: '特殊' },
  { id: 'boss', label: 'BOSS' },
];

export default function Codex() {
  const [tab, setTab] = useState<Tab>('towers');
  const [filter, setFilter] = useState<EnemyCategory | 'all'>('all');

  const enemies = ENEMY_LIST.filter((e) => filter === 'all' || e.category === filter);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-20">
      {/* C1 页头横幅 */}
      <div className="relative -mx-4 mb-6 h-48 overflow-hidden sm:h-64">
        <motion.img
          src={`${import.meta.env.BASE_URL}codex-banner.png`}
          alt=""
          className="h-full w-full object-cover"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-deep/30 via-transparent to-bg-deep" />
        <div className="absolute bottom-4 left-4 sm:left-8">
          <SectionTitle en="TACTICAL DATABASE" zh="战术图鉴" />
        </div>
      </div>

      {/* C2 分类 Tab */}
      <div className="sticky top-14 z-20 mt-8 bg-bg-deep/90 pb-2 pt-2 backdrop-blur">
        <div className="flex gap-6 border-b border-primary/15">
          {(
            [
              { id: 'towers', label: '防御系统' },
              { id: 'enemies', label: '虫群档案' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-2 pb-3 text-sm font-bold transition ${
                tab === t.id ? 'text-primary' : 'text-text-dim hover:text-text'
              }`}
            >
              {t.label}
              {tab === t.id && (
                <motion.span layoutId="codex-tab" className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" />
              )}
            </button>
          ))}
        </div>
        {tab === 'enemies' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-full border px-3 py-1 text-xs transition active:scale-95 ${
                  filter === f.id
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-primary/20 text-text-dim'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* C3 防御系统 */}
      {tab === 'towers' && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {TOWER_LIST.map((t, i) => (
            <motion.div
              key={t.type}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <PanelCard className="p-5">
                <div className="flex items-start gap-4">
                  <motion.div
                    animate={{ rotate: [-2, 2, -2] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <UnitIcon kind="tower" type={t.type} size={110} />
                  </motion.div>
                  <div className="min-w-0">
                    <h3 className="font-orbitron text-base font-bold" style={{ color: t.color }}>
                      {t.nameEn}
                    </h3>
                    <p className="text-sm font-bold">{t.name} —— {t.role}</p>
                    <span className="mt-2 inline-block rounded-full border border-primary/30 px-2 py-0.5 text-[10px] text-primary">
                      {t.tag}
                    </span>
                  </div>
                </div>

                <table className="mt-4 w-full text-center font-orbitron text-xs">
                  <thead>
                    <tr className="text-text-dim">
                      <th className="py-1 text-left">等级</th>
                      <th>伤害</th>
                      <th>射程</th>
                      <th>射速</th>
                      <th>费用</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.levels.map((lv, li) => (
                      <tr key={li} className="border-t border-primary/10 transition-colors hover:bg-primary/5">
                        <td className="py-1.5 text-left text-primary">Lv{li + 1}</td>
                        <td>{lv.damage}</td>
                        <td>{lv.range}</td>
                        <td>{lv.rate}/s</td>
                        <td className="text-gold">{lv.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-[11px] text-text-dim">
                  擅长：{t.strong} · 乏力：{t.weak}
                </p>
              </PanelCard>
            </motion.div>
          ))}
        </div>
      )}

      {/* C4 虫群档案 */}
      {tab === 'enemies' && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {enemies.map((e, i) => {
            const isBoss = e.category === 'boss';
            return (
              <motion.div
                key={e.type}
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className={isBoss ? 'sm:col-span-2 lg:col-span-3' : ''}
                whileHover={{ y: -6 }}
              >
                <PanelCard className={`h-full p-5 ${isBoss ? 'border-accent/50' : ''}`}>
                  <div className={`flex ${isBoss ? 'flex-col items-center gap-4 sm:flex-row' : 'flex-col'}`}>
                    <div
                      className="flex items-center justify-center rounded-lg"
                      style={{ background: 'radial-gradient(circle, rgba(122,79,208,0.25), transparent 70%)' }}
                    >
                      <UnitIcon kind="enemy" type={e.type} size={isBoss ? 160 : 100} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold" style={{ color: e.color }}>{e.name}</h3>
                        <span className="font-orbitron text-[10px] text-text-dim">{e.nameEn}</span>
                        {isBoss ? (
                          <span className="clip-btn border border-accent bg-accent/20 px-2 py-0.5 font-orbitron text-[10px] font-bold text-accent">
                            APEX
                          </span>
                        ) : (
                          <span className="text-[10px] text-gold">{'★'.repeat(e.threat)}</span>
                        )}
                      </div>
                      {/* 属性条 */}
                      <div className="mt-2 space-y-1.5">
                        {(
                          [
                            ['HP', Math.min(e.hp / 4000, 1), '#FF5A5A'],
                            ['速度', e.speed / 2, '#22E0FF'],
                            ['威胁', e.threat / 5, '#FFC94D'],
                          ] as const
                        ).map(([label, ratio, color]) => (
                          <div key={label} className="flex items-center gap-2 text-[10px] text-text-dim">
                            <span className="w-8">{label}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-deep">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: color }}
                                initial={{ width: 0 }}
                                whileInView={{ width: `${ratio * 100}%` }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 font-orbitron text-[11px] text-text-dim">
                        HP {e.hp} · 速度 {e.speed} · 奖励 {e.reward} · 漏怪 -{e.leak}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-text-dim">{e.desc}</p>
                      <p className="mt-1 text-[11px] text-green">弱点：{e.weakness}</p>
                    </div>
                  </div>
                </PanelCard>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link to="/">
          <NeonButton variant="ghost"><Home className="h-4 w-4" />返回主页</NeonButton>
        </Link>
      </div>
    </div>
  );
}
