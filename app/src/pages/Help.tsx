// 游戏说明页 —— 快速上手 / 操作指南 / 战术学院 / 数值速查
import { useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Play } from 'lucide-react';
import { ENEMY_LIST, TOWER_LIST } from '@/game/config';
import { LEVELS } from '@/game/levels';
import { NeonButton, PanelCard, SectionTitle } from '@/components/ui';
import UnitIcon from '@/components/UnitIcon';

const STEPS = [
  { n: '01', title: '建造', desc: '点击底部塔卡片，再点地图空位部署防线。', tower: 'laser' as const },
  { n: '02', title: '升级', desc: '点击已建塔，花费金币升级至 Lv3，火力翻倍。', tower: 'missile' as const },
  { n: '03', title: '守住', desc: '敌人抵达基地会扣除生命，生命归零则殖民地陷落。', tower: 'railgun' as const },
];

const CONTROLS: [string, string, string][] = [
  ['建塔', '点塔卡片 → 点地图格子', '同左'],
  ['选中塔', '点击已建塔', '点击塔（悬停预览射程）'],
  ['取消', '点空白处', '右键 / Esc'],
  ['暂停', 'HUD 暂停按钮', '空格键'],
  ['加速', 'HUD ⏩ 按钮', '按 2 键'],
  ['升级 / 出售', '点塔 → 底部面板按钮', '同左'],
];

const TIPS = [
  '后续章节虫群会多路进攻：波次预告标注了入口（A/B），未标注的敌人沿各入口轮流出兵，别让任何一条路线放空。',
  '减速塔放在弯道内侧，覆盖双倍路径长度。',
  '甲壳兽装甲抗激光——用导弹塔的溅射和电磁炮的破甲对付它。',
  '隐匿者隐身时无法被锁定，电磁炮的贯穿光束依然有效。',
  '分裂体死后会分裂，别让它们死在基地门口。',
  'BOSS 半血狂暴提速，提前在它路径末段预留满级火力。',
  '出售塔返还 70%——战局变化时大胆重建防线。',
  '各章节的 BOSS 波（简报中的 ⚠ 警告）前留好金币应对。',
];

export default function Help() {
  const [openTip, setOpenTip] = useState<number | null>(0);
  const [openTable, setOpenTable] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-24">
      <SectionTitle en="FIELD MANUAL" zh="作战手册" />
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-2 text-sm text-text-dim">
        三分钟学会指挥高塔防线
      </motion.p>

      {/* H2 快速上手 */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {STEPS.map((st, i) => (
          <motion.div
            key={st.n}
            initial={{ y: 40, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12 }}
          >
            <PanelCard className="h-full p-5 text-center">
              <div className="font-orbitron text-5xl font-black text-transparent [-webkit-text-stroke:1.5px_#22E0FF]">
                {st.n}
              </div>
              <UnitIcon kind="tower" type={st.tower} size={72} className="mx-auto mt-2" />
              <h3 className="mt-2 font-orbitron text-base font-bold text-primary">{st.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-text-dim">{st.desc}</p>
            </PanelCard>
          </motion.div>
        ))}
      </div>

      {/* H3 操作指南 */}
      <h3 className="mt-12 font-orbitron text-sm font-bold tracking-widest text-primary">操作指南</h3>
      <PanelCard className="mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-primary/15 text-xs text-text-dim">
              <th className="px-4 py-2.5 text-left">操作</th>
              <th className="px-4 py-2.5 text-left">触屏</th>
              <th className="px-4 py-2.5 text-left">桌面</th>
            </tr>
          </thead>
          <tbody>
            {CONTROLS.map(([op, touch, desk], i) => (
              <motion.tr
                key={op}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="border-b border-primary/5"
              >
                <td className="px-4 py-2.5 font-bold">{op}</td>
                <td className="px-4 py-2.5 text-text-dim">{touch}</td>
                <td className="px-4 py-2.5 text-text-dim">{desk}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </PanelCard>

      {/* H4 战术学院 */}
      <h3 className="mt-12 font-orbitron text-sm font-bold tracking-widest text-primary">战术学院</h3>
      <div className="mt-4 space-y-2">
        {TIPS.map((tip, i) => (
          <PanelCard key={i} className="overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
              onClick={() => setOpenTip(openTip === i ? null : i)}
            >
              <span>战术条例 #{i + 1}</span>
              <ChevronDown className={`h-4 w-4 text-primary transition-transform ${openTip === i ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {openTip === i && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <p className="mx-4 mb-3 border-l-2 border-primary pl-3 text-sm text-text-dim">{tip}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </PanelCard>
        ))}
      </div>

      {/* H5 数值速查 */}
      <h3 className="mt-12 font-orbitron text-sm font-bold tracking-widest text-primary">数值速查</h3>
      <div className="mt-4 space-y-2">
        <Collapse
          title="防御塔完整数值表"
          open={openTable === 'towers'}
          onToggle={() => setOpenTable(openTable === 'towers' ? null : 'towers')}
        >
          {TOWER_LIST.map((t) => (
            <div key={t.type} className="mb-3">
              <div className="mb-1 text-xs font-bold" style={{ color: t.color }}>
                {t.name} {t.nameEn}
              </div>
              <table className="w-full text-center font-orbitron text-[11px]">
                <thead>
                  <tr className="text-text-dim">
                    <th className="py-1 text-left">等级</th><th>伤害</th><th>射程</th><th>射速</th><th>费用</th>
                  </tr>
                </thead>
                <tbody>
                  {t.levels.map((lv, li) => (
                    <tr key={li} className={li % 2 ? 'bg-primary/5' : ''}>
                      <td className="py-1 text-left">Lv{li + 1}</td>
                      <td>{lv.damage}</td><td>{lv.range}</td><td>{lv.rate}/s</td>
                      <td className="text-gold">{lv.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </Collapse>

        <Collapse
          title="敌人完整数值表"
          open={openTable === 'enemies'}
          onToggle={() => setOpenTable(openTable === 'enemies' ? null : 'enemies')}
        >
          <table className="w-full text-center font-orbitron text-[11px]">
            <thead>
              <tr className="text-text-dim">
                <th className="py-1 text-left">敌人</th><th>HP</th><th>速度</th><th>奖励</th><th>漏怪</th>
              </tr>
            </thead>
            <tbody>
              {ENEMY_LIST.map((e, i) => (
                <tr key={e.type} className={i % 2 ? 'bg-primary/5' : ''}>
                  <td className="py-1 text-left font-sans font-bold" style={{ color: e.color }}>{e.name}</td>
                  <td>{e.hp}{e.type === 'boss' ? '*' : ''}</td>
                  <td>{e.speed}</td><td className="text-gold">{e.reward}</td>
                  <td className="text-hp">-{e.leak}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-text-dim">* BOSS 血量见波次表；普通敌人 HP 随波次 +12%/波</p>
        </Collapse>

        <Collapse
          title="战役波次表"
          open={openTable === 'waves'}
          onToggle={() => setOpenTable(openTable === 'waves' ? null : 'waves')}
        >
          {LEVELS.map((lv) => (
            <div key={lv.id} className="mb-4">
              <div className="mb-1 text-xs font-bold text-primary">
                第 {lv.id} 章 · {lv.name}（{lv.waves.length} 波）
              </div>
              <table className="w-full text-center font-orbitron text-[11px]">
                <thead>
                  <tr className="text-text-dim">
                    <th className="py-1 text-left">波次</th><th>构成</th><th>奖励</th>
                  </tr>
                </thead>
                <tbody>
                  {lv.waves.map((w, i) => (
                    <tr key={w.wave} className={`${i % 2 ? 'bg-primary/5' : ''} ${w.isBoss ? 'text-accent' : ''}`}>
                      <td className="py-1 text-left">W{w.wave}{w.isBoss ? ' ⚠' : ''}</td>
                      <td className="font-sans text-[10px]">
                        {w.groups.map((g) => `${g.count}${g.type === 'boss' ? 'BOSS' : ''}`).join(' + ') || '—'}
                      </td>
                      <td className="text-gold">{w.bonus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </Collapse>
      </div>

      {/* H6 CTA */}
      <div className="mt-14 text-center">
        <p className="text-sm text-text-dim">已准备就绪？</p>
        <Link to="/game" className="mt-4 inline-block">
          <NeonButton className="h-14 px-10 text-base animate-pulse-glow">
            <Play className="h-5 w-5" /> 开始防御
          </NeonButton>
        </Link>
      </div>
    </div>
  );
}

function Collapse({
  title, open, onToggle, children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <PanelCard className="overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold"
        onClick={onToggle}
      >
        {title}
        <ChevronDown className={`h-4 w-4 text-primary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </PanelCard>
  );
}
