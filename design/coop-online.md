# 在线联机协作（C 档）实施方案 — host-authoritative

> 基线：design/multiplayer.md §4.3。本文档是三期开工评审结论：**采用「主机权威」备选模型，放弃确定性锁步**。
> 原因：引擎 gameplay 路径含 `Math.random()`（暴击判定 engine.ts:66、科技候选 :76、分裂 :303 等 17 处）与浮点三角函数，锁步确定性改造风险高；而 `GameState` 是纯 JSON（types.ts）、`dispatch(Command)` 已是干净指令接口、地图原生多路径（config.ts `paths[]`），主机权威几乎零引擎风险。

## 1. 模型

```
客机(guest) ──指令 cmd──► 房间服务(WS 纯转发) ──► 主机(host)
客机(guest) ◄──快照 snap── 房间服务 ◄── 主机跑唯一引擎
```

- **主机**：建房方，跑唯一真实引擎；双方指令都进它的 `dispatch`；每 200ms 广播一次裁剪快照（剔除 particles/beams/rings/floaters 装饰数组，客机本地重建特效）。
- **客机**：本地不模拟。持「幽灵引擎」（实现 `GameEngine` 接口）：`state` = 最新快照 + 本地线性插值；`dispatch()` 转为网络指令；`map`/`level` 由本地 levels.ts 按 levelId 加载。**渲染层（render.ts + 三皮肤 battle 绘制）零改动**。
- 客机掉线不影响模拟（引擎在主机），天然优于锁步；主机掉线 60s 未回 → 房间解散，双方判负结算（按当前进度）。

## 2. 双人玩法规则

- **一张双路地图**：`levels.ts` 新增协作图（左右两条蛇形路，共用一个网格尺寸，建造区不重叠）。出怪在两条路间交替分配。
- **共享生命**：任一路漏怪扣同一 `lives`。
- **经济独立**：`GameState` 增加 `golds: [number, number] | null`（协作局非 null，`gold` 镜像 `golds[0]` 保持旧 UI 兼容）；击杀奖励归击杀者（tower.owner）。
- **塔的归属**：`TowerState.owner: 0 | 1`（默认 0，单人局不受影响）。BUILD 扣对应玩家金币；UPGRADE/SELL 校验 owner 只能操作自己的塔。科技三选一：主机玩家为准（MVP 简化，双方可见结果）。
- **结算**：双方都按 §3.1 公式计分（各算各的 kills/wave），额外 ×1.2 协同加成；`track` 带 `coop: 2`（0=单人 1=同屏 2=在线）。

## 3. 房间服务（新工程 `coop-server/`，Node + ws，零框架）

部署：第二容器 `srd-coop`，127.0.0.1:3301；nginx `location /ws` 升级头反代。wss://game.chujian.site/ws。

### 消息协议（JSON，字段 `t` 为类型）

客户端 → 服务器：

| 消息 | 说明 |
|---|---|
| `{t:'create', nick, levelId, difficulty}` | 建房 → 回 `{t:'room', roomId, role:'host'}` |
| `{t:'join', roomId, nick}` | 加房 → 回 `{t:'room', roomId, role:'guest', levelId, difficulty, hostNick}`；同时通知主机 `{t:'peer', nick}` |
| `{t:'cmd', player, cmd}` | 游戏指令（Command 原样），服务器按角色转发给对方 |
| `{t:'snap', state}` | 主机快照，服务器转发给客机 |
| `{t:'end', won}` | 主机结算仲裁，服务器广播 `{t:'end', won}` 给双方 |
| `{t:'ping'}` | 心跳，服务器回 `{t:'pong'}`；30s 无消息标记断线 |
| `{t:'leave'}` | 主动离开，房间解散 |

服务器 → 客户端：`{t:'room'|...}`、`{t:'peer', nick, status:'joined'|'lost'|'back'}`、`{t:'cmd'}`、`{t:'snap'}`、`{t:'end', won, reason}`、`{t:'error', code}`（room_full / room_not_found / bad_msg）。

规则：房间最多 2 人；roomId 6 位大写字母数字；断线 60s 内可凭 roomId+role 重连（`{t:'join', roomId, nick, rejoin:true}`）；主机断线超 60s 广播 `{t:'end', won:false, reason:'host_lost'}` 后解散。

## 4. 客户端流程

```
home（模式切换变为三档：单人 / 双人同屏 / 在线联机）
  → 选「在线联机」+ 开战 → lobby 屏（新 Screen）
      建房：显示 6 位房间码 + 「邀请好友」（wx.shareAppMessage query room=CODE）
      加入：好友点卡片进入 → splash 检测 query.room → lobby 直接加入
      双方就绪（客机加入即就绪）→ 主机点开始 → battle
  → battle：主机正常玩 + 发快照；客机渲染快照、指令上网
  → result：双方各自结算（×1.2 协同加成），显示队友昵称与分工数据
```

- 断线 UI：客机检测到主机断线 → 「等待主机重连…」倒计时 60s；自己断线 → 自动重连（静默 3 次后退房）。
- 埋点：`room_create / room_join / room_finish`（multiplayer.md §5），room_id 哈希后上报。
- `srd.apiBase` 派生 ws 地址：`https://game.chujian.site` → `wss://game.chujian.site/ws`（http→ws 规则替换）。

## 5. 实施顺序

1. `coop-server/` 房间服务 + Docker + nginx /ws + 部署验证
2. 引擎双人支持（owner/golds/协作图/出怪分配，单人零回归）
3. 客户端联机层（net 模块、幽灵引擎、lobby 屏、快照插值、断线重连）
4. 结算仲裁 + 埋点 + 双端联调（开发者工具两个模拟器实例 / 预览双开）
