// 零依赖文件型存储：JSON 文件持久化到 admin/data/
// events.jsonl 追加写；users/scores/configs/releases 全量读写
// 进程内缓存 + 写时落盘，写操作通过全局 Promise 链简单串行化

import fs from 'node:fs';
import path from 'node:path';
import type {
  AnalyticsEvent,
  ConfigEntry,
  Grade,
  IncomingEvent,
  Release,
  Score,
  StatsSummary,
  User,
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
const CONFIGS_FILE = path.join(DATA_DIR, 'configs.json');
const RELEASES_FILE = path.join(DATA_DIR, 'releases.json');

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
  for (const u of users) s.users.set(u.openid, u);

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

/** 军衔规则与客户端 commanderRank() 对齐（按通关章节数分档） */
export function commanderRank(clearedCount: number): string {
  if (clearedCount >= 13) return '传奇统帅';
  if (clearedCount >= 9) return '星环将星';
  if (clearedCount >= 5) return '战地指挥官';
  if (clearedCount >= 1) return '见习指挥官';
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
        if (result === 'win' && score.level_id > 0 && !user.cleared.includes(score.level_id)) {
          user.cleared.push(score.level_id);
          user.cleared.sort((a, b) => a - b);
        }
        user.rank = commanderRank(user.cleared.length);
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
