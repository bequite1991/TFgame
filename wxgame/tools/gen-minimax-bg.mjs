// 用 MiniMax image-01 生成欢迎页背景候选图
// 用法: MINIMAX_API_KEY=sk-... node tools/gen-minimax-bg.mjs
import { writeFileSync } from 'node:fs';

const KEY = process.env.MINIMAX_API_KEY;
if (!KEY) { console.error('需要 MINIMAX_API_KEY'); process.exit(1); }

const PROMPTS = [
  // A: 死寂星环 + 熄灭恒星
  'deep space horror scene viewed from a derelict listening post, a colossal shattered orbital ring station drifting in a dying starfield, most stars extinguished leaving black voids, faint teal nebula mist and one sickly blood-red star, floating debris and ice shards, cosmic dread, oppressive darkness, cinematic matte painting, ultra detailed, no text, no watermark',
  // B: 虫群深渊 + 触须阴影
  'cosmic horror deep space, a swarm of alien spore creatures silhouetted against a dim dying galaxy, enormous shadowy tendrils reaching from an abyssal black hole, eerie bioluminescent teal spores drifting, blood-red rim light, deep blacks, oppressive atmosphere, cinematic sci-fi horror concept art, ultra detailed, no text, no watermark',
  // C: 坟场视角 + 故障空间站
  'deep space graveyard of broken warships and station wreckage, a flickering dying star casting weak teal light, vast empty black void swallowing the lower half of the frame, faint red emergency lights blinking on distant hulls, sense of abandonment and cosmic dread, cinematic wide shot, ultra detailed dark sci-fi horror, no text, no watermark',
];

for (let i = 0; i < PROMPTS.length; i++) {
  const res = await fetch('https://api.minimaxi.com/v1/image_generation', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'image-01',
      prompt: PROMPTS[i],
      aspect_ratio: '9:16',
      response_format: 'base64',
      n: 1,
      prompt_optimizer: false,
    }),
  });
  const json = await res.json();
  const b64 = json?.data?.image_base64?.[0];
  if (!b64) {
    console.error(`候选 ${i} 失败:`, JSON.stringify(json).slice(0, 300));
    continue;
  }
  const file = `tools/welcome-cand-${i}.jpg`;
  writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log(`候选 ${i} -> ${file}`);
}
