/*
 * Burgen der Ballerburg-Neufassung.
 * Der Datenaufbau folgt dem Prinzip von BALLER.DAT aus Ballerburg ((C) 1987 Eckhard Kruse, GNU GPL v3):
 * Breite, Kanonenplätze, Thron, Windfahne, Lagerkammern (deren Größe die Kapazität bestimmt) und Startwerte.
 * Die sechs Original-Burgen werden direkt aus der Original-BALLER.DAT gelesen
 * (siehe ballerdat.js, mit Erlaubnis von Eckhard Kruse). Alle anderen Burgen sind eigene Entwürfe.
 *
 * Koordinaten: x zählt von der Außenkante der Burg (0) zum Berg hin, y vom Boden (0) nach oben.
 * Die rechte Burg wird gespiegelt. Objektpositionen bezeichnen die linke untere Ecke.
 */
import { W, SIZES, BRICK } from './constants.js';
import { BALLER_DAT } from './ballerdat.js';

/** Material offset on top of BRICK + side: 0 = wall, ROOF = roof tiles. */
export const ROOF = 2;

function design(width, build) {
  const parts = [];
  const api = {
    /** solid wall rectangle [x0, x1) x [y0, y1) */
    wall: (x0, y0, x1, y1) => parts.push({ op: 'rect', m: 0, r: [x0, y0, x1, y1] }),
    /** roof polygon, drawn in roof tiles */
    roof: (pts) => parts.push({ op: 'poly', m: ROOF, pts }),
    /** solid wall polygon (used by the original castles) */
    body: (pts, m = 0) => parts.push({ op: 'poly', m, pts }),
    /** cut a room out of the walls */
    room: (x0, y0, x1, y1) => parts.push({ op: 'clear', r: [x0, y0, x1, y1] }),
    /** battlements: merlons 4 wide and 6 high every `step` pixels, leaving gaps free for cannons */
    merlons: (x0, x1, y, step = 8, gaps = []) => {
      for (let x = x0; x + 4 <= x1; x += step) if (!gaps.some(([a, b]) => x + 4 > a && x < b)) parts.push({ op: 'rect', m: 0, r: [x, y, x + 4, y + 6] });
    },
  };
  const c = { width, parts, ...build(api) };
  if (!c.throne && c.king) {
    // Original: every throne room is 30x25 (drin(bg[21], bg[22], 30, 25)). Our castles get the
    // same hall, centred on the king and standing on his floor.
    const [kx, ky] = c.king;
    const tx = Math.round(kx + SIZES.king[0] / 2 - 15);
    c.throne = [tx, ky, 30, 25];
    parts.push({ op: 'clear', r: [tx, ky, tx + 30, ky + 25] });
  }
  return c;
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
    start: { money: 400, powder: 160, balls: 8, pop: 240 },
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
    start: { money: 450, powder: 160, balls: 12, pop: 330 },
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
    start: { money: 520, powder: 110, balls: 9, pop: 220 },
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
    desc: 'Festung für den langen Krieg: fünf Geschütze auf Terrassen und dem Turm, riesige Pulverkammer, wenig Gold.',
    start: { money: 540, powder: 240, balls: 12, pop: 500 },
    ...design(172, ({ wall, room, merlons }) => {
      wall(0, 0, 172, 12);
      wall(0, 12, 142, 24);
      wall(100, 24, 142, 30);
      wall(0, 24, 102, 40);
      wall(0, 40, 58, 60);
      wall(58, 40, 100, 62);
      wall(8, 60, 30, 90);
      merlons(8, 30, 90, 8, [[12, 26]]);
      room(66, 12, 84, 28);
      room(4, 12, 40, 30);
      room(40, 42, 56, 52);
      room(102, 12, 138, 24);
      merlons(142, 172, 12, 8, [[148, 164]]);
      return {
        cannons: [[151, 12], [115, 30], [80, 62], [38, 60], [13, 90]],
        king: [69, 12], vane: [32, 60],
        gold: [40, 42, 16, 10], powder: [4, 12, 36, 18], balls: [102, 12, 36, 12],
      };
    }),
  },
  zwillingsburg: {
    name: 'Zwillingsburg',
    desc: 'Zwei Türme mit Spitzdächern: links das Pulver, rechts die Kugeln, dazwischen Schatz und König.',
    start: { money: 650, powder: 130, balls: 9, pop: 290 },
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
    start: { money: 600, powder: 140, balls: 6, pop: 350 },
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
  kanonenfeste: {
    name: 'Kanonenfeste',
    desc: 'Sieben Geschütze auf einem langen Wall und dem Bergfried, aber wenig Volk und Gold.',
    start: { money: 200, powder: 110, balls: 10, pop: 160 },
    ...design(190, ({ wall, room, merlons }) => {
      wall(0, 0, 190, 12);
      wall(0, 12, 190, 36);
      wall(76, 36, 124, 62);
      room(4, 12, 28, 32);
      room(44, 12, 78, 30);
      room(91, 12, 109, 30);
      room(122, 12, 170, 24);
      merlons(0, 76, 36, 8, [[7, 21], [25, 39], [49, 63]]);
      merlons(124, 190, 36, 8, [[129, 143], [149, 163], [169, 183]]);
      merlons(76, 124, 62, 8, [[81, 87], [99, 113]]);
      return {
        cannons: [[8, 36], [26, 36], [50, 36], [130, 36], [150, 36], [170, 36], [100, 62]],
        king: [94, 12], vane: [82, 62],
        gold: [4, 12, 24, 20], powder: [44, 12, 34, 18], balls: [122, 12, 48, 12],
      };
    }),
  },
  kolossburg: {
    name: 'Kolossburg',
    desc: 'Das Maximum: acht Geschütze, zwei Türme, Palas mit Wehrgang, riesige Schatz-, Pulver- und Kugelkammern.',
    start: { money: 140, powder: 80, balls: 6, pop: 130 },
    ...design(196, ({ wall, room, merlons }) => {
      wall(0, 0, 196, 14);
      wall(0, 14, 196, 44);
      wall(0, 44, 24, 96);
      wall(172, 44, 196, 90);
      wall(70, 44, 130, 74);
      room(26, 14, 74, 34);
      room(91, 14, 109, 32);
      room(124, 14, 170, 32);
      room(3, 48, 21, 84);
      merlons(24, 70, 44, 8, [[27, 41], [47, 61]]);
      merlons(130, 172, 44, 8, [[133, 147], [153, 167]]);
      merlons(0, 24, 96, 8, [[5, 19]]);
      merlons(172, 196, 90, 8, [[177, 191]]);
      merlons(70, 130, 74, 8, [[77, 91], [95, 101], [109, 123]]);
      return {
        cannons: [[28, 44], [48, 44], [134, 44], [154, 44], [6, 96], [178, 90], [78, 74], [110, 74]],
        king: [94, 14], vane: [96, 74],
        gold: [26, 14, 48, 20], powder: [3, 48, 18, 36], balls: [124, 14, 46, 18],
      };
    }),
  },
  felsennest: {
    name: 'Felsennest',
    desc: 'Ein mächtiger Wohnturm, 120 Schritt hoch: zwei Geschütze ganz oben, zwei auf dem Vorwerk.',
    start: { money: 250, powder: 100, balls: 8, pop: 160 },
    ...design(112, ({ wall, room, merlons }) => {
      wall(0, 0, 112, 10);
      wall(0, 10, 60, 120);
      wall(60, 10, 112, 40);
      room(21, 10, 39, 28);
      room(6, 60, 30, 80);
      room(34, 60, 52, 78);
      room(64, 10, 100, 22);
      merlons(0, 60, 120, 8, [[7, 21], [35, 49], [51, 57]]);
      merlons(60, 112, 40, 8, [[69, 83], [91, 105]]);
      return {
        cannons: [[8, 120], [36, 120], [70, 40], [92, 40]],
        king: [24, 10], vane: [52, 120],
        gold: [6, 60, 24, 20], powder: [34, 60, 18, 18], balls: [64, 10, 36, 12],
      };
    }),
  },
  speicherburg: {
    name: 'Speicherburg',
    desc: 'Ein riesiges Lagerhaus mit gewaltigen Kammern für Gold, Pulver und Kugeln, aber nur zwei Geschütze.',
    start: { money: 540, powder: 130, balls: 10, pop: 230 },
    ...design(190, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 190, 12);
      wall(0, 12, 150, 58);
      roof(gable(0, 150, 58, 24));
      wall(150, 12, 190, 80);
      room(4, 14, 52, 44);
      room(67, 12, 85, 30);
      room(97, 14, 142, 41);
      room(154, 14, 184, 38);
      merlons(150, 190, 80, 8, [[150, 156], [155, 169], [173, 187]]);
      return {
        cannons: [[156, 80], [174, 80]],
        king: [70, 12], vane: [151, 80],
        gold: [4, 14, 48, 30], powder: [97, 14, 45, 27], balls: [154, 14, 30, 24],
      };
    }),
  },
  bastei: {
    name: 'Bastei',
    desc: 'Flach und breit, kaum zu treffen: sechs Geschütze auf dem Erdwall, der König unter dem Hügel.',
    start: { money: 285, powder: 120, balls: 11, pop: 190 },
    ...design(180, ({ wall, room, merlons }) => {
      wall(0, 0, 180, 14);
      wall(0, 14, 180, 40);
      wall(64, 40, 116, 60);
      room(4, 14, 31, 32);
      room(34, 14, 58, 34);
      room(81, 14, 99, 32);
      room(112, 14, 160, 26);
      merlons(0, 64, 40, 8, [[5, 19], [27, 41], [45, 59]]);
      merlons(116, 180, 40, 8, [[123, 137], [143, 157], [163, 177]]);
      merlons(64, 116, 60, 8, [[87, 93]]);
      return {
        cannons: [[6, 40], [28, 40], [46, 40], [124, 40], [144, 40], [164, 40]],
        king: [84, 14], vane: [88, 60],
        gold: [34, 14, 24, 20], powder: [4, 14, 27, 18], balls: [112, 14, 48, 12],
      };
    }),
  },
  abtei: {
    name: 'Abtei',
    desc: 'Kirchenschiff mit Glockenturm: viel Volk und eine volle Schatzkammer, nur zwei Geschütze.',
    start: { money: 580, powder: 120, balls: 9, pop: 300 },
    ...design(170, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 170, 10);
      wall(0, 10, 110, 50);
      roof(gable(0, 110, 50, 26));
      wall(110, 10, 140, 100);
      wall(140, 10, 170, 34);
      room(4, 12, 33, 32);
      room(45, 10, 63, 28);
      room(75, 12, 102, 30);
      room(113, 12, 137, 30);
      merlons(110, 140, 100, 8, [[118, 132]]);
      merlons(140, 170, 34, 8, [[145, 159], [161, 167]]);
      return {
        cannons: [[119, 100], [146, 34]],
        king: [48, 10], vane: [162, 34],
        gold: [4, 12, 29, 20], powder: [75, 12, 27, 18], balls: [113, 12, 24, 18],
      };
    }),
  },
  pulverturm: {
    name: 'Pulverturm',
    desc: 'Ein dicker Turm voller Pulverfässer – ein Treffer dort kostet allerdings alles.',
    start: { money: 320, powder: 180, balls: 8, pop: 220 },
    ...design(150, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 150, 10);
      wall(0, 10, 100, 44);
      roof(gable(0, 100, 44, 22));
      wall(0, 44, 14, 70);
      wall(100, 10, 150, 96);
      room(4, 12, 25, 32);
      room(37, 10, 55, 28);
      room(67, 12, 91, 24);
      room(104, 12, 146, 66);
      merlons(100, 150, 96, 8, [[103, 117], [127, 141], [145, 150]]);
      return {
        cannons: [[1, 70], [104, 96], [128, 96]],
        king: [40, 10], vane: [146, 96],
        gold: [4, 12, 21, 20], powder: [104, 12, 42, 54], balls: [67, 12, 24, 12],
      };
    }),
  },
  giesserei: {
    name: 'Gießerei',
    desc: 'Eine Kugelgießerei mit Schlot: ein riesiges Kugellager und fünf Geschütze.',
    start: { money: 300, powder: 110, balls: 16, pop: 200 },
    ...design(168, ({ wall, room, merlons }) => {
      wall(0, 0, 168, 12);
      wall(0, 12, 168, 40);
      wall(50, 40, 118, 64);
      wall(30, 40, 40, 84);
      room(4, 12, 62, 36);
      room(75, 12, 93, 30);
      room(106, 14, 130, 34);
      room(134, 14, 164, 32);
      merlons(0, 30, 40, 8, [[7, 21]]);
      merlons(118, 168, 40, 8, [[137, 151], [153, 167]]);
      merlons(50, 118, 64, 8, [[59, 73], [83, 89], [95, 109]]);
      return {
        cannons: [[8, 40], [138, 40], [154, 40], [60, 64], [96, 64]],
        king: [78, 12], vane: [84, 64],
        gold: [106, 14, 24, 20], powder: [134, 14, 30, 18], balls: [4, 12, 58, 24],
      };
    }),
  },
  grenzfort: {
    name: 'Grenzfort',
    desc: 'Klein und wehrhaft: vier Geschütze, kleine Lager, wenig Volk.',
    start: { money: 430, powder: 140, balls: 12, pop: 240 },
    ...design(120, ({ wall, room, merlons }) => {
      wall(0, 0, 120, 10);
      wall(0, 10, 120, 50);
      wall(44, 50, 84, 62);
      room(4, 12, 20, 32);
      room(22, 12, 40, 30);
      room(55, 10, 73, 28);
      room(86, 12, 116, 24);
      merlons(0, 44, 50, 8, [[3, 17], [21, 35]]);
      merlons(84, 120, 50, 8, [[89, 103], [105, 119]]);
      merlons(44, 84, 62, 8, [[61, 67]]);
      return {
        cannons: [[4, 50], [22, 50], [90, 50], [106, 50]],
        king: [58, 10], vane: [62, 62],
        gold: [4, 12, 16, 20], powder: [22, 12, 18, 18], balls: [86, 12, 30, 12],
      };
    }),
  },
  adlerhorst: {
    name: 'Adlerhorst',
    desc: 'Schlanker Turm, 120 Schritt hoch, ganz oben ein Geschütz und die Schatzkammer, zwei weitere auf dem Vorwerk.',
    start: { money: 560, powder: 140, balls: 9, pop: 280 },
    ...design(100, ({ wall, room, merlons }) => {
      wall(0, 0, 100, 8);
      wall(30, 8, 62, 122);
      wall(62, 8, 100, 30);
      wall(0, 8, 30, 26);
      room(37, 8, 55, 26);
      room(34, 60, 58, 80);
      room(68, 10, 96, 28);
      room(4, 10, 24, 22);
      merlons(30, 62, 122, 8, [[33, 47], [51, 57]]);
      merlons(62, 100, 30, 8, [[65, 79], [83, 97]]);
      merlons(0, 30, 26, 8);
      return {
        cannons: [[34, 122], [66, 30], [84, 30]],
        king: [40, 8], vane: [52, 122],
        gold: [34, 60, 24, 20], powder: [68, 10, 28, 18], balls: [4, 10, 20, 12],
      };
    }),
  },
  ringburg: {
    name: 'Ringburg',
    desc: 'Vier Türme und drei Mauerstücke, sieben Geschütze rundum, der König unter dem inneren Turm.',
    start: { money: 250, powder: 100, balls: 9, pop: 190 },
    ...design(180, ({ wall, room, merlons }) => {
      wall(0, 0, 180, 12);
      wall(0, 12, 180, 38);
      wall(0, 38, 22, 74);
      wall(52, 38, 74, 70);
      wall(106, 38, 128, 70);
      wall(158, 38, 180, 76);
      room(6, 14, 30, 34);
      room(54, 12, 72, 30);
      room(86, 14, 104, 32);
      room(130, 14, 172, 26);
      merlons(0, 22, 74, 8, [[4, 18]]);
      merlons(52, 74, 70, 8, [[56, 70]]);
      merlons(106, 128, 70, 8, [[110, 124]]);
      merlons(158, 180, 76, 8, [[162, 176]]);
      merlons(22, 52, 38, 8, [[29, 43]]);
      merlons(74, 106, 38, 8, [[83, 97], [99, 105]]);
      merlons(128, 158, 38, 8, [[135, 149]]);
      return {
        cannons: [[5, 74], [57, 70], [111, 70], [163, 76], [30, 38], [84, 38], [136, 38]],
        king: [57, 12], vane: [100, 38],
        gold: [6, 14, 24, 20], powder: [86, 14, 18, 18], balls: [130, 14, 42, 12],
      };
    }),
  },
  zitadelle: {
    name: 'Zitadelle',
    desc: 'Bergfried, Eckturm und zwei Bastionen zum Berg hin: fünf Geschütze auf vier Ebenen.',
    start: { money: 150, powder: 90, balls: 8, pop: 140 },
    ...design(176, ({ wall, room, merlons }) => {
      wall(0, 0, 176, 12);
      wall(0, 12, 120, 46);
      wall(0, 46, 22, 84);
      wall(30, 46, 90, 76);
      wall(120, 12, 150, 34);
      wall(150, 12, 176, 22);
      room(10, 14, 34, 34);
      room(51, 12, 69, 30);
      room(82, 14, 112, 32);
      room(124, 14, 148, 26);
      merlons(0, 22, 84, 8, [[4, 18]]);
      merlons(30, 90, 76, 8, [[55, 61], [69, 83]]);
      merlons(90, 120, 46, 8, [[99, 113]]);
      merlons(120, 150, 34, 8, [[129, 143]]);
      merlons(150, 176, 22, 8, [[155, 169]]);
      return {
        cannons: [[5, 84], [70, 76], [100, 46], [130, 34], [156, 22]],
        king: [54, 12], vane: [56, 76],
        gold: [10, 14, 24, 20], powder: [82, 14, 30, 18], balls: [124, 14, 24, 12],
      };
    }),
  },
  turmstadt: {
    name: 'Turmstadt',
    desc: 'Drei Türme verschiedener Höhe auf einer Stadtmauer, fünf Geschütze, Kugellager im hohen Turm.',
    start: { money: 300, powder: 110, balls: 10, pop: 200 },
    ...design(170, ({ wall, room, merlons }) => {
      wall(0, 0, 170, 10);
      wall(0, 10, 170, 34);
      wall(4, 34, 30, 110);
      wall(70, 34, 100, 80);
      wall(140, 34, 166, 60);
      room(36, 10, 60, 30);
      room(76, 10, 94, 28);
      room(108, 10, 135, 28);
      room(8, 40, 26, 64);
      merlons(4, 30, 110, 8, [[7, 21]]);
      merlons(70, 100, 80, 8, [[78, 97]]);
      merlons(140, 166, 60, 8, [[146, 160]]);
      merlons(30, 70, 34, 8, [[39, 53]]);
      merlons(100, 140, 34, 8, [[111, 125]]);
      return {
        cannons: [[8, 110], [79, 80], [147, 60], [40, 34], [112, 34]],
        king: [79, 10], vane: [92, 80],
        gold: [36, 10, 24, 20], powder: [108, 10, 27, 18], balls: [8, 40, 18, 24],
      };
    }),
  },
  doppelwall: {
    name: 'Doppelwall',
    desc: 'Hinter einem Graben eine Vormauer mit drei Geschützen, dahinter das Haupthaus mit Eckturm.',
    start: { money: 260, powder: 120, balls: 11, pop: 200 },
    ...design(190, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 190, 12);
      wall(0, 12, 110, 56);
      roof(gable(0, 110, 56, 20));
      wall(0, 56, 20, 90);
      wall(130, 12, 190, 34);
      room(4, 14, 30, 34);
      room(43, 12, 61, 30);
      room(74, 14, 101, 32);
      room(136, 14, 184, 26);
      merlons(0, 20, 90, 8, [[3, 17]]);
      merlons(130, 190, 34, 8, [[131, 151], [157, 171], [175, 189]]);
      return {
        cannons: [[4, 90], [138, 34], [158, 34], [176, 34]],
        king: [46, 12], vane: [132, 34],
        gold: [4, 14, 24, 20], powder: [74, 14, 27, 18], balls: [136, 14, 48, 12],
      };
    }),
  },
  wasserburg: {
    name: 'Wasserburg',
    desc: 'Lang und flach, zwei Ecktürme und ein Torhaus, sechs Geschütze und eine große Schatzkammer.',
    start: { money: 290, powder: 110, balls: 9, pop: 220 },
    ...design(196, ({ wall, room, merlons }) => {
      wall(0, 0, 196, 12);
      wall(0, 12, 196, 40);
      wall(0, 40, 24, 66);
      wall(172, 40, 196, 66);
      wall(84, 40, 112, 72);
      room(6, 14, 48, 36);
      room(88, 12, 106, 30);
      room(118, 14, 146, 34);
      room(152, 14, 190, 28);
      merlons(0, 24, 66, 8, [[4, 18]]);
      merlons(172, 196, 66, 8, [[176, 190]]);
      merlons(84, 112, 72, 8, [[90, 104]]);
      merlons(24, 84, 40, 8, [[33, 47]]);
      merlons(112, 172, 40, 8, [[125, 139], [149, 163]]);
      return {
        cannons: [[5, 66], [91, 72], [177, 66], [34, 40], [126, 40], [150, 40]],
        king: [91, 12], vane: [104, 72],
        gold: [6, 14, 40, 20], powder: [118, 14, 27, 18], balls: [152, 14, 36, 12],
      };
    }),
  },
  hexenturm: {
    name: 'Hexenturm',
    desc: 'Ein sehr hoher Turm an der Außenkante mit einem Geschütz ganz oben, davor eine niedrige Mauer.',
    start: { money: 540, powder: 150, balls: 11, pop: 250 },
    ...design(150, ({ wall, room, merlons }) => {
      wall(0, 0, 150, 12);
      wall(0, 12, 150, 36);
      wall(0, 36, 36, 120);
      room(12, 12, 30, 30);
      room(42, 14, 66, 34);
      room(76, 14, 106, 32);
      room(114, 14, 146, 26);
      merlons(0, 36, 120, 8, [[11, 25]]);
      merlons(36, 150, 36, 8, [[73, 87], [99, 113], [125, 139]]);
      return {
        cannons: [[12, 120], [74, 36], [100, 36], [126, 36]],
        king: [15, 12], vane: [144, 36],
        gold: [42, 14, 24, 20], powder: [76, 14, 27, 18], balls: [114, 14, 30, 12],
      };
    }),
  },
  schildmauer: {
    name: 'Schildmauer',
    desc: 'Eine dicke, hohe Mauer zum Berg hin schützt den König, dahinter das Wohnhaus mit Giebeldach.',
    start: { money: 300, powder: 120, balls: 9, pop: 200 },
    ...design(184, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 184, 12);
      wall(0, 12, 184, 34);
      wall(0, 34, 90, 58);
      roof(gable(2, 90, 58, 18));
      wall(140, 34, 184, 100);
      room(6, 14, 30, 34);
      room(40, 14, 70, 32);
      room(84, 14, 132, 26);
      room(152, 40, 170, 58);
      merlons(140, 184, 100, 8, [[146, 160], [166, 180]]);
      merlons(90, 140, 34, 8, [[99, 113], [119, 133]]);
      return {
        cannons: [[147, 100], [167, 100], [100, 34], [120, 34]],
        king: [155, 40], vane: [134, 34],
        gold: [6, 14, 24, 20], powder: [40, 14, 27, 18], balls: [84, 14, 48, 12],
      };
    }),
  },
  drachenhort: {
    name: 'Drachenhort',
    desc: 'Ein riesiger Goldschatz unter dem Haupthaus, aber nur drei Geschütze und wenig Kugeln.',
    start: { money: 450, powder: 90, balls: 6, pop: 230 },
    ...design(180, ({ wall, roof, room, merlons }) => {
      wall(0, 0, 180, 12);
      wall(0, 12, 180, 44);
      wall(60, 44, 110, 80);
      roof(gable(60, 110, 80, 22));
      wall(0, 44, 22, 72);
      wall(158, 44, 180, 70);
      room(4, 14, 60, 38);
      room(76, 12, 94, 30);
      room(108, 14, 138, 32);
      room(144, 14, 176, 26);
      merlons(0, 22, 72, 8, [[4, 18]]);
      merlons(158, 180, 70, 8, [[162, 176]]);
      merlons(110, 158, 44, 8, [[121, 135]]);
      merlons(22, 60, 44, 8);
      return {
        cannons: [[5, 72], [163, 70], [122, 44]],
        king: [79, 12], vane: [137, 44],
        gold: [4, 14, 56, 20], powder: [108, 14, 27, 18], balls: [144, 14, 30, 12],
      };
    }),
  },
  kasematte: {
    name: 'Kasematte',
    desc: 'Ein flacher, massiver Bunker: vier Geschütze auf dem Dach, viele Kugeln, der König tief im Stein.',
    start: { money: 230, powder: 110, balls: 13, pop: 175 },
    ...design(176, ({ wall, room, merlons }) => {
      wall(0, 0, 176, 12);
      wall(0, 12, 176, 62);
      room(6, 14, 30, 34);
      room(78, 12, 96, 30);
      room(108, 14, 138, 32);
      room(144, 14, 172, 38);
      merlons(0, 176, 62, 8, [[5, 19], [45, 59], [95, 109], [145, 159]]);
      return {
        cannons: [[6, 62], [46, 62], [96, 62], [146, 62]],
        king: [81, 12], vane: [116, 62],
        gold: [6, 14, 24, 20], powder: [108, 14, 27, 18], balls: [144, 14, 24, 24],
      };
    }),
  },
  fuchsbau: {
    name: 'Fuchsbau',
    desc: 'Niedrig und geduckt hinter einem Erdhügel aus Stein, vier Geschütze auf zwei Ebenen.',
    start: { money: 400, powder: 140, balls: 10, pop: 240 },
    ...design(172, ({ wall, room, merlons }) => {
      wall(0, 0, 172, 12);
      wall(0, 12, 172, 40);
      wall(50, 40, 120, 64);
      room(8, 14, 32, 34);
      room(76, 12, 94, 30);
      room(106, 14, 136, 32);
      room(142, 14, 168, 26);
      merlons(50, 120, 64, 8, [[55, 69], [99, 113]]);
      merlons(0, 50, 40, 8, [[3, 17]]);
      merlons(120, 172, 40, 8, [[137, 151]]);
      return {
        cannons: [[56, 64], [100, 64], [4, 40], [138, 40]],
        king: [79, 12], vane: [78, 64],
        gold: [8, 14, 24, 20], powder: [106, 14, 27, 18], balls: [142, 14, 24, 12],
      };
    }),
  },
  kronburg: {
    name: 'Kronburg',
    desc: 'Ein hoher Bergfried mit Zinnenkrone in der Mitte, zwei Ecktürme, vier Geschütze.',
    start: { money: 250, powder: 130, balls: 9, pop: 220 },
    ...design(186, ({ wall, room, merlons }) => {
      wall(0, 0, 186, 12);
      wall(0, 12, 186, 38);
      wall(0, 38, 26, 80);
      wall(160, 38, 186, 80);
      wall(72, 38, 114, 96);
      room(6, 14, 30, 34);
      room(84, 12, 102, 30);
      room(114, 14, 144, 32);
      room(150, 14, 180, 26);
      merlons(0, 26, 80, 8, [[4, 18]]);
      merlons(160, 186, 80, 8, [[164, 178]]);
      merlons(72, 114, 96, 8, [[80, 94]]);
      merlons(26, 72, 38, 8);
      merlons(114, 160, 38, 8, [[125, 139]]);
      return {
        cannons: [[5, 80], [165, 80], [81, 96], [126, 38]],
        king: [87, 12], vane: [100, 96],
        gold: [6, 14, 24, 20], powder: [114, 14, 27, 18], balls: [150, 14, 30, 12],
      };
    }),
  },
  brueckenburg: {
    name: 'Brückenburg',
    desc: 'Zwei Türme, verbunden durch eine hohe Brücke mit Geschütz; fünf Geschütze, unter der Brücke nur Luft.',
    start: { money: 260, powder: 120, balls: 10, pop: 230 },
    ...design(196, ({ wall, room, merlons }) => {
      wall(0, 0, 196, 12);
      wall(0, 12, 54, 90);
      wall(142, 12, 196, 74);
      wall(54, 58, 142, 72);
      room(18, 40, 36, 58);
      room(6, 14, 30, 36);
      room(150, 14, 180, 32);
      room(150, 40, 190, 52);
      merlons(0, 54, 90, 8, [[5, 19], [33, 47]]);
      merlons(142, 196, 74, 8, [[147, 161], [175, 189]]);
      merlons(54, 142, 72, 8, [[85, 99]]);
      return {
        cannons: [[6, 90], [34, 90], [148, 74], [176, 74], [86, 72]],
        king: [21, 40], vane: [66, 72],
        gold: [6, 14, 24, 20], powder: [150, 14, 27, 18], balls: [150, 40, 36, 12],
      };
    }),
  },
};

/* ================= Original-Burgen aus BALLER.DAT (1987) ================= */

/** Reads all numbers like rdzahl() in the original: text between two '*' is a remark. */
function datNumbers(text) {
  const out = [];
  let rem = false, cur = '';
  for (const ch of text + ' ') {
    if (ch === '*') { rem = !rem; continue; }
    if (!rem && (ch === '-' ? cur === '' : ch >= '0' && ch <= '9')) { cur += ch; continue; }
    if (cur && cur !== '-') out.push(Number(cur));
    cur = '';
  }
  return out;
}

/**
 * Neufassung: Die Original-Burgen sind sehr unterschiedlich stark (im Computer-Turnier gewann Burg 2
 * 96 % ihrer Partien). Damit die Wahl fair bleibt, beginnen die starken mit weniger Gold, Pulver,
 * Kugeln und Volk. Umrisse und Geschütze bleiben wie im Original.
 * Die Originalwerte stehen weiter in BALLER.DAT.
 */
const BALANCE = {
  original1: { start: { money: 520, pop: 240 } },
  original2: { start: { money: 120, powder: 60, balls: 4, pop: 130 } },
  original3: { start: { money: 280, powder: 90, balls: 7, pop: 190 } },
  original4: { start: { money: 130, powder: 60, balls: 4, pop: 140 } },
  original5: { start: { pop: 300 } },
  original6: { start: { money: 270, powder: 80, balls: 5, pop: 180 } },
};

/** This version gives the six original castles names; in the original they only had numbers. */
const ORIGINAL_NAMES = ['Altenstein', 'Hohe Warte', 'Treppenfels', 'Königsfeste', 'Klausenburg', 'Mittelturm'];

/** Turns BALLER.DAT into castles in this version's format. */
function originalCastles(text) {
  const n = datNumbers(text);
  const castles = {};
  let i = 0, k = 0;
  while (n[i] !== -999 && i < n.length) {
    const bg = n.slice(i, i + 41); // bg[0] = width, bg[1..40] as in the original
    i += 41;
    const draw = [];
    while (n[i] !== -1) draw.push(n[i++]);
    i++;
    const at = (j) => [bg[j], bg[j + 1]];
    const cannons = [];
    for (let c = 0; c < 10 && bg[1 + c * 2] > -1; c++) cannons.push(at(1 + c * 2));
    const [kx, ky] = at(21), [vx, vy] = at(23);
    const chamber = (j) => [bg[25 + j * 2], bg[26 + j * 2], bg[31 + j * 2], bg[32 + j * 2]];
    const gold = chamber(0), powder = chamber(1), balls = chamber(2);
    k++;
    castles[`original${k}`] = {
      name: `${ORIGINAL_NAMES[k - 1] ?? `Burg ${k}`} (Original)`,
      desc: `Burg nach der Idee von Eckhard Kruse, dem Erfinder von Ballerburg (1987).`,
      original: true,
      start: { money: bg[37], powder: bg[38], balls: bg[39], pop: bg[40], ...BALANCE[`original${k}`]?.start },
      ...design(bg[0], ({ body, room }) => {
        // draw(): the first four values are unused, then polygons; -2,a,b switches to the roof pattern
        let j = 4, mat = 'wall';
        while (j < draw.length) {
          if (draw[j] === -2) { mat = 'roof'; j += 3; continue; }
          if (draw[j] === -4) { j++; continue; }
          const pts = [];
          while (j < draw.length && draw[j] > -1) { pts.push([draw[j], draw[j + 1]]); j += 2; }
          j++;
          if (pts.length > 2) body(pts, mat === 'roof' ? ROOF : 0);
        }
        // the original clears a 30x25 throne room and the three chambers out of the walls
        room(kx, ky, kx + 30, ky + 25);
        for (const [x, y, w, h] of [gold, powder, balls]) room(x, y, x + w, y + h);
        return {
          cannons,
          // original drin(bg[21], bg[22], 30, 25): a hit anywhere in the throne room hits the king
          throne: [kx, ky, 30, 25],
          king: [kx + 9, ky], vane: [vx - 2, vy],
          gold, powder, balls,
        };
      }),
    };
    settleObjects(castles[`original${k}`]);
  }
  return castles;
}

/**
 * The Atari drew cannons and the vane as sprites over the walls. Here they are objects in the
 * pixel world, so each one is nudged by a few pixels until it stands free on the masonry.
 */
function settleObjects(c) {
  const px = rasterise(c);
  const solid = (x, y) => y < 0 || px.has(`${x},${y}`);
  const overlaps = (x, y, w, h) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (solid(i, j)) return true; return false; };
  const supported = (x, y, w) => { for (let i = x; i < x + w; i++) if (solid(i, y - 1)) return true; return false; };
  const settle = ([x, y], [w, h]) => {
    let ny = y;
    while (overlaps(x, ny, w, h) && ny < y + 8) ny++;
    while (!supported(x, ny, w) && !overlaps(x, ny - 1, w, h) && ny > y - 8) ny--;
    return [x, ny];
  };
  c.cannons = c.cannons.map((p) => settle(p, SIZES.cannon));
  c.vane = settle(c.vane, SIZES.vane);
}

// the original castles come first in the list, then this version's own designs
{
  const own = { ...CASTLES };
  for (const k of Object.keys(CASTLES)) delete CASTLES[k];
  Object.assign(CASTLES, originalCastles(BALLER_DAT), own);
}

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
  const rooms = new Set();
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
        if (p.op === 'clear') { px.delete(`${x},${y}`); rooms.add(`${x},${y}`); }
        else { px.set(`${x},${y}`, p.m); rooms.delete(`${x},${y}`); }
      }
  }
  // remember the hollow rooms (chambers, throne hall) so they get a back wall instead of sky
  px.rooms = [...rooms].filter((k) => !px.has(k));
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
  const rooms = rasterCache.get(key).rooms.map((k) => {
    const [x, y] = k.split(',').map(Number);
    return [wx(x), groundY - 1 - y];
  });
  const place = (type, [x, y]) => {
    const [w, h] = SIZES[type];
    return { type, x: wx(x, w), y: groundY - y - h, w, h };
  };
  const chamber = (type) => {
    const [x, y, w, h] = c[type];
    return { type, x: wx(x, w), y: groundY - y - h, w, h };
  };
  // all positions are cannon slots; a castle may start with fewer cannons than it has slots
  const slots = c.cannons.map((p) => place('cannon', p));
  const objects = [
    ...slots.slice(0, c.startCannons ?? slots.length),
    place('king', c.king),
    place('vane', c.vane),
    chamber('gold'),
    chamber('powder'),
    chamber('balls'),
  ];
  // Original: drin(bg[21], bg[22], 30, 25) – a hit anywhere in the 30×25 throne room hits the king.
  // this version's own castles get the same room, centred on the king and standing on his floor.
  const king = objects.find((o) => o.type === 'king');
  const [tx, ty, tw, th] = c.throne;
  king.hit = { x: wx(tx, tw), y: groundY - ty - th, w: tw, h: th };
  const cannonSlots = slots.map(({ x, y }) => ({ x, y }));
  const vane = objects.find((o) => o.type === 'vane');
  const caps = { money: chamberCapacity('gold', c.gold), powder: chamberCapacity('powder', c.powder), balls: chamberCapacity('balls', c.balls) };
  return { pixels, rooms, objects, cannonSlots, vaneSlot: { x: vane.x, y: vane.y }, width: c.width, caps };
}
