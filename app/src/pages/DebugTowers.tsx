// 调试页 /debug-towers —— 近距离排布渲染 6 型 × 3 级炮塔，排查 3D 塔模型可见性
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TOWER_LIST } from '@/game/config';
import { createTowerModel } from '@/game/render3d/towerModels';
import type { TowerState } from '@/game/types';

export default function DebugTowers() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070f);
    // 与 scene3d 相同的光照配置
    scene.add(new THREE.AmbientLight(0x8fa8d8, 1.1));
    scene.add(new THREE.HemisphereLight(0x9db8ff, 0x1a2240, 1.4));
    const dir = new THREE.DirectionalLight(0xffffff, 2.5);
    dir.position.set(200, 400, 500);
    scene.add(dir);

    // 地面参照
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 400),
      new THREE.MeshBasicMaterial({ color: 0x101a33 }),
    );
    ground.geometry.rotateX(-Math.PI / 2);
    scene.add(ground);

    // 6 型 × 3 级，每型一列、每级一行
    const models: ReturnType<typeof createTowerModel>[] = [];
    TOWER_LIST.forEach((def, i) => {
      for (let level = 0; level < 3; level++) {
        const m = createTowerModel(def.type, level);
        m.group.position.set(i * 140 - 350, 0, level * 120 - 120);
        scene.add(m.group);
        models.push(m);
      }
    });

    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 1, 5000);
    camera.position.set(0, 420, 560);
    camera.lookAt(0, 0, 0);

    const fake: TowerState = {
      id: 0, type: 'laser', level: 0, col: 0, row: 0, cooldown: 0,
      charging: false, chargeT: 0, aimX: 0, aimY: -60, lastFireAt: -999,
      kills: 0, invested: 0,
    };
    // update 会按 col/row 重设 group.position，因此保存排布位置、每次 update 后恢复
    const positioned = models.map((m) => m.group.position.clone());
    let raf = 0;
    const loop = () => {
      const time = performance.now() / 1000;
      models.forEach((m, i) => {
        m.update({ ...fake, aimX: Math.sin(time) * 60, aimY: -Math.cos(time) * 60 }, time);
        m.group.position.copy(positioned[i]);
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      for (const m of models) m.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-bg-deep text-text">
      <div className="p-2 text-sm text-text-dim">
        调试：6 型 × 3 级炮塔（列 = laser/missile/frost/railgun/tesla/plasma，行 = Lv1/2/3）
      </div>
      <div ref={ref} className="min-h-0 flex-1" />
    </div>
  );
}
