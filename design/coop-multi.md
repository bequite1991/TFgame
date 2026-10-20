# 多人联机（3–4 人）扩展设计 — coop-multi.md

> 基线：`design/coop-online.md`（双人主机权威，已上线）。本文档回答「能不能多几个人一起玩」——**能，推荐上限 4 人**，在现有架构上做槽位化扩展，不换同步模型。

## 0. 结论与关键决策

| 问题 | 决策 | 理由 |
|---|---|---|
| 最多几人 | **4 人**（房间内 2–4 人开局） | 主机上行带宽 = 快照 × 客机数，5Hz × ~5KB × 3 ≈ 75KB/s 是手机热点的舒适上限；网格地图 4 条路是布局可读性极限；再多需换服务器权威模型 |
| 同步模型 | 沿用**主机权威**，不搞锁步 / 服务器跑引擎 | `design/coop-online.md` §1 的评审结论对 N 人依然成立：客机零模拟，天然免疫「某个客机掉线拖死全局」；服务器继续纯转发，成本不随人数增长逻辑 |
| 客机体验 | 每个客机仍是「幽灵引擎 + 快照插值」 | `ghost.ts` 与人数无关，零改动 |
| 断线 | 客机掉线：塔继续自动作战（引擎在主机），60s 可重连；主机掉线：60s 未回解散（与现规则一致，不做主机迁移） | 主机迁移要转移整个引擎状态 + 选举，复杂度高收益低，好友房场景重开一局成本可接受 |

## 1. 玩法规则（2–4 人通用）

双人局的所有规则平移，只把「双方」泛化为「各玩家」：

- **地图与分路**：新增 4 路协作图（`levels.ts` 的 `paths[]` 原生支持 N 条路径，第 6 关已有 3 路先例）。玩家槽位 slot 0–3 按顺时针各占一条路的建造区；建造区互不重叠。
  - 不满 4 人开局：虫群只分配到「有人守的路」上（出怪调度按活跃路数取模），空路不出怪、不可建造。
- **共享生命**：任一路漏怪扣同一 `lives`；初始生命随人数微调（2 人 100% / 3 人 110% / 4 人 120%），防止人数越多死得越快。
- **经济独立**：`golds[]` 每人一池，击杀奖励归击杀者（`tower.owner`）。初始金币每人相同，不随人数摊薄——协作的爽点在于各自成型、互相补漏。
- **强度缩放**：虫群 HP 系数按人数 2 人 ×1.0 / 3 人 ×1.45 / 4 人 ×1.85（亚线性：人多塔多但配合有损耗），出怪总量按人数线性。数值在 `config.ts` 以 `COOP_HP_MUL[players]` 表驱动，便于平衡调整。
- **科技三选一**：MVP 仍由主机玩家为准（全员可见结果）；后续可升级为「每人每波独立三选一」（引擎改动小，`techs` 按 owner 分池），列为二期增强。
- **塔的归属**：`TowerState.owner` 已是 `number`，天然支持 0–3；BUILD 扣对应玩家金币，UPGRADE/SELL 仅 owner 可操作。
- **结算**：各自按 `multiplayer.md` §3.1 公式计分（各算各的 kills/wave），协同加成改为按人数 2 人 ×1.2 / 3 人 ×1.3 / 4 人 ×1.4；埋点 `coop: N`。

## 2. 房间服务改造（coop-server/server.js）

核心：把 `room.guest` 单槽位改为 `members[4]` 槽位数组，`host` 即 `members[0]`。仍然不跑任何游戏逻辑。

### 数据结构

```ts
interface Member { nick: string; ws: WebSocket|null; online: boolean; lastMsgAt: number; ready: boolean }
interface Room {
  id: string;
  levelId: number; difficulty: string;
  maxPlayers: number;          // 2–4，建房时定
  members: (Member | null)[];  // 长度 maxPlayers；members[0] 恒为主机
  started: boolean;            // 开局后不再接受新 join（只接受 rejoin）
  hostLostTimer: Timeout|null;
  emptySince: number|null;
}
```

### 协议变更（字段 `t`，向后兼容：缺省 `maxPlayers` = 2，行为与现版完全一致）

客户端 → 服务器：

| 消息 | 变更 |
|---|---|
| `{t:'create', nick, levelId, difficulty, maxPlayers?}` | 新增 `maxPlayers`（2–4，缺省 2）→ 回 `{t:'room', roomId, role:'host', slot:0, maxPlayers}` |
| `{t:'join', roomId, nick, rejoin?, slot?}` | 新房客占**最小空槽位**；满员回 `room_full`。回包带 `slot` 与全量 `members` 名册 |
| `{t:'ready', ready}` | 新增：客机就绪/取消就绪（开局前） |
| `{t:'start'}` | 新增：仅主机可发；校验 ≥2 人在线且全员就绪 → 广播 `{t:'start', players:[{slot,nick}]}`，房间转 `started` |
| `{t:'cmd', player, cmd}` | 路由改变：任何客机 → **只发主机**（不再「发给对方」）；主机本地指令本来就走本地 dispatch，不上网 |
| `{t:'snap', state, events}` | 仅主机可发；转发给**所有在线客机** |
| `{t:'end', won}` | 仅主机仲裁；广播全体成员后解散（同现规则） |
| `{t:'leave'}` | **客机离开不再解散房间**：广播 `{t:'peer', slot, status:'left'}`，释放槽位（局内离开则其塔由引擎托管继续开火）；主机离开仍解散 |
| `{t:'ping'}` | 不变 |

服务器 → 客户端：

- `{t:'peer', nick, slot, status}`：`status` 扩展为 `joined | lost | back | left | ready`。
- `{t:'members', members:[{slot, nick, online, ready}]}`：名册全量广播，任何加入/离开/断线/就绪变化时下发——大厅与局内 HUD 都以此渲染，客户端无需本地拼装。
- `{t:'start', players}`：开局信号，各端按 slot 确定自己守哪条路。
- 其余（`room / cmd / snap / end / error`）不变；`error` 新增码：`not_started`（未开局就发 cmd/snap）、`bad_slot`。

### 安全钳制调整

- `MAX_MSG_PER_SEC`：主机连接要承载 3 份 snap 上行，从 30 → **60 条/秒**；客机不变。
- `MAX_SNAP_BYTES` 不变（快照大小与人数弱相关：塔/怪总量上限由地图与缩放系数约束，实测 4 人局后期快照 ~8KB，远低于 512KB 钳制）。
- `MAX_ROOMS` 500 不变（4 人房放大的是转发带宽而非内存；单房峰值转发 ≈ 75KB/s，500 房理论上限 ~37MB/s，按现网 `/health` 监控，超 200 活跃房再考虑水平拆分）。

## 3. 引擎改造（wxgame/src/game/）

原则：**单人零回归**——`players === 1` 时所有分支行为与现版逐字节一致。

| 位置 | 现状 | 改为 |
|---|---|---|
| `types.ts` `GameState.golds` | `[number, number] \| null` | `number[] \| null`（长度 = 玩家数）；`gold` 仍镜像 `golds[0]` |
| `types.ts` `GameState.killsBy` | `[number, number] \| null` | `number[] \| null` |
| `types.ts` `GameState.coop` | `boolean` | 保留（`coop = players > 1`），新增 `players: number`（单人恒 1） |
| `engine.ts` `createEngine` opts | `coop?: boolean` | 加 `players?: number`（1–4，缺省按 `coop` 推导），出怪调度按活跃路数分配、HP 乘 `COOP_HP_MUL[players]` |
| 出怪分配 | 两路交替 | N 路轮转（spawn 时 `lane = seq % activeLanes`），Boss 波全路同出或按血量分摊到主路 |
| 指令鉴权 | `owner` 0/1 校验 | 泛化为 `0..players-1`，逻辑不变 |

快照裁剪规则不变（客机不读 `spawnQueue/particles/beams/rings/floaters`），`ghost.ts` 无需感知人数。

## 4. 客户端流程（wxgame/src/main.ts + net.ts）

```
home 选「在线联机」→ lobby 屏
  建房：选人数上限（2/3/4 档，默认 4）→ 显示房间码 + 「邀请好友」（分享卡片 query room=CODE 不变）
  加入：好友点卡片 → 自动进房占位
  大厅：4 个槽位卡（昵称 / 就绪态 / 主机标记）+ 空槽显示「等待加入…」
  客机点「就绪」→ 主机「开始」亮起（≥2 人且全就绪）→ 广播 start → battle
battle：主机正常玩 + 广播快照；各客机渲染快照、指令上网
  HUD 顶部：各玩家昵称 + 金币 + 击杀 紧凑条（自己高亮），断线者置灰「重连中…」
  地图上每条路起点标注守路玩家昵称
result：全员成绩榜（按击杀排序，标注各守哪路），协同加成按人数
```

- `net.ts`：role 之外增加 `slot`；新增 `members / ready / start` 消息处理；断线重连逻辑复用（`rejoin + slot`）。
- 客机局内断线：UI 显示「你已掉线，自动重连中…」，重连后向主机请求一次全量快照对齐（复用现有 rejoin 后首个 snap 硬同步路径）。
- 埋点：`room_create / room_join` 增加 `max_players`；`room_finish` 增加 `players`（实际开局人数）。

## 5. 实施顺序

1. **服务器槽位化**：`members[]` 重构 + `ready/start/members` 消息 + 路由规则；`coop-server/test/` 扩到 4 连接场景（建房/满员/rejoin/客机 leave 房间存续/主机 lost 解散）。**先上线**：`maxPlayers` 缺省 2 时协议与现客户端完全兼容，服务器可独立部署。
2. **引擎 N 人化**：`golds/killsBy/players` 泛化 + N 路出怪 + HP 缩放表；单人回归用现有关卡全量跑通。
3. **客户端**：大厅槽位 UI、net 层 slot/roster、HUD 多人条、结算榜。
4. **4 路协作图 + 数值平衡**：新图设计（建造区划分、合流点）、`COOP_HP_MUL` 实测调校；开发者工具多开 + 真机 4 端联调。

估时：服务器 2–3 天，引擎 2–3 天，客户端 3–4 天，地图与平衡 2–3 天，联调收尾 2 天。

## 6. 被否决的备选

- **服务器跑引擎（服务器权威）**：彻底解决主机带宽与作弊，但要把引擎搬到 Node 侧并维护快照序列化，成本是一次重写；4 人以内主机权威够用，超过 4 人再评估。
- **主机迁移**：客机中选新主机续局。需要全量状态迁移 + 防分裂选举，好友房场景收益不匹配复杂度；以「60s 未回解散、按进度结算」兜底。
- **8 人模式**：手机屏 8 路不可读、主机上行翻倍，且社交场景 4 人已是微信群开黑的甜蜜点；不做。
