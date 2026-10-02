// 用 MiniMax image-01 生成三套皮肤的效果预览图（仅预览，不改代码）
// 用法: MINIMAX_API_KEY=sk-... node tools/gen-skin-mockups.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const KEY = process.env.MINIMAX_API_KEY;
if (!KEY) { console.error('需要 MINIMAX_API_KEY'); process.exit(1); }

const OUT = '../design/ui-mock';
mkdirSync(OUT, { recursive: true });

const BASE = 'mobile tower defense game UI screenshot, portrait phone screen, dark deep space battlefield with a winding glowing cyan path on a grid map, small sci-fi turrets and alien bug enemies on the path, professional game UI design, crisp vector style UI, high detail, no watermark';

// 当前的实际布局：顶部极薄状态条 + 右侧竖排小按钮，底部矮塔栏（宽槽位只有塔图标+价格）
const LAYOUT = 'at the very top a slim 30px status bar with a small red heart icon and number, a gold diamond icon with number, and a wave counter, plus three tiny 32px square buttons for pause speed and menu, at the bottom a short compact horizontal bar with six wide tower slots, each slot shows only a large turret icon and a small gold price number below it, no tower name text, clean minimal labels';

const SKINS = [
  ['abyss', 'holographic sci-fi command interface, cyan and teal glowing thin line frames, translucent dark blue glassmorphism panels with subtle scanlines, small L-shaped corner brackets on panels, floating hologram feel, elegant futuristic'],
  ['ember', 'industrial military command console in the style of arknights UI, amber and dark brown palette, chamfered octagonal panels with cut corners, 45 degree hazard stripe ribbons, small rivets on panel corners, thick amber color blocks on the left edge of panels, monospace numbers'],
  ['matrix', 'cyberpunk neon interface, purple and magenta neon glow outlines, dark violet panels, subtle horizontal scanlines, occasional glitch distortion accents, hexagonal icons, synthwave grid horizon in background'],
];

const jobs = [];
for (const [id, style] of SKINS) {
  jobs.push([`battle-${id}`, `${BASE}, ${LAYOUT}, ${style}`]);
  jobs.push([`home-${id}`, `mobile game chapter select screen, portrait phone UI, ${style}, a list of mission cards with square space scene thumbnails, chapter numbers and status badges, difficulty selector tabs at top, clean game UI design, high detail, no watermark, minimal short english labels`]);
}

for (const [name, prompt] of jobs) {
  const res = await fetch('https://api.minimaxi.com/v1/image_generation', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'image-01', prompt, aspect_ratio: '9:16', response_format: 'base64', n: 1, prompt_optimizer: false }),
  });
  const json = await res.json();
  const b64 = json?.data?.image_base64?.[0];
  if (!b64) {
    console.error(`${name} 失败:`, JSON.stringify(json).slice(0, 200));
    continue;
  }
  writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(b64, 'base64'));
  console.log(`✓ ${name}`);
}
