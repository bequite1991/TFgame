// 打包脚本：把 src/main.ts 与 src/game 引擎层打包为根目录 game.js
// 运行：node build.mjs
import * as esbuild from 'esbuild';

// 构建号：MMDD-HHmm（本地时间），欢迎页右下角水印，用于确认真机跑的是哪次构建
const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const buildId = `b${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;

await esbuild.build({
  entryPoints: ['src/main.ts'],
  outfile: 'game.js',
  bundle: true,
  format: 'iife',
  target: 'es2020',
  logLevel: 'info',
  define: { __BUILD_ID__: JSON.stringify(buildId) },
});
