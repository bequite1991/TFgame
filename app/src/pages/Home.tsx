// 主页 / 开始页 —— S1 Hero（战役入口）/ S2 特色展示 / S3 战绩速览（design/home.md）
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { BookOpen, HelpCircle, Trophy } from 'lucide-react';
import { PanelCard, NeonButton, StatChip, SectionTitle } from '@/components/ui';
import LevelSelect from '@/components/LevelSelect';
import UnitIcon from '@/components/UnitIcon';
import { TOWER_LIST, ENEMY_LIST } from '@/game/config';
import { LEVELS } from '@/game/levels';
import { loadStats, loadAchievements } from '@/game/stats';

const TITLE_EN = 'TOWER LINE DEFENSE';

const ENEMY_IMG: Record<string, string> = {
  crawler: '/enemy-crawler.png',
  speeder: '/enemy-speeder.png',
  tanker: '/enemy-tanker.png',
  splitter: '/enemy-splitter.png',
  lurker: '/enemy-lurker.png',
  boss: '/enemy-boss.png',
};

/** 数字滚动（0 → to，easeOut） */
function CountUp({ to, duration = 0.8, format = (n: number) => Math.round(n).toLocaleString() }: {
  to: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - t0) / (duration * 1000), 1);
      setVal(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <>{format(val)}</>;
}

/** S1 Hero 背景星点视差层（鼠标 ±10px） */
function useParallax() {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setOffset({
      x: ((e.clientX - r.left) / r.width - 0.5) * 2,
      y: ((e.clientY - r.top) / r.height - 0.5) * 2,
    });
  }, []);
  return { ref, offset, onMouseMove };
}

export default function Home() {
  const [levelSelectOpen, setLevelSelectOpen] = useState(false);
  const { ref: heroRef, offset, onMouseMove } = useParallax();

  const stats = useMemo(() => loadStats(), []);
  const achievements = useMemo(() => loadAchievements(), []);
  const unlockedCount = Object.keys(achievements).length;

  return (
    <div>
      {/* ============ S1 Hero ============ */}
      <section
        ref={heroRef}
        onMouseMove={onMouseMove}
        className="relative flex min-h-dvh items-center justify-center overflow-hidden"
      >
        {/* 背景：hero 图 + 暗化渐变（上浅下深） */}
        <img
          src="/home-hero-bg.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-deep/40 via-bg-deep/60 to-bg-deep" />
        {/* 两层星点视差 */}
        <div
          className="starfield animate-twinkle pointer-events-none absolute -inset-6 opacity-70"
          style={{ transform: `translate3d(${offset.x * 10}px, ${offset.y * 10}px, 0)` }}
        />
        <div
          className="starfield-2 animate-twinkle-slow pointer-events-none absolute -inset-6 opacity-50"
          style={{ transform: `translate3d(${offset.x * -6}px, ${offset.y * -6}px, 0)` }}
        />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-24 text-center">
          {/* Logo */}
          <motion.img
            src="/icon-logo.svg"
            alt="高塔防线"
            className="mx-auto h-16 w-16"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
          <h1
            className="text-glow mt-4 font-orbitron font-black uppercase tracking-[0.08em] text-primary"
            style={{ fontSize: 'clamp(28px, 9vw, 64px)' }}
            aria-label={TITLE_EN}
          >
            {TITLE_EN.split('').map((ch, i) => (
              <motion.span
                key={i}
                className="inline-block"
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.04, duration: 0.5, ease: 'easeOut' }}
              >
                {ch === ' ' ? ' ' : ch}
              </motion.span>
            ))}
          </h1>
          <motion.p
            className="mt-2 font-black tracking-[1em] text-text"
            style={{ fontSize: 'clamp(14px, 4.5vw, 32px)', textIndent: '1em' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
          >
            高塔防线
          </motion.p>
          <motion.p
            className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-text-dim"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.25, duration: 0.5 }}
          >
            2242 年，星环殖民地最后的能量护盾正在衰减。湮灭虫群已突破外层防线——指挥官，你是最后的炮塔。
          </motion.p>

          {/* 主按钮：打开选关弹窗 */}
          <motion.div
            className="mx-auto mt-10 max-w-3xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.35, duration: 0.5 }}
            whileTap={{ scale: 0.95 }}
          >
            <NeonButton
              className="animate-pulse-glow h-14 w-full text-base"
              onClick={() => setLevelSelectOpen(true)}
            >
              ▶ 开始防御
            </NeonButton>
            <p className="mt-3 text-xs tracking-widest text-text-dim">
              {LEVELS.length} 章战役 · {LEVELS.reduce((n, l) => n + l.waves.length, 0)} 波虫群 · 从星环外沿打到湮灭之心
            </p>
          </motion.div>

          {/* 次按钮行 */}
          <motion.div
            className="mt-4 flex flex-wrap items-center justify-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.85, duration: 0.5 }}
          >
            <Link to="/codex">
              <NeonButton variant="ghost">
                <BookOpen className="h-4 w-4" />
                图鉴
              </NeonButton>
            </Link>
            <Link to="/stats">
              <NeonButton variant="ghost">
                <Trophy className="h-4 w-4" />
                成就
              </NeonButton>
            </Link>
            <Link to="/help">
              <NeonButton variant="ghost">
                <HelpCircle className="h-4 w-4" />
                说明
              </NeonButton>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ============ S2 特色展示 ============ */}
      <section className="relative mx-auto max-w-6xl space-y-20 px-4 py-20">
        {/* 块 1：六大防御系统 */}
        <motion.div
          className="grid items-center gap-8 md:grid-cols-2"
          initial={{ x: -60, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="grid grid-cols-2 gap-3">
            {TOWER_LIST.map((t, i) => (
              <motion.div
                key={t.type}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              >
                <PanelCard className="flex flex-col items-center p-3">
                  <UnitIcon kind="tower" type={t.type} size={100} className="aspect-square" />
                  <div className="mt-2 text-sm font-bold text-text">{t.name}</div>
                  <div className="text-[10px] uppercase tracking-widest" style={{ color: t.color }}>
                    {t.tag}
                  </div>
                </PanelCard>
              </motion.div>
            ))}
          </div>
          <div>
            <SectionTitle en="Defense Systems" zh="六大防御系统" />
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-text-dim">
              <li>激光塔精准点杀，导弹塔范围溅射，减速塔迟滞虫群，电磁炮贯穿直线。</li>
              <li>特斯拉塔释放连锁闪电横扫轻甲集群，等离子炮弹幕落点化为灼烧熔池。</li>
              <li>每种塔可升至 Lv3，解锁光束贯穿、眩晕冲击等终极特性。</li>
              <li>针对不同敌人装甲与隐身能力搭配布阵，是指挥官的第一课。</li>
            </ul>
          </div>
        </motion.div>

        {/* 块 2：湮灭虫群图鉴 */}
        <motion.div
          className="grid items-center gap-8 md:grid-cols-2"
          initial={{ x: 60, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="order-last md:order-first">
            <SectionTitle en="Annihilation Swarm" zh="湮灭虫群图鉴" />
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-text-dim">
              <li>从成群的爬行者到隐身的隐匿者，六种虫群单位各有致命手段。</li>
              <li>甲壳兽抗激光、迅捷兽惧怕减速——研究弱点才能以少胜多。</li>
              <li>每章战役的压轴波次，BOSS「湮灭巨兽」都将亲临战场。</li>
            </ul>
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3">
              {ENEMY_LIST.map((e, i) => (
                <motion.div
                  key={e.type}
                  className="shrink-0"
                  initial={{ opacity: 0, x: 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                >
                  <PanelCard
                    className={`flex w-28 flex-col items-center p-3 ${
                      e.category === 'boss' ? 'neon-glow-accent border-accent/50' : ''
                    }`}
                  >
                    <img src={ENEMY_IMG[e.type]} alt={e.name} className="aspect-square w-full object-contain" />
                    <div className="mt-2 text-xs font-bold text-text">{e.name}</div>
                    <div className={`text-[10px] tracking-widest ${e.category === 'boss' ? 'text-accent' : 'text-text-dim'}`}>
                      威胁 {'★'.repeat(e.threat)}
                    </div>
                  </PanelCard>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* 块 3：史诗战役 */}
        <motion.div
          className="grid items-center gap-8 md:grid-cols-2"
          initial={{ x: -60, opacity: 0 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <PanelCard className="p-5">
            <div className="relative ml-3 border-l border-primary/25 pl-6">
              {LEVELS.map((lv, i) => (
                <motion.div
                  key={lv.id}
                  className="relative py-2.5"
                  initial={{ opacity: 0.15 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ delay: i * 0.12, duration: 0.3 }}
                >
                  <span className="absolute -left-[31px] top-4 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_6px_#22E0FF88]" />
                  <div className="font-orbitron text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
                    Chapter {String(lv.id).padStart(2, '0')}
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-text">
                    第 {lv.id} 章 · {lv.name}
                    <span className="ml-2 font-orbitron text-xs font-normal text-text-dim">
                      {lv.waves.length} 波
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-accent">
                    ⚠ BOSS 波：{lv.waves.filter((w) => w.isBoss).map((w) => `W${w.wave}`).join(' / ')}
                  </div>
                </motion.div>
              ))}
            </div>
          </PanelCard>
          <div>
            <SectionTitle en="Epic Campaign" zh="史诗战役" />
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-text-dim">
              <li>从星环外沿到核心之门，虫群沿三条完全不同的路径分章压境。</li>
              <li>每章战役都有 BOSS 压轴登场——留意简报中的红色警告波次。</li>
              <li>通关一章即可解锁下一章；每波结束的金币奖励，是撑到终局的命脉。</li>
            </ul>
          </div>
        </motion.div>
      </section>

      {/* ============ S3 战绩速览 ============ */}
      <section className="relative mx-auto max-w-6xl px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <SectionTitle en="Combat Record" zh="战绩速览" />
          {stats.games === 0 ? (
            <PanelCard className="mt-6 p-8 text-center">
              <p className="text-sm text-text-dim">暂无战绩——完成第一场防御吧</p>
              <div className="mt-5 flex justify-center">
                <NeonButton onClick={() => setLevelSelectOpen(true)}>
                  ▶ 开始防御
                </NeonButton>
              </div>
            </PanelCard>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatChip
                icon={<img src="/icon-wave.svg" alt="" className="h-6 w-6" />}
                label="最高波次"
                value={<CountUp to={stats.bestWave} />}
              />
              <StatChip
                icon={<img src="/icon-target.svg" alt="" className="h-6 w-6" />}
                label="总击杀"
                value={<CountUp to={stats.kills} />}
              />
              <StatChip
                icon={<img src="/icon-trophy.svg" alt="" className="h-6 w-6" />}
                label="胜场"
                value={<CountUp to={stats.wins} />}
              />
              <StatChip
                icon={<img src="/icon-gear.svg" alt="" className="h-6 w-6" />}
                label="已解锁成就"
                value={<CountUp to={unlockedCount} />}
              />
            </div>
          )}
        </motion.div>
      </section>

      <LevelSelect open={levelSelectOpen} onClose={() => setLevelSelectOpen(false)} />
    </div>
  );
}
