// 数据埋点 —— 轻量封装 wx.reportEvent（基础库 2.14.4+），回退 wx.reportAnalytics，均无则静默
// 事件 id 用英文小写蛇形，数据对象键值需为 string/number（微信自定义分析限制）
// configureAnalytics 配置服务端通道后：事件在直报微信的同时进入内存队列，
// 每 20 条或 30 秒批量 POST 到 {endpoint}/api/collect（契约见 design/multiplayer.md §5）

interface WxAnalyticsLike {
  reportEvent?(eventId: string, data?: Record<string, string | number>): void;
  reportAnalytics?(eventName: string, data?: Record<string, string | number>): void;
  request?(o: {
    url: string; method?: string; data?: unknown; header?: Record<string, string>;
    success?: (r: { statusCode: number; data: unknown }) => void;
    fail?: (e?: unknown) => void;
  }): void;
}

/** 服务端收集通道配置（静默登录成功后由 main.ts 注入） */
interface AnalyticsConfig {
  endpoint: string;            // API 基址，如 https://api.example.com
  getOpenid?: () => string;    // 当前登录态 openid（未登录给空串）
  getBuildId?: () => string;   // 构建号
}

interface CollectEvent {
  event_id: string;
  openid?: string;
  build_id?: string;
  data?: Record<string, string | number>;
  ts?: number;
}

let cfg: AnalyticsConfig | null = null;
let queue: CollectEvent[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

/** 配置服务端上报通道；重复调用以后者为准 */
export function configureAnalytics(c: AnalyticsConfig) {
  try {
    if (!c || !c.endpoint) return;
    cfg = c;
    if (timer === null) timer = setInterval(flush, 30_000);
  } catch { /* ignore */ }
}

/** 批量上报（≤200 条/批）；失败静默丢弃，不做持久化重试，绝不阻塞主流程 */
function flush() {
  if (!cfg || queue.length === 0) return;
  const w = (globalThis as { wx?: WxAnalyticsLike }).wx;
  // 无网络能力的环境（如浏览器 preview stub）：直接清空，不累积不报错
  if (typeof w?.request !== 'function') { queue = []; return; }
  const batch = queue.slice(0, 200);
  queue = queue.slice(batch.length);
  try {
    w.request({
      url: `${cfg.endpoint}/api/collect`,
      method: 'POST',
      data: { events: batch },
      fail: () => { /* 静默丢弃 */ },
    });
  } catch { /* ignore */ }
}

/** 安全上报自定义事件：任何异常/缺 API 都静默降级，绝不影响游戏主流程 */
export function track(eventId: string, data: Record<string, string | number> = {}) {
  try {
    const w = (globalThis as { wx?: WxAnalyticsLike }).wx;
    if (typeof w?.reportEvent === 'function') w.reportEvent(eventId, data);
    else if (typeof w?.reportAnalytics === 'function') w.reportAnalytics(eventId, data);
  } catch { /* ignore */ }
  // 服务端通道：附带 openid/buildId/时间戳入队，满 20 条立即批量上报
  try {
    if (cfg) {
      queue.push({
        event_id: eventId,
        openid: cfg.getOpenid?.() || undefined,
        build_id: cfg.getBuildId?.() || undefined,
        data,
        ts: Date.now(),
      });
      if (queue.length >= 20) flush();
    }
  } catch { /* ignore */ }
}
