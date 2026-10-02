// 数据类型定义 —— 与 design/admin.md §3.2 表结构对应

export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameResult = 'win' | 'lose';
export type Grade = 'S' | 'A' | 'B' | 'D';
export type UserStatus = 'normal' | 'banned';
export type ReleaseStatus = 'dev' | 'trial' | 'released';

/** 原始事件流水（events.jsonl 每行一条） */
export interface AnalyticsEvent {
  id: number;
  event_id: string;
  openid?: string;
  build_id?: string;
  data: Record<string, string | number>;
  created_at: string; // ISO
}

/** 客户端上报的原始事件格式（POST /api/collect） */
export interface IncomingEvent {
  event_id: string;
  openid?: string;
  build_id?: string;
  data?: Record<string, string | number>;
  ts?: number;
}

export interface User {
  openid: string;
  unionid?: string;
  nick: string;
  avatar_url: string;
  rank: string;
  cleared: number[];
  score_total: number;
  status: UserStatus;
  created_at: string;
  last_seen_at: string;
}

export interface Score {
  id: number;
  openid: string;
  level_id: number;
  difficulty: Difficulty;
  result: GameResult;
  grade?: Grade;
  wave_reached: number;
  kills: number;
  leaks: number;
  duration_sec: number;
  /** 榜单用综合积分（服务端按 game_end 字段计算） */
  points: number;
  build_id?: string;
  sig?: string;
  created_at: string;
}

export interface ConfigEntry {
  key: string;
  value: unknown;
  version: number;
  enabled: boolean;
  updated_by?: string;
  updated_at: string;
}

export interface Release {
  build_id: string;
  wx_version?: string;
  git_commit?: string;
  notes?: string;
  status: ReleaseStatus;
  released_at: string;
}

/** GET /api/stats/summary 返回结构 */
export interface StatsSummary {
  total_events: number;
  app_launch: number;
  game_start: number;
  game_end: number;
  win: number;
  lose: number;
  win_rate: number; // 0-1，win / game_end
  share_click: number;
  share_by_channel: Record<string, number>;
  grade_dist: Record<string, number>;
  /** 按 关卡 × 难度 的漏斗 */
  funnel: Array<{
    level_id: number;
    difficulty: string;
    starts: number;
    ends: number;
    wins: number;
    win_rate: number;
    avg_wave_lost: number; // 失败局平均到达波次
  }>;
  difficulty_dist: Record<string, number>;
}
