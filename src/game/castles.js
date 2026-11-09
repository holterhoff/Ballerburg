/*
 * Burgen von Burgfehde.
 * Der Datenaufbau folgt dem Prinzip von BALLER.DAT aus Ballerburg ((C) 1987 Eckhard Kruse, GNU GPL v3):
 * Breite, Kanonenplätze, Thron, Windfahne, Lagerkammern (deren Größe die Kapazität bestimmt) und Startwerte.
 * Die Burgen selbst sind eigene Entwürfe.
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

/**
 * Lagerkammern wie im Original: Die Größe einer Kammer legt fest, wie viel hineinpasst.
 * Ein Sack (Zelle 8x10) fasst 150 Gold, ein Fass (Zelle 9x9) 30 Pulver, eine Kugel braucht eine 6x6-Zelle.
 */
export const STORE_CELL = { gold: [8, 10, 150], powder: [9, 9, 30], balls: [6, 6, 1] };

/** How much a chamber [x, y, w, h] of the given kind can hold. */
export function chamberCapacity(kind, [, , w, h]) {
  const [cw, ch, unit] = STORE_CELL[kind];
  return Math.floor(w / cw) * Math.floor(h / ch) * unit;
}

export const CASTLES = {
  falkenstein: {
    name: 'Falkenstein',
    desc: 'Ausgewogen: Bergfried mit Geschütz, große Schatzkammer, der König tief in der Thronhalle.',
    start: { money: 300, powder: 150, balls: 8, pop: 200 },
    ...design(150, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 150, 10);
      wall(0, 10, 32, 76);
      merlons(0, 32, 76, 8, [[9, 23]]);
      room(3, 10, 30, 28);
      wall(32, 10, 104, 54);
      roof(gable(32, 104, 54, 16));
      room(36, 10, 60, 30);
      room(72, 10, 90, 28);
      wall(104, 10, 130, 34);
      room(105, 10, 129, 22);
      wall(130, 10, 150, 62);
      merlons(130, 150, 62, 8, [[133, 147]]);
      return {
        cannons: [[10, 76], [110, 34], [134, 62]],
        king: [75, 10], vane: [66, 68],
        gold: [36, 10, 24, 20], powder: [3, 10, 27, 18], balls: [105, 10, 24, 12],
      };
    }),
  },
  bollwerk: {
    name: 'Bollwerk',
    desc: 'Breiter Wall mit vier Geschützen und großem Kugellager, aber kleiner Schatzkammer.',
    start: { money: 270, powder: 120, balls: 12, pop: 230 },
    ...design(160, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 160, 12);
      wall(0, 12, 160, 40);
      wall(56, 40, 104, 58);
      roof(gable(56, 104, 58, 14));
      room(71, 12, 89, 30);
      room(4, 12, 28, 22);
      room(30, 12, 57, 30);
      room(102, 12, 138, 24);
      wall(0, 40, 12, 66);
      roof(gable(0, 12, 66, 14));
      wall(148, 40, 160, 66);
      roof(gable(148, 160, 66, 14));
      merlons(12, 56, 40, 8, [[17, 31], [35, 49]]);
      merlons(104, 148, 40, 8, [[109, 123], [127, 141]]);
      return {
        cannons: [[18, 40], [36, 40], [110, 40], [128, 40]],
        king: [74, 12], vane: [4, 78],
        gold: [4, 12, 24, 10], powder: [30, 12, 27, 18], balls: [102, 12, 36, 12],
      };
    }),
  },
  hochwacht: {
    name: 'Hochwacht',
    desc: 'Ein schlanker Turm schießt über jeden Berg, davor eine gedrungene Halle mit gut gefüllter Schatzkammer.',
    start: { money: 550, powder: 100, balls: 8, pop: 250 },
    ...design(126, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 126, 8);
      wall(8, 8, 34, 112);
      merlons(8, 34, 112, 8, [[14, 28]]);
      room(10, 8, 28, 26);
      wall(40, 8, 100, 50);
      roof(gable(40, 100, 50, 14));
      room(42, 8, 58, 28);
      room(70, 8, 88, 26);
      wall(104, 8, 126, 30);
      merlons(104, 126, 30, 8, [[107, 121]]);
      room(105, 8, 123, 26);
      return {
        cannons: [[15, 112], [108, 30]],
        king: [73, 8], vane: [68, 62],
        gold: [42, 8, 16, 20], powder: [10, 8, 18, 18], balls: [105, 8, 18, 18],
      };
    }),
  },
  stufenburg: {
    name: 'Stufenburg',
    desc: 'Festung für den langen Krieg: vier Geschütze auf Terrassen, riesige Pulverkammer, wenig Gold.',
    start: { money: 300, powder: 200, balls: 12, pop: 220 },
    ...design(172, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 172, 12);
      wall(0, 12, 142, 24);
      wall(100, 24, 142, 30);
      wall(0, 24, 102, 40);
      wall(0, 40, 58, 60);
      wall(58, 40, 100, 62);
      wall(8, 60, 30, 86);
      roof(gable(8, 30, 86, 20));
      room(66, 12, 84, 28);
      room(4, 12, 40, 30);
      room(40, 42, 56, 52);
      room(102, 12, 138, 24);
      merlons(142, 172, 12, 8, [[148, 164]]);
      return {
        cannons: [[151, 12], [115, 30], [80, 62], [38, 60]],
        king: [69, 12], vane: [17, 104],
        gold: [40, 42, 16, 10], powder: [4, 12, 36, 18], balls: [102, 12, 36, 12],
      };
    }),
  },
  zwillingsburg: {
    name: 'Zwillingsburg',
    desc: 'Zwei Türme mit Spitzdächern: links das Pulver, rechts die Kugeln, dazwischen Schatz und König.',
    start: { money: 540, powder: 100, balls: 8, pop: 240 },
    ...design(162, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 162, 10);
      wall(0, 10, 26, 80);
      roof(gable(0, 26, 80, 24));
      wall(110, 10, 136, 70);
      roof(gable(110, 136, 70, 22));
      wall(26, 10, 110, 44);
      wall(54, 44, 88, 56);
      roof(gable(54, 88, 56, 12));
      merlons(26, 54, 44, 8, [[32, 48]]);
      merlons(88, 110, 44, 8, [[89, 103]]);
      room(62, 10, 80, 28);
      room(32, 10, 48, 30);
      room(4, 10, 22, 28);
      room(111, 10, 135, 22);
      wall(136, 10, 162, 34);
      merlons(136, 162, 34, 8, [[142, 156]]);
      return {
        cannons: [[34, 44], [90, 44], [143, 34]],
        king: [65, 10], vane: [121, 90],
        gold: [32, 10, 16, 20], powder: [4, 10, 18, 18], balls: [111, 10, 24, 12],
      };
    }),
  },
  schatzburg: {
    name: 'Schatzburg',
    desc: 'Reich: eine riesige Schatzkammer im Palas, aber nur zwei Geschütze und ein kleines Kugellager.',
    start: { money: 480, powder: 120, balls: 6, pop: 300 },
    ...design(186, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 186, 16);
      wall(0, 16, 122, 50);
      roof(gable(0, 122, 50, 22));
      room(4, 18, 44, 38);
      room(56, 20, 74, 38);
      room(86, 20, 113, 38);
      wall(130, 16, 158, 90);
      merlons(130, 158, 90, 8, [[135, 149]]);
      room(134, 16, 152, 28);
      wall(158, 16, 186, 36);
      merlons(158, 186, 36, 8, [[164, 178]]);
      return {
        cannons: [[136, 90], [165, 36]],
        king: [59, 20], vane: [59, 70],
        gold: [4, 18, 40, 20], powder: [86, 20, 27, 18], balls: [134, 16, 18, 12],
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
  const chamber = (type) => {
    const [x, y, w, h] = c[type];
    return { type, x: wx(x, w), y: groundY - y - h, w, h };
  };
  const objects = [
    ...c.cannons.map((p) => place('cannon', p)),
    place('king', c.king),
    place('vane', c.vane),
    chamber('gold'),
    chamber('powder'),
    chamber('balls'),
  ];
  const cannonSlots = objects.filter((o) => o.type === 'cannon').map(({ x, y }) => ({ x, y }));
  const vane = objects.find((o) => o.type === 'vane');
  const caps = { money: chamberCapacity('gold', c.gold), powder: chamberCapacity('powder', c.powder), balls: chamberCapacity('balls', c.balls) };
  return { pixels, objects, cannonSlots, vaneSlot: { x: vane.x, y: vane.y }, width: c.width, caps };
}
