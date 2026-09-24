// 塔/敌人小图标 —— 复用游戏渲染原语绘制到小画布
import { useEffect, useRef } from 'react';
import { drawEnemy, drawTower } from '@/game/render';
import { ENEMIES } from '@/game/config';
import { getTowerSprite } from '@/game/sprites';
import type { EnemyType, TowerType } from '@/game/types';

interface Props {
  kind: 'tower' | 'enemy';
  type: TowerType | EnemyType;
  level?: number;
  size?: number; // CSS 像素
  className?: string;
}

export default function UnitIcon({ kind, type, level = 0, size = 64, className = '' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    let raf = 0;
    const t0 = performance.now();
    const render = () => {
      const time = (performance.now() - t0) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      if (kind === 'tower') {
        const sprite = getTowerSprite(type as TowerType, level);
        if (sprite) {
          // 精灵：底座 + 炮身轻微摆动（精灵炮身朝上，无需 -90° 基准角）
          const sz = size * 0.95;
          ctx.drawImage(sprite.base, -sz / 2, -sz / 2, sz, sz);
          ctx.save();
          ctx.rotate(Math.sin(time * 0.8) * 0.15);
          ctx.drawImage(sprite.idle, -sz / 2, -sz / 2, sz, sz);
          ctx.restore();
        } else {
          drawTower(ctx, type as TowerType, level, size * 0.9, -Math.PI / 2 + Math.sin(time * 0.8) * 0.15, 0, time);
        }
      } else {
        drawEnemy(ctx, type as EnemyType, ENEMIES[type as EnemyType].size * (size / 96), time);
      }
      ctx.restore();
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [kind, type, level, size]);

  return <canvas ref={ref} style={{ width: size, height: size }} className={className} />;
}
