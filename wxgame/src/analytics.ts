// 数据埋点 —— 轻量封装 wx.reportEvent（基础库 2.14.4+），回退 wx.reportAnalytics，均无则静默
// 事件 id 用英文小写蛇形，数据对象键值需为 string/number（微信自定义分析限制）

interface WxAnalyticsLike {
  reportEvent?(eventId: string, data?: Record<string, string | number>): void;
  reportAnalytics?(eventName: string, data?: Record<string, string | number>): void;
}

/** 安全上报自定义事件：任何异常/缺 API 都静默降级，绝不影响游戏主流程 */
export function track(eventId: string, data: Record<string, string | number> = {}) {
  try {
    const w = (globalThis as { wx?: WxAnalyticsLike }).wx;
    if (typeof w?.reportEvent === 'function') w.reportEvent(eventId, data);
    else if (typeof w?.reportAnalytics === 'function') w.reportAnalytics(eventId, data);
  } catch { /* ignore */ }
}
