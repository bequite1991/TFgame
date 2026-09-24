// 生涯统计与成就 —— localStorage 持久化（键：srd.stats / srd.achievements）
import { TOWER_LIST } from './config';
import type { Difficulty, GameState } from './types';

export interface GameResult {
  won: boolean;
  difficulty: Difficulty;
  waveReached: number;
  kills: number;
  leaked: number;
  livesLeft: number;
  maxLives: number;
  goldEarned: number;
  timeSec: number;
  towerTypesBuilt: number;
  usedFrost: boolean;
  maxTowerLevel: number;
  boss1Killed: boolean;
}

export interface StatsData {
  games: number;
  wins: number;
  kills: number;
  bestWave: number;
  goldEarned: number;
  playTimeSec: number;
  recentKills: number[]; // 最近 10 场击杀
}

export type AchievementMap = Record<string, string>; // id -> 解锁日期 ISO

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  target: number;
  progress: (stats: StatsData, last: GameResult | null) => number;
  check: (stats: StatsData, last: GameResult | null) => boolean;
}

const STATS_KEY = 'srd.stats';
const ACH_KEY = 'srd.achievements';
const PROGRESS_KEY = 'srd.progress';

export interface ProgressData {
  cleared: number[]; // 已通关关卡 id
}

export function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProgressData>;
      return { cleared: Array.isArray(parsed.cleared) ? parsed.cleared : [] };
    }
  } catch {
    /* ignore */
  }
  return { cleared: [] };
}

export function recordLevelClear(levelId: number) {
  const progress = loadProgress();
  if (progress.cleared.includes(levelId)) return;
  progress.cleared.push(levelId);
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function loadStats(): StatsData {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return { ...emptyStats(), ...(JSON.parse(raw) as Partial<StatsData>) };
  } catch {
    /* ignore */
  }
  return emptyStats();
}

export function emptyStats(): StatsData {
  return { games: 0, wins: 0, kills: 0, bestWave: 0, goldEarned: 0, playTimeSec: 0, recentKills: [] };
}

export function loadAchievements(): AchievementMap {
  try {
    const raw = localStorage.getItem(ACH_KEY);
    if (raw) return JSON.parse(raw) as AchievementMap;
  } catch {
    /* ignore */
  }
  return {};
}

export function clearAll() {
  localStorage.removeItem(STATS_KEY);
  localStorage.removeItem(ACH_KEY);
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-blood', name: '初露锋芒', desc: '击杀第 1 个敌人', target: 1,
    progress: (s) => s.kills, check: (s) => s.kills >= 1,
  },
  {
    id: 'wave-5', name: '站稳脚跟', desc: '到达第 5 波', target: 5,
    progress: (s) => s.bestWave, check: (s) => s.bestWave >= 5,
  },
  {
    id: 'boss-killer', name: '屠兽者', desc: '击败 BOSS-1（第 10 波）', target: 1,
    progress: (_s, l) => (l?.boss1Killed ? 1 : 0), check: (_s, l) => !!l?.boss1Killed,
  },
  {
    id: 'victory-1', name: '殖民地的英雄', desc: '普通难度通关', target: 1,
    progress: (_s, l) => (l?.won && l.difficulty !== 'easy' ? 1 : 0),
    check: (_s, l) => !!l?.won && l.difficulty !== 'easy',
  },
  {
    id: 'victory-hard', name: '钢铁意志', desc: '困难难度通关', target: 1,
    progress: (_s, l) => (l?.won && l.difficulty === 'hard' ? 1 : 0),
    check: (_s, l) => !!l?.won && l.difficulty === 'hard',
  },
  {
    id: 'perfect', name: '铜墙铁壁', desc: '满血通关任意难度', target: 1,
    progress: (_s, l) => (l?.won && l.livesLeft === l.maxLives ? 1 : 0),
    check: (_s, l) => !!l?.won && l.livesLeft === l.maxLives,
  },
  {
    id: 'rich', name: '战争财阀', desc: '单局累计赚取 5000 金币', target: 5000,
    progress: (_s, l) => l?.goldEarned ?? 0, check: (_s, l) => (l?.goldEarned ?? 0) >= 5000,
  },
  {
    id: 'kill-1000', name: '虫群收割机', desc: '累计击杀 1000', target: 1000,
    progress: (s) => s.kills, check: (s) => s.kills >= 1000,
  },
  {
    id: 'kill-5000', name: '湮灭者', desc: '累计击杀 5000', target: 5000,
    progress: (s) => s.kills, check: (s) => s.kills >= 5000,
  },
  {
    id: 'tower-master', name: '军械专家', desc: `单局建造全部 ${TOWER_LIST.length} 种塔`, target: TOWER_LIST.length,
    progress: (_s, l) => l?.towerTypesBuilt ?? 0, check: (_s, l) => (l?.towerTypesBuilt ?? 0) >= TOWER_LIST.length,
  },
  {
    id: 'max-tower', name: '巅峰火力', desc: '将任意塔升至 Lv3', target: 3,
    progress: (_s, l) => l?.maxTowerLevel ?? 1, check: (_s, l) => (l?.maxTowerLevel ?? 0) >= 3,
  },
  {
    id: 'no-frost', name: '硬碰硬', desc: '不使用减速塔通关', target: 1,
    progress: (_s, l) => (l?.won && !l.usedFrost ? 1 : 0),
    check: (_s, l) => !!l?.won && !l.usedFrost,
  },
  {
    id: 'speedrun', name: '闪电战', desc: '20 分钟内通关普通及以上难度', target: 1200,
    progress: (_s, l) => (l?.won ? Math.min(l.timeSec, 1200) : 0),
    check: (_s, l) => !!l?.won && l.difficulty !== 'easy' && l.timeSec <= 1200,
  },
  {
    id: 'veteran', name: '百战老兵', desc: '完成 10 局游戏', target: 10,
    progress: (s) => s.games, check: (s) => s.games >= 10,
  },
];

/** 游戏结束时记录战绩并检测成就，返回新解锁的成就 id 列表 */
export function recordGame(state: GameState, difficulty: Difficulty): string[] {
  const result: GameResult = {
    won: state.phase === 'won',
    difficulty,
    waveReached: state.wave,
    kills: state.kills,
    leaked: state.leaked,
    livesLeft: state.lives,
    maxLives: state.maxLives,
    goldEarned: state.goldEarned,
    timeSec: Math.round(state.timeSec),
    towerTypesBuilt: state.towerTypesBuilt.length,
    usedFrost: state.usedFrost,
    maxTowerLevel: state.maxTowerLevel,
    boss1Killed: state.boss1Killed,
  };
  const stats = loadStats();
  stats.games += 1;
  if (result.won) stats.wins += 1;
  stats.kills += result.kills;
  stats.bestWave = Math.max(stats.bestWave, result.waveReached);
  stats.goldEarned += result.goldEarned;
  stats.playTimeSec += result.timeSec;
  stats.recentKills = [...stats.recentKills, result.kills].slice(-10);
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));

  const unlocked = loadAchievements();
  const newly: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!unlocked[a.id] && a.check(stats, result)) {
      unlocked[a.id] = new Date().toISOString();
      newly.push(a.id);
    }
  }
  localStorage.setItem(ACH_KEY, JSON.stringify(unlocked));
  return newly;
}

/** 指挥官等级：每 500 击杀升 1 级 */
export function commanderLevel(kills: number) {
  const level = Math.floor(kills / 500) + 1;
  const progress = (kills % 500) / 500;
  return { level, progress };
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(sec % 60)}s`;
}
