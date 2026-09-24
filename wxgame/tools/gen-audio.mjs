// 章节简报旁白生成脚本（MiniMax TTS t2a_v2）
// 用法：
//   MINIMAX_API_KEY=xxx node tools/gen-audio.mjs
// 可选：MINIMAX_VOICE=audiobook_male_1（默认深沉男声旁白）/ MINIMAX_GROUP_ID（旧版 JWT key 才需要）
// 输出：audio-src/lv01.mp3 ~ lv13.mp3（纯旁白干声；已存在则跳过，--force 强制重生成）
// 干声生成后运行 node tools/mix-bgm.mjs 混入背景音乐，产出 assets/audio/ 下的成品
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);
const esbuild = require(join(root, '..', 'app', 'node_modules', 'esbuild', 'lib', 'main.js'));

const KEY = process.env.MINIMAX_API_KEY;
const GROUP = process.env.MINIMAX_GROUP_ID; // 旧版 JWT key 才需要；sk-api- 新 key 不用
const HOST = process.env.MINIMAX_HOST || 'https://api.minimaxi.com';
const VOICE = process.env.MINIMAX_VOICE || 'audiobook_male_1';
const FORCE = process.argv.includes('--force');

if (!KEY) {
  console.error('缺少环境变量：MINIMAX_API_KEY');
  console.error('在 MiniMax 开放平台 https://platform.minimaxi.com 的「账户管理」里获取。');
  process.exit(1);
}

// 用 esbuild 把 TS 关卡配置打成临时 ESM 再导入，避免手写解析
const tmp = join(here, '.tmp-levels.mjs');
await esbuild.build({
  entryPoints: [join(root, '..', 'app', 'src', 'game', 'levels.ts')],
  outfile: tmp, bundle: true, format: 'esm', target: 'es2020', logLevel: 'silent',
});
const { LEVELS } = await import(pathToFileURL(tmp).href);
rmSync(tmp, { force: true });

const outDir = join(root, 'audio-src');
mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function synth(text) {
  const url = `${HOST}/v1/t2a_v2${GROUP ? `?GroupId=${GROUP}` : ''}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'speech-02-hd',
      text,
      stream: false,
      voice_setting: { voice_id: VOICE, speed: 0.95, vol: 1, pitch: -1 },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
    }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const json = await resp.json();
  if (json.base_resp && json.base_resp.status_code !== 0) {
    throw new Error(`MiniMax ${json.base_resp.status_code}: ${json.base_resp.status_msg}`);
  }
  const hex = json?.data?.audio;
  if (!hex) throw new Error(`响应无音频数据: ${JSON.stringify(json).slice(0, 200)}`);
  return Buffer.from(hex, 'hex');
}

let done = 0;
let skipped = 0;
for (const lv of LEVELS) {
  const file = join(outDir, `lv${String(lv.id).padStart(2, '0')}.mp3`);
  if (!FORCE && existsSync(file)) { skipped++; continue; }
  // 章节标题 + 简报全文，读成一段沉浸式任务背景
  const text = `第${lv.id}章，${lv.name}。${lv.briefing.join('')}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const buf = await synth(text);
      writeFileSync(file, buf);
      console.log(`✓ lv${String(lv.id).padStart(2, '0')} ${lv.name}  ${(buf.length / 1024).toFixed(0)}KB`);
      done++;
      break;
    } catch (e) {
      console.error(`✗ lv${lv.id} 第${attempt}次失败: ${e.message}`);
      if (attempt === 3) process.exitCode = 1;
      await sleep(1500 * attempt);
    }
  }
  await sleep(500);
}
console.log(`完成：生成 ${done}，跳过 ${skipped}，输出目录 ${outDir}`);
