import { W, CELL, COLS, GROUND, SIZES } from './constants.js';

const ORIGIN = [8, W - 8 - COLS * CELL];

/** Castle layouts in cell units: x counted from the back wall, rows counted upward from the ground. */
function layout(fn) {
  const cells = [];
  const objs = [];
  const seen = new Set();
  const R = (x, y, w, h) => {
    for (let i = 0; i < w; i++)
      for (let j = 0; j < h; j++) {
        const k = `${x + i},${y + j}`;
        if (!seen.has(k)) {
          seen.add(k);
          cells.push([x + i, y + j]);
        }
      }
  };
  const B = (x, y, w) => {
    for (let i = 0; i < w; i += 2) R(x + i, y, 1, 1);
  };
  const O = (type, x, row) => objs.push({ type, cx: x, row });
  fn({ R, B, O });
  return { cells, objs };
}

export const CASTLES = {
  falkenfeste: {
    name: 'Falkenfeste',
    desc: 'Ausgewogen. Zwei Kanonen, solides Mauerwerk, ordentliche Kasse.',
    start: { money: 300, powder: 200, balls: 10, pop: 200 },
    layout: layout(({ R, B, O }) => {
      R(0, 0, 32, 3);
      R(0, 3, 6, 15);
      B(0, 18, 6);
      R(26, 3, 6, 11);
      R(10, 3, 2, 6);
      R(20, 3, 2, 6);
      R(10, 9, 12, 2);
      O('vane', 1, 18);
      O('powder', 6, 3);
      O('gold', 12, 3);
      O('king', 14, 3);
      O('gold', 18, 3);
      O('balls', 22, 3);
      O('cannon', 15, 11);
      O('cannon', 27, 14);
    }),
  },
  bollwerk: {
    name: 'Bollwerk',
    desc: 'Dicke Mauern und drei Kanonen, dafür eine knappe Kasse.',
    start: { money: 150, powder: 180, balls: 9, pop: 170 },
    layout: layout(({ R, O }) => {
      R(0, 0, 32, 4);
      R(0, 4, 7, 12);
      R(25, 4, 7, 9);
      R(10, 4, 2, 7);
      R(20, 4, 2, 7);
      R(10, 11, 12, 3);
      O('powder', 7, 4);
      O('gold', 12, 4);
      O('king', 14, 4);
      O('gold', 18, 4);
      O('balls', 22, 4);
      O('cannon', 2, 16);
      O('cannon', 15, 14);
      O('cannon', 26, 13);
      O('vane', 21, 14);
    }),
  },
  nadelturm: {
    name: 'Nadelturm',
    desc: 'Hoher Schussturm und eine reiche Stadt, aber dünne Mauern.',
    start: { money: 450, powder: 200, balls: 10, pop: 230 },
    layout: layout(({ R, O }) => {
      R(0, 0, 32, 2);
      R(2, 2, 4, 22);
      R(9, 2, 2, 6);
      R(19, 2, 2, 6);
      R(9, 8, 12, 2);
      R(24, 2, 8, 6);
      O('vane', 2, 24);
      O('cannon', 3, 24);
      O('powder', 6, 2);
      O('gold', 11, 2);
      O('king', 14, 2);
      O('gold', 17, 2);
      O('balls', 21, 2);
      O('cannon', 26, 8);
    }),
  },
  kanonenhof: {
    name: 'Kanonenhof',
    desc: 'Vier Kanonen auf einer langen Mauer, aber der König hat nur ein dünnes Dach und die Kasse ist leer.',
    start: { money: 90, powder: 140, balls: 10, pop: 140 },
    layout: layout(({ R, O }) => {
      R(0, 0, 32, 2);
      R(0, 2, 32, 4);
      R(12, 6, 1, 5);
      R(16, 6, 1, 5);
      R(12, 11, 5, 1);
      O('cannon', 1, 6);
      O('balls', 5, 6);
      O('cannon', 9, 6);
      O('king', 13, 6);
      O('cannon', 17, 6);
      O('powder', 21, 6);
      O('cannon', 25, 6);
      O('gold', 29, 6);
      O('vane', 31, 6);
    }),
  },
  schatzburg: {
    name: 'Schatzburg',
    desc: 'Reich, drei Geldsäcke, der König sitzt tief im Gewölbe. Nur zwei Kanonen.',
    start: { money: 600, powder: 150, balls: 10, pop: 260 },
    layout: layout(({ R, O }) => {
      R(0, 0, 32, 1);
      R(0, 1, 10, 6);
      R(22, 1, 10, 6);
      R(10, 7, 12, 3);
      R(24, 7, 6, 6);
      O('gold', 10, 1);
      O('gold', 12, 1);
      O('king', 15, 1);
      O('gold', 19, 1);
      O('powder', 2, 7);
      O('balls', 6, 7);
      O('cannon', 14, 10);
      O('vane', 21, 10);
      O('cannon', 25, 13);
    }),
  },
  zwillingstuerme: {
    name: 'Zwillingstürme',
    desc: 'Zwei hohe Schusstürme schießen über jeden Berg, die Halle dazwischen ist niedrig.',
    start: { money: 280, powder: 160, balls: 10, pop: 210 },
    layout: layout(({ R, O }) => {
      R(0, 0, 32, 2);
      R(3, 2, 5, 18);
      R(22, 2, 5, 18);
      R(10, 2, 2, 5);
      R(18, 2, 2, 5);
      R(10, 7, 10, 2);
      O('powder', 0, 2);
      O('gold', 8, 2);
      O('king', 13, 2);
      O('gold', 16, 2);
      O('balls', 28, 2);
      O('cannon', 4, 20);
      O('cannon', 23, 20);
      O('vane', 14, 9);
    }),
  },
};

/** World-space bricks ([x, y] of 4x4 blocks) and objects for a castle on side 0 (left) or 1 (right). */
export function buildCastle(key, side) {
  const L = CASTLES[key].layout;
  const ox = ORIGIN[side];
  const bricks = L.cells.map(([cx, row]) => {
    const mx = side === 0 ? cx : COLS - 1 - cx;
    return [ox + mx * CELL, GROUND - (row + 1) * CELL];
  });
  const objects = L.objs.map((o) => {
    const [w, h] = SIZES[o.type];
    const wc = Math.ceil(w / CELL);
    const mx = side === 0 ? o.cx : COLS - o.cx - wc;
    return { type: o.type, x: ox + mx * CELL, y: GROUND - o.row * CELL - h, w, h };
  });
  return { bricks, objects };
}
