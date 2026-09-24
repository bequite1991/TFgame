// 调试页 /debug-scene —— 真实引擎 + Scene3D 全场景渲染（自动建 6 种塔 + 直接开波）
import { useEffect, useRef } from 'react';
import { createEngine } from '@/game/engine';
import { Scene3D } from '@/game/render3d/scene3d';

export default function DebugScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createEngine('normal', 1);
    engine.state.paused = false;
    engine.state.gold = 99999; // 确保 6 种塔都建得起
    // 自动建造 6 种塔（合法格）
    const types = ['laser', 'missile', 'frost', 'railgun', 'tesla', 'plasma'] as const;
    let i = 0;
    outer: for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 9; col++) {
        if (i >= types.length) break outer;
        if (engine.dispatch({ type: 'BUILD', col, row, tower: types[i] })) i++;
      }
    }
    // 升级第一座塔到 Lv3，验证高等级模型
    const first = engine.state.towers[0];
    if (first) {
      engine.dispatch({ type: 'UPGRADE', id: first.id });
      engine.dispatch({ type: 'UPGRADE', id: first.id });
    }
    engine.dispatch({ type: 'SKIP_PREP' });

    const s3d = new Scene3D(canvas, engine);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      engine.tick(dt);
      engine.drainEvents();
      s3d.frame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      s3d.dispose();
    };
  }, []);

  return (
    <div className="flex h-dvh flex-col items-center bg-bg-deep">
      <div className="p-2 text-sm text-text-dim">调试：Scene3D 全场景（6 塔已建，首座升 Lv3，已开波）</div>
      <canvas ref={canvasRef} className="mx-auto block max-h-full max-w-full" style={{ aspectRatio: '540 / 960' }} />
    </div>
  );
}
