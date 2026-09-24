// 游戏主界面 /game —— 引擎驱动：rAF 主循环 + subscribe 版本号重渲染 + 面板编排
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { createEngine } from '@/game/engine';
import { COLS, ROWS } from '@/game/config';
import { audio } from '@/game/audio';
import { recordGame, recordLevelClear, loadSettings, SETTINGS_EVENT } from '@/game/stats';
import type { Difficulty, GameEngine, TowerType } from '@/game/types';
import GameCanvas from '@/game/ui/GameCanvas';
import GameCanvas3D from '@/game/render3d/GameCanvas3D';
import TopHUD from '@/game/ui/TopHUD';
import WavePreviewBar from '@/game/ui/WavePreviewBar';
import BuildPanel from '@/game/ui/BuildPanel';
import TowerDetailPanel from '@/game/ui/TowerDetailPanel';
import ResultOverlay from '@/game/ui/ResultOverlay';
import BriefingOverlay from '@/game/ui/BriefingOverlay';
import TechChoiceOverlay from '@/game/ui/TechChoiceOverlay';
import CommToast from '@/game/ui/CommToast';
import type { CommItem } from '@/game/ui/CommToast';
import { EnemyIntel, WaveList } from '@/game/ui/Sidebars';

function parseDifficulty(v: string | null): Difficulty {
  return v === 'easy' || v === 'hard' ? v : 'normal';
}

function parseLevel(v: string | null): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** 新引擎默认暂停，等待简报覆盖层「出击」 */
function createPausedEngine(difficulty: Difficulty, levelId: number): GameEngine {
  const engine = createEngine(difficulty, levelId);
  engine.state.paused = true;
  return engine;
}

let commId = 1;

/** 读取设置面板的音量值（与 TopHUD 共享同一存储键） */
function loadHudVolume(): number {
  return loadSettings().volume;
}

export default function Game() {
  const [params] = useSearchParams();
  const difficulty = parseDifficulty(params.get('difficulty'));
  const levelId = parseLevel(params.get('level'));
  const [engine, setEngine] = useState<GameEngine>(() => createPausedEngine(difficulty, levelId));
  const [, setVersion] = useState(0);
  const [placing, setPlacing] = useState<TowerType | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null);
  const [leakPulse, setLeakPulse] = useState(0);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [briefingOpen, setBriefingOpen] = useState(true);
  const [comms, setComms] = useState<CommItem[]>([]);
  const [render3d, setRender3d] = useState(() => loadSettings().render3d);
  const [webglFailed, setWebglFailed] = useState(false); // WebGL 不可用时回退 2D
  const recordedRef = useRef<GameEngine | null>(null); // 防止 recordGame 重复调用

  // 设置面板「3D 视角」开关即时生效
  useEffect(() => {
    const onSettings = () => setRender3d(loadSettings().render3d);
    window.addEventListener(SETTINGS_EVENT, onSettings);
    return () => window.removeEventListener(SETTINGS_EVENT, onSettings);
  }, []);

  // 难度 / 关卡参数变化 → 重建引擎（渲染期间调整状态，见 react.dev「You Might Not Need an Effect」）
  const [prevParams, setPrevParams] = useState({ difficulty, levelId });
  if (prevParams.difficulty !== difficulty || prevParams.levelId !== levelId) {
    setPrevParams({ difficulty, levelId });
    setPlacing(null);
    setSelectedId(null);
    setAchievements([]);
    setComms([]);
    setBriefingOpen(true);
    setEngine(createPausedEngine(difficulty, levelId));
  }

  // 订阅引擎 tick → 版本号驱动 HUD/面板重渲染（离开页面自动退订）
  useEffect(() => engine.subscribe(() => setVersion((v) => v + 1)), [engine]);

  // rAF 主循环：tick（dt clamp ≤0.05s）+ 事件派发
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      engine.tick(dt);
      for (const ev of engine.drainEvents()) {
        if (ev.type === 'leak') { setLeakPulse((n) => n + 1); audio.play('leak'); }
        if (ev.type === 'waveStart') audio.play('waveStart');
        if (ev.type === 'bossDown') audio.play('boss');
        if (ev.type === 'sfx') audio.play(ev.name);
        if (ev.type === 'waveClear') audio.play('waveClear');
        if (ev.type === 'gameOver') {
          audio.play(ev.won ? 'victory' : 'defeat');
          audio.stopBgm();
        }
        if (ev.type === 'comm') setComms((list) => [...list, { id: commId++, wave: ev.wave, text: ev.text }]);
        if (ev.type === 'gameOver' && recordedRef.current !== engine) {
          recordedRef.current = engine;
          setAchievements(recordGame(engine.state, engine.difficulty));
          if (ev.won) recordLevelClear(engine.level.id);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  // 键盘：Esc 取消 / 空格暂停 / "2" 切 2 倍速
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPlacing(null);
        setSelectedId(null);
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (!briefingOpen) engine.dispatch({ type: 'TOGGLE_PAUSE' });
      } else if (e.key === '2') {
        engine.dispatch({ type: 'SET_SPEED', speed: engine.state.speed === 2 ? 1 : 2 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine, briefingOpen]);

  const state = engine.state;
  const ended = state.phase === 'won' || state.phase === 'lost';

  const restart = () => {
    setPlacing(null);
    setSelectedId(null);
    setAchievements([]);
    setComms([]);
    setBriefingOpen(true);
    setEngine(createPausedEngine(difficulty, levelId));
  };

  const launch = () => {
    setBriefingOpen(false);
    audio.init();
    audio.setVolume(loadHudVolume());
    audio.startBgm();
    audio.play('click');
    if (engine.state.paused && engine.state.phase !== 'won' && engine.state.phase !== 'lost') {
      engine.dispatch({ type: 'TOGGLE_PAUSE' });
    }
  };

  const dismissComm = useCallback((id: number) => {
    setComms((list) => list.filter((c) => c.id !== id));
  }, []);

  const onCellClick = (col: number, row: number) => {
    if (ended || state.phase === 'tech') return;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
      setPlacing(null);
      setSelectedId(null);
      return;
    }
    if (placing) {
      // 成功建造或点到非法格（空白/已占用）都退出放置模式
      if (engine.dispatch({ type: 'BUILD', col, row, tower: placing })) audio.play('build');
      setPlacing(null);
      return;
    }
    const tw = state.towers.find((t) => t.col === col && t.row === row);
    if (tw) {
      setSelectedId(tw.id);
      audio.play('select');
    } else {
      setSelectedId(null);
    }
  };

  const selectedTower =
    selectedId !== null ? state.towers.find((t) => t.id === selectedId) ?? null : null;

  return (
    <div className="relative flex h-dvh select-none flex-col overflow-hidden bg-bg-deep text-text [touch-action:manipulation] [-webkit-touch-callout:none]">
      <TopHUD
        state={state}
        levelName={`第 ${engine.level.id} 章 · ${engine.level.name}`}
        onTogglePause={() => engine.dispatch({ type: 'TOGGLE_PAUSE' })}
        onToggleSpeed={() =>
          engine.dispatch({ type: 'SET_SPEED', speed: state.speed === 2 ? 1 : 2 })
        }
      />
      <WavePreviewBar state={state} waves={engine.level.waves} pathCount={engine.level.paths.length} onStart={() => engine.dispatch({ type: 'SKIP_PREP' })} />
      <CommToast items={comms} onDismiss={dismissComm} />

      <div className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1">
        {/* 左栏：敌情速查（仅桌面） */}
        <aside className="hidden w-[260px] shrink-0 overflow-y-auto p-3 lg:block">
          <EnemyIntel state={state} waves={engine.level.waves} difficulty={difficulty} />
        </aside>

        {/* 中央画布 */}
        <div
          className="flex min-w-0 flex-1 items-center justify-center overflow-hidden p-1"
          onContextMenu={(e) => {
            e.preventDefault();
            setPlacing(null);
            setSelectedId(null);
          }}
        >
          {render3d && !webglFailed ? (
            <GameCanvas3D
              engine={engine}
              placing={placing}
              selectedId={selectedId}
              hoverCell={hoverCell}
              onCellClick={onCellClick}
              onHoverCell={(col, row) => setHoverCell(col < 0 ? null : { col, row })}
              onWebGLFail={() => setWebglFailed(true)}
            />
          ) : (
            <GameCanvas
              engine={engine}
              placing={placing}
              selectedId={selectedId}
              hoverCell={hoverCell}
              onCellClick={onCellClick}
              onHoverCell={(col, row) => setHoverCell(col < 0 ? null : { col, row })}
            />
          )}
        </div>

        {/* 右栏：波次列表（仅桌面） */}
        <aside className="hidden w-[260px] shrink-0 overflow-y-auto p-3 lg:block">
          <WaveList state={state} waves={engine.level.waves} />
        </aside>
      </div>

      {/* 底部：塔详情 / 建塔面板 */}
      <div className="relative z-10 shrink-0 pb-[env(safe-area-inset-bottom)]">
        {selectedTower && !placing ? (
          <TowerDetailPanel
            key={selectedTower.id}
            tower={selectedTower}
            gold={state.gold}
            onUpgrade={() => {
              if (engine.dispatch({ type: 'UPGRADE', id: selectedTower.id })) audio.play('upgrade');
            }}
            onSell={() => {
              engine.dispatch({ type: 'SELL', id: selectedTower.id });
              audio.play('sell');
              setSelectedId(null);
            }}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <BuildPanel
            gold={state.gold}
            placing={placing}
            onSelect={(t) => {
              setPlacing(t);
              setSelectedId(null);
            }}
            onCancel={() => setPlacing(null)}
          />
        )}
      </div>

      {/* 漏怪：全屏红边 vignette 脉冲 */}
      {leakPulse > 0 && (
        <motion.div
          key={leakPulse}
          className="pointer-events-none fixed inset-0 z-40"
          style={{ boxShadow: 'inset 0 0 120px rgba(255,90,90,0.85)' }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      )}

      <AnimatePresence>
        {state.phase === 'tech' && (
          <TechChoiceOverlay
            state={state}
            onPick={(id) => {
              audio.play('tech');
              engine.dispatch({ type: 'PICK_TECH', id });
            }}
          />
        )}
        {briefingOpen && !ended && (
          <BriefingOverlay level={engine.level} onLaunch={launch} />
        )}
        {ended && (
          <ResultOverlay
            state={state}
            level={engine.level}
            difficulty={difficulty}
            achievements={achievements}
            onRestart={restart}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
