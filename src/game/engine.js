/*
 * Burgfehde – Spiel-Engine.
 *
 * Die Spiellogik ist eine Portierung von Ballerburg nach JavaScript:
 *   Copyright (C) 1987, 1989  Eckhard Kruse
 *   Copyright (C) 2010, 2015  Thomas Huth (SDL-Fassung)
 *   Copyright (C) 2026        Burgfehde
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the
 * GNU General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version. See LICENSE.
 *
 * Jede Methode nennt ihr Gegenstück im C-Original (baller1.c, baller2.c, market.c, cannoneer.c).
 * Abweichungen und Erweiterungen sind mit "Burgfehde:" gekennzeichnet.
 */
import { GREETINGS, KRUSE_SAYINGS, ROASTS, PRAISE } from './kingtalk.js';
import {
  W, H, CELL, G, STEPS_PER_SECOND, ANGLE_MAX, POWDER_MIN, POWDER_MAX, DEFAULT_AIM, SIZES, EARTH, BRICK,
} from './constants.js';
import { CASTLES, buildCastle } from './castles.js';
import { generateTerrain } from './terrain.js';
import { sound } from './sound.js';

/** Original: frames of expls() per hit object (the throne gets 40 + 200). No sound for the vane. */
const EXPLOSION_FRAMES = { cannon: 50, mine: 120, king: 240 };
/** Burgfehde extension "overheat": a cannon survives this many shots in a row, the next one blows it up. */
export const HEAT_MAX = 3;
import { recordResult } from './scores.js';

/** Original: anbau() lets you lay 20 bricks per purchase. */
export const BUILD_STONES = 20;

/* ---------- original constants (baller1.c: neues(), rechnen()) ---------- */

/** Market items in the order of the original price array p[0..5]. */
export const MARKET = [
  { key: 'stones', label: `Anbauen (${BUILD_STONES} Steine)` },
  { key: 'mine', label: 'Förderturm' },
  { key: 'cannon', label: 'Geschütz' },
  { key: 'vane', label: 'Windfahne' },
  { key: 'powder', label: '30 Pulver' },
  { key: 'balls', label: '2 Kugeln' },
];
const START_PRICES = [200, 500, 400, 150, 50, 50];
const PRICE_MIN = [98, 347, 302, 102, 30, 29];
const PRICE_MAX = [302, 707, 498, 200, 89, 91];
const PRICE_SWING = [10, 50, 50, 20, 10, 10];
const PRICE_INDEX = Object.fromEntries(MARKET.map((m, i) => [m.key, i]));

/** Original: up to five shaft towers in front of the castle, as long as they stay left of x = 265. */
const MAX_MINES = 5;
const MINE_LIMIT_X = 265;
/** Burgfehde: a shaft tower survives the first hit; the notch it cuts is 2 px wider on each side. */
const MINE_HITS = 2;
/** Burgfehde: the times of day (sky looks live in render.js). */
export const TIMES = ['morgen', 'tag', 'abend', 'nacht'];
const MINE_NOTCH = 2;
/** Original: bricks can only be laid below y = 155. */
const BUILD_MIN_Y = 155;
/** Burgfehde: bricks are 8×4 pixels like the masonry pattern; like the original they may be laid up to 15 px in front of the castle. */
const BRICK_W = 8;
const BRICK_H = 4;
const BUILD_MARGIN = 15; // original: anbau() only within bg[0]+15
/** Burgfehde: strongest wind (the original allowed about 30). */
const WIND_MAX = 20;

/**
 * Computer strategies (original: cw[] with the seven named computer players).
 * Burgfehde uses its own names; the behaviour per index follows comp() in baller2.c.
 */
export const STRATEGIES = [
  { name: 'Knappe Kurt', desc: 'Schießt irgendwohin auf die feindliche Burg.' },
  { name: 'Vogt Veit', desc: 'Zielt auf den König, manchmal auf Schatzkammer und Lager.' },
  { name: 'Gräfin Grimm', desc: 'Schießt Kanonen ab und plündert die Schatzkammer.' },
  { name: 'Baron Bombast', desc: 'Gemischte Ziele, baut Fördertürme und schießt fremde ab.' },
  { name: 'Hauptmann Hagen', desc: 'Schießt auf Kanonen, sonst auf den König.' },
  { name: 'Kämmerer Kuno', desc: 'Baut Fördertürme und zerstört die des Gegners.' },
  { name: 'Die Eiserne Erna', desc: 'Kennt nur ein Ziel: den König.' },
];

export const OBJECT_NAMES = {
  king: 'König', cannon: 'Geschütz', powder: 'Pulverkammer', balls: 'Kugelkammer',
  gold: 'Schatzkammer', vane: 'Windfahne', mine: 'Förderturm',
};
const CHAMBERS = ['gold', 'powder', 'balls'];

export const DEFAULT_OPTIONS = {
  /** Original: max_rund, 0 = unlimited. */
  maxRounds: 0,
  /** Original: au_kap, the king capitulates in a hopeless situation. */
  autoCapitulate: true,
  /** Original: an_erl, laying bricks is allowed. */
  allowBuilding: true,
  /** Burgfehde test mode: laying bricks costs nothing. Set to true only for testing. */
  freeBuilding: false,
  /** Burgfehde: time of day — 'morgen', 'tag', 'abend', 'nacht' or 'zufall' (random per game). */
  timeOfDay: 'zufall',
  /** Burgfehde extensions, all off by default so the game plays like the original. */
  extensions: { landslides: false, falling: false, overheat: false },
};

/* ---------- helpers that mimic C integer arithmetic ---------- */

const rnd = (n) => Math.floor(Math.random() * n); // rand() % n
const idiv = (a, b) => Math.trunc(a / b); // C integer division
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  /**
   * @param {object} cfg
   * @param {{name:string, type:'human'|'ai', strategy?:number, strength?:number, castle:string}[]} cfg.players
   * @param {{heights: ArrayLike<number>, baseY: number[]}} [cfg.terrainData]
   * @param {string} [cfg.terrain]
   * @param {object} [cfg.options] see DEFAULT_OPTIONS
   * @param {() => void} onChange called whenever UI-relevant state changes
   */
  constructor(cfg, onChange = () => {}) {
    this.onChange = onChange;
    this.options = { ...DEFAULT_OPTIONS, ...cfg.options, extensions: { ...DEFAULT_OPTIONS.extensions, ...(cfg.options?.extensions || {}) } };
    this.messages = [];
    this.newGame(cfg);
  }

  get cur() { return this.players[this.current]; }
  emit() { this.onChange(); }

  say(text, tone = 'info') {
    this.messages.unshift({ id: `${Date.now()}-${Math.random()}`, text, tone, round: this.round });
    if (this.messages.length > 8) this.messages.length = 8;
  }

  /* ======================= Spielstart (original: neues(), bild(), burg()) ======================= */

  newGame(cfg) {
    const widths = cfg.players.map((pc) => CASTLES[pc.castle].width);
    const terrain = cfg.terrainData || generateTerrain(cfg.terrain || 'klassisch', widths);
    this.sky = this.pickSky();
    this.heights = Float32Array.from(terrain.heights);
    this.baseY = terrain.baseY.slice();
    this.solid = new Uint8Array(W * H);
    /** Burgfehde: hollow castle rooms (side + 1), drawn with a back wall instead of sky. */
    this.interior = new Uint8Array(W * H);
    for (let x = 0; x < W; x++)
      for (let y = Math.max(0, Math.ceil(this.heights[x])); y < H; y++) this.solid[y * W + x] = EARTH;

    this.objects = [];
    this.nextId = 1;
    this.players = cfg.players.map((pc, i) => {
      const c = CASTLES[pc.castle];
      const built = buildCastle(pc.castle, i, this.baseY[i]);
      for (const [x, y, m] of built.pixels) if (x >= 0 && x < W && y >= 0 && y < H) this.solid[y * W + x] = m;
      for (const [x, y] of built.rooms) if (x >= 0 && x < W && y >= 0 && y < H) this.interior[y * W + x] = i + 1;
      built.objects.forEach((o) => {
        const obj = this.addObject(o.type, i, o.x, o.y, o.w, o.h);
        if (o.hit) obj.hit = o.hit; // throne room of an original castle
      });
      return {
        idx: i, name: pc.name, type: pc.type, castle: pc.castle,
        strategy: pc.strategy ?? 2, strength: clamp(pc.strength ?? 2, 1, 4),
        money: c.start.money, powder: c.start.powder, balls: c.start.balls, pop: c.start.pop,
        startPop: c.start.pop, caps: built.caps, // original: the chamber size limits what can be stored
        tax: 20, // original: st[n] = 20
        visits: 0, visitStreak: 0, visitedThisTurn: false, lastAudience: null, // original: kn[n]
        width: built.width, cannonSlots: built.cannonSlots, vaneSlot: built.vaneSlot,
        lastIncome: 0, popChange: 0, shots: 0, hits: 0,
      };
    });

    // original: wnd = rand()%60-30; prices p[j] = pr[j]*(95+rand()%11)/100
    this.wind = rnd(40) - 20; // original: rand()%60-30; Burgfehde: a third weaker, the mountains fly higher
    this.prices = Object.fromEntries(MARKET.map((m, j) => [m.key, idiv(START_PRICES[j] * (95 + rnd(11)), 100)]));
    this.move = 0; // original: zug
    this.round = 1;
    this.projectile = null;
    this.particles = [];
    this.flashes = [];
    /** Burgfehde: explosions inside a hit store room. */
    this.blasts = [];
    this.blasts = [];
    this.phase = 'idle';
    this.winner = null;
    this.endReason = '';
    this.selected = null;
    this.building = null;
    this.shake = 0;
    this.stepAcc = 0;
    this.aiTimer = 0;
    this.aiStep = null;
    this.turnEnding = 0;
    this.terrainDirty = true;
    this.say('Eine neue Fehde beginnt.', 'big');
    this.startMove();
  }

  /* ======================= world helpers ======================= */

  fillBrick(x, y, t) {
    for (let j = 0; j < CELL; j++)
      for (let i = 0; i < CELL; i++) {
        const px = x + i, py = y + j;
        if (px >= 0 && px < W && py >= 0 && py < H) this.solid[py * W + px] = t;
      }
    this.terrainDirty = true;
  }

  addObject(type, owner, x, y, w = SIZES[type][0], h = SIZES[type][1]) {
    const o = { id: this.nextId++, type, owner, x, y, w, h, alive: true, aim: { ...DEFAULT_AIM }, fall: null, lastTrail: null };
    this.objects.push(o);
    return o;
  }

  obj(id) { return this.objects.find((o) => o.id === id) || null; }
  objectsOf(owner, type) { return this.objects.filter((o) => o.alive && o.owner === owner && (!type || o.type === type)); }
  hasVane(owner) { return this.objectsOf(owner, 'vane').length > 0; }
  /** Original: f = 1 - 2*(n&1), the direction a side shoots in. */
  dir(side) { return side === 0 ? 1 : -1; }

  isSolid(x, y) {
    x |= 0; y |= 0;
    if (x < 0 || x >= W) return false;
    if (y < 0) return this.heights[x] < y; // Burgfehde: mountains may rise above the screen
    if (y >= H) return true;
    return this.solid[y * W + x] !== 0;
  }

  /** Original: loc() — is there anything drawn at this point (ground, wall or castle part)? */
  /** `flying`: the ball's view, which passes through empty store rooms like the original. */
  loc(x, y, ignoreId, flying = false) {
    if (this.isSolid(x, y)) return true;
    for (const o of this.objects)
      if (o.alive && o.id !== ignoreId && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h && !(flying && this.storeAir(o, y))) return true;
    return false;
  }

  /**
   * Original: a store room is drawn bottom up with as many sacks, kegs or balls as there are
   * (drw_gpk); the rest is white space. A ball flies through that part and hits the stock or floor.
   */
  storeAir(o, y) {
    if (!CHAMBERS.includes(o.type)) return false;
    const p = this.players[o.owner];
    const have = { gold: p.money, powder: p.powder, balls: p.balls }[o.type];
    const cap = p.caps[{ gold: 'money', powder: 'powder', balls: 'balls' }[o.type]] || 1;
    const filled = Math.ceil(o.h * Math.min(1, Math.max(0, have) / cap));
    return y < o.y + o.h - filled;
  }

  rectFree(x, y, w, h, ignoreId) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.loc(i, j, ignoreId)) return false;
    return true;
  }

  supported(o) {
    const by = (o.y | 0) + o.h;
    if (by >= H) return true;
    for (let x = o.x; x < o.x + o.w; x++) if (this.solid[by * W + x]) return true;
    return false;
  }

  /** Original: drin() — is (x, y) inside the box, widened by r pixels? */
  near(o, x, y, r) {
    return x >= o.x - r && x < o.x + o.w + r && y >= o.y - r && y < o.y + o.h + r;
  }

  /* ======================= Zugablauf (original: ein_zug()) ======================= */

  startMove() {
    // original: n = zug&1 — the left castle always opens the game
    this.current = this.move & 1;
    const p = this.cur;
    // original: kn[n] &= ~16; wnd = wnd*9/10 + rand()%12 - 6
    p.visitedThisTurn = false;
    // original: wnd*9/10 + rand()%12-6; Burgfehde: smaller changes, never above WIND_MAX
    if (this.move > 0) this.wind = clamp(idiv(this.wind * 9, 10) + rnd(9) - 4, -WIND_MAX, WIND_MAX);
    this.hasFired = false;
    this.firedCannon = null;
    this.building = null;
    if (this.cur.type === 'ai') {
      this.phase = 'ai';
      this.aiTimer = 0.9;
      this.selected = null;
    } else {
      this.phase = 'aim';
      // the triangle marks the cannon this player fired last, or the first one
      const cannons = this.objectsOf(this.current, 'cannon');
      this.selected = (cannons.find((c) => c.id === this.cur.lastCannon) || cannons[0])?.id ?? null;
    }
    this.emit();
  }

  /** Original: the "Fertig" button — end the move without a shot. */
  pass() {
    if (this.phase !== 'aim' && this.phase !== 'ai') return;
    this.building = null;
    this.finishMove();
  }

  /** Original: end of ein_zug() — rechnen(), zug++, capitulation and round-limit checks. */
  finishMove() {
    const mover = this.cur;
    if (!mover.visitedThisTurn) mover.visitStreak = 0; // original: if (~kn&16) kn &= ~15
    // Burgfehde extension: every cannon that did not fire in this move cools down completely
    if (this.options.extensions.overheat)
      for (const c of this.objectsOf(mover.idx, 'cannon')) if (c.id !== this.firedCannon) c.heat = 0;
    this.reckon(mover);
    if (this.phase === 'over') return;
    this.move++;
    this.round = Math.floor(this.move / 2) + 1;
    const next = this.players[this.move & 1];

    const nextCannons = this.objectsOf(next.idx, 'cannon').length;
    const moverCannons = this.objectsOf(mover.idx, 'cannon').length;
    if (nextCannons === 0 && moverCannons > 0 && next.startPop > next.pop && next.money < idiv(this.prices.cannon, 3)
        && this.options.autoCapitulate && this.objectsOf(next.idx, 'mine').length === 0) {
      this.end(mover.idx, 'capitulation', next);
      return;
    }
    if (this.options.maxRounds && Math.floor(this.move / 2) >= this.options.maxRounds) {
      const [a, b] = this.players.map((pl) => this.wealth(pl));
      const winner = b < a ? 0 : 1;
      this.end(winner, 'rounds', this.players[1 - winner]);
      return;
    }
    this.startMove();
  }

  /** Original: rechnen() — taxes, population, shaft towers and market prices after each move. */
  reckon(p) {
    const j = p.tax;
    const moneyBefore = p.money;
    p.money += idiv(p.pop * (j > 65 ? 130 - j : j), 150 - rnd(50));
    const popBefore = p.pop;
    p.pop = idiv(p.pop * (95 + rnd(11)), 100) + idiv((21 - j + rnd(9)) * (8 + rnd(5)), 20);
    for (let i = 0; i < this.objectsOf(p.idx, 'mine').length; i++) p.money += 40 + rnd(31);
    p.money = Math.min(p.money, p.caps.money); // original: drw_gpk() caps money to what the chamber holds
    p.lastIncome = p.money - moneyBefore;
    p.popChange = p.pop - popBefore;
    MARKET.forEach((m, k) => {
      let v = this.prices[m.key] + idiv(PRICE_SWING[k] * rnd(99), 98) - idiv(PRICE_SWING[k], 2);
      this.prices[m.key] = clamp(v, PRICE_MIN[k], PRICE_MAX[k]);
    });
    if (p.pop < 0) {
      p.pop = 0;
      this.end(1 - p.idx, 'folk', p);
    }
  }

  /** Original: the value comparison when max_rund is reached. */
  wealth(p) {
    const pr = this.prices;
    return p.money + idiv(p.powder * pr.powder, 30) + idiv(p.balls * pr.balls, 2) + (this.hasVane(p.idx) ? pr.vane : 0)
      + p.pop * 4 + this.objectsOf(p.idx, 'mine').length * pr.mine + this.objectsOf(p.idx, 'cannon').length * pr.cannon;
  }

  /** Original: ende() */
  end(winner, kind, loser) {
    if (this.phase === 'over') return;
    const texts = {
      king: `Der König von ${loser.name} wurde getroffen, daraufhin hat das Volk kapituliert.`,
      capitulation: `Der König von ${loser.name} hat wegen der aussichtslosen Lage kapituliert.`,
      folk: `${loser.name} hat kein Volk mehr.`,
      rounds: `Das Rundenlimit ist erreicht, ${loser.name} steht schlechter da.`,
      surrender: `Der König von ${loser.name} hisst die weiße Fahne.`,
    };
    this.phase = 'over';
    this.winner = winner;
    this.endKind = kind;
    this.endReason = texts[kind];
    this.building = null;
    this.say(this.endReason, 'big');
    recordResult(this.players[winner].name, this.players[1 - winner].name);
    sound.fanfare();
    this.emit();
  }

  surrender() {
    if (this.phase !== 'aim') return;
    this.end(1 - this.current, 'surrender', this.cur);
  }

  /* ======================= Schuss (original: sch_obj(), schuss()) ======================= */

  /** Original: ein_zug() refuses the cannon dialog without at least 5 powder or without a ball. */
  shotProblem(p = this.cur) {
    if (p.powder < POWDER_MIN) return 'Du hast nicht genug Pulver.';
    if (p.balls === 0) return 'Du hast keine Kugeln mehr.';
    return null;
  }

  canFire(c) {
    return !!c && c.alive && c.owner === this.current && !this.hasFired && !this.shotProblem() && (this.phase === 'aim' || this.phase === 'ai');
  }

  /** Burgfehde: the muzzle of our cannon sprite. Original: x = ka.x+10+7*f, y = ka.y-10. */
  muzzle(c) {
    return { x: c.x + c.w / 2 + this.dir(c.owner) * 7, y: c.y - 2 };
  }

  /**
   * Original: schuss() for a human shot. Angle 0..180 (above 90 shoots backwards), powder 5..20.
   * Start speed per flight step is 0.4 + 0.25 * powder.
   */
  fire(id, angle, powder) {
    const c = this.obj(id);
    if (!this.canFire(c)) return false;
    angle = clamp(Math.round(angle), 0, ANGLE_MAX);
    powder = clamp(Math.round(powder), POWDER_MIN, Math.min(POWDER_MAX, this.cur.powder));
    c.aim = { angle, powder };
    const v = 0.4 + 0.25 * powder;
    const a = angle / 57.296;
    return this.launch(c, powder, v * Math.cos(a) * this.dir(c.owner), v * Math.sin(a));
  }

  launch(c, cost, vx, vy) {
    const p = this.cur;
    p.powder = Math.max(0, p.powder - cost);
    p.balls -= 1;
    p.shots++;
    p.lastCannon = c.id;
    if (p.type === 'human') this.selected = c.id;
    this.hasFired = true;
    this.firedCannon = c.id;
    if (this.options.extensions.overheat) {
      // Burgfehde extension: the fourth shot in a row blows the cannon up instead of firing
      if ((c.heat || 0) >= HEAT_MAX) return this.overheat(c);
      c.heat = (c.heat || 0) + 1;
      if (c.heat === HEAT_MAX) this.say('Das Rohr glüht rot! Noch ein Schuss, und das Geschütz fliegt in die Luft.', 'warn');
    }
    const m = this.muzzle(c);
    this.projectile = { x: m.x, y: m.y, vx, vy, owner: c.owner, cannon: c.id, trail: [] };
    this.returnPhase = this.phase;
    this.phase = 'flying';
    this.building = null;
    sound.shot();
    this.emit();
    return true;
  }

  /**
   * Burgfehde extension "overheat": the cannon fired HEAT_MAX times in a row and explodes.
   * Powder and ball are lost, the move ends, the slot is free for a new cannon.
   */
  overheat(c) {
    const p = this.cur;
    p.overheats = (p.overheats || 0) + 1;
    this.destroy(c, undefined, 'overheat');
    this.returnPhase = this.phase;
    this.phase = 'flying';
    this.building = null;
    this.emit();
    return true;
  }

  /** Original: the flight loop in schuss(). One call is one flight step. */
  stepProjectile() {
    const pr = this.projectile;
    const ox = pr.x, oy = pr.y;
    pr.x += pr.vx;
    pr.y -= pr.vy;
    pr.vy -= G;
    pr.vx += (this.wind / 2 - pr.vx) / 5000;
    if ((pr.steps = (pr.steps || 0) + 1) % 2 === 0) pr.trail.push([pr.x, pr.y]);
    sound.flight(pr.y);

    if (!(pr.x > 3 && pr.x < 637 && pr.y < 396)) {
      this.say('Die Kugel fliegt aus dem Feld.');
      this.endFlight(pr);
      return;
    }
    let free = true;
    if (pr.x >= 3 && pr.x <= 637 && pr.y <= 397) {
      const x = pr.x | 0, y = pr.y | 0;
      free = !this.loc(x, y, pr.cannon, true);
      for (let i = -1; i <= 1 && free; i++)
        free = !this.loc(x - 2, y + i, pr.cannon, true) && !this.loc(x + 2, y + i, pr.cannon, true) && !this.loc(x + i, y + 2, pr.cannon, true);
    }
    if (!free) {
      this.endFlight(pr);
      this.impact(ox, oy, pr.vx, pr.vy, pr.owner);
    }
  }

  endFlight(pr) {
    const c = this.obj(pr.cannon);
    if (c) c.lastTrail = pr.trail.concat([[pr.x, pr.y]]);
    this.projectile = null;
    sound.flightEnd();
  }

  /**
   * Original: "Einschlag der Kugel" in schuss(). Starting at the last free position the ball
   * clears four circles of radius 5 along its path. Each circle may cost a citizen of a castle
   * it lands in, destroys cannons, shaft towers and weather vanes it touches, empties store rooms
   * and ends the game when it hits a throne. Store rooms, towers and the throne stop the ball.
   */
  impact(x, y, vx, vy, by) {
    let xa = x, xb = x;
    sound.impact();
    for (let c = 0; c < 4; c++) {
      this.carve(x, y, 5);
      xa = Math.min(xa, x);
      xb = Math.max(xb, x);
      let stop = false;
      for (let side = 0; side < 2; side++) {
        const pl = this.players[side];
        const inCastle = side ? x > 639 - pl.width : x < pl.width;
        if (Math.random() < 0.5 && inCastle && pl.pop) pl.pop--;
        for (const o of this.objectsOf(side)) {
          if (o.type === 'cannon' && this.near(o, x, y, 2)) this.destroy(o, by);
          else if (o.type === 'mine' && this.near(o, x, y, 2)) { this.hitMine(o, by); stop = true; }
          else if (o.type === 'vane' && this.near(o, x, y, 3)) this.destroy(o, by);
          else if (o.type === 'king' && (o.hit ? x > o.hit.x && x < o.hit.x + o.hit.w && y > o.hit.y && y < o.hit.y + o.hit.h : this.near(o, x, y, 3))) { this.destroy(o, by); stop = true; }
          else if (CHAMBERS.includes(o.type) && this.near(o, x, y, 3)) { this.hitChamber(o, by); stop = true; }
        }
      }
      if (stop || this.phase === 'over') break;
      x += vx;
      y -= vy;
    }
    if (this.options.extensions.landslides) this.settleEarth((xa | 0) - 7, (xb | 0) + 7);
    this.terrainDirty = true;
    this.flashes.push({ x, y, r: 16, t: 0, life: 0.45 });
    this.shake = Math.min(7, this.shake + 3);
    if (this.options.extensions.falling) this.checkSupport();
  }

  carve(x, y, r) {
    const x0 = Math.round(x), y0 = Math.round(y);
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const px = x0 + dx, py = y0 + dy;
        if (px < 0 || px >= W || py < 0 || py >= H || dx * dx + dy * dy > r * r) continue;
        const i = py * W + px;
        const t = this.solid[i];
        if (!t) continue;
        this.solid[i] = 0;
        if (Math.random() < 0.15) this.spawnDebris(px, py, t === EARTH ? '#5a4436' : t === BRICK ? '#c9a26b' : '#93a6bb');
      }
  }

  destroy(o, by, cause = 'hit') {
    if (!o.alive) return;
    const owner = this.players[o.owner];
    if (cause === 'hit' || cause === 'overheat') sound.explosion(EXPLOSION_FRAMES[o.type] || 0);
    if (o.type === 'king') {
      o.alive = false;
      this.burst(o);
      if (by !== undefined && by !== o.owner) this.players[by].hits++;
      this.end(1 - o.owner, 'king', owner);
      return;
    }
    o.alive = false;
    o.fall = null;
    this.burst(o);
    if (by !== undefined && by !== o.owner) this.players[by].hits++;
    const own = by === o.owner ? ' (eigener Treffer)' : '';
    if (by === o.owner) this.players[by].ownHits = (this.players[by].ownHits || 0) + 1;
    const what = cause === 'fall' ? 'stürzt ab' : cause === 'overheat' ? 'ist heißgelaufen und explodiert' : 'zerstört';
    this.say(`${OBJECT_NAMES[o.type]} von ${owner.name} ${what}${own}.`, 'hit');
  }

  /**
   * Burgfehde: a shaft tower takes MINE_HITS hits. Every hit but the last only damages it
   * (broken wheel); the original destroyed it at once.
   */
  hitMine(o, by) {
    o.damage = (o.damage || 0) + 1;
    if (o.damage >= MINE_HITS) { this.destroy(o, by); return; }
    if (by !== undefined && by !== o.owner) this.players[by].hits++;
    this.burst(o, 6);
    const own = by === o.owner ? ' (eigener Treffer)' : '';
    if (by === o.owner) this.players[by].ownHits = (this.players[by].ownHits || 0) + 1;
    this.say(`Förderturm von ${this.players[o.owner].name} beschädigt, das Rad ist gebrochen${own}.`, 'hit');
  }

  /** Original: store rooms are part of the castle; a hit costs up to 200 gold, all powder or 2 balls. */
  hitChamber(o, by) {
    const owner = this.players[o.owner];
    const own = by === o.owner ? ' (eigener Treffer)' : '';
    if (by === o.owner) this.players[by].ownHits = (this.players[by].ownHits || 0) + 1;
    if (by !== undefined && by !== o.owner) this.players[by].hits++;
    this.burst(o, 10);
    sound.explosion(o.type === 'powder' ? 160 : 60);
    if (o.type === 'gold') {
      const loss = Math.min(200, owner.money);
      owner.money -= loss;
      this.chamberBlast(o, 'gold', 4 + Math.ceil(loss / 150) * 8);
      this.say(`Treffer in der Schatzkammer von ${owner.name}: ${loss} Gold verloren${own}.`, 'hit');
    } else if (o.type === 'powder') {
      const lost = owner.powder;
      owner.powder = 0;
      this.chamberBlast(o, 'powder', 6 + Math.ceil(lost / 30) * 6);
      this.say(`Die Pulverkammer von ${owner.name} fliegt in die Luft: ${lost} Pulver verloren${own}.`, 'hit');
      this.flashes.push({ x: o.x + o.w / 2, y: o.y + o.h / 2, r: 30, t: 0, life: 0.7 });
      this.shake = Math.min(9, this.shake + 4);
    } else {
      const lost = Math.min(2, owner.balls);
      owner.balls -= lost;
      this.chamberBlast(o, 'balls', lost);
      this.say(`Treffer in der Kugelkammer von ${owner.name}: ${lost} Kugeln verloren${own}.`, 'hit');
    }
  }

  /**
   * Burgfehde: a hit store room explodes visibly — a fireball inside the chamber, smoke,
   * and the lost goods (coins, keg staves, cannonballs) flying out.
   */
  chamberBlast(o, kind, items) {
    const big = kind === 'powder';
    this.blasts.push({ x: o.x, y: o.y, w: o.w, h: o.h, kind, t: 0, life: big ? 1.4 : 0.9 });
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const spray = (col, size, speed, n, extra = {}) => {
      for (let i = 0; i < n && this.particles.length < 900; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        const v = speed * (0.4 + Math.random() * 0.8);
        this.particles.push({ x: cx + (Math.random() - 0.5) * o.w * 0.6, y: cy + (Math.random() - 0.5) * o.h * 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 + Math.random() * 1.2, col: typeof col === 'function' ? col(i) : col, s: size, ...extra });
      }
    };
    const smoke = (n, dark) => {
      for (let i = 0; i < n && this.particles.length < 900; i++)
        this.particles.push({ x: cx + (Math.random() - 0.5) * o.w, y: cy + (Math.random() - 0.5) * o.h, vx: (Math.random() - 0.5) * 18, vy: -12 - Math.random() * 18, life: 1.2 + Math.random() * 1.4, col: dark ? '#2a2628' : '#6d6668', s: 2, smoke: true });
    };
    if (kind === 'gold') {
      spray((i) => (i % 3 ? '#ffd23f' : '#fff3a6'), 2, 150, items, { glint: true });
      smoke(8, false);
    } else if (kind === 'powder') {
      spray((i) => ['#7b4a26', '#5c361b', '#3a3a40'][i % 3], 2, 210, items);
      spray((i) => (i % 2 ? '#ffb347' : '#fff0a8'), 1, 240, 30);
      smoke(26, true);
      this.flashes.push({ x: cx, y: cy, r: 46, t: 0, life: 0.9 });
      this.shake = Math.min(12, this.shake + 6);
    } else {
      spray('#25252c', 3, 130, Math.max(1, items), { ball: true });
      spray('#c9c4b8', 1, 160, 10);
      smoke(8, false);
    }
  }

  burst(o, n = 18) {
    for (let i = 0; i < n; i++) this.spawnDebris(o.x + Math.random() * o.w, o.y + Math.random() * o.h, ['#ffd23f', '#f4f1e8', '#7a4b2a', '#2b2d33'][i % 4]);
  }

  spawnDebris(x, y, col) {
    if (this.particles.length > 600) return;
    this.particles.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -20 - Math.random() * 90, life: 0.6 + Math.random() * 0.8, col });
  }

  /** Burgfehde extension: loose earth above a crater slides down. */
  settleEarth(xa, xb) {
    const blocked = (x, y) => y >= H || this.solid[y * W + x] !== 0 || this.objects.some((o) => o.alive && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
    let moved = 0;
    for (let x = Math.max(0, xa); x <= Math.min(W - 1, xb); x++) {
      for (let y = H - 2; y >= 0; y--) {
        const i = y * W + x;
        if (this.solid[i] !== EARTH || blocked(x, y + 1)) continue;
        let ny = y + 1;
        while (!blocked(x, ny + 1)) ny++;
        this.solid[i] = 0;
        this.solid[ny * W + x] = EARTH;
        moved++;
      }
    }
    if (moved > 400) this.say('Ein Hang rutscht ab.');
  }

  /** Burgfehde extension: castle parts without support fall down. */
  checkSupport() {
    for (const o of this.objects)
      if (o.alive && !o.fall && !this.supported(o)) o.fall = { vy: 0, acc: 0, startY: o.y };
  }

  /* ======================= Markt (original: markt(), anbau(), fturm(), init_ka()) ======================= */

  setTax(v) {
    if (this.phase !== 'aim') return;
    this.cur.tax = clamp(v, 0, 100); // original: steps of 2 between 0 and 100
    this.emit();
  }

  /**
   * Original: init_ka() looks for the first cannon slot that is free and has room above it.
   * Burgfehde: a slot must also stand on something and see the sky. When every slot of the
   * castle is shot away or built over, the cannon goes on the highest free place of your own
   * building zone instead, so a damaged or rebuilt castle can always arm itself again.
   */
  freeCannonSlot(p = this.cur) {
    // Original: a bought cannon goes to a free cannon place of the castle (ka[n][k].x == -1), nowhere else
    const taken = this.objectsOf(p.idx, 'cannon');
    const [w, h] = SIZES.cannon;
    return p.cannonSlots.find((s) => !taken.some((c) => Math.abs(c.x - s.x) < w && Math.abs(c.y - s.y) < h)) || null;
  }

  /**
   * Original: init_ka() simply draws the cannon over whatever is there. Burgfehde clears the place,
   * and if the wall below was shot away, it mortars a small pillar so the cannon stands on something.
   */
  prepareCannonSlot(s, side) {
    const [w, h] = SIZES.cannon;
    for (let j = s.y; j < s.y + h; j++)
      for (let i = s.x; i < s.x + w; i++) if (i >= 0 && i < W && j >= 0 && j < H) this.solid[j * W + i] = 0;
    for (let i = s.x + 2; i < s.x + w - 2; i++)
      for (let j = s.y + h; j < H && j < s.y + h + 60 && !this.isSolid(i, j); j++) this.solid[j * W + i] = BRICK + side;
    this.terrainDirty = true;
  }

  /** Original: fturm() places towers side by side in front of the castle, on the ground. */
  nextMineSpot(p = this.cur) {
    const mines = this.objectsOf(p.idx, 'mine');
    if (mines.length >= MAX_MINES) return null;
    // Original: the first free of the five tower places (ft[n][t].x == -1), so a shot-down tower
    // can be rebuilt on its old place
    for (let t = 0; t < MAX_MINES; t++) {
      const s = this.mineSpotAt(p, t);
      if (s) return s;
    }
    return null;
  }

  mineSpotAt(p, t) {
    const [w, h] = SIZES.mine;
    const offset = p.width + 8 + t * 22;
    if (offset + w > MINE_LIMIT_X) return null;
    const x = p.idx === 0 ? offset : W - offset - w;
    // Burgfehde: the tower stands on the lowest ground under its footprint and cuts a level
    // notch into the slope (earth only), instead of floating in front of a steep mountain.
    let base = 0;
    for (let i = x; i < x + w; i++) {
      let y = 0;
      while (y < H && !this.isSolid(i, y)) y++;
      base = Math.max(base, y);
    }
    const y = base - h;
    if (y < 0) return null;
    const nx = x - MINE_NOTCH, nw = w + 2 * MINE_NOTCH;
    for (let j = y; j < base; j++)
      for (let i = nx; i < nx + nw; i++) {
        if (i < 0 || i >= W) continue;
        const t = this.solid[j * W + i];
        if (t && t !== EARTH) return null; // never dig into walls or bricks
      }
    for (const o of this.objects)
      if (o.alive && o.x < nx + nw && o.x + o.w > nx && o.y < base && o.y + o.h > y) return null;
    return { x, y, notch: { x: nx, y, w: nw, h: base - y } };
  }

  /** Clear the earth of a mine notch so the tower sits in the slope. */
  digNotch(n) {
    for (let j = n.y; j < n.y + n.h; j++)
      for (let i = n.x; i < n.x + n.w; i++)
        if (i >= 0 && i < W && this.solid[j * W + i] === EARTH) this.solid[j * W + i] = 0;
    this.terrainDirty = true;
  }

  /** Original: market items are greyed out when unaffordable or not possible. */
  /** What an item costs right now (bricks are free in test mode). */
  priceOf(key) {
    return key === 'stones' && this.options.freeBuilding ? 0 : this.prices[key];
  }

  canBuy(key, p = this.cur) {
    if (p.money < this.priceOf(key)) return false;
    switch (key) {
      case 'stones': return this.options.allowBuilding;
      case 'mine': return !!this.nextMineSpot(p);
      case 'cannon': return !!this.freeCannonSlot(p);
      case 'vane': return !this.hasVane(p.idx) && !!p.vaneSlot;
      case 'powder': return p.powder < p.caps.powder;
      case 'balls': return p.balls < p.caps.balls;
      default: return false;
    }
  }

  buy(key) {
    const p = this.cur;
    if ((this.phase !== 'aim' && this.phase !== 'ai') || !this.canBuy(key, p)) { if (p.type === 'human') sound.error(); return false; }
    p.money -= this.priceOf(key);
    switch (key) {
      case 'stones':
        this.building = { left: BUILD_STONES }; // original: anbau() lets you lay 20 bricks
        break;
      case 'mine': {
        const s = this.nextMineSpot(p);
        this.digNotch(s.notch);
        this.addObject('mine', p.idx, s.x, s.y);
        break;
      }
      case 'cannon': {
        const s = this.freeCannonSlot(p);
        this.prepareCannonSlot(s, p.idx);
        const c = this.addObject('cannon', p.idx, s.x, s.y);
        if (p.type === 'human') this.selected = c.id;
        break;
      }
      case 'vane':
        this.addObject('vane', p.idx, p.vaneSlot.x, p.vaneSlot.y);
        break;
      case 'powder':
        p.powder = Math.min(p.caps.powder, p.powder + 30);
        break;
      case 'balls':
        p.balls = Math.min(p.caps.balls, p.balls + 2);
        break;
    }
    if (p.type === 'human') sound.coin();
    this.emit();
    return true;
  }

  /**
   * Where a stone goes when the player paints at (lx, ly).
   * Original anbau(): a 4×4 stone that touches ground or wall. Burgfehde paints like a brush:
   * dragging lays a stone wherever there is room next to ground, wall or an earlier stone.
   * A single click into the air lets the stone fall until it rests on something.
   * Stones stay on your own side (castle width + BUILD_MARGIN) and below y = BUILD_MIN_Y.
   */
  brickSpot(lx, ly, side = this.current, allowFall = true) {
    const w = CELL, h = CELL;
    const width = this.players[side].width;
    const inZone = (x) => (side === 0 ? x >= 0 && x + w <= width + BUILD_MARGIN : x >= W - width - BUILD_MARGIN && x + w <= W);
    const touches = (x, y) => {
      for (let i = x; i < x + w; i++) if (this.isSolid(i, y - 1) || this.isSolid(i, y + h)) return true;
      for (let j = y; j < y + h; j++) if (this.isSolid(x - 1, j) || this.isSolid(x + w, j)) return true;
      return false;
    };
    const ok = (x, y) => inZone(x) && y >= BUILD_MIN_Y && this.rectFree(x, y, w, h);
    // the stone sits under the mouse; if that spot overlaps a wall it slides up to 3 px into the gap
    const x0 = Math.round(lx - w / 2), y0 = Math.round(ly - h / 2);
    let best = null;
    for (let d = 0; d <= 3 && !best; d++)
      for (let dy = -d; dy <= d && !best; dy++)
        for (let dx = -d; dx <= d; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
          if (ok(x0 + dx, y0 + dy) && touches(x0 + dx, y0 + dy)) { best = { x: x0 + dx, y: y0 + dy, w, h }; break; }
        }
    if (best || !allowFall) return best;
    // a single click into the air: the stone falls until it rests on something
    if (!inZone(x0) || !this.rectFree(x0, y0, w, h)) return null;
    let y = y0;
    const restsOn = (yy) => { for (let i = x0; i < x0 + w; i++) if (this.loc(i, yy + h)) return true; return false; };
    while (y + h < H && !restsOn(y)) y++;
    return y >= BUILD_MIN_Y ? { x: x0, y, w, h } : null;
  }

  /** Lays one stone. `painting` is true while the mouse is dragged: then nothing falls and no error sounds. */
  layBrick(lx, ly, painting = false) {
    if (!this.building || this.phase !== 'aim') return false;
    const s = this.brickSpot(lx, ly, this.current, !painting);
    if (!s) { if (!painting) sound.error(); return false; }
    this.fillBrick(s.x, s.y, BRICK + this.current);
    sound.click();
    if (--this.building.left <= 0) this.building = null;
    this.emit();
    return true;
  }

  /** Paints stones along the line from a to b, so a fast drag leaves no gaps. */
  paintLine(a, b) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
    for (let i = 0; i <= n && this.building; i++) this.layBrick(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, true);
  }

  /** Original: a right click ends laying bricks; the rest of the 20 bricks is lost. */
  stopBuilding() {
    this.building = null;
    this.emit();
  }

  /* ======================= König (original: koenig()) ======================= */

  /**
   * The king's audience. Conditions follow koenig() in baller2.c; the wording is Burgfehde's.
   * He refuses when visited twice in one move, too often in a row, or at random (1 in 20).
   */
  audience() {
    const p = this.cur;
    if (this.phase !== 'aim') return null;
    const cannons = this.objectsOf(p.idx, 'cannon').length;
    const mines = this.objectsOf(p.idx, 'mine').length;
    let result;
    if (!p.greeted) {
      // Burgfehde: the first audience is a greeting from the king about his maker, Eckhard Kruse
      p.greeted = true;
      result = { greeting: true, text: GREETINGS[rnd(GREETINGS.length)] };
    } else if (!rnd(20) || p.visitedThisTurn || p.visitStreak > 9) {
      result = { refused: true, text: 'Der König ist nicht in der Stimmung, Euch zu empfangen.' };
    } else {
      const j = rnd(8);
      const s = [j & 1 ? 'Nun ja … gut … macht weiter.' : 'Schön, Euch zu sehen.',
        j & 2 ? 'Verdient mehr Geld, baut mehr Fördertürme und besiegt den Feind.' : 'Ihr solltet Euch gefälligst mehr anstrengen.'];
      if (j & 4) s.push('Es freut Uns, dass Ihr vorbeischaut.');
      if (p.money > this.prices.mine && mines < 3) s.push('Warum kauft Ihr nicht einen Förderturm …');
      if ((p.tax > 40 && p.pop < p.startPop) || p.tax > 70) s.push('Vielleicht solltet Ihr Unsere Steuern senken …');
      if (!this.hasVane(p.idx)) s.push('Seid Ihr sicher, dass Ihr ohne Windfahne zurechtkommt?');
      if (p.money > CASTLES[p.castle].start.money && p.pop > p.startPop && cannons > 1) s[1] = mines < 2 ? 'Wir sind mit Euren Leistungen zufrieden.' : 'Ausgezeichnet, weiter so!';
      if (mines > 2) s.push('Ausgezeichnet, weiter so!');
      if (cannons < 1 && p.money < this.prices.cannon) s.push('Wenn das so weitergeht, entlassen Wir Euch!');
      if (p.visitStreak > 4) s.push('Ihr müsst Uns nicht jede Runde besuchen.', 'Ihr müsst Uns nicht jede Runde besuchen.', 'Ihr müsst Uns nicht jede Runde besuchen.');
      if (p.visitStreak > 6 || (!rnd(8) && p.visits > 8)) s.push(`Wisst Ihr, dass Ihr Uns schon ${p.visits}-mal besucht habt?`);
      if (this.move < 4) { s.length = 0; s.push('Was sollen Wir in so einer frühen Phase schon sagen?'); }
      let text = s[rnd(s.length)];
      const tip = this.move >= 4 && this.advice(p);
      if (tip && rnd(3)) text = tip.text; // Burgfehde: the king mostly tells you what to do now
      // Burgfehde: the king talks about Meister Kruse — and mocks you when things go badly
      const talk = this.move >= 2 && this.kingTalk(p);
      if (talk) text = talk;
      if (text === p.lastAudience) text = 'Wir haben Euch nichts Neues zu sagen.';
      p.lastAudience = text;
      result = { text };
    }
    p.visitedThisTurn = true;
    p.visits++;
    p.visitStreak++;
    return result;
  }

  /**
   * Burgfehde: what the king says about Meister Kruse. When the game goes badly for you he mocks
   * you (most of the time), when it goes well he is smug, otherwise he tells a Kruse story
   * every other audience. Every saying comes once before any repeats.
   */
  kingTalk(p) {
    const foe = this.players[1 - p.idx];
    const ctx = {
      p, foe,
      cannons: this.objectsOf(p.idx, 'cannon').length,
      foeCannons: this.objectsOf(foe.idx, 'cannon').length,
      shots: p.shots, hits: p.hits, ownHits: p.ownHits || 0,
      overheats: p.overheats || 0,
      redHot: this.options.extensions.overheat ? this.objectsOf(p.idx, 'cannon').filter((c) => (c.heat || 0) >= HEAT_MAX).length : 0,
      missRate: p.shots ? 1 - p.hits / p.shots : 0,
      round: Math.floor(this.move / 2) + 1,
    };
    const pick = (key, lines) => {
      p.heard = p.heard || {};
      const used = (p.heard[key] = p.heard[key] || []);
      let fresh = lines.filter((l) => !used.includes(l));
      if (!fresh.length) { used.length = 0; fresh = lines; }
      const line = fresh[rnd(fresh.length)];
      used.push(line);
      return line;
    };
    const bad = ROASTS.filter((r) => r.when(ctx));
    if (bad.length && rnd(4)) {
      const r = bad[rnd(bad.length)];
      return pick('roast' + ROASTS.indexOf(r), r.lines(ctx));
    }
    const good = p.hits >= foe.hits + 2 && ctx.cannons >= ctx.foeCannons;
    if (good && !rnd(2)) return pick('praise', PRAISE);
    return rnd(2) ? pick('kruse', KRUSE_SAYINGS) : null;
  }

  /**
   * Burgfehde: the king's advice at the start of each human move, shown in the status line.
   * First what the taxes did to the people during the last move, then the most urgent thing
   * missing for the war: a cannon, powder, balls, shaft towers. When nothing can be done,
   * he tells you to sit the move out.
   */
  advice(p) {
    const pr = this.prices;
    const cannons = this.objectsOf(p.idx, 'cannon').length;
    const mines = this.objectsOf(p.idx, 'mine').length;
    const lost = -(p.popChange || 0);
    const few = p.pop < p.startPop * 0.4;
    if (p.tax >= 70 && lost <= 0)
      return { text: `${p.tax} % Steuern? Damit treibt Ihr das Volk aus der Burg, und über 65 % bringen die Steuern sogar weniger ein.`, level: 'alarm' };
    if (this.move >= 2) {
      if (few && lost > 0)
        return { text: `Euer Volk läuft davon! Nur noch ${p.pop} Untertanen sind übrig. Senkt sofort die Steuern, sonst steht Ihr bald ganz allein da.`, level: 'alarm' };
      if (p.tax >= 70)
        return { text: `${p.tax} % Steuern? Das Volk hat keine Lust mehr auf Euch${lost > 0 ? `, ${lost} sind fortgezogen` : ''}. Über 65 % bringen die Steuern sogar weniger ein. Senkt sie!`, level: 'alarm' };
      if (p.tax >= 45 && lost > 0)
        return { text: `${lost} Untertanen haben Eure Burg verlassen. Die Leute murren über ${p.tax} % Steuern – senkt sie etwas.`, level: 'warn' };
    }
    if (!cannons) {
      if (this.canBuy('cannon', p)) return { text: `Ihr habt kein Geschütz! Kauft eines im Markt (Lagerkammer anklicken), es kostet ${pr.cannon} Taler.`, level: 'warn' };
      if (p.money < pr.cannon) {
        const how = mines < 2 && this.canBuy('mine', p) ? 'Baut einen Förderturm' : p.tax < 30 ? 'Erhöht die Steuern etwas' : 'Spart Euer Geld';
        return { text: `Kein Geschütz und zu wenig Geld (${p.money} von ${pr.cannon} Talern). ${how} und setzt diese Runde aus (Fertig).`, level: 'warn' };
      }
      return { text: 'Alle Geschützplätze Eurer Burg sind besetzt.', level: 'warn' };
    }
    if (!p.balls) return this.canBuy('balls', p)
      ? { text: `Ohne Kugeln könnt Ihr nicht schießen. Kauft Kugeln im Markt (${pr.balls} Taler).`, level: 'warn' }
      : { text: 'Keine Kugeln und kein Geld dafür. Setzt diese Runde aus (Fertig) und sammelt Steuern.', level: 'warn' };
    if (p.powder < POWDER_MIN) return this.canBuy('powder', p)
      ? { text: `Das Pulver reicht nicht für einen Schuss. Kauft Pulver im Markt (${pr.powder} Taler).`, level: 'warn' }
      : { text: 'Kein Pulver und kein Geld dafür. Setzt diese Runde aus (Fertig) und sammelt Steuern.', level: 'warn' };
    if (mines < 2 && this.canBuy('mine', p) && p.money >= pr.mine + pr.balls)
      return { text: `Ein Förderturm bringt jede Runde 40 bis 70 Taler. Kauft doch einen (${pr.mine} Taler).`, level: 'tip' };
    if (p.balls < 2 && this.canBuy('balls', p)) return { text: 'Euch gehen die Kugeln aus. Füllt die Kugelkammer auf.', level: 'tip' };
    if (p.powder < 25 && this.canBuy('powder', p)) return { text: 'Das Pulver wird knapp. Füllt die Pulverkammer auf.', level: 'tip' };
    if (cannons < 2 && this.canBuy('cannon', p) && p.money >= pr.cannon * 2) return { text: 'Ihr habt Geld genug für ein zweites Geschütz.', level: 'tip' };
    if (!this.hasVane(p.idx) && this.canBuy('vane', p)) return { text: 'Mit einer Windfahne seht Ihr, woher der Wind weht.', level: 'tip' };
    if (p.tax < 12 && p.money < pr.cannon) return { text: 'Die Kassen sind leer. Ihr dürft die Steuern ruhig etwas erhöhen.', level: 'tip' };
    return null;
  }

  /* ======================= Computer (original: comp(), z_kn() … z_pk()) ======================= */

  aiAct() {
    const p = this.cur;
    const shot = this.computerMove(p);
    if (!shot) { this.say(`${p.name} setzt diese Runde aus.`); this.finishMove(); return; }
    this.selected = shot.cannon.id;
    shot.cannon.aim = { angle: Math.round(shot.angle), powder: shot.powder };
    this.launch(shot.cannon, shot.powder, shot.vx, shot.vy);
  }

  /** Original comp(): buy what is missing, pick a target by strategy, compute the shot. */
  computerMove(p) {
    const n = p.idx, f = this.dir(n), foe = this.players[1 - n];
    p.tax = 16;
    if (p.powder < 20 && p.money >= this.prices.powder) this.buy('powder');
    if (!p.balls && p.money >= this.prices.balls) this.buy('balls');
    if (!this.objectsOf(n, 'cannon').length && p.money >= this.prices.cannon && this.freeCannonSlot(p)) this.buy('cannon');
    if (this.objectsOf(n, 'mine').length < 3 && p.money >= this.prices.mine && p.strategy > 2 && this.nextMineSpot(p)) this.buy('mine');

    // Burgfehde extension: the computer never fires a red-hot cannon; with none left it sits out
    const cannons = this.objectsOf(n, 'cannon').filter((c) => !this.options.extensions.overheat || (c.heat || 0) < HEAT_MAX);
    if (!cannons.length || p.powder < 20 || !p.balls) return null;

    // Default target: a random spot on the enemy castle (original: zx = 639*!n - f*(rand()%bh[0])).
    let zx = foe.idx === 0 ? rnd(foe.width) : 639 - rnd(foe.width);
    let zy = this.baseY[foe.idx];
    const centre = (o) => [o.x + o.w / 2, o.y + o.h];
    const pick = (list) => list[rnd(list.length)];
    const target = {
      king: () => { const k = this.objectsOf(foe.idx, 'king')[0]; if (k) [zx, zy] = [k.x + k.w / 2, k.y + k.h - 5]; },
      cannons: () => { const l = this.objectsOf(foe.idx, 'cannon'); if (l.length) [zx, zy] = centre(pick(l)); },
      mines: () => { const l = this.objectsOf(foe.idx, 'mine'); if (l.length) { [zx, zy] = centre(l[0]); zy -= 10; } },
      gold: () => { const l = this.objectsOf(foe.idx, 'gold'); if (foe.money > 100 && l.length) [zx, zy] = centre(l[0]); },
      stores: () => {
        if (!(foe.balls || foe.powder > 19)) return;
        const l = this.objectsOf(foe.idx, rnd(2) ? 'balls' : 'powder');
        if (l.length) [zx, zy] = centre(l[0]);
      },
    };
    const t0 = rnd(100);
    if (p.strategy) target.king();
    switch (p.strategy) {
      case 1: if (t0 < 30) target.gold(); if (t0 > 60) target.stores(); break;
      case 2: target.cannons(); if (t0 < 90) target.gold(); break;
      case 3:
        if (t0 < 50) target.cannons(); else if (t0 < 70) target.gold(); else if (t0 < 90) target.stores();
        if (!rnd(3)) target.mines();
        break;
      case 4: target.cannons(); break;
      case 5: target.cannons(); if (t0 < 90) target.mines(); break;
      default: break;
    }

    // Original: the strength decides how far the computer misses (cx in 0..3).
    const spread = 49 - (p.strength - 1) * 16;
    const miss = rnd(spread) - spread / 2;
    const wd = n ? -this.wind : this.wind;
    const aimFrom = (cannon) => {
      const m = this.muzzle(cannon);
      const y = m.y - zy; // original: y = ka.y - 10 - zy
      const x = Math.abs(m.x - zx + miss);
      let vx = 0.5, vy = 0, x2 = -1;
      while (vx < 7 && (x2 < x || vy / 3.5 > vx)) {
        vx += 0.4;
        let t = 0, vx2 = vx;
        x2 = 0;
        while (vx2 > 0 && x2 < x) {
          x2 += vx2;
          vx2 += (wd / 2 - vx2) / 5000;
          t++;
        }
        vy = y / t + 0.5 * G * t;
      }
      const angle = Math.atan2(vy, vx) * 57.296;
      const powder = clamp(Math.trunc((4 * vx) / Math.cos(angle / 57.296) - 1.6), 0, 99);
      return { cannon, angle, powder, vx: vx * f, vy };
    };
    // Burgfehde: the computer picks a cannon whose shot does not hit its own castle
    // (in the original it often shot its own walls to pieces at the start).
    const order = [...cannons].sort(() => Math.random() - 0.5);
    for (const cannon of order) {
      const shot = aimFrom(cannon);
      if (this.shotClearsOwnCastle(cannon, shot.vx, shot.vy)) return shot;
    }
    return aimFrom(order[0]);
  }

  /** Burgfehde: does a shot with this start speed leave its own building zone without hitting anything? */
  shotClearsOwnCastle(cannon, vx, vy) {
    const n = cannon.owner, width = this.players[n].width + BUILD_MARGIN;
    const m = this.muzzle(cannon);
    let x = m.x, y = m.y;
    for (let s = 0; s < 2000; s++) {
      x += vx;
      y -= vy;
      vy -= G;
      vx += (this.wind / 2 - vx) / 5000;
      if (n === 0 ? x > width : x < W - width) return true;
      if (x < 3 || x > 637 || y >= 396) return false;
      if (y >= 3) { // same ball size as in stepProjectile()
        const bx = x | 0, by = y | 0, hit = (i, j) => this.loc(i, j, cannon.id, true);
        if (hit(bx, by)) return false;
        for (let i = -1; i <= 1; i++) if (hit(bx - 2, by + i) || hit(bx + 2, by + i) || hit(bx + i, by + 2)) return false;
      }
    }
    return false;
  }

  /* ======================= settings changed during a game ======================= */

  /** Original: the "Modus" menu switches who plays each side, even in a running game. */
  setControl(types) {
    types.forEach((t, i) => (this.players[i].type = t));
    if (this.phase === 'aim' && this.cur.type === 'ai') {
      this.building = null;
      this.phase = 'ai';
      this.aiTimer = 0.6;
    } else if (this.phase === 'ai' && this.cur.type === 'human') {
      this.phase = 'aim';
      this.aiTimer = 0;
    }
    this.emit();
  }

  setComputers(sides) {
    sides.forEach((s, i) => {
      this.players[i].strategy = s.strategy;
      this.players[i].strength = s.strength;
    });
    this.emit();
  }

  /** Burgfehde: the sky for this game, from the time-of-day option. */
  pickSky() {
    const t = this.options.timeOfDay;
    return TIMES.includes(t) ? t : TIMES[rnd(TIMES.length)];
  }

  setOptions(o) {
    const before = this.options.timeOfDay;
    this.options = { ...this.options, ...o, extensions: { ...this.options.extensions, ...(o.extensions || {}) } };
    if (this.options.timeOfDay !== before) this.sky = this.pickSky();
    this.emit();
  }

  /* ======================= per-frame update ======================= */

  update(dt) {
    dt = Math.min(dt, 0.05);
    for (const pt of this.particles) {
      if (pt.smoke) {
        pt.vy *= Math.pow(0.5, dt);
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        continue;
      }
      pt.vy += 220 * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (this.isSolid(pt.x, pt.y) && pt.vy > 0) { pt.vy *= -0.3; pt.vx *= 0.5; }
    }
    this.particles = this.particles.filter((pt) => pt.life > 0 && pt.y < H + 4);
    for (const fl of this.flashes) fl.t += dt;
    for (const b of this.blasts) b.t += dt;
    this.blasts = this.blasts.filter((b) => b.t < b.life);
    this.flashes = this.flashes.filter((fl) => fl.t < fl.life);
    this.shake = this.shake > 0.1 ? this.shake * Math.pow(0.02, dt) : 0;

    let busy = false;
    for (const o of this.objects) {
      if (!o.alive || !o.fall) continue;
      busy = true;
      o.fall.vy += 260 * dt;
      o.fall.acc += o.fall.vy * dt;
      while (o.fall && o.fall.acc >= 1) {
        o.fall.acc -= 1;
        if (this.supported(o)) {
          const dist = o.y - o.fall.startY;
          o.fall = null;
          if (dist > 20 && !CHAMBERS.includes(o.type)) this.destroy(o, undefined, 'fall');
          break;
        }
        o.y += 1;
        if (o.y > H) { o.alive = false; o.fall = null; break; }
      }
    }

    if (this.projectile) {
      busy = true;
      this.stepAcc += dt * STEPS_PER_SECOND;
      let n = 0;
      while (this.stepAcc >= 1 && this.projectile && n++ < 40) {
        this.stepAcc -= 1;
        this.stepProjectile();
      }
    } else this.stepAcc = 0;

    if (this.phase === 'flying' && !busy && this.flashes.length === 0) {
      this.phase = this.returnPhase;
      this.turnEnding = 0.6;
    }
    if (this.turnEnding > 0 && (this.phase === 'aim' || this.phase === 'ai')) {
      this.turnEnding -= dt;
      if (this.turnEnding <= 0) { this.turnEnding = 0; this.finishMove(); }
      return;
    }
    if (this.phase === 'ai') {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) { this.aiTimer = 1e9; this.aiAct(); }
    }
  }
}
