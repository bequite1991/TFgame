// 程序化 3D 炮塔 —— 6 型 × 3 级，Group{ 静态底座 + 可旋转炮头 }，炮口朝向 +Z
import * as THREE from 'three';
import { CELL, TOWERS } from '../config';
import type { TowerState, TowerType } from '../types';

export interface TowerModel {
  group: THREE.Group;
  update(t: TowerState, time: number): void;
  dispose(): void;
}

const metal = (color = 0x2a3450) =>
  new THREE.MeshStandardMaterial({
    color,
    metalness: 0.5,
    roughness: 0.45,
    // 自发光兜底：远距离/背光面也不会黑成一片
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.35,
  });
const glow = (color: string, intensity = 2.4) =>
  new THREE.MeshStandardMaterial({
    color: 0x141c33,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.5,
  });

interface HeadRefs {
  slide: THREE.Group; // 后坐滑动件（炮管等）
  flash: THREE.Mesh; // 枪口闪光
  spinners: THREE.Object3D[]; // 持续自旋件（水晶/线圈）
  chargeRing: THREE.Mesh | null; // 电磁炮蓄能光环
}

/** 圆柱炮管，轴向转到 +Z */
function barrel(r: number, len: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
  m.rotation.x = Math.PI / 2;
  return m;
}

function buildHead(type: TowerType, level: number, color: string, head: THREE.Group): HeadRefs {
  const slide = new THREE.Group();
  head.add(slide);
  const spinners: THREE.Object3D[] = [];
  const dark = metal(0x35456b);
  const g = glow(color);
  let muzzleZ = 26;
  let muzzleY = 3;

  switch (type) {
    case 'laser': {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 11, 8), dark);
      slide.add(body);
      const offsets = level >= 1 ? [-4, 4] : [0]; // Lv2 双管
      for (const ox of offsets) {
        const b = barrel(3.2, 26, metal(0x46578a));
        b.position.set(ox, 4, 14);
        slide.add(b);
        const lens = new THREE.Mesh(new THREE.SphereGeometry(4.2, 10, 8), g);
        lens.position.set(ox, 4, 28);
        slide.add(lens);
      }
      muzzleY = 4;
      muzzleZ = 30;
      break;
    }
    case 'missile': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(20, 13, 18), dark);
      box.position.y = 3;
      slide.add(box);
      const cols = level >= 1 ? 3 : 2; // Lv2 六联装
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < 2; j++) {
          const ox = (i - (cols - 1) / 2) * 6;
          const oy = 3 + j * 6;
          const tube = barrel(3, 14, metal(0x46578a));
          tube.position.set(ox, oy, 7);
          slide.add(tube);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), g);
          tip.position.set(ox, oy, 14);
          slide.add(tip);
        }
      }
      muzzleY = 6;
      muzzleZ = 17;
      break;
    }
    case 'frost': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 5.5, 15, 8), dark);
      pole.position.y = 5;
      slide.add(pole);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(11), g);
      crystal.position.y = 19;
      slide.add(crystal);
      spinners.push(crystal);
      if (level >= 1) {
        for (const s of [-1, 1]) {
          const sat = new THREE.Mesh(new THREE.OctahedronGeometry(4.5), g);
          sat.position.set(s * 13, 14, 0);
          slide.add(sat);
          spinners.push(sat);
        }
      }
      muzzleY = 19;
      muzzleZ = 7;
      break;
    }
    case 'railgun': {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 32), dark);
      bed.position.set(0, 2, 12);
      slide.add(bed);
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 34), metal(0x46578a));
        rail.position.set(s * 5, 7, 13);
        slide.add(rail);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 34), g);
        strip.position.set(s * 5, 9.5, 13);
        slide.add(strip);
      }
      muzzleY = 8;
      muzzleZ = 31;
      break;
    }
    case 'tesla': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(3, 6, 16, 8), dark);
      pole.position.y = 6;
      slide.add(pole);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(8.5, 14, 10), g);
      orb.position.y = 19;
      slide.add(orb);
      const rings = level >= 1 ? 2 : 1;
      for (let i = 0; i < rings; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(11.5 + i * 3.5, 1.3, 6, 24), metal(0x46578a));
        ring.position.y = 19;
        ring.rotation.x = Math.PI / 2 + i * 0.6;
        slide.add(ring);
        spinners.push(ring);
      }
      muzzleY = 19;
      muzzleZ = 9;
      break;
    }
    case 'plasma': {
      const count = level >= 1 ? 2 : 1; // Lv2 双联
      for (let i = 0; i < count; i++) {
        const ox = count === 1 ? 0 : (i - 0.5) * 12;
        const b = barrel(6.5, 20, dark);
        b.position.set(ox, 4, 10);
        slide.add(b);
        const core = new THREE.Mesh(new THREE.SphereGeometry(4.4, 10, 8), g);
        core.position.set(ox, 4, 20);
        slide.add(core);
      }
      muzzleY = 4;
      muzzleZ = 23;
      break;
    }
  }

  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(5, 10, 8),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flash.position.set(0, muzzleY, muzzleZ);
  flash.visible = false;
  slide.add(flash);

  let chargeRing: THREE.Mesh | null = null;
  if (type === 'railgun') {
    chargeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 40),
      new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    chargeRing.geometry.rotateX(-Math.PI / 2);
    chargeRing.position.y = 2;
    chargeRing.visible = false;
    head.add(chargeRing);
  }
  return { slide, flash, spinners, chargeRing };
}

export function createTowerModel(type: TowerType, level: number): TowerModel {
  const def = TOWERS[type];
  const group = new THREE.Group();
  const r = CELL * 0.43; // 底座半径（对应 2D 的 CELL*0.86 占地）

  // 六棱柱金属底座 + 代表色发光腰线与描边环（远距离也能辨认塔色）
  const baseH = 14;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, baseH, 6), metal());
  base.position.y = baseH / 2;
  group.add(base);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.92, 3, 6), glow(def.color, 2));
  band.position.y = baseH * 0.55;
  group.add(band);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.92, 1.8, 8, 6), glow(def.color));
  trim.rotation.x = Math.PI / 2;
  trim.position.y = baseH + 0.5;
  group.add(trim);

  // Lv2+ 三面装甲板
  if (level >= 1) {
    for (let i = 0; i < 3; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(r * 0.8, baseH * 0.9, 3), metal(0x35456b));
      const a = (i / 3) * Math.PI * 2;
      plate.position.set(Math.cos(a) * r * 1.02, baseH * 0.55, Math.sin(a) * r * 1.02);
      plate.rotation.y = -a + Math.PI / 2;
      group.add(plate);
    }
  }

  // Lv3 金色光环
  let halo: THREE.Mesh | null = null;
  if (level >= 2) {
    halo = new THREE.Mesh(new THREE.TorusGeometry(r * 1.15, 1.8, 8, 48), glow('#FFC94D', 2.6));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 3;
    group.add(halo);
  }

  const head = new THREE.Group();
  head.position.y = baseH + 7;
  group.add(head);
  const refs = buildHead(type, level, def.color, head);

  return {
    group,
    update(t, time) {
      const cx = (t.col + 0.5) * CELL;
      const cz = (t.row + 0.5) * CELL;
      group.position.set(cx, 0, cz);
      // 炮头朝瞄准方向平滑旋转（最短弧插值）
      const target = Math.atan2(t.aimX - cx, t.aimY - cz);
      let d = target - head.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      head.rotation.y += d * 0.25;
      // 开火后坐 + 枪口闪光（0.15s）
      const ft = time - t.lastFireAt;
      const recoil = ft >= 0 && ft < 0.15 ? 1 - ft / 0.15 : 0;
      refs.slide.position.z = -recoil * 5;
      refs.flash.visible = recoil > 0;
      if (recoil > 0) {
        refs.flash.scale.setScalar(0.5 + recoil * 1.2);
        (refs.flash.material as THREE.MeshBasicMaterial).opacity = recoil;
      }
      for (const sp of refs.spinners) sp.rotation.y = time * 1.6;
      if (halo) halo.rotation.z = time * 0.8;
      // 电磁炮蓄能光环：随充能进度扩大增亮
      if (refs.chargeRing) {
        refs.chargeRing.visible = t.charging;
        if (t.charging) {
          const charge = 1 - t.chargeT / (TOWERS.railgun.charge ?? 1.2);
          const rad = 10 + charge * 16;
          refs.chargeRing.scale.set(rad, 1, rad);
          (refs.chargeRing.material as THREE.MeshBasicMaterial).opacity = 0.3 + charge * 0.6;
        }
      }
    },
    dispose() {
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
      });
    },
  };
}
