# 成就 / 统计页 — `/stats` （stats.md）

> 氛围：指挥官军功档案。全部数据来自 localStorage（`srd.stats`、`srd.achievements`）。

## 布局

### P1 页头
- 标题 "COMMANDER RECORD / 指挥官档案"（Orbitron 700 28px）。
- 指挥官等级环：中央一个 SVG 圆环进度（等级经验 = 总击杀数，每 500 击杀升 1 级），环心大数字等级，环外渐变色 `--primary`→`--violet`，stroke-dasharray 动画。
- **Animation**：圆环入视口 `stroke-dashoffset` 从满→目标 1.2s easeOut；等级数字 count-up。

### P2 生涯统计网格
- 2×3 卡片网格（桌面 3×2），每卡：图标 + 大数字（Orbitron 28px, `--gold`）+ 标签：
  - 总击杀数 / 总游戏场次 / 胜场数 / 最高波次 / 累计金币赚取 / 总游戏时长
- 每卡底部一条迷你 sparkline（最近 10 场该指标趋势，纯 SVG 折线，青色）。
- **Animation**：卡片 stagger 0.08s `y:30→0`；数字 count-up 1s；sparkline 路径描边动画（`pathLength 0→1`）。

### P3 成就列表（14 个成就）
- 纵向列表卡片，每行：`/icon-trophy.svg` 变体图标（未解锁灰化 + 锁遮罩）、成就名、描述、进度条（如 235/500）。
- 已解锁：金色描边 + 右上角解锁日期小字 + 发光。
- 成就定义：

| ID | 名称 | 条件 |
|---|---|---|
| first-blood | 初露锋芒 | 击杀第 1 个敌人 |
| wave-5 | 站稳脚跟 | 到达第 5 波 |
| boss-killer | 屠兽者 | 击败 BOSS-1 |
| victory-1 | 殖民地的英雄 | 普通难度通关 |
| victory-hard | 钢铁意志 | 困难难度通关 |
| perfect | 铜墙铁壁 | 满血通关任意难度 |
| rich | 战争财阀 | 单局累计赚取 5000 金币 |
| kill-1000 | 虫群收割机 | 累计击杀 1000 |
| kill-5000 | 湮灭者 | 累计击杀 5000 |
| tower-master | 军械专家 | 单局建造全部 4 种塔 |
| max-tower | 巅峰火力 | 将任意塔升至 Lv3 |
| no-frost | 硬碰硬 | 不使用减速塔通关 |
| speedrun | 闪电战 | 20 分钟内通关普通 |
| veteran | 百战老兵 | 完成 10 局游戏 |

- **Animation**：列表行 stagger 0.05s；进度条宽 0→目标 600ms；解锁卡片 hover 金光扫过（`background-position` 1s）。

### P4 数据管理
- 危险区 PanelCard（品红描边）："清除全部存档数据" 按钮 → 二次确认 modal（输入"确认"或长按 2s 确认）。
- **Animation**：按钮 hover 红色 glow 增强；modal spring 弹入。

## 空态
- 无任何数据时：P2/P3 显示插画化空态（`/icon-trophy.svg` 大号灰化 + "尚未建立军功，去迎接你的第一场战斗吧" + 开始游戏按钮）。

## 资产
`icon-trophy.svg`、成就图标可用 trophy 变体（tint 不同色）或复用敌人/塔小图。
