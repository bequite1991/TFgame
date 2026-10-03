// 零依赖文件型存储：JSON 文件持久化到 admin/data/
// events.jsonl 追加写；users/scores/configs/releases 全量读写
// 进程内缓存 + 写时落盘，写操作通过全局 Promise 链简单串行化

import fs from 'node:fs';
import path from 'node:path';
import type {
  AnalyticsEvent,
  AuditEntry,
  ConfigEntry,
  Grade,
  IncomingEvent,
  Release,
  Score,
  ScoreProfile,
  StatsSummary,
  User,
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
const CONFIGS_FILE = path.join(DATA_DIR, 'configs.json');
const RELEASES_FILE = path.join(DATA_DIR, 'releases.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.jsonl');

interface StoreState {
  loaded: boolean;
  eventCount: number;
  nextEventId: number;
  nextScoreId: number;
  users: Map<string, User>;
  scores: Score[];
  configs: Map<string, ConfigEntry>;
  releases: Map<string, Release>;
  writeQueue: Promise<void>;
}

// 挂到 globalThis，避免 Next.js 按路由模块拆分导致缓存不共享
const globalKey = '__srd_admin_store__';
const g = globalThis as unknown as Record<string, StoreState | undefined>;

function freshState(): StoreState {
  return {
    loaded: false,
    eventCount: 0,
    nextEventId: 1,
    nextScoreId: 1,
    users: new Map(),
    scores: [],
    configs: new Map(),
    releases: new Map(),
    writeQueue: Promise.resolve(),
  };
}

function state(): StoreState {
  if (!g[globalKey]) g[globalKey] = freshState();
  const s = g[globalKey]!;
  if (!s.loaded) load(s);
  return s;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function load(s: StoreState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // 事件只统计数量与最大 id，聚合时重新扫描（MVP 量级可控）
  try {
    const lines = fs.readFileSync(EVENTS_FILE, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      s.eventCount += 1;
      try {
        const ev = JSON.parse(line) as AnalyticsEvent;
        if (ev.id >= s.nextEventId) s.nextEventId = ev.id + 1;
      } catch {
        /* 跳过坏行 */
      }
    }
  } catch {
    /* 文件不存在 */
  }

  const users = readJson<User[]>(USERS_FILE, []);
  for (const u of users) {
    // 老数据兜底：积分档案字段缺省时补初始值
    if (typeof u.points !== 'number' || !Number.isFinite(u.points)) u.points = 0;
    if (typeof u.best_single !== 'number' || !Number.isFinite(u.best_single)) u.best_single = 0;
    if (typeof u.per_level_best !== 'object' || u.per_level_best === null) u.per_level_best = {};
    if (typeof u.score_updated_at !== 'string') u.score_updated_at = u.last_seen_at ?? '';
    s.users.set(u.openid, u);
  }

  s.scores = readJson<Score[]>(SCORES_FILE, []);
  for (const sc of s.scores) {
    if (sc.id >= s.nextScoreId) s.nextScoreId = sc.id + 1;
  }

  const configs = readJson<ConfigEntry[]>(CONFIGS_FILE, []);
  for (const c of configs) s.configs.set(c.key, c);

  const releases = readJson<Release[]>(RELEASES_FILE, []);
  for (const r of releases) s.releases.set(r.build_id, r);

  s.loaded = true;
}

/** 串行化写：所有落盘操作排队执行，避免并发写坏文件 */
function enqueue(s: StoreState, fn: () => void): Promise<void> {
  const next = s.writeQueue.then(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fn();
  });
  // 吞掉异常不中断队列，错误抛给调用方
  s.writeQueue = next.catch(() => {});
  return next;
}

function writeJson(file: string, value: unknown): void {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

const VALID_DIFFICULTIES = new Set(['easy', 'normal', 'hard']);
const VALID_GRADES = new Set(['S', 'A', 'B', 'D']);

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

/** 按 game_end 字段计算榜单积分：通关为重，兼顾波次与击杀 */
function computePoints(d: Record<string, string | number>): number {
  const win = d.result === 'win' ? 1 : 0;
  return win * 10000 + num(d.wave_reached) * 100 + num(d.kills) * 10 - num(d.leaks) * 50;
}

/** 军衔规则：按累计积分分档（design/multiplayer.md §3.2，与客户端 commanderRank() 对齐） */
export function rankByPoints(points: number): string {
  if (points >= 40000) return '星海元帅';
  if (points >= 15000) return '传奇统帅';
  if (points >= 6000) return '星环将星';
  if (points >= 2000) return '战地指挥官';
  if (points >= 500) return '见习指挥官';
  return '新晋学员';
}

/**
 * 批量写入埋点事件：追加 events.jsonl；
 * 顺带维护 users（openid 首见建档/更新活跃）与 scores（game_end 落一条成绩）。
 * 返回写入条数。
 */
export async function ingestEvents(incoming: IncomingEvent[]): Promise<number> {
  const s = state();
  const now = new Date().toISOString();
  const lines: string[] = [];
  let usersDirty = false;
  let scoresDirty = false;

  for (const ev of incoming) {
    const record: AnalyticsEvent = {
      id: s.nextEventId++,
      event_id: ev.event_id,
      openid: ev.openid,
      build_id: ev.build_id,
      data: ev.data ?? {},
      created_at: ev.ts ? new Date(ev.ts).toISOString() : now,
    };
    lines.push(JSON.stringify(record));
    s.eventCount += 1;

    if (ev.openid) {
      const existing = s.users.get(ev.openid);
      if (existing) {
        existing.last_seen_at = record.created_at;
        if (ev.build_id) existing.last_seen_at = record.created_at;
      } else {
        s.users.set(ev.openid, {
          openid: ev.openid,
          nick: '',
          avatar_url: '',
          rank: '新晋学员',
          cleared: [],
          score_total: 0,
          points: 0,
          best_single: 0,
          per_level_best: {},
          score_updated_at: record.created_at,
          status: 'normal',
          created_at: record.created_at,
          last_seen_at: record.created_at,
        });
      }
      usersDirty = true;
    }

    if (ev.event_id === 'game_end') {
      const d = ev.data ?? {};
      const user = ev.openid ? s.users.get(ev.openid) : undefined;
      const difficulty = VALID_DIFFICULTIES.has(str(d.difficulty))
        ? (str(d.difficulty) as Score['difficulty'])
        : 'normal';
      const result: Score['result'] = d.result === 'win' ? 'win' : 'lose';
      const points = computePoints(d);
      const score: Score = {
        id: s.nextScoreId++,
        openid: ev.openid ?? 'anonymous',
        level_id: num(d.level_id),
        difficulty,
        result,
        grade: VALID_GRADES.has(str(d.grade)) ? (str(d.grade) as Grade) : undefined,
        wave_reached: num(d.wave_reached),
        kills: num(d.kills),
        leaks: num(d.leaks),
        duration_sec: num(d.duration_sec),
        points,
        build_id: ev.build_id,
        created_at: record.created_at,
      };
      s.scores.push(score);
      scoresDirty = true;

      if (user) {
        user.score_total += Math.max(0, points);
        // points 与按事件累计的 score_total 保持同步：只升不降，避免排行榜倒退
        if (user.points < user.score_total) user.points = user.score_total;
        if (points > user.best_single) user.best_single = points;
        if (result === 'win' && score.level_id > 0 && !user.cleared.includes(score.level_id)) {
          user.cleared.push(score.level_id);
          user.cleared.sort((a, b) => a - b);
        }
        user.rank = rankByPoints(user.points);
        usersDirty = true;
      }
    }
  }

  await enqueue(s, () => {
    if (lines.length) fs.appendFileSync(EVENTS_FILE, lines.join('\n') + '\n');
    if (usersDirty) writeJson(USERS_FILE, [...s.users.values()]);
    if (scoresDirty) writeJson(SCORES_FILE, s.scores);
  });

  return lines.length;
}

export function listUsers(): User[] {
  const s = state();
  return [...s.users.values()].sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at));
}

export function topScores(top: number): Score[] {
  const s = state();
  return [...s.scores].sort((a, b) => b.points - a.points).slice(0, Math.max(1, top));
}

export function getConfig(key: string): ConfigEntry | undefined {
  return state().configs.get(key);
}

export function listConfigs(): ConfigEntry[] {
  return [...state().configs.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export async function putConfig(key: string, value: unknown, updatedBy?: string): Promise<ConfigEntry> {
  const s = state();
  const existing = s.configs.get(key);
  const entry: ConfigEntry = {
    key,
    value,
    version: (existing?.version ?? 0) + 1,
    enabled: true,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };
  s.configs.set(key, entry);
  await enqueue(s, () => writeJson(CONFIGS_FILE, [...s.configs.values()]));
  return entry;
}

export function listReleases(): Release[] {
  return [...state().releases.values()].sort((a, b) => b.released_at.localeCompare(a.released_at));
}

export async function putRelease(input: Omit<Release, 'released_at'> & { released_at?: string }): Promise<Release> {
  const s = state();
  const existing = s.releases.get(input.build_id);
  const release: Release = {
    build_id: input.build_id,
    wx_version: input.wx_version,
    git_commit: input.git_commit,
    notes: input.notes,
    status: input.status,
    released_at: input.released_at ?? existing?.released_at ?? new Date().toISOString(),
  };
  s.releases.set(release.build_id, release);
  await enqueue(s, () => writeJson(RELEASES_FILE, [...s.releases.values()]));
  return release;
}

/** 全量扫描 events.jsonl 做聚合（MVP 量级可控；量大后应换增量聚合） */
export function statsSummary(): StatsSummary {
  const s = state();

  const summary: StatsSummary = {
    total_events: s.eventCount,
    app_launch: 0,
    game_start: 0,
    game_end: 0,
    win: 0,
    lose: 0,
    win_rate: 0,
    share_click: 0,
    share_by_channel: {},
    grade_dist: {},
    funnel: [],
    difficulty_dist: {},
  };

  interface Bucket {
    starts: number;
    ends: number;
    wins: number;
    lostWaveSum: number;
    lostCount: number;
  }
  const buckets = new Map<string, Bucket>();

  let raw = '';
  try {
    raw = fs.readFileSync(EVENTS_FILE, 'utf8');
  } catch {
    return summary;
  }

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let ev: AnalyticsEvent;
    try {
      ev = JSON.parse(line) as AnalyticsEvent;
    } catch {
      continue;
    }
    const d = ev.data ?? {};

    switch (ev.event_id) {
      case 'app_launch':
        summary.app_launch += 1;
        break;
      case 'game_start': {
        summary.game_start += 1;
        const diff = str(d.difficulty, 'normal');
        summary.difficulty_dist[diff] = (summary.difficulty_dist[diff] ?? 0) + 1;
        const key = `${num(d.level_id)}|${diff}`;
        const b = buckets.get(key) ?? { starts: 0, ends: 0, wins: 0, lostWaveSum: 0, lostCount: 0 };
        b.starts += 1;
        buckets.set(key, b);
        break;
      }
      case 'game_end': {
        summary.game_end += 1;
        const isWin = d.result === 'win';
        if (isWin) summary.win += 1;
        else summary.lose += 1;
        const grade = str(d.grade);
        if (grade) summary.grade_dist[grade] = (summary.grade_dist[grade] ?? 0) + 1;
        const key = `${num(d.level_id)}|${str(d.difficulty, 'normal')}`;
        const b = buckets.get(key) ?? { starts: 0, ends: 0, wins: 0, lostWaveSum: 0, lostCount: 0 };
        b.ends += 1;
        if (isWin) b.wins += 1;
        else {
          b.lostWaveSum += num(d.wave_reached);
          b.lostCount += 1;
        }
        buckets.set(key, b);
        break;
      }
      case 'share_click': {
        summary.share_click += 1;
        const ch = str(d.channel, 'unknown');
        summary.share_by_channel[ch] = (summary.share_by_channel[ch] ?? 0) + 1;
        break;
      }
    }
  }

  summary.win_rate = summary.game_end > 0 ? summary.win / summary.game_end : 0;
  summary.funnel = [...buckets.entries()]
    .map(([key, b]) => {
      const [levelId, difficulty] = key.split('|');
      return {
        level_id: Number(levelId),
        difficulty,
        starts: b.starts,
        ends: b.ends,
        wins: b.wins,
        win_rate: b.ends > 0 ? b.wins / b.ends : 0,
        avg_wave_lost: b.lostCount > 0 ? Math.round((b.lostWaveSum / b.lostCount) * 10) / 10 : 0,
      };
    })
    .sort((a, b) => a.level_id - b.level_id || a.difficulty.localeCompare(b.difficulty));

  return summary;
}


/* ---------- 登录与积分云端档案（design/multiplayer.md §2/§3） ---------- */

export function getUser(openid: string): User | undefined {
  return state().users.get(openid);
}

/** 登录建档：新用户创建档案，老用户只刷新最近活跃时间 */
export async function loginUser(openid: string): Promise<User> {
  const s = state();
  const now = new Date().toISOString();
  let user = s.users.get(openid);
  if (user) {
    user.last_seen_at = now;
  } else {
    user = {
      openid,
      nick: '',
      avatar_url: '',
      rank: '新晋学员',
      cleared: [],
      score_total: 0,
      points: 0,
      best_single: 0,
      per_level_best: {},
      score_updated_at: now,
      status: 'normal',
      created_at: now,
      last_seen_at: now,
    };
    s.users.set(openid, user);
  }
  await enqueue(s, () => writeJson(USERS_FILE, [...s.users.values()]));
  return user;
}

function toScoreProfile(u: User): ScoreProfile {
  return {
    points: u.points,
    bestSingle: u.best_single,
    perLevelBest: u.per_level_best,
    updatedAt: u.score_updated_at,
  };
}

export function getScoreProfile(openid: string): ScoreProfile | null {
  const user = getUser(openid);
  return user ? toScoreProfile(user) : null;
}

const MAX_LEVEL_BEST_VALUE = 1_000_000;
const MAX_LEVEL_BEST_KEYS = 50;

/** 积分档案 max 合并：points/bestSingle 取大，perLevelBest 按键取大；只升不降 */
export async function mergeScoreProfile(
  openid: string,
  input: { points: number; bestSingle?: number; perLevelBest?: Record<string, number> },
): Promise<ScoreProfile | null> {
  const s = state();
  const user = s.users.get(openid);
  if (!user) return null;

  user.points = Math.max(user.points, Math.max(0, input.points));
  if (input.bestSingle !== undefined) {
    user.best_single = Math.max(user.best_single, Math.max(0, input.bestSingle));
  }
  if (input.perLevelBest) {
    const merged: Record<string, number> = { ...user.per_level_best };
    for (const [k, v] of Object.entries(input.perLevelBest)) {
      const clamped = Math.min(Math.max(0, v), MAX_LEVEL_BEST_VALUE);
      merged[k] = Math.max(merged[k] ?? 0, clamped);
    }
    // 键数量封顶：超出时保留数值最大的若干条
    const keys = Object.keys(merged);
    if (keys.length > MAX_LEVEL_BEST_KEYS) {
      keys.sort((a, b) => merged[b] - merged[a]);
      for (const k of keys.slice(MAX_LEVEL_BEST_KEYS)) delete merged[k];
    }
    user.per_level_best = merged;
  }
  user.score_updated_at = new Date().toISOString();
  user.rank = rankByPoints(user.points);

  await enqueue(s, () => writeJson(USERS_FILE, [...s.users.values()]));
  return toScoreProfile(user);
}

/* ---------- 管理端操作与审计 ---------- */

/** 追加审计记录（audit.jsonl，每行一条） */
export async function appendAudit(entry: AuditEntry): Promise<void> {
  const s = state();
  await enqueue(s, () => fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n'));
}

/** 管理端调整积分：delta 可正可负，下限 0；同步刷新军衔并写审计 */
export async function adjustUserPoints(
  openid: string,
  delta: number,
  reason: string,
): Promise<{ before: number; after: number; rank: string } | null> {
  const s = state();
  const user = s.users.get(openid);
  if (!user) return null;

  const before = user.points;
  user.points = Math.max(0, user.points + delta);
  user.rank = rankByPoints(user.points);
  user.score_updated_at = new Date().toISOString();

  await enqueue(s, () => writeJson(USERS_FILE, [...s.users.values()]));
  await appendAudit({
    actor: 'admin',
    action: 'score_adjust',
    target: openid,
    before,
    after: user.points,
    reason,
    at: new Date().toISOString(),
  });
  return { before, after: user.points, rank: user.rank };
}

/** 管理端封禁/解封并写审计 */
export async function setUserBanned(
  openid: string,
  banned: boolean,
): Promise<{ before: string; after: string } | null> {
  const s = state();
  const user = s.users.get(openid);
  if (!user) return null;

  const before = user.status;
  user.status = banned ? 'banned' : 'normal';

  await enqueue(s, () => writeJson(USERS_FILE, [...s.users.values()]));
  await appendAudit({
    actor: 'admin',
    action: 'ban',
    target: openid,
    before,
    after: user.status,
    at: new Date().toISOString(),
  });
  return { before, after: user.status };
}
