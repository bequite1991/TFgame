# 双人模式 + 用户体系 + 积分体系 — 《高塔防线》微信小游戏（multiplayer.md）

> 范围：仅微信小游戏端（`wxgame/`）。页面结构对齐现有 `splash → home → briefing → battle → result`（+ `codex` 与档案/设置弹层），存储键对齐 `srd.*` 命名空间，埋点走 `wxgame/src/analytics.ts` 的 `track()`，评级沿用结算页 S/A/B/D 规则。
>
> 平台前提：小游戏无 DOM；好友排行必须用**微信开放数据域**（subContext + sharedCanvas）；`wx.login` 换 openid **必须有后端**（code2Session 需 AppSecret，不可放客户端）；实时联机需自建 WebSocket 服务或微信云开发。

---

## 1. 总览与分期路线

| 期 | 内容 | 依赖 | 备注 |
|---|---|---|---|
| **MVP（一期）** | 用户体系（静默登录 + 游客降级）、积分体系（本地累计 + 军衔）、双人 A 档「同屏协作」 | 无后端亦可上线；有后端则 openid 落库 | 全部客户端改动，审核沿用现有类目 |
| **二期** | 好友排行榜（开放数据域）、双人 B 档「异步挑战」、积分消耗（皮肤解锁/双倍战利） | **开放数据域工程**；分享能力（已有）；流量主（广告位） | 需在 `game.json` 声明 `openDataContext` 并重新提审 |
| **三期** | 双人 C 档「实时联机协作」、积分服务端校验与反作弊 | **自建后端（WebSocket + HTTP）或微信云开发** | 涉实时对战，注意类目与版号要求（见 §9） |

推荐策略：**MVP 先把"积分 + 军衔 + 同屏双人"做出来，让积分有产出、有展示、有消耗**；二期用排行榜和异步挑战把积分变成社交货币（拉新裂变）；三期才上实时联机——它对引擎确定性、网络、后端成本的要求最高，放最后。

---

## 2. 用户体系

### 2.1 身份模型：三级身份

| 级别 | 标识 | 能力 | 触发 |
|---|---|---|---|
| L0 游客 | 无 openid，本地军衔名（`commanderRank()`） | 完整单人游戏、本地积分、同屏双人 | 默认状态，开箱即玩 |
| L1 静默登录 | openid（无昵称头像） | 积分云端存档、参与排行榜（显示为军衔名+默认徽记） | 启动时自动 `wx.login`，**不弹授权框** |
| L2 资料授权 | openid + 微信昵称/头像 | 排行榜显示真实昵称头像 | 用户主动点「同步微信头像昵称」（现有 `authUser()`） |

设计要点：**登录静默化，授权后置**。`wx.login` 不需要用户授权即可调用，启动即执行换取 openid；昵称头像授权（`wx.getUserInfo`）维持现有策略——只在用户点击档案弹层按钮时触发，拒绝后保留军衔身份，不反复骚扰。

### 2.2 登录流程（静默）

```
启动（splash 期间并行）
  ├─ wx.login({ success: r => r.code })
  │    ├─ 有后端：POST /api/login { code } → 返回 { openid, sessionToken }
  │    │         → 存 srd.user，拉取云端积分档案合并（见 §2.4）
  │    └─ 无后端/失败：跳过，保持 L0/L1 本地模式，不打断进入游戏
  └─ 失败（网络异常等）：静默降级游客，所有联网功能入口置灰
```

### 2.3 数据结构

**本地存储（新增/扩展）：**

```ts
// srd.user —— 登录态（新增）
interface UserSession {
  openid: string;        // 后端换取；无后端时为空串
  token: string;         // 后端签发的会话凭证（结算上报签名用）
  loginAt: number;       // 最近登录时间戳
}

// srd.profile —— 已有，扩展一个字段
interface Profile {
  nick: string;          // 微信昵称（授权后）
  avatarUrl: string;     // 微信头像 URL（授权后）
  real: boolean;         // 是否已授权
  openid?: string;       // 新增：冗余一份便于 UI 展示「已绑定」状态
}

// srd.score —— 积分档案（新增，本地缓存；同名 key 同步开放数据域，见 §4.3）
interface ScoreProfile {
  points: number;        // 累计积分（历史总产出，不减）
  season: number;        // 赛季编号（预留，初始 1）
  bestSingle: number;    // 单局最高积分
  perLevelBest: Record<number, number>; // 每关最高单局积分（异步挑战对比用）
  updatedAt: number;
}
```

**云端档案（有后端时，`users` 表草图）：**

| 字段 | 类型 | 说明 |
|---|---|---|
| openid | string (PK) | 微信 openid |
| nick / avatar | string | L2 授权后同步（可选，只读缓存，客户端仍可本地存） |
| points | int | 服务端认定的累计积分（校验后写入，见 §6） |
| best_single | int | 单局最高 |
| per_level_best | json | 各关最高 |
| banned | bool | 封禁标记（作弊处理用） |

### 2.4 与现有 `srd.profile` / `commanderRank()` 的关系与迁移

- **军衔不改入口**：`commanderRank()` 继续存在，但从"按通关数"升级为"按积分"（见 §3.2 军衔表）。为兼容已装包用户，迁移规则：
  - 首次启动新版本时读 `srd.progress.cleared.length`，按旧军衔对应的**保底积分**一次性补发（如已有 4 关通关 → 补到「战地指挥官」下限 800 分），写入 `srd.score`，避免老用户军衔倒退。
  - `displayNick()` 逻辑不变：L2 显示微信昵称，否则显示军衔名。
- **本地为主、云端兜底**：`srd.score` 始终以本地为准即时展示；L1 登录成功后与云端做一次 `max()` 合并（防换机丢档），冲突时取较大值并回写两端。

### 2.5 隐私与授权时机

| 时机 | 动作 | 依据 |
|---|---|---|
| 启动 | `wx.login` 静默换 openid | 属"登录"基础能力，无需授权弹窗 |
| 档案弹层点「同步微信头像昵称」 | `wx.getUserInfo`（现有 `authUser()`） | 用户明确点击触发，符合授权规范 |
| 首次进排行榜 | 不进授权流程，L0/L1 用军衔名+默认徽记参与 | 排行榜展示 nick 仅为可选增强 |
| 隐私协议 | mp 后台《用户隐私保护指引》需勾选「用户信息（微信昵称、头像）」「微信运动/排行榜类数据」 | 二期上排行榜前必须更新并通过审核 |

---

## 3. 积分体系

### 3.1 单局积分公式

输入全部来自结算时 `engine.state`（`st`）与现有评级逻辑（`wxgame/src/main.ts` `drawResult()`）：

```ts
// 结算积分（整数，仅胜利局计满分；失败局按进度打折）
function calcScore(st: GameState, difficulty: Difficulty, levelId: number): number {
  const DIFF_MUL: Record<Difficulty, number> = { easy: 0.8, normal: 1.0, hard: 1.4 };
  const grade = !won ? 'D' : st.leaked === 0 ? 'S' : st.leaked <= 2 ? 'A' : 'B';
  const GRADE_BONUS: Record<string, number> = { S: 1.25, A: 1.1, B: 1.0, D: 0.4 };

  const base =
    st.kills * 10 +                    // 击杀：每只 10 分
    st.wave * 60 +                     // 进度：每到达一波 60 分
    st.techs.length * 40 +             // 构筑深度：每个战术模块 40 分
    st.lives * 15 +                    // 防守质量：每剩 1 点生命 15 分
    levelId * 50;                      // 章节权重：越靠后的关基础分越高
  const leakPenalty = st.leaked * 30;  // 漏怪惩罚
  const score = Math.max(0, Math.round(
    (base - leakPenalty) * DIFF_MUL[difficulty] * GRADE_BONUS[grade]
  ));
  return score;
}
```

**量级校验**（普通难度、第 5 章、约 300 击杀、20 波、漏 2、剩 10 命、3 科技）：base ≈ 3000+1200+120+150+250−60 = 4660 → A 加成 ≈ 5126 分。通关全 13 章全 S 的硬核玩家累计约 8–10 万分，正好喂饱军衔表（§3.2）的中后段。

**与结算页的对接**：在 `drawResult()` 战绩面板「战术模块」行下方插入一行「积分 +N」（金色，数字滚动动画复用现有 count-up 逻辑）；评级圈右侧副文案同步显示军衔进度（"距「星环将星」还差 1,240 分"）。埋点扩展 `game_end` 增加字段 `score`、`grade`（均为 number/string，符合 `track()` 的微信自定义分析限制）。

### 3.2 累计积分与军衔等级表

军衔统一由累计积分 `srd.score.points` 决定，替换 `commanderRank()` 内部分档（函数签名不变，全 UI 自动生效）：

| 军衔 | 积分门槛 | 对应旧版（迁移锚点） | 权益 |
|---|---|---|---|
| 新晋学员 | 0 | 0 关 | — |
| 见习指挥官 | 500 | ≥1 关 | — |
| 战地指挥官 | 2,000 | ≥4 关 | 解锁排行榜展示位 |
| 星环将星 | 6,000 | ≥8 关 | 解锁皮肤「琥珀工业」积分兑换资格（见 §3.4） |
| 传奇统帅 | 15,000 | 13 关全通 | 排行榜徽记镀金、结算页专属称谓 |
| 星海元帅（新增） | 40,000 | — | 长期目标位，防止硬核玩家封顶 |

军衔提升瞬间在结算页/档案弹层触发 Toast（复用 `showToast`）：「晋升 · 星环将星」。

### 3.3 好友排行榜（开放数据域方案，二期）

**工程结构：**

```
wxgame/
├── game.json               # 增加 "openDataContext": "open-data"
├── src/main.ts             # 主域：不动渲染架构，新增 rank 屏
└── open-data/              # 开放数据域子工程（独立 game.json / project.config.json）
    ├── game.json           # { "deviceOrientation": "portrait" }
    └── index.js            # sharedCanvas 排行榜渲染
```

**主域 ↔ 开放数据域协议（postMessage）：**

| 方向 | 消息 | 说明 |
|---|---|---|
| 主→子 | `{ cmd: 'showRank', self: { nick, avatar, rank } }` | 进入排行屏时下发自身展示信息（子域读不到主域 profile） |
| 主→子 | `{ cmd: 'hideRank' }` | 离开排行屏 |
| 子→主 | `{ cmd: 'close' }` | 用户在排行榜点了关闭（子域触摸事件回传） |

**数据 key 约定：** 主域在每次结算后调用

```ts
wx.setUserCloudStorage({
  KVDataList: [
    { key: 'srd.score', value: String(scoreProfile.points) },            // 排行榜主排序字段
    { key: 'srd.score_detail', value: JSON.stringify({                  // 展示辅助（子域渲染用）
        nick: displayNick(), avatar: profile.avatarUrl,
        rank: commanderRank(), best: scoreProfile.bestSingle,
      }) },
  ],
});
```

开放数据域侧用 `wx.getFriendCloudStorage({ keyList: ['srd.score', 'srd.score_detail'] })` 拉好友数据，按 `srd.score` 降序在 sharedCanvas 自绘列表（名次/头像圆裁/昵称/军衔/积分，视觉沿用主域 `panel`/`chip` 语言）。**排行榜数据只能进开放数据域渲染，不能回传主域**——故「我在好友中排第 3」这类文案由子域直接绘制。

**主域入口：** splash 主菜单 entries 增加第 4 项「🏆 排行」（与图鉴/设置/档案同排），点击后 `goto('rank')`（新增 Screen），主域绘制背景与页头后，把开放数据域 sharedCanvas 以 `wx.getOpenDataContext().canvas` 绘制到排行内容区。未登录/无好友数据时空态：「邀请好友一起守星环」+ 分享按钮。

### 3.4 积分消耗与激励（二期）

| 消耗点 | 规则 | 对接 |
|---|---|---|
| 皮肤「琥珀工业」 | 军衔「星环将星」+ 消耗 3,000 积分解锁（积分设「消费积分」，与排行榜用的「累计积分」分账：消耗只扣 `spendable`，排行看 `points` 总额，防止"花了积分掉榜"） | 现有 `applySkin()` / `srd.skin`；设置中心皮肤卡加锁态「3000 积分解锁」 |
| 双倍战利 | 结算页现有占位按钮「◈ 双倍战利 · 观看视频」接入 `wx.createRewardedVideoAd`：看完广告本局积分 ×2 入账 | 流量主开通后替换 `showToast('广告模块开发中')` |
| 挑战复活（三期，联机用） | 联机局团灭时可花 500 消费积分继续 | C 档结算逻辑 |

`srd.score` 结构相应扩展：`{ points, spendable, bestSingle, perLevelBest, season, updatedAt }`（积分产出时 `points` 与 `spendable` 同增，消耗只减 `spendable`）。

---

## 4. 双人模式

### 4.0 三档方案对比

| 维度 | A · 同屏协作 | B · 好友异步挑战 | C · 实时联机协作 |
|---|---|---|---|
| 玩法 | 一台设备两人分工打同一局 | 分享挑战卡，各打各的同关比分 | 两台设备同图分路实时防守 |
| 后端 | 不需要 | 不需要（分数走分享 query + 本地对比） | **必须**（WebSocket 房间服务） |
| 引擎改动 | 零（纯 UI 输入路由） | 零（复用单人流程） | 大（确定性改造/状态同步） |
| 社交传播 | 弱（线下场景） | **强**（微信分享裂变） | 中（邀请制房间） |
| 反作弊压力 | 无 | 低（可作弊但只影响好友间面子） | 高 |
| 工作量评估 | **1–2 天** | **3–5 天** | **3–4 周+后端** |
| 期次 | MVP | 二期 | 三期 |

**推荐：MVP 上 A（成本极低、验证双人体验），二期上 B（拉新主引擎），三期上 C（深度玩法）。** A、B 互不冲突，C 可复用 B 的房间邀请链路。

### 4.1 A 档 · 同屏协作（MVP）

**玩法定义**：同一台手机，两名玩家面对面/并排，打**同一局单人战役**（关卡、难度、波次完全不变）。分工：

| 玩家 | 职责 | 独占操作区 |
|---|---|---|
| P1「工程官」 | 建造、拖拽放塔 | 底部塔栏（`BAR_H` 区域）+ 地图建造手势 |
| P2「战术官」 | 升级/出售、科技三选一、暂停/倍速/立即开战 | 选中塔后的底部升级出售栏、科技卡、顶部 HUD 指令钮 |

**页面流程：**

```
splash 主菜单「开始战役」→ home（选关页顶部新增分段控件：单人 / 双人同屏）
  → briefing（简报页底部注明分工：「P1 建造 · P2 指挥」）
  → battle（协作模式）
  → result（结算页标题改为「协同作战结算」，积分照常入账，埋点 coop=1）
```

**实现要点（纯 `main.ts` 触控层）：**

- `app` 增加 `coop: boolean`，home 页难度分段控件上方加 `segControl`「单人 / 双人同屏」（复用现有 `segControl` + `track('coop_toggle')`）。
- 触控路由：现有 `wx.onTouchStart/Move/End` 只取 `touches[0]`。协作模式下改为遍历 `e.touches`（微信支持多点），按触点落区归属 P1/P2：
  - 触点 y ≥ VH−BAR_H 且无选中塔 → P1 塔栏手势（现有 `barTouch` 逻辑，每触点一份实例）。
  - 有选中塔时底部升级/出售钮 → 归 P2（hooks 命中逻辑不变，天然分区）。
  - 科技 overlay 与 HUD 钮 → 归 P2；地图上"轻点选中塔"也归 P2（P1 只负责"拖拽/点选放置建造"，即 `app.placing` 路径）。
  - 两人同时操作的天然约束就是引擎 `dispatch` 本身（金币扣减原子性由单线程保证），**不需要任何锁**。
- HUD 提示：协作模式 prep 面板文案改为「P1 建造防线 · P2 把握升级与科技时机」。
- 引擎零改动；`track('game_start')` 增加 `coop: 1`。

**数据结构**：无新增存储键；仅 `game_start`/`game_end` 埋点带 `coop`。

### 4.2 B 档 · 好友异步挑战（二期）

**玩法定义**：A 玩家通关某关后分享「挑战卡」给好友；B 点开卡片直接进入**同一关同一难度**；打完后双方比分，败方收到「复仇」入口可回敬。全程无实时连接。

**挑战卡链路：**

```
A: result 页「⚔ 发起挑战」按钮（与「炫耀战绩」并列）
   → wx.shareAppMessage({
       title: `我在《高塔防线》第 ${lv} 关拿了 ${score} 分（${grade} 级），敢来吗？`,
       query: `challenge=${encodeURIComponent(payload)}`,
       imageUrl: 'assets/share-cover.jpg',
     })
B: 微信点开卡片 → 小游戏启动参数带 query
   → splash 检测到 challenge 参数 → 挑战确认弹层：
     「${A昵称} 在第 ${lv} 关（${难度}）拿下 ${score} 分 · ${grade} 级，接受挑战？」
     [接受挑战] → 强制锁定 levelId/difficulty → briefing → battle
B 结算: result 页顶部增加对决横幅：
     「你 ${scoreB} vs ${A昵称} ${scoreA} → 胜/负/平」
     [📣 回敬挑战]（带上双方成绩重新生成挑战卡，形成接龙）
```

**挑战载荷（query，≤1024 字符，微信限制）：**

```ts
interface ChallengePayload {  // base64url(JSON) 后放入 query.challenge
  v: 1;                 // 协议版本
  lv: number;           // 关卡 id
  diff: Difficulty;     // 难度
  score: number;        // 挑战者积分
  grade: 'S'|'A'|'B'|'D';
  nick: string;         // 挑战者展示名（军衔名兜底，无需授权）
  ts: number;           // 发起时间戳（>7 天的挑战卡提示"已过期，仍可游玩该关"）
  sig: string;          // 防手改：H 简易签名 = hash(lv+diff+score+ts+本机盐)
}
```

**关键实现点：**

- 启动 query 读取：主域 `wx.getLaunchOptionsSync().query`，splash 初始化时解析一次，存入 `app.pendingChallenge`；splash 菜单出现后弹确认层（复用弹层绘制模式）。
- B 侧若该关未解锁：**允许挑战**（挑战局不推进 `srd.progress`，只比积分），结算时标注「挑战局 · 不影响战役进度」。这是对现有进度锁规则的**唯一例外**，需在 `recordLevelClear` 前判断 `app.challengeMode`。
- 挑战局埋点：`track('challenge_accept', { level_id, challenger_score })`、结算 `game_end` 带 `challenge: 1`；发起方 `share_click` 已有，channel 新增 `challenge`。
- 与排行榜联动：挑战局积分照常计入 `srd.score`（它是真实单人成绩），并刷新 `perLevelBest`。

**工作量**：启动参数解析 + 确认弹层 + 结算对决横幅 + payload 编解码，约 3–5 天，无后端。

### 4.3 C 档 · 实时联机协作（三期）

**玩法定义**：两名玩家各自设备进入**同一张加宽地图**，虫群分两路进攻（左路归 P1 防区、右路归 P2 防区），共享基地生命、经济各自独立，任意一路漏怪扣共享生命——协作压力来自"要不要卖塔救队友"。

**架构草图：**

```
┌──────────┐   WebSocket    ┌─────────────────┐   WebSocket   ┌──────────┐
│ 客户端 A  │ ◄───────────► │  房间服务 (Node)  │ ◄───────────► │ 客户端 B  │
│ createEngine               │  · 房间/匹配     │               │ createEngine
│ (本地模拟) │  ─ 指令帧 ─►  │  · 指令转发(锁步) │  ◄─ 指令帧 ─  │ (本地模拟) │
└──────────┘                │  · 结算仲裁      │               └──────────┘
                             └─────────────────┘
```

- **同步模型：确定性锁步（lockstep）**。引擎已是纯 TS 无 DOM（`app/src/game/engine`），联机前需做确定性审计：把引擎内所有 `Math.random()`（如科技三选一的候选抽取）替换为种子化 RNG（复用 `main.ts` 里已有的 mulberry32 `rng()` 模式），种子由服务器建房时下发。双方每 200ms 逻辑帧交换指令（BUILD/UPGRADE/SELL/PICK_TECH），服务器只做转发与帧对齐，不跑游戏逻辑（省成本）。
- **降级**：若确定性改造风险过高，备选「主机权威」模型——建房方跑唯一引擎，客机只发指令、收状态快照（带宽约 5–10 KB/s，快照用增量 JSON）。决策点写进三期开工评审。
- **房间与邀请**：复用 B 档的分享链路——`query: room=ROOMID`，好友点开即入房（`wx.login` 拿 openid 做房间身份）。暂不做陌生随机匹配，只做好友房。
- **断线**：30 秒心跳；掉线方的防区冻结（塔停火、不新建），60 秒内重连恢复，否则该路按"托管 AI"自动挂机到本局结束。
- **结算**：共享生命 > 0 且守完全部波次 → 双方都按 §3.1 公式计分（各自 kills/wave 统计），额外 +20%「协同加成」；服务器对双方上报的结算做一致性比对（见 §6）。

**新增状态（客户端）：**

```ts
interface CoopSession {
  roomId: string;
  role: 'host' | 'guest';
  seed: number;            // 服务器下发的确定性种子
  peerNick: string;
  lane: 0 | 1;             // 我守的路
  wsReady: boolean;
}
```

---

## 5. 新增/变更的埋点

统一走 `track()`（`wxgame/src/analytics.ts`，wx.reportEvent；事件 id 英文蛇形、值 string/number）：

| 事件 | 触发 | 关键字段 | 期次 |
|---|---|---|---|
| `login_ok` | 静默登录成功 | `level`（1/2） | MVP |
| `score_gain` | 结算积分入账 | `score, grade, level_id, coop` | MVP |
| `coop_toggle` | 选关页切换单/双人 | `mode` | MVP |
| `rank_view` | 进入好友排行 | — | 二期 |
| `challenge_send` | 发起异步挑战 | `level_id, score` | 二期 |
| `challenge_accept` | 接受挑战 | `level_id, challenger_score` | 二期 |
| `room_create / room_join / room_finish` | 联机房间生命周期 | `room_id`（hash 后）, `result` | 三期 |

现有 `game_end` 扩展字段：`score`、`grade`、`coop`、`challenge`（向后兼容，微信自定义分析允许加字段）。

---

## 6. 反作弊与积分校验

**MVP（无后端，弱防护，认栽范围内）：**

- 挑战卡 payload 带 `sig`：对本机随机盐（首次启动生成存 `srd.salt`）做 `hash(lv|diff|score|ts|salt)`，防止玩家手工改 query 里的分数伪造挑战卡。**盐在本地即可被扒，只防君子不防黑客**，可接受——伪造者只能骗好友。
- 结算合理性客户端自检：积分公式是纯函数，入账前用 `st` 重算一遍比对（防内存修改器直接改 `srd.score` 的最低成本手段）；`points` 单日增长超过理论上限（13 章 × 满分 × 3 难度 ≈ 12 万）时标记本地 `flag`，暂停云端同步。

**三期（有后端，服务端校验）：**

1. **结算上报签名**：客户端把结算明细（`levelId, diff, kills, leaked, wave, lives, techs, durationSec, seed`）+ 时间戳用 `sessionToken` 派生密钥 HMAC-SHA256 签名上报；服务端验签防伪造请求。
2. **范围校验（server-side）**：服务端用同一公式重算积分，与上报值容差 ±1（取整误差）；并校验硬约束——`kills` 不超过该关总出怪数、`wave ≤ totalWaves`、`durationSec ≥ 该关最短理论时长`（按 2 倍速 + 全部 SKIP_PREP 估算）。不通过的分数丢弃并累计 `cheat_score`，阈值封禁（`users.banned`）。
3. **联机局交叉验证**：双方各自上报结算，服务器比对 `wave/lives/seed` 一致性，不一致则整局作废。
4. **频控**：同一 openid 结算上报 ≥ 10 次/分钟 直接拒绝。

---

## 7. 页面改动清单（对接现有结构）

| 页面 | 改动 | 期次 |
|---|---|---|
| splash | 菜单第 4 入口「🏆 排行」；启动时静默登录 + 挑战 query 检测弹层 | MVP / 二期 |
| home | 难度分段控件上方加「单人 / 双人同屏」切换 | MVP |
| briefing | 双人模式注明分工；挑战局显示挑战者成绩横幅 | MVP / 二期 |
| battle | 多点触控按区域路由 P1/P2；prep 面板协作文案 | MVP |
| result | 战绩面板加「积分 +N」行与军衔进度；「⚔ 发起挑战」按钮；挑战局对决横幅 | MVP / 二期 |
| rank（新增 Screen） | 开放数据域 sharedCanvas 好友排行 | 二期 |
| 档案弹层 | 增加积分/军衔进度条、「已绑定 openid」状态、皮肤积分兑换入口 | MVP / 二期 |
| 设置中心 | 皮肤卡锁态（积分解锁） | 二期 |

---

## 8. 存储键总表

| 键 | 读写方 | 说明 | 期次 |
|---|---|---|---|
| `srd.progress` | 主域（已有） | 通关章节；挑战局不写 | — |
| `srd.profile` | 主域（扩展） | 增加 `openid` 字段 | MVP |
| `srd.user` | 主域（新增） | 登录态 openid/token | MVP |
| `srd.score` | 主域 + 开放数据域（新增） | 积分档案；云端/开放数据域同名同步 | MVP / 二期 |
| `srd.salt` | 主域（新增） | 挑战卡签名盐 | 二期 |
| `srd.skin` | 主域（已有） | 皮肤；积分解锁只改解锁判定 | 二期 |

---

## 9. 审核与合规注意点

- **排行榜/用户生成内容**：好友排行展示微信昵称头像，属平台提供的好友关系数据，无需 UGC 类目；但须在 mp 后台《用户隐私保护指引》更新「排行榜」相关条目，二期提审前完成。
- **虚拟积分**：积分为不可充值、不可提现的游戏内数值，不涉及虚拟货币类目；**禁止**出现积分购买/交易入口，否则触发虚拟支付审核（iOS 端尤其敏感）。
- **激励广告**：双倍战利需流量主开通 + 广告组件审核，文案不得出现"必得"类承诺。
- **实时联机（三期）**：涉联网对战，确认小程序游戏类目与版号状态覆盖多人在线玩法；若走微信云开发则减少自有服务器备案负担。
