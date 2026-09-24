// Blender 渲染炮台精灵加载器 —— 启动时拉取 manifest 并预加载全部帧
import type { TowerType } from './types';

export interface TowerSpriteSet {
  base: HTMLImageElement;
  idle: HTMLImageElement;
  fire: HTMLImageElement[];
}

interface ManifestLevel {
  base: string;
  idle: string;
  fire: string[];
}

interface Manifest {
  towers: Record<string, Record<string, ManifestLevel>>;
}

const BASE_URL = `${import.meta.env.BASE_URL}sprites/towers/`;

let started = false;
let ready = false;
// key: `${type}:${level}`（level 为引擎内部 0|1|2，manifest 为 1-3）
const cache = new Map<string, TowerSpriteSet>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`sprite load failed: ${url}`));
    img.src = url;
  });
}

export function preloadTowerSprites(): void {
  if (started || typeof Image === 'undefined') return;
  started = true;
  fetch(`${BASE_URL}manifest.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`manifest ${r.status}`);
      return r.json() as Promise<Manifest>;
    })
    .then(async (manifest) => {
      const jobs: Promise<void>[] = [];
      for (const [type, levels] of Object.entries(manifest.towers)) {
        for (const [lv, files] of Object.entries(levels)) {
          jobs.push(
            (async () => {
              const [base, idle, ...fire] = await Promise.all([
                loadImage(BASE_URL + files.base),
                loadImage(BASE_URL + files.idle),
                ...files.fire.map((f) => loadImage(BASE_URL + f)),
              ]);
              cache.set(`${type}:${Number(lv) - 1}`, { base, idle, fire });
            })(),
          );
        }
      }
      await Promise.all(jobs);
      ready = true;
    })
    .catch(() => {
      // 加载失败保持程序化绘制 fallback
    });
}

export function spritesReady(): boolean {
  return ready;
}

/** 未加载完成或缺失时返回 null，调用方走程序化 fallback */
export function getTowerSprite(type: TowerType, level: number): TowerSpriteSet | null {
  if (!ready) return null;
  return cache.get(`${type}:${level}`) ?? null;
}

// 模块加载即开始预加载（每帧渲染自查 ready，无需通知机制）
if (typeof window !== 'undefined') preloadTowerSprites();
