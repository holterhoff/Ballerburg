import { W, H, RES, EARTH, BRICK } from './constants.js';
import { STORE_CELL } from './castles.js';

export const SIDE_COLORS = [
  { main: '#c8553d', dark: '#7d2f22', light: '#f0927a', name: 'Rot' },
  { main: '#3f7cc0', dark: '#21466f', light: '#8ab8ea', name: 'Blau' },
];
const BRICK_COLORS = [
  { a: [196, 160, 108], b: [178, 141, 92], m: [104, 78, 52] },
  { a: [148, 160, 176], b: [128, 141, 159], m: [68, 78, 96] },
];
const ROOF_COLORS = [
  { a: [150, 62, 48], b: [128, 50, 40], m: [72, 30, 26] },
  { a: [70, 86, 120], b: [58, 72, 104], m: [34, 42, 64] },
];

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const canvas = (scale = 1) => {
  const cv = document.createElement('canvas');
  cv.width = W * scale;
  cv.height = H * scale;
  return cv;
};

/** A high-resolution layer: RES device pixels per world pixel, drawn in world coordinates. */
const hiCanvas = () => {
  const cv = canvas(RES);
  const ctx = cv.getContext('2d');
  ctx.setTransform(RES, 0, 0, RES, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return [cv, ctx];
};

export function createRenderer() {
  const [bg, bgctx] = hiCanvas();
  const tc = canvas();
  const tctx = tc.getContext('2d');
  const [world, wctx] = hiCanvas();
  return { bg, bgctx, sky: null, tc, tctx, img: tctx.createImageData(W, H), world, wctx };
}

/**
 * Neufassung: times of day. Each has its own sky, a sun or moon, stars or clouds, the colours
 * of the distant ridges and a light tint laid over castles and terrain.
 */
export const SKIES = {
  morgen: {
    label: 'Morgen',
    grad: [[0, '#4a6aa8'], [0.45, '#a99cc8'], [0.75, '#f3b9a4'], [1, '#ffdca6']],
    stars: 12, sun: { x: 92, y: 236, r: 18, col: '#fff2c8', glow: 'rgba(255, 214, 140, 0.55)' },
    clouds: 4, cloud: 'rgba(255, 226, 214, 0.75)',
    ridges: ['#9a7fa6', '#7a6188'], tint: 'rgba(255, 170, 140, 0.10)',
  },
  tag: {
    label: 'Tag',
    grad: [[0, '#3f7dcb'], [0.55, '#86b9e8'], [1, '#d6ecf8']],
    stars: 0, sun: { x: 468, y: 64, r: 15, col: '#fffbe6', glow: 'rgba(255, 250, 210, 0.6)' },
    clouds: 7, cloud: 'rgba(255, 255, 255, 0.9)',
    ridges: ['#87a6c0', '#6a8aa6'], tint: null,
  },
  abend: {
    label: 'Abend',
    grad: [[0, '#15122a'], [0.42, '#33234a'], [0.72, '#8e4357'], [1, '#e48f5a']],
    stars: 110, moon: true,
    ridges: ['#5a2f52', '#3d2341'], tint: 'rgba(90, 30, 70, 0.10)',
  },
  nacht: {
    label: 'Nacht',
    grad: [[0, '#04050d'], [0.5, '#0c1230'], [1, '#22284e']],
    stars: 260, moon: true,
    ridges: ['#1d2340', '#141a30'], tint: 'rgba(14, 22, 64, 0.42)',
  },
};
export const SKY_KEYS = Object.keys(SKIES);
/** Choices for menus: the four times of day plus a random one per game. */
export const TIME_CHOICES = [...SKY_KEYS.map((k) => [k, SKIES[k].label]), ['zufall', 'Zufall']];

function paintBackground(c, key) {
  const sky = SKIES[key] || SKIES.abend;
  const g = c.createLinearGradient(0, 0, 0, H);
  for (const [at, col] of sky.grad) g.addColorStop(at, col);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < sky.stars; i++) {
    const x = Math.floor(hash(i, 7) * W);
    const y = Math.floor(hash(i, 13) * H * 0.55);
    c.fillStyle = `rgba(255, 244, 220, ${0.25 + 0.6 * (1 - y / (H * 0.55)) * hash(i, 3)})`;
    c.fillRect(x, y, 1, 1);
  }
  if (sky.sun) {
    const { x, y, r, col, glow } = sky.sun;
    const halo = c.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
    halo.addColorStop(0, glow);
    halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
    c.fillStyle = halo;
    c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    c.fillStyle = col;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
  if (sky.moon) {
    c.fillStyle = '#f3e3bd';
    c.beginPath();
    c.arc(548, 54, 15, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#dcc79c';
    [[542, 50, 3], [553, 59, 2], [550, 46, 1.5]].forEach(([x, y, r]) => {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    });
  }
  // pixel clouds: a few overlapping blocks per cloud
  for (let i = 0; i < (sky.clouds || 0); i++) {
    const cx = Math.floor(hash(i, 41) * (W - 80)) + 20, cy = 24 + Math.floor(hash(i, 43) * 120);
    const len = 24 + Math.floor(hash(i, 47) * 40);
    c.fillStyle = sky.cloud;
    c.fillRect(cx, cy, len, 5);
    c.fillRect(cx + 5, cy - 3, len - 12, 3);
    c.fillRect(cx + len * 0.3, cy - 6, len * 0.3, 3);
  }
  const ridge = (base, amp, f, col, seed) => {
    c.fillStyle = col;
    for (let x = 0; x < W; x++) {
      const y = base - amp * (0.6 * Math.sin(x * f + seed) + 0.3 * Math.sin(x * f * 2.7 + seed * 2) + 0.1 * Math.sin(x * f * 7.1));
      c.fillRect(x, Math.round(y), 1, H - Math.round(y));
    }
  };
  ridge(H * 0.66, 26, 0.013, sky.ridges[0], 1.3);
  ridge(H * 0.76, 18, 0.021, sky.ridges[1], 4.1);
}

export function refreshTerrain(r, game) {
  const d = r.img.data;
  const s = game.solid;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const o = i * 4;
      const t = s[i];
      if (!t) {
        const room = game.interior ? game.interior[i] : 0;
        if (!room) {
          d[o + 3] = 0;
          continue;
        }
        // Neufassung: back wall of a hollow room — dim masonry, shadow under the ceiling,
        // a wooden floor and warm torchlight, so chambers blend into the castle.
        const C = BRICK_COLORS[room - 1];
        let R, G, B;
        if (y < H - 1 && s[i + W]) [R, G, B] = (x & 7) === 7 ? [62, 40, 24] : [112, 76, 44];
        else {
          const row = y >> 2;
          const off = (row & 1) * 4;
          const mortar = (y & 3) === 3 || ((x + off) & 7) === 7;
          const base = mortar ? C.m : hash((x + off) >> 3, row) < 0.5 ? C.a : C.b;
          let up = 0;
          while (up < 6 && y - up - 1 >= 0 && !s[i - (up + 1) * W]) up++;
          let k = (mortar ? 0.36 : 0.46) * (0.55 + 0.45 * (up / 6));
          if ((x > 0 && s[i - 1]) || (x < W - 1 && s[i + 1])) k *= 0.78;
          [R, G, B] = [base[0] * k + 22, base[1] * k + 10, base[2] * k];
        }
        d[o] = R;
        d[o + 1] = G;
        d[o + 2] = B;
        d[o + 3] = 255;
        continue;
      }
      let R, G, B;
      if (t === EARTH) {
        const a1 = y > 0 ? s[i - W] : 0;
        const a2 = y > 1 ? s[i - 2 * W] : 0;
        const a3 = y > 2 ? s[i - 3 * W] : 0;
        const n = hash(x, y);
        // Grass only grows where the ground is fairly level; steep flanks show bare earth.
        const flat = x > 0 && x < W - 1 && s[i - 1] !== 0 && s[i + 1] !== 0 && s[i - 1 - 2 * W] === 0 && s[i + 1 - 2 * W] === 0;
        if (!a1) [R, G, B] = flat ? [134, 168, 82] : [112, 88, 66];
        else if (!a2) [R, G, B] = flat ? [104, 142, 66] : [92, 72, 56];
        else if (!a3 && n < 0.6 && flat) [R, G, B] = [86, 116, 58];
        else {
          const depth = Math.min(1, Math.max(0, (y - game.heights[x]) / 90));
          const base = n < 0.12 ? [92, 70, 54] : n > 0.9 ? [56, 42, 36] : [74, 56, 45];
          const k = 1 - depth * 0.18;
          [R, G, B] = [base[0] * k, base[1] * k, base[2] * k];
        }
      } else {
        const mat = t - BRICK;
        const side = mat & 1;
        // An edge pixel (air next to it) is drawn darker, so walls and roofs get a crisp outline.
        const edge = (x > 0 && !s[i - 1]) || (x < W - 1 && !s[i + 1]) || (y > 0 && !s[i - W]);
        if (mat >= 2) {
          const C = ROOF_COLORS[side];
          const row = Math.floor(y / 3);
          const off = (row & 1) * 3;
          const gap = y % 3 === 2 || (x + off) % 6 === 5;
          const base = edge || gap ? C.m : hash((x + off) / 6 | 0, row) < 0.5 ? C.a : C.b;
          [R, G, B] = base;
        } else {
          const C = BRICK_COLORS[side];
          const row = y >> 2;
          const off = (row & 1) * 4;
          const mortar = (y & 3) === 3 || ((x + off) & 7) === 7;
          if (mortar || edge) [R, G, B] = C.m;
          else {
            const base = hash((x + off) >> 3, row) < 0.5 ? C.a : C.b;
            const n = (hash(x, y) - 0.5) * 14;
            [R, G, B] = [base[0] + n, base[1] + n, base[2] + n];
          }
        }
      }
      d[o] = R;
      d[o + 1] = G;
      d[o + 2] = B;
      d[o + 3] = 255;
    }
  }
  r.tctx.putImageData(r.img, 0, 0);
  game.terrainDirty = false;
}

/* ---------- sprites ---------- */

const px = (c, x, y, w = 1, h = 1) => c.fillRect(x, y, w, h);

function line(c, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  if (![x0, y0, x1, y1].every(Number.isFinite)) return;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    c.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Extension "robber": the castle guard (pixel art made with Higgsfield), red row for the left castle, blue for the right. */
const GUARD_IMG = typeof Image !== 'undefined' ? new Image() : null;
if (GUARD_IMG) GUARD_IMG.src = `${import.meta.env.BASE_URL}sprites/burgwache.png`;
const GUARD_FRAME = [18, 48];

function drawGuard(c, o, pal, t) {
  if (GUARD_IMG?.complete && GUARD_IMG.naturalWidth) {
    const w = GUARD_FRAME[0] / RES, h = GUARD_FRAME[1] / RES;
    const frame = Math.floor(t * 0.8) % 2;
    c.save();
    c.imageSmoothingEnabled = false;
    c.translate(o.x + o.w / 2, o.y + o.h - h);
    if (o.owner === 1) c.scale(-1, 1); // both guards look out into the valley
    c.drawImage(GUARD_IMG, frame * GUARD_FRAME[0], o.owner * GUARD_FRAME[1], GUARD_FRAME[0], GUARD_FRAME[1], -w / 2, 0, w, h);
    c.restore();
    return;
  }
  drawGuardPixels(c, o, pal, t);
}

/** Drawn guard while the sprite is still loading. */
function drawGuardPixels(c, o, pal, t) {
  const x = o.x, y = o.y | 0;
  const out = o.owner === 0 ? 1 : -1; // he faces the valley
  const X = (dx) => (out > 0 ? x + dx : x + o.w - 1 - dx);
  // helmet
  c.fillStyle = '#9aa3ad';
  px(c, X(2), y + 1, 1, 1); px(c, X(3), y + 1, 1, 1); px(c, X(4), y + 1, 1, 1);
  px(c, X(1), y + 2, 1, 1); px(c, X(2), y + 2, 1, 1); px(c, X(3), y + 2, 1, 1); px(c, X(4), y + 2, 1, 1); px(c, X(5), y + 2, 1, 1);
  c.fillStyle = '#d8dee6';
  px(c, X(3), y, 1, 1);
  // face
  c.fillStyle = '#efc19a';
  for (let dx = 2; dx <= 4; dx++) px(c, X(dx), y + 3, 1, 2);
  c.fillStyle = '#1d1b22';
  px(c, X(4), y + 3, 1, 1);
  // tunic in the castle colours
  c.fillStyle = pal.main;
  for (let dx = 1; dx <= 5; dx++) px(c, X(dx), y + 5, 1, 5);
  c.fillStyle = pal.dark;
  px(c, X(3), y + 5, 1, 5);
  c.fillStyle = '#5a3a22';
  for (let dx = 1; dx <= 5; dx++) px(c, X(dx), y + 8, 1, 1);
  // legs, a little step now and then
  const step = Math.floor(t * 1.3) % 4 === 0 ? 1 : 0;
  c.fillStyle = '#3a3440';
  px(c, X(2 - step), y + 10, 1, 4); px(c, X(4), y + 10, 1, 4);
  // halberd
  c.fillStyle = '#8a6a4a';
  px(c, X(6), y + 1, 1, 13);
  c.fillStyle = '#c9ced6';
  px(c, X(6), y - 1, 1, 2);
  px(c, X(5), y + 1, 1, 2);
}

function drawKing(c, x, y, pal, t) {
  c.fillStyle = '#f2c94c';
  px(c, x + 3, y); px(c, x + 6, y); px(c, x + 8, y);
  px(c, x + 3, y + 1, 6, 2);
  c.fillStyle = '#c0392b';
  px(c, x + 5, y + 1);
  c.fillStyle = '#efc19a';
  px(c, x + 3, y + 3, 6, 4);
  c.fillStyle = '#1d1b22';
  const blink = Math.floor(t * 0.7) % 6 === 0;
  if (!blink) { px(c, x + 4, y + 4); px(c, x + 7, y + 4); }
  c.fillStyle = '#e9e4da';
  px(c, x + 4, y + 6, 4, 1);
  px(c, x + 2, y + 7, 8, 1);
  c.fillStyle = '#1d1b22';
  px(c, x + 3, y + 7); px(c, x + 6, y + 7); px(c, x + 9, y + 7);
  c.fillStyle = pal.main;
  px(c, x + 2, y + 8, 8, 7);
  c.fillStyle = pal.dark;
  px(c, x + 5, y + 8, 2, 7);
  px(c, x + 2, y + 15, 8, 1);
  c.fillStyle = '#f2c94c';
  px(c, x + 10, y + 4, 1, 1);
  c.fillStyle = '#9a7b3a';
  px(c, x + 10, y + 5, 1, 8);
}

/** Extension "overheat": muzzle glow after 1, 2 and 3 shots in a row. */
const HEAT_COLORS = [null, ['#ffd84a', 'rgba(255, 216, 74, 0.35)'], ['#ff8c1a', 'rgba(255, 140, 26, 0.4)'], ['#ff2a14', 'rgba(255, 42, 20, 0.45)']];

function drawCannon(c, o, pal, angle, highlight, heat = 0, t = 0) {
  const dir = o.owner === 0 ? 1 : -1;
  const X = (dx) => (dir > 0 ? o.x + dx : o.x + o.w - 1 - dx);
  const x = o.x, y = o.y | 0;
  c.fillStyle = '#6e4428';
  for (let dx = 2; dx <= 10; dx++) px(c, X(dx), y + 5, 1, 2);
  c.fillStyle = pal.dark;
  px(c, X(10), y + 4, 1, 1);
  c.fillStyle = '#2a2420';
  for (let dx = 1; dx <= 5; dx++) px(c, X(dx), y + 4, 1, 4);
  c.fillStyle = '#8a6a4a';
  px(c, X(3), y + 5, 1, 2);
  const a = (angle * Math.PI) / 180;
  const pxv = x + o.w / 2, pyv = y + 3;
  const ex = pxv + dir * Math.cos(a) * 9, ey = pyv - Math.sin(a) * 9;
  c.fillStyle = '#2f333a';
  for (let k = -1; k <= 1; k++) line(c, pxv, pyv + k, ex, ey + k);
  c.fillStyle = '#5b616b';
  line(c, pxv, pyv - 1, ex, ey - 1);
  const h = Math.min(heat, 3);
  const glow = HEAT_COLORS[h];
  if (glow) {
    // the whole barrel glows yellow, orange or red; red also pulses
    const mx = pxv, my = pyv;
    const on = h < 3 || Math.floor(t * 4) % 2 === 0;
    // only the barrel itself changes colour, no halo around it
    c.fillStyle = on ? glow[0] : glow[1];
    for (let k = -1; k <= 1; k++) line(c, mx, my + k, ex, ey + k);
    if (h >= 2) {
      // hot smoke curling up from the muzzle
      for (let i = 0; i < h; i++) {
        const ph = (t * 0.9 + i / h) % 1;
        c.fillStyle = `rgba(120, 110, 105, ${0.55 * (1 - ph)})`;
        px(c, (ex + Math.sin(ph * 6 + i) * 2) | 0, (ey - 3 - ph * 9) | 0, 2, 2);
      }
    }
    if (h >= 3 && on) {
      // sparks
      c.fillStyle = '#ffe36b';
      px(c, (ex + dir * 2) | 0, (ey - 2) | 0, 1, 1);
      px(c, (ex - dir) | 0, (ey - 4) | 0, 1, 1);
    }
  }
  if (highlight) {
    c.fillStyle = '#ffe9a8';
    const mx = x + o.w / 2;
    px(c, mx - 2, y - 9, 5, 1);
    px(c, mx - 1, y - 8, 3, 1);
    px(c, mx, y - 7, 1, 1);
  }
}

function drawPowder(c, x, y) {
  c.fillStyle = '#7b4a26';
  px(c, x + 1, y + 1, 10, 10);
  px(c, x + 2, y, 8, 12);
  c.fillStyle = '#5c361b';
  px(c, x + 4, y + 1, 1, 10);
  px(c, x + 7, y + 1, 1, 10);
  c.fillStyle = '#3a3a40';
  px(c, x + 1, y + 2, 10, 1);
  px(c, x + 1, y + 9, 10, 1);
  c.fillStyle = '#e8d8a8';
  px(c, x + 5, y + 4, 2, 3);
  c.fillStyle = '#c0392b';
  px(c, x + 6, y - 1, 1, 1);
}

function drawBalls(c, x, y) {
  const ball = (bx, by) => {
    c.fillStyle = '#25252c';
    px(c, bx + 1, by, 2, 4);
    px(c, bx, by + 1, 4, 2);
    c.fillStyle = '#7d808a';
    px(c, bx + 1, by + 1, 1, 1);
  };
  ball(x, y + 4); ball(x + 4, y + 4); ball(x + 8, y + 4);
  ball(x + 2, y); ball(x + 6, y);
}

/**
 * A heap of gold coins in an 8×8 cell, drawn with smooth shapes on the high-resolution layer:
 * a mound of coins with a warm gradient, coin rims, one coin standing on edge and a twinkle.
 */
function drawGold(c, x, y, t) {
  c.save();
  // shadow on the floor
  c.fillStyle = 'rgba(30, 18, 6, 0.45)';
  c.beginPath(); c.ellipse(x + 4, y + 7.7, 4.2, 0.9, 0, 0, Math.PI * 2); c.fill();
  // the mound
  const g = c.createRadialGradient(x + 3, y + 3.2, 0.3, x + 4, y + 5.5, 5);
  g.addColorStop(0, '#fff3b0'); g.addColorStop(0.35, '#f4c542'); g.addColorStop(0.8, '#b9821f'); g.addColorStop(1, '#7a4f12');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x + 0.1, y + 7.6);
  c.bezierCurveTo(x + 0.6, y + 4.6, x + 2.2, y + 3.3, x + 4, y + 3.3);
  c.bezierCurveTo(x + 5.8, y + 3.3, x + 7.4, y + 4.6, x + 7.9, y + 7.6);
  c.closePath(); c.fill();
  // coin rims lying in the heap
  c.strokeStyle = 'rgba(122, 79, 18, 0.75)';
  c.lineWidth = 0.28;
  for (const [cx, cy, rx] of [[2.2, 6.4, 1.3], [5.6, 6.6, 1.4], [3.9, 4.6, 1.2], [6.2, 4.9, 0.9], [1.6, 4.9, 0.8]]) {
    c.beginPath(); c.ellipse(x + cx, y + cy, rx, rx * 0.42, 0, 0, Math.PI * 2); c.stroke();
  }
  // a few loose coins lying on top, and a gold bar leaning against the heap
  for (const [cx, cy] of [[3.2, 3.6], [4.9, 3.9]]) {
    c.fillStyle = '#ffe27a';
    c.beginPath(); c.ellipse(x + cx, y + cy, 1.1, 0.45, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#8a5a14'; c.lineWidth = 0.22; c.stroke();
  }
  const bar = c.createLinearGradient(0, y + 5.6, 0, y + 7.6);
  bar.addColorStop(0, '#fff0a0'); bar.addColorStop(1, '#a8711a');
  c.fillStyle = bar;
  c.beginPath(); c.moveTo(x + 4.6, y + 7.6); c.lineTo(x + 5.2, y + 5.9); c.lineTo(x + 7.4, y + 5.9); c.lineTo(x + 7.9, y + 7.6); c.closePath(); c.fill();
  c.strokeStyle = '#7a4f12'; c.lineWidth = 0.22; c.stroke();
  // twinkle, now and then
  const tw = Math.max(0, Math.sin(t * 2.3 + x * 0.7));
  if (tw > 0.6) {
    const k = (tw - 0.6) / 0.4, sx = x + 5.3, sy = y + 3.6;
    c.strokeStyle = `rgba(255, 252, 230, ${k})`;
    c.lineWidth = 0.3;
    c.beginPath(); c.moveTo(sx - 1.4 * k, sy); c.lineTo(sx + 1.4 * k, sy); c.moveTo(sx, sy - 1.4 * k); c.lineTo(sx, sy + 1.4 * k); c.stroke();
  }
  c.restore();
}

function drawVane(c, x, y, pal, wind, t) {
  c.fillStyle = '#c9c4b8';
  px(c, x + 1, y, 1, 20);
  c.fillStyle = '#8f8a7e';
  px(c, x, y + 19, 3, 1);
  const len = 2 + Math.round(Math.abs(wind) / 1.5);
  const dir = wind >= 0 ? 1 : -1;
  const flutter = Math.round(Math.sin(t * 9) * (Math.abs(wind) > 3 ? 1 : 0));
  c.fillStyle = pal.main;
  for (let i = 0; i < len; i++) {
    const hgt = Math.max(1, 4 - Math.floor((i * 4) / Math.max(1, len)));
    px(c, x + 1 + dir * (i + 1), y + 1 + (i > len / 2 ? flutter : 0), 1, hgt);
  }
}

function drawMine(c, x, y, t, damage = 0, lame = 0) {
  drawMineBody(c, x, y, lame ? 0 : t, damage);
  if (!lame) return;
  // Extension "spy": a blown-up tower stands black and still, smoke rises, a tally shows the rounds left
  c.fillStyle = 'rgba(20, 14, 10, 0.4)';
  c.fillRect(x + 1, y + 8, 14, 16);
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.5 + i / 3) % 1;
    c.fillStyle = `rgba(70, 64, 66, ${0.65 * (1 - p)})`;
    c.fillRect((x + 6 + Math.sin(t * 2 + i * 2) * 2 + p * 3) | 0, (y - 1 - p * 12) | 0, 2 + Math.round(p * 2), 2 + Math.round(p * 2));
  }
  if (Math.floor(t * 5) % 3 === 0) { c.fillStyle = '#ff8a2a'; c.fillRect(x + 5, y + 18, 1, 1); c.fillRect(x + 10, y + 13, 1, 1); }
  c.fillStyle = '#ff5a3a';
  for (let i = 0; i < lame; i++) c.fillRect(x + 2 + i * 3, y + 26, 2, 1);
}

function drawMineBody(c, x, y, t, damage = 0) {
  c.fillStyle = '#7a5230';
  line(c, x + 1, y + 23, x + 7, y + 3);
  line(c, x + 14, y + 23, x + 8, y + 3);
  line(c, x + 3, y + 16, x + 12, y + 16);
  line(c, x + 5, y + 9, x + 10, y + 9);
  line(c, x + 3, y + 16, x + 10, y + 9);
  line(c, x + 12, y + 16, x + 5, y + 9);
  c.fillStyle = '#3b2a1e';
  px(c, x + 5, y + 1, 6, 1);
  c.fillStyle = '#c9c4b8';
  if (damage) {
    // damaged: the wheel stands still, a piece is missing and the rope hangs loose
    px(c, x + 6, y, 3, 4);
    px(c, x + 9, y + 2, 1, 2);
    c.fillStyle = '#8f8a80';
    px(c, x + 6, y + 3, 1, 1);
    c.fillStyle = '#3b2a1e';
    px(c, x + 7, y + 1, 1, 2);
    px(c, x + 8, y + 2, 1, 1);
    c.fillStyle = '#c9c4b8';
    px(c, x + 10, y + 4, 1, 1);
    c.fillStyle = '#d8d2c0';
    line(c, x + 9, y + 4, x + 9, y + 10);
    px(c, x + (Math.floor(t * 2) % 2 ? 10 : 8), y + 10, 1, 1);
  } else {
    px(c, x + 6, y, 4, 4);
    c.fillStyle = '#3b2a1e';
    px(c, x + 7 + (Math.floor(t * 4) % 2), y + 1, 1, 2);
  }
  c.fillStyle = damage ? '#b38a3a' : '#f2c94c';
  px(c, x + 7, y + 19, 2, 2);
  c.fillStyle = '#5a4436';
  px(c, x + 6, y + 21, 4, 3);
}

/**
 * A powder keg in an 8×8 cell, drawn with smooth shapes: bulging wooden staves lit from the left,
 * two iron hoops, a red warning band, the lid and a little heap of spilled black powder.
 */
function drawKeg(c, x, y) {
  c.save();
  c.fillStyle = 'rgba(20, 10, 4, 0.45)';
  c.beginPath(); c.ellipse(x + 4, y + 7.8, 3.9, 0.8, 0, 0, Math.PI * 2); c.fill();
  // body with bulging sides
  const body = new Path2D();
  body.moveTo(x + 1.3, y + 0.9);
  body.quadraticCurveTo(x - 0.3, y + 4, x + 1.3, y + 7.4);
  body.lineTo(x + 6.7, y + 7.4);
  body.quadraticCurveTo(x + 8.3, y + 4, x + 6.7, y + 0.9);
  body.closePath();
  const wood = c.createLinearGradient(x, 0, x + 8, 0);
  wood.addColorStop(0, '#5a3218'); wood.addColorStop(0.28, '#c48a4c'); wood.addColorStop(0.55, '#9a6232'); wood.addColorStop(1, '#4a2912');
  c.fillStyle = wood;
  c.fill(body);
  c.save();
  c.clip(body);
  // staves
  c.strokeStyle = 'rgba(58, 30, 12, 0.55)';
  c.lineWidth = 0.22;
  for (const sx of [2.2, 3.4, 4.6, 5.8]) {
    c.beginPath(); c.moveTo(x + sx, y + 0.8); c.quadraticCurveTo(x + sx + (sx - 4) * 0.35, y + 4, x + sx, y + 7.5); c.stroke();
  }
  // red warning band and iron hoops
  c.fillStyle = '#a3261b';
  c.fillRect(x, y + 3.5, 8, 1.1);
  c.fillStyle = 'rgba(255, 200, 170, 0.35)';
  c.fillRect(x, y + 3.5, 8, 0.25);
  for (const hy of [1.9, 5.9]) {
    const hoop = c.createLinearGradient(x, 0, x + 8, 0);
    hoop.addColorStop(0, '#2b2b31'); hoop.addColorStop(0.3, '#9da0ab'); hoop.addColorStop(1, '#2b2b31');
    c.fillStyle = hoop;
    c.fillRect(x, y + hy, 8, 0.7);
  }
  c.restore();
  // lid
  c.fillStyle = '#6b3d1c';
  c.beginPath(); c.ellipse(x + 4, y + 0.95, 2.75, 0.62, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#b98149';
  c.beginPath(); c.ellipse(x + 4, y + 0.85, 2.2, 0.38, 0, 0, Math.PI * 2); c.fill();
  // spilled powder at the foot
  c.fillStyle = '#1d1a20';
  c.beginPath(); c.ellipse(x + 7.1, y + 7.65, 1.1, 0.45, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#3a3640';
  c.fillRect(x + 6.4, y + 7.35, 0.35, 0.3);
  c.restore();
}

function drawBall(c, x, y) {
  c.fillStyle = '#25252c';
  px(c, x + 1, y, 3, 5);
  px(c, x, y + 1, 5, 3);
  c.fillStyle = '#7d808a';
  px(c, x + 1, y + 1, 1, 1);
}

/**
 * A store room shows what it holds: one sack per 150 gold, one keg per 30 powder, one ball per ball.
 * It fills from the bottom row on the outer side, so every shot visibly empties it.
 */
function drawChamber(c, o, kind, amount, t) {
  const [cw, ch, unit] = STORE_CELL[kind];
  const cols = Math.floor(o.w / cw), rows = Math.floor(o.h / ch);
  const count = Math.max(0, Math.min(cols * rows, Math.ceil(amount / unit)));
  // flickering torchlight in the chamber (the room's back wall is part of the terrain layer)
  const glow = c.createRadialGradient(o.x + o.w / 2, o.y + 2, 1, o.x + o.w / 2, o.y + 2, Math.max(o.w, o.h) * 0.8);
  // the powder room gets a reddish warning lantern, the others warm torchlight
  const [lr, lg, lb] = kind === 'powder' ? [255, 110, 70] : [255, 190, 110];
  glow.addColorStop(0, `rgba(${lr}, ${lg}, ${lb}, ${(kind === 'powder' ? 0.28 : 0.2) + 0.05 * Math.sin(t * 9 + o.x)})`);
  glow.addColorStop(1, `rgba(${lr}, ${lg}, ${lb}, 0)`);
  c.fillStyle = glow;
  c.fillRect(o.x, o.y, o.w, o.h);
  for (let i = 0; i < count; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const x = o.owner === 0 ? o.x + col * cw : o.x + o.w - (col + 1) * cw;
    const y = o.y + o.h - (row + 1) * ch;
    if (kind === 'gold') drawGold(c, x, y + 2, t + i);
    else if (kind === 'powder') drawKeg(c, x, y + 1);
    else drawBall(c, x, y + 1);
  }
}

export function drawObject(c, o, { wind = 0, t = 0, angle = 45, highlight = false, stock = null, heat = 0 } = {}) {
  const pal = SIDE_COLORS[o.owner];
  const x = o.x | 0, y = o.y | 0;
  switch (o.type) {
    case 'king': return drawKing(c, x, y, pal, t);
    case 'guard': return drawGuard(c, o, pal, t);
    case 'cannon': return drawCannon(c, o, pal, angle, highlight, heat, t);
    case 'powder': return stock ? drawChamber(c, o, 'powder', stock.powder, t) : drawPowder(c, x, y);
    case 'balls': return stock ? drawChamber(c, o, 'balls', stock.balls, t) : drawBalls(c, x, y);
    case 'gold': return stock ? drawChamber(c, o, 'gold', stock.money, t) : drawGold(c, x, y, t);
    case 'vane': return drawVane(c, x, y, pal, wind, t);
    case 'mine': return drawMine(c, x, y, t, o.damage || 0, o.lame || 0);
  }
}

/* ---------- scene ---------- */

/** Extension "robber": four walking frames of the masked thief (pixel art made with Higgsfield). */
const ROBBER_IMG = typeof Image !== 'undefined' ? new Image() : null;
if (ROBBER_IMG) ROBBER_IMG.src = `${import.meta.env.BASE_URL}sprites/raeuber.png`;
const ROBBER_FRAME = [35, 48];

function drawRobber(c, game, t) {
  const rb = game.robber;
  if (!rb || !ROBBER_IMG?.complete || !ROBBER_IMG.naturalWidth) return;
  const x = rb.shownX;
  const gy = game.groundAt(x);
  const w = ROBBER_FRAME[0] / RES, h = ROBBER_FRAME[1] / RES;
  const frame = rb.walking ? Math.floor(t * 9) % 4 : 0;
  const face = rb.face || rb.dir || 1;
  c.save();
  c.imageSmoothingEnabled = false;
  c.translate(x, gy - h + 0.5);
  if (face < 0) c.scale(-1, 1);
  c.drawImage(ROBBER_IMG, frame * ROBBER_FRAME[0], 0, ROBBER_FRAME[0], ROBBER_FRAME[1], -w / 2, 0, w, h);
  c.restore();
  if (rb.loot > 0) {
    // a gold glint over his head shows that he carries loot
    c.fillStyle = Math.floor(t * 3) % 2 ? '#ffd23f' : '#fff3b0';
    c.fillRect((x | 0) - 1, (gy - h - 3) | 0, 2, 2);
  }
}

/** Extension "spy": four walking frames, one kneeling with the bomb, one standing (pixel art made with Higgsfield). */
const SPY_IMG = typeof Image !== 'undefined' ? new Image() : null;
if (SPY_IMG) SPY_IMG.src = `${import.meta.env.BASE_URL}sprites/spion.png`;
const SPY_FRAME = [42, 48];

function drawSpies(c, game, t) {
  if (!game.spies?.length || !SPY_IMG?.complete || !SPY_IMG.naturalWidth) return;
  const w = SPY_FRAME[0] / RES, h = SPY_FRAME[1] / RES;
  for (const s of game.spies) {
    const x = s.shownX;
    const gy = game.spyGround(s, x);
    const planting = s.state === 'plant' && !s.walking;
    const frame = planting ? 4 : s.walking ? Math.floor(t * 10) % 4 : 5;
    const face = planting ? (s.owner === 0 ? 1 : -1) : s.face || s.dir || 1;
    c.save();
    c.imageSmoothingEnabled = false;
    c.translate(x, gy - h + 0.5);
    if (face < 0) c.scale(-1, 1);
    c.drawImage(SPY_IMG, frame * SPY_FRAME[0], 0, SPY_FRAME[0], SPY_FRAME[1], -w / 2, 0, w, h);
    c.restore();
    // a small flag in the owner's colour over his hat says whose spy he is
    c.fillStyle = SIDE_COLORS[s.owner].main;
    c.fillRect((x | 0) - 1, (gy - h - 3) | 0, 3, 2);
    if (planting && Math.floor(t * 8) % 2) {
      // the burning fuse sparkles
      c.fillStyle = '#fff3a6';
      c.fillRect((x + face * 4) | 0, (gy - 4) | 0, 1, 1);
    }
  }
}

export function drawScene(c, game, r, view) {
  const t = view.time;
  if (game.terrainDirty) refreshTerrain(r, game);
  c.save();
  if (game.shake > 0.2) c.translate(Math.round((Math.random() - 0.5) * game.shake), Math.round((Math.random() - 0.5) * game.shake));
  const skyKey = game.sky || 'abend';
  if (r.sky !== skyKey) {
    paintBackground(r.bgctx, skyKey);
    r.sky = skyKey;
  }
  c.drawImage(r.bg, 0, 0, W, H);
  // terrain, castles and objects go to a separate layer so the time-of-day light only tints them
  const sky = c;
  c = r.wctx;
  c.clearRect(0, 0, W, H);
  c.drawImage(r.tc, 0, 0);

  const sel = game.obj(game.selected);
  if (sel && sel.alive && sel.lastTrail && game.phase !== 'flying') {
    c.fillStyle = 'rgba(255, 240, 210, 0.28)';
    sel.lastTrail.forEach(([x, y], i) => i % 2 === 0 && c.fillRect(x | 0, y | 0, 1, 1));
    const [lx, ly] = sel.lastTrail[sel.lastTrail.length - 1];
    c.fillStyle = 'rgba(255, 240, 210, 0.55)';
    c.fillRect((lx | 0) - 2, ly | 0, 5, 1);
    c.fillRect(lx | 0, (ly | 0) - 2, 1, 5);
  }

  const blink = Math.floor(t * 3) % 2 === 0;
  for (const o of game.objects) {
    if (!o.alive) continue;
    const isSel = o.id === game.selected && (game.phase === 'aim' || game.phase === 'ai');
    const angle = isSel && view.aim ? view.aim.angle : o.aim.angle;
    const heat = game.options.extensions.overheat ? o.heat || 0 : 0;
    drawObject(c, o, { wind: game.wind, t, angle, highlight: isSel && blink && !game.hasFired, stock: game.players[o.owner], heat });
  }
  drawRobber(c, game, t);
  drawSpies(c, game, t);
  const tint = SKIES[skyKey]?.tint;
  if (tint) {
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = tint;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
  }
  c = sky;
  c.drawImage(r.world, 0, 0, W, H);

  const pr = game.projectile;
  if (pr) {
    pr.trail.forEach(([x, y], i) => {
      c.fillStyle = `rgba(255, 214, 160, ${0.15 + (0.5 * i) / pr.trail.length})`;
      c.fillRect(x | 0, y | 0, 1, 1);
    });
    c.fillStyle = '#1c1c22';
    c.fillRect((pr.x | 0) - 1, (pr.y | 0) - 1, 3, 3);
    c.fillStyle = '#d9d9e0';
    c.fillRect((pr.x | 0) - 1, (pr.y | 0) - 1, 1, 1);
  }

  // Neufassung: fireball inside a hit store room (drawn under the flying debris)
  for (const b of game.blasts || []) {
    const k = b.t / b.life;
    const big = b.kind === 'powder';
    c.save();
    c.beginPath();
    c.rect(b.x - (big ? 6 : 1), b.y - (big ? 10 : 1), b.w + (big ? 12 : 2), b.h + (big ? 12 : 2));
    c.clip();
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const r = Math.max(b.w, b.h) * (0.4 + k * (big ? 1.1 : 0.7));
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
    const a = Math.max(0, 1 - k);
    g.addColorStop(0, `rgba(255, 252, 220, ${a})`);
    g.addColorStop(0.35, `rgba(255, ${big ? 170 : 200}, 70, ${0.9 * a})`);
    g.addColorStop(0.75, `rgba(200, 70, 30, ${0.6 * a})`);
    g.addColorStop(1, 'rgba(60, 30, 30, 0)');
    c.fillStyle = g;
    c.fillRect(b.x - 8, b.y - 12, b.w + 16, b.h + 16);
    // licking flames rising from the floor
    if (k < 0.8) {
      c.fillStyle = `rgba(255, 140, 40, ${0.8 * (1 - k)})`;
      for (let x = b.x; x < b.x + b.w; x += 2) {
        const hgt = (Math.sin(x * 1.7 + b.t * 30) * 0.5 + 0.5) * b.h * (1 - k) * 0.8;
        c.fillRect(x, b.y + b.h - hgt, 1, hgt);
      }
    }
    c.restore();
  }

  for (const p of game.particles) {
    const s = p.s || 1;
    if (p.smoke) {
      const k = Math.min(1, p.life / 2);
      c.globalAlpha = 0.45 * k;
      c.fillStyle = p.col;
      const r = s + (1 - k) * 4;
      c.fillRect((p.x - r / 2) | 0, (p.y - r / 2) | 0, r | 0, r | 0);
      continue;
    }
    c.globalAlpha = Math.min(1, p.life * 1.5);
    c.fillStyle = p.glint && Math.sin(p.life * 40) > 0.6 ? '#ffffff' : p.col;
    c.fillRect(p.x | 0, p.y | 0, s, s);
    if (p.ball) {
      c.fillStyle = '#7d808a';
      c.fillRect(p.x | 0, p.y | 0, 1, 1);
    }
  }
  c.globalAlpha = 1;

  for (const f of game.flashes) {
    const k = f.t / f.life;
    const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (0.6 + k * 0.6));
    g.addColorStop(0, `rgba(255, 246, 200, ${0.9 * (1 - k)})`);
    g.addColorStop(0.4, `rgba(255, 160, 70, ${0.7 * (1 - k)})`);
    g.addColorStop(1, 'rgba(200, 60, 30, 0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(f.x, f.y, f.r * (0.6 + k * 0.6), 0, Math.PI * 2);
    c.fill();
  }

  if (game.building && game.phase === 'aim') {
    if (view.hover) {
      const spot = game.brickSpot(view.hover.x, view.hover.y);
      if (spot) {
        c.fillStyle = 'rgba(160, 230, 140, 0.55)';
        c.fillRect(spot.x, spot.y, spot.w, spot.h);
      } else {
        c.strokeStyle = 'rgba(255, 110, 90, 0.8)';
        c.strokeRect((view.hover.x | 0) - 3.5, (view.hover.y | 0) - 3.5, 7, 7);
      }
    }
  }
  c.restore();
}

/** Small standalone preview of a castle for the setup dialog, drawn with the in-game renderer. */
export function drawCastlePreview(canvas, built, side, stock = null) {
  const ground = 140;
  const w = 196, h = ground + 10;
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#33234a');
  g.addColorStop(1, '#8e4357');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const ox = side === 0 ? 0 : W - w;
  const fake = { solid: new Uint8Array(W * H), interior: new Uint8Array(W * H), heights: new Float32Array(W).fill(H) };
  for (const [x, y] of built.rooms || []) if (x >= 0 && x < W && y >= 0 && y < H) fake.interior[y * W + x] = side + 1;
  // the castle is built standing on y = H - 10 (see CastlePicker), so no shift is needed
  const shift = 0;
  for (const [x, y, m] of built.pixels) {
    const yy = y + shift;
    if (x >= 0 && x < W && yy >= 0 && yy < H) fake.solid[yy * W + x] = m;
  }
  for (let x = 0; x < W; x++) for (let y = H - 10; y < H; y++) fake.solid[y * W + x] = EARTH;
  const full = document.createElement('canvas');
  full.width = W;
  full.height = H;
  const fctx = full.getContext('2d');
  refreshTerrain({ img: fctx.createImageData(W, H), tctx: fctx }, fake);
  c.drawImage(full, ox, H - h, w, h, 0, 0, w, h);
  c.save();
  c.translate(-ox, -(H - h));
  built.objects.forEach((o, i) => drawObject(c, { ...o, y: o.y + shift, id: i, owner: side, aim: { angle: 40 } }, { wind: 8, t: 0, angle: 40, stock }));
  c.restore();
}

/** Silhouette preview of a generated battlefield for the setup screen. */
export function drawTerrainPreview(canvas, heights) {
  const c = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#15122a');
  g.addColorStop(0.6, '#5a2f52');
  g.addColorStop(1, '#c9714f');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x++) {
    const top = Math.max(0, Math.round(heights[x]));
    c.fillStyle = '#4a382d';
    c.fillRect(x, top, 1, H - top);
    c.fillStyle = '#86a852';
    c.fillRect(x, top, 1, 2);
  }
}
