import { useEffect, useRef } from 'react';
import { W, H, RES } from '../game/constants.js';
import { createRenderer, drawScene } from '../game/render.js';

/** Canvas that runs the game loop and turns pointer input into world coordinates. */
export default function Stage({ game, aim, onPick }) {
  const lastPaint = useRef(null);
  const ref = useRef(null);
  const hover = useRef(null);
  const aimRef = useRef(aim);
  aimRef.current = aim;

  useEffect(() => {
    if (!game) return undefined;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const r = createRenderer();
    let last = performance.now();
    let raf;
    const loop = (now) => {
      game.update((now - last) / 1000);
      last = now;
      ctx.setTransform(RES, 0, 0, RES, 0, 0);
      ctx.imageSmoothingEnabled = false;
      drawScene(ctx, game, r, { hover: hover.current, time: now / 1000, aim: aimRef.current });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  const toWorld = (e) => {
    const rect = ref.current.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };

  return (
    <canvas
      ref={ref}
      width={W * RES}
      height={H * RES}
      className="stage-canvas"
      aria-label="Spielfeld: zwei Burgen links und rechts eines Berges"
      role="img"
      onPointerMove={(e) => {
        const p = toWorld(e);
        hover.current = p;
        // painting stones: drag with the button held down
        if (lastPaint.current && game?.building && e.buttons & 1) {
          game.paintLine(lastPaint.current, p);
          lastPaint.current = p;
        }
      }}
      onPointerLeave={() => (hover.current = null)}
      onPointerDown={(e) => {
        const p = toWorld(e);
        hover.current = p;
        const building = !!game?.building && e.button === 0;
        onPick(p, e.button === 2);
        if (building) {
          lastPaint.current = p;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }}
      onPointerUp={() => (lastPaint.current = null)}
      onPointerCancel={() => (lastPaint.current = null)}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
