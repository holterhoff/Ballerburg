/*
 * Schlachtfeld-Erzeugung.
 * "klassisch" ist eine Portierung von bild() aus baller2.c (Ballerburg, (C) 1987, 1989 Eckhard Kruse,
 * (C) 2010-2015 Thomas Huth, GNU GPL v3). Die übrigen Bergformen sind Erweiterungen von Burgfehde.
 */
import { W, H } from './constants.js';

export const TERRAINS = [
  { key: 'klassisch', label: 'Klassisch', original: true },
  { key: 'zufall', label: 'Zufall (alle Formen)' },
  { key: 'spitze', label: 'Spitzberg' },
  { key: 'doppel', label: 'Doppelgipfel' },
  { key: 'tafel', label: 'Tafelberg' },
  { key: 'kamm', label: 'Schiefer Kamm' },
  { key: 'huegel', label: 'Hügelland' },
  { key: 'riese', label: 'Himmelsriese' },
];

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (n) => Math.floor(Math.random() * n);
const smooth = (f) => f * f * (3 - 2 * f);

/** Original: by[n] = (rand()%80 + 300) & ~3 — each castle stands on its own ground level. */
function castleGround() {
  return (randInt(80) + 300) & ~3;
}

/**
 * Original bild(): the mountain is filled row by row from the bottom of the screen upward.
 * Left and right flank start at the castle edges once their ground level is reached and move
 * inward by a slope (in quarter pixels) that changes by -2..+2 every row, limited to 0..7.
 * The loop stops when the flanks meet or the row reaches y = 20.
 */
function classicMountain(h, by, widths) {
  let x1 = 0;
  let x2 = 2556;
  let v1 = 2;
  let v2 = 2;
  let y = 400;
  while (x1 < x2 && --y > 20) {
    for (let x = Math.max(0, Math.floor(x1 / 4)); x <= Math.min(W - 1, Math.floor(x2 / 4)); x++) h[x] = Math.min(h[x], y);
    if (y === by[0]) x1 = widths[0] * 4;
    if (y === by[1]) x2 = (639 - widths[1]) << 2;
    if (x1) {
      v1 = Math.min(7, Math.max(0, v1 + randInt(5) - 2));
      x1 += v1;
    }
    if (x2 < 2556) {
      v2 = Math.min(7, Math.max(0, v2 + randInt(5) - 2));
      x2 -= v2;
    }
  }
  // Burgfehde: stretch the mountain upward by a random factor 1.0..1.8, measured from the higher
  // castle ground. The flank shape stays the original one, the peak ends up anywhere from
  // the original height to near the top edge.
  const ref = Math.min(by[0], by[1]);
  const stretch = 1 + Math.random() * 0.8;
  for (let x = 0; x < W; x++) if (h[x] < ref) h[x] = Math.max(8, ref - (ref - h[x]) * stretch);
}

function peakAt(x, l, cx, r) {
  if (x <= l || x >= r) return 0;
  const f = x < cx ? (x - l) / (cx - l) : (r - x) / (r - cx);
  return 0.55 * f + 0.45 * smooth(f);
}

/** Burgfehde extension: alternative mountain shapes. */
function shapeFn(kind, l, r) {
  const mid = (l + r) / 2;
  switch (kind) {
    case 'doppel': {
      const c1 = rand(l + 50, mid - 25), c2 = rand(mid + 25, r - 50), h2 = rand(0.65, 1);
      return { height: rand(160, 250), f: (x) => Math.max(peakAt(x, l, c1, mid + 40), h2 * peakAt(x, mid - 40, c2, r)) };
    }
    case 'tafel': {
      const top = rand(0.85, 1), a = rand(l + 45, mid - 30), b = rand(mid + 30, r - 45);
      return { height: rand(120, 210), f: (x) => (x <= l || x >= r ? 0 : x < a ? smooth((x - l) / (a - l)) * top : x > b ? smooth((r - x) / (r - b)) * top : top) };
    }
    case 'kamm': {
      const cx = Math.random() < 0.5 ? rand(l + 30, l + 70) : rand(r - 70, r - 30);
      return { height: rand(170, 270), f: (x) => peakAt(x, l, cx, r) };
    }
    case 'huegel': {
      const bumps = Array.from({ length: 3 + randInt(2) }, () => ({ c: rand(l + 30, r - 30), w: rand(35, 70), h: rand(0.4, 1) }));
      return { height: rand(60, 120), f: (x) => (x <= l || x >= r ? 0 : Math.min(1.2, bumps.reduce((s, b) => s + b.h * Math.max(0, 1 - Math.abs(x - b.c) / b.w) ** 1.5, 0))) };
    }
    case 'riese':
      return { height: rand(360, 420), f: (x) => peakAt(x, l, mid + rand(-15, 15), r) };
    default: {
      const cx = mid + rand(-30, 30);
      return { height: 130 + Math.pow(Math.random(), 0.8) * 230, f: (x) => peakAt(x, l, cx, r) };
    }
  }
}

/**
 * A battlefield: surface height per column (smaller is higher, values below 0 rise past the top edge)
 * and the ground level each castle stands on.
 * @param {string} kind terrain key from TERRAINS
 * @param {number[]} widths width of the left and right castle (original: bg[0])
 */
export function generateTerrain(kind = 'klassisch', widths = [136, 136]) {
  if (kind === 'zufall') {
    const pool = TERRAINS.filter((t) => t.key !== 'zufall');
    kind = pool[randInt(pool.length)].key;
  }
  const by = [castleGround(), castleGround()];
  const h = new Float32Array(W).fill(H);
  if (kind === 'klassisch') {
    classicMountain(h, by, widths);
    return { heights: h, baseY: by, kind };
  }
  const l = widths[0] + rand(4, 24);
  const r = W - widths[1] - rand(4, 24);
  const s = shapeFn(kind, l, r);
  const waves = [
    { a: 7, f: rand(0.045, 0.065), p: rand(0, 6.28) },
    { a: 3.5, f: rand(0.11, 0.15), p: rand(0, 6.28) },
    { a: 1.6, f: rand(0.31, 0.41), p: rand(0, 6.28) },
  ];
  for (let x = 0; x < W; x++) {
    const t = Math.max(0, Math.min(1, (x - l) / (r - l)));
    const base = x <= l ? by[0] : x >= r ? by[1] : by[0] + (by[1] - by[0]) * smooth(t);
    const f = s.f(x);
    let noise = 0;
    if (f > 0) for (const w of waves) noise += w.a * Math.sin(x * w.f + w.p);
    h[x] = Math.min(base, base - s.height * f + noise * Math.min(1, f * 4));
  }
  return { heights: h, baseY: by, kind };
}
