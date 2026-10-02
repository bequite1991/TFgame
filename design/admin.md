# 《高塔防线》管理端设计文档（Admin Console）

> 面向运营/开发的 Web 管理后台 · 数据看板 · 用户管理 · 运营配置 · 平衡热更 · 发布管理
> 关联文档：`项目规划书.md`、`design/design.md`、`design/game.md`、`design/home.md`
> 客户端实现基线：`wxgame/src/main.ts`（小游戏）、`wxgame/src/analytics.ts`（埋点）、`app/src/game/`（共用引擎）

---

## 1. 定位与技术选型

### 1.1 定位

管理端是给**运营与开发人员**使用的内部 Web 后台，不面向玩家。核心职责：

1. **看清楚**：玩家在 13 章战役中的漏斗、难度分布、分享转化（数据看板）。
2. **管得住**：openid 维度的用户查询、积分调整、封禁（用户管理）。
3. **改得快**：公告、活动位、广告开关、皮肤上架、难度/关卡数值热更（运营与平衡配置）。
4. **追得上**：`__BUILD_ID__` 构建号与微信后台版本的对应关系（发布管理）。

### 1.2 技术选型对比

| 方案 | 描述 | 优点 | 缺点 |
|---|---|---|---|
| **A. 复用 `app/`，新增 `app/src/admin/`** | 在现有 React 19 + Vite + TS + Tailwind + shadcn(Radix) 工程内加 `/admin/*` 路由组 | 零新增依赖（Radix 全家桶已在 `app/package.json`）；复用视觉 token 与 `ui.tsx`；一条构建管线 | 与玩家 H5 同包，需路由级代码分割 + 部署路径隔离 |
| B. 独立 Vite 应用（`admin/`） | 另起 React + Vite 工程 | 包体/权限隔离干净 | 重复安装依赖、重复维护构建与视觉体系 |
| C. 微信云开发控制台 | 用云开发自带的数据库/云函数管理页 | 零开发 | 只有裸数据表，无看板/漏斗/配置编辑器，运营不可用 |

**推荐：方案 A（`app/src/admin/`）。** 一期管理端以只读看板为主，同工程开发成本最低；`App.tsx` 中按路径前缀 `import('./admin/...')` 懒加载，玩家侧包体不受影响。二期接入自建后端、出现鉴权与写操作后，再视团队规模决定是否拆分为方案 B。方案 C 仅作为二期数据库选型的候选（见 §3.1），不作为管理端本身。

### 1.3 页面信息架构

```
/admin
├── /login            登录（二期起，一期局域网/密码门）
├── /dashboard        数据看板（MVP）
├── /funnel           关卡漏斗 & 难度分布（MVP）
├── /viral            分享转化（MVP）
├── /users            用户管理（二期）
├── /ops              运营配置：公告 / 活动位 / 广告开关 / 皮肤（二期）
├── /balance          平衡配置：难度系数 / 波次热更（二期）
└── /release          构建发布管理（MVP，手动登记 → 二期自动）
```

视觉沿用 §2.1 色彩系统（`--bg-deep #070B18`、`--primary #22E0FF`），管理端定位为"指挥部战术终端"的另一半，不另立风格。

---

## 2. 客户端埋点现状盘点（一切设计的数据基础）

`wxgame/src/analytics.ts` 的 `track()` 走 `wx.reportEvent`（基础库 2.14.4+，回退 `reportAnalytics`），事件直报**微信小游戏后台 → 统计 → 自定义分析**，目前无自建收集服务。现有事件清单（来自 `main.ts` 实际调用点）：

| 事件 id | 触发点 | 字段 | 用途 |
|---|---|---|---|
| `game_start` | 简报页点击开战（main.ts:1785） | `level_id, difficulty` | 漏斗入口、难度分布 |
| `game_end` | 引擎 `gameOver` 事件（main.ts:2754） | `level_id, difficulty, result(win/lose), wave_reached, duration_sec, kills, leaks` | 漏斗出口、失败波次热点、时长/击杀分布 |
| `share_click` | 菜单被动分享 / 结算页主动分享（main.ts:119, 2265） | `channel(menu/result), result, wave` | 分享转化 |
| `chapter_select` | 选关（main.ts:1212） | `level_id` | 章节关注度 |
| `difficulty_select` | 难度切换（main.ts:1575） | `difficulty` | 难度分布 |
| `tower_build` | 建塔（main.ts:2950, 3045） | `tower_type, level_id, wave` | 平衡分析（塔使用率） |

**一期需补的埋点（随下个版本发布，不改结构只加字段/事件）：**

| 事件/字段 | 内容 | 原因 |
|---|---|---|
| `game_end.grade` | `S/A/B/D` | 评级已在结算页算出（main.ts:2235：`leaked==0→S, ≤2→A, 其余→B, 失败→D`），但未上报，看板无法做"完美防线率" |
| `app_launch` | `scene, build_id` | 区分分享卡片回流（scene 1044 等）、核对 `__BUILD_ID__` 版本覆盖率 |
| `auth_result` | `granted(0/1)` | `authUser()` 授权成功率（与 §4.2 用户体系绑定） |
| `ad_reward` | `placement, finished(0/1)` | 二期激励视频（双倍战利）转化 |

---

## 3. 后端与数据流

### 3.1 分期架构

```
【一期 MVP：零自建后端】
客户端 track() ──reportEvent──► 微信小游戏后台「自定义分析」
管理端 = 静态部署的 app/dist（/admin 路由），看板数据由人工/脚本
        从微信后台导出 CSV 定期导入（public/data/*.json），只读展示。
依赖：无后端、无审核新增项。仅能看 T+1 聚合数据。

【二期：自建收集服务 + openid 体系】
客户端 track() ──HTTPS──► 收集服务（Node/云函数）──► 数据库
wx.login() ──code──► 登录云函数 ──code2session──► openid 入库
管理端 /admin ──REST API + 会话鉴权──► 同一服务
依赖：自建后端（或微信云开发）、request 合法域名配置、备案域名。

【三期：实时/准实时】
事件 Kafka/队列化、看板准实时刷新、配置下发带灰度与回滚。
```

二期后端二选一：

| 选项 | 说明 | 适用 |
|---|---|---|
| 微信云开发（云函数 + 云数据库） | 免备案域名、免运维，code2session 天然打通 | 团队 ≤2 人、事件量 < 100 万/日（**默认推荐**） |
| 自建 Node 服务（Hono/NestJS + Postgres） | 数据完全自主，可接任意 BI | 事件量大或需跨端（H5 + 小游戏）统一数仓时 |

### 3.2 表结构（二期，字段级定义）

**`users` —— 用户档案（与客户端 `srd.profile` 对应，服务端为准）**

| 字段 | 类型 | 说明 |
|---|---|---|
| `openid` | string PK | `wx.login` code2session 换取 |
| `unionid` | string? | 绑定开放平台后回填（跨端预留） |
| `nick` / `avatar_url` | string | 授权后同步（客户端 `authUser` 成功后上报） |
| `rank` | string | 军衔冗余字段：`新晋学员/见习指挥官/战地指挥官/星环将星/传奇统帅`，按 `cleared_count` 由服务端按 `commanderRank()` 同规则计算 |
| `cleared` | int[] | 已通关章节（迁移自客户端 `srd.progress.cleared`） |
| `score_total` | int | 累计积分（预留，见 multiplayer 文档） |
| `status` | enum | `normal / banned`（封禁只读标记，客户端拉配置时返回） |
| `created_at` / `last_seen_at` | timestamp | 首登/最近活跃 |

**`scores` —— 单局成绩（每次 `game_end` 一条）**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 自增 |
| `openid` | string FK | 关联 users |
| `level_id` | int | 章节 1–13 |
| `difficulty` | enum | `easy/normal/hard` |
| `result` | enum | `win/lose` |
| `grade` | enum | `S/A/B/D`（一期补埋点后入库） |
| `wave_reached` / `kills` / `leaks` / `duration_sec` | int | 与 `game_end` 字段一一对应 |
| `build_id` | string | `__BUILD_ID__`（格式 `bMMDD-HHmm`），用于按版本过滤数据 |
| `sig` | string | 结算签名（HMAC，见 multiplayer 文档反作弊节；一期可为空） |
| `created_at` | timestamp | 服务端落库时间 |

**`events` —— 原始事件流水（`track` 全量落库，冷数据 90 天）**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` / `openid` / `event_id` / `build_id` / `created_at` | — | 基本维度 |
| `data` | jsonb | 事件载荷（键值 string/number，沿用微信自定义分析约束） |

**`configs` —— 运营/平衡配置（key-value，版本化）**

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | string PK | 如 `notice` / `home_banner` / `ad_double_loot` / `balance.difficulty` / `balance.waves.lv05` / `skins.catalog` |
| `value` | jsonb | 配置体（结构见 §4.3/§4.4） |
| `version` | int | 每次发布 +1，客户端按版本号缓存 |
| `enabled` | bool | 总开关 |
| `updated_by` / `updated_at` | — | 操作审计 |

**`releases` —— 构建发布登记**

| 字段 | 类型 | 说明 |
|---|---|---|
| `build_id` | string PK | `bMMDD-HHmm`，与 `wxgame/build.mjs` 生成规则一致 |
| `wx_version` | string | 微信后台上传的开发版本号 |
| `git_commit` | string | 提交哈希 |
| `notes` | text | 发布说明 |
| `status` | enum | `dev / trial(体验版) / released` |
| `released_at` | timestamp | 提审/发布时间 |

**`admins` —— 管理端账号**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` / `email` / `password_hash` | — | 账密登录（bcrypt） |
| `role` | enum | `super / ops / readonly`（见 §3.4） |
| `last_login_at` | timestamp | 审计 |

所有写操作（积分调整、封禁、配置发布）追加 `audit_logs(actor, action, target, before, after, at)`。

### 3.3 API 草图（二期，REST，前缀 `/api`）

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| POST | `/auth/login` | 公开 | 管理端账密登录，返回会话 token |
| GET | `/stats/overview?from&to` | readonly+ | DAU/新增/次留/7留、对局数、胜率 |
| GET | `/stats/funnel?level_id&difficulty` | readonly+ | `game_start→game_end(win)` 漏斗、失败波次分布 |
| GET | `/stats/viral` | readonly+ | `share_click` 按 channel、分享回流（`app_launch.scene`） |
| GET | `/users?openid=&status=` | ops+ | 用户检索 |
| POST | `/users/{openid}/score` | ops+ | 积分调整 `{delta, reason}`（写 audit） |
| POST | `/users/{openid}/ban` | super | 封禁/解封 |
| GET/PUT | `/configs/{key}` | readonly / ops+ | 读取 / 发布配置（version+1） |
| POST | `/configs/{key}/rollback` | super | 回滚到指定 version |
| GET/POST | `/releases` | readonly / ops+ | 版本登记与查询 |
| POST | `/collect` | 客户端 | track 批量上报（gzip，30s 或 20 条 flush，失败静默丢弃，不阻塞游戏） |
| GET | `/client/config?version=` | 客户端 | 客户端拉配置：返回变更的配置项 + `user.status`（封禁校验） |

客户端侧约定：配置拉取在 splash 阶段进行，缓存到 `wx.setStorageSync('srd.remoteConfig')`；拉取失败/离线时使用缓存，缓存也没有则用代码内置默认值——**任何配置缺失都不能阻断进入游戏**（与 `track()` 的静默降级风格一致）。

### 3.4 权限模型与登录

| 角色 | 数据看板 | 用户查询 | 积分调整 | 配置发布 | 封禁/回滚/账号管理 |
|---|---|---|---|---|---|
| `super` 超管 | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ops` 运营 | ✓ | ✓ | ✓ | ✓ | ✗ |
| `readonly` 只读（开发/外包） | ✓ | ✓（脱敏，openid 打码） | ✗ | ✗ | ✗ |

- 一期无后端：管理端静态部署于内网/带 Basic Auth 的静态托管即可，不落任何玩家隐私数据。
- 二期登录：账密 + 会话 cookie（HttpOnly, SameSite=Strict）；可选叠加企业微信扫码。连续 5 次失败锁定 15 分钟。所有页面会话 12h 过期。

---

## 4. 功能模块

### 4.1 数据看板（MVP）

一期数据来自微信后台「自定义分析」导出的聚合 CSV（脚本 `app/tools/import-mp-csv.mjs` 转为 `public/data/*.json`），管理端纯前端渲染。二期切到 `/stats/*` API，界面不变。

**看板一：总览卡片**
- 日活/新增、对局数（`game_start`）、通关率（`game_end result=win / game_start`）、平均时长（`duration_sec`）、分享次数（`share_click`）。
- 每个卡片带 7/30 日趋势 sparkline（样式参考 `app/src/pages/Stats.tsx` 最近 10 场 sparkline）。

**看板二：关卡漏斗（13 章 × 3 难度）**
- 每章：`chapter_select → game_start → game_end(win)` 三级转化 + 失败波次直方图（`wave_reached` 按 lose 聚合）→ 定位"卡死玩家的那一波"。
- 完美防线率：`game_end.grade` 分布（S/A/B/D，需一期补埋点字段，见 §2）。

**看板三：难度分布与平衡**
- `difficulty_select` 占比、`game_start` 按难度分组的胜率对比。
- 塔使用率：`tower_build` 按 `tower_type × level_id` 热力表 → 发现冷门塔（如某塔全章使用率 <5% 进入平衡观察名单）。

**看板四：分享转化**
- `share_click` 按 `channel`（menu/result）拆分；`result=win` 与 `wave` 分布（验证"守到第 N 关"分享钩子文案效果，文案见 main.ts:111 `shareTitle()`）。
- 二期补 `app_launch.scene` 后计算分享回流率 = 分享场景启动 / share_click。

### 4.2 用户管理（二期）

- **检索**：openid / 昵称模糊搜索；列表列：军衔、已通关章节数（对齐客户端 `commanderRank()` 的 5 档规则）、累计积分、最近活跃、状态。
- **详情**：该用户 `scores` 最近 20 局（含 `grade`/`build_id`）、进度时间线。
- **操作**：
  - 积分调整：弹窗填 `delta` + 必填 `reason`，写入 `audit_logs`，二次确认（参照 H5 版 Stats 页"清除存档"的二次确认交互）。
  - 封禁：super 专属；封禁后该 openid 的 `/client/config` 返回 `status=banned`，客户端 splash 拉配置时弹出"账号异常"并禁止上报成绩（单机游玩不受影响——纯离线游戏不做强制踢出）。
- **与客户端存储的迁移关系**：二期登录打通后，服务端以 `srd.progress.cleared` / `srd.profile` 首次上报值为初始值，之后服务端为准；客户端键名保持不变，避免老用户丢档。

### 4.3 运营配置（二期）

管理端编辑 → `configs` 表发布 → 客户端 splash 拉取生效。配置项与客户端页面对应关系：

| 配置 key | 结构 | 客户端落地位置 |
|---|---|---|
| `notice` 公告 | `{title, body, level: 'info'|'urgent', startsAt, endsAt}` | splash 之后、home 之前弹一次（`srd.noticeSeen = version` 去重）；urgent 级每次启动弹 |
| `home_banner` 活动位 | `{image, title, link(微信内页面/文章), startsAt, endsAt}` | home 页军衔卡片下方活动槽位（无配置则收起，不占布局） |
| `ad_double_loot` 双倍战利 | `{enabled, placement, dailyLimit}` | result 结算页激励视频位（现有占位）；开关关闭时按钮隐藏。配 `ad_reward` 埋点 |
| `skins.catalog` 皮肤上架 | `[{id, name, status: 'live'|'hidden'|'locked', unlock: {type:'progress', need} | {type:'score', need}}]` | home/档案页皮肤选择列表；新增皮肤仍需随版本发素材，配置只控制**上架状态与解锁条件**（素材必须已在包内） |

所有配置带 `startsAt/endsAt` 时间窗与预览模式（管理端输入测试 openid，该用户拉配置时无视时间窗，便于上线前验收）。

### 4.4 平衡配置热更（二期）

现状：`DIFFICULTIES`（config.ts:361）、13 章 `LEVELS` 波次表（levels.ts）编译进 `game.js`，改数值必须发版。热更方案：

| 方案 | 说明 | 结论 |
|---|---|---|
| 配置下发（推荐） | 把难度系数与波次表抽象为可覆盖 JSON：客户端启动拉 `balance.*`，引擎构造时 merge 覆盖内置值 | 改系数/波次构成不用发版 |
| 版本更新 | 维持现状，走 `wx.getUpdateManager`（main.ts:92 已有更新提示） | 结构性改动（新塔/新敌/新机制）仍必须发版 |

**下发数据结构**（`configs.key = 'balance.difficulty'`）：

```json
{
  "version": 7,
  "overrides": {
    "normal": { "hpMul": 1.08, "gold": 380 },
    "hard":   { "lives": 14 }
  }
}
```

`balance.waves.lv{NN}` 同构：`{"overrides": {"12": {"groups": [...], "reward": 620}}}`。客户端校验：字段白名单 + 数值范围钳制（如 `hpMul ∈ [0.5, 2.0]`），校验失败整体丢弃回退内置值并 `track('config_rejected', {key, version})`。

**安全边界**：热更只允许调**数值与波次构成**，不允许下发可执行逻辑；管理端发布前提供"模拟器"——用引擎纯逻辑层（`app/src/game/`，零 UI 依赖）在管理端页面内跑一遍该章快速仿真，输出通关率预估后再允许点发布。发布/回滚全部留 `audit_logs`。

### 4.5 构建发布管理（MVP 手动，二期自动）

- **MVP**：`/admin/release` 页面手动登记：`build_id`（构建机 `node build.mjs` 输出，水印显示在 splash 右下角，main.ts:1462）、微信开发版本号、git commit、状态流转 `dev→trial→released`、发布说明。看板的所有图表按 `build_id` 过滤，确认"真机上跑的是哪次构建"。
- **二期**：`build.mjs` 构建后自动 `POST /releases`（读取 git commit）；提审/发布状态由人工更新。配合 `app_launch.build_id` 埋点看版本覆盖率（发布后 48h 老版本占比 >20% 时在看板标黄提醒）。

---

## 5. 与微信审核的关系

| 事项 | 审核/资质注意点 |
|---|---|
| 管理端本身 | 纯内部 Web 工具，**与小游戏审核无关**，不随包提交 |
| 用户体系（openid） | `wx.login` 静默登录不需授权弹窗，不触发类目变更；头像昵称属用户授权信息，`getUserInfo` 需用户主动触发（现 `authUser` 已是按钮触发），管理端展示时 readonly 角色脱敏 |
| 虚拟积分 | 积分不可充值、不可兑换现金/实物，仅游戏内解锁皮肤——按"游戏道具"管理；**禁止出现积分买卖/提现文案**，否则触发虚拟支付类目要求（iOS 侧尤其敏感） |
| 排行榜（开放数据域，二期） | 好友排行榜属微信允许的标准能力；**全服排行榜**需自行保证内容合规，且无 UGC 时可不做内容安全类目 |
| UGC | 本项目不产生用户发布内容（无评论/自定义关卡），一期二期均不涉及 UGC 类目；若三期加"自定义关卡分享"则必须接微信内容安全 API（`msgSecCheck`）并补类目 |
| 激励视频（双倍战利） | 需开通流量主；`ad_double_loot` 开关保证审核期间可远程关闭广告位 |
| 公告/活动位 | 运营文案经 `configs` 下发，绕过版本审核——**这是权限也是风险**：发布权限收敛到 ops+，全部留审计；不得下发与提审版本玩法不符的诱导性内容（微信《小游戏运营规范》禁止） |

---

## 6. 分期落地路线汇总

| 期 | 内容 | 依赖 |
|---|---|---|
| **MVP（一期）** | `app/src/admin/` 路由组 + 静态看板（微信后台 CSV 导入）：总览/关卡漏斗/难度分布/分享转化；构建发布手动登记；客户端补埋点字段（`game_end.grade`、`app_launch`、`auth_result`） | 无需后端、无需开放数据域、无新增审核项；随一次版本更新带上补的埋点 |
| **二期** | 自建收集服务（默认微信云开发）：`wx.login`→openid、users/scores/events/configs 四表落地；管理端登录与三角色权限；用户管理（查询/积分调整/封禁）；运营配置（公告/活动位/广告开关/皮肤上架）；平衡热更（数值覆盖下发 + 管理端仿真校验）；版本自动登记 | 需要后端（云开发或自建）、request 合法域名、流量主（若开广告）；`ad_reward` 埋点随版发布 |
| **三期** | 准实时看板、配置灰度（按 openid 尾号分批）与一键回滚、积分与好友排行榜联动（开放数据域工程，见 multiplayer 文档）、跨端（H5+小游戏）统一数仓 | 开放数据域工程、自建数仓/BI、视 UGC 功能决定内容安全类目 |

**关键设计决策回顾：**

1. 管理端**复用 `app/` 工程**加 `/admin` 路由，不另起炉灶；二期后端**默认微信云开发**，保留自建 Postgres 选项。
2. 一期**零后端**——微信后台自定义分析 + CSV 导入即能满足看板需求，自建服务推迟到有 openid 需求（二期）再上。
3. 配置与平衡的客户端契约：**静默降级**（拉不到用缓存，缓存没有用内置），与 `track()` 的容错风格一致；热更只调数值不下发逻辑，发布前必须过引擎仿真。
4. 客户端存储键（`srd.progress/skin/profile`）保持向后兼容，服务端数据以首次上报为迁移起点。
5. 运营配置是绕审核通道，发布权限收敛 + 全量审计日志作为对冲。

---

*本文档与 `wxgame/src/main.ts`、`wxgame/src/analytics.ts`、`wxgame/build.mjs`、`app/src/game/config.ts` 当前实现核对一致；引用的行号与键名以仓库现状为准。*
