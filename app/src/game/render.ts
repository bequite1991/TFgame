// Canvas 绘制原语 —— 塔/敌人/地图造型，GameCanvas 与图鉴图标共用
import { CELL, COLS, ROWS, TOWERS, ENEMIES } from './config';
import type { EnemyType, TowerType } from './types';

function hexPath(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** hex 颜色按 t 向目标色混合，返回 rgb() 串 */
function mixColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => {
    const va = (pa >> sh) & 255;
    return Math.round(va + (((pb >> sh) & 255) - va) * t);
  };
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
/** 向亮白偏移 */
const tint = (hex: string, f: number) => mixColor(hex, '#EAF6FF', f);
/** 向深空黑偏移 */
const tone = (hex: string, f: number) => mixColor(hex, '#05070F', f);
const INK = '#04060D';

/**
 * 在 (0,0) 绘制塔（已 translate），size 为占地边长。
 * 约定：炮口朝向 -Y 时为 aimAngle=0，调用方传「目标方向角 + PI/2」。
 * opts.ticks=false 关闭底座外围旋转刻度环（底部栏图标等需要干净轮廓的场景）。
 */
export function drawTower(
  ctx: CanvasRenderingContext2D, type: TowerType, level: number, size: number,
  aimAngle: number, charge: number, time: number,
  opts: { ticks?: boolean } = {},
) {
  const def = TOWERS[type];
  const r = size / 2;
  const breathe = 0.6 + 0.4 * Math.sin(time * 2.4);
  const lite = tint(def.color, 0.45);

  // 落地阴影
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.5, r * 0.76, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 底座外围：缓慢旋转的能量刻度环
  if (opts.ticks !== false) {
    ctx.save();
    ctx.rotate(time * 0.4);
    ctx.strokeStyle = def.color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI * 2 * i) / 24;
      const inner = r * 0.9 - (i % 6 === 0 ? 4 : 2);
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Lv3 外光环（金色虚线流动）
  if (level >= 2) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.87, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,201,77,0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -time * 14;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 金属底座（径向渐变，中心亮、边缘暗）
  const baseG = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r * 0.85);
  baseG.addColorStop(0, '#2E3D63');
  baseG.addColorStop(0.65, '#16203A');
  baseG.addColorStop(1, '#0A0F20');
  hexPath(ctx, r * 0.82);
  ctx.fillStyle = baseG;
  ctx.fill();
  ctx.strokeStyle = def.color;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // 顶部高光（斜射光质感）
  ctx.save();
  hexPath(ctx, r * 0.82);
  ctx.clip();
  const sheen = ctx.createLinearGradient(0, -r * 0.82, 0, r * 0.35);
  sheen.addColorStop(0, 'rgba(255,255,255,0.13)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
  hexPath(ctx, r * 0.66);
  ctx.strokeStyle = 'rgba(124,141,176,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Lv2+ 装甲板（三面护甲板）
  if (level >= 1) {
    ctx.fillStyle = '#22304F';
    ctx.strokeStyle = 'rgba(124,141,176,0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 * i) / 3 + Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(-r * 0.16, -r * 0.64);
      ctx.lineTo(r * 0.16, -r * 0.64);
      ctx.lineTo(r * 0.2, -r * 0.5);
      ctx.lineTo(-r * 0.2, -r * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  if (type === 'frost') {
    // 反向旋转双冰环
    for (const [dir, rr, alpha] of [[1, 0.55, 0.6], [-1, 0.42, 0.45]] as const) {
      ctx.save();
      ctx.rotate(dir * time * 0.9);
      ctx.strokeStyle = def.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([r * 0.22, r * 0.14]);
      ctx.beginPath();
      ctx.arc(0, 0, r * rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    // 雪花冰晶（缓旋）
    ctx.save();
    ctx.rotate(time * 0.3);
    ctx.strokeStyle = '#BDF3FF';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * i) / 3;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      ctx.moveTo(0, 0);
      ctx.lineTo(ca * r * 0.5, sa * r * 0.5);
      ctx.moveTo(ca * r * 0.3, sa * r * 0.3);
      ctx.lineTo(ca * r * 0.3 + Math.cos(a + 0.6) * r * 0.13, sa * r * 0.3 + Math.sin(a + 0.6) * r * 0.13);
      ctx.moveTo(ca * r * 0.3, sa * r * 0.3);
      ctx.lineTo(ca * r * 0.3 + Math.cos(a - 0.6) * r * 0.13, sa * r * 0.3 + Math.sin(a - 0.6) * r * 0.13);
    }
    ctx.stroke();
    ctx.restore();
    // 悬浮冰球（上下浮动 + 径向渐变）
    const bob = Math.sin(time * 2.5) * r * 0.06;
    const ig = ctx.createRadialGradient(-r * 0.08, -r * 0.23 + bob, r * 0.02, 0, -r * 0.15 + bob, r * 0.3);
    ig.addColorStop(0, '#FFFFFF');
    ig.addColorStop(0.45, '#BDF3FF');
    ig.addColorStop(1, '#4FB8D8');
    ctx.beginPath();
    ctx.arc(0, -r * 0.15 + bob, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = ig;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (type === 'tesla') {
    // 中央线圈柱 + 三段铜环
    ctx.fillStyle = '#22304F';
    ctx.fillRect(-r * 0.08, -r * 0.48, r * 0.16, r * 0.6);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.4 + i * r * 0.16, r * 0.16, r * 0.05, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,233,61,0.75)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    // 顶部球体
    const tg = ctx.createRadialGradient(-r * 0.05, -r * 0.58, r * 0.02, 0, -r * 0.52, r * 0.2);
    tg.addColorStop(0, '#FFFFFF');
    tg.addColorStop(0.5, '#FFE93D');
    tg.addColorStop(1, '#B8860B');
    ctx.beginPath();
    ctx.arc(0, -r * 0.52, r * 0.17 + Math.sin(time * 3) * r * 0.012, 0, Math.PI * 2);
    ctx.fillStyle = tg;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 10 + 8 * breathe;
    ctx.fill();
    ctx.shadowBlur = 0;
    // idle 小型电弧（等级越高越密）
    const arcCount = 1 + level;
    for (let i = 0; i < arcCount; i++) {
      const ph = time * (2.2 + level * 0.9) + i * 2.39;
      if (Math.sin(ph) <= 0.55) continue; // 伪随机间歇放电
      const dirA = i * 2.1 + Math.sin(ph * 0.7) * 0.9;
      const ex = Math.cos(dirA) * r * 0.56;
      const ey = -r * 0.52 + Math.sin(dirA) * r * 0.42;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.52);
      for (let k = 1; k <= 2; k++) {
        const f = k / 3;
        ctx.lineTo(
          ex * f + Math.sin(ph * 9 + k * 4.3) * r * 0.08,
          -r * 0.52 + (ey + r * 0.52) * f + Math.cos(ph * 7 + k * 3.1) * r * 0.08,
        );
      }
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = '#FFF7AE';
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  } else {
    // 有炮口指向的塔：随瞄准旋转（炮口几何朝 -Y，aimAngle 含 +90° 约定偏移）
    ctx.save();
    ctx.rotate(aimAngle);
    if (type === 'laser') {
      // 悬臂
      const armG = ctx.createLinearGradient(-r * 0.08, 0, r * 0.08, 0);
      armG.addColorStop(0, '#16203A');
      armG.addColorStop(0.5, '#2E3D63');
      armG.addColorStop(1, '#10182E');
      ctx.fillStyle = armG;
      ctx.fillRect(-r * 0.07, -r * 0.5, r * 0.14, r * 0.6);
      // 悬浮棱镜
      const py = -r * 0.58 + Math.sin(time * 2.2) * r * 0.04;
      ctx.save();
      ctx.translate(0, py);
      // 旋转聚焦环
      ctx.save();
      ctx.rotate(time * 1.8);
      ctx.strokeStyle = def.color;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.27, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      // 菱形晶体（Lv3 三棱镜环绕）
      const prisms = level >= 2 ? 3 : 1;
      for (let i = 0; i < prisms; i++) {
        const a = prisms === 1 ? 0 : (Math.PI * 2 * i) / 3 + time * 0.9;
        const ox = prisms === 1 ? 0 : Math.cos(a) * r * 0.13;
        const oy = prisms === 1 ? 0 : Math.sin(a) * r * 0.13;
        const s = prisms === 1 ? r * 0.19 : r * 0.12;
        const pg = ctx.createLinearGradient(ox, oy - s, ox, oy + s);
        pg.addColorStop(0, '#FFFFFF');
        pg.addColorStop(0.45, lite);
        pg.addColorStop(1, tone(def.color, 0.45));
        ctx.beginPath();
        ctx.moveTo(ox, oy - s);
        ctx.lineTo(ox + s * 0.7, oy);
        ctx.lineTo(ox, oy + s);
        ctx.lineTo(ox - s * 0.7, oy);
        ctx.closePath();
        ctx.fillStyle = pg;
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        // 切面高光
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(ox, oy - s);
        ctx.lineTo(ox, oy + s);
        ctx.moveTo(ox - s * 0.7, oy);
        ctx.lineTo(ox + s * 0.7, oy);
        ctx.stroke();
      }
      ctx.restore();
    } else if (type === 'missile') {
      // 开启式发射舱：Lv1/2 双舱，Lv3 四舱
      const pods: [number, number][] = level >= 2
        ? [[-r * 0.26, -r * 0.28], [r * 0.26, -r * 0.28], [-r * 0.26, r * 0.14], [r * 0.26, r * 0.14]]
        : [[-r * 0.26, -r * 0.08], [r * 0.26, -r * 0.08]];
      for (const [ox, oy] of pods) {
        ctx.fillStyle = '#22304F';
        ctx.fillRect(ox - r * 0.13, oy - r * 0.24, r * 0.26, r * 0.42);
        ctx.strokeStyle = 'rgba(124,141,176,0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox - r * 0.13, oy - r * 0.24, r * 0.26, r * 0.42);
        // 舱内导弹头
        ctx.fillStyle = '#C7D2E8';
        ctx.beginPath();
        ctx.moveTo(ox - r * 0.08, oy - r * 0.12);
        ctx.lineTo(ox, oy - r * 0.22);
        ctx.lineTo(ox + r * 0.08, oy - r * 0.12);
        ctx.closePath();
        ctx.fill();
        // 翻开的舱盖
        ctx.save();
        ctx.translate(ox - r * 0.13, oy - r * 0.24);
        ctx.rotate(-0.7 - 0.08 * Math.sin(time * 1.5));
        ctx.fillStyle = '#2E3D63';
        ctx.fillRect(0, -r * 0.02, r * 0.26, r * 0.04);
        ctx.restore();
        // 导弹头指示灯闪烁
        const blink = Math.sin(time * 6 + ox * 7 + oy * 3) > 0 ? 1 : 0.25;
        ctx.globalAlpha = blink;
        ctx.fillStyle = '#FF5A5A';
        ctx.shadowColor = '#FF5A5A';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(ox, oy + r * 0.1, r * 0.035, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    } else if (type === 'plasma') {
      // 熔核罐体（岩浆脉动）
      const pulse = 0.85 + 0.15 * Math.sin(time * 3.2);
      const pg = ctx.createRadialGradient(0, 0, r * 0.04, 0, 0, r * 0.34);
      pg.addColorStop(0, '#FFF3D6');
      pg.addColorStop(0.35, '#FF6B3D');
      pg.addColorStop(1, '#7A1F0F');
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = pg;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
      ctx.strokeStyle = '#2E3D63';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 内部岩浆泡
      ctx.fillStyle = 'rgba(255,243,214,0.7)';
      for (let i = 0; i < 3; i++) {
        const a = time * 1.4 + i * 2.1;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.13, Math.sin(a * 1.3) * r * 0.13, r * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
      // 短粗炮口
      ctx.fillStyle = '#22304F';
      ctx.fillRect(-r * 0.16, -r * 0.74, r * 0.32, r * 0.36);
      ctx.strokeStyle = 'rgba(124,141,176,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-r * 0.16, -r * 0.74, r * 0.32, r * 0.36);
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 4);
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(-r * 0.1, -r * 0.76, r * 0.2, r * 0.06);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    } else {
      // 电磁炮：双轨 + 分段线圈随 charge 点亮
      ctx.fillStyle = '#22304F';
      ctx.fillRect(-r * 0.24, -r * 0.78, r * 0.14, r * 1.05);
      ctx.fillRect(r * 0.1, -r * 0.78, r * 0.14, r * 1.05);
      ctx.fillStyle = 'rgba(139,92,246,0.25)';
      ctx.fillRect(-r * 0.17, -r * 0.78, r * 0.07, r * 1.05);
      ctx.fillRect(r * 0.1, -r * 0.78, r * 0.07, r * 1.05);
      const coils = 5;
      for (let i = 0; i < coils; i++) {
        const cy = r * 0.12 - i * r * 0.17;
        const lit = charge >= (i + 1) / coils - 0.001;
        ctx.beginPath();
        ctx.ellipse(0, cy, r * 0.27, r * 0.06, 0, 0, Math.PI * 2);
        ctx.strokeStyle = lit ? '#C4B0FF' : 'rgba(139,92,246,0.5)';
        ctx.lineWidth = 2;
        if (lit) {
          ctx.shadowColor = def.color;
          ctx.shadowBlur = 12;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // 蓄能电弧（折线模拟）
      if (charge > 0.25) {
        const arcs = charge > 0.7 ? 2 : 1;
        for (let i = 0; i < arcs; i++) {
          const seed = time * 31 + i * 17;
          const y0 = -r * (0.15 + 0.5 * ((Math.sin(seed) + 1) / 2));
          ctx.beginPath();
          ctx.moveTo(-r * 0.17, y0);
          for (let k = 1; k <= 3; k++) {
            ctx.lineTo(-r * 0.17 + (r * 0.34 * k) / 3, y0 + Math.sin(seed + k * 5.7) * r * 0.08);
          }
          ctx.strokeStyle = '#D8CCFF';
          ctx.globalAlpha = 0.5 + charge * 0.5;
          ctx.lineWidth = 1;
          ctx.shadowColor = def.color;
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      }
      // 炮口
      const glow = charge > 0 ? 0.5 + 0.5 * Math.sin(time * 20) : 0.6;
      ctx.fillStyle = def.color;
      ctx.globalAlpha = glow;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = charge > 0 ? 18 : 6;
      ctx.fillRect(-r * 0.22, -r * 0.8, r * 0.35, r * 0.1);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // 核心呼吸辉光（tesla/plasma 的中央部件即核心，跳过）
  if (type !== 'tesla' && type !== 'plasma') {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = def.color;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 6 + 8 * breathe;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // 等级点
  for (let i = 0; i <= level; i++) {
    ctx.beginPath();
    ctx.arc(-r * 0.4 + i * r * 0.4, r * 0.62, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = level >= 2 ? '#FFC94D' : def.color;
    ctx.fill();
  }
}

/** 在 (0,0) 绘制敌人（已 translate，朝 +X 为前进方向），alpha 用于隐身 */
export function drawEnemy(ctx: CanvasRenderingContext2D, type: EnemyType, size: number, time: number, opts: { alpha?: number; enraged?: boolean; slowed?: boolean; burning?: boolean } = {}) {
  const def = ENEMIES[type];
  const r = size;
  const alpha = opts.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  const body = opts.enraged ? '#FF3D81' : def.color;
  const dark = tone(body, 0.55);
  const deep = tone(body, 0.78);
  const lite = tint(body, 0.5);
  const glow = opts.enraged ? '#FF9F43' : '#B8FF3D';

  if (type === 'crawler') {
    // 六足甲虫：步足 → 腹部 → 头颚 → 感光脊
    const ph = time * 9;
    ctx.strokeStyle = deep;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.4, r * 0.13);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const hx = r * (0.42 - i * 0.4);
        const sw = Math.sin(ph + i * 1.9 + (side > 0 ? Math.PI : 0)) * r * 0.18;
        ctx.beginPath();
        ctx.moveTo(hx, side * r * 0.3);
        ctx.lineTo(hx + sw * 0.35, side * r * 0.78);
        ctx.lineTo(hx - r * 0.12 + sw, side * r * 1.06);
        ctx.stroke();
      }
    }
    // 腹部
    const ag = ctx.createRadialGradient(-r * 0.45, -r * 0.3, r * 0.08, -r * 0.28, 0, r * 0.9);
    ag.addColorStop(0, lite);
    ag.addColorStop(0.45, body);
    ag.addColorStop(1, deep);
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, 0, r * 0.72, r * 0.56, 0, 0, Math.PI * 2);
    ctx.fillStyle = ag;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    // 腹节
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 3; i++) {
      const sx = -r * (0.18 + i * 0.27);
      const half = r * (0.48 - i * 0.05);
      ctx.beginPath();
      ctx.moveTo(sx, -half);
      ctx.quadraticCurveTo(sx - r * 0.14, 0, sx, half);
      ctx.stroke();
    }
    // 头
    const hg = ctx.createRadialGradient(r * 0.45, -r * 0.18, r * 0.04, r * 0.55, 0, r * 0.44);
    hg.addColorStop(0, lite);
    hg.addColorStop(1, dark);
    ctx.beginPath();
    ctx.ellipse(r * 0.55, 0, r * 0.4, r * 0.33, 0, 0, Math.PI * 2);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    // 颚（开合作啃咬）
    const mand = (0.5 + 0.5 * Math.sin(ph * 1.4)) * r * 0.14;
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(1.4, r * 0.09);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(r * 0.82, side * r * 0.14);
      ctx.quadraticCurveTo(r * 1.12, side * (r * 0.3 + mand), r * 1.18, side * (r * 0.08 + mand * 0.5));
      ctx.stroke();
    }
    // 眼
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(r * 0.62, -r * 0.15, r * 0.09, 0, Math.PI * 2);
    ctx.arc(r * 0.62, r * 0.15, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 背部感光脊
    ctx.globalAlpha = alpha * 0.75;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, 0, r * 0.42, r * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
  } else if (type === 'speeder') {
    // 掠袭奔兽：低伏流线躯干 + 四肢奔腾 + 拖尾（俯视猎豹）
    const ph = time * 13;
    const bob = Math.abs(Math.sin(ph)) * -r * 0.05;
    // 速度残影（身后两道流线）
    ctx.strokeStyle = body;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const yy = (-0.28 + i * 0.56) * r;
      ctx.globalAlpha = alpha * (0.18 - i * 0.06);
      ctx.lineWidth = r * 0.09;
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, yy);
      ctx.lineTo(-r * (1.5 + i * 0.35), yy);
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;
    // 四肢（对角交替奔腾）
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(1.3, r * 0.12);
    const legs: [number, number, number][] = [
      [0.42, -1, 0], [0.42, 1, 0.6], [-0.38, -1, Math.PI], [-0.38, 1, Math.PI + 0.6],
    ];
    for (const [hx, side, off] of legs) {
      const sw = Math.sin(ph + off) * r * 0.4;
      const lift = Math.max(0, Math.cos(ph + off)) * r * 0.22;
      const hipX = hx * r;
      const hipY = side * r * 0.14 + bob;
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(hipX + sw * 0.3, side * r * 0.42 + bob);
      ctx.lineTo(hipX + sw, side * r * 0.64 - lift);
      ctx.stroke();
    }
    // 尾巴（拖甩 + 尾尖发光）
    const tailTipY = bob + Math.sin(ph * 0.9 - 0.8) * r * 0.38;
    ctx.strokeStyle = dark;
    ctx.lineWidth = r * 0.1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.85, bob);
    ctx.quadraticCurveTo(-r * 1.25, bob + Math.sin(ph * 0.9) * r * 0.28, -r * 1.5, tailTipY);
    ctx.stroke();
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(-r * 1.5, tailTipY, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 躯干（低伏流线）
    const bg = ctx.createLinearGradient(0, bob - r * 0.3, 0, bob + r * 0.3);
    bg.addColorStop(0, lite);
    bg.addColorStop(0.5, body);
    bg.addColorStop(1, deep);
    ctx.beginPath();
    ctx.ellipse(-r * 0.05, bob, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 背刺鳍
    ctx.fillStyle = dark;
    for (let i = 0; i < 3; i++) {
      const bx = r * (0.32 - i * 0.36);
      ctx.beginPath();
      ctx.moveTo(bx - r * 0.1, bob - r * 0.24);
      ctx.lineTo(bx + r * 0.05, bob - r * (0.52 - i * 0.09));
      ctx.lineTo(bx + r * 0.18, bob - r * 0.2);
      ctx.closePath();
      ctx.fill();
    }
    // 头（低伏前伸 + 尖吻）
    const hg = ctx.createRadialGradient(r * 0.78, bob - r * 0.08, r * 0.03, r * 0.85, bob, r * 0.32);
    hg.addColorStop(0, lite);
    hg.addColorStop(1, dark);
    ctx.beginPath();
    ctx.ellipse(r * 0.85, bob, r * 0.3, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(r * 1.02, bob - r * 0.1);
    ctx.lineTo(r * 1.32, bob);
    ctx.lineTo(r * 1.02, bob + r * 0.1);
    ctx.closePath();
    ctx.fill();
    // 单眼
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(r * 0.9, bob - r * 0.06, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (type === 'tanker') {
    // 重甲甲壳兽：层叠装甲 + 铆钉 + 前撞角 + 排气辉光
    const ag = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.15, 0, 0, r);
    ag.addColorStop(0, tint(body, 0.35));
    ag.addColorStop(0.55, dark);
    ag.addColorStop(1, deep);
    hexPath(ctx, r * 0.95);
    ctx.fillStyle = ag;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    hexPath(ctx, r * 0.9);
    ctx.strokeStyle = body;
    ctx.globalAlpha = alpha * 0.75;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    // 内层甲板
    hexPath(ctx, r * 0.58);
    ctx.strokeStyle = tone(body, 0.2);
    ctx.lineWidth = 2;
    ctx.stroke();
    // 铆钉
    ctx.fillStyle = tint(body, 0.4);
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2 + Math.PI / 6;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.73, Math.sin(a) * r * 0.73, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    // 前撞角
    const hornG = ctx.createLinearGradient(r * 0.5, 0, r * 1.28, 0);
    hornG.addColorStop(0, dark);
    hornG.addColorStop(1, lite);
    ctx.beginPath();
    ctx.moveTo(r * 0.55, -r * 0.27);
    ctx.lineTo(r * 1.26, 0);
    ctx.lineTo(r * 0.55, r * 0.27);
    ctx.closePath();
    ctx.fillStyle = hornG;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 排气口（前侧两处）
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(r * 0.3, -r * 0.36, r * 0.12, r * 0.05, 0.5, 0, Math.PI * 2);
    ctx.ellipse(r * 0.3, r * 0.36, r * 0.12, r * 0.05, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (type === 'splitter') {
    // 分裂体：颤动原生质囊 + 双核游动（分裂预兆）
    const wig = time * 4;
    ctx.beginPath();
    const N = 16;
    for (let i = 0; i <= N; i++) {
      const a = (Math.PI * 2 * i) / N;
      const rr = r * (0.86 + 0.11 * Math.sin(wig + i * 2.3) + 0.04 * Math.sin(wig * 1.7 + i * 4.1));
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const mg = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.08, 0, 0, r);
    mg.addColorStop(0, tint(body, 0.55));
    mg.addColorStop(0.55, body);
    mg.addColorStop(1, dark);
    ctx.fillStyle = mg;
    ctx.fill();
    // 囊膜边缘
    ctx.strokeStyle = tint(body, 0.7);
    ctx.globalAlpha = alpha * 0.8;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    // 双核
    for (let k = 0; k < 2; k++) {
      const a = time * 1.6 + k * Math.PI;
      const nx = Math.cos(a) * r * 0.28;
      const ny = Math.sin(a * 1.3) * r * 0.26;
      const ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 0.22);
      ng.addColorStop(0, '#FFFFFF');
      ng.addColorStop(0.4, tint(body, 0.4));
      ng.addColorStop(1, dark);
      ctx.beginPath();
      ctx.arc(nx, ny, r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = ng;
      ctx.shadowColor = body;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  } else if (type === 'lurker') {
    // 隐匿者：蝠鲼式滑翔翼 + 翼缘生物光 + 尾刺
    const flap = Math.sin(time * 5) * 0.1;
    const wg = ctx.createLinearGradient(0, -r, 0, r);
    wg.addColorStop(0, tint(body, 0.35));
    wg.addColorStop(0.5, body);
    wg.addColorStop(1, dark);
    ctx.beginPath();
    ctx.moveTo(r * 1.05, 0);
    ctx.quadraticCurveTo(r * 0.4, -r * 0.3, -r * 0.1, -r * (0.8 + flap));
    ctx.quadraticCurveTo(-r * 0.45, -r * 0.28, -r * 0.68, 0);
    ctx.quadraticCurveTo(-r * 0.45, r * 0.28, -r * 0.1, r * (0.8 + flap));
    ctx.quadraticCurveTo(r * 0.4, r * 0.3, r * 1.05, 0);
    ctx.closePath();
    ctx.fillStyle = wg;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 尾刺
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.64, 0);
    ctx.quadraticCurveTo(-r * 1.05, Math.sin(time * 3) * r * 0.16, -r * 1.24, 0);
    ctx.stroke();
    // 翼缘生物光点（明灭）
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 5;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const f = 0.32 + i * 0.24;
        const bx = r * (1.0 - f * 1.1);
        const by = side * r * f * (0.72 + flap);
        ctx.globalAlpha = alpha * (0.35 + 0.65 * Math.abs(Math.sin(time * 3 + i * 2 + side)));
        ctx.beginPath();
        ctx.arc(bx, by, r * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    // 独眼
    ctx.fillStyle = '#F2FFDB';
    ctx.shadowColor = glow;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.ellipse(r * 0.42, 0, r * 0.14, r * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // boss 湮灭巨兽：骨刺冠冕 + 重甲壳 + 旋转能量环 + 脉动核心
    const pulse = 0.7 + 0.3 * Math.sin(time * 4);
    // 骨刺冠冕（8 根，随呼吸微摆）
    ctx.fillStyle = deep;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + Math.PI / 8;
      const len = r * (1.2 + 0.1 * Math.sin(time * 3 + i * 1.7));
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.15) * r * 0.78, Math.sin(a - 0.15) * r * 0.78);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.lineTo(Math.cos(a + 0.15) * r * 0.78, Math.sin(a + 0.15) * r * 0.78);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // 外壳
    const sg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r);
    sg.addColorStop(0, tint(body, 0.3));
    sg.addColorStop(0.55, dark);
    sg.addColorStop(1, deep);
    hexPath(ctx, r * 0.92);
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.strokeStyle = body;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    // 甲缝
    hexPath(ctx, r * 0.62);
    ctx.strokeStyle = tone(body, 0.2);
    ctx.lineWidth = 2;
    ctx.stroke();
    // 环绕核心的旋转虚线环
    ctx.save();
    ctx.rotate(time * 1.1);
    ctx.strokeStyle = glow;
    ctx.globalAlpha = alpha * 0.65;
    ctx.lineWidth = 2;
    ctx.setLineDash([r * 0.28, r * 0.2]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    ctx.globalAlpha = alpha;
    // 核心
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.3);
    cg.addColorStop(0, '#FFFFFF');
    cg.addColorStop(0.5, glow);
    cg.addColorStop(1, tone(glow, 0.6));
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = cg;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    // 前方感知眼（三只）
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(r * 0.6, 0, r * 0.07, 0, Math.PI * 2);
    ctx.arc(r * 0.45, -r * 0.3, r * 0.055, 0, Math.PI * 2);
    ctx.arc(r * 0.45, r * 0.3, r * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  if (opts.burning) {
    ctx.globalAlpha = alpha * 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
    ctx.strokeStyle = '#FF6B3D';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#FF6B3D';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (opts.slowed) {
    ctx.globalAlpha = alpha * 0.35;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
    ctx.strokeStyle = '#3DF08C';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------- 地图 ----------------

/** 静态背景（底岩 + 网格 + 陨石坑），每帧绘制但开销小 */
export function drawMapBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0B1226');
  g.addColorStop(0.5, '#0A0F22');
  g.addColorStop(1, '#0C1128');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 伪随机陨石坑 / 金属板（按格种子，帧间稳定）
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const seed = (row * 31 + col * 17) % 97;
      if (seed % 13 === 0) {
        ctx.beginPath();
        ctx.arc(col * CELL + 20 + (seed % 3) * 8, row * CELL + 24 + (seed % 5) * 5, 6 + (seed % 4) * 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fill();
      } else if (seed % 17 === 0) {
        ctx.fillStyle = 'rgba(34,224,255,0.04)';
        ctx.fillRect(col * CELL + 8, row * CELL + 8, CELL - 16, CELL - 16);
      }
    }
  }

  // 战术网格
  ctx.strokeStyle = 'rgba(34,224,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= COLS; c++) {
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, h);
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(w, r * CELL);
  }
  ctx.stroke();
}

/** 路径：暗色路面 + 发光青色虚线流动。多路径时按线段去重，共享段不重复叠加 */
export function drawPath(ctx: CanvasRenderingContext2D, paths: ReadonlyArray<ReadonlyArray<readonly [number, number]>>, time: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 单路径保持整条连续折线（虚线相位与旧版完全一致）；多路径展开为线段并按方向无关去重，共享段不重复叠加
  let segs: [number, number, number, number][] | null = null;
  if (paths.length > 1) {
    const seen = new Set<string>();
    segs = [];
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        const [x1, y1] = path[i];
        const [x2, y2] = path[i + 1];
        const key = x1 < x2 || (x1 === x2 && y1 < y2)
          ? `${x1},${y1}|${x2},${y2}`
          : `${x2},${y2}|${x1},${y1}`;
        if (seen.has(key)) continue;
        seen.add(key);
        segs.push([x1, y1, x2, y2]);
      }
    }
  }
  const trace = () => {
    ctx.beginPath();
    if (segs === null) {
      paths[0].forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      return;
    }
    for (const [x1, y1, x2, y2] of segs) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
  };
  // 路面
  trace();
  ctx.strokeStyle = '#141B32';
  ctx.lineWidth = CELL * 0.72;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(34,224,255,0.18)';
  ctx.lineWidth = CELL * 0.72;
  ctx.setLineDash([2, CELL * 0.72 - 2]);
  ctx.stroke();
  ctx.setLineDash([]);
  // 流动能量线
  trace();
  ctx.strokeStyle = 'rgba(34,224,255,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 18]);
  ctx.lineDashOffset = -time * 60;
  ctx.shadowColor = '#22E0FF';
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
}

/** 基地：护盾中枢 + 呼吸弧光（baseX/baseY 为基地中心像素坐标） */
export function drawBase(ctx: CanvasRenderingContext2D, time: number, livesRatio: number, baseX: number, baseY: number) {
  const x = baseX;
  const y = baseY;
  const breathe = 1 + Math.sin(time * 2) * 0.05;
  // 护罩弧光
  ctx.beginPath();
  ctx.arc(x, y, 52 * breathe, Math.PI, 0);
  ctx.strokeStyle = livesRatio > 0.3 ? 'rgba(34,224,255,0.7)' : 'rgba(255,90,90,0.8)';
  ctx.lineWidth = 3;
  ctx.shadowColor = livesRatio > 0.3 ? '#22E0FF' : '#FF5A5A';
  ctx.shadowBlur = 16;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // 环形底座
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, Math.PI * 2);
  ctx.fillStyle = '#162040';
  ctx.fill();
  ctx.strokeStyle = '#22E0FF';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 穹顶
  ctx.beginPath();
  ctx.arc(x, y, 20, Math.PI, 0);
  ctx.fillStyle = 'rgba(34,224,255,0.35)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#BDF3FF';
  ctx.shadowColor = '#22E0FF';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
}
