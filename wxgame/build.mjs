// 打包脚本：把 src/main.ts 与 ../app/src/game 纯逻辑层打包为根目录 game.js
// 运行：node build.mjs
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require(join(
  dirname(fileURLToPath(import.meta.url)), '..', 'app', 'node_modules', 'esbuild', 'lib', 'main.js',
));

await esbuild.build({
  entryPoints: ['src/main.ts'],
  outfile: 'game.js',
  bundle: true,
  format: 'iife',
  target: 'es2020',
  logLevel: 'info',
});
