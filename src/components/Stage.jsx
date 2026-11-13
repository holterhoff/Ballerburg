import { useEffect, useRef } from 'react';
import { W, H, RES } from '../game/constants.js';
import { createRenderer, drawScene } from '../game/render.js';

/** Canvas that runs the game loop and turns pointer input into world coordinates. */
export default function Stage({ game, aim, onPick }) {
  const lastPaint = useRef(null);
  /** A finger on the field: picked only when it lifts without moving, so pinching and panning stay free. */
  const touch = useRef(null);
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

  /** How far a pick may miss, in world pixels: about 4 px for a mouse, about 22 screen px for a finger. */
  const tolerance = (e) => {
    const scale = W / ref.current.getBoundingClientRect().width;
    return e.pointerType === 'mouse' ? 4 : Math.max(4, 22 * scale);
  };

  const toWorld = (e) => {
    const rect = ref.current.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };

  return (
    <canvas
      ref={ref}
      width={W * RES}
      height={H * RES}
      className={`stage-canvas${game?.building ? ' building' : ''}`}
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
        if (e.pointerType !== 'mouse' && !building) {
          touch.current = { id: e.pointerId, x: e.clientX, y: e.clientY, p, tol: tolerance(e) };
          return;
        }
        onPick(p, e.button === 2, tolerance(e));
        if (building) {
          lastPaint.current = p;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }}
      onPointerUp={(e) => {
        lastPaint.current = null;
        const t = touch.current;
        touch.current = null;
        if (t && t.id === e.pointerId && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 12) onPick(t.p, false, t.tol);
      }}
      onPointerCancel={() => { lastPaint.current = null; touch.current = null; }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
