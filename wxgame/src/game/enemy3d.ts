// Blender 预渲染 3D 怪物行走精灵表（tools/gen-enemies-3d.py 渲染 + montage 合成）
// 每只怪物一张 sheet.png：4 列（步态相位）× 16 行（朝向），单帧 192×192
// 平台无关：由 main.ts 注入 createImage 与 assetUrl；未加载完成时调用方回退程序化绘制
import type { FxImage } from './fx';
import type { EnemyType } from './types';

export const ENEMY3D_DIRS = 16;
export const ENEMY3D_PHASES = 4;
export const ENEMY3D_FRAME = 192;
/** 分裂体死亡分裂动画相位数（split.png：6 列 × 16 行） */
export const ENEMY3D_SPLIT_PHASES = 6;

/** 怪物/炮塔美术主题：classic 原版 / horror 恐怖版 */
export type UnitTheme = 'classic' | 'horror';

const ENEMY_TYPES: EnemyType[] = ['crawler', 'speeder', 'tanker', 'splitter', 'lurker', 'miniboss', 'boss'];

export interface EnemySheet {
  img: FxImage;
  ok: boolean;
  /** 回退链已走到第几个 URL（防止 onerror 循环重试） */
  srcIdx: number;
}

const sheets: Partial<Record<EnemyType, EnemySheet>> = {};
let splitSheet: EnemySheet | null = null;
let started = false;
let theme: UnitTheme = 'classic';
let loader: { createImage: () => FxImage | null; urlOf: (path: string) => string } | null = null;

/** 按主题取候选 URL 列表：horror 先试 enemies-h，失败回退原版，最终回退包内相对路径 */
function sheetSources(urlOf: (path: string) => string, rel: string): string[] {
  const urls: string[] = [];
  if (theme === 'horror') urls.push(urlOf(rel.replace('assets/enemies/', 'assets/enemies-h/')));
  urls.push(urlOf(rel));
  urls.push(rel);
  return urls;
}

function loadSheet(rel: string): EnemySheet | null {
  if (!loader) return null;
  const im = loader.createImage();
  if (!im) return null;
  const sources = sheetSources(loader.urlOf, rel);
  const sheet: EnemySheet = { img: im, ok: false, srcIdx: 0 };
  im.onload = () => { sheet.ok = true; };
  // CDN 未上传新素材时逐级回退（horror → 原版 → 包内相对路径）；真机全失败则程序化兜底
  im.onerror = () => {
    if (sheet.srcIdx >= sources.length - 1) return;
    sheet.srcIdx += 1;
    im.src = sources[sheet.srcIdx];
  };
  im.src = sources[0];
  return sheet;
}

function loadAll() {
  for (const type of ENEMY_TYPES) {
    const sheet = loadSheet(`assets/enemies/${type}/sheet.png`);
    if (!sheet) return;
    sheets[type] = sheet;
  }
  // 分裂体死亡分裂动画（纯装饰，加载失败静默跳过）
  splitSheet = loadSheet('assets/enemies/splitter/split.png');
}

/** 启动全部怪物精灵表加载（幂等）。urlOf 负责把相对路径解析为 CDN/本地地址 */
export function initEnemy3D(createImage: () => FxImage | null, urlOf: (path: string) => string, initialTheme: UnitTheme = 'classic') {
  if (started) return;
  started = true;
  theme = initialTheme;
  loader = { createImage, urlOf };
  loadAll();
}

/** 切换美术主题：清缓存按新前缀重载（幂等；init 前调用仅记录主题） */
export function setUnitTheme(t: UnitTheme) {
  if (t === theme) return;
  theme = t;
  if (!loader) return;
  for (const key of Object.keys(sheets)) delete sheets[key as EnemyType];
  splitSheet = null;
  loadAll();
}

/** 取怪物的行走精灵表；未就绪返回 null，调用方回退程序化绘制 */
export function enemySheet3D(type: EnemyType): EnemySheet | null {
  const s = sheets[type];
  return s && s.ok ? s : null;
}

/** 分裂体死亡分裂动画精灵表；未就绪返回 null（调用方静默跳过，爆炸/冲击环已兜底） */
export function splitterSplitSheet(): EnemySheet | null {
  return splitSheet && splitSheet.ok ? splitSheet : null;
}
