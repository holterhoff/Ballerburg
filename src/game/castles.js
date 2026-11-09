/*
 * Burgen von Burgfehde.
 * Der Datenaufbau folgt dem Prinzip von BALLER.DAT aus Ballerburg ((C) 1987 Eckhard Kruse, GNU GPL v3):
 * Breite, Kanonenplätze, Thron, Windfahne, Lagerkammern und Startwerte. Die Burgen selbst sind eigene Entwürfe.
 *
 * Koordinaten: x zählt von der Außenkante der Burg (0) zum Berg hin, y vom Boden (0) nach oben.
 * Die rechte Burg wird gespiegelt. Objektpositionen bezeichnen die linke untere Ecke.
 */
import { W, SIZES, BRICK } from './constants.js';

/** Material offset on top of BRICK + side: 0 = wall, ROOF = roof tiles. */
export const ROOF = 2;

function design(width, build) {
  const parts = [];
  const api = {
    /** solid wall rectangle [x0, x1) x [y0, y1) */
    wall: (x0, y0, x1, y1) => parts.push({ op: 'rect', m: 0, r: [x0, y0, x1, y1] }),
    /** roof polygon, drawn in roof tiles */
    roof: (pts) => parts.push({ op: 'poly', m: ROOF, pts }),
    /** cut a room out of the walls */
    room: (x0, y0, x1, y1) => parts.push({ op: 'clear', r: [x0, y0, x1, y1] }),
    /** battlements: merlons 4 wide and 6 high every `step` pixels, leaving gaps free for cannons */
    merlons: (x0, x1, y, step = 8, gaps = []) => {
      for (let x = x0; x + 4 <= x1; x += step) if (!gaps.some(([a, b]) => x + 4 > a && x < b)) parts.push({ op: 'rect', m: 0, r: [x, y, x + 4, y + 6] });
    },
  };
  return { width, parts, ...build(api) };
}

/** Gabled roof over x0..x1 resting on y, ridge h pixels higher. */
const gable = (x0, x1, y, h) => [[x0 - 2, y], [x1 + 2, y], [(x0 + x1) / 2, y + h]];

export const CASTLES = {
  falkenstein: {
    name: 'Falkenstein',
    desc: 'Ausgewogen: Bergfried mit Spitzdach, Thronhalle, zwei Geschütze.',
    start: { money: 400, powder: 180, balls: 12, pop: 200 },
    caps: { money: 1500, powder: 270, balls: 18 },
    ...design(138, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 138, 10);
      wall(4, 10, 30, 72);
      roof(gable(4, 30, 72, 24));
      room(9, 10, 25, 25);
      wall(30, 10, 44, 30);
      wall(44, 10, 48, 40);
      wall(84, 10, 88, 40);
      roof(gable(44, 88, 40, 18));
      wall(110, 10, 138, 56);
      merlons(110, 138, 56, 8, [[114, 128]]);
      return {
        cannons: [[31, 30], [115, 56]],
        king: [61, 10], vane: [15, 96],
        gold: [[50, 10], [75, 10]], powder: [11, 10], balls: [93, 10],
      };
    }),
  },
  bollwerk: {
    name: 'Bollwerk',
    desc: 'Breiter Wall mit vier Geschützen, Ecktürmen und tief liegenden Kammern. Wenig Geld.',
    start: { money: 300, powder: 160, balls: 10, pop: 230 },
    caps: { money: 1200, powder: 240, balls: 16 },
    ...design(152, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 152, 14);
      wall(0, 14, 152, 40);
      room(56, 14, 94, 34);
      room(8, 14, 23, 28);
      room(120, 14, 138, 24);
      wall(0, 40, 12, 66);
      roof(gable(0, 12, 66, 14));
      wall(140, 40, 152, 66);
      roof(gable(140, 152, 66, 14));
      merlons(14, 140, 40, 9, [[20, 34], [56, 70], [94, 108], [122, 136]]);
      return {
        cannons: [[21, 40], [57, 40], [95, 40], [123, 40]],
        king: [69, 14], vane: [4, 80],
        gold: [[58, 14], [83, 14]], powder: [10, 14], balls: [123, 14],
      };
    }),
  },
  hochwacht: {
    name: 'Hochwacht',
    desc: 'Ein schlanker Turm, der über jeden Berg schießt, davor eine kleine Stadt.',
    start: { money: 450, powder: 150, balls: 12, pop: 250 },
    caps: { money: 1800, powder: 210, balls: 18 },
    ...design(122, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 122, 8);
      wall(10, 8, 34, 112);
      merlons(10, 34, 112, 8, [[15, 29]]);
      room(14, 8, 29, 22);
      wall(46, 8, 50, 36);
      wall(88, 8, 92, 36);
      wall(44, 36, 94, 42);
      roof([[50, 42], [62, 42], [56, 52]]);
      wall(100, 8, 122, 30);
      merlons(100, 122, 30, 8, [[104, 118]]);
      return {
        cannons: [[16, 112], [105, 30]],
        king: [63, 8], vane: [82, 42],
        gold: [[52, 8], [77, 8]], powder: [16, 8], balls: [66, 42],
      };
    }),
  },
  stufenburg: {
    name: 'Stufenburg',
    desc: 'Terrassen voller Geschütze: fünf Kanonen auf vier Stufen und ein spitzer Wachturm.',
    start: { money: 350, powder: 190, balls: 14, pop: 220 },
    caps: { money: 1200, powder: 300, balls: 22 },
    ...design(172, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 172, 12);
      wall(0, 12, 142, 24);
      wall(0, 24, 102, 40);
      wall(0, 40, 58, 60);
      wall(8, 60, 30, 86);
      roof(gable(8, 30, 86, 20));
      room(60, 12, 94, 30);
      room(10, 12, 26, 26);
      room(104, 12, 122, 22);
      merlons(142, 172, 12, 8, [[148, 164]]);
      return {
        cannons: [[151, 12], [121, 24], [106, 24], [81, 40], [38, 60]],
        king: [71, 12], vane: [17, 106],
        gold: [[62, 12], [85, 12]], powder: [12, 12], balls: [107, 12],
      };
    }),
  },
  zwillingsburg: {
    name: 'Zwillingsburg',
    desc: 'Zwei Türme mit Spitzdächern, dazwischen ein Wehrgang mit zwei Geschützen.',
    start: { money: 400, powder: 170, balls: 12, pop: 240 },
    caps: { money: 1500, powder: 240, balls: 18 },
    ...design(162, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 162, 10);
      wall(0, 10, 26, 80);
      roof(gable(0, 26, 80, 24));
      wall(110, 10, 136, 70);
      roof(gable(110, 136, 70, 22));
      wall(26, 10, 110, 44);
      merlons(26, 110, 44, 8, [[32, 48], [86, 102]]);
      room(50, 10, 88, 30);
      room(5, 10, 21, 24);
      room(116, 10, 131, 20);
      wall(136, 10, 162, 34);
      merlons(136, 162, 34, 8, [[142, 156]]);
      return {
        cannons: [[34, 44], [88, 44], [143, 34]],
        king: [63, 10], vane: [121, 92],
        gold: [[52, 10], [77, 10]], powder: [7, 10], balls: [118, 10],
      };
    }),
  },
  schatzburg: {
    name: 'Schatzburg',
    desc: 'Reich: drei Geldsäcke im Gewölbe, der König in der Halle darüber. Nur zwei Geschütze.',
    start: { money: 800, powder: 120, balls: 10, pop: 300 },
    caps: { money: 3000, powder: 180, balls: 14 },
    ...design(186, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 186, 16);
      room(20, 4, 62, 14);
      wall(0, 16, 122, 50);
      roof(gable(0, 122, 50, 22));
      room(40, 20, 78, 40);
      room(6, 20, 21, 34);
      room(86, 20, 104, 30);
      wall(130, 16, 158, 90);
      merlons(130, 158, 90, 8, [[135, 149]]);
      wall(158, 16, 186, 36);
      merlons(158, 186, 36, 8, [[164, 178]]);
      return {
        cannons: [[136, 90], [165, 36]],
        king: [53, 20], vane: [59, 72],
        gold: [[24, 4], [37, 4], [50, 4]], powder: [8, 20], balls: [88, 20],
      };
    }),
  },
};

function insidePoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Rasterise a castle design into local pixels: "x,y" -> material offset. */
function rasterise(c) {
  const px = new Map();
  for (const p of c.parts) {
    if (p.op === 'poly') {
      const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]);
      for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++)
        for (let x = Math.floor(Math.min(...xs)); x < Math.ceil(Math.max(...xs)); x++)
          if (insidePoly(p.pts, x + 0.5, y + 0.5)) px.set(`${x},${y}`, p.m);
      continue;
    }
    const [x0, y0, x1, y1] = p.r;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        if (p.op === 'clear') px.delete(`${x},${y}`);
        else px.set(`${x},${y}`, p.m);
      }
  }
  return px;
}
const rasterCache = new Map();

/**
 * World-space pixels and objects for a castle on side 0 (left) or 1 (right), standing on groundY.
 * The cannon positions double as cannon slots: a bought cannon goes to the first free slot,
 * a bought weather vane to the vane slot (original: market.c).
 */
export function buildCastle(key, side, groundY) {
  const c = CASTLES[key];
  if (!rasterCache.has(key)) rasterCache.set(key, rasterise(c));
  const wx = (x, w = 1) => (side === 0 ? x : W - x - w);
  const pixels = [];
  for (const [k, m] of rasterCache.get(key)) {
    const [x, y] = k.split(',').map(Number);
    pixels.push([wx(x), groundY - 1 - y, BRICK + side + m]);
  }
  const place = (type, [x, y]) => {
    const [w, h] = SIZES[type];
    return { type, x: wx(x, w), y: groundY - y - h, w, h };
  };
  const objects = [
    ...c.cannons.map((p) => place('cannon', p)),
    place('king', c.king),
    place('vane', c.vane),
    ...c.gold.map((p) => place('gold', p)),
    place('powder', c.powder),
    place('balls', c.balls),
  ];
  const cannonSlots = objects.filter((o) => o.type === 'cannon').map(({ x, y }) => ({ x, y }));
  const vane = objects.find((o) => o.type === 'vane');
  return { pixels, objects, cannonSlots, vaneSlot: { x: vane.x, y: vane.y }, width: c.width };
}
