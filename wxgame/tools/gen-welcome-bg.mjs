// 欢迎页背景渲染脚本（纯程序化生成，无外部依赖）
// 用法：node tools/gen-welcome-bg.mjs
// 输出：tools/.tmp-welcome-bg.png（随后用 sips 转 assets/welcome-bg.jpg）
// 画面：深空恐怖 —— 死寂星野 + 尘带暗区 + 被侵蚀的殖民行星（右下）+ 虫群孢子 + 渗血星云
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 720, H = 1280;

// ---------- 确定性伪随机 ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 值噪声 + fBm ----------
function makeNoise2(seed) {
  const rand = mulberry32(seed);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = rand();
  const at = (ix, iy) => vals[perm[(ix & 255) + perm[iy & 255]]];
  const sm = (v) => v * v * (3 - 2 * v);
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const u = sm(fx), v = sm(fy);
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbmFactory(seed, oct) {
  const ns = Array.from({ length: oct }, (_, i) => makeNoise2(seed + i * 101));
  return (x, y) => {
    let s = 0, amp = 0.5, f = 1, tot = 0;
    for (let i = 0; i < oct; i++) { s += ns[i](x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
    return s / tot;
  };
}
const fbmNeb = fbmFactory(1001, 5);
const fbmDust = fbmFactory(2002, 4);
const fbmRock = fbmFactory(3003, 4);

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- 基础层：深空渐变 + 星云 + 尘带 ----------
const buf = new Float32Array(W * H * 3);
const nebAx = W * 1.02, nebAy = -H * 0.06; // 渗血星云锚点（右上）
const nebBx = W * 0.12, nebBy = H * 0.82;  // 暗紫星云锚点（左下）
for (let y = 0; y < H; y++) {
  const gy = y / H;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    // 深空底色（近黑垂直渐变）
    let r = 4 + 3 * Math.sin(gy * Math.PI);
    let g = 6 + 4 * Math.sin(gy * Math.PI);
    let b = 14 + 10 * Math.sin(gy * Math.PI);
    const gx = x / W;
    // 渗血星云：品红核 + 紫外晕，fBm 塑形
    const dA = Math.hypot((x - nebAx) / (W * 1.1), (y - nebAy) / (W * 1.1));
    const fallA = Math.max(0, 1 - dA);
    const nA = fbmNeb(gx * 3.2, gy * 5.7);
    const nebA = fallA * fallA * (0.35 + 0.65 * nA);
    r += 255 * 0.34 * nebA; g += 20 * 0.2 * nebA; b += 129 * 0.3 * nebA;
    r += 122 * 0.1 * nebA * (1 - nA); b += 208 * 0.16 * nebA * (1 - nA);
    // 左下暗紫星云
    const dB = Math.hypot((x - nebBx) / (W * 0.85), (y - nebBy) / (W * 0.85));
    const nebB = Math.max(0, 1 - dB) ** 2 * fbmNeb(gx * 2.4 + 7, gy * 4.3 + 3);
    r += 139 * 0.08 * nebB; b += 246 * 0.1 * nebB;
    // 尘带：吞噬星光的暗区
    const dust = fbmDust(gx * 2.8 + 11, gy * 5 + 5);
    const dk = 1 - 0.62 * smooth(0.52, 0.78, dust);
    r *= dk; g *= dk; b *= dk;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
  }
}

// ---------- 叠加层（加法混合的小工具） ----------
function addGlow(cx, cy, rad, r, g, b, a) {
  const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(W - 1, Math.ceil(cx + rad));
  const y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(H - 1, Math.ceil(cy + rad));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy) / rad;
      if (d >= 1) continue;
      const k = (1 - d) * (1 - d) * a;
      const i = (y * W + x) * 3;
      buf[i] += r * k; buf[i + 1] += g * k; buf[i + 2] += b * k;
    }
  }
}

// ---------- 死寂星野（部分位于尘带里的星直接熄灭） ----------
const rng = mulberry32(4099);
for (let s = 0; s < 850; s++) {
  const x = rng() * W, y = rng() * H;
  const dust = fbmDust((x / W) * 2.8 + 11, (y / H) * 5 + 5);
  if (dust > 0.6 && rng() < 0.75) continue; // 被尘带吞掉
  const mag = rng();
  const bright = mag < 0.08 ? 1.6 : mag < 0.3 ? 1.0 : 0.55;
  const warm = rng() < 0.12;
  const cr = warm ? 255 : 207, cg = warm ? 220 : 224, cb = warm ? 170 : 255;
  addGlow(x, y, bright * (0.8 + rng()), cr, cg, cb, 0.5 + rng() * 0.5);
}

// ---------- 蚀星：右下被侵染的殖民行星 ----------
const px = W * 1.3, py = H * 1.12, pr = W * 0.98;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = x - px, dy = y - py;
    const d = Math.hypot(dx, dy);
    const i = (y * W + x) * 3;
    if (d < pr) {
      // 暗面：近黑玄武岩，fBm 地表起伏
      const rock = fbmRock(x / 90, y / 90);
      const shade = 0.7 + 0.5 * rock;
      buf[i] = 8 * shade + 4; buf[i + 1] = 12 * shade + 5; buf[i + 2] = 26 * shade + 8;
    } else if (d < pr + 26) {
      // 大气残辉
      const k = (1 - (d - pr) / 26) ** 2 * 0.35;
      buf[i] += 34 * k; buf[i + 1] += 120 * k; buf[i + 2] += 160 * k;
    }
    // 轮廓冷光：上缘一线，π(左)→1.5π(顶)，青 → 品红渐变
    const ang = Math.atan2(dy, dx); // [-π, π]
    let a = ang < 0 ? ang + Math.PI * 2 : ang;
    if (a >= Math.PI * 0.98 && a <= Math.PI * 1.52) {
      const rim = Math.exp(-((d - pr) ** 2) / 18);
      const seg = (a - Math.PI) / (Math.PI * 0.5); // 0=左 1=顶
      buf[i] += (34 + (255 - 34) * seg) * rim * 0.5;
      buf[i + 1] += (224 - 163 * seg) * rim * 0.5;
      buf[i + 2] += (255 - 126 * seg) * rim * 0.5;
    }
  }
}
// 侵染斑：暗面上缓慢扩散的酸绿/品红病灶
const rp = mulberry32(8801);
for (let c = 0; c < 9; c++) {
  const a0 = Math.PI * (1.02 + rp() * 0.46);
  const rr = pr * (0.45 + rp() * 0.42);
  const cx = px + Math.cos(a0) * rr;
  const cy = py + Math.sin(a0) * rr;
  const green = rp() < 0.55;
  addGlow(cx, cy, 22 + rp() * 42, green ? 184 : 255, green ? 255 : 61, green ? 61 : 129, 0.05 + rp() * 0.07);
}
// 侵蚀裂痕：酸绿/品红随机折线 + 光晕
for (let c = 0; c < 8; c++) {
  const rc = mulberry32(7000 + c * 13);
  const a0 = Math.PI * (1.03 + rc() * 0.42);
  let cx = px + Math.cos(a0) * pr * (0.6 + rc() * 0.3);
  let cy = py + Math.sin(a0) * pr * (0.6 + rc() * 0.3);
  const green = c % 2 === 0;
  const cr = green ? 184 : 255, cg = green ? 255 : 61, cb = green ? 61 : 129;
  let dir = a0 + Math.PI / 2;
  for (let k = 0; k < 34; k++) {
    dir += (rc() - 0.5) * 1.1;
    cx += Math.cos(dir) * (4 + rc() * 7);
    cy += Math.sin(dir) * (4 + rc() * 7);
    if (Math.hypot(cx - px, cy - py) > pr) break;
    addGlow(cx, cy, 6, cr, cg, cb, 0.22);
    addGlow(cx, cy, 1.8, cr, cg, cb, 0.8);
  }
}

// ---------- 虫群孢子：右上 → 左下的迁移流 ----------
const rs = mulberry32(5011);
for (let s = 0; s < 150; s++) {
  const t = rs();
  const fx = 1.05 - t * 0.85 + (rs() - 0.5) * 0.22;
  const fy = -0.04 + t * 0.6 + (rs() - 0.5) * 0.18;
  const green = rs() < 0.16;
  addGlow(fx * W, fy * H, green ? 3.2 : 2.2, green ? 184 : 255, green ? 255 : 61, green ? 61 : 129, 0.5 + rs() * 0.45);
}

// ---------- 远方求救信标（左上，带光晕的青色亮点） ----------
addGlow(W * 0.16, H * 0.18, 14, 34, 224, 255, 0.3);
addGlow(W * 0.16, H * 0.18, 3, 200, 245, 255, 0.95);

// ---------- 烘焙暗角 ----------
const vcx = W / 2, vcy = H * 0.42, vmax = Math.hypot(W, H) * 0.62;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - vcx, y - vcy) / vmax;
    const k = 1 - 0.72 * smooth(0.45, 1, d);
    const i = (y * W + x) * 3;
    buf[i] *= k; buf[i + 1] *= k; buf[i + 2] *= k;
  }
}

// ---------- PNG 编码（RGB8，filter 0） ----------
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) {
  const row = y * (W * 3 + 1);
  raw[row] = 0;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    raw[row + 1 + x * 3] = clamp(Math.round(buf[i]));
    raw[row + 2 + x * 3] = clamp(Math.round(buf[i + 1]));
    raw[row + 3 + x * 3] = clamp(Math.round(buf[i + 2]));
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b) => {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
};
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; // 8bit RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outFile = join(dirname(fileURLToPath(import.meta.url)), '.tmp-welcome-bg.png');
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, png);
console.log('已渲染:', outFile, `${(png.length / 1024).toFixed(0)}KB`, `(${W}x${H})`);
