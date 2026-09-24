// 敌人公告板 —— Sprite 立绘 + HP 条 + 状态染色/隐身/受击闪光
import * as THREE from 'three';
import { ENEMIES } from '../config';
import type { EnemyState, EnemyType, GameState } from '../types';

// 立绘纹理全局缓存（跨局复用，标记 shared 避免场景 dispose 时销毁）
const texCache = new Map<EnemyType, THREE.Texture>();
function enemyTexture(type: EnemyType): THREE.Texture {
  let tex = texCache.get(type);
  if (!tex) {
    tex = new THREE.TextureLoader().load(`/enemy-${type}.png`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.userData.shared = true;
    texCache.set(type, tex);
  }
  return tex;
}

// 「破甲」角标纹理（全敌人共享）
let vulnTex: THREE.Texture | null = null;
function vulnTexture(): THREE.Texture {
  if (!vulnTex) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.font = '700 28px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#8B5CF6';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#8B5CF6';
    ctx.fillText('破甲', 64, 24);
    vulnTex = new THREE.CanvasTexture(c);
    vulnTex.userData.shared = true;
  }
  return vulnTex;
}

export interface EnemySprite {
  group: THREE.Group;
  update(e: EnemyState, s: GameState, p: { x: number; y: number }, camQuat: THREE.Quaternion): void;
  dispose(): void;
}

export function createEnemySprite(type: EnemyType): EnemySprite {
  const def = ENEMIES[type];
  const group = new THREE.Group();
  const h = def.size * 2.2;

  // 立绘（底部对齐，贴地站立）
  const map = enemyTexture(type);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(h, h, 1);
  sprite.center.set(0.5, 0);
  group.add(sprite);

  // 受击白色闪光（同图加色叠加层，0.08s）
  const flash = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map,
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flash.scale.copy(sprite.scale);
  flash.center.set(0.5, 0);
  flash.visible = false;
  group.add(flash);

  // HP 条（底 + 前景，面向相机、穿透显示；BOSS 加宽）
  const bw = def.category === 'boss' ? 64 : 40;
  const bar = new THREE.Group();
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(bw, 4),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.55,
      depthTest: false,
      depthWrite: false,
    }),
  );
  bg.renderOrder = 90;
  const fgGeo = new THREE.PlaneGeometry(bw, 4);
  fgGeo.translate(bw / 2, 0, 0); // 左端为原点，scale.x 即血量比例
  const fg = new THREE.Mesh(
    fgGeo,
    new THREE.MeshBasicMaterial({ color: 0x3df08c, transparent: true, depthTest: false, depthWrite: false }),
  );
  fg.position.set(-bw / 2, 0, 0.1);
  fg.renderOrder = 91;
  bar.add(bg, fg);
  bar.position.y = h + 10;
  group.add(bar);

  // 破甲角标
  const vuln = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: vulnTexture(), transparent: true, depthTest: false, depthWrite: false }),
  );
  vuln.scale.set(36, 13.5, 1);
  vuln.position.y = h + 24;
  vuln.renderOrder = 92;
  vuln.visible = false;
  group.add(vuln);

  const spriteMat = sprite.material;
  const flashMat = flash.material;
  const fgMat = fg.material as THREE.MeshBasicMaterial;

  return {
    group,
    update(e, s, p, camQuat) {
      group.position.set(p.x, 0, p.y);
      // 状态：隐身 / 减速 / 灼烧 / 狂暴染色
      const invisible = type === 'lurker' && e.stealthT % 4 >= 3;
      const slowed = s.clock < e.slowUntil;
      const burning = s.zones.some((z) => Math.hypot(p.x - z.x, p.y - z.y) <= z.r);
      spriteMat.opacity = invisible ? 0.25 : 1;
      spriteMat.color.set(
        e.enraged ? 0xff3d81 : slowed ? 0x8fd8ff : burning ? 0xffb066 : 0xffffff,
      );
      // 悬浮起伏
      sprite.position.y = 2 + Math.sin(s.clock * 3 + e.id) * 2;
      // 受击白色闪光（0.08s）
      const sinceHit = s.clock - e.lastHitAt;
      flash.visible = sinceHit >= 0 && sinceHit < 0.08;
      if (flash.visible) {
        flashMat.opacity = (1 - sinceHit / 0.08) * 0.85;
        flash.position.y = sprite.position.y;
      }
      // HP 条：面向相机，颜色随血量 绿→金→红（BOSS 品红）
      bar.quaternion.copy(camQuat);
      const ratio = Math.max(0, e.hp / e.maxHp);
      fg.scale.x = Math.max(ratio, 0.0001);
      fgMat.color.set(
        e.isBoss ? 0xff3d81 : ratio > 0.5 ? 0x3df08c : ratio > 0.25 ? 0xffc94d : 0xff5a5a,
      );
      vuln.visible = s.clock < e.vulnUntil;
    },
    dispose() {
      // 纹理为全局缓存，仅销毁材质与 HP 条几何体
      spriteMat.dispose();
      flashMat.dispose();
      (bg.material as THREE.Material).dispose();
      bg.geometry.dispose();
      fgMat.dispose();
      fg.geometry.dispose();
      vuln.material.dispose();
    },
  };
}
