// T1 顶部 HUD —— 生命 / 金币 / 波次 / 暂停·2倍速·设置（音量、画质、3D 视角、退出）
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import type { GameState } from '../types';
import { audio } from '../audio';
import { loadSettings, saveSettings, type AppSettings } from '../stats';

interface Props {
  state: GameState;
  levelName: string;
  onTogglePause: () => void;
  onToggleSpeed: () => void;
}

let floaterId = 1;

export default function TopHUD({ state, levelName, onTogglePause, onToggleSpeed }: Props) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lifeFlash, setLifeFlash] = useState(false);
  const [goldFloats, setGoldFloats] = useState<{ id: number; amount: number }[]>([]);
  const prevLives = useRef(state.lives);
  const prevGold = useRef(state.gold);

  // 生命下降 → 红闪 300ms
  useEffect(() => {
    const dropped = state.lives < prevLives.current;
    prevLives.current = state.lives;
    if (!dropped) return;
    setLifeFlash(true);
    const t = setTimeout(() => setLifeFlash(false), 300);
    return () => clearTimeout(t);
  }, [state.lives]);

  // 金币增加 → +N 浮字 600ms
  useEffect(() => {
    const diff = state.gold - prevGold.current;
    prevGold.current = state.gold;
    if (diff <= 0) return;
    const id = floaterId++;
    setGoldFloats((f) => [...f, { id, amount: diff }]);
    const t = setTimeout(() => setGoldFloats((f) => f.filter((x) => x.id !== id)), 600);
    return () => clearTimeout(t);
  }, [state.gold]);

  const updateSettings = (next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
    audio.setVolume(next.volume); // 同步 WebAudio 主音量
  };

  const lifeRatio = state.maxLives > 0 ? state.lives / state.maxLives : 0;
  const iconBtn =
    'flex h-11 w-11 items-center justify-center transition hover:bg-primary/10 active:scale-90';

  return (
    <header
      className={`relative z-20 h-14 shrink-0 border-b border-primary/15 bg-glass backdrop-blur-md transition-shadow duration-300 ${
        lifeFlash ? 'shadow-[inset_0_0_48px_rgba(255,90,90,0.4)]' : ''
      }`}
    >
      <div className="mx-auto flex h-full max-w-[1280px] items-center gap-2 px-3 sm:gap-4 sm:px-4">
        {/* 生命 */}
        <div className="flex items-center gap-1.5">
          <img src="/icon-heart.svg" alt="生命" className="h-5 w-5" />
          <div className="h-2 w-16 overflow-hidden rounded-full border border-primary/20 bg-bg-panel sm:w-20">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${lifeRatio * 100}%`,
                background: 'linear-gradient(90deg, #FF5A5A, #FFC94D)',
              }}
            />
          </div>
          <span className="font-orbitron text-sm font-bold text-text">
            {state.lives}
            <span className="text-text-dim">/{state.maxLives}</span>
          </span>
        </div>

        {/* 金币 */}
        <div className="relative flex items-center gap-1.5">
          <img src="/icon-coin.svg" alt="金币" className="h-5 w-5" />
          <span className="font-orbitron text-lg font-bold text-gold">{state.gold}</span>
          {goldFloats.map((f) => (
            <motion.span
              key={f.id}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.6 }}
              className="pointer-events-none absolute -top-1 left-6 whitespace-nowrap font-orbitron text-xs font-bold text-gold"
            >
              +{f.amount}
            </motion.span>
          ))}
        </div>

        {/* 波次 */}
        <div className="flex items-center gap-1.5">
          <img src="/icon-wave.svg" alt="波次" className="h-5 w-5" />
          <motion.span
            key={state.wave}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 14 }}
            className="whitespace-nowrap font-orbitron text-xs font-bold text-text sm:text-sm"
          >
            第 {state.wave}/{state.totalWaves} 波
          </motion.span>
          <span className="hidden text-xs text-text-dim sm:inline">{levelName}</span>
        </div>

        <div className="flex-1" />

        {/* 暂停 / 加速 / 设置 */}
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={state.paused ? '继续' : '暂停'}
          className={iconBtn}
        >
          <img src={state.paused ? '/icon-play.svg' : '/icon-pause.svg'} alt="" className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onToggleSpeed}
          aria-label="2 倍速"
          className={`${iconBtn} ${state.speed === 2 ? 'bg-primary/20 shadow-[0_0_8px_#22E0FF88]' : ''}`}
        >
          <img src="/icon-speed.svg" alt="" className="h-5 w-5" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="设置"
            className={iconBtn}
          >
            <img src="/icon-gear.svg" alt="" className="h-5 w-5" />
          </button>
          {settingsOpen && (
            <div className="clip-panel absolute right-0 top-12 z-30 w-56 max-w-[calc(100vw-2rem)] border border-primary/25 bg-bg-panel/95 p-4 backdrop-blur-md">
              <div className="text-xs text-text-dim">音量</div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.volume * 100)}
                onChange={(e) => updateSettings({ ...settings, volume: Number(e.target.value) / 100 })}
                className="mt-1 w-full accent-primary"
                aria-label="音量"
              />
              <div className="mt-3 text-xs text-text-dim">画质</div>
              <div className="mt-1 flex gap-2">
                {(['high', 'low'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => updateSettings({ ...settings, quality: q })}
                    className={`flex-1 border px-2 py-1.5 text-xs transition ${
                      settings.quality === q
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-primary/20 text-text-dim hover:text-text'
                    }`}
                  >
                    {q === 'high' ? '高' : '低'}
                  </button>
                ))}
              </div>
              <div className="mt-3 text-xs text-text-dim">3D 视角</div>
              <div className="mt-1 flex gap-2">
                {([true, false] as const).map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => updateSettings({ ...settings, render3d: v })}
                    className={`flex-1 border px-2 py-1.5 text-xs transition ${
                      settings.render3d === v
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-primary/20 text-text-dim hover:text-text'
                    }`}
                  >
                    {v ? '开' : '关'}
                  </button>
                ))}
              </div>
              <Link
                to="/"
                className="clip-btn mt-4 flex min-h-[44px] items-center justify-center border border-accent/50 text-sm text-accent transition hover:bg-accent/10"
              >
                退出本局
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
