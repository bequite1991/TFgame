// 3D 场景管理 —— 每帧增量同步 GameState → three 对象（按 id diff 增删，禁止每帧重建几何体）
// 坐标约定：逻辑像素 (x, y) → 地面 (x, 0, y)，高度 +Y，地面即 Y=0 平面
import * as THREE from 'three';
import { CELL, COLS, ROWS, W, H, TOWERS } from '../config';
import type { GameEngine, TowerType } from '../types';
import { createTowerModel, type TowerModel } from './towerModels';
import { createEnemySprite, type EnemySprite } from './enemySprites';

export interface OverlayState {
  placing: TowerType | null;
  selectedId: number | null;
  hoverCell: { col: number; row: number } | null;
}

// 深色地面网格纹理（程序化 canvas）
function groundTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#101A33';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(34,224,255,0.16)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += CELL) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += CELL) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(169,199,255,0.1)';
  for (let i = 0; i < 240; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 路径流动虚线纹理（沿段长 repeat）
function pathTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(34,224,255,0.95)';
  ctx.fillRect(0, 5, 36, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 浮字 canvas 纹理
function textTexture(text: string, color: string): { tex: THREE.CanvasTexture; w: number; h: number } {
  const c = document.createElement('canvas');
  let ctx = c.getContext('2d')!;
  ctx.font = '700 28px Orbitron, sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 16;
  c.width = w;
  c.height = 40;
  ctx = c.getContext('2d')!;
  ctx.font = '700 28px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, 20);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, w, h: 40 };
}

interface TowerEntry {
  model: TowerModel;
  type: TowerType;
  level: number;
}
interface BeamEntry {
  line: THREE.Mesh;
  glow: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  glowMat: THREE.MeshBasicMaterial;
}
interface ZoneEntry {
  disc: THREE.Mesh;
  edge: THREE.Mesh;
  discMat: THREE.MeshBasicMaterial;
  edgeMat: THREE.MeshBasicMaterial;
}
interface BaseEntry {
  shieldMat: THREE.MeshBasicMaterial;
  beaconMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
}

const UP = new THREE.Vector3(0, 1, 0);

export class Scene3D {
  overlay: OverlayState = { placing: null, selectedId: null, hoverCell: null };

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  // 棋盘南侧上方俯视（仰角约 55°），望向棋盘中心偏北
  private camPos = new THREE.Vector3(W / 2, 820, 1060);
  private camTarget = new THREE.Vector3(W / 2, 0, 430);

  private towers = new Map<number, TowerEntry>();
  private enemies = new Map<number, { sprite: EnemySprite; type: string }>();
  private shots = new Map<number, THREE.Mesh>();
  private beams = new Map<number, BeamEntry>();
  private rings = new Map<number, { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }>();
  private zones = new Map<number, ZoneEntry>();
  private floaters = new Map<number, { sprite: THREE.Sprite; mat: THREE.SpriteMaterial }>();
  private bases: BaseEntry[] = [];

  // 共享几何体/材质
  private geoShot = new THREE.SphereGeometry(1, 10, 8);
  private matMissile = new THREE.MeshBasicMaterial({ color: 0xff9f43 });
  private matPlasma = new THREE.MeshBasicMaterial({ color: 0xff6b3d });
  private geoBeam = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  private geoGlow = new THREE.SphereGeometry(1, 10, 8);
  private geoRing = new THREE.RingGeometry(0.9, 1, 64);
  private geoDisc = new THREE.CircleGeometry(1, 48);

  // 粒子（THREE.Points，预分配缓冲，加色渐隐用颜色乘 alpha）
  private particleCap = 600;
  private particlePos = new Float32Array(this.particleCap * 3);
  private particleCol = new Float32Array(this.particleCap * 3);
  private particleGeo = new THREE.BufferGeometry();

  private pathMats: THREE.MeshBasicMaterial[] = [];
  private starGroup = new THREE.Group();
  private buildCells: { mesh: THREE.Mesh; col: number; row: number }[] = [];
  private buildMat = new THREE.MeshBasicMaterial({
    color: 0x22e0ff,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  private hoverMark: THREE.Mesh;
  private hoverRange = new THREE.Group();
  private selRange = new THREE.Group();
  private selLine: THREE.LineLoop | null = null;
  private selRadius = -1;
  private selDisc: THREE.Mesh;

  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpDir = new THREE.Vector3();
  private tmpColor = new THREE.Color();

  private canvas: HTMLCanvasElement;
  private engine: GameEngine;

  constructor(canvas: HTMLCanvasElement, engine: GameEngine) {
    this.canvas = canvas;
    this.engine = engine;
    this.geoRing.rotateX(-Math.PI / 2);
    this.geoDisc.rotateX(-Math.PI / 2);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H, false); // 缓冲固定 W×H，CSS 按 aspectRatio 缩放（同 2D）

    this.scene.background = new THREE.Color(0x05070f);
    this.scene.fog = new THREE.FogExp2(0x05070f, 0.0004);
    this.camera = new THREE.PerspectiveCamera(64, W / H, 10, 5000);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    // 灯光：天光/地光补光 + 相机一侧主方向光（阴影关）+ 各出口点光（随基地建）
    this.scene.add(new THREE.AmbientLight(0x8fa8d8, 1.1));
    this.scene.add(new THREE.HemisphereLight(0x9db8ff, 0x1a2240, 1.4));
    const dir = new THREE.DirectionalLight(0xffffff, 2.5);
    dir.position.set(W / 2 + 160, 900, 1100); // 南侧上方（相机一侧），照亮塔身正面
    dir.target.position.set(W / 2, 0, H / 2);
    this.scene.add(dir, dir.target);

    // 地面
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ map: groundTexture() }),
    );
    ground.geometry.rotateX(-Math.PI / 2);
    ground.position.set(W / 2, 0, H / 2);
    this.scene.add(ground);

    // 星空
    const starN = 700;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const r = 1600 + Math.random() * 1400;
      const a = Math.random() * Math.PI * 2;
      const y = Math.random() * 0.9 + 0.06;
      const horiz = Math.sqrt(1 - y * y) * r;
      starPos[i * 3] = Math.cos(a) * horiz;
      starPos[i * 3 + 1] = y * r - 120;
      starPos[i * 3 + 2] = Math.sin(a) * horiz;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xa9c7ff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }),
    );
    this.starGroup.add(stars);
    this.starGroup.position.set(W / 2, 0, H / 2);
    this.scene.add(this.starGroup);

    this.buildPaths();
    this.buildBases();
    this.buildHighlights();

    // hover 格高亮
    this.hoverMark = new THREE.Mesh(new THREE.PlaneGeometry(CELL - 2, CELL - 2), this.buildMat.clone());
    this.hoverMark.geometry.rotateX(-Math.PI / 2);
    (this.hoverMark.material as THREE.MeshBasicMaterial).opacity = 0.3;
    this.hoverMark.visible = false;
    this.scene.add(this.hoverMark);

    // hover 预览射程（圆盘 + 圆环，半径 1 几何体按射程缩放）
    const hoverDisc = new THREE.Mesh(this.geoDisc, this.buildMat.clone());
    (hoverDisc.material as THREE.MeshBasicMaterial).opacity = 0.08;
    const hoverRing = new THREE.Mesh(this.geoRing, this.buildMat.clone());
    (hoverRing.material as THREE.MeshBasicMaterial).opacity = 0.7;
    this.hoverRange.add(hoverDisc, hoverRing);
    this.hoverRange.visible = false;
    this.scene.add(this.hoverRange);

    // 选中塔射程（虚线圆 + 淡填充）
    this.selDisc = new THREE.Mesh(this.geoDisc, this.buildMat.clone());
    (this.selDisc.material as THREE.MeshBasicMaterial).opacity = 0.06;
    this.selRange.add(this.selDisc);
    this.selRange.visible = false;
    this.scene.add(this.selRange);

    // 粒子
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePos, 3));
    this.particleGeo.setAttribute('color', new THREE.BufferAttribute(this.particleCol, 3));
    const points = new THREE.Points(
      this.particleGeo,
      new THREE.PointsMaterial({
        size: 5,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    points.frustumCulled = false;
    this.scene.add(points);
  }

  /** 发光青色路径条带（流动虚线） */
  private buildPaths() {
    const baseTex = pathTexture();
    for (const path of this.engine.map.paths) {
      for (const seg of path.segs) {
        const dz = seg.y2 - seg.y1;
        const dx = seg.x2 - seg.x1;
        const angle = Math.atan2(-dz, dx);
        const mx = (seg.x1 + seg.x2) / 2;
        const mz = (seg.y1 + seg.y2) / 2;
        // 暗底衬条
        const under = new THREE.Mesh(
          new THREE.PlaneGeometry(seg.len + CELL * 0.5, CELL * 0.7),
          new THREE.MeshBasicMaterial({ color: 0x14234a }),
        );
        under.geometry.rotateX(-Math.PI / 2);
        under.position.set(mx, 0.3, mz);
        under.rotation.y = angle;
        this.scene.add(under);
        // 流动虚线
        const tex = baseTex.clone();
        tex.repeat.set((seg.len + CELL * 0.5) / 44, 1);
        tex.needsUpdate = true;
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(seg.len + CELL * 0.5, CELL * 0.6), mat);
        strip.geometry.rotateX(-Math.PI / 2);
        strip.position.set(mx, 0.5, mz);
        strip.rotation.y = angle;
        this.scene.add(strip);
        this.pathMats.push(mat);
      }
    }
  }

  /** 每个出口一座 3D 基地：低多边形建筑 + 半透明护罩球冠 */
  private buildBases() {
    for (const ex of this.engine.map.exits) {
      const g = new THREE.Group();
      g.position.set(ex.centerX, 0, ex.centerY);
      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(30, 36, 12, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a3450, metalness: 0.5, roughness: 0.45 }),
      );
      plinth.position.y = 6;
      const keep = new THREE.Mesh(
        new THREE.CylinderGeometry(8, 15, 46, 6),
        new THREE.MeshStandardMaterial({ color: 0x35456b, metalness: 0.5, roughness: 0.45 }),
      );
      keep.position.y = 35;
      const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 22, 6),
        new THREE.MeshStandardMaterial({ color: 0x46578a, metalness: 0.6, roughness: 0.35 }),
      );
      antenna.position.y = 68;
      const beaconMat = new THREE.MeshStandardMaterial({
        color: 0x0b1020,
        emissive: new THREE.Color(0x3df08c),
        emissiveIntensity: 2,
      });
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8), beaconMat);
      beacon.position.y = 58;
      const shieldMat = new THREE.MeshBasicMaterial({
        color: 0x3df08c,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const shield = new THREE.Mesh(new THREE.SphereGeometry(46, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), shieldMat);
      g.add(plinth, keep, antenna, beacon, shield);
      const light = new THREE.PointLight(0x3df08c, 800, 360, 1.6);
      light.position.y = 70;
      g.add(light);
      this.scene.add(g);
      this.bases.push({ shieldMat, beaconMat, light });
    }
  }

  /** 放置模式可建格微光高亮（静态预建，按帧切 visible） */
  private buildHighlights() {
    const { isBuildable } = this.engine.map;
    const geo = new THREE.PlaneGeometry(CELL - 6, CELL - 6);
    geo.rotateX(-Math.PI / 2);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!isBuildable(col, row)) continue;
        const mesh = new THREE.Mesh(geo, this.buildMat);
        mesh.position.set((col + 0.5) * CELL, 0.4, (row + 0.5) * CELL);
        mesh.visible = false;
        this.scene.add(mesh);
        this.buildCells.push({ mesh, col, row });
      }
    }
  }

  /** 虚线射程圆（半径变化时重建几何体，属低频事件） */
  private makeCircleLine(r: number): THREE.LineLoop {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const line = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: 0x22e0ff, dashSize: 8, gapSize: 8, transparent: true }),
    );
    line.computeLineDistances();
    return line;
  }

  private prune<T>(map: Map<number, T>, alive: Set<number>, dispose: (v: T) => void) {
    for (const [id, v] of map) {
      if (!alive.has(id)) {
        dispose(v);
        map.delete(id);
      }
    }
  }

  /** pointer 坐标 → 格子（射线与地面 Y=0 求交） */
  cellFromPointer(clientX: number, clientY: number): { col: number; row: number } {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { col: -1, row: -1 };
    this.ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const ray = this.raycaster.ray;
    const t = -ray.origin.y / ray.direction.y;
    if (!Number.isFinite(t) || t <= 0) return { col: -1, row: -1 };
    const x = ray.origin.x + ray.direction.x * t;
    const z = ray.origin.z + ray.direction.z * t;
    return { col: Math.floor(x / CELL), row: Math.floor(z / CELL) };
  }

  /** 每帧：同步状态 → 场景并渲染 */
  frame() {
    const s = this.engine.state;
    const time = s.clock;
    const { placing, selectedId, hoverCell } = this.overlay;
    const { posAt, isBuildable } = this.engine.map;
    const alive = new Set<number>();

    // 屏幕震动（相机随机偏移）
    const m = s.shake * 6;
    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * m,
      this.camPos.y + (Math.random() - 0.5) * m,
      this.camPos.z + (Math.random() - 0.5) * m,
    );
    this.camera.lookAt(this.camTarget);

    this.starGroup.rotation.y = time * 0.01;
    for (const pm of this.pathMats) pm.map!.offset.x = -time * 1.2;

    // 放置模式：合法格高亮 + hover 预览射程
    this.buildMat.opacity = 0.05 + 0.04 * Math.sin(time * 5);
    for (const c of this.buildCells) {
      c.mesh.visible = !!placing && !s.towers.some((t) => t.col === c.col && t.row === c.row);
    }
    const pl = placing;
    const hc = hoverCell;
    const hoverOk = pl !== null && hc !== null && isBuildable(hc.col, hc.row);
    this.hoverMark.visible = hoverOk;
    this.hoverRange.visible = hoverOk;
    if (hoverOk) {
      const cx = (hc.col + 0.5) * CELL;
      const cz = (hc.row + 0.5) * CELL;
      this.hoverMark.position.set(cx, 0.6, cz);
      const range = TOWERS[pl].levels[0].range * CELL;
      this.hoverRange.position.set(cx, 0.7, cz);
      this.hoverRange.scale.set(range, 1, range);
    }

    // 选中塔射程圈
    const sel = selectedId !== null ? s.towers.find((t) => t.id === selectedId) : undefined;
    this.selRange.visible = !!sel;
    if (sel) {
      const range = TOWERS[sel.type].levels[sel.level].range * CELL;
      this.selRange.position.set((sel.col + 0.5) * CELL, 0.7, (sel.row + 0.5) * CELL);
      if (Math.abs(range - this.selRadius) > 1) {
        this.selRadius = range;
        if (this.selLine) {
          this.selRange.remove(this.selLine);
          this.selLine.geometry.dispose();
          (this.selLine.material as THREE.Material).dispose();
        }
        this.selLine = this.makeCircleLine(range);
        this.selRange.add(this.selLine);
      }
      this.selDisc.scale.set(range, 1, range);
    }

    // 基地护罩颜色随整体生命比例
    const lifeRatio = s.maxLives > 0 ? s.lives / s.maxLives : 0;
    const baseColor = lifeRatio > 0.5 ? 0x3df08c : lifeRatio > 0.25 ? 0xffc94d : 0xff5a5a;
    for (const b of this.bases) {
      b.shieldMat.color.set(baseColor);
      b.shieldMat.opacity = 0.13 + 0.06 * Math.sin(time * 3);
      b.beaconMat.emissive.set(baseColor);
      b.light.color.set(baseColor);
    }

    // 塔（type/level 变化时低频重建模型）
    for (const t of s.towers) {
      alive.add(t.id);
      let e = this.towers.get(t.id);
      if (!e || e.type !== t.type || e.level !== t.level) {
        if (e) {
          this.scene.remove(e.model.group);
          e.model.dispose();
        }
        e = { model: createTowerModel(t.type, t.level), type: t.type, level: t.level };
        this.towers.set(t.id, e);
        this.scene.add(e.model.group);
      }
      e.model.update(t, time);
    }
    this.prune(this.towers, alive, (e) => {
      this.scene.remove(e.model.group);
      e.model.dispose();
    });

    // 敌人
    alive.clear();
    const camQuat = this.camera.quaternion;
    for (const e of s.enemies) {
      alive.add(e.id);
      let en = this.enemies.get(e.id);
      if (!en || en.type !== e.type) {
        if (en) {
          this.scene.remove(en.sprite.group);
          en.sprite.dispose();
        }
        en = { sprite: createEnemySprite(e.type), type: e.type };
        this.enemies.set(e.id, en);
        this.scene.add(en.sprite.group);
      }
      en.sprite.update(e, s, posAt(e.path, e.dist), camQuat);
    }
    this.prune(this.enemies, alive, (en) => {
      this.scene.remove(en.sprite.group);
      en.sprite.dispose();
    });

    // 弹丸（自发光小球）
    alive.clear();
    for (const p of s.projectiles) {
      alive.add(p.id);
      let mesh = this.shots.get(p.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.geoShot, p.kind === 'plasma' ? this.matPlasma : this.matMissile);
        mesh.scale.setScalar(p.kind === 'plasma' ? 7 : 4);
        this.shots.set(p.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(p.x, 8, p.y);
    }
    this.prune(this.shots, alive, (mesh) => this.scene.remove(mesh));

    // 光束（加色发光圆柱 + 命中点光斑）
    alive.clear();
    for (const b of s.beams) {
      alive.add(b.id);
      let e = this.beams.get(b.id);
      if (!e) {
        const mat = new THREE.MeshBasicMaterial({
          color: b.color,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const glowMat = mat.clone();
        e = {
          line: new THREE.Mesh(this.geoBeam, mat),
          glow: new THREE.Mesh(this.geoGlow, glowMat),
          mat,
          glowMat,
        };
        this.beams.set(b.id, e);
        this.scene.add(e.line, e.glow);
      }
      const a = Math.max(0, b.ttl / b.maxTtl);
      this.tmpA.set(b.x1, 14, b.y1);
      this.tmpB.set(b.x2, 6, b.y2);
      this.tmpDir.subVectors(this.tmpB, this.tmpA);
      const len = this.tmpDir.length() || 1;
      e.line.position.copy(this.tmpA).addScaledVector(this.tmpDir, 0.5);
      e.line.quaternion.setFromUnitVectors(UP, this.tmpDir.normalize());
      const w = b.width * (0.5 + a * 0.5) * 0.5;
      e.line.scale.set(w, len, w);
      e.mat.opacity = a;
      e.glow.position.copy(this.tmpB);
      e.glow.scale.setScalar((8 + b.width * 1.5) * 0.35);
      e.glowMat.opacity = a * 0.9;
    }
    this.prune(this.beams, alive, (e) => {
      this.scene.remove(e.line, e.glow);
      e.mat.dispose();
      e.glowMat.dispose();
    });

    // 冲击波环（ease-out 扩张，渐隐）
    alive.clear();
    for (const r of s.rings) {
      alive.add(r.id);
      let e = this.rings.get(r.id);
      if (!e) {
        const mat = new THREE.MeshBasicMaterial({
          color: r.color,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        e = { mesh: new THREE.Mesh(this.geoRing, mat), mat };
        e.mesh.position.y = 1.5;
        this.rings.set(r.id, e);
        this.scene.add(e.mesh);
      }
      const life = Math.max(0, r.ttl / r.maxTtl);
      const k = 1 - life;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
      e.mesh.position.x = r.x;
      e.mesh.position.z = r.y;
      e.mesh.scale.set(Math.max(rad, 0.001), 1, Math.max(rad, 0.001));
      e.mat.opacity = life * 0.85;
    }
    this.prune(this.rings, alive, (e) => {
      this.scene.remove(e.mesh);
      e.mat.dispose();
    });

    // 等离子灼烧区（地面圆盘 + 脉动边缘）
    alive.clear();
    for (const z of s.zones) {
      alive.add(z.id);
      let e = this.zones.get(z.id);
      if (!e) {
        const discMat = new THREE.MeshBasicMaterial({
          color: 0xff6b3d,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const edgeMat = new THREE.MeshBasicMaterial({
          color: 0xff8c3c,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        e = {
          disc: new THREE.Mesh(this.geoDisc, discMat),
          edge: new THREE.Mesh(this.geoRing, edgeMat),
          discMat,
          edgeMat,
        };
        this.zones.set(z.id, e);
        this.scene.add(e.disc, e.edge);
      }
      const life = Math.max(0, z.ttl / z.maxTtl);
      e.disc.position.set(z.x, 0.8, z.y);
      e.disc.scale.set(z.r, 1, z.r);
      e.discMat.opacity = 0.14 * life + 0.04;
      const er = z.r * (0.96 + 0.04 * Math.sin(time * 5 + z.id));
      e.edge.position.set(z.x, 1.2, z.y);
      e.edge.scale.set(er, 1, er);
      e.edgeMat.opacity = 0.55 * life;
    }
    this.prune(this.zones, alive, (e) => {
      this.scene.remove(e.disc, e.edge);
      e.discMat.dispose();
      e.edgeMat.dispose();
    });

    // 浮字（canvas 纹理 Sprite，上升渐隐）
    alive.clear();
    for (const f of s.floaters) {
      alive.add(f.id);
      let e = this.floaters.get(f.id);
      if (!e) {
        const { tex, w, h } = textTexture(f.text, f.color);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
        e = { sprite: new THREE.Sprite(mat), mat };
        e.sprite.scale.set(w / 2, h / 2, 1);
        this.floaters.set(f.id, e);
        this.scene.add(e.sprite);
      }
      const a = Math.max(0, f.ttl / f.maxTtl);
      e.sprite.position.set(f.x, 26 + (1 - a) * 40, f.y);
      e.mat.opacity = a;
    }
    this.prune(this.floaters, alive, (e) => {
      this.scene.remove(e.sprite);
      e.mat.map?.dispose();
      e.mat.dispose();
    });

    // 粒子（写入预分配缓冲，颜色乘 alpha 实现加色渐隐）
    const n = Math.min(s.particles.length, this.particleCap);
    for (let i = 0; i < n; i++) {
      const pt = s.particles[i];
      const a = pt.ttl / pt.maxTtl;
      this.particlePos[i * 3] = pt.x;
      this.particlePos[i * 3 + 1] = 6;
      this.particlePos[i * 3 + 2] = pt.y;
      this.tmpColor.set(pt.color).multiplyScalar(a);
      this.particleCol[i * 3] = this.tmpColor.r;
      this.particleCol[i * 3 + 1] = this.tmpColor.g;
      this.particleCol[i * 3 + 2] = this.tmpColor.b;
    }
    this.particleGeo.setDrawRange(0, n);
    this.particleGeo.attributes.position.needsUpdate = true;
    this.particleGeo.attributes.color.needsUpdate = true;

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    for (const e of this.towers.values()) e.model.dispose();
    for (const e of this.enemies.values()) e.sprite.dispose();
    for (const e of this.floaters.values()) {
      e.mat.map?.dispose();
      e.mat.dispose();
    }
    // 几何体/材质统一回收；shared 纹理（敌人立绘/破甲角标）跨局复用不销毁
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as (THREE.Material & { map?: THREE.Texture | null }) | THREE.Material[] | undefined;
      const disposeMat = (m: THREE.Material & { map?: THREE.Texture | null }) => {
        if (m.map && !m.map.userData.shared) m.map.dispose();
        m.dispose();
      };
      if (Array.isArray(mat)) mat.forEach(disposeMat);
      else if (mat) disposeMat(mat);
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
