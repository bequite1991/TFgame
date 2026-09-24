// 战斗音效 —— WebAudio 程序化合成（移植自 H5 版 app/src/game/audio.ts 的音效部分）
// 零素材零包体积；BGM 由音频文件分包播放，不在本模块
declare const wx: {
  createWebAudioContext(): WebAudioContextLike;
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
};

// 微信 WebAudioContext 的最小结构类型（与浏览器 AudioContext 子集同构）
interface AudioParamLike {
  value: number;
  setValueAtTime(v: number, t: number): void;
  exponentialRampToValueAtTime(v: number, t: number): void;
  setTargetAtTime(v: number, t: number, tc: number): void;
}
interface AudioNodeLike { connect(d: AudioNodeLike): AudioNodeLike }
interface OscillatorLike extends AudioNodeLike {
  type: string; frequency: AudioParamLike;
  start(t: number): void; stop(t: number): void;
}
interface GainLike extends AudioNodeLike { gain: AudioParamLike }
interface BufferSourceLike extends AudioNodeLike { buffer: unknown; start(t: number): void }
interface BiquadFilterLike extends AudioNodeLike { type: string; frequency: AudioParamLike }
interface WebAudioContextLike {
  currentTime: number;
  sampleRate: number;
  state: string;
  destination: AudioNodeLike;
  resume?(): void;
  createGain(): GainLike;
  createOscillator(): OscillatorLike;
  createBuffer(channels: number, len: number, rate: number): { getChannelData(ch: number): Float32Array };
  createBufferSource(): BufferSourceLike;
  createBiquadFilter(): BiquadFilterLike;
}

export type Sfx =
  | 'laser' | 'missile' | 'frost' | 'railgun' | 'tesla' | 'plasma'
  | 'build' | 'upgrade' | 'sell' | 'kill' | 'boss'
  | 'leak' | 'waveClear' | 'waveStart' | 'tech'
  | 'select' | 'click' | 'victory' | 'defeat';

/** 各音效峰值音量 */
const SFX_VOL: Partial<Record<Sfx, number>> = {
  laser: 0.14, frost: 0.12, tesla: 0.1, plasma: 0.2,
};
const sfxVol = (sfx: Sfx) => SFX_VOL[sfx] ?? 0.2;

const MUTE_KEY = 'srd.muted';

class SfxEngine {
  private ctx: WebAudioContextLike | null = null;
  private master: GainLike | null = null;
  private lastPlayed = new Map<Sfx, number>();
  muted = false;

  constructor() {
    try { this.muted = wx.getStorageSync(MUTE_KEY) === '1'; } catch { /* ignore */ }
  }

  /** 首次用户手势时初始化（自动播放限制） */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume?.();
      return;
    }
    try {
      this.ctx = wx.createWebAudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null; // 不支持 WebAudio 的环境静默降级
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try { wx.setStorageSync(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
    }
  }

  play(sfx: Sfx) {
    const ctx = this.ctx;
    if (!ctx || this.muted || !this.master) return;
    // 同类音效限速（激光/减速每秒最多 1 声，避免噪声糊）
    const now = ctx.currentTime;
    const minGap = sfx === 'laser' || sfx === 'frost' || sfx === 'tesla' || sfx === 'plasma' ? 0.09 : 0.03;
    if (now - (this.lastPlayed.get(sfx) ?? -9) < minGap) return;
    this.lastPlayed.set(sfx, now);
    const t = now;
    const master = this.master;

    const env = (g: GainLike, peak: number, dur: number) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(master);
    };
    const osc = (type: string, f0: number, f1: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      env(g, sfxVol(sfx), dur);
      o.connect(g);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    const noise = (dur: number, lp: number, peak: number) => {
      const len = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      const g = ctx.createGain();
      env(g, peak, dur);
      src.connect(f).connect(g);
      src.start(t);
    };

    switch (sfx) {
      case 'laser': osc('sawtooth', 880, 220, 0.08); break;
      case 'missile':
        osc('triangle', 180, 60, 0.25);
        noise(0.28, 900, 0.34);
        break;
      case 'frost': osc('sine', 1400, 500, 0.12); break;
      case 'railgun':
        osc('square', 150, 40, 0.35);
        noise(0.3, 1600, 0.3);
        break;
      case 'tesla': osc('square', 2200, 900, 0.06); noise(0.05, 4000, 0.08); break;
      case 'plasma': osc('sine', 320, 90, 0.3); noise(0.24, 700, 0.16); break;
      case 'build':
        osc('triangle', 240, 480, 0.12); noise(0.06, 2000, 0.06);
        break;
      case 'upgrade':
        osc('triangle', 520, 1040, 0.14);
        osc('sine', 780, 1560, 0.16);
        break;
      case 'sell': osc('sine', 700, 200, 0.16); break;
      case 'kill': osc('square', 200, 50, 0.1); noise(0.1, 1200, 0.14); break;
      case 'boss':
        osc('sawtooth', 70, 36, 1.1);
        noise(0.9, 400, 0.3);
        break;
      case 'leak':
        osc('square', 660, 160, 0.3);
        setTimeout(() => this.playSafe('leak2'), 180);
        break;
      case 'waveStart':
        osc('triangle', 330, 660, 0.2);
        break;
      case 'waveClear':
        osc('sine', 660, 660, 0.12);
        setTimeout(() => this.playSafe('waveClear2'), 130);
        setTimeout(() => this.playSafe('waveClear3'), 260);
        break;
      case 'tech':
        osc('triangle', 520, 780, 0.1);
        setTimeout(() => this.playSafe('tech2'), 90);
        break;
      case 'select': osc('sine', 900, 1200, 0.05); break;
      case 'click': osc('sine', 500, 700, 0.04); break;
      case 'victory': [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => this.playChord(f), i * 160)); break;
      case 'defeat': [392, 311, 233, 155].forEach((f, i) =>
        setTimeout(() => this.playChord(f), i * 220)); break;
    }
  }

  private playSafe(sfx: 'leak2' | 'waveClear2' | 'waveClear3' | 'tech2') {
    const ctx = this.ctx;
    if (!ctx || this.muted || !this.master) return;
    const t = ctx.currentTime;
    const notes: Record<typeof sfx, [number, number]> = {
      leak2: [520, 140],
      waveClear2: [880, 880],
      waveClear3: [1320, 1320],
      tech2: [1040, 1560],
    };
    const [f0, f1] = notes[sfx];
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = sfx === 'leak2' ? 'square' : 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    g.connect(this.master);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.2);
  }

  private playChord(f: number) {
    const ctx = this.ctx;
    if (!ctx || this.muted || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    g.connect(this.master);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.55);
  }
}

export const sfx = new SfxEngine();
