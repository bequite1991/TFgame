// 琥珀工业（ember）皮肤模块 —— 明日方舟式工业指挥台
// 视觉语言：切角面板（env.rr 在 ember 下自动出切角）、左侧厚色块引导条、45° 斜纹警告带、
// Orbitron 等宽数字（env.RES_FONT()）、面板四角铆钉、深棕黑底 + 琥珀高亮。
// 签名交互：两段确认 —— 重要主按钮（出击/进入下一章/立即开战）第一次点按进入「待命」态，
// 1.6s 内第二次点按才真正执行（模块级状态记录待命时间戳），确认瞬间 env.buzz('heavy')。
import { CELL, COLS, ROWS } from '../game/config';
import type { GameEngine, TowerType } from '../game/types';
import type { SkinEnv, SkinModule, TouchPoint } from './types';

// ---------------- 模块级状态 ----------------

/** 两段确认：当前处于待命态的按钮 key 与待命时间戳 */
let armKey = '';
let armAt = 0;
const ARM_MS = 1600;

/** 结算印章：本屏已砸定标记（记录 screenAt，每屏只震一次） */
let stampDoneFor = 0;

/** 图鉴滚动接管：主文件 codexMaxScroll 为私有，模块自管滚动与最大滚动量 */
let codexMax = 0;
let codexDrag: { y: number; moved: number } | null = null;

/** 待命态判定：同一 key 且未超时 */
function armed(key: string): boolean {
  return armKey === key && Date.now() - armAt < ARM_MS;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// ---------------- 工业风绘制助手 ----------------

/** 45° 斜纹警告带：clip 后循环画斜线，phase 驱动缓移 */
function stripes(env: SkinEnv, x: number, y: number, w: number, h: number, color: string, gap: number, lw: number, phase: number) {
  const { ctx } = env;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  const step = gap * 2;
  const off = ((phase % step) + step) % step;
  for (let sx = x - h + off - step; sx < x + w + h; sx += step) {
    ctx.beginPath();
    ctx.moveTo(sx, y + h);
    ctx.lineTo(sx + h, y);
    ctx.stroke();
  }
  ctx.restore();
}

/** 面板四角铆钉点 */
function rivets(env: SkinEnv, x: number, y: number, w: number, h: number) {
  const { ctx } = env;
  ctx.save();
  ctx.fillStyle = env.ac(0.55);
  const d = 7;
  for (const [rx, ry] of [[x + d, y + d], [x + w - d, y + d], [x + d, y + h - d], [x + w - d, y + h - d]] as const) {
    ctx.beginPath();
    ctx.arc(rx, ry, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 页面底色：深棕黑渐变 + 顶部琥珀余晖 + 极淡斜纹肌理（皮肤专属，不用深空蓝底） */
function emberBg(env: SkinEnv, time: number) {
  const { ctx, VW, VH } = env;
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#1B130A');
  g.addColorStop(0.5, '#100B06');
  g.addColorStop(1, '#090603');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, VH);
  const glow = ctx.createRadialGradient(VW * 0.85, -VH * 0.05, 0, VW * 0.85, -VH * 0.05, VW * 0.95);
  glow.addColorStop(0, env.ac(0.10));
  glow.addColorStop(1, env.ac(0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VW, VH);
  env.drawStars(time, 0.3);
  stripes(env, 0, 0, VW, VH, 'rgba(255,176,32,0.016)', 26, 8, time * 3);
}

/** 工业页头：整条面板底 + 底部琥珀线 + 左端厚色块；标题 + 英文小标；返回按钮让位胶囊（设置入口只保留欢迎页） */
function emberHeader(env: SkinEnv, title: string, en: string, back?: () => void) {
  const { ctx, VW, TOP_SAFE, CAP_MID, CAP_LEFT, GAME_CENTER_PAD, MARGIN } = env;
  const btnS = 36;
  const top = CAP_MID - btnS / 2;
  const g = ctx.createLinearGradient(0, top - 6, 0, TOP_SAFE);
  g.addColorStop(0, '#261B0E');
  g.addColorStop(1, '#130E08');
  ctx.fillStyle = g;
  ctx.fillRect(0, top - 6, VW, TOP_SAFE - top + 6);
  ctx.fillStyle = env.ac(0.5);
  ctx.fillRect(0, TOP_SAFE - 2, VW, 2);
  ctx.fillStyle = env.C.cyan;
  ctx.fillRect(0, top - 6, 6, TOP_SAFE - top + 6);

  let tx = MARGIN;
  const rightLimit = CAP_LEFT - 8 - GAME_CENTER_PAD;
  if (back) {
    env.btn({ x: MARGIN, y: top, w: btnS, h: btnS, label: '‹', cb: back });
    tx = MARGIN + btnS + 12;
  }

  // 标题随可用宽度自动缩字号
  const maxW = rightLimit - tx - 8;
  let tSize = 16;
  ctx.save();
  while (tSize > 11) {
    ctx.font = `bold ${tSize}px sans-serif`;
    if (ctx.measureText(title).width <= maxW) break;
    tSize--;
  }
  ctx.restore();
  env.fillText(en, tx, CAP_MID - 11, { size: 9, color: env.ac(0.75), weight: '600', font: env.RES_FONT() });
  env.fillText(title, tx, CAP_MID + 8, { size: tSize });
}

/**
 * 两段确认指令按钮：第一次点按进入待命态（变红高亮 + 文案切换 + 底部倒计时条），
 * ARM_MS 内第二次点按才执行真正动作；确认瞬间 heavy 震动，进入待命 medium 震动。
 */
function armBtn(env: SkinEnv, key: string, b: {
  x: number; y: number; w: number; h: number;
  label: string; armedLabel: string; color: string; cb: () => void; disabled?: boolean;
}) {
  const on = armed(key);
  env.btn({
    x: b.x, y: b.y, w: b.w, h: b.h,
    label: on ? b.armedLabel : b.label,
    color: on ? env.C.red : b.color,
    primary: !b.disabled,
    disabled: b.disabled,
    cb: () => {
      if (armed(key)) {
        armKey = '';
        env.buzz('heavy');
        b.cb();
      } else {
        armKey = key;
        armAt = Date.now();
        env.buzz('medium');
      }
    },
  });
  // 待命倒计时条：剩余时间线性缩短，超时自动退回普通态
  if (on) {
    const left = 1 - (Date.now() - armAt) / ARM_MS;
    env.ctx.save();
    env.ctx.fillStyle = env.ac(0.25);
    env.ctx.fillRect(b.x + 4, b.y + b.h - 4, b.w - 8, 2);
    env.ctx.fillStyle = env.C.red;
    env.ctx.fillRect(b.x + 4, b.y + b.h - 4, (b.w - 8) * clamp01(left), 2);
    env.ctx.restore();
  }
}

// ---------------- 欢迎页菜单：四条全宽指令条 ----------------

function drawSplashMenu(env: SkinEnv, time: number, menuA: number) {
  const { VW, VH, MARGIN } = env;
  const slide = (1 - menuA) * 16;
  const entries: [label: string, en: string, color: string, primary: boolean, cb: () => void][] = [
    ['开始战役', 'START OPERATION', env.C.gold, true, () => env.goto('home')],
    ['指挥官图鉴', 'CODEX ARCHIVE', env.C.cyan, false, () => { env.codex.scroll = 0; env.goto('codex'); }],
    ['系统设置', 'SYSTEM CONFIG', env.C.sub, false, () => { env.setShowProfile(false); env.setShowSettings(true); }],
    ['指挥档案', 'COMMANDER FILE', env.C.green, false, () => { env.setShowSettings(false); env.setShowProfile(true); }],
  ];
  const x0 = MARGIN;
  const w0 = VW - MARGIN * 2;
  const barH = 50;
  const gap = 9;
  // 与主文件标题区（星环徽标 + 标题）对齐，同时钳制不超出屏幕底部
  const y0 = Math.min(VH * 0.28 + (VW * 0.17 + 8) * 1.9 + 88 + slide, VH - entries.length * (barH + gap) - 64);
  entries.forEach(([label, en, color, primary, cb], i) => {
    const y = y0 + i * (barH + gap);
    // 依次延迟淡入
    const a = clamp01(menuA * 1.5 - i * 0.14);
    if (a <= 0) return;
    const ctx = env.ctx;
    ctx.save();
    ctx.globalAlpha = a;
    if (primary) {
      // 主指令条：琥珀渐变底 + 顶部斜纹警示线
      env.rr(x0, y, w0, barH, 10);
      const g = ctx.createLinearGradient(x0, y, x0, y + barH);
      g.addColorStop(0, color);
      g.addColorStop(1, env.shade(color));
      ctx.fillStyle = g;
      ctx.fill();
      stripes(env, x0 + 6, y + 3, w0 - 12, 4, 'rgba(8,6,2,0.35)', 7, 4, time * 10);
    } else {
      env.panel(x0, y, w0, barH, `${color}55`, 10);
    }
    // 左侧厚色块引导条
    ctx.fillStyle = primary ? '#1A1209' : color;
    ctx.fillRect(x0, y, 7, barH);
    // 编号
    env.fillText(`0${i + 1}`, x0 + 34, y + barH / 2, {
      size: 18, color: primary ? 'rgba(26,18,9,0.75)' : color, align: 'center', font: env.RES_FONT(),
    });
    env.fillText(label, x0 + 64, y + barH / 2, { size: 16, color: primary ? '#1A1209' : env.C.text });
    env.fillText(en, x0 + w0 - 30, y + barH / 2, {
      size: 9, color: primary ? 'rgba(26,18,9,0.6)' : env.C.dim, align: 'right', weight: '600', font: env.RES_FONT(),
    });
    env.fillText('›', x0 + w0 - 16, y + barH / 2, { size: 15, color: primary ? '#1A1209' : env.C.sub, align: 'center' });
    ctx.restore();
    env.hitBox({ x: x0, y, w: w0, h: barH, label: '', cb });
  });
}

// ---------------- 主页：任务档案时间线 ----------------

// 卡片几何与主文件 totalScrollMax() 的滚动约定保持一致（116 + 12）
const E_CARD_H = 116;
const E_CARD_GAP = 12;

function drawHome(env: SkinEnv, time: number) {
  const { ctx, VW, VH, MARGIN } = env;
  emberBg(env, time);
  emberHeader(env, '战役档案', 'OPERATION ARCHIVE', () => env.goto('splash'));

  // 难度选择：三个工业切角 tab（替代胶囊分段控件）
  const tabY = env.TOP_SAFE + 6;
  const tabW = (VW - MARGIN * 2 - 16) / 3;
  env.DIFF_LIST.forEach((d, i) => {
    const x = MARGIN + i * (tabW + 8);
    const on = env.app.difficulty === d;
    ctx.save();
    env.rr(x, tabY, tabW, 40, 9);
    if (on) {
      const g = ctx.createLinearGradient(x, tabY, x, tabY + 40);
      g.addColorStop(0, env.C.gold);
      g.addColorStop(1, env.shade(env.C.gold));
      ctx.fillStyle = g;
      ctx.fill();
    } else {
      ctx.fillStyle = env.skin.panelSolid;
      ctx.fill();
      ctx.strokeStyle = env.ac(0.3);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
    env.fillText(env.DIFFICULTIES[d].name, x + tabW / 2, tabY + 15, {
      size: 13, color: on ? '#1A1209' : env.C.text, align: 'center',
    });
    env.fillText(d.toUpperCase(), x + tabW / 2, tabY + 30, {
      size: 8, color: on ? 'rgba(26,18,9,0.65)' : env.C.dim, align: 'center', weight: '600', font: env.RES_FONT(),
    });
    env.hitBox({
      x, y: tabY, w: tabW, h: 40, label: '',
      cb: () => {
        if (env.app.difficulty !== d) {
          env.app.difficulty = d;
          env.track('difficulty_select', { difficulty: d });
          env.buzz('light');
        }
      },
    });
  });

  // 档案时间线：左侧竖直进度轨道贯穿列表，章节卡挂在轨道节点上
  const trackX = MARGIN + 16;
  const top = env.homeTop;
  const bottom = env.homeBottom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, VW, bottom - top);
  ctx.clip();
  // 轨道本体
  ctx.fillStyle = env.ac(0.18);
  ctx.fillRect(trackX - 1.5, top, 3, bottom - top);

  const cleared = env.loadProgress().cleared;
  const cardX = MARGIN + 44;
  const cardW = VW - cardX - MARGIN;
  env.LEVELS.forEach((lv, i) => {
    const unlock = i === 0 || cleared.includes(env.LEVELS[i - 1].id);
    const done = cleared.includes(lv.id);
    const y = top + 8 + i * (E_CARD_H + E_CARD_GAP) - env.app.scroll;
    if (y + E_CARD_H < top || y > bottom) return;
    const nodeColor = done ? env.C.green : unlock ? env.C.cyan : env.C.dim;
    const midY = y + E_CARD_H / 2;

    // 节点 + 连接线
    ctx.save();
    ctx.strokeStyle = nodeColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(trackX, midY, 5, 0, Math.PI * 2);
    if (done) { ctx.fillStyle = env.C.green; ctx.fill(); }
    else ctx.stroke();
    if (unlock && !done) {
      // 当前可打节点：内点呼吸脉动
      ctx.fillStyle = nodeColor;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 3);
      ctx.beginPath();
      ctx.arc(trackX, midY, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = env.ac(0.25);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(trackX + 5, midY);
    ctx.lineTo(cardX, midY);
    ctx.stroke();
    ctx.restore();

    // 档案卡：切角面板 + 左侧厚色块 + 大编号
    env.panel(cardX, y, cardW, E_CARD_H, unlock ? `${nodeColor}55` : 'rgba(138,118,92,0.25)');
    ctx.fillStyle = nodeColor;
    ctx.fillRect(cardX, y, 6, E_CARD_H);
    rivets(env, cardX, y, cardW, E_CARD_H);
    ctx.save();
    if (!unlock) ctx.globalAlpha = 0.4;
    env.fillText(String(lv.id).padStart(2, '0'), cardX + 34, y + 34, {
      size: 26, color: nodeColor, align: 'center', font: env.RES_FONT(),
    });
    env.fillText(lv.name, cardX + 64, y + 24, { size: 16 });
    env.fillText(lv.sub, cardX + 64, y + 44, { size: 10, color: env.C.sub, weight: 'normal' });
    const bossTxt = lv.waves.filter((w) => w.isBoss).map((w) => `W${w.wave}`).join(' ');
    env.fillText(`${lv.waves.length} 波 · BOSS ${bossTxt || '—'}`, cardX + 64, y + 62, {
      size: 9, color: env.C.dim, weight: 'normal', font: env.RES_FONT(),
    });
    ctx.restore();
    if (done) env.chip(cardX + cardW - 12, y + 18, '已通关', env.C.green);
    else if (!unlock) env.chip(cardX + cardW - 12, y + 18, '未解锁', env.C.dim);
    // 底部档案编号行
    env.fillText(`FILE // OP-${String(lv.id).padStart(3, '0')}`, cardX + 12, y + E_CARD_H - 12, {
      size: 8, color: env.C.dim, weight: '600', font: env.RES_FONT(),
    });

    if (unlock) {
      env.btn({
        x: cardX + cardW - 90, y: y + E_CARD_H - 48, w: 78, h: 36,
        label: done ? '重玩' : '出击', color: done ? env.C.green : env.C.cyan, primary: !done,
        cb: () => env.gotoBriefing(lv.id),
      });
      // 整卡可点（CTA 之后注册的区域让位给 CTA）
      env.hitBox({ x: cardX, y, w: cardW - 100, h: E_CARD_H, label: '', cb: () => env.gotoBriefing(lv.id) });
    } else {
      // 锁定卡：斜纹遮罩 + 解锁提示
      ctx.save();
      env.rr(cardX, y, cardW, E_CARD_H, 10);
      ctx.fillStyle = 'rgba(10,7,4,0.45)';
      ctx.fill();
      ctx.restore();
      stripes(env, cardX + cardW - 96, y + E_CARD_H - 46, 84, 34, 'rgba(138,118,92,0.25)', 8, 5, 0);
      env.fillText('🔒', cardX + cardW - 54, y + E_CARD_H - 30, { size: 14, color: env.C.dim, align: 'center' });
      env.hitBox({
        x: cardX, y, w: cardW, h: E_CARD_H, label: '',
        cb: () => { env.showToast(`通关「${env.LEVELS[i - 1].name}」后解锁`); env.buzz('light'); },
      });
    }
  });
  ctx.restore();

  // 列表上下渐变遮罩 + 滚动条（棕褐色调）
  const fadeH = 18;
  const gf = ctx.createLinearGradient(0, top, 0, top + fadeH);
  gf.addColorStop(0, 'rgba(16,11,6,0.92)');
  gf.addColorStop(1, 'rgba(16,11,6,0)');
  ctx.fillStyle = gf;
  ctx.fillRect(0, top, VW, fadeH);
  const gb = ctx.createLinearGradient(0, bottom - fadeH, 0, bottom);
  gb.addColorStop(0, 'rgba(9,6,3,0)');
  gb.addColorStop(1, 'rgba(9,6,3,0.92)');
  ctx.fillStyle = gb;
  ctx.fillRect(0, bottom - fadeH, VW, fadeH);
  const smax = env.totalScrollMax();
  if (smax > 0) {
    const viewH = bottom - top;
    const thumbH = Math.max(30, viewH * (viewH / (viewH + smax)));
    const ty = top + (viewH - thumbH) * (env.app.scroll / smax);
    ctx.save();
    ctx.fillStyle = env.ac(0.35);
    env.rr(VW - 4, ty, 3, thumbH, 1.5);
    ctx.fill();
    ctx.restore();
  }
  env.fillText('微信小游戏 · 试运营包', VW / 2, VH - 12, { size: 10, color: 'rgba(192,169,138,0.6)', align: 'center' });

  // 弹层（整屏接管后主文件不再代画）
  if (env.showProfile()) drawProfileImpl(env);
  if (env.showSettings()) drawSettingsImpl(env);
}

// ---------------- 简报：作战命令文书 ----------------

function drawBriefing(env: SkinEnv, time: number) {
  const { ctx, VW, VH, MARGIN } = env;
  emberBg(env, time);
  const lv = env.LEVELS.find((l) => l.id === env.app.levelId) ?? env.LEVELS[0];
  emberHeader(env, '作战命令', 'OPERATION ORDER', () => { env.stopNarration(); env.goto('home'); });

  const bx = MARGIN;
  const bw = VW - MARGIN * 2;
  const bandY = env.TOP_SAFE + 8;

  // 红头横带：WARNING 斜纹包边 + 文书抬头
  ctx.save();
  env.rr(bx, bandY, bw, 34, 8);
  ctx.fillStyle = '#6E1D10';
  ctx.fill();
  ctx.restore();
  stripes(env, bx + 4, bandY + 4, 52, 26, 'rgba(255,176,32,0.5)', 8, 5, time * 8);
  stripes(env, bx + bw - 56, bandY + 4, 52, 26, 'rgba(255,176,32,0.5)', 8, 5, time * 8);
  env.fillText('OPERATION ORDER', VW / 2, bandY + 12, {
    size: 12, color: '#FFD9A8', align: 'center', weight: '600', font: env.RES_FONT(),
  });
  env.fillText(`第 ${lv.id} 章 · 机密`, VW / 2, bandY + 25, { size: 9, color: 'rgba(255,217,168,0.7)', align: 'center', weight: 'normal' });

  // 文书正文面板
  const docY = bandY + 44;
  const bannerH = Math.min(150, Math.round(VW * 0.4), Math.max(96, (VH - docY - 260) * 0.45));
  const textSize = 12;
  const lineH = textSize * 1.65;
  const textW = bw - 32;
  let totalLines = 0;
  for (const para of lv.briefing) totalLines += env.wrapCount(para, textW, textSize) + 0.6;
  const docH = 40 + bannerH + 10 + Math.ceil(totalLines * lineH) + 44;
  env.panel(bx, docY, bw, docH, env.C.panelLine);
  rivets(env, bx, docY, bw, docH);
  // 签发编号行
  env.fillText(`NO. SRD-${String(lv.id).padStart(3, '0')}`, bx + 16, docY + 16, {
    size: 10, color: env.C.cyan, weight: '600', font: env.RES_FONT(),
  });
  env.fillText('签发：星环防线指挥部', bx + bw - 16, docY + 16, { size: 9, color: env.C.sub, align: 'right', weight: 'normal' });
  env.fillText(`${lv.name} · ${lv.sub}`, bx + 16, docY + 32, { size: 12, color: env.C.text });
  // 战区图像
  env.drawCardArt(bx + 12, docY + 44, bw - 24, bannerH, lv.id, time, 8);
  // 旁白开关（与设置中心共享状态）
  env.btn({
    x: bx + bw - 90, y: docY + 52, w: 74, h: 28,
    label: env.narrationMuted() ? '🔇 旁白' : '🔊 旁白', color: env.narrationMuted() ? env.C.sub : env.C.cyan,
    cb: () => env.toggleNarrationMuted(),
  });
  // 命令正文
  let ty = docY + 44 + bannerH + 22;
  for (const para of lv.briefing) ty = env.wrapBlock(para, bx + 16, ty, textW, { size: textSize, color: 'rgba(255,243,226,0.85)' }) + lineH * 0.6;
  // 难度行
  env.fillText(
    `执行难度：${env.DIFFICULTIES[env.app.difficulty].name} · ${env.DIFFICULTIES[env.app.difficulty].label}`,
    bx + 16, docY + docH - 26, { size: 10, color: env.C.gold, weight: 'normal' },
  );
  // 印章：右下斜盖
  ctx.save();
  ctx.translate(bx + bw - 52, docY + docH - 30);
  ctx.rotate(-0.22);
  ctx.strokeStyle = 'rgba(255,90,61,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.stroke();
  env.fillText('SRD', 0, 0, { size: 11, color: 'rgba(255,90,61,0.85)', align: 'center', font: env.RES_FONT() });
  ctx.restore();

  // 底部指令区：出击（两段确认）+ 返回选关
  const ay = docY + docH + 14;
  armBtn(env, `strike:${lv.id}`, {
    x: VW / 2 - 110, y: ay, w: 220, h: 52,
    label: '▶ 出 击', armedLabel: '⚠ 再次确认出击', color: env.C.gold,
    cb: () => env.startBattle(),
  });
  env.btn({
    x: VW / 2 - 110, y: ay + 64, w: 220, h: 42, label: '返回选关', color: env.C.sub,
    cb: () => { env.stopNarration(); env.goto('home'); },
  });

  if (env.showSettings()) drawSettingsImpl(env);
}

// ---------------- 战斗 HUD + prep 面板 ----------------

function drawBattleHUD(env: SkinEnv, engine: GameEngine) {
  const { ctx } = env;
  const st = engine.state;
  // 整体悬浮横条：y 从 TOP_SAFE 起，高 34，左右留白 12，右缘给微信胶囊让位
  const barX = 12;
  const barY = env.TOP_SAFE;
  const barH = 34;
  const barW = env.CAP_LEFT - 8 - env.GAME_CENTER_PAD - barX;
  const midY = barY + barH / 2;
  const font = env.RES_FONT();

  // 工业面板：切角 + 左端厚色块 + 顶部斜纹警示线
  env.panel(barX, barY, barW, barH, env.C.panelLine, 8);
  ctx.fillStyle = env.C.cyan;
  ctx.fillRect(barX, barY, 5, barH);
  stripes(env, barX + 9, barY + 3, barW - 18, 3, env.ac(0.3), 8, 5, st.clock * 10);

  const measure = (txt: string) => {
    ctx.save();
    ctx.font = `bold 12px ${font}`;
    const w = ctx.measureText(txt).width;
    ctx.restore();
    return w;
  };
  // 细分隔线（状态段之间）
  const divider = (x: number) => {
    ctx.save();
    ctx.fillStyle = env.ac(0.28);
    ctx.fillRect(x, barY + 9, 1, barH - 18);
    ctx.restore();
  };

  let cx = barX + 15;
  // 1) ❤ 生命：红色，≤5 时整段闪烁告警
  const livesTxt = `❤ ${st.lives}`;
  ctx.save();
  if (st.lives <= 5) ctx.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(st.clock * 6));
  env.fillText(livesTxt, cx, midY, { size: 12, color: env.C.red, font });
  ctx.restore();
  cx += measure(livesTxt) + 8;
  divider(cx);
  cx += 9;
  // 3) ◈ 金币：金色
  const goldTxt = `◈ ${st.gold}`;
  env.fillText(goldTxt, cx, midY, { size: 12, color: env.C.gold, font });
  cx += measure(goldTxt) + 8;
  divider(cx);
  cx += 9;
  // 5) 波次：数字下方贴 2px 进度线（st.wave / st.totalWaves）
  const waveTxt = `${st.wave}/${st.totalWaves}`;
  const waveW = measure(waveTxt);
  env.fillText(waveTxt, cx, midY - 2, { size: 12, color: env.C.cyan, font });
  ctx.save();
  ctx.fillStyle = env.ac(0.2);
  ctx.fillRect(cx, midY + 9, waveW, 2);
  ctx.fillStyle = env.C.cyan;
  ctx.fillRect(cx, midY + 9, waveW * clamp01(st.wave / st.totalWaves), 2);
  ctx.restore();

  // 6) 竖分隔线 + 7) 三个 30×34 内嵌指令段（⏸/▶、1x/2x、≡ 返回选关）
  const btnW = 30;
  const btnsX = barX + barW - btnW * 3;
  ctx.save();
  ctx.fillStyle = env.ac(0.35);
  ctx.fillRect(btnsX - 8, barY + 6, 1, barH - 12);
  ctx.restore();
  const cmdSegs: [label: string, color: string, cb: () => void][] = [
    [st.paused ? '▶' : '⏸', env.C.text, () => env.engineCmd({ type: 'TOGGLE_PAUSE' })],
    [st.speed === 2 ? '2x' : '1x', st.speed === 2 ? env.C.gold : env.C.text, () => env.engineCmd({ type: 'SET_SPEED', speed: st.speed === 2 ? 1 : 2 })],
    ['≡', env.C.text, () => { env.app.engine = null; env.goto('home'); }],
  ];
  cmdSegs.forEach(([label, color, cb], i) => {
    const sx = btnsX + i * btnW;
    env.fillText(label, sx + btnW / 2, midY, { size: 12, color, align: 'center', font });
    env.hitBox({ x: sx, y: barY, w: btnW, h: barH, label: '', cb });
  });

  // prep 阶段：警告带面板 + 敌情预告 + 立即开战（两段确认）
  if (st.phase === 'prep') {
    const pw = 244;
    const px = env.VW / 2 - pw / 2;
    // 横条底边 + 8px 缝
    const py = barY + barH + 8;
    env.panel(px, py, pw, 74, `${env.C.gold}66`, 10);
    stripes(env, px + 4, py + 4, pw - 8, 6, env.ac(0.5), 8, 6, st.clock * 12);
    env.fillText(`第 ${st.wave} 波 · ${Math.max(0, Math.ceil(st.prepT))}s 后来袭`, env.VW / 2, py + 22, {
      size: 13, align: 'center', font: env.RES_FONT(),
    });
    const wave = engine.level.waves[st.wave - 1];
    const groups = wave?.groups ?? [];
    const isBossWave = wave?.isBoss ?? false;
    const summary = [...new Set(groups.map((g) => `${env.ENEMIES[g.type].name}×${g.count}`))].join(' ');
    env.fillText(`${isBossWave ? '⚠ BOSS 波 · ' : ''}${summary}`, env.VW / 2, py + 42, {
      size: 9, color: isBossWave ? env.C.pink : env.C.gold, align: 'center', weight: 'normal',
    });
    env.fillText(isBossWave ? '建议留好金币与穿甲火力' : '据此提前调整布防', env.VW / 2, py + 58, {
      size: 9, color: env.C.sub, align: 'center', weight: 'normal',
    });
    armBtn(env, `skipPrep:${st.wave}`, {
      x: env.VW / 2 - 70, y: py + 84, w: 140, h: 38,
      label: '▶ 立即开战', armedLabel: '⚠ 确认开战', color: env.C.gold,
      cb: () => { env.engineCmd({ type: 'SKIP_PREP' }); },
    });
  }
}

// ---------------- 底部塔栏（几何与主文件 towerSlotAt 严格一致） ----------------

function drawBottomBar(env: SkinEnv, engine: GameEngine) {
  const { ctx, VW, VH, MARGIN, BAR_H } = env;
  const st = engine.state;
  // 工业底栏：深棕底 + 顶部斜纹警示条 + 琥珀细线
  ctx.fillStyle = '#120D07';
  ctx.fillRect(0, VH - BAR_H, VW, BAR_H);
  stripes(env, 0, VH - BAR_H, VW, 5, env.ac(0.35), 8, 5, st.clock * 10);
  ctx.fillStyle = env.ac(0.4);
  ctx.fillRect(0, VH - BAR_H + 5, VW, 1.5);

  if (st.phase === 'tech') return;

  // 选中炮塔：升级 / 出售指令栏
  const sel = env.app.selectedId != null ? st.towers.find((t) => t.id === env.app.selectedId) : undefined;
  if (sel) {
    const def = env.TOWERS[sel.type];
    ctx.fillStyle = def.color;
    ctx.fillRect(MARGIN, VH - BAR_H + 10, 5, 16);
    env.fillText(`${def.name} Lv${sel.level + 1}`, MARGIN + 14, VH - BAR_H + 18, { size: 13, color: def.color });
    const upCost = sel.level < 2 ? def.levels[sel.level + 1].cost : -1;
    env.btn({
      x: MARGIN, y: VH - BAR_H + 32, w: VW / 2 - MARGIN - 6, h: 46,
      label: upCost >= 0 ? `升级 ◈ ${upCost}` : '已满级', disabled: upCost < 0 || st.gold < upCost,
      color: env.C.green, primary: upCost >= 0 && st.gold >= upCost,
      cb: () => { if (env.engineCmd({ type: 'UPGRADE', id: sel.id })) { env.sfx.play('upgrade'); env.buzz('light'); } },
    });
    const refund = Math.floor(sel.invested * env.SELL_RATE);
    env.btn({
      x: VW / 2 + 6, y: VH - BAR_H + 32, w: VW / 2 - MARGIN - 6, h: 46, label: `出售 +${refund}`,
      color: env.C.gold,
      cb: () => { if (env.engineCmd({ type: 'SELL', id: sel.id })) env.sfx.play('sell'); env.app.selectedId = null; },
    });
    return;
  }

  // 点选放置模式提示栏
  if (env.app.placing) {
    const def = env.TOWERS[env.app.placing];
    ctx.fillStyle = def.color;
    ctx.fillRect(MARGIN, VH - BAR_H + 10, 5, 16);
    env.fillText(`点击地图上绿色格建造「${def.name}」`, MARGIN + 14, VH - BAR_H + 18, { size: 12, color: def.color });
    env.btn({ x: VW / 2 - 76, y: VH - BAR_H + 30, w: 152, h: 44, label: '取消放置', cb: () => { env.app.placing = null; } });
    return;
  }

  // 塔栏槽位：几何必须与主文件 towerSlotAt 一致（MARGIN 起点、SLOT_W 宽、SLOT_GAP 间距、barScroll 偏移）
  const sw = env.SLOT_W;
  const slotH = BAR_H - 24;
  const viewX = MARGIN;
  const viewW = VW - MARGIN * 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(viewX - 4, VH - BAR_H + 4, viewW + 8, BAR_H - 8);
  ctx.clip();
  env.TOWER_ORDER.forEach((type, i) => {
    const def = env.TOWERS[type];
    const cost = def.levels[0].cost;
    const locked = !env.towerUnlocked(type);
    const bx = viewX + i * (sw + env.SLOT_GAP) - env.barScroll;
    const by = VH - BAR_H + 12;
    if (bx + sw < viewX - 4 || bx > viewX + viewW + 4) return;
    const disabled = locked || st.gold < cost;
    ctx.save();
    ctx.globalAlpha = disabled ? 0.55 : 1;
    env.rr(bx, by, sw, slotH, 8);
    ctx.fillStyle = '#1C1409';
    ctx.fill();
    ctx.strokeStyle = disabled ? 'rgba(138,118,92,0.4)' : `${def.color}AA`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // 顶部色条
    ctx.fillStyle = disabled ? 'rgba(138,118,92,0.5)' : def.color;
    ctx.fillRect(bx + 4, by, sw - 8, 3);
    // 炮塔图标（放大居中，槽内不再放塔名，按 slotH=68 重新配平）
    ctx.translate(bx + sw / 2, by + 27);
    env.drawTower(ctx, type, 0, 39, Math.sin(st.clock * 1.1) * 0.1, 0, st.clock, { ticks: false });
    ctx.restore();
    env.fillText(`◈${cost}`, bx + sw / 2, by + 54, { size: 11, color: disabled ? '#8A6A34' : env.C.gold, align: 'center', font: env.RES_FONT() });
    if (locked) {
      ctx.save();
      env.rr(bx, by, sw, slotH, 8);
      ctx.fillStyle = 'rgba(10,7,4,0.6)';
      ctx.fill();
      ctx.restore();
      stripes(env, bx + 6, by + 13, sw - 12, 26, 'rgba(138,118,92,0.3)', 7, 4, 0);
      env.fillText('🔒', bx + sw / 2, by + 27, { size: 12, color: env.C.sub, align: 'center' });
      env.fillText(`第${env.TOWER_UNLOCK[type]}章`, bx + sw / 2, by + 52, { size: 10, color: env.C.sub, align: 'center' });
    }
  });
  ctx.restore();
  // 两侧渐变暗示可滑动
  if (env.stripMaxScroll > 0) {
    if (env.barScroll > 0) {
      const gl = ctx.createLinearGradient(viewX - 4, 0, viewX + 18, 0);
      gl.addColorStop(0, 'rgba(18,13,7,0.95)');
      gl.addColorStop(1, 'rgba(18,13,7,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(viewX - 4, VH - BAR_H + 4, 22, BAR_H - 8);
    }
    if (env.barScroll < env.stripMaxScroll) {
      const gr = ctx.createLinearGradient(viewX + viewW - 18, 0, viewX + viewW + 4, 0);
      gr.addColorStop(0, 'rgba(18,13,7,0)');
      gr.addColorStop(1, 'rgba(18,13,7,0.95)');
      ctx.fillStyle = gr;
      ctx.fillRect(viewX + viewW - 18, VH - BAR_H + 4, 22, BAR_H - 8);
    }
  }
}

// ---------------- 科技三选一：编号供应箱 ----------------

function drawTechOverlay(env: SkinEnv, engine: GameEngine) {
  const { ctx, VW, MARGIN } = env;
  const st = engine.state;
  ctx.fillStyle = 'rgba(10,7,4,0.92)';
  ctx.fillRect(0, 0, VW, env.VH);
  // 抬头 + 斜纹装饰线
  stripes(env, MARGIN, env.TOP_SAFE + 6, VW - MARGIN * 2, 5, env.ac(0.4), 8, 5, 0);
  env.fillText('TACTICAL SUPPLY', VW / 2, env.TOP_SAFE + 22, {
    size: 11, color: env.C.cyan, align: 'center', weight: '600', font: env.RES_FONT(),
  });
  env.fillText(`第 ${st.wave} 波前 · 选择战术补给`, VW / 2, env.TOP_SAFE + 48, { size: 19, align: 'center' });
  env.fillText(`三选一 · 同名可叠加 · 已装 ${st.techs.length}`, VW / 2, env.TOP_SAFE + 72, {
    size: 11, color: env.C.sub, align: 'center', weight: 'normal',
  });

  const taken: Record<string, number> = {};
  for (const t of st.techs) taken[t] = (taken[t] ?? 0) + 1;
  const cardH = 124;
  const top = env.TOP_SAFE + 92;
  st.techChoices!.forEach((id, i) => {
    const y = top + i * (cardH + 14);
    const def = env.TECHS[id];
    // 入场：从右侧依次滑入 + 淡入
    const at = (Date.now() - env.getTechShownAt()) / 1000 - i * 0.09;
    const eo = 1 - (1 - clamp01(at / 0.3)) ** 3;
    ctx.save();
    ctx.globalAlpha = eo;
    ctx.translate((1 - eo) * VW * 0.35, 0);
    env.panel(MARGIN, y, VW - MARGIN * 2, cardH, `${def.color}66`);
    rivets(env, MARGIN, y, VW - MARGIN * 2, cardH);
    // 左侧大图标格：斜纹底 + 编号
    const ib = 72;
    const ix = MARGIN + 14;
    const iy = y + (cardH - ib) / 2;
    ctx.save();
    env.rr(ix, iy, ib, ib, 8);
    ctx.fillStyle = `${def.color}14`;
    ctx.fill();
    ctx.strokeStyle = `${def.color}88`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    stripes(env, ix + 3, iy + 3, ib - 6, ib - 6, `${def.color}22`, 9, 5, st.clock * 6);
    env.fillText(def.glyph, ix + ib / 2, iy + ib / 2, { size: 30, color: def.color, align: 'center' });
    // 供应箱编号
    env.fillText(`SUPPLY-0${i + 1}`, ix, iy - 10, { size: 8, color: env.C.dim, weight: '600', font: env.RES_FONT() });
    // 文本区
    const tx = ix + ib + 14;
    const textW = VW - MARGIN * 2 - (tx - MARGIN) - 14;
    const descLines = env.wrapCount(def.desc, textW, 12);
    const blockH = 24 + descLines * 12 * 1.65;
    const ty0 = y + cardH / 2 - blockH / 2;
    env.fillText(def.name, tx, ty0 + 10, { size: 16, color: def.color });
    env.fillText(def.nameEn, tx + 4 + ctx.measureText(def.name).width, ty0 + 12, {
      size: 8, color: env.C.dim, weight: '600', font: env.RES_FONT(),
    });
    if (taken[id]) env.chip(MARGIN + (VW - MARGIN * 2) - 12, y + 22, `已装×${taken[id]}`, def.color);
    env.wrapBlock(def.desc, tx, ty0 + 34, textW, { color: 'rgba(192,169,138,1)', size: 12 });
    ctx.restore();
    env.hitBox({
      x: MARGIN, y, w: VW - MARGIN * 2, h: cardH, label: '',
      cb: () => { if (env.engineCmd({ type: 'PICK_TECH', id })) env.sfx.play('tech'); },
    });
  });
}

// ---------------- 结算：AFTER ACTION REPORT + 评级印章 ----------------

function drawResult(env: SkinEnv, time: number) {
  const { ctx, VW, MARGIN } = env;
  emberBg(env, time);
  const won = env.app.result!.won;
  const st = env.app.engine!.state;
  const t = (Date.now() - env.getScreenAt()) / 1000;

  // 战败红色边缘晕染
  if (!won) {
    ctx.save();
    ctx.globalAlpha = 0.2 + 0.07 * Math.sin(time * 2);
    const rg = ctx.createRadialGradient(VW / 2, env.VH / 2, Math.min(VW, env.VH) * 0.32, VW / 2, env.VH / 2, Math.max(VW, env.VH) * 0.72);
    rg.addColorStop(0, 'rgba(255,61,90,0)');
    rg.addColorStop(1, 'rgba(255,61,90,0.5)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, VW, env.VH);
    ctx.restore();
  }

  emberHeader(env, '战后报告', 'AFTER ACTION REPORT', () => env.goto('home'));

  const px = MARGIN;
  const pw = VW - MARGIN * 2;
  // 结论横带
  const bandY = env.TOP_SAFE + 10;
  ctx.save();
  env.rr(px, bandY, pw, 36, 8);
  ctx.fillStyle = won ? 'rgba(126,217,87,0.14)' : 'rgba(255,90,61,0.16)';
  ctx.fill();
  ctx.strokeStyle = won ? `${env.C.green}88` : `${env.C.red}88`;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  stripes(env, px + 4, bandY + 4, 40, 28, won ? `${env.C.green}55` : `${env.C.red}55`, 8, 5, 0);
  stripes(env, px + pw - 44, bandY + 4, 40, 28, won ? `${env.C.green}55` : `${env.C.red}55`, 8, 5, 0);
  env.fillText(won ? '★ 作战成功 · MISSION COMPLETE' : '✕ 防线失守 · MISSION FAILED', VW / 2, bandY + 18, {
    size: 14, color: won ? env.C.green : env.C.red, align: 'center',
  });
  env.fillText(
    won ? `第 ${env.app.levelId} 章 · ${env.LEVELS.find((l) => l.id === env.app.levelId)?.name ?? ''}` : `撑到了第 ${st.wave} / ${st.totalWaves} 波`,
    VW / 2, bandY + 50, { size: 12, color: env.C.sub, align: 'center', weight: 'normal' },
  );

  // 战绩记录面板（数字滚动递增）
  const rows: [string, string, number | null][] = [
    ['击杀', String(st.kills), st.kills],
    ['漏怪', String(st.leaked), st.leaked],
    ['剩余生命', `${st.lives} / ${st.maxLives}`, null],
    ['赚取金币', String(st.goldEarned), st.goldEarned],
    ['战术模块', String(st.techs.length), st.techs.length],
  ];
  const py = bandY + 64;
  const rowH = 33;
  const docH = rows.length * rowH + 42;
  env.panel(px, py, pw, docH, env.C.panelLine);
  rivets(env, px, py, pw, docH);
  env.fillText('RECORD // 战绩记录', px + 16, py + 16, { size: 10, color: env.C.cyan, weight: '600', font: env.RES_FONT() });
  rows.forEach(([k, v, num], i) => {
    const ry = py + 42 + i * rowH;
    ctx.fillStyle = env.C.sub;
    ctx.fillRect(px + 16, ry - 4, 3, 8);
    env.fillText(k, px + 26, ry, { size: 13, color: env.C.sub, weight: 'normal' });
    const shown = num === null ? v : String(Math.round(num * clamp01((t - 0.25 - i * 0.12) / 0.6)));
    env.fillText(shown, px + pw - 22, ry, { size: 16, align: 'right', font: env.RES_FONT() });
    if (i < rows.length - 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(192,169,138,0.12)';
      ctx.beginPath();
      ctx.moveTo(px + 26, ry + rowH / 2);
      ctx.lineTo(px + pw - 22, ry + rowH / 2);
      ctx.stroke();
      ctx.restore();
    }
  });

  // 评级印章：从放大旋转砸定（配合 heavy 震动），砸定后冲击环扩散
  const grade = !won ? 'D' : st.leaked === 0 ? 'S' : st.leaked <= 2 ? 'A' : 'B';
  const gradeColor = grade === 'S' ? env.C.gold : grade === 'A' ? env.C.green : grade === 'B' ? env.C.cyan : env.C.red;
  const sx = px + pw - 64;
  const sy = py + 30;
  const sp = clamp01((t - 0.85) / 0.28);
  const seo = 1 - (1 - sp) ** 3;
  if (sp > 0) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-0.55 + seo * 0.38);
    ctx.scale(1 + (1 - seo) * 1.8, 1 + (1 - seo) * 1.8);
    ctx.globalAlpha = seo;
    ctx.strokeStyle = gradeColor;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.stroke();
    env.fillText(grade, 0, 0, { size: 28, color: gradeColor, align: 'center', font: env.RES_FONT() });
    ctx.restore();
  }
  // 砸定瞬间：每屏只震一次 + 冲击环
  if (sp >= 1 && stampDoneFor !== env.getScreenAt()) {
    stampDoneFor = env.getScreenAt();
    env.buzz('heavy');
  }
  const rp = clamp01((t - 1.13) / 0.4);
  if (rp > 0 && rp < 1) {
    ctx.save();
    ctx.globalAlpha = (1 - rp) * 0.6;
    ctx.strokeStyle = gradeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 30 + rp * 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  env.fillText(['完美防线', '防守好手', '守住防线', '防线失守'][['S', 'A', 'B', 'D'].indexOf(grade)], px + 16, py + docH - 16, {
    size: 12, color: gradeColor,
  });
  env.fillText(won ? '下一章解锁已记录' : '再挑战一次就能通过', px + pw - 120, py + docH - 16, {
    size: 9, color: env.C.sub, align: 'center', weight: 'normal',
  });

  // 指令区
  let y = py + docH + 12;
  const nextId = env.app.levelId + 1;
  const hasNext = env.LEVELS.some((l) => l.id === nextId);
  if (won) {
    env.btn({ x: px, y, w: pw, h: 44, label: '◈ 双倍战利 · 观看视频', color: env.C.gold, cb: () => env.showToast('广告模块开发中') });
    y += 54;
  }
  if (won && hasNext) {
    armBtn(env, 'nextChapter', {
      x: px, y, w: pw, h: 50,
      label: `▶ 进入第 ${nextId} 章`, armedLabel: '⚠ 再次确认进入', color: env.C.green,
      cb: () => env.gotoBriefing(nextId),
    });
    y += 62;
  }
  // 炫耀战绩：主动拉起分享（env.shareAppMessage 判空包装 wx.shareAppMessage）
  env.btn({
    x: px, y, w: pw, h: 42, label: '📣 炫耀战绩', color: env.C.pink,
    cb: () => {
      env.track('share_click', { channel: 'result', result: won ? 'win' : 'lose', wave: st.wave });
      env.shareAppMessage({
        title: won
          ? `我在《高塔防线》守住了第 ${env.app.levelId} 关 · 全 ${st.totalWaves} 波，漏怪 ${st.leaked}！`
          : `我在《高塔防线》第 ${env.app.levelId} 关撑到了第 ${st.wave} 波，求支援！`,
        imageUrl: 'assets/share-cover.jpg',
      });
    },
  });
  y += 52;
  env.btn({ x: px, y, w: (pw - 12) / 2, h: 42, label: won ? '再来一局' : '再战本关', color: env.C.gold, cb: () => env.gotoBriefing(env.app.levelId) });
  env.btn({ x: px + (pw - 12) / 2 + 12, y, w: (pw - 12) / 2, h: 42, label: '返回选关', cb: () => env.goto('home') });

  if (env.showSettings()) drawSettingsImpl(env);
}

// ---------------- 图鉴：三页签档案 ----------------

function drawCodex(env: SkinEnv, time: number) {
  const { ctx, VW, VH, MARGIN } = env;
  emberBg(env, time);
  emberHeader(env, '指挥官图鉴', 'CODEX ARCHIVE', () => env.goto('home'));

  // 页签：工业切角 tab
  const tabY = env.TOP_SAFE + 6;
  const tabW = (VW - MARGIN * 2 - 16) / env.CODEX_TABS.length;
  env.CODEX_TABS.forEach(([id, label], i) => {
    const x = MARGIN + i * (tabW + 8);
    const on = env.codex.tab === id;
    ctx.save();
    env.rr(x, tabY, tabW, 36, 8);
    if (on) {
      const g = ctx.createLinearGradient(x, tabY, x, tabY + 36);
      g.addColorStop(0, env.C.cyan);
      g.addColorStop(1, env.shade(env.C.cyan));
      ctx.fillStyle = g;
      ctx.fill();
    } else {
      ctx.fillStyle = env.skin.panelSolid;
      ctx.fill();
      ctx.strokeStyle = env.ac(0.3);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
    env.fillText(label, x + tabW / 2, tabY + 18, { size: 13, color: on ? '#1A1209' : env.C.text, align: 'center' });
    env.hitBox({
      x, y: tabY, w: tabW, h: 36, label: '',
      cb: () => { if (!on) { env.codex.tab = id; env.codex.scroll = 0; env.buzz('light'); } },
    });
  });

  // 内容区（模块自管滚动：主文件 codexMaxScroll 为私有，见 handleTouch）
  const top = tabY + 46;
  const bottom = VH - 22;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, VW, bottom - top);
  ctx.clip();
  const y0 = top + 8 - env.codex.scroll;
  let endY: number;
  if (env.codex.tab === 'story') endY = codexStory(env, y0, time, top, bottom);
  else if (env.codex.tab === 'towers') endY = codexTowers(env, y0, time, top, bottom);
  else endY = codexEnemies(env, y0, time, top, bottom);
  ctx.restore();
  codexMax = Math.max(0, endY - y0 - (bottom - top) + 20);
  env.codex.scroll = Math.max(0, Math.min(codexMax, env.codex.scroll));

  // 渐变遮罩 + 滚动条
  const fadeH = 16;
  const gf = ctx.createLinearGradient(0, top, 0, top + fadeH);
  gf.addColorStop(0, 'rgba(16,11,6,0.92)');
  gf.addColorStop(1, 'rgba(16,11,6,0)');
  ctx.fillStyle = gf;
  ctx.fillRect(0, top, VW, fadeH);
  const gb = ctx.createLinearGradient(0, bottom - fadeH, 0, bottom);
  gb.addColorStop(0, 'rgba(9,6,3,0)');
  gb.addColorStop(1, 'rgba(9,6,3,0.92)');
  ctx.fillStyle = gb;
  ctx.fillRect(0, bottom - fadeH, VW, fadeH);
  if (codexMax > 0) {
    const viewH = bottom - top;
    const thumbH = Math.max(30, viewH * (viewH / (viewH + codexMax)));
    const ty = top + (viewH - thumbH) * (env.codex.scroll / codexMax);
    ctx.save();
    ctx.fillStyle = env.ac(0.35);
    env.rr(VW - 4, ty, 3, thumbH, 1.5);
    ctx.fill();
    ctx.restore();
  }

  if (env.showProfile()) drawProfileImpl(env);
  if (env.showSettings()) drawSettingsImpl(env);
}

function codexStory(env: SkinEnv, y0: number, time: number, top: number, bottom: number): number {
  const { ctx, VW, MARGIN } = env;
  const x = MARGIN;
  const w = VW - MARGIN * 2;
  const textSize = 12;
  const textW = w - 40;
  let totalLines = 0;
  for (const p of env.STORY_PARAS) totalLines += env.wrapCount(p, textW, textSize) + 0.6;
  const boxH = Math.ceil(totalLines * textSize * 1.65) + 48;
  env.panel(x, y0, w, boxH, env.C.panelLine);
  rivets(env, x, y0, w, boxH);
  ctx.fillStyle = env.C.cyan;
  ctx.fillRect(x, y0, 6, boxH);
  env.fillText('世界观档案 // WORLD FILE', x + 18, y0 + 20, { size: 12, color: env.C.cyan, font: env.RES_FONT() });
  let ty = y0 + 44;
  for (const p of env.STORY_PARAS) ty = env.wrapBlock(p, x + 18, ty, textW, { size: textSize, color: 'rgba(255,243,226,0.85)' }) + textSize * 1.65 * 0.6;

  let y = y0 + boxH + 20;
  env.fillText('战役编年史', x + 4, y + 8, { size: 14 });
  env.fillText('点击已解锁章节直接出击', x + w - 4, y + 9, { size: 10, color: env.C.dim, align: 'right', weight: 'normal' });
  y += 28;
  const cleared = env.loadProgress().cleared;
  env.LEVELS.forEach((lv, i) => {
    const unlock = i === 0 || cleared.includes(env.LEVELS[i - 1].id);
    const done = cleared.includes(lv.id);
    const rowH = 60;
    if (y + rowH > top && y < bottom) {
      const nodeColor = done ? env.C.green : unlock ? env.C.cyan : env.C.dim;
      env.panel(x, y, w, rowH, unlock ? `${nodeColor}44` : 'rgba(138,118,92,0.2)', 8);
      ctx.fillStyle = nodeColor;
      ctx.fillRect(x, y, 5, rowH);
      env.drawCardArt(x + 12, y + 8, 66, rowH - 16, lv.id, time, 6);
      const tx = x + 90;
      ctx.save();
      if (!unlock) ctx.globalAlpha = 0.45;
      env.fillText(`CH.${String(lv.id).padStart(2, '0')}`, tx, y + 18, { size: 9, color: env.C.cyan, weight: '600', font: env.RES_FONT() });
      env.fillText(lv.name, tx, y + 36, { size: 14 });
      env.fillText(lv.sub, tx, y + 52, { size: 10, color: env.C.sub, weight: 'normal' });
      ctx.restore();
      if (done) env.chip(x + w - 12, y + 16, '已通关', env.C.green);
      else if (!unlock) env.chip(x + w - 12, y + 16, '未解锁', env.C.dim);
      if (unlock) env.hitBox({ x, y, w, h: rowH, label: '', cb: () => env.gotoBriefing(lv.id) });
      else env.hitBox({
        x, y, w, h: rowH, label: '',
        cb: () => { env.showToast(`通关「${env.LEVELS[i - 1].name}」后解锁`); env.buzz('light'); },
      });
    }
    y += rowH + 10;
  });
  return y;
}

function codexTowers(env: SkinEnv, y0: number, time: number, top: number, bottom: number): number {
  const { ctx, VW, MARGIN } = env;
  const x = MARGIN;
  const w = VW - MARGIN * 2;
  let y = y0;
  for (const def of env.TOWER_LIST) {
    const cardH = 134;
    const unlocked = env.towerUnlocked(def.type);
    if (y + cardH > top && y < bottom) {
      env.panel(x, y, w, cardH, unlocked ? `${def.color}55` : 'rgba(138,118,92,0.2)');
      ctx.fillStyle = unlocked ? def.color : env.C.dim;
      ctx.fillRect(x, y, 5, cardH);
      // 图标格：斜纹底 + 满级形态演示
      const ib = 64;
      const ix = x + 14;
      const iy = y + (cardH - ib) / 2;
      ctx.save();
      env.rr(ix, iy, ib, ib, 8);
      ctx.fillStyle = `${def.color}14`;
      ctx.fill();
      ctx.strokeStyle = `${def.color}55`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.clip();
      stripes(env, ix, iy, ib, ib, `${def.color}18`, 9, 5, 0);
      ctx.translate(ix + ib / 2, iy + ib / 2);
      ctx.globalAlpha = unlocked ? 1 : 0.35;
      const charge = def.charge ? 0.5 + 0.5 * Math.sin(time * 1.4) : 0;
      env.drawTower(ctx, def.type, 2, 46, Math.sin(time * 1.1) * 0.12, charge, time, { ticks: false });
      ctx.restore();
      // 文本区
      const tx = ix + ib + 14;
      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.55;
      env.fillText(def.name, tx, y + 20, { size: 15 });
      env.fillText(def.nameEn, tx, y + 37, { size: 9, color: env.C.dim, weight: '600', font: env.RES_FONT() });
      env.fillText(def.role, tx, y + 53, { size: 11, color: env.C.sub, weight: 'normal' });
      env.fillText(`伤害 ${def.levels.map((l) => l.damage).join(' → ')} · 射程 ${def.levels.map((l) => l.range).join(' → ')}`, tx, y + 71, { size: 10, weight: 'normal' });
      env.fillText(`射速 ${def.levels.map((l) => l.rate).join(' → ')}/s · 造价 ◈${def.levels[0].cost}`, tx, y + 87, { size: 10, weight: 'normal' });
      env.fillText(`克制 ${def.strong}`, tx, y + 105, { size: 10, color: env.C.green, weight: 'normal' });
      env.fillText(`短板 ${def.weak}`, tx, y + 121, { size: 10, color: env.C.sub, weight: 'normal' });
      ctx.restore();
      env.chip(x + w - 12, y + 17, def.tag, def.color);
      if (!unlocked) {
        env.fillText(`通关第 ${env.TOWER_UNLOCK[def.type]} 章解锁`, x + w - 12, y + cardH - 12, { size: 10, color: env.C.gold, align: 'right' });
      }
    }
    y += cardH + 12;
  }
  return y;
}

function codexEnemies(env: SkinEnv, y0: number, time: number, top: number, bottom: number): number {
  const { ctx, VW, MARGIN } = env;
  const x = MARGIN;
  const w = VW - MARGIN * 2;
  let y = y0;
  for (const def of env.ENEMY_LIST) {
    const textW = w - 92 - 14;
    const descLines = env.wrapCount(def.desc, textW, 10);
    const cardH = Math.ceil(92 + descLines * 13.2 + 22);
    if (y + cardH > top && y < bottom) {
      env.panel(x, y, w, cardH, `${def.color}44`);
      ctx.fillStyle = def.color;
      ctx.fillRect(x, y, 5, cardH);
      // 图标格：活体贴图缓慢浮动
      const ib = 64;
      const ix = x + 14;
      const iy = y + (cardH - ib) / 2;
      ctx.save();
      env.rr(ix, iy, ib, ib, 8);
      ctx.fillStyle = `${def.color}12`;
      ctx.fill();
      ctx.strokeStyle = `${def.color}44`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.clip();
      stripes(env, ix, iy, ib, ib, `${def.color}14`, 9, 5, 0);
      ctx.translate(ix + ib / 2, iy + ib / 2 + Math.sin(time * 2.2) * 2);
      env.drawEnemy(ctx, def.type, Math.min(21, def.size), time, {});
      ctx.restore();
      // 文本区
      const tx = ix + ib + 14;
      env.fillText(def.name, tx, y + 20, { size: 15 });
      env.fillText(def.nameEn, tx, y + 37, { size: 9, color: env.C.dim, weight: '600', font: env.RES_FONT() });
      env.chip(x + w - 12, y + 17, env.ENEMY_CATEGORY[def.category] ?? def.category, def.color);
      env.fillText(`威胁 ${'★'.repeat(def.threat)}`, tx, y + 54, { size: 10, color: env.C.gold });
      env.fillText(`生命 ${def.hp} · 速度 ${def.speed} · 击杀 ◈${def.reward} · 漏怪 -${def.leak}`, tx, y + 70, { size: 10, color: env.C.sub, weight: 'normal' });
      const dy = env.wrapBlock(def.desc, tx, y + 86, textW, { size: 10, color: 'rgba(255,243,226,0.75)' });
      env.fillText(`弱点：${def.weakness}`, tx, dy + 2, { size: 10, color: env.C.cyan, weight: 'normal' });
    }
    y += cardH + 12;
  }
  return y;
}

// ---------------- 设置中心 ----------------

function drawSettingsImpl(env: SkinEnv) {
  const { ctx, VW, VH } = env;
  ctx.fillStyle = 'rgba(8,5,3,0.8)';
  ctx.fillRect(0, 0, VW, VH);
  // 全屏透明热区：吞掉面板外的点击，避免穿透到底层页面
  env.hitBox({ x: 0, y: 0, w: VW, h: VH, label: '', cb: () => {} });
  const pw = VW - 72;
  const px = 36;
  const rowH = 54;
  const rows: [label: string, desc: string, on: boolean, cb: () => void][] = [
    ['音效', '攻击 / 爆炸 / 金币等战斗音效', !env.sfx.muted, () => env.sfx.setMuted(!env.sfx.muted)],
    ['音乐', '主页与战斗背景音乐', !env.musicMuted(), () => env.toggleMusicMuted()],
    ['旁白', '任务简报语音解说', !env.narrationMuted(), () => env.toggleNarrationMuted()],
    ['震动', '建造 / 漏怪 / BOSS 战触感反馈', !env.vibrateMuted(), () => env.toggleVibrateMuted()],
    ['高画质', 'Bloom 辉光特效，低端机建议关闭', env.readQualityHigh(), () => env.setQualityHigh(!env.readQualityHigh())],
  ];
  const skinH = 78;
  const ph = 74 + rows.length * rowH + skinH + 64;
  const py = VH / 2 - ph / 2;
  env.panel(px, py, pw, ph, env.C.panelLine);
  rivets(env, px, py, pw, ph);
  stripes(env, px + 8, py + 6, pw - 16, 5, env.ac(0.4), 8, 5, 0);
  env.fillText('SYSTEM CONFIG', VW / 2, py + 26, { size: 9, color: env.ac(0.75), weight: '600', align: 'center', font: env.RES_FONT() });
  env.fillText('设置中心', VW / 2, py + 48, { size: 17, align: 'center' });
  rows.forEach(([label, desc, on, cb], i) => {
    const y = py + 68 + i * rowH;
    if (i > 0) {
      ctx.save();
      ctx.strokeStyle = env.ac(0.12);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 20, y + 0.5);
      ctx.lineTo(px + pw - 20, y + 0.5);
      ctx.stroke();
      ctx.restore();
    }
    // 左侧厚色块行引导
    ctx.fillStyle = on ? env.C.cyan : env.C.dim;
    ctx.fillRect(px + 16, y + rowH / 2 - 10, 4, 20);
    env.fillText(label, px + 30, y + 18, { size: 14 });
    env.fillText(desc, px + 30, y + 38, { size: 10, color: env.C.sub, weight: 'normal' });
    env.drawSwitch(px + pw - 20 - 46, y + rowH / 2 - 13, on);
    env.hitBox({ x: px + 16, y, w: pw - 32, h: rowH, label: '', cb: () => { cb(); env.buzz('light'); } });
  });
  // 界面皮肤切换（必须保留：applySkin 即换并持久化）
  const skY = py + 68 + rows.length * rowH;
  env.fillText('界面皮肤', px + 30, skY + 12, { size: 14 });
  env.fillText('INTERFACE SKIN', px + 30, skY + 30, { size: 8, color: env.C.dim, weight: '600', font: env.RES_FONT() });
  const chipW = (pw - 40 - 12) / env.SKINS.length;
  env.SKINS.forEach((s, i) => {
    const cx0 = px + 20 + i * (chipW + 6);
    const cy0 = skY + 40;
    const on = s.id === env.skin.id;
    ctx.save();
    env.rr(cx0, cy0, chipW, 30, 6);
    ctx.fillStyle = on ? env.ac(0.2) : 'rgba(138,118,92,0.12)';
    ctx.fill();
    ctx.strokeStyle = on ? s.accent : 'rgba(138,118,92,0.4)';
    ctx.lineWidth = on ? 1.6 : 1;
    ctx.stroke();
    ctx.fillStyle = s.accent;
    ctx.beginPath();
    ctx.arc(cx0 + 13, cy0 + 15, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    env.fillText(s.name, cx0 + 23, cy0 + 15, { size: 11, color: on ? env.C.text : env.C.sub });
    env.hitBox({
      x: cx0, y: cy0, w: chipW, h: 30, label: '',
      cb: () => { env.applySkin(s.id); env.buzz('light'); env.showToast(`已切换「${s.name}」`); },
    });
  });
  env.btn({
    x: px + 24, y: py + 68 + rows.length * rowH + skinH + 8, w: pw - 48, h: 40,
    label: '关闭', cb: () => env.setShowSettings(false),
  });
}

// ---------------- 指挥官档案 ----------------

function drawProfileImpl(env: SkinEnv) {
  const { ctx, VW, VH } = env;
  ctx.fillStyle = 'rgba(8,5,3,0.8)';
  ctx.fillRect(0, 0, VW, VH);
  env.hitBox({ x: 0, y: 0, w: VW, h: VH, label: '', cb: () => {} });
  const pw = VW - 72;
  const ph = 384;
  const px = 36;
  const py = VH / 2 - ph / 2;
  env.panel(px, py, pw, ph, env.C.panelLine);
  rivets(env, px, py, pw, ph);
  stripes(env, px + 8, py + 6, pw - 16, 5, env.ac(0.4), 8, 5, 0);
  env.fillText('COMMANDER FILE', VW / 2, py + 24, { size: 9, color: env.ac(0.75), weight: '600', align: 'center', font: env.RES_FONT() });
  env.drawAvatar(VW / 2, py + 66, 34);
  env.fillText(env.displayNick(), VW / 2, py + 122, { size: 18, align: 'center' });
  env.fillText(env.commanderRank(), VW / 2, py + 146, { size: 11, color: env.C.gold, align: 'center', weight: 'normal' });

  // 战役进度条（琥珀渐变 + 刻度）
  const cleared = env.loadProgress().cleared.length;
  const bw = pw - 64;
  const bx = px + 32;
  const by = py + 168;
  env.fillText(`战役进度 ${cleared} / ${env.LEVELS.length}`, VW / 2, by - 6, { size: 11, color: env.C.sub, align: 'center', weight: 'normal' });
  env.rr(bx, by + 8, bw, 10, 3);
  ctx.fillStyle = env.ac(0.12);
  ctx.fill();
  if (cleared > 0) {
    env.rr(bx, by + 8, Math.max(10, bw * (cleared / env.LEVELS.length)), 10, 3);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, env.C.cyan);
    g.addColorStop(1, env.C.gold);
    ctx.fillStyle = g;
    ctx.fill();
  }
  // 进度刻度
  ctx.save();
  ctx.fillStyle = 'rgba(255,243,226,0.25)';
  for (let i = 1; i < env.LEVELS.length; i++) ctx.fillRect(bx + (bw * i) / env.LEVELS.length, by + 8, 1, 10);
  ctx.restore();

  env.btn({ x: px + 24, y: py + 200, w: pw - 48, h: 40, label: '💬 意见反馈', color: env.C.gold, cb: () => env.openFeedback() });
  let y = py + 252;
  if (!env.getProfile().real) {
    env.btn({
      x: px + 24, y, w: pw - 48, h: 44, label: '同步微信头像昵称', color: env.C.green, primary: true,
      cb: () => env.authUser(),
    });
    y += 56;
  }
  env.btn({ x: px + 24, y, w: pw - 48, h: 40, label: '关闭', cb: () => env.setShowProfile(false) });
}

// ---------------- 拖拽建塔幽灵 ----------------

function drawDragGhost(env: SkinEnv, engine: GameEngine, type: TowerType, p: TouchPoint) {
  const { ctx, VW, VH, BAR_H } = env;
  const st = engine.state;
  const def = env.TOWERS[type];
  const gx = Math.floor(env.toMapX(p.x) / CELL);
  const gy = Math.floor(env.toMapY(p.y) / CELL);
  const inMap = gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS;
  const canBuild = inMap
    && engine.map.isBuildable(gx, gy)
    && !st.towers.some((tw) => tw.col === gx && tw.row === gy)
    && st.gold >= def.levels[0].cost;

  if (inMap) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, env.TOP_SAFE - 2, VW, VH - BAR_H - env.TOP_SAFE + 2);
    ctx.clip();
    const shk = st.shake > 0 ? Math.min(1.2, st.shake) * 7 : 0;
    ctx.translate(env.mapOX + (Math.random() - 0.5) * shk * 2, env.mapOY + env.getMapPan() + (Math.random() - 0.5) * shk);
    ctx.scale(env.mapScale, env.mapScale);
    const cx = gx * CELL;
    const cy = gy * CELL;
    // 切角高亮格（工业风：切角取代圆角）
    env.rr(cx + 2, cy + 2, CELL - 4, CELL - 4, 6);
    ctx.fillStyle = canBuild ? 'rgba(126,217,87,0.22)' : 'rgba(255,90,90,0.20)';
    ctx.fill();
    ctx.strokeStyle = canBuild ? env.C.green : env.C.red;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (canBuild) {
      // 射程环：琥珀虚线
      ctx.strokeStyle = env.ac(0.5);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(cx + CELL / 2, cy + CELL / 2, def.levels[0].range * CELL, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.translate(cx + CELL / 2, cy + CELL / 2);
      env.drawTower(ctx, type, 0, CELL * 0.92, 0, 0, st.clock, { ticks: false });
      ctx.restore();
    }
    ctx.restore();
  }

  // 底部提示条：斜纹小包条
  const hint = canBuild ? '松手建造' : inMap ? '此处不可建造' : '拖到地图空格上';
  const hColor = canBuild ? env.C.green : env.C.sub;
  ctx.save();
  ctx.font = 'bold 12px sans-serif';
  const hw = ctx.measureText(hint).width + 36;
  env.rr(VW / 2 - hw / 2, VH - BAR_H - 34, hw, 26, 6);
  ctx.fillStyle = '#120D07';
  ctx.fill();
  ctx.strokeStyle = `${hColor}88`;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  env.fillText(hint, VW / 2, VH - BAR_H - 21, { size: 12, color: hColor, align: 'center' });
}

// ---------------- 触摸接管：仅图鉴页自管滚动 ----------------
// 主文件的 codexMaxScroll 是模块私有且只在其内置 drawCodex 里更新；
// 本模块接管图鉴绘制后必须自管滚动，否则滚动量会被 clamp 到 0。

function handleTouch(env: SkinEnv, phase: 'start' | 'move' | 'end', p: TouchPoint): boolean {
  if (env.app.screen !== 'codex' || env.showSettings() || env.showProfile()) {
    codexDrag = null;
    return false;
  }
  if (phase === 'start') {
    // 返回 false：主文件继续记录 touchTime 等，保证轻点的 hooks 派发不受影响
    codexDrag = { y: p.y, moved: 0 };
    return false;
  }
  if (phase === 'move') {
    if (!codexDrag) return false;
    env.codex.scroll = Math.max(0, Math.min(codexMax, env.codex.scroll + (codexDrag.y - p.y)));
    codexDrag.moved += Math.abs(codexDrag.y - p.y);
    codexDrag.y = p.y;
    return true; // 消费 move：阻止主文件用旧 codexMaxScroll 滚动
  }
  // end：拖动超过阈值则吞掉本次点击，轻点放行给内置 hooks 派发
  const moved = codexDrag?.moved ?? 0;
  codexDrag = null;
  if (moved > 8) env.consumeTap();
  return false;
}

// ---------------- 模块导出 ----------------

export const emberSkin: SkinModule = {
  id: 'ember',
  drawSplashMenu,
  drawHome,
  drawBriefing,
  drawBattleHUD,
  drawBottomBar,
  drawTechOverlay,
  drawResult,
  drawCodex,
  drawSettings: drawSettingsImpl,
  drawProfile: drawProfileImpl,
  drawDragGhost,
  handleTouch,
};
