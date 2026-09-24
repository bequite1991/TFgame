// 章节旁白混音脚本：把 audio-src/bgm.mp3（氛围音乐）循环低音量垫在 audio-src/lvXX.mp3（旁白干声）底下
// 用法：node tools/mix-bgm.mjs [--force]
// 依赖 ffmpeg（PATH 中）；输入在 audio-src/，输出成品到 assets/audio/
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const srcDir = join(root, 'audio-src');
const outDir = join(root, 'assets', 'audio');
const BGM = join(srcDir, 'bgm.mp3');
// BGM 相对旁白约 -34dB：听感上是有存在感的氛围底垫、不盖人声
const BGM_VOL = process.env.BGM_VOL || '0.02';
const FORCE = process.argv.includes('--force');

if (!existsSync(BGM)) {
  console.error('缺少 audio-src/bgm.mp3（氛围音乐源）');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const narrations = readdirSync(srcDir).filter((f) => /^lv\d+\.mp3$/.test(f)).sort();
if (narrations.length === 0) {
  console.error('audio-src/ 下没有 lvXX.mp3 旁白干声，请先运行 gen-audio.mjs');
  process.exit(1);
}

for (const f of narrations) {
  const out = join(outDir, basename(f));
  if (!FORCE && existsSync(out)) { console.log(`- 跳过 ${f}（已存在，--force 可重混）`); continue; }
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', join(srcDir, f),
    '-stream_loop', '-1', '-i', BGM,
    '-filter_complex',
    `[1:a]volume=${BGM_VOL}[bg];[0:a][bg]amix=inputs=2:duration=first:normalize=0[out]`,
    '-map', '[out]', '-ar', '32000', '-ac', '1', '-b:a', '48k', out,
  ], { stdio: 'inherit' });
  console.log(`✓ ${f} 已混入背景音乐`);
}
console.log(`完成，输出目录 ${outDir}`);
