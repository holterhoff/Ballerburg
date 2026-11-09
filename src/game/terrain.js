import { W, GROUND } from './constants.js';

/** Mountain shapes. Each game picks one (or the player does) and then randomises it further. */
export const TERRAINS = [
  { key: 'zufall', label: 'Zufall' },
  { key: 'spitze', label: 'Spitzberg' },
  { key: 'doppel', label: 'Doppelgipfel' },
  { key: 'tafel', label: 'Tafelberg' },
  { key: 'kamm', label: 'Schiefer Kamm' },
  { key: 'huegel', label: 'Hügelland' },
  { key: 'riese', label: 'Himmelsriese' },
];

const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (f) => f * f * (3 - 2 * f);

/** Normalised peak profile: 0 at the base, 1 at the top. */
function peakAt(x, l, cx, r) {
  if (x <= l || x >= r) return 0;
  const f = x < cx ? (x - l) / (cx - l) : (r - x) / (r - cx);
  return 0.55 * f + 0.45 * smooth(f);
}

/** Relative height (0..1+) of the mountain at column x for the given shape parameters. */
function shapeFn(kind) {
  const l = rand(140, 170);
  const r = rand(470, 500);
  const mid = (l + r) / 2;
  switch (kind) {
    case 'doppel': {
      const c1 = rand(l + 50, mid - 25);
      const c2 = rand(mid + 25, r - 50);
      const h2 = rand(0.65, 1);
      return { l, r, height: rand(140, 230), f: (x) => Math.max(peakAt(x, l, c1, mid + 40), h2 * peakAt(x, mid - 40, c2, r)) };
    }
    case 'tafel': {
      const top = rand(0.85, 1);
      const a = rand(l + 45, mid - 30);
      const b = rand(mid + 30, r - 45);
      return { l, r, height: rand(110, 190), f: (x) => (x <= l || x >= r ? 0 : x < a ? smooth((x - l) / (a - l)) * top : x > b ? smooth((r - x) / (r - b)) * top : top) };
    }
    case 'kamm': {
      const left = Math.random() < 0.5;
      const cx = left ? rand(l + 30, l + 70) : rand(r - 70, r - 30);
      return { l, r, height: rand(150, 250), f: (x) => peakAt(x, l, cx, r) };
    }
    case 'huegel': {
      const bumps = Array.from({ length: 3 + Math.floor(Math.random() * 2) }, () => ({ c: rand(l + 30, r - 30), w: rand(35, 70), h: rand(0.4, 1) }));
      return { l, r, height: rand(60, 110), f: (x) => (x <= l || x >= r ? 0 : Math.min(1.2, bumps.reduce((s, b) => s + b.h * Math.max(0, 1 - Math.abs(x - b.c) / b.w) ** 1.5, 0))) };
    }
    case 'riese':
      return { l: l - 10, r: r + 10, height: rand(310, 380), f: (x) => peakAt(x, l - 10, mid + rand(-15, 15), r + 10) };
    case 'spitze':
    default: {
      const cx = mid + rand(-30, 30);
      return { l, r, height: 110 + Math.pow(Math.random(), 0.8) * 230, f: (x) => peakAt(x, l, cx, r) };
    }
  }
}

/**
 * Height of the solid surface for every column: flat plateaus for the castles with a mountain in between.
 * Smaller values are higher; values below 0 mean the mountain rises past the top edge.
 */
export function generateHeights(kind = 'zufall') {
  if (kind === 'zufall') {
    const pool = TERRAINS.filter((t) => t.key !== 'zufall');
    kind = pool[Math.floor(Math.random() * pool.length)].key;
  }
  const h = new Float32Array(W).fill(GROUND);
  const s = shapeFn(kind);
  const waves = [
    { a: 7, f: rand(0.045, 0.065), p: rand(0, 6.28) },
    { a: 3.5, f: rand(0.11, 0.15), p: rand(0, 6.28) },
    { a: 1.6, f: rand(0.31, 0.41), p: rand(0, 6.28) },
  ];
  for (let x = Math.floor(s.l); x <= Math.ceil(s.r); x++) {
    const f = s.f(x);
    if (f <= 0) continue;
    let noise = 0;
    for (const w of waves) noise += w.a * Math.sin(x * w.f + w.p);
    h[x] = Math.min(GROUND, GROUND - s.height * f + noise * Math.min(1, f * 4));
  }
  return h;
}
