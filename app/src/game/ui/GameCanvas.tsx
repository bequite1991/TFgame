// Canvas 渲染层 —— 只读 GameState 快照，统一 pointer 事件服务鼠标与触屏
import { useEffect, useRef } from 'react';
import { CELL, COLS, ROWS, W, H, TOWERS, ENEMIES } from '../config';
import { drawBase, drawEnemy, drawMapBackground, drawPath, drawTower } from '../render';
import { getTowerSprite } from '../sprites';
import type { GameEngine, TowerType } from '../types';

// 确定性伪随机（环境尘埃用，避免每帧分配随机表）
const hash01 = (n: number) => {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

interface Props {
  engine: GameEngine;
  placing: TowerType | null;
  selectedId: number | null;
  onCellClick: (col: number, row: number) => void;
  onHoverCell?: (col: number, row: number) => void;
  hoverCell: { col: number; row: number } | null;
}

export default function GameCanvas({ engine, placing, selectedId, onCellClick, onHoverCell, hoverCell }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 最新 props 供 rAF 闭包读取
  const live = useRef({ placing, selectedId, hoverCell });
  live.current = { placing, selectedId, hoverCell };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const { posAt, isBuildable, exits, paths } = engine.map;
    const pathPixelsList = paths.map((p) => p.pixels);

    let raf = 0;
    const render = () => {
      const s = engine.state;
      const time = s.clock;
      const { placing: pl, selectedId: sel, hoverCell: hc } = live.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 屏幕震动
      if (s.shake > 0) {
        const m = s.shake * 6;
        ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
      }

      drawMapBackground(ctx, W, H);

      // 环境星尘：缓慢漂浮的微光点（纯 time 驱动、确定性伪随机）
      ctx.save();
      ctx.fillStyle = '#A9C7FF';
      for (let i = 0; i < 26; i++) {
        const sx = (hash01(i * 3 + 1) * W + time * (2 + hash01(i + 40) * 6)) % W;
        const sy = (hash01(i * 7 + 2) * H + Math.sin(time * 0.15 + i * 1.7) * 14 + H) % H;
        const sr = 0.6 + hash01(i * 5 + 3) * 1.1;
        ctx.globalAlpha = 0.04 + 0.09 * (0.5 + 0.5 * Math.sin(time * 0.7 + i * 2.3));
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      drawPath(ctx, pathPixelsList, time);

      // 放置模式：合法格高亮
      if (pl) {
        const pulse = 0.25 + 0.15 * Math.sin(time * 5);
        for (let row = 0; row < ROWS; row++) {
          for (let col = 0; col < COLS; col++) {
            if (!isBuildable(col, row)) continue;
            if (s.towers.some((t) => t.col === col && t.row === row)) continue;
            ctx.fillStyle = `rgba(34,224,255,${pulse * 0.25})`;
            ctx.fillRect(col * CELL + 2, row * CELL + 2, CELL - 4, CELL - 4);
          }
        }
        if (hc && isBuildable(hc.col, hc.row)) {
          const cx = (hc.col + 0.5) * CELL;
          const cy = (hc.row + 0.5) * CELL;
          const range = TOWERS[pl].levels[0].range * CELL;
          ctx.beginPath();
          ctx.arc(cx, cy, range, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(34,224,255,0.08)';
          ctx.fill();
          ctx.strokeStyle = '#22E0FF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = 'rgba(34,224,255,0.35)';
          ctx.fillRect(hc.col * CELL + 1, hc.row * CELL + 1, CELL - 2, CELL - 2);
        }
      }

      // 每个出口各一座基地（多出口共用整体生命比例）
      for (const ex of exits) drawBase(ctx, time, s.lives / s.maxLives, ex.centerX, ex.centerY);

      // 等离子灼烧区域
      for (const z of s.zones) {
        const life = Math.max(0, z.ttl / z.maxTtl);
        const zg = ctx.createRadialGradient(z.x, z.y, z.r * 0.1, z.x, z.y, z.r);
        zg.addColorStop(0, `rgba(255,107,61,${0.22 * life + 0.06})`);
        zg.addColorStop(0.8, `rgba(255,80,30,${0.12 * life})`);
        zg.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
        ctx.fillStyle = zg;
        ctx.fill();
        // 边缘发光（轻微脉动）
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r * (0.96 + 0.04 * Math.sin(time * 5 + z.id)), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,140,60,${0.55 * life})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#FF6B3D';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // 内部气泡
        ctx.fillStyle = `rgba(255,200,120,${0.35 * life})`;
        for (let i = 0; i < 3; i++) {
          const ba = time * 1.8 + i * 2.09 + z.id;
          const br = Math.max(1.5, z.r * 0.09 * (1 + 0.3 * Math.sin(time * 2.4 + i)));
          ctx.beginPath();
          ctx.arc(z.x + Math.cos(ba) * z.r * 0.45, z.y + Math.sin(ba) * z.r * 0.45, br, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 选中塔射程圈
      const selected = sel !== null ? s.towers.find((t) => t.id === sel) : undefined;
      if (selected) {
        const cx = (selected.col + 0.5) * CELL;
        const cy = (selected.row + 0.5) * CELL;
        const range = TOWERS[selected.type].levels[selected.level].range * CELL;
        ctx.beginPath();
        ctx.arc(cx, cy, range, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34,224,255,0.06)';
        ctx.fill();
        ctx.strokeStyle = '#22E0FF';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 塔
      for (const t of s.towers) {
        const cx = (t.col + 0.5) * CELL;
        const cy = (t.row + 0.5) * CELL;
        const aim = Math.atan2(t.aimY - cy, t.aimX - cx) + Math.PI / 2;
        const charge = t.charging ? 1 - t.chargeT / (TOWERS.railgun.charge ?? 1.2) : 0;
        const sprite = getTowerSprite(t.type, t.level);
        if (sprite) {
          // 精灵路径：底座不旋转，炮身随瞄准旋转，开火后 0.24s 内播放 6 帧动画
          const sz = CELL * 1.05;
          ctx.drawImage(sprite.base, cx - sz / 2, cy - sz / 2, sz, sz);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(aim);
          const ft = time - t.lastFireAt;
          const frame =
            ft >= 0 && ft < 0.24
              ? Math.min(sprite.fire.length - 1, Math.floor(ft / 0.04))
              : -1;
          const body = frame >= 0 ? sprite.fire[frame] : sprite.idle;
          ctx.drawImage(body, -sz / 2, -sz / 2, sz, sz);
          ctx.restore();
          // 等级小圆点（不旋转，与程序化绘制同位置）
          const pr = (CELL * 0.86) / 2;
          for (let i = 0; i <= t.level; i++) {
            ctx.beginPath();
            ctx.arc(cx - pr * 0.4 + i * pr * 0.4, cy + pr * 0.62, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = t.level >= 2 ? '#FFC94D' : TOWERS[t.type].color;
            ctx.fill();
          }
          if (t.charging) {
            // 蓄能光环（画在精灵之上）
            ctx.beginPath();
            ctx.arc(cx, cy, 10 + charge * 16, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(139,92,246,${0.3 + charge * 0.6})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        } else {
          // 精灵未就绪：程序化 fallback
          ctx.save();
          ctx.translate(cx, cy);
          drawTower(ctx, t.type, t.level, CELL * 0.86, aim, t.charging ? charge : 0, time);
          if (t.charging) {
            // 蓄能光环
            ctx.beginPath();
            ctx.arc(0, 0, 10 + charge * 16, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(139,92,246,${0.3 + charge * 0.6})`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // 敌人
      for (const e of s.enemies) {
        const p = posAt(e.path, e.dist);
        const def = ENEMIES[e.type];
        const invisible = e.type === 'lurker' && e.stealthT % 4 >= 3;
        const slowed = s.clock < e.slowUntil;
        const burning = s.zones.some((z) => Math.hypot(p.x - z.x, p.y - z.y) <= z.r);
        ctx.save();
        ctx.translate(p.x, p.y);
        const next = posAt(e.path, Math.min(e.dist + 10, 99999));
        ctx.rotate(Math.atan2(next.y - p.y, next.x - p.x));
        drawEnemy(ctx, e.type, def.size, time, {
          alpha: invisible ? 0.25 : 1,
          enraged: e.enraged,
          slowed,
          burning,
        });
        ctx.restore();
        // 受击白色闪光（0.08s）
        const sinceHit = s.clock - e.lastHitAt;
        if (sinceHit >= 0 && sinceHit < 0.08) {
          const fa = (1 - sinceHit / 0.08) * 0.55;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, def.size * 1.3);
          hg.addColorStop(0, `rgba(255,255,255,${fa})`);
          hg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = hg;
          ctx.beginPath();
          ctx.arc(p.x, p.y, def.size * 1.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // HP 条
        const bw = e.isBoss ? 64 : 40;
        const ratio = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(p.x - bw / 2, p.y - def.size - 12, bw, 4);
        ctx.fillStyle = e.isBoss ? '#FF3D81' : ratio > 0.5 ? '#3DF08C' : ratio > 0.25 ? '#FFC94D' : '#FF5A5A';
        ctx.fillRect(p.x - bw / 2, p.y - def.size - 12, bw * ratio, 4);
        // 破甲标记
        if (s.clock < e.vulnUntil) {
          ctx.fillStyle = '#8B5CF6';
          ctx.font = '10px Orbitron, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('破甲', p.x, p.y - def.size - 16);
        }
      }

      // 导弹 / 等离子弹
      for (const pr of s.projectiles) {
        if (pr.kind === 'plasma') {
          const pg = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, 7);
          pg.addColorStop(0, '#FFF3D6');
          pg.addColorStop(0.5, '#FF6B3D');
          pg.addColorStop(1, 'rgba(255,107,61,0)');
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, 7, 0, Math.PI * 2);
          ctx.fillStyle = pg;
          ctx.shadowColor = '#FF6B3D';
          ctx.shadowBlur = 16;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.beginPath();
          ctx.arc(pr.x, pr.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#FF9F43';
          ctx.shadowColor = '#FF9F43';
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // 光束
      for (const b of s.beams) {
        const a = b.ttl / b.maxTtl;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = b.width * (0.5 + a * 0.5);
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        // 命中点径向光斑（beam 端点即命中点）
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.9;
        const gr = 8 + b.width * 1.5;
        const bg = ctx.createRadialGradient(b.x2, b.y2, 0, b.x2, b.y2, gr);
        bg.addColorStop(0, '#FFFFFF');
        bg.addColorStop(0.35, b.color);
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(b.x2, b.y2, gr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 粒子
      for (const pt of s.particles) {
        const a = pt.ttl / pt.maxTtl;
        ctx.globalAlpha = a;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      // 冲击波环：扩张发光圆环（粗→细，渐隐）
      for (const r of s.rings) {
        const life = Math.max(0, r.ttl / r.maxTtl);
        const k = 1 - life;
        const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k)); // ease-out 扩张
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
        ctx.globalAlpha = life * 0.85;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = Math.max(1, 6 * life);
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      for (const f of s.floaters) {
        const a = f.ttl / f.maxTtl;
        ctx.globalAlpha = a;
        ctx.fillStyle = f.color;
        ctx.font = '700 14px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 6;
        ctx.fillText(f.text, f.x, f.y);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const toCell = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    return { col: Math.floor(x / CELL), row: Math.floor(y / CELL) };
  };

  // placing 模式下正在拖动的 pointer id（按下捕获 → 拖动预览 → 松手确认）
  const dragPointer = useRef<number | null>(null);

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto block max-h-full max-w-full touch-none select-none"
      style={{ aspectRatio: `${W} / ${H}` }}
      onPointerDown={(e) => {
        const { col, row } = toCell(e);
        if (placing) {
          // 放置模式：按下开始拖动预览，松手（onPointerUp）才确认建造
          dragPointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          onHoverCell?.(col, row);
          return;
        }
        onCellClick(col, row);
      }}
      onPointerMove={(e) => {
        if (!onHoverCell) return;
        // 触屏/触控笔仅在放置拖动时更新预览，避免点选塔时误触高亮
        if (!placing && e.pointerType !== 'mouse') return;
        const { col, row } = toCell(e);
        onHoverCell(col, row);
      }}
      onPointerUp={(e) => {
        if (dragPointer.current !== e.pointerId) return;
        dragPointer.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        // 松手确认；滑出地图外产生越界坐标，由上层取消本次放置
        const { col, row } = toCell(e);
        onCellClick(col, row);
      }}
      onPointerCancel={(e) => {
        if (dragPointer.current !== e.pointerId) return;
        dragPointer.current = null;
        onHoverCell?.(-1, -1);
      }}
      onPointerLeave={() => {
        if (dragPointer.current === null) onHoverCell?.(-1, -1);
      }}
    />
  );
}
