# 主页 / 开始页 — `/` （home.md）

> 氛围：电影级太空史诗开场。玩家是"星环殖民地防御指挥官"。

## 布局（移动端单列，桌面同构加宽）

### S1 Hero（100vh 满屏）
- **背景**：`/home-hero-bg.png` 全屏 cover，叠加 `#070B18` 60% 暗化渐变（上浅下深），最上层放 2 层 CSS 星点视差（鼠标/陀螺仪微动 ±10px）。
- **内容**（垂直居中）：
  - Logo：`/icon-logo.svg` 64px，下方英文 "STELLAR RING DEFENSE"（Orbitron 900, clamp(28px,9vw,64px), 青色 glow，字符级入场），中文"星环防线"（Noto Sans SC 900, 0.5em, letter-spacing 1em）。
  - 一句话背景故事（正文 15px, `--text-dim`）：
    > "2242 年，星环殖民地最后的能量护盾正在衰减。湮灭虫群已突破外层防线——指挥官，你是最后的炮塔。"
  - **难度选择**：三张横向卡片（简单/普通/困难），PanelCard 样式，各含难度名、金币/生命/敌人强度参数小字、推荐人群标签。默认选中"普通"，选中态青色发光边框 + scale 1.03。
  - **主按钮**："▶ 开始防御"（NeonButton 大号，56px 高，全宽移动端），点击 → `/game?difficulty=xxx`。
  - 次按钮行：图鉴 / 成就 / 说明（幽灵按钮，图标+文字）。
- **Animation**：Logo 字符逐个 `y:30→0, opacity 0→1, stagger 0.04s, 500ms`；难度卡片 stagger 0.1s 滑入；主按钮持续 `box-shadow` 呼吸脉冲 2s 循环；星点 `twinkle` 3s/4s 交错无限。

### S2 特色展示（滚动区，3 个特性块）
- 每块：左侧 1:1 素材图（塔/敌人轮播），右侧标题+3 行描述。三块主题："四大防御系统"（塔素材 2×2 网格微视差）、"湮灭虫群图鉴"（敌人素材横向滚动条）、"15 波史诗战役"（波次时间轴可视化：竖线 + 15 节点，第 5/10/15 节点品红高亮 BOSS 标记）。
- **Animation**：每块进入视口 20% 时 `x:±60→0, opacity 0→1, 600ms`；时间轴节点沿滚动依次点亮（Framer Motion `whileInView`, stagger 0.05s）。

### S3 战绩速览（读取 localStorage `srd.stats`）
- 横排 4 个 StatChip：最高波次 / 总击杀 / 胜场 / 已解锁成就数。无数据时显示"暂无战绩——完成第一场防御吧"并链接到开始按钮。
- **Animation**：数字从 0 滚动到目标值（800ms, easeOut）。

### S4 Footer
- 共享 Footer 组件。

## 交互
- 难度卡片可点选（单选 radio 行为）；"开始防御"按钮 `whileTap scale 0.95`。
- 导航 TopBar 固定在顶部，滚动时背景从透明渐变为 `--bg-glass`。

## 资产
`/home-hero-bg.png`、`/icon-logo.svg`、塔×4、敌人×6（S2 展示用）、各 UI 图标。
