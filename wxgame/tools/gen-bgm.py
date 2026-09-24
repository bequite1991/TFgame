#!/usr/bin/env python3
# 游戏 BGM 作曲渲染器：numpy 合成 → wav → ffmpeg 转 mp3
# 两首循环：bgm-home（主页，80BPM 史诗太空氛围）/ bgm-battle（战斗，120BPM 紧张驱动）
# 用法：python3 tools/gen-bgm.py
import os
import subprocess
import wave
import numpy as np

SR = 32000
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
RAW = os.path.join(ROOT, 'audio-src')
OUT = os.path.join(ROOT, 'assets', 'bgm')

mf = lambda m: 440.0 * 2 ** ((m - 69) / 12)  # midi → 频率


def add_saw(f, n, kmax=6):
    """限带锯齿（叠加谐波，免滤波）"""
    t = np.arange(n) / SR
    y = np.zeros(n)
    for k in range(1, kmax + 1):
        y += np.sin(2 * np.pi * f * k * t) / k
    return y * 0.6


def osc(f, n, kind='sine'):
    t = np.arange(n) / SR
    ph = f * t
    if kind == 'sine':
        return np.sin(2 * np.pi * ph)
    if kind == 'tri':
        return 2 * np.abs(2 * (ph % 1) - 1) - 1
    if kind == 'sq':
        return np.sign(np.sin(2 * np.pi * ph))
    return add_saw(f, n)


def env(n, a, r):
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na > 0:
        e[:na] *= np.linspace(0, 1, na) ** 1.5
    if nr > 0:
        e[-nr:] *= np.linspace(1, 0, nr) ** 1.5
    return e


class Track:
    def __init__(self, dur):
        self.y = np.zeros(int(dur * SR))

    def note(self, midi, t0, dur, kind='sine', vol=0.2, a=0.01, r=0.1):
        n = int(dur * SR)
        s = self.y[int(t0 * SR):int(t0 * SR) + n]
        if len(s) < n:
            n = len(s)
        self.y[int(t0 * SR):int(t0 * SR) + n] += osc(mf(midi), n, kind)[:n] * env(n, a, r) * vol

    def kick(self, t0, vol=0.5):
        n = int(0.28 * SR)
        t = np.arange(n) / SR
        f = 52 + 60 * np.exp(-t * 30)  # 快速下滑的鼓皮
        y = np.sin(2 * np.pi * f * t) * np.exp(-t * 18) * vol
        i = int(t0 * SR)
        self.y[i:i + n] += y[:len(self.y[i:i + n])]

    def snare(self, t0, vol=0.25):
        n = int(0.16 * SR)
        t = np.arange(n) / SR
        y = (np.random.randn(n) * 0.6 + np.sin(2 * np.pi * 190 * t)) * np.exp(-t * 30) * vol
        i = int(t0 * SR)
        self.y[i:i + n] += y[:len(self.y[i:i + n])]

    def hat(self, t0, vol=0.05):
        n = int(0.05 * SR)
        t = np.arange(n) / SR
        y = np.random.randn(n) * np.exp(-t * 90) * vol
        i = int(t0 * SR)
        self.y[i:i + n] += y[:len(self.y[i:i + n])]

    def echo(self, taps=((0.375, 0.25), (0.75, 0.15), (1.125, 0.08))):
        for d, g in taps:
            k = int(d * SR)
            self.y[k:] += self.y[:-k] * g


def master(t: Track, loop_dur, path):
    y = t.y
    # 循环接缝：尾部混响绕回开头
    L = int(loop_dur * SR)
    loop = y[:L].copy()
    loop[:len(y) - L] += y[L:]
    loop = np.tanh(loop * 1.4)          # 软限幅
    loop *= 0.85 / max(1e-6, np.max(np.abs(loop)))
    pcm = (loop * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# 和弦表（midi 三连音）与低音根音
CHORDS = {
    'Am': ([57, 60, 64], 33), 'F': ([53, 57, 60], 29), 'C': ([60, 64, 67], 36),
    'G': ([55, 59, 62], 31), 'Dm': ([50, 53, 57], 38), 'E': ([52, 56, 59], 28),
}


def pad(t, chord, t0, bar, vol):
    for m in CHORDS[chord][0]:
        t.note(m, t0, bar + 0.4, 'saw', vol=vol, a=0.5, r=0.9)
        t.note(m - 12, t0, bar + 0.4, 'tri', vol=vol * 0.8, a=0.5, r=0.9)


def home():
    bpm, bars = 80, 16
    beat = 60 / bpm
    bar = beat * 4
    loop = bars * bar
    t = Track(loop + 3)
    prog = ['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G', 'Am', 'Am', 'F', 'F', 'Dm', 'Dm', 'E', 'E']
    for i, ch in enumerate(prog):
        t0 = i * bar
        pad(t, ch, t0, bar, vol=0.045)
        root = CHORDS[ch][1]
        t.note(root, t0, beat * 1.8, 'sine', vol=0.20, a=0.02, r=0.2)          # 低音半音符
        t.note(root, t0 + beat * 2, beat * 1.8, 'sine', vol=0.18, a=0.02, r=0.2)
        tones = CHORDS[ch][0] + [CHORDS[ch][0][0] + 12]
        pat = [0, 1, 2, 1, 3, 1, 2, 1]
        for j in range(8):                                                     # 八分琶音
            t.note(tones[pat[j]] + 12, t0 + j * beat / 2, 0.32, 'tri', vol=0.055, a=0.01, r=0.12)
        t.kick(t0, 0.42)
        t.kick(t0 + beat * 2, 0.36)
        t.snare(t0 + beat * 2, 0.10)
        for j in range(8):
            t.hat(t0 + j * beat / 2, 0.035 if j % 2 else 0.05)
    # 主旋律（A 小调五声，两段呼应）
    q, h, w = beat, beat * 2, beat * 4
    motif1 = [(64, q), (62, q), (60, h), (57, h), (60, q), (62, q), (64, q), (67, q), (64, h), (62, h * 1.5), (60, q)]
    motif2 = [(64, q), (67, q), (69, h), (67, h), (64, q), (62, q), (64, q), (62, q), (60, h), (57, w)]
    tt = 4 * bar
    for m, d in motif1:
        t.note(m, tt, d * 0.95, 'tri', vol=0.15, a=0.03, r=0.15)
        tt += d
    tt = 12 * bar
    for m, d in motif2:
        t.note(m, tt, d * 0.95, 'tri', vol=0.15, a=0.03, r=0.15)
        tt += d
    t.echo()
    return t, loop


def battle():
    bpm, bars = 120, 16
    beat = 60 / bpm
    bar = beat * 4
    loop = bars * bar
    t = Track(loop + 3)
    prog = ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'] * 2
    for i, ch in enumerate(prog):
        t0 = i * bar
        pad(t, ch, t0, bar, vol=0.02)
        root = CHORDS[ch][1] + 12
        for j in range(8):                                                     # 驱动八分贝斯
            oct_up = 12 if (i % 4 == 3 and j >= 6) else 0
            t.note(root + oct_up, t0 + j * beat / 2, 0.22, 'saw', vol=0.16, a=0.01, r=0.08)
        tones = CHORDS[ch][0] + [CHORDS[ch][0][0] + 12]
        for j in range(16):                                                    # 十六分琶音
            t.note(tones[[0, 1, 2, 1][j % 4]] + 12, t0 + j * beat / 4, 0.16, 'sq', vol=0.035, a=0.005, r=0.06)
        for b in range(4):
            t.kick(t0 + b * beat, 0.55)                                        # 四踩
        t.snare(t0 + beat, 0.28)
        t.snare(t0 + beat * 3, 0.28)
        for j in range(8):
            t.hat(t0 + j * beat / 2, 0.03 if j % 2 else 0.055)
    # 断奏短句（每四 bar 一句，越到后面越密）
    e, q, h, w = beat / 2, beat, beat * 2, beat * 4
    phrases = [
        (0, [(64, e), (64, e), (67, q), (69, q), (67, q)]),
        (4, [(64, e), (62, e), (60, q), (62, q), (64, q)]),
        (8, [(69, q), (67, q), (64, h)]),
        (12, [(62, e), (64, e), (62, e), (60, e), (57, w)]),
    ]
    for start_bar, phrase in phrases:
        tt = start_bar * bar
        for m, d in phrase:
            t.note(m, tt, d * 0.85, 'sq', vol=0.075, a=0.01, r=0.08)
            t.note(m - 12, tt, d * 0.85, 'tri', vol=0.06, a=0.01, r=0.08)
            tt += d
    t.echo(taps=((0.25, 0.22), (0.5, 0.12), (0.75, 0.06)))
    return t, loop


def render(name, make):
    t, loop = make()
    wav = os.path.join(RAW, f'{name}.wav')
    mp3 = os.path.join(OUT, f'{name}.mp3')
    master(t, loop, wav)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav,
                    '-ar', '32000', '-ac', '1', '-b:a', '96k', mp3], check=True)
    print(f'✓ {name}  {loop:.0f}s  {os.path.getsize(mp3) // 1024}KB')


os.makedirs(RAW, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
render('bgm-home', home)
render('bgm-battle', battle)
