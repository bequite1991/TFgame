// 战役关卡 —— 三章剧情战役：路径 / 基地 / 波次 / 简报（design.md §设定）
import type { WaveDef } from './config';

export interface LevelDef {
  id: number;
  name: string;
  sub: string; // 副标题（战区定位）
  briefing: string[]; // 出击前剧情简报
  epilogue: string; // 通关结语
  /** 路径数组：每条路径是一串网格点，从屏幕边缘入屏、底部出屏；多路径允许共享后缀（合流） */
  paths: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
  waves: WaveDef[];
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: '星环外沿',
    sub: '外围防御带 · 第一道防线',
    briefing: [
      '2242 年，星环殖民地历第 41 个轨道周期。湮灭虫群撕开了柯伊伯外环的预警网，先锋生物群正直扑殖民地外沿防御带。',
      '你是外沿防线的指挥官。工程部已在路径两侧清空建造位，四座炮塔系统全部解锁，弹药与能源无限——代价是，我们没有退路。',
      '挡住全部进攻，外沿护盾就能完成重启。指挥官，殖民地在你身后。',
    ],
    epilogue:
      '外沿防御带守住了。虫群残部退入碎石带，但深空雷达显示，它们的主力正绕道熔岩回廊——那里的地热井是殖民地的供血线。休整结束，指挥官，我们回廊见。',
    paths: [
      [[-1, 2], [6, 2], [6, 6], [2, 6], [2, 10], [7, 10], [7, 13], [4, 13], [4, 15], [4, 16]],
    ],
    waves: [
      {
        wave: 1, groups: [{ type: 'crawler', count: 8, interval: 1.2 }], bonus: 40, isBoss: false,
        comm: '指挥官，虫群先锋已进入外沿轨道。部署防御塔，挡住它们！',
      },
      { wave: 2, groups: [{ type: 'crawler', count: 12, interval: 1.0 }], bonus: 50, isBoss: false },
      {
        wave: 3,
        groups: [
          { type: 'crawler', count: 8, interval: 1.0 },
          { type: 'speeder', count: 4, interval: 0.7 },
        ],
        bonus: 60, isBoss: false,
        comm: '侦测到高速单位混编——迅捷兽惧怕减速力场。',
      },
      { wave: 4, groups: [{ type: 'speeder', count: 12, interval: 0.6 }], bonus: 70, isBoss: false },
      {
        wave: 5,
        groups: [
          { type: 'crawler', count: 10, interval: 0.9 },
          { type: 'tanker', count: 2, interval: 1.0 },
        ],
        bonus: 90, isBoss: false,
        comm: '重型甲壳单位接近，激光对其效果有限，建议导弹与电磁炮。',
      },
      {
        wave: 6,
        groups: [
          { type: 'splitter', count: 6, interval: 0.8 },
          { type: 'speeder', count: 6, interval: 0.8 },
        ],
        bonus: 100, isBoss: false,
      },
      {
        wave: 7,
        groups: [
          { type: 'tanker', count: 5, interval: 0.8 },
          { type: 'crawler', count: 8, interval: 0.8 },
        ],
        bonus: 110, isBoss: false,
      },
      {
        wave: 8,
        groups: [
          { type: 'lurker', count: 8, interval: 0.7 },
          { type: 'speeder', count: 6, interval: 0.7 },
        ],
        bonus: 120, isBoss: false,
        comm: '注意：隐匿者信号时隐时现，电磁炮的贯穿光束可无视隐身。',
      },
      {
        wave: 9,
        groups: [
          { type: 'splitter', count: 8, interval: 0.7 },
          { type: 'tanker', count: 4, interval: 0.7 },
        ],
        bonus: 140, isBoss: false,
      },
      {
        wave: 10,
        groups: [
          { type: 'boss', count: 1, interval: 1.5, hpOverride: 4000, rewardOverride: 300 },
          { type: 'crawler', count: 6, interval: 1.5 },
        ],
        bonus: 200, isBoss: true,
        comm: '警告：湮灭巨兽接近星环外沿！全体火力自由射击！',
      },
      {
        wave: 11,
        groups: [
          { type: 'lurker', count: 10, interval: 0.6 },
          { type: 'splitter', count: 6, interval: 0.6 },
        ],
        bonus: 160, isBoss: false,
      },
      {
        wave: 12,
        groups: [
          { type: 'tanker', count: 8, interval: 0.6 },
          { type: 'speeder', count: 10, interval: 0.6 },
        ],
        bonus: 180, isBoss: false,
        comm: '虫群正在孤注一掷。指挥官，稳住阵线。',
      },
      {
        wave: 13,
        groups: [
          { type: 'crawler', count: 6, interval: 0.5 },
          { type: 'speeder', count: 6, interval: 0.5 },
          { type: 'tanker', count: 4, interval: 0.5 },
          { type: 'splitter', count: 3, interval: 0.5 },
          { type: 'lurker', count: 3, interval: 0.5 },
        ],
        bonus: 200, isBoss: false,
      },
      {
        wave: 14,
        groups: [
          { type: 'tanker', count: 6, interval: 0.5 },
          { type: 'lurker', count: 8, interval: 0.5 },
          { type: 'splitter', count: 8, interval: 0.5 },
        ],
        bonus: 240, isBoss: false,
      },
      {
        wave: 15,
        groups: [
          { type: 'boss', count: 1, interval: 0.8, hpOverride: 12000, rewardOverride: 1000 },
          { type: 'speeder', count: 10, interval: 0.8 },
        ],
        bonus: 500, isBoss: true,
        comm: '最终警告：巨兽母体亲自压阵。为了殖民地，开火！',
      },
    ],
  },
  {
    id: 2,
    name: '熔岩回廊',
    sub: '地热井区 · 第二道防线',
    briefing: [
      '虫群主力绕过了外沿，钻进殖民地的地热采掘回廊。侦察确认：虫群兵分两路，沿上下两条岩脊同时渗入，将在回廊中段汇合，直扑地热井。',
      '这里的虫群更加狡猾：分裂体与隐匿者的比例显著上升。情报部提醒：把火力压在合流点之前，务必在回廊深处解决分裂体，否则幼体将直接落在基地门前。',
      '守住地热井区。殖民地的能源命脉，就在你炮火的尽头。',
    ],
    epilogue:
      '地热井区的战斗结束了。回廊之主倒在熔岩河畔，虫群残兵退向星环核心。所有线索都指向同一个坐标——核心之门。全体登舰，决战的时刻到了。',
    // Y 形合流：北路（A）与南路（B）在 (4,8) 汇合，共享后缀直抵底部出口
    paths: [
      [[-1, 2], [6, 2], [6, 5], [4, 5], [4, 8], [7, 8], [7, 12], [5, 12], [5, 14], [4, 14], [4, 16]],
      [[-1, 13], [2, 13], [2, 8], [4, 8], [7, 8], [7, 12], [5, 12], [5, 14], [4, 14], [4, 16]],
    ],
    waves: [
      {
        wave: 1, groups: [{ type: 'crawler', count: 9, interval: 1.1, path: 0 }], bonus: 40, isBoss: false,
        comm: '侦测到两路虫群信号——北路岩脊先接敌。指挥官，双线布防开始了。',
      },
      {
        wave: 2,
        groups: [
          { type: 'crawler', count: 6, interval: 1.0, path: 1 },
          { type: 'speeder', count: 4, interval: 0.9, path: 1 },
        ],
        bonus: 55, isBoss: false,
        comm: '南路岩脊遇袭！别让它放空。',
      },
      {
        wave: 3,
        groups: [
          { type: 'splitter', count: 4, interval: 0.8 },
          { type: 'crawler', count: 6, interval: 0.9 },
        ],
        bonus: 60, isBoss: false,
      },
      {
        wave: 4,
        groups: [
          { type: 'lurker', count: 5, interval: 0.7 },
          { type: 'speeder', count: 6, interval: 0.7 },
        ],
        bonus: 70, isBoss: false,
        comm: '回廊热雾干扰雷达，隐匿者正在渗透。电磁炮就位。',
      },
      {
        wave: 5,
        groups: [
          { type: 'splitter', count: 7, interval: 0.7 },
          { type: 'tanker', count: 2, interval: 0.9 },
        ],
        bonus: 100, isBoss: false,
        comm: '分裂体集群逼近——务必在合流点之前将其击杀。',
      },
      {
        wave: 6,
        groups: [
          { type: 'lurker', count: 7, interval: 0.6, path: 1 },
          { type: 'splitter', count: 4, interval: 0.7, path: 0 },
        ],
        bonus: 110, isBoss: false,
      },
      {
        wave: 7,
        groups: [
          { type: 'tanker', count: 5, interval: 0.7 },
          { type: 'lurker', count: 5, interval: 0.6 },
        ],
        bonus: 120, isBoss: false,
      },
      {
        wave: 8,
        groups: [
          { type: 'boss', count: 1, interval: 1.2, hpOverride: 3800, rewardOverride: 400, path: 0 },
          { type: 'splitter', count: 5, interval: 1.2, path: 1 },
        ],
        bonus: 240, isBoss: true,
        comm: '警告：熔岩深处有巨兽苏醒，正沿北路推进——南路同时出现分裂体群！',
      },
      {
        wave: 9,
        groups: [
          { type: 'splitter', count: 9, interval: 0.6 },
          { type: 'speeder', count: 7, interval: 0.6 },
        ],
        bonus: 160, isBoss: false,
      },
      {
        wave: 10,
        groups: [
          { type: 'lurker', count: 10, interval: 0.5 },
          { type: 'tanker', count: 4, interval: 0.7 },
        ],
        bonus: 190, isBoss: false,
      },
      {
        wave: 11,
        groups: [
          { type: 'splitter', count: 7, interval: 0.5 },
          { type: 'lurker', count: 7, interval: 0.5 },
          { type: 'speeder', count: 5, interval: 0.5 },
        ],
        bonus: 230, isBoss: false,
      },
      {
        wave: 12,
        groups: [
          { type: 'boss', count: 1, interval: 0.8, hpOverride: 10000, rewardOverride: 1000, path: 1 },
          { type: 'lurker', count: 7, interval: 0.8, path: 0 },
        ],
        bonus: 550, isBoss: true,
        comm: '回廊之主现身南路。这是回廊最后一战——倾尽所有火力！',
      },
    ],
  },
  {
    id: 3,
    name: '核心之门',
    sub: '能源中枢 · 最终防线',
    briefing: [
      '核心之门——星环殖民地的能源中枢，湮灭虫群最后的目标。虫群正沿东西两条维修栈道同时进攻，各自直取一座能量门——两座门后都是核心。',
      '情报确认：湮灭母体将亲临战场。它的生物装甲厚度远超此前任何个体，唯有满级电磁炮的贯穿光束可以撕开缺口。',
      '守住这最后的波次，2242 年的战争就将终结。指挥官，全殖民地都在看着你。开火许可：无限制。',
    ],
    epilogue:
      '湮灭母体在核心之门前轰然解体，虫群信号从深空雷达上逐一熄灭。殖民地在欢呼提交了终战报告——但当晚，深空雷达在柯伊伯带之外捕捉到了一片此前不存在的巨大引力源：一颗直径超过殖民地的移动天体，正拖着整片虫群云向星环回流。战争没有结束。这只是开始。',
    // 分流：西路（A，左进左出）与东路（B，右进右出）互不接触，各守一座能量门
    paths: [
      [[-1, 2], [4, 2], [4, 5], [1, 5], [1, 9], [3, 9], [3, 12], [1, 12], [1, 14], [2, 14], [2, 16]],
      [[9, 2], [5, 2], [5, 4], [7, 4], [7, 7], [5, 7], [5, 10], [7, 10], [7, 13], [6, 13], [6, 16]],
    ],
    waves: [
      {
        wave: 1, groups: [{ type: 'crawler', count: 9, interval: 1.1, path: 0 }], bonus: 40, isBoss: false,
        comm: '两座能量门同时告急——西侧栈道先接敌。双线布防，指挥官！',
      },
      {
        wave: 2,
        groups: [
          { type: 'crawler', count: 9, interval: 1.0, path: 1 },
          { type: 'speeder', count: 4, interval: 0.7, path: 1 },
        ],
        bonus: 55, isBoss: false,
      },
      { wave: 3, groups: [{ type: 'speeder', count: 11, interval: 0.6 }], bonus: 65, isBoss: false },
      {
        wave: 4,
        groups: [
          { type: 'crawler', count: 9, interval: 0.9 },
          { type: 'tanker', count: 3, interval: 1.0 },
        ],
        bonus: 80, isBoss: false,
      },
      {
        wave: 5,
        groups: [
          { type: 'splitter', count: 5, interval: 0.8 },
          { type: 'speeder', count: 5, interval: 0.7 },
        ],
        bonus: 100, isBoss: false,
        comm: '敌编队密度持续上升，建议补齐减速与溅射火力。',
      },
      {
        wave: 6,
        groups: [
          { type: 'tanker', count: 4, interval: 0.8, path: 0 },
          { type: 'crawler', count: 6, interval: 0.8, path: 1 },
        ],
        bonus: 110, isBoss: false,
      },
      {
        wave: 7,
        groups: [
          { type: 'lurker', count: 7, interval: 0.7 },
          { type: 'speeder', count: 5, interval: 0.7 },
        ],
        bonus: 120, isBoss: false,
      },
      {
        wave: 8,
        groups: [
          { type: 'splitter', count: 7, interval: 0.7 },
          { type: 'tanker', count: 3, interval: 0.7 },
        ],
        bonus: 135, isBoss: false,
      },
      {
        wave: 9,
        groups: [
          { type: 'lurker', count: 8, interval: 0.6 },
          { type: 'splitter', count: 5, interval: 0.6 },
        ],
        bonus: 155, isBoss: false,
      },
      {
        wave: 10,
        groups: [
          { type: 'boss', count: 1, interval: 1.2, hpOverride: 3200, rewardOverride: 400, path: 0 },
          { type: 'tanker', count: 4, interval: 1.2, path: 1 },
        ],
        bonus: 260, isBoss: true,
        comm: '警告：门卫巨兽突破西侧栈道！东侧同时告急，绝不能让它接近能量门！',
      },
      {
        wave: 11,
        groups: [
          { type: 'tanker', count: 6, interval: 0.6 },
          { type: 'speeder', count: 7, interval: 0.6 },
        ],
        bonus: 190, isBoss: false,
      },
      {
        wave: 12,
        groups: [
          { type: 'lurker', count: 9, interval: 0.5 },
          { type: 'splitter', count: 6, interval: 0.5 },
        ],
        bonus: 210, isBoss: false,
      },
      {
        wave: 13,
        groups: [
          { type: 'crawler', count: 6, interval: 0.5 },
          { type: 'speeder', count: 6, interval: 0.5 },
          { type: 'tanker', count: 4, interval: 0.5 },
          { type: 'splitter', count: 3, interval: 0.5 },
          { type: 'lurker', count: 3, interval: 0.5 },
        ],
        bonus: 230, isBoss: false,
        comm: '核心护盾剩余能量不足 30%。指挥官，时间不多了。',
      },
      {
        wave: 14,
        groups: [
          { type: 'tanker', count: 5, interval: 0.5 },
          { type: 'lurker', count: 7, interval: 0.5 },
          { type: 'splitter', count: 7, interval: 0.5 },
        ],
        bonus: 270, isBoss: false,
      },
      {
        wave: 15,
        groups: [
          { type: 'boss', count: 1, interval: 0.8, hpOverride: 9500, rewardOverride: 1200, path: 1 },
          { type: 'speeder', count: 8, interval: 0.7, path: 0 },
          { type: 'lurker', count: 5, interval: 0.8, path: 1 },
        ],
        bonus: 650, isBoss: true,
        comm: '湮灭母体从东侧栈道亲临战场。全体注意——这是 2242 年的最后一战，开火！',
      },
    ],
  },
];

// ---------------- 第二季：湮灭回流（第 4-13 章） ----------------

LEVELS.push(
  {
    id: 4,
    name: '陨石坟场',
    sub: '碎石带前哨 · 新威胁坠洼点',
    briefing: [
      '深空雷达确认：柯伊伯带外的引力源是一颗尚未编号的巨型生物天体——工程部临时编号「虫巢」。而它的先锋，正借着陨石流的掩护坠入碎石带。',
      '陨石坟场是碎石带唯一可以架设炮位的洼地。指挥官，工程部已经连夜清出建造位——虫群先锋落地的地方，就是第一战场。',
      '本次作战将启用新列装的「战术模块」系统：每守住一波，军械部都会随机送来三份科技方案，由你决定防线的进化方向。',
    ],
    epilogue:
      '陨石坟场的坠落点被清空了。虫群先锋的残骸证明了我们的担心：它们不再是无序兽潮，而是有组织地在「虫巢」周围集结。扫描出下一处集结地震感——静默海岭。',
    paths: [
      [[-1, 1], [3, 1], [3, 4], [6, 4], [6, 8], [3, 8], [3, 11], [5, 11], [5, 15], [4, 15], [4, 16]],
    ],
    waves: [
      {
        wave: 1, groups: [{ type: 'crawler', count: 8, interval: 1.1 }], bonus: 45, isBoss: false,
        comm: '战术模块系统上线。守住这一波，军械部就送来第一份科技方案。',
      },
      {
        wave: 2,
        groups: [
          { type: 'crawler', count: 8, interval: 1.0 },
          { type: 'speeder', count: 4, interval: 0.8 },
        ],
        bonus: 55, isBoss: false,
      },
      {
        wave: 3,
        groups: [
          { type: 'splitter', count: 5, interval: 0.9 },
          { type: 'crawler', count: 6, interval: 0.9 },
        ],
        bonus: 65, isBoss: false,
      },
      {
        wave: 4,
        groups: [
          { type: 'speeder', count: 10, interval: 0.6 },
          { type: 'tanker', count: 2, interval: 1.1 },
        ],
        bonus: 75, isBoss: false,
      },
      {
        wave: 5,
        groups: [
          { type: 'splitter', count: 8, interval: 0.7 },
          { type: 'lurker', count: 5, interval: 0.7 },
        ],
        bonus: 95, isBoss: false,
        comm: '热雾里全是隐匿者信号。电磁炮务必就位。',
      },
      {
        wave: 6,
        groups: [
          { type: 'boss', count: 1, interval: 1.2, hpOverride: 5000, rewardOverride: 500 },
          { type: 'crawler', count: 10, interval: 1.0 },
        ],
        bonus: 260, isBoss: true,
        comm: '警告：陨石流里夹着一只巨兽——先锋巨兽直扑坟场洼地！',
      },
      {
        wave: 7,
        groups: [
          { type: 'tanker', count: 6, interval: 0.7 },
          { type: 'speeder', count: 10, interval: 0.6 },
        ],
        bonus: 120, isBoss: false,
      },
      {
        wave: 8,
        groups: [
          { type: 'splitter', count: 10, interval: 0.6 },
          { type: 'lurker', count: 8, interval: 0.6 },
        ],
        bonus: 140, isBoss: false,
      },
      {
        wave: 9,
        groups: [
          { type: 'crawler', count: 14, interval: 0.5 },
          { type: 'speeder', count: 10, interval: 0.5 },
          { type: 'tanker', count: 5, interval: 0.8 },
        ],
        bonus: 160, isBoss: false,
      },
      {
        wave: 10,
        groups: [
          { type: 'lurker', count: 12, interval: 0.5 },
          { type: 'splitter', count: 8, interval: 0.5 },
        ],
        bonus: 180, isBoss: false,
      },
      {
        wave: 11,
        groups: [
          { type: 'tanker', count: 9, interval: 0.55 },
          { type: 'splitter', count: 8, interval: 0.5 },
          { type: 'speeder', count: 8, interval: 0.45 },
        ],
        bonus: 220, isBoss: false,
        comm: '坟场防线的最后时刻。指挥官，弹药随便打!',
      },
      {
        wave: 12,
        groups: [
          { type: 'boss', count: 1, interval: 0.8, hpOverride: 14000, rewardOverride: 1100 },
          { type: 'crawler', count: 12, interval: 0.7 },
          { type: 'speeder', count: 8, interval: 0.6 },
        ],
        bonus: 520, isBoss: true,
        comm: '墓碑巨兽压阵而来——为了下一道防线，全火力开动！',
      },
    ],
  },
  {
    id: 5,
    name: '静默海岭',
    sub: '冰岩高地 · 双脊夹缝',
    briefing: [
      '静默海岭是条被冰岩覆盖的裂谷，虫群沿着南、北两脊同时渗入，在谷腰汇合后直插殖民地中继站。',
      '轨道扫描显示：虫群这回学乖了——隐匿者的渗透比例翻倍，且两脊之间有「回声廊道」联通，漏掉一脊就会腹背受敌。',
      '中继站是整条碎石带防线的通讯命脉。守住它，我们才有资格谈进攻。',
    ],
    epilogue:
      '双脊阵地守住了。中继站恢复通讯后传来的第一条消息是：碎石带枢纽的虫群正在暴动，规模远超先锋——它们在为「虫巢」的抵达铺路。',
    paths: [
      [[-1, 3], [5, 3], [5, 6], [2, 6], [2, 10], [5, 10], [5, 13], [3, 13], [3, 16]],
      [[9, 5], [4, 5], [4, 8], [2, 8], [2, 10], [5, 10], [5, 13], [3, 13], [3, 16]],
    ],
    waves: [
      {
        wave: 1, groups: [{ type: 'crawler', count: 8, interval: 1.1, path: 0 }], bonus: 45, isBoss: false,
        comm: '北脊先接敌。南脊随时可能出事——双线布防，指挥官！',
      },
      {
        wave: 2,
        groups: [
          { type: 'crawler', count: 6, interval: 1.0, path: 1 },
          { type: 'speeder', count: 4, interval: 0.8, path: 1 },
        ],
        bonus: 55, isBoss: false,
        comm: '南脊告急！别把火力全压在北面。',
      },
      {
        wave: 3,
        groups: [
          { type: 'splitter', count: 5, interval: 0.9 },
          { type: 'lurker', count: 3, interval: 0.8 },
        ],
        bonus: 70, isBoss: false,
      },
      {
        wave: 4,
        groups: [
          { type: 'tanker', count: 4, interval: 0.9, path: 0 },
          { type: 'crawler', count: 8, interval: 0.8, path: 1 },
        ],
        bonus: 80, isBoss: false,
      },
      {
        wave: 5,
        groups: [
          { type: 'lurker', count: 8, interval: 0.55 },
          { type: 'speeder', count: 10, interval: 0.55 },
        ],
        bonus: 100, isBoss: false,
      },
      {
        wave: 6,
        groups: [
          { type: 'boss', count: 1, interval: 1.0, hpOverride: 6500, rewardOverride: 600, path: 1 },
          { type: 'splitter', count: 6, interval: 0.9, path: 0 },
        ],
        bonus: 280, isBoss: true,
        comm: '南脊裂谷里爬出一只巨兽——回声廊道也在渗水，稳住！',
      },
      {
        wave: 7,
        groups: [
          { type: 'splitter', count: 9, interval: 0.6 },
          { type: 'tanker', count: 4, interval: 0.8 },
        ],
        bonus: 130, isBoss: false,
      },
      {
        wave: 8,
        groups: [
          { type: 'lurker', count: 10, interval: 0.5, path: 0 },
          { type: 'speeder', count: 12, interval: 0.5, path: 1 },
        ],
        bonus: 150, isBoss: false,
      },
      {
        wave: 9,
        groups: [
          { type: 'tanker', count: 7, interval: 0.6 },
          { type: 'lurker', count: 8, interval: 0.5 },
        ],
        bonus: 170, isBoss: false,
      },
      {
        wave: 10,
        groups: [
          { type: 'splitter', count: 10, interval: 0.5 },
          { type: 'speeder', count: 10, interval: 0.45 },
          { type: 'crawler', count: 12, interval: 0.45 },
        ],
        bonus: 200, isBoss: false,
      },
      {
        wave: 11,
        groups: [
          { type: 'lurker', count: 12, interval: 0.45 },
          { type: 'tanker', count: 5, interval: 0.7 },
          { type: 'splitter', count: 7, interval: 0.5 },
        ],
        bonus: 240, isBoss: false,
        comm: '海岭最后防线。-module 科技的含金量，就看这几波了。',
      },
      {
        wave: 12,
        groups: [
          { type: 'boss', count: 1, interval: 0.8, hpOverride: 16000, rewardOverride: 1200, path: 0 },
          { type: 'lurker', count: 8, interval: 0.6, path: 1 },
          { type: 'speeder', count: 10, interval: 0.55, path: 1 },
        ],
        bonus: 560, isBoss: true,
        comm: '「回声之主」从北脊现身。集火！别让它过去！',
      },
    ],
  },
  {
    id: 6,
    name: '碎石带枢纽',
    sub: '补给中枢 · 三线交战',
    briefing: [
      '虫群对碎石带枢纽发动总攻。三条引力滑道同时向枢纽倾泻兵力：东、西两斜 bylo 主攻，北直道为策应。',
      '情报部判断：这是虫巢抵达前最大规模的一次「清场作战」。守住枢纽，虫巢就被迫在没有补给区的情况下硬闯防线。',
      '三条滑道，一个枢纽。指挥官，分配好你的每一座炮塔.',
    ],
    epilogue:
      '枢纽守住了，三条滑道的虫群几乎全灭。但无人机在北直道尽头拍到了不得了的东西：一条泛着幽光的「裂缝」，正把虫群源源不断地吐进碎石带——那不是自然天体，那是虫巢的大门。',
    paths: [
      [[9, 1], [5, 1], [5, 5], [7, 5], [7, 10], [5, 10], [5, 14], [4, 14], [4, 16]],
      [[-1, 2], [3, 2], [3, 6], [1, 6], [1, 11], [3, 11], [3, 14], [4, 14], [4, 16]],
      [[4, -1], [4, 4], [2, 4], [2, 9], [4, 9], [4, 12], [5, 12], [5, 14], [4, 14], [4, 16]],
    ],
    waves: [
      {
        wave: 1, groups: [{ type: 'crawler', count: 8, interval: 1.1, path: 2 }], bonus: 45, isBoss: false,
      comm: '三线布防开始。北直道的滑道最短——先给那边压上一座塔！',
      },
      {
        wave: 2,
        groups: [
          { type: 'crawler', count: 6, interval: 1.0, path: 0 },
          { type: 'speeder', count: 4, interval: 0.8, path: 1 },
        ],
        bonus: 55, isBoss: false,
      },
      {
        wave: 3,
        groups: [
          { type: 'speeder', count: 8, interval: 0.7 },
          { type: 'splitter', count: 3, interval: 0.9, path: 2 },
        ],
        bonus: 70, isBoss: false,
      },
      {
        wave: 4,
        groups: [
          { type: 'tanker', count: 3, interval: 1.1, path: 0 },
          { type: 'crawler', count: 8, interval: 0.8, path: 1 },
          { type: 'lurker', count: 3, interval: 0.8, path: 2 },
        ],
        bonus: 85, isBoss: false,
      },
      {
        wave: 5,
        groups: [
          { type: 'splitter', count: 8, interval: 0.6 },
          { type: 'lurker', count: 6, interval: 0.55 },
        ],
        bonus: 105, isBoss: false,
      },
      {
        wave: 6,
        groups: [
          { type: 'boss', count: 1, interval: 1.0, hpOverride: 8000, rewardOverride: 700, path: 1 },
          { type: 'speeder', count: 8, interval: 0.7, path: 0 },
        ],
        bonus: 300, isBoss: true,
        comm: '西斜坡出现巨兽！它就是来「清场」的——别让枢纽沦陷！',
      },
      {
        wave: 7,
        groups: [
          { type: 'tanker', count: 7, interval: 0.6 },
          { type: 'lurker', count: 6, interval: 0.55, path: 2 },
        ],
        bonus: 140, isBoss: false,
      },
      {
        wave: 8,
        groups: [
          { type: 'splitter', count: 10, interval: 0.5 },
          { type: 'speeder', count: 12, interval: 0.5 },
        ],
        bonus: 160, isBoss: false,
      },
      {
        wave: 9,
        groups: [
          { type: 'tanker', count: 6, interval: 0.6, path: 0 },
          { type: 'tanker', count: 4, interval: 0.7, path: 1 },
          { type: 'lurker', count: 8, interval: 0.5, path: 2 },
        ],
        bonus: 190, isBoss: false,
      },
      {
        wave: 10,
        groups: [
          { type: 'crawler', count: 18, interval: 0.35 },
          { type: 'speeder', count: 14, interval: 0.35 },
        ],
        bonus: 220, isBoss: false,
        comm: '兽潮总攻！全滑道满负荷运转!',
      },
      {
        wave: 11,
        groups: [
          { type: 'splitter', count: 12, interval: 0.45 },
          { type: 'lurker', count: 10, interval: 0.45 },
          { type: 'tanker', count: 6, interval: 0.6 },
        ],
        bonus: 260, isBoss: false,
      },
      {
        wave: 12,
        groups: [
          { type: 'boss', count: 1, interval: 0.8, hpOverride: 17000, rewardOverride: 1300, path: 2 },
          { type: 'splitter', count: 8, interval: 0.55, path: 0 },
          { type: 'lurker', count: 8, interval: 0.55, path: 1 },
        ],
        bonus: 600, isBoss: true,
        comm: '枢纽绞肉机最后的吼声——巨兽走了最短的北直道！集火！集火！',
      },
    ],
  },
  {
    id: 7,
    name: '深渊裂缝',
    sub: '裂谷警戒线 · 第一道虫洞',
    briefing: [
      '碎石带尽头的裂缝被证实是一条稳定虫洞——虫群从深渊方向源源涌出。裂缝两侧的岩架是我们最后的警戒线。',
      '裂缝喷发的波段有规律：每次都在中路与侧翼间摇摆。轨道扫描显示裂缝深处有「大型个体」正在膨化成形。',
      '第七防线，警戒完成。指挥官，欢迎来到虫洞的门口。',
    ],
    epilogue:
      '警戒线的任务完成了。裂缝被临时工兵炸塌，深处的「膨化个体」没能钻出来——但雷达显示另一条裂缝已经在极地冰盖下张开。它们不再需要一个虫巢才能行军了。',
    paths: [
      [[-1, 2], [6, 2], [6, 6], [3, 6], [3, 10], [6, 10], [6, 13], [4, 13], [4, 16]],
      [[9, 12], [7, 12], [7, 8], [3, 8], [3, 10], [6, 10], [6, 13], [4, 13], [4, 16]],
    ],
    waves: [
      {
        wave: 1, groups: [{ type: 'crawler', count: 9, interval: 1.0, path: 0 }], bonus: 45, isBoss: false,
        comm: '裂缝开始喷发！中路先顶住，工兵在侧翼布置第二道封锁。',
      },
      {
        wave: 2,
        groups: [
          { type: 'speeder', count: 8, interval: 0.7, path: 1 },
          { type: 'crawler', count: 8, interval: 0.9, path: 1 },
        ],
        bonus: 55, isBoss: false,
      },
      {
        wave: 3,
        groups: [
          { type: 'splitter', count: 6, interval: 0.8 },
          { type: 'tanker', count: 3, interval: 1.0 },
        ],
        bonus: 70, isBoss: false,
      },
      {
        wave: 4,
        groups: [
          { type: 'lurker', count: 6, interval: 0.6, path: 0 },
          { type: 'speeder', count: 8, interval: 0.6, path: 1 },
        ],
        bonus: 85, isBoss: false,
      },
      {
        wave: 5,
        groups: [
          { type: 'crawler', count: 16, interval: 0.45 },
          { type: 'speeder', count: 8, interval: 0.5 },
          { type: 'tanker', count: 4, interval: 0.7 },
        ],
        bonus: 110, isBoss: false,
      },
      {
        wave: 6,
        groups: [{ type: 'boss', count: 1, interval: 1.0, hpOverride: 9500, rewardOverride: 800 }],
        bonus: 300, isBoss: true,
        comm: '深处的「膨化个体」成形了——深渊恐贪者！别让它靠近岩架！',
      },
      {
        wave: 7,
        groups: [
          { type: 'splitter', count: 11, interval: 0.5 },
          { type: 'lurker', count: 8, interval: 0.5, path: 1 },
        ],
        bonus: 150, isBoss: false,
      },
      {
        wave: 8,
        groups: [
          { type: 'tanker', count: 7, interval: 0.55 },
          { type: 'speeder', count: 14, interval: 0.45 },
        ],
        bonus: 180, isBoss: false,
      },
      {
        wave: 9,
        groups: [
          { type: 'lurker', count: 10, interval: 0.45 },
          { type: 'splitter', count: 10, interval: 0.45 },
          { type: 'crawler', count: 14, interval: 0.4 },
        ],
        bonus: 210, isBoss: false,
      },
      {
        wave: 10,
        groups: [
          { type: 'tanker', count: 9, interval: 0.5 },
          { type: 'splitter', count: 8, interval: 0.45, path: 1 },
        ],
        bonus: 240, isBoss: false,
      },
      {
        wave: 11,
        groups: [
          { type: 'lurker', count: 12, interval: 0.4 },
          { type: 'speeder', count: 14, interval: 0.4 },
          { type: 'tanker', count: 6, interval: 0.55 },
        ],
        bonus: 270, isBoss: false,
      },
      {
        wave: 12,
        groups: [
          { type: 'boss', count: 1, interval: 0.8, hpOverride: 19000, rewardOverride: 1400, path: 0 },
          { type: 'crawler', count: 14, interval: 0.55, path: 1 },
          { type: 'lurker', count: 8, interval: 0.5, path: 1 },
        ],
        bonus: 620, isBoss: true,
        comm: '裂缝主兽「噬岩者」钻出了喷口！全线集火，别让它翻过岩架！',
      },
    ],
  },
  {
    id: 8,
    name: '极夜哨站',
    sub: '冰盖驻点 · 极地裂缝防线',
    briefing: [
      '冰盖下的第二条裂缝比预想的更成熟：喷发波已经稳定，虫群以极夜为掩护，一波接一波地涌向哨站。',
      '哨站的下方就是殖民地的水源冰芯——虫群的生物酸液一旦渗透冰层，整个殖民地的水循环将在 72 小时内崩坏。',
      '没有退路，没有增援，只有满地冰晶与你的炮塔。守住极夜。',
    ],
    epilogue:
      '冰芯保住了。裂缝被密度炸弹封堵，但代价是整个哨站冻土翻搅、急需撤退。下一站：虫巢外围——工兵说，那地方的空气都带着腥味。',
    paths: [
      [[-1, 1], [2, 1], [2, 5], [5, 5], [5, 9], [2, 9], [2, 12], [4, 12], [4, 16]],
      [[9, 2], [7, 2], [7, 7], [5, 7], [5, 9], [2, 9], [2, 12], [4, 12], [4, 16]],
    ],
    waves: [
      {
        wave: 1, groups: [{ type: 'crawler', count: 9, interval: 1.0, path: 0 }], bonus: 45, isBoss: false,
      },
      {
        wave: 2,
        groups: [
          { type: 'crawler', count: 8, interval: 0.9, path: 1 },
          { type: 'speeder', count: 6, interval: 0.7, path: 1 },
        ],
        bonus: 55, isBoss: false,
      },
      {
        wave: 3,
        groups: [
          { type: 'splitter', count: 7, interval: 0.75 },
          { type: 'speeder', count: 8, interval: 0.6 },
        ],
        bonus: 70, isBoss: false,
      },
      {
        wave: 4,
        groups: [
          { type: 'tanker', count: 4, interval: 0.9, path: 0 },
          { type: 'lurker', count: 6, interval: 0.6, path: 1 },
        ],
        bonus: 90, isBoss: false,
        comm: '冰面开始渗酸——虫群的生物酸弹先于主力抵达。',
      },
      {
        wave: 5,
        groups: [
          { type: 'lurker', count: 9, interval: 0.5 },
          { type: 'splitter', count: 8, interval: 0.5, path: 1 },
        ],
        bonus: 110, isBoss: false,
      },
      {
        wave: 6,
        groups: [
          { type: 'boss', count: 1, interval: 1.0, hpOverride: 11000, rewardOverride: 900, path: 0 },
          { type: 'speeder', count: 10, interval: 0.5, path: 1 },
        ],
        bonus: 300, isBoss: true,
        comm: '「极夜暴君」踏碎了前台冰架！守住冰芯，它不能过来！',
      },
      {
        wave: 7,
        groups: [
          { type: 'tanker', count: 8, interval: 0.5 },
          { type: 'crawler', count: 16, interval: 0.4 },
        ],
        bonus: 150, isBoss: false,
      },
      {
        wave: 8,
        groups: [
          { type: 'splitter', count: 12, interval: 0.45 },
          { type: 'lurker', count: 10, interval: 0.45, path: 1 },
        ],
        bonus: 180, isBoss: false,
      },
      {
        wave: 9,
        groups: [
          { type: 'speeder', count: 16, interval: 0.35 },
          { type: 'tanker', count: 5, interval: 0.6 },
          { type: 'splitter', count: 8, interval: 0.5 },
        ],
        bonus: 210, isBoss: false,
      },
      {
        wave: 10,
        groups: [
          { type: 'lurker', count: 12, interval: 0.4 },
          { type: 'tanker', count: 7, interval: 0.5 },
        ],
        bonus: 240, isBoss: false,
      },
      {
        wave: 11,
        groups: [
          { type: 'splitter', count: 14, interval: 0.4 },
          { type: 'lurker', count: 12, interval: 0.4 },
          { type: 'speeder', count: 14, interval: 0.35 },
        ],
        bonus: 280, isBoss: false,
      },
      {
        wave: 12,
        groups: [
          { type: 'boss', count: 1, interval: 0.8, hpOverride: 21000, rewardOverride: 1500, path: 1 },
          { type: 'tanker', count: 6, interval: 0.6, path: 0 },
          { type: 'lurker', count: 10, interval: 0.45, path: 0 },
        ],
        bonus: 640, isBoss: true,
        comm: '冰盖下的虫洞张力已经拉满——「融冰兽」亲自下场！',
      },
      {
        wave: 13,
        groups: [
          { type: 'crawler', count: 20, interval: 0.3 },
          { type: 'speeder', count: 16, interval: 0.3 },
          { type: 'tanker', count: 8, interval: 0.5 },
          { type: 'splitter', count: 10, interval: 0.4 },
          { type: 'lurker', count: 8, interval: 0.4 },
        ],
        bonus: 320, isBoss: false,
        comm: '撤退前最后一波兽潮！指挥官，把冰晶阵地变成它们的坟场！',
      },
    ],
  },
  {
    id: 9,
    name: '虫洞前哨',
    sub: '深空轨道 · 反攻桥头堡',
    briefing: [
      '我们终于打进了虫洞这一侧。哨点是虫巢外围唯一没被生物 组织污染的岩石平台，也是反攻唯一的跳板。',
      '预警：虫洞侧的虫群密度达到峰值，喷发间隔骤减。深处的牵引波越来越急——虫巢正在加速向星环回流。',
      '桥头堡的价值：守住它，殖民地的远征舰队就能在虫洞侧架设光矛阵列。丢掉它，我们就只能最后一搏了。',
    ],
    epilogue:
      '桥头堡立住了。光矛阵列的第一道光柱刺穿了虫云，给虫巢划开了一道口子。舰长广播说：虫巢外围的「皮」已经开始软了。反攻，正式开始。',
    paths: [
      [[-1, 3], [4, 3], [4, 7], [7, 7], [7, 11], [4, 11], [4, 14], [5, 14], [5, 16]],
      [[9, 7], [6, 7], [6, 10], [4, 10], [4, 14], [5, 14], [5, 16]],
    ],
    waves: [
      {
        wave: 1, groups: [{ type: 'crawler', count: 9, interval: 1.0, path: 0 }], bonus: 45, isBoss: false,
        comm: '虫洞侧的高频喷发开始了。桥头堡，架好第一排炮！',
      },
      {
        wave: 2,
        groups: [
          { type: 'crawler', count: 8, interval: 0.8, path: 1 },
          { type: 'speeder', count: 8, interval: 0.6, path: 1 },
        ],
        bonus: 55, isBoss: false,
      },
      {
        wave: 3,
        groups: [
          { type: 'splitter', count: 7, interval: 0.7 },
          { type: 'tanker', count: 3, interval: 0.9 },
        ],
        bonus: 70, isBoss: false,
      },
      {
        wave: 4,
        groups: [
          { type: 'lurker', count: 7, interval: 0.55, path: 1 },
          { type: 'speeder', count: 10, interval: 0.5, path: 0 },
        ],
        bonus: 90, isBoss: false,
      },
      {
        wave: 5,
        groups: [
          { type: 'crawler', count: 18, interval: 0.4 },
          { type: 'splitter', count: 8, interval: 0.5 },
        ],
        bonus: 115, isBoss: false,
      },
      {
        wave: 6,
        groups: [
          { type: 'boss', count: 1, interval: 1.0, hpOverride: 12500, rewardOverride: 900, path: 1 },
          { type: 'lurker', count: 8, interval: 0.5, path: 0 },
        ],
        bonus: 300, isBoss: true,
      },
      {
        wave: 7,
        groups: [
          { type: 'tanker', count: 8, interval: 0.5 },
          { type: 'splitter', count: 10, interval: 0.45 },
        ],
        bonus: 150, isBoss: false,
      },
      {
        wave: 8,
        groups: [
          { type: 'lurker', count: 11, interval: 0.45 },
          { type: 'speeder', count: 14, interval: 0.4 },
        ],
        bonus: 180, isBoss: false,
      },
      {
        wave: 9,
        groups: [
          { type: 'tanker', count: 9, interval: 0.45 },
          { type: 'splitter', count: 10, interval: 0.4, path: 1 },
          { type: 'crawler', count: 16, interval: 0.35 },
        ],
        bonus: 220, isBoss: false,
      },
      {
        wave: 10,
        groups: [
          { type: 'boss', count: 1, interval: 1.0, hpOverride: 14500, rewardOverride: 1000, path: 0 },
          { type: 'lurker', count: 10, interval: 0.4, path: 1 },
        ],
        bonus: 340, isBoss: true,
        comm: '双兽波！「裂口领主」沿主道压进——桥头堡就是为它准备的！',
      },
      {
        wave: 11,
        groups: [
          { type: 'splitter', count: 14, interval: 0.4 },
          { type: 'lurker', count: 12, interval: 0.4 },
          { type: 'speeder', count: 16, interval: 0.3 },
        ],
        bonus: 260, isBoss: false,
      },
      {
        wave: 12,
        groups: [
          { type: 'tanker', count: 12, interval: 0.4 },
          { type: 'splitter', count: 10, interval: 0.4 },
          { type: 'lurker', count: 10, interval: 0.35, path: 1 },
        ],
        bonus: 300, isBoss: false,
      },
      {
        wave: 13,
        groups: [
          { type: 'boss', count: 1, interval: 0.8, hpOverride: 24000, rewardOverride: 1600, path: 0 },
          { type: 'boss', count: 1, interval: 1.2, hpOverride: 12000, rewardOverride: 800, path: 1 },
        ],
        bonus: 700, isBoss: true,
        comm: '双巨兽同时过桥！光矛阵列由你掩护——这是最后的桥头堡战役！',
      },
    ],
  },
  {
    id: 10,
    name: '虫巢外膜',
    sub: '虫巢表层 · 登陆场开辟',
    briefing: [
      '远征舰队在虫巢外膜上炸开了一道登陆口——现在轮到地面部队了。登陆场只有一条可以行军的「骨桥」，但它会分岔、绕行、歪七扭八，有自己的意志。',
      '生物组织在炮火下会再生。军械部的结论很直白：别指望地形，指望火力密度与你手里的科技模块。',
      '登陆开始。指挥官，让我们在这张活着的地图上凿一块阵地。',
    ],
    epilogue:
      '登陆场稳住了，骨桥边的再生组织被等离子灼烧区烧成了永久疤痕。工兵在疤痕上扩建了前沿兵营——下一步，深入虫巢体腔。',
    paths: [
      [[-1, 2], [6, 2], [6, 5], [2, 5], [2, 9], [6, 9], [6, 12], [3, 12], [3, 15], [4, 15], [4, 16]],
    ],
    waves: [
      {
        wave: 1, groups: [{ type: 'crawler', count: 9, interval: 1.0 }], bonus: 45, isBoss: false,
        comm: '骨桥在「呼吸」，路径随生物组织蠕动。登陆开始！',
      },
      {
        wave: 2,
        groups: [
          { type: 'speeder', count: 10, interval: 0.5 },
          { type: 'crawler', count: 8, interval: 0.75 },
        ],
        bonus: 55, isBoss: false,
      },
      {
        wave: 3,
        groups: [
          { type: 'splitter', count: 8, interval: 0.6 },
          { type: 'lurker', count: 5, interval: 0.6 },
        ],
        bonus: 70, isBoss: false,
      },
      {
        wave: 4,
        groups: [
          { type: 'tanker', count: 5, interval: 0.8 },
          { type: 'speeder', count: 10, interval: 0.45 },
          { type: 'crawler', count: 10, interval: 0.45 },
        ],
        bonus: 95, isBoss: false,
      },
      {
        wave: 5,
        groups: [
          { type: 'lurker', count: 10, interval: 0.45 },
          { type: 'splitter', count: 10, interval: 0.45 },
        ],
        bonus: 120, isBoss: false,
      },
      {
        wave: 6,
        groups: [
          { type: 'boss', count: 1, interval: 0.9, hpOverride: 14000, rewardOverride: 1000 },
          { type: 'splitter', count: 8, interval: 0.6 },
        ],
        bonus: 320, isBoss: true,
        comm: '外膜「免疫反应」来了——巢体巨兽顺着我们的弹坑爬出！',
      },
      {
        wave: 7,
        groups: [
          { type: 'tanker', count: 9, interval: 0.45 },
          { type: 'lurker', count: 10, interval: 0.4 },
        ],
        bonus: 160, isBoss: false,
      },
      {
        wave: 8,
        groups: [
          { type: 'splitter', count: 13, interval: 0.4 },
          { type: 'speeder', count: 16, interval: 0.35 },
        ],
        bonus: 190, isBoss: false,
      },
      {
        wave: 9,
        groups: [
          { type: 'crawler', count: 20, interval: 0.3 },
          { type: 'tanker', count: 6, interval: 0.5 },
          { type: 'lurker', count: 10, interval: 0.4 },
        ],
        bonus: 220, isBoss: false,
      },
      {
        wave: 10,
        groups: [
          { type: 'splitter', count: 14, interval: 0.35 },
          { type: 'tanker', count: 8, interval: 0.45 },
          { type: 'speeder', count: 14, interval: 0.35 },
        ],
        bonus: 260, isBoss: false,
      },
      {
        wave: 11,
        groups: [
          { type: 'lurker', count: 14, interval: 0.35 },
          { type: 'splitter', count: 12, interval: 0.35 },
          { type: 'tanker', count: 8, interval: 0.45 },
        ],
        bonus: 300, isBoss: false,
      },
      {
        wave: 12,
        groups: [
          { type: 'boss', count: 1, interval: 0.8, hpOverride: 26000, rewardOverride: 1700 },
          { type: 'crawler', count: 16, interval: 0.5 },
          { type: 'speeder', count: 12, interval: 0.4 },
        ],
        bonus: 660, isBoss: true,
        comm: '外膜防御中枢现身！它的甲壳薄层下全是再生组织——持续输出！',
      },
      {
        wave: 13,
        groups: [
          { type: 'tanker', count: 10, interval: 0.4 },
          { type: 'lurker', count: 12, interval: 0.3 },
          { type: 'splitter', count: 12, interval: 0.3 },
        ],
        bonus: 340, isBoss: false,
      },
      {
        wave: 14,
        groups: [
          { type: 'boss', count: 1, interval: 0.8, hpOverride: 30000, rewardOverride: 2000 },
          { type: 'lurker', count: 10, interval: 0.4 },
          { type: 'splitter', count: 10, interval: 0.4 },
        ],
        bonus: 750, isBoss: true,
        comm: '免疫中枢的母体「膜王」压境！登陆场的存亡，就看这一波！',
      },
    ],
  },
  {
    id: 11,
    name: '血肉长廊',
    sub: '体腔通道 · 深入巢体',
    briefing: [
      '部队已经凿进虫巢体腔。这里的「走廊」是活体组织构成的，两侧的血管壁会周期性喷出护航虫群——我们是在它的肠道里作战。',
      '医学部的警告：走廊深处的虫群「刷新率」表示虫巢已经察觉到我们。它正在把体内的免疫兵力全部调往这条通道。',
      '穿过血肉长廊，前面就是虫巢的核心泵站。炸掉它，虫巢就死了。',
    ],
    epilogue:
      '长廊打通，免疫兵团在小径里被逐波绞杀。前沿爆破组已经在核心泵站贴上了聚变炸药——时间差不多了，指挥官，准备终战。',
    paths: [
      [[-1, 3], [3, 3], [3, 7], [6, 7], [6, 10], [3, 10], [3, 13], [5, 13], [5, 15], [4, 15], [4, 16]],
      [[9, 4], [6, 4], [6, 7], [3, 7], [3, 10], [6, 10], [6, 13], [5, 13], [5, 15], [4, 15], [4, 16]],
    ],
    waves: [
      {
        wave: 1, groups: [{ type: 'crawler', count: 9, interval: 1.0, path: 0 }], bonus: 45, isBoss: false,
        comm: '体壁两侧都是血管口——虫群从壁上直接「生」出来。',
      },
      {
        wave: 2,
        groups: [
          { type: 'crawler', count: 8, interval: 0.7, path: 1 },
          { type: 'speeder', count: 9, interval: 0.45, path: 1 },
        ],
        bonus: 55, isBoss: false,
      },
      {
        wave: 3,
        groups: [
          { type: 'splitter', count: 8, interval: 0.5 },
          { type: 'lurker', count: 6, interval: 0.5 },
        ],
        bonus: 70, isBoss: false,
      },
      {
        wave: 4,
        groups: [
          { type: 'tanker', count: 4, interval: 0.8, path: 0 },
          { type: 'speeder', count: 10, interval: 0.4, path: 1 },
        ],
        bonus: 95, isBoss: false,
      },
      {
        wave: 5,
        groups: [
          { type: 'lurker', count: 11, interval: 0.4 },
          { type: 'splitter', count: 10, interval: 0.4, path: 1 },
        ],
        bonus: 120, isBoss: false,
      },
      {
        wave: 6,
        groups: [
          { type: 'boss', count: 1, interval: 0.9, hpOverride: 15000, rewardOverride: 1100, path: 1 },
          { type: 'crawler', count: 14, interval: 0.5, path: 0 },
        ],
        bonus: 320, isBoss: true,
      },
      {
        wave: 7,
        groups: [
          { type: 'tanker', count: 9, interval: 0.45 },
          { type: 'splitter', count: 11, interval: 0.4 },
        ],
        bonus: 160, isBoss: false,
      },
      {
        wave: 8,
        groups: [
          { type: 'lurker', count: 13, interval: 0.35 },
          { type: 'speeder', count: 16, interval: 0.3, path: 0 },
        ],
        bonus: 190, isBoss: false,
      },
      {
        wave: 9,
        groups: [
          { type: 'tanker', count: 10, interval: 0.4 },
          { type: 'splitter', count: 12, interval: 0.35 },
          { type: 'crawler', count: 16, interval: 0.3 },
        ],
        bonus: 230, isBoss: false,
      },
      {
        wave: 10,
        groups: [
          { type: 'boss', count: 1, interval: 1.0, hpOverride: 17000, rewardOverride: 1100, path: 0 },
          { type: 'lurker', count: 10, interval: 0.4, path: 1 },
          { type: 'splitter', count: 8, interval: 0.45, path: 1 },
        ],
        bonus: 360, isBoss: true,
      },
      {
        wave: 11,
        groups: [
          { type: 'splitter', count: 15, interval: 0.3 },
          { type: 'lurker', count: 13, interval: 0.3 },
          { type: 'speeder', count: 16, interval: 0.3 },
        ],
        bonus: 270, isBoss: false,
      },
      {
        wave: 12,
        groups: [
          { type: 'tanker', count: 12, interval: 0.35 },
          { type: 'lurker', count: 12, interval: 0.3 },
          { type: 'splitter', count: 12, interval: 0.3 },
        ],
        bonus: 310, isBoss: false,
      },
      {
        wave: 13,
        groups: [
          { type: 'boss', count: 1, interval: 0.8, hpOverride: 32000, rewardOverride: 2100, path: 1 },
          { type: 'tanker', count: 6, interval: 0.55, path: 0 },
          { type: 'lurker', count: 10, interval: 0.35, path: 0 },
        ],
        bonus: 750, isBoss: true,
        comm: '「血心守卫」泵出来了！它挡着去路——上穿甲弹药！',
      },
      {
        wave: 14,
        groups: [
          { type: 'crawler', count: 24, interval: 0.25 },
          { type: 'speeder', count: 18, interval: 0.25 },
          { type: 'tanker', count: 8, interval: 0.4 },
          { type: 'splitter', count: 10, interval: 0.3 },
        ],
        bonus: 380, isBoss: false,
        comm: '虫巢的免疫军团全线出击。守住泵站前的最后一段走廊！',
      },
    ],
  },
  {
    id: 12,
    name: '核心泵站',
    sub: '巢体心脏 · 终局引爆',
    briefing: [
      '核心泵站——虫巢的心脏，每搏动一次，就有上千只虫涌向星环。爆破组已经就位，但泵站周围的「心室卫队」是虫巢最强的一批个体。',
      '舰队的最后通牒：战线只能再拖 16 波。超过时限，虫巢就会加速回流，我们失去的就不只是殖民地了。',
      '引爆倒计时开始。指挥官，守住引爆点，就是守住一切。',
    ],
    epilogue:
      '聚变炸药在泵站深处炸开，整颗虫巢像熄灭的灯一样蜷缩、塌陷、化为死寂的灰烬。爆破组举起拳头，舰队爆发出 cheer。但雷达最后扫到的一个信号，让欢呼声在半空凝固——虫巢心脏的最深处，还有一颗「心」，还在跳。',
    paths: [
      [[9, 1], [5, 1], [5, 6], [7, 6], [7, 11], [5, 11], [5, 14], [4, 14], [4, 16]],
      [[-1, 2], [3, 2], [3, 7], [1, 7], [1, 12], [3, 12], [3, 14], [4, 14], [4, 16]],
    ],
    waves: [
      {
        wave: 1, groups: [{ type: 'crawler', count: 9, interval: 1.0, path: 0 }], bonus: 45, isBoss: false,
        comm: '心室卫队的第一梯队。引爆组贴好了第一批炸药——需要 75 秒掩护！',
      },
      {
        wave: 2,
        groups: [
          { type: 'speeder', count: 10, interval: 0.5, path: 1 },
          { type: 'crawler', count: 8, interval: 0.7, path: 1 },
        ],
        bonus: 60, isBoss: false,
      },
      {
        wave: 3,
        groups: [
          { type: 'splitter', count: 8, interval: 0.5 },
          { type: 'lurker', count: 6, interval: 0.5 },
        ],
        bonus: 75, isBoss: false,
      },
      {
        wave: 4,
        groups: [
          { type: 'tanker', count: 5, interval: 0.75, path: 0 },
          { type: 'speeder', count: 10, interval: 0.45, path: 1 },
          { type: 'lurker', count: 5, interval: 0.55, path: 0 },
        ],
        bonus: 95, isBoss: false,
      },
      {
        wave: 5,
        groups: [
          { type: 'boss', count: 1, interval: 1.0, hpOverride: 17000, rewardOverride: 1200, path: 0 },
          { type: 'splitter', count: 10, interval: 0.4, path: 1 },
        ],
        bonus: 340, isBoss: true,
      },
      {
        wave: 6,
        groups: [
          { type: 'tanker', count: 9, interval: 0.45 },
          { type: 'splitter', count: 12, interval: 0.35 },
        ],
        bonus: 170, isBoss: false,
      },
      {
        wave: 7,
        groups: [
          { type: 'lurker', count: 13, interval: 0.3 },
          { type: 'speeder', count: 16, interval: 0.3 },
        ],
        bonus: 200, isBoss: false,
      },
      {
        wave: 8,
        groups: [
          { type: 'tanker', count: 10, interval: 0.4 },
          { type: 'crawler', count: 18, interval: 0.25 },
          { type: 'lurker', count: 10, interval: 0.35 },
        ],
        bonus: 240, isBoss: false,
      },
      {
        wave: 9,
        groups: [
          { type: 'boss', count: 1, interval: 1.0, hpOverride: 19000, rewardOverride: 1300, path: 1 },
          { type: 'lurker', count: 11, interval: 0.35, path: 0 },
        ],
        bonus: 380, isBoss: true,
      },
      {
        wave: 10,
        groups: [
          { type: 'splitter', count: 16, interval: 0.3 },
          { type: 'lurker', count: 14, interval: 0.3 },
          { type: 'speeder', count: 16, interval: 0.25 },
        ],
        bonus: 280, isBoss: false,
      },
      {
        wave: 11,
        groups: [
          { type: 'tanker', count: 13, interval: 0.35 },
          { type: 'splitter', count: 14, interval: 0.3 },
          { type: 'lurker', count: 12, interval: 0.3 },
        ],
        bonus: 330, isBoss: false,
      },
      {
        wave: 12,
        groups: [
          { type: 'boss', count: 2, interval: 1.4, hpOverride: 14000, rewardOverride: 1000 },
          { type: 'speeder', count: 14, interval: 0.35 },
        ],
        bonus: 700, isBoss: true,
        comm: '双兽心室巡逻波！引爆倒计时已经过半——顶住！',
      },
      {
        wave: 13,
        groups: [
          { type: 'tanker', count: 14, interval: 0.3 },
          { type: 'lurker', count: 14, interval: 0.25 },
          { type: 'splitter', count: 12, interval: 0.3 },
          { type: 'speeder', count: 16, interval: 0.25 },
        ],
        bonus: 400, isBoss: false,
        comm: '引爆完毕，进入撤离窗口。虫巢的哀嚎里，一切都在向外涌——最后一段撤退线！',
      },
      {
        wave: 14,
        groups: [
          { type: 'boss', count: 1, interval: 0.8, hpOverride: 34000, rewardOverride: 2200, path: 0 },
          { type: 'lurker', count: 12, interval: 0.3, path: 1 },
          { type: 'tanker', count: 6, interval: 0.5, path: 1 },
        ],
        bonus: 800, isBoss: true,
        comm: '泵站崩塌前最后一战——「心室总管」亲自堵门！挡住它，我们回家！',
      },
    ],
  },
  {
    id: 13,
    name: '湮灭之心',
    sub: '虫巢核心 · 勒班陀决战',
    briefing: [
      '泵站炸碎后，虫巢的残躯仍在加速回流。雷达锁定了一颗还在跳动的「环节心脏」——湮灭之心，虫群最后、也是唯一的指挥中枢。',
      '工程部把舰队拆了，把所有光矛浓缩成了三门「帕特农级」轨道电磁炮——全殖民地最后一口钢水，浇成了这一门炮。',
      '三条通路，一颗心脏。2242 年最后的战役正式打响——指挥官，全人类都在你的准星背后。开火。',
    ],
    epilogue:
      '湮灭之心停跳的那一刻，整个星环都听见了寂静。虫群退潮般从深空散去，像一场持续了三百个轨道周期的暴雨终于放了晴。孩子们在穹顶下看到第一个没有警报的黎明——而你的名字，被刻在了殖民地的最高处。战争，结束了。这一次是真的。',
    paths: [
      [[-1, 2], [6, 2], [6, 6], [2, 6], [2, 11], [5, 11], [5, 14], [4, 14], [4, 16]],
      [[9, 3], [4, 3], [4, 8], [7, 8], [7, 12], [5, 12], [5, 14], [4, 14], [4, 16]],
      [[4, -1], [4, 4], [1, 4], [1, 9], [3, 9], [3, 13], [4, 13], [4, 16]],
    ],
    waves: [
      {
        wave: 1, groups: [{ type: 'crawler', count: 9, interval: 1.0, path: 2 }], bonus: 50, isBoss: false,
        comm: '三线会战开幕。中路最近，别让它先破线！',
      },
      {
        wave: 2,
        groups: [
          { type: 'crawler', count: 8, interval: 0.8, path: 0 },
          { type: 'speeder', count: 8, interval: 0.5, path: 1 },
        ],
        bonus: 60, isBoss: false,
      },
      {
        wave: 3,
        groups: [
          { type: 'splitter', count: 8, interval: 0.5 },
          { type: 'lurker', count: 6, interval: 0.5, path: 2 },
        ],
        bonus: 80, isBoss: false,
      },
      {
        wave: 4,
        groups: [
          { type: 'tanker', count: 5, interval: 0.75, path: 0 },
          { type: 'speeder', count: 10, interval: 0.45, path: 2 },
          { type: 'lurker', count: 6, interval: 0.55, path: 1 },
        ],
        bonus: 100, isBoss: false,
      },
      {
        wave: 5,
        groups: [
          { type: 'lurker', count: 11, interval: 0.4 },
          { type: 'splitter', count: 11, interval: 0.4, path: 1 },
        ],
        bonus: 130, isBoss: false,
      },
      {
        wave: 6,
        groups: [
          { type: 'boss', count: 1, interval: 1.0, hpOverride: 20000, rewardOverride: 1400, path: 2 },
          { type: 'crawler', count: 14, interval: 0.5, path: 0 },
        ],
        bonus: 380, isBoss: true,
      },
      {
        wave: 7,
        groups: [
          { type: 'tanker', count: 10, interval: 0.4 },
          { type: 'splitter', count: 12, interval: 0.35 },
        ],
        bonus: 180, isBoss: false,
      },
      {
        wave: 8,
        groups: [
          { type: 'lurker', count: 14, interval: 0.3 },
          { type: 'speeder', count: 16, interval: 0.3, path: 1 },
        ],
        bonus: 210, isBoss: false,
      },
      {
        wave: 9,
        groups: [
          { type: 'tanker', count: 11, interval: 0.4 },
          { type: 'splitter', count: 13, interval: 0.3 },
          { type: 'crawler', count: 16, interval: 0.3 },
        ],
        bonus: 240, isBoss: false,
      },
      {
        wave: 10,
        groups: [
          { type: 'boss', count: 1, interval: 1.0, hpOverride: 22000, rewardOverride: 1500, path: 0 },
          { type: 'lurker', count: 11, interval: 0.35, path: 1 },
          { type: 'splitter', count: 9, interval: 0.4, path: 2 },
        ],
        bonus: 420, isBoss: true,
      },
      {
        wave: 11,
        groups: [
          { type: 'splitter', count: 16, interval: 0.3 },
          { type: 'lurker', count: 14, interval: 0.3 },
          { type: 'speeder', count: 18, interval: 0.25 },
        ],
        bonus: 300, isBoss: false,
      },
      {
        wave: 12,
        groups: [
          { type: 'tanker', count: 13, interval: 0.35 },
          { type: 'lurker', count: 13, interval: 0.3 },
          { type: 'splitter', count: 13, interval: 0.3 },
        ],
        bonus: 340, isBoss: false,
      },
      {
        wave: 13,
        groups: [
          { type: 'boss', count: 2, interval: 1.4, hpOverride: 15000, rewardOverride: 1100 },
          { type: 'speeder', count: 14, interval: 0.35 },
        ],
        bonus: 760, isBoss: true,
        comm: '心室卫队总旗舰「双冕者」逼近！帕特农阵列充能中——掩护它们！',
      },
      {
        wave: 14,
        groups: [
          { type: 'tanker', count: 14, interval: 0.3 },
          { type: 'lurker', count: 13, interval: 0.25 },
          { type: 'splitter', count: 13, interval: 0.25 },
          { type: 'speeder', count: 16, interval: 0.25 },
        ],
        bonus: 440, isBoss: false,
        comm: '虫群的最后一搏。所有炮塔——自由射击！',
      },
      {
        wave: 15,
        groups: [
          { type: 'boss', count: 1, interval: 0.6, hpOverride: 55000, rewardOverride: 5000, path: 2 },
          { type: 'lurker', count: 12, interval: 0.3, path: 0 },
          { type: 'tanker', count: 8, interval: 0.45, path: 1 },
          { type: 'speeder', count: 14, interval: 0.3, path: 2 },
        ],
        bonus: 1500, isBoss: true,
        comm: '湮灭之心本体压上中通路——帕特农主炮已充能完毕！指挥官，为了让黎明准时到来——开火！',
      },
    ],
  },
);

export function getLevel(id: number): LevelDef {
  if (id === COOP_LEVEL.id) return COOP_LEVEL;
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

// ---------------- 在线联机协作关卡 ----------------

/**
 * 双人协作专用图（不进 LEVELS —— 主页选关卡直接 forEach LEVELS，绝不能污染）。
 * 地图沿用第 3 章「核心之门」的左右分流双路（互不接触，各守一座能量门）。
 * 波次 15 波，强度对齐 normal 第 5-6 章；每组显式指定 path 且两路交替，保证双路压力相当。
 * BOSS 波（第 8 / 15 波）双路各出一只，血量取同级单 BOSS 的 60%：
 * 两名玩家各有完整 BOSS 战体验，总血量 1.2 倍与「单路 1.2 倍血」方案压力相当。
 * 由联机层以 createEngine(difficulty, 0, { coop: true }) 创建；难度系数仍经 hpMul/speedMul 生效。
 */
export const COOP_LEVEL: LevelDef = {
  id: 0,
  name: '双子星门',
  sub: '协同作战 · 双路联机防线',
  briefing: [
    '双子星门——殖民地跃迁网络的东西双门枢纽。虫群主力兵分两路，沿两条维修栈道同时压向双门。',
    '指挥部命令：两名指挥官各领一路，独立军费、各自为战——但星门的护盾核心只有一座，漏掉的每一只虫子都在烧共同的生命。',
    '守住全部波次。协同加成已计入战后军功，指挥官，并肩作战。',
  ],
  epilogue: '双子星门在双重火力网中屹立不倒。虫群残部退回深空——这一战，是两双眼睛一起赢下的。',
  // 左路（path 0）左进左出，右路（path 1）右进右出，互不接触
  paths: [
    [[-1, 2], [4, 2], [4, 5], [1, 5], [1, 9], [3, 9], [3, 12], [1, 12], [1, 14], [2, 14], [2, 16]],
    [[9, 2], [5, 2], [5, 4], [7, 4], [7, 7], [5, 7], [5, 10], [7, 10], [7, 13], [6, 13], [6, 16]],
  ],
  waves: [
    {
      wave: 1, groups: [{ type: 'crawler', count: 8, interval: 1.1, path: 0 }], bonus: 40, isBoss: false,
      comm: '双门枢纽接敌——左路栈道先出现虫群。各守一路，指挥官！',
    },
    {
      wave: 2,
      groups: [
        { type: 'crawler', count: 6, interval: 1.0, path: 1 },
        { type: 'speeder', count: 4, interval: 0.8, path: 1 },
      ],
      bonus: 55, isBoss: false,
      comm: '右路遇袭！别让任何一路放空。',
    },
    {
      wave: 3,
      groups: [
        { type: 'splitter', count: 5, interval: 0.9, path: 0 },
        { type: 'lurker', count: 3, interval: 0.9, path: 1 },
      ],
      bonus: 65, isBoss: false,
    },
    {
      wave: 4,
      groups: [
        { type: 'tanker', count: 4, interval: 0.9, path: 0 },
        { type: 'crawler', count: 8, interval: 0.8, path: 1 },
      ],
      bonus: 80, isBoss: false,
    },
    {
      wave: 5,
      groups: [
        { type: 'lurker', count: 8, interval: 0.6, path: 1 },
        { type: 'speeder', count: 10, interval: 0.6, path: 0 },
      ],
      bonus: 100, isBoss: false,
      comm: '隐匿者开始渗透右路——电磁炮可无视隐身。',
    },
    {
      wave: 6,
      groups: [
        { type: 'splitter', count: 9, interval: 0.65, path: 0 },
        { type: 'tanker', count: 4, interval: 0.8, path: 1 },
      ],
      bonus: 130, isBoss: false,
    },
    {
      wave: 7,
      groups: [
        { type: 'lurker', count: 10, interval: 0.55, path: 0 },
        { type: 'speeder', count: 12, interval: 0.5, path: 1 },
      ],
      bonus: 150, isBoss: false,
    },
    {
      wave: 8,
      groups: [
        { type: 'boss', count: 1, interval: 1.0, hpOverride: 4000, rewardOverride: 400, path: 0 },
        { type: 'boss', count: 1, interval: 1.0, hpOverride: 4000, rewardOverride: 400, path: 1 },
      ],
      bonus: 280, isBoss: true,
      comm: '警告：双路各有一只巨兽压阵！各自集火，别让它碰到星门！',
    },
    {
      wave: 9,
      groups: [
        { type: 'tanker', count: 7, interval: 0.6, path: 1 },
        { type: 'lurker', count: 8, interval: 0.55, path: 0 },
      ],
      bonus: 170, isBoss: false,
    },
    {
      wave: 10,
      groups: [
        { type: 'splitter', count: 10, interval: 0.55, path: 0 },
        { type: 'speeder', count: 10, interval: 0.5, path: 1 },
        { type: 'crawler', count: 12, interval: 0.5, path: 0 },
      ],
      bonus: 200, isBoss: false,
      comm: '兽潮密度还在上升。军费独立——照看好你自己的那一路。',
    },
    {
      wave: 11,
      groups: [
        { type: 'lurker', count: 12, interval: 0.5, path: 1 },
        { type: 'tanker', count: 5, interval: 0.7, path: 0 },
        { type: 'splitter', count: 7, interval: 0.55, path: 1 },
      ],
      bonus: 240, isBoss: false,
    },
    {
      wave: 12,
      groups: [
        { type: 'crawler', count: 14, interval: 0.4, path: 0 },
        { type: 'speeder', count: 12, interval: 0.4, path: 1 },
        { type: 'tanker', count: 6, interval: 0.6, path: 0 },
      ],
      bonus: 280, isBoss: false,
    },
    {
      wave: 13,
      groups: [
        { type: 'splitter', count: 10, interval: 0.45, path: 1 },
        { type: 'lurker', count: 10, interval: 0.45, path: 0 },
        { type: 'speeder', count: 12, interval: 0.4, path: 1 },
      ],
      bonus: 320, isBoss: false,
    },
    {
      wave: 14,
      groups: [
        { type: 'tanker', count: 8, interval: 0.5, path: 0 },
        { type: 'lurker', count: 10, interval: 0.4, path: 1 },
        { type: 'splitter', count: 8, interval: 0.45, path: 0 },
      ],
      bonus: 380, isBoss: false,
      comm: '星门护盾能量见底。最后一波总攻要来了——把军费全部花掉！',
    },
    {
      wave: 15,
      groups: [
        { type: 'boss', count: 1, interval: 0.8, hpOverride: 9600, rewardOverride: 900, path: 0 },
        { type: 'boss', count: 1, interval: 0.8, hpOverride: 9600, rewardOverride: 900, path: 1 },
        { type: 'speeder', count: 8, interval: 0.7, path: 0 },
        { type: 'lurker', count: 6, interval: 0.8, path: 1 },
      ],
      bonus: 650, isBoss: true,
      comm: '最终警告：双路各现身一只湮灭巨兽！这是双子星门的最后一战——开火！',
    },
  ],
};
