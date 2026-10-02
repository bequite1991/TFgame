// 用 MiniMax image-01 生成游戏 UI 设计稿（仅预览，不改代码）
// 用法: MINIMAX_API_KEY=sk-... node tools/gen-ui-mockups.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const KEY = process.env.MINIMAX_API_KEY;
if (!KEY) { console.error('需要 MINIMAX_API_KEY'); process.exit(1); }

const OUT = '../design/ui-mock';
mkdirSync(OUT, { recursive: true });

const BASE = 'mobile game UI design mockup, deep space horror tower defense game, portrait phone screen interface, dark cosmic background, clean game HUD layout, professional game UI design, high detail, no watermark, minimal short english labels';

const STYLE_A = 'holographic cyan and teal palette, thin glowing line frames, sleek futuristic sci-fi UI, subtle hexagon grid texture, glassmorphism dark panels, elegant and clean';
const STYLE_B = 'corrupted horror palette, deep blacks with blood-red and magenta glitch accents, distressed bio-organic tendril ornaments creeping from screen edges, scanline noise, oppressive cosmic dread';

const SCREENS = [
  ['welcome', 'title welcome screen, large broken orbital ring emblem glowing at upper third, big game title text area in the middle, two short terminal-style status lines, one large glowing start button, three small square menu buttons in a row near the bottom'],
  ['levels', 'chapter select screen, vertical scrolling list of five mission cards, each card has a square scene thumbnail on the left and status badge on the right, segmented difficulty tabs at top, one locked card with padlock icon'],
  ['battle', 'tower defense gameplay screen, dark grid battlefield with a winding glowing path, top status bar with heart icon, gold counter and wave indicator, pause and speed buttons, bottom horizontal tower selection bar with six tower cards showing price'],
  ['settings', 'settings popup panel centered over dimmed starfield, five setting rows each with a small icon and a toggle switch, holographic glowing frame with corner brackets, small close button on top right'],
];

const jobs = [];
for (const [name, desc] of SCREENS) {
  jobs.push([`${name}-A-cyan`, `${BASE}, ${desc}, ${STYLE_A}`, '9:16']);
  jobs.push([`${name}-B-horror`, `${BASE}, ${desc}, ${STYLE_B}`, '9:16']);
}

for (const [name, prompt, ratio] of jobs) {
  const res = await fetch('https://api.minimaxi.com/v1/image_generation', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'image-01', prompt, aspect_ratio: ratio, response_format: 'base64', n: 1, prompt_optimizer: false }),
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
