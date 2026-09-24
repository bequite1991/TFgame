// WebGL 3D 渲染层 —— Props 与 GameCanvas 完全一致，Raycaster 与地面求交换算格子
import { useEffect, useRef } from 'react';
import { W, H } from '../config';
import type { GameEngine, TowerType } from '../types';
import { Scene3D } from './scene3d';

interface Props {
  engine: GameEngine;
  placing: TowerType | null;
  selectedId: number | null;
  onCellClick: (col: number, row: number) => void;
  onHoverCell?: (col: number, row: number) => void;
  hoverCell: { col: number; row: number } | null;
  /** WebGL 初始化失败时回调，由父组件回退 2D */
  onWebGLFail?: () => void;
}

export default function GameCanvas3D({
  engine,
  placing,
  selectedId,
  onCellClick,
  onHoverCell,
  hoverCell,
  onWebGLFail,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene3D | null>(null);
  // 最新 props 供 rAF 闭包读取
  const live = useRef({ placing, selectedId, hoverCell });
  const failRef = useRef(onWebGLFail);
  useEffect(() => {
    live.current = { placing, selectedId, hoverCell };
    failRef.current = onWebGLFail;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let s3d: Scene3D;
    try {
      s3d = new Scene3D(canvas, engine);
    } catch {
      // WebGL 不可用：通知父组件回退 2D
      failRef.current?.();
      return;
    }
    sceneRef.current = s3d;
    let raf = 0;
    const loop = () => {
      const { placing: pl, selectedId: sel, hoverCell: hc } = live.current;
      s3d.overlay = { placing: pl, selectedId: sel, hoverCell: hc };
      s3d.frame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      s3d.dispose();
      sceneRef.current = null;
    };
  }, [engine]);

  const toCell = (e: React.PointerEvent<HTMLCanvasElement>) =>
    sceneRef.current?.cellFromPointer(e.clientX, e.clientY) ?? { col: -1, row: -1 };

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
