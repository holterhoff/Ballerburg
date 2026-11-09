import { W, H, EARTH, BRICK } from './constants.js';
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

export function createRenderer() {
  const bg = document.createElement('canvas');
  bg.width = W;
  bg.height = H;
  paintBackground(bg.getContext('2d'));
  const tc = document.createElement('canvas');
  tc.width = W;
  tc.height = H;
  const tctx = tc.getContext('2d');
  return { bg, tc, tctx, img: tctx.createImageData(W, H) };
}

function paintBackground(c) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#15122a');
  g.addColorStop(0.42, '#33234a');
  g.addColorStop(0.72, '#8e4357');
  g.addColorStop(1, '#e48f5a');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 110; i++) {
    const x = Math.floor(hash(i, 7) * W);
    const y = Math.floor(hash(i, 13) * H * 0.55);
    c.fillStyle = `rgba(255, 244, 220, ${0.25 + 0.6 * (1 - y / (H * 0.55)) * hash(i, 3)})`;
    c.fillRect(x, y, 1, 1);
  }
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
  const ridge = (base, amp, f, col, seed) => {
    c.fillStyle = col;
    for (let x = 0; x < W; x++) {
      const y = base - amp * (0.6 * Math.sin(x * f + seed) + 0.3 * Math.sin(x * f * 2.7 + seed * 2) + 0.1 * Math.sin(x * f * 7.1));
      c.fillRect(x, Math.round(y), 1, H - Math.round(y));
    }
  };
  ridge(H * 0.66, 26, 0.013, '#5a2f52', 1.3);
  ridge(H * 0.76, 18, 0.021, '#3d2341', 4.1);
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
        d[o + 3] = 0;
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

function drawCannon(c, o, pal, angle, highlight) {
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

function drawGold(c, x, y, t) {
  c.fillStyle = '#b8873e';
  px(c, x + 1, y + 3, 6, 5);
  px(c, x + 2, y + 2, 4, 1);
  c.fillStyle = '#7a5523';
  px(c, x + 3, y, 2, 2);
  px(c, x + 1, y + 7, 6, 1);
  c.fillStyle = '#f2c94c';
  px(c, x + 3, y + 4, 2, 2);
  if (Math.floor(t * 2 + x) % 5 === 0) {
    c.fillStyle = '#fff6cf';
    px(c, x + 6, y + 3, 1, 1);
  }
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

function drawMine(c, x, y, t) {
  c.fillStyle = '#7a5230';
  line(c, x + 1, y + 23, x + 7, y + 3);
  line(c, x + 14, y + 23, x + 8, y + 3);
  line(c, x + 3, y + 16, x + 12, y + 16);
  line(c, x + 5, y + 9, x + 10, y + 9);
  line(c, x + 3, y + 16, x + 10, y + 9);
  line(c, x + 12, y + 16, x + 5, y + 9);
  c.fillStyle = '#3b2a1e';
  px(c, x + 5, y + 1, 6, 1);
  const spin = Math.floor(t * 4) % 2;
  c.fillStyle = '#c9c4b8';
  px(c, x + 6, y, 4, 4);
  c.fillStyle = '#3b2a1e';
  px(c, x + 7 + spin, y + 1, 1, 2);
  c.fillStyle = '#f2c94c';
  px(c, x + 7, y + 19, 2, 2);
  c.fillStyle = '#5a4436';
  px(c, x + 6, y + 21, 4, 3);
}

function drawKeg(c, x, y) {
  c.fillStyle = '#7b4a26';
  px(c, x + 1, y, 6, 8);
  px(c, x, y + 1, 8, 6);
  c.fillStyle = '#3a3a40';
  px(c, x, y + 2, 8, 1);
  px(c, x, y + 5, 8, 1);
  c.fillStyle = '#5c361b';
  px(c, x + 4, y, 1, 8);
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
  c.fillStyle = 'rgba(18, 12, 22, 0.6)';
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

export function drawObject(c, o, { wind = 0, t = 0, angle = 45, highlight = false, stock = null } = {}) {
  const pal = SIDE_COLORS[o.owner];
  const x = o.x | 0, y = o.y | 0;
  switch (o.type) {
    case 'king': return drawKing(c, x, y, pal, t);
    case 'cannon': return drawCannon(c, o, pal, angle, highlight);
    case 'powder': return stock ? drawChamber(c, o, 'powder', stock.powder, t) : drawPowder(c, x, y);
    case 'balls': return stock ? drawChamber(c, o, 'balls', stock.balls, t) : drawBalls(c, x, y);
    case 'gold': return stock ? drawChamber(c, o, 'gold', stock.money, t) : drawGold(c, x, y, t);
    case 'vane': return drawVane(c, x, y, pal, wind, t);
    case 'mine': return drawMine(c, x, y, t);
  }
}

/* ---------- scene ---------- */

export function drawScene(c, game, r, view) {
  const t = view.time;
  if (game.terrainDirty) refreshTerrain(r, game);
  c.save();
  if (game.shake > 0.2) c.translate(Math.round((Math.random() - 0.5) * game.shake), Math.round((Math.random() - 0.5) * game.shake));
  c.drawImage(r.bg, 0, 0);
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
    drawObject(c, o, { wind: game.wind, t, angle, highlight: isSel && blink && !game.hasFired, stock: game.players[o.owner] });
  }

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

  for (const p of game.particles) {
    c.globalAlpha = Math.min(1, p.life * 1.5);
    c.fillStyle = p.col;
    c.fillRect(p.x | 0, p.y | 0, 1, 1);
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
  const fake = { solid: new Uint8Array(W * H), heights: new Float32Array(W).fill(H) };
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
