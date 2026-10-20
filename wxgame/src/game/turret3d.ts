// Blender 预渲染 3D 炮塔精灵表（tools/gen-towers-3d.py 渲染 + montage 合成）
// 每种塔一张 sheet.png：4 列（待机相位）× 24 行（朝向，0=炮口朝上、顺时针），单帧 192×192
// 平台无关：由 main.ts 注入 createImage 与 assetUrl；未加载完成时调用方回退程序化绘制
import type { FxImage } from './fx';
import type { UnitTheme } from './enemy3d';
import type { TowerType } from './types';

export const TURRET3D_DIRS = 24;
export const TURRET3D_PHASES = 4;
export const TURRET3D_FRAME = 192;

const TOWER_TYPES: TowerType[] = ['laser', 'missile', 'frost', 'railgun', 'tesla', 'plasma'];

export interface TurretSheet {
  img: FxImage;
  ok: boolean;
  /** 回退链已走到第几个 URL（防止 onerror 循环重试） */
  srcIdx: number;
}

const sheets: Partial<Record<TowerType, TurretSheet>> = {};
let started = false;
let theme: UnitTheme = 'classic';
let loader: { createImage: () => FxImage | null; urlOf: (path: string) => string } | null = null;

/** 按主题取候选 URL 列表：horror 先试 turrets-h，失败回退原版，最终回退包内相对路径 */
function sheetSources(urlOf: (path: string) => string, rel: string): string[] {
  const urls: string[] = [];
  if (theme === 'horror') urls.push(urlOf(rel.replace('assets/turrets/', 'assets/turrets-h/')));
  urls.push(urlOf(rel));
  urls.push(rel);
  return urls;
}

function loadSheet(rel: string): TurretSheet | null {
  if (!loader) return null;
  const im = loader.createImage();
  if (!im) return null;
  const sources = sheetSources(loader.urlOf, rel);
  const sheet: TurretSheet = { img: im, ok: false, srcIdx: 0 };
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
  for (const type of TOWER_TYPES) {
    const sheet = loadSheet(`assets/turrets/${type}/sheet.png`);
    if (!sheet) return;
    sheets[type] = sheet;
  }
}

/** 启动全部炮塔精灵表加载（幂等）。urlOf 负责把相对路径解析为 CDN/本地地址 */
export function initTurret3D(createImage: () => FxImage | null, urlOf: (path: string) => string, initialTheme: UnitTheme = 'classic') {
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
  for (const key of Object.keys(sheets)) delete sheets[key as TowerType];
  loadAll();
}

/** 取炮塔的精灵表；未就绪返回 null，调用方回退程序化绘制 */
export function turretSheet3D(type: TowerType): TurretSheet | null {
  const s = sheets[type];
  return s && s.ok ? s : null;
}
