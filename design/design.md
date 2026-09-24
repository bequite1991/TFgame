# 《星环防线 · STELLAR RING DEFENSE》 — 全局设计文档

> 科幻太空机甲题材 H5 塔防游戏 · React 19 + TypeScript + Canvas · 移动端优先

---

## 1. 产品概述

一款竖屏优先、横屏自适应的太空塔防 H5 游戏。玩家在外星环形殖民地的地表部署激光塔、导弹塔、减速塔、电磁炮等防御单位，抵御 15 波外星生物的进攻。包含完整经济系统（金币）、基地生命值、塔升级/出售、BOSS 战、成就统计与图鉴收集。

**核心设计原则（对应"未来转 React Native"需求）：**
- 所有游戏逻辑（波次、寻路、伤害、经济）封装为纯 TypeScript 模块（`game/engine/*`，无 DOM/React 依赖，可放入 Web Worker），UI 渲染层（React + Canvas 2D）只消费引擎的状态快照。
- 设计文档中所有数值表、状态机、事件定义均为引擎规格的一部分，实现层不得改动。

---

## 2. 视觉方向

**风格关键词**：深空蓝黑底色 · 霓虹青/品红点缀 · 全息 HUD · 机甲硬表面 · 外星生物质感 · 像素+矢量混合的轻科幻插画

**整体氛围**：像一块被投影在太空舱舷窗上的战术终端 —— 冷、干净、有发光边缘，战斗时特效爆炸式热烈。

### 2.1 色彩系统

| Token | 色值 | 用途 |
|---|---|---|
| `--bg-deep` | `#070B18` | 全局页面底色（深空） |
| `--bg-panel` | `#0D1428` | 面板/卡片底 |
| `--bg-glass` | `rgba(13,20,40,0.72)` + `backdrop-blur:12px` | 全息浮层 |
| `--primary` | `#22E0FF` | 主霓虹青（交互、激光塔、选中态） |
| `--primary-dim` | `#0E7A9C` | 青色暗态（边框、次级文本） |
| `--accent` | `#FF3D81` | 品红（危险、敌人强调、BOSS） |
| `--gold` | `#FFC94D` | 金币、奖励、成就 |
| `--violet` | `#8B5CF6` | 电磁炮、升级高阶 |
| `--green` | `#3DF08C` | 减速塔、生命回复、成功 |
| `--hp` | `#FF5A5A` | 基地生命条 |
| `--text` | `#E8F1FF` | 主文本 |
| `--text-dim` | `#7C8DB0` | 次级文本 |
| `--grid-line` | `rgba(34,224,255,0.08)` | 战术网格背景 |
| `--alien-flesh` | `#7A4FD0` | 外星生物基色（素材参考） |
| `--alien-glow` | `#B8FF3D` | 外星生物发光器官 |

**CSS 细节**：所有霓虹元素使用双层 `box-shadow`（内 glow + 外 glow，如 `0 0 8px #22E0FF88, 0 0 24px #22E0FF33`）。面板边框用 1px 描边 + 切角（`clip-path: polygon(...)` 裁出 8px 科技切角）。

### 2.2 字体系统

| 用途 | 字体 | 规格 |
|---|---|---|
| 标题/数字 HUD | **Orbitron** (Google Fonts, 500/700/900) | 标题 `clamp(24px,7vw,48px)` 700，HUD 数字 18-24px 700，letter-spacing `0.08em`，大写 |
| 中文标题 | **Noto Sans SC** 700/900 | 与 Orbitron 搭配，中文跟在英文副标下方 |
| 正文/UI | **Noto Sans SC** 400/500 | 14-16px，行高 1.6 |
| 游戏内浮字（伤害/金币） | Orbitron 700 12-14px | Canvas 绘制 |

### 2.3 间距与布局

- 间距 scale：`4 / 8 / 12 / 16 / 24 / 32 / 48px`。
- 移动端竖屏为基准（375×812 设计稿），游戏画布区域占视口高约 62%，底部 HUD+建塔面板占 38%。
- 桌面端（≥1024px）：游戏区居中，两侧各 260px 面板（左：塔信息/图鉴速查；右：波次/敌人预告），整体最大宽度 1280px。
- 画布内部逻辑分辨率：`540 × 960`（竖屏网格 9 列 × 16 行，每格 60×60），CSS 等比缩放，`image-rendering` 默认（平滑），设备像素比感知（`devicePixelRatio` 缩放保证清晰）。

### 2.4 动画风格

- **页面动画**：Framer Motion —— 页面切换 `opacity 0→1 + y 20→0, 300ms, easeOut`；卡片 stagger 0.06s。
- **HUD 微交互**：按钮 `active:scale(0.92)`；金币增加时数字滚动 + `+N` 浮字飘出；生命降低时全屏红边 vignette 脉冲 400ms。
- **Canvas 游戏动画**：60fps rAF 主循环；激光为 2px 亮线 + glow；爆炸为粒子（12-20 个，径向扩散，寿命 400-700ms）；敌人死亡为缩小+碎裂粒子+金色 `+N` 浮字。
- **背景装饰**：首页/副页用 CSS 星空（两层径向渐变星点 `@keyframes twinkle`）+ 一个慢速漂移的星云渐变层；不堆叠多个重 shader。
- **降级**：`prefers-reduced-motion` 关闭非必要动画；低端机（`navigator.hardwareConcurrency ≤ 4`）粒子数减半。

### 2.5 光标与触控

- 桌面：默认光标；可建造格悬停显示青色高亮 + 塔射程预览圈。
- 触屏：点击格子 → 底部弹出建塔面板（而非悬停）；双指不缩放页面（`touch-action: none` on canvas）；所有可点目标 ≥44px。
- 统一的 `onPointerDown/Up` 事件层，同时服务鼠标与触屏。

### 2.6 共享组件

- **TopBar**（非游戏页）：左侧 logo（`icon-logo.svg` + "STELLAR RING / 星环防线"），右侧导航：主页 / 图鉴 / 成就 / 说明 / 开始游戏（高亮按钮）。移动端汉堡抽屉。
- **PanelCard**：全息玻璃面板，切角边框，标题栏带一条 2px 渐变线。
- **NeonButton**：主按钮（青色填充+发光）、幽灵按钮（描边）、危险按钮（品红）。
- **StatChip**：小标签（图标+数字，如金币/波次）。
- **Footer**：极简，"© 2242 星环殖民地防御指挥部" + 版本号。

### 2.7 依赖

`react`, `react-dom`, `react-router-dom`, `framer-motion`, `tailwindcss`, `three`, 字体 `@fontsource/orbitron` + `@fontsource/noto-sans-sc`（或 Google Fonts link）。~~Canvas 2D 渲染游戏~~【修订 2026-09】战斗画面已升级为 Three.js 实时 3D 渲染（`src/game/render3d/`，透视相机 + 程序化 3D 炮塔模型 + 敌人公告板），原 Canvas 2D 渲染器（`src/game/ui/GameCanvas.tsx`）保留为回退，设置面板「3D 视角」开关切换，`srd.settings.render3d` 持久化；微信小游戏版仍用 2D 渲染以控制包体积。首页 hero 用轻量 canvas 星空粒子。

### 2.8 页面列表

| 页面 | 文件 | 路由 | 描述 |
|---|---|---|---|
| 主页/开始 | `home.md` | `/` | 背景故事、难度选择、开始游戏入口、特色展示 |
| 游戏主界面 | `game.md` | `/game` | Canvas 游戏区 + HUD + 建塔/升级面板 |
| 图鉴 | `codex.md` | `/codex` | 防御塔与敌人卡片图鉴（数值表可视化） |
| 成就/统计 | `stats.md` | `/stats` | localStorage 持久化的成就与生涯数据 |
| 游戏说明 | `help.md` | `/help` | 玩法教学、操作指南、FAQ |

---

## 3. 核心玩法规格（引擎契约）

### 3.1 地图与路径

- 逻辑网格：**9 列 × 16 行**（每格 60px → 540×960）。
- 路径（敌人行进路线，网格坐标 col,row，0-indexed）：
  `(-1,2) → (6,2) → (6,6) → (2,6) → (2,10) → (7,10) → (7,13) → (4,13) → (4,15)`，最后出屏进入基地。呈"S"型蛇形路径，转弯点 4 个。
- 可建造格：所有不在路径上、不在基地列（row 15 的 col 3-5 为基地装饰区）的格子。开局解锁全部可建格。
- 基地位于底部中央，渲染为 `map-base.png` 素材 + 能量护罩弧光。

### 3.2 防御塔（4 种 × 3 级）

所有塔占用 1 格；射程以**格**为单位（1 格=60px）；伤害为单次命中；射速为发/秒。

| 塔 | 图标/素材 | 等级 | 伤害 | 射程(格) | 射速 | 建造/升级费用 | 特性 |
|---|---|---|---|---|---|---|---|
| **激光塔 LASER** | `tower-laser.png` | Lv1 | 12 | 2.5 | 2.0 | 建造 100 | 瞬时命中单体，光束特效 |
| | | Lv2 | 22 | 2.7 | 2.2 | 升级 120 | |
| | | Lv3 | 40 | 3.0 | 2.5 | 升级 200 | 光束贯穿 1 个额外目标(50%伤害) |
| **导弹塔 MISSILE** | `tower-missile.png` | Lv1 | 30 | 3.5 | 0.5 | 建造 150 | 范围溅射（半径 1 格），可打装甲 |
| | | Lv2 | 55 | 3.7 | 0.55 | 升级 180 | 溅射半径 1.2 格 |
| | | Lv3 | 95 | 4.0 | 0.6 | 升级 300 | 溅射半径 1.5 格，附带 0.5s 眩晕 |
| **减速塔 FROST** | `tower-frost.png` | Lv1 | 4 | 2.2 | 1.0 | 建造 80 | 命中减速 35%，持续 1.5s，小范围脉冲(半径1格) |
| | | Lv2 | 8 | 2.4 | 1.0 | 升级 100 | 减速 45%，持续 2s |
| | | Lv3 | 15 | 2.6 | 1.2 | 升级 160 | 减速 55%，持续 2.5s，BOSS 减半生效 |
| **电磁炮 RAILGUN** | `tower-railgun.png` | Lv1 | 90 | 4.5 | 0.25 | 建造 260 | 贯穿直线（发射方向整条线上所有敌人），需 1.2s 蓄能动画 |
| | | Lv2 | 170 | 4.7 | 0.28 | 升级 320 | |
| | | Lv3 | 320 | 5.0 | 0.3 | 升级 480 | 贯穿伤害不衰减，命中附带破甲(目标受伤+15%，3s) |

- 出售返还 **70%** 累计投入。
- 塔升级即时生效，升级特效：光环扩散 + 塔身部件换装（用 tint/缩放模拟，不另出素材）。

### 3.3 敌人（5 种 + BOSS）

血量随波次缩放：`HP = base × (1 + 0.12 × (wave-1))`（BOSS 单独表）。速度单位：格/秒。奖励为击杀金币；漏怪扣基地血。

| 敌人 | 素材 | 基础HP | 速度 | 奖励 | 漏怪伤害 | 特性 |
|---|---|---|---|---|---|---|
| **爬行者 Crawler**（普通） | `enemy-crawler.png` | 60 | 1.0 | 8 | 1 | 无 |
| **迅捷兽 Speeder**（快速） | `enemy-speeder.png` | 40 | 1.9 | 10 | 1 | 体型小，受减速效果 ×1.2 |
| **甲壳兽 Tanker**（坦克） | `enemy-tanker.png` | 320 | 0.55 | 25 | 3 | 装甲：激光伤害 −25% |
| **分裂体 Splitter** | `enemy-splitter.png` | 150 | 0.9 | 18 | 2 | 死亡时分裂为 2 个爬行者（HP=当前波爬行者 60%） |
| **隐匿者 Lurker** | `enemy-lurker.png` | 110 | 1.2 | 15 | 2 | 每 3s 隐身 1s（隐身时不可被锁定，电磁炮贯穿仍可命中） |
| **BOSS 湮灭巨兽 Annihilator** | `enemy-boss.png` | 见波次表 | 0.45 | 300/600/1000 | 10 | 免疫眩晕，减速效果 ×0.5；血量 50% 以下狂暴：速度 +40%，外壳变色（素材 tint 品红） |

### 3.4 波次表（15 波）

| 波 | 构成 | 数量 | 间隔(s) | 波次奖励 |
|---|---|---|---|---|
| 1 | 爬行者 | 8 | 1.2 | 40 |
| 2 | 爬行者 | 12 | 1.0 | 50 |
| 3 | 爬行者×8 + 迅捷兽×4 | 12 | 1.0/0.7 | 60 |
| 4 | 迅捷兽 | 12 | 0.6 | 70 |
| 5 | 爬行者×10 + 甲壳兽×2 | 12 | 0.9/— | 90 |
| 6 | 分裂体×6 + 迅捷兽×6 | 12 | 0.8 | 100 |
| 7 | 甲壳兽×5 + 爬行者×8 | 13 | 0.8 | 110 |
| 8 | 隐匿者×8 + 迅捷兽×6 | 14 | 0.7 | 120 |
| 9 | 分裂体×8 + 甲壳兽×4 | 12 | 0.7 | 140 |
| 10 | **BOSS-1**（HP 4000）+ 爬行者×6 | 7 | 1.5 | 200 + BOSS 300 |
| 11 | 隐匿者×10 + 分裂体×6 | 16 | 0.6 | 160 |
| 12 | 甲壳兽×8 + 迅捷兽×10 | 18 | 0.6 | 180 |
| 13 | 全类型混合 | 22 | 0.5 | 200 |
| 14 | 甲壳兽×6 + 隐匿者×8 + 分裂体×8 | 22 | 0.5 | 240 |
| 15 | **BOSS-最终**（HP 12000）+ 迅捷兽×10 护航 | 11 | 0.8 | 500 + BOSS 1000 |

- 每波开始前 3s 倒计时 + 敌人构成预告图标。波次奖励在该波清空后发放。
- 出怪点顶部，基地底部。连续出怪间隔按表，同波内多类型交错。

### 3.5 经济与生命

- 开局金币：**400**（简单 500 / 普通 400 / 困难 320）。
- 基地生命：**20**（简单 25 / 普通 20 / 困难 15）。
- 击杀奖励按敌人表；波次奖励按波次表。
- 困难模式敌人 HP ×1.15、速度 ×1.05；简单模式 ×0.85 HP。
- 游戏结束：生命 ≤0（失败，播放基地爆炸）或第 15 波清空（胜利，结算页）。

### 3.6 引擎架构（逻辑/渲染分离契约）

```
game/engine/            ← 纯 TS，零 React 依赖
  types.ts              ← GameState, Tower, Enemy, WaveConfig, GameEvent
  config.ts             ← 本文件 §3 全部数值表（单一数据源）
  grid.ts / path.ts     ← 网格、A*不需要（固定路径点线性插值）
  economy.ts            ← 金币、建造/升级/出售校验
  combat.ts             ← 锁定、伤害、减速/破甲/隐身规则
  waves.ts              ← 波次调度、出怪队列
  engine.ts             ← tick(dt): 输入命令 → 状态推进 → 事件队列
game/ui/                ← React 层
  GameCanvas.tsx        ← Canvas 渲染 GameState 快照（只读）
  HUD / BuildPanel / …  ← 发送命令: {type:'BUILD_TOWER', ...}
```
- 引擎以固定 60Hz 逻辑 tick，暴露 `getSnapshot()` 与 `dispatch(command)`；React 通过订阅渲染。React Native 迁移时仅替换 `game/ui/`。
- localStorage 键：`srd.stats`（生涯统计）、`srd.achievements`、`srd.settings`（音量/难度/画质）。

---

## 4. Assets 素材清单（全部由生成团队制作，统一风格）

**统一风格指令（附加到每个 prompt 末尾）**："Sci-fi game asset, clean vector-illustration style with soft neon glow, dark-space-compatible, crisp silhouette, consistent with a 'deep blue space + neon cyan/magenta' palette, top-down 3/4 view for game pieces, centered on transparent background, no text, no watermark."

### 4.1 防御塔（4 张，512×512 1:1 PNG 透明底）

| 文件名 | 描述（生成 prompt） | 用途 |
|---|---|---|
| `tower-laser.png` | "Futuristic mecha laser defense turret, hexagonal armored base with a sleek rotating prism emitter on top, glowing cyan energy core in the barrel, white and gunmetal armor plates with cyan accent lights" + 统一风格指令 | 游戏/图鉴/建塔面板 |
| `tower-missile.png` | "Futuristic missile defense turret, squat armored platform with dual vertical missile pods, orange-red warhead tips visible, gunmetal and dark blue armor with warning stripes, subtle cyan status lights" + 统一风格指令 | 同上 |
| `tower-frost.png` | "Futuristic cryo slow-field generator tower, tripod mecha base holding a floating frosted orb crackling with ice-blue energy arcs, snow-white and teal armor, mist particles around orb" + 统一风格指令 | 同上 |
| `tower-railgun.png` | "Heavy electromagnetic railgun turret, long twin parallel rails with glowing violet capacitors, massive angular mecha base, dark gunmetal with violet energy conduits, charging glow at rail tips" + 统一风格指令 | 同上 |

### 4.2 敌人（6 张，512×512 1:1 PNG 透明底）

| 文件名 | 描述 | 用途 |
|---|---|---|
| `enemy-crawler.png` | "Small alien insectoid crawler, four scuttling legs, glossy purple chitin body with glowing acid-green eyes and veins, organic sci-fi creature" + 统一风格指令 | 游戏/图鉴 |
| `enemy-speeder.png` | "Sleek fast alien runner creature, elongated aerodynamic body, two long blade-like legs, translucent cyan speed membrane fins, purple-green bio-luminescence" + 统一风格指令 | 同上 |
| `enemy-tanker.png` | "Massive armored alien beetle tank creature, thick overlapping dark purple carapace plates, tiny glowing green eyes, heavy stomping legs, battle-scarred shell with green glowing cracks" + 统一风格指令 | 同上 |
| `enemy-splitter.png` | "Alien amoeba-like splitter creature, translucent purple gelatinous body containing two visible glowing embryo cores, dripping bio-slime, unstable pulsing glow" + 统一风格指令 | 同上 |
| `enemy-lurker.png` | "Alien stealth stalker creature, lean predatory body half-phasing into transparency, chameleon chrome-purple skin, sharp glowing green claws, motion-blur ghost edge" + 统一风格指令 | 同上 |
| `enemy-boss.png` | "Colossal alien boss 'Annihilator', towering biomechanical kaiju, fused purple chitin and dark metal armor, massive glowing acid-green chest core, crown of bone spikes, lava-like magenta cracks across body, menacing and epic" + 统一风格指令 | 同上（游戏内渲染 2 格大小） |

### 4.3 场景/背景

| 文件名 | 描述 | 尺寸 | 用途 |
|---|---|---|---|
| `map-bg.png` | "Top-down alien colony battlefield ground texture, dark basalt rock terrain with faint cyan circuit-like energy veins, subtle craters and metallic plating patches, desaturated deep blue-grey so bright game pieces pop, seamless tileable feel, viewed straight from above" | 1080×1920 (9:16) | 游戏画布底图 |
| `map-base.png` | "Futuristic colony defense base structure viewed top-down, circular energy shield generator hub with glowing cyan dome and armored ring, landing pads and antenna arrays, gunmetal and white with cyan glow" | 512×512 1:1 透明底 | 基地渲染 |
| `home-hero-bg.png` | "Epic sci-fi space vista, a ringed colony planet seen from orbit under alien fleet assault, beams of cyan laser fire and magenta alien swarm silhouettes, deep indigo nebula, cinematic wide composition, dark enough for white text overlay" | 1920×1080 16:9 | 主页 hero |
| `codex-banner.png` | "Holographic museum display aesthetic, row of mecha turrets and alien specimens as glowing hologram silhouettes on pedestals, dark tech room, cyan hologram light" | 1920×640 3:1 | 图鉴页头图 |
| `nebula-texture.png` | "Abstract dark space nebula texture, deep blue and violet clouds with sparse stars, very dark, seamless, subtle" | 1024×1024 | 各副页背景层 |

### 4.4 UI 图标（SVG，单色描边风格，stroke 2px，圆角端点）

| 文件名 | 描述 |
|---|---|
| `icon-logo.svg` | 环形行星 + 一道激光束穿过的徽标 |
| `icon-coin.svg` | 六边形能量币 |
| `icon-heart.svg` | 护盾心形/生命 |
| `icon-wave.svg` | 三道推进波线（波次） |
| `icon-upgrade.svg` | 向上双箭头 + 六边形 |
| `icon-sell.svg` | 回收/出售符号 |
| `icon-pause.svg` / `icon-play.svg` / `icon-speed.svg` | 暂停/播放/2倍速（双三角） |
| `icon-trophy.svg` | 成就奖杯 |
| `icon-book.svg` | 图鉴书本 |
| `icon-gear.svg` | 设置齿轮 |
| `icon-target.svg` | 锁定准星 |

### 4.5 结算插画（2 张，1200×800 3:2）

| 文件名 | 描述 | 用途 |
|---|---|---|
| `victory-art.png` | "Triumphant scene, mecha turrets standing on alien ridge at dawn, destroyed alien swarm silhouettes below, cyan energy shield dome over colony, hopeful golden-cyan light" | 胜利结算 |
| `defeat-art.png` | "Dramatic defeat scene, shattered defense base with smoke, alien swarm overrunning the colony under a blood-magenta sky, embers falling, cinematic sorrow" | 失败结算 |

---

## 5. 音效建议（可选，Web Audio 合成即可，无需素材）

激光 zap（高频短促）、导弹发射 whoosh + 爆炸低频、减速塔冰晶 ding、电磁炮蓄能 rising hum + 重击、金币收集 coin blip、基地受击 alarm thud、胜利/失败短旋律。设置页提供静音开关。
