# 高塔防线 · 管理端

内部运营后台（Next.js 15，页面与 API 同工程，JSON 文件落盘 `data/`，已 gitignore）。

```bash
npm install
npm run dev        # 开发，默认 3000
npm run build      # 生产构建
```

## 账号与环境变量

首次启动自动创建超管（写入 `data/admins.json`，删除后重启可重建）：

- 默认账号 `admin` / `admin123`（**生产必须改密或用环境变量覆盖**）
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`：自定义初始超管
- `SESSION_SECRET`：会话签名密钥（生产必配）
- `WX_APPID` / `WX_SECRET`：配置后游戏端登录走微信 code2session，否则 dev 模式

## 角色权限

| 角色 | 看板/查询 | 积分调整 | 配置发布/版本登记 | 封禁 |
|---|---|---|---|---|
| super | ✓ | ✓ | ✓ | ✓ |
| ops | ✓ | ✓ | ✓ | ✗ |
| readonly | ✓（openid 打码） | ✗ | ✗ | ✗ |

连续 5 次登录失败锁定 15 分钟（内存计数，重启清零）。游戏端接口 `/api/login`、`/api/collect`、`/api/user/score` 不走管理端会话。
