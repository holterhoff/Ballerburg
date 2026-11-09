import {
  W, H, CELL, GRAVITY, WIND_ACC, MAX_WIND, SPEED_PER_POWDER, MAX_POWDER, DEFAULT_POWDER, TIME_SCALE, SUBSTEP,
  HOME, SIZES, EARTH, BRICK,
} from './constants.js';
import { buildCastle, CASTLES } from './castles.js';
import { generateHeights } from './terrain.js';
import { sound } from './sound.js';
import { recordResult } from './scores.js';

export const BASE_PRICES = { stones: 120, cannon: 320, powder: 28, balls: 24, vane: 140, mine: 420 };

export const SHOP = [
  { key: 'stones', label: '20 Steine', hint: 'Mauern ausbessern oder erhöhen' },
  { key: 'cannon', label: 'Kanone', hint: 'auf eine freie Fläche stellen' },
  { key: 'powder', label: '30 Pulver', hint: 'ein Schuss kostet 1–20' },
  { key: 'balls', label: '2 Kugeln', hint: 'eine Kugel je Schuss' },
  { key: 'vane', label: 'Windfahne', hint: 'zeigt die genaue Windstärke' },
  { key: 'mine', label: 'Förderturm', hint: '+40 Gold jede Runde' },
];

const PLACEABLE = ['cannon', 'vane', 'mine'];
export const OBJECT_NAMES = {
  king: 'König', cannon: 'Kanone', powder: 'Pulverlager', balls: 'Kugellager',
  gold: 'Geldsack', vane: 'Windfahne', mine: 'Förderturm',
};

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Game {
  /**
   * @param {{players: {name:string, type:'human'|'ai', level?:number, castle:string}[]}} cfg
   * @param {() => void} onChange called whenever UI-relevant state changes
   */
  constructor(cfg, onChange = () => {}) {
    this.onChange = onChange;
    this.solid = new Uint8Array(W * H);
    this.heights = cfg.heights ? Float32Array.from(cfg.heights) : generateHeights(cfg.terrain);
    for (let x = 0; x < W; x++)
      for (let y = Math.ceil(this.heights[x]); y < H; y++) this.solid[y * W + x] = EARTH;

    this.objects = [];
    this.nextId = 1;
    this.players = cfg.players.map((pc, i) => {
      const c = CASTLES[pc.castle];
      return {
        idx: i, name: pc.name, type: pc.type, level: pc.level || 2, castle: pc.castle,
        ...c.start, tax: 20, stones: 0, owed: { cannon: 0, vane: 0, mine: 0 },
        firstTurn: true, lastIncome: 0, popChange: 0, shots: 0, hits: 0,
      };
    });
    this.players.forEach((p, i) => {
      const { bricks, objects } = buildCastle(p.castle, i);
      bricks.forEach(([x, y]) => this.fillBrick(x, y, BRICK + i));
      p.originalBricks = bricks;
      objects.forEach((o) => this.addObject(o.type, i, o.x, o.y));
    });

    this.wind = randInt(-6, 6);
    this.round = 1;
    this.current = Math.random() < 0.5 ? 0 : 1;
    this.starter = this.current;
    this.prices = { ...BASE_PRICES };
    this.projectile = null;
    this.particles = [];
    this.flashes = [];
    this.blasts = [];
    this.messages = [];
    this.phase = 'idle';
    this.winner = null;
    this.endReason = '';
    this.selected = null;
    this.placing = null;
    this.shake = 0;
    this.accum = 0;
    this.aiTimer = 0;
    this.aiStep = null;
    this.autoEnd = 0;
    this.terrainDirty = true;
    this.say(`Die Fehde beginnt. ${this.cur.name} hat den ersten Zug.`, 'big');
    this.startTurn(true);
  }

  get cur() { return this.players[this.current]; }
  get foe() { return this.players[1 - this.current]; }
  emit() { this.onChange(); }

  say(text, tone = 'info') {
    this.messages.unshift({ id: `${Date.now()}-${Math.random()}`, text, tone, round: this.round });
    if (this.messages.length > 7) this.messages.length = 7;
  }

  /* ---------- world helpers ---------- */

  fillBrick(x, y, t) {
    for (let j = 0; j < CELL; j++)
      for (let i = 0; i < CELL; i++) {
        const px = x + i, py = y + j;
        if (px >= 0 && px < W && py >= 0 && py < H) this.solid[py * W + px] = t;
      }
    this.terrainDirty = true;
  }

  addObject(type, owner, x, y) {
    const [w, h] = SIZES[type];
    const o = { id: this.nextId++, type, owner, x, y, w, h, alive: true, fired: false, aim: { angle: 45, powder: DEFAULT_POWDER }, fall: null, lastTrail: null };
    this.objects.push(o);
    return o;
  }

  obj(id) { return this.objects.find((o) => o.id === id) || null; }
  objectsOf(owner, type) { return this.objects.filter((o) => o.alive && o.owner === owner && (!type || o.type === type)); }
  hasVane(owner) { return this.objectsOf(owner, 'vane').length > 0; }

  isSolid(x, y) {
    x |= 0; y |= 0;
    if (x < 0 || x >= W || y < 0) return false;
    if (y >= H) return true;
    return this.solid[y * W + x] !== 0;
  }

  supported(o) {
    const by = (o.y | 0) + o.h;
    if (by >= H) return true;
    for (let x = o.x; x < o.x + o.w; x++) if (this.solid[by * W + x]) return true;
    return false;
  }

  rectFree(x, y, w, h, gap = 0) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) if (this.isSolid(i, j)) return false;
    return !this.objects.some((o) => o.alive && x < o.x + o.w + gap && x + w + gap > o.x && y < o.y + o.h + gap && y + h + gap > o.y);
  }

  /* ---------- turn flow ---------- */

  startTurn(first = false) {
    const p = this.cur;
    if (!first) this.wind = clamp(this.wind + randInt(-3, 3), -MAX_WIND, MAX_WIND);
    if (!p.firstTurn) this.economy(p);
    p.firstTurn = false;
    for (const k of Object.keys(BASE_PRICES)) this.prices[k] = Math.round(BASE_PRICES[k] * rand(0.9, 1.12));
    this.hasFired = false;
    this.autoEnd = 0;
    this.placing = null;
    if (this.checkSurrender(p)) return;

    if (p.type === 'ai') {
      this.phase = 'ai';
      this.aiStep = 'shop';
      this.aiTimer = 1.0;
      this.selected = null;
    } else {
      this.phase = 'aim';
      const cs = this.objectsOf(this.current, 'cannon');
      this.selected = cs[0]?.id ?? null;
      if (p.owed.cannon + p.owed.vane + p.owed.mine > 0) this.say(`${p.name}: Gekaufte Teile warten noch auf ihren Platz.`);
    }
    this.emit();
  }

  economy(p) {
    const income = this.expectedIncome(p);
    p.money += income;
    p.lastIncome = income;
    const growth = (0.12 - p.tax / 100) * 0.15;
    const before = p.pop;
    p.pop = clamp(Math.round(p.pop * (1 + growth) + (growth > 0 ? 1 : -1)), 0, 500);
    p.popChange = p.pop - before;
  }

  expectedIncome(p) {
    const base = Math.round((p.pop * p.tax) / 100 * 1.4);
    return (this.objectsOf(p.idx, 'gold').length ? base : Math.round(base / 2)) + this.objectsOf(p.idx, 'mine').length * 40;
  }

  checkSurrender(p) {
    const cannons = this.objectsOf(p.idx, 'cannon').length + p.owed.cannon;
    // The king only gives up when even two more rounds of taxes would not buy what is missing.
    const reach = p.money + 2 * this.expectedIncome(p);
    let reason = null;
    if (p.pop <= 0) reason = `Das Volk von ${p.name} hat die Burg verlassen.`;
    else if (cannons === 0 && reach < this.prices.cannon) reason = `${p.name} hat keine Kanone mehr und kann sich keine neue leisten. Der König kapituliert.`;
    else if (p.balls === 0 && reach < this.prices.balls) reason = `${p.name} hat keine Kugeln mehr und kann keine kaufen. Der König kapituliert.`;
    else if (p.powder < 2 && reach < this.prices.powder) reason = `${p.name} hat kein Pulver mehr und kann keins kaufen. Der König kapituliert.`;
    if (!reason) return false;
    this.say(reason, 'big');
    this.gameOver(1 - p.idx, reason);
    return true;
  }

  surrender() {
    if (this.phase !== 'aim') return;
    const reason = `Der König von ${this.cur.name} hisst die weiße Fahne.`;
    this.say(reason, 'big');
    this.gameOver(1 - this.current, reason);
  }

  endTurn() {
    if (this.phase === 'over' || this.projectile || this.blasts.length) return;
    if (this.phase !== 'aim' && this.phase !== 'ai') return;
    this.current = 1 - this.current;
    if (this.current === this.starter) this.round++;
    this.startTurn();
  }

  gameOver(winner, reason) {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.winner = winner;
    this.endReason = reason;
    this.placing = null;
    this.aiStep = null;
    const w = this.players[winner], l = this.players[1 - winner];
    recordResult(w.name, l.name);
    if (w.type === 'human' || l.type === 'ai') sound.fanfare();
    this.emit();
  }

  /** Verdict of the winning king on the winner's marksmanship, shown at the end. */
  verdict(p) {
    const q = p.shots ? p.hits / p.shots : 0;
    if (p.shots === 0) return 'Gewonnen, ohne einen Schuss abzugeben. Bemerkenswert.';
    if (q >= 0.6) return 'Meisterhaft. Die Kanoniere bekommen doppelten Sold.';
    if (q >= 0.35) return 'Ordentlich geschossen. Der Hof ist zufrieden.';
    if (q >= 0.15) return 'Viel Pulver für wenig Treffer, aber gewonnen ist gewonnen.';
    return 'Der Sieg kam eher trotz als wegen der Kanoniere.';
  }

  /* ---------- shooting ---------- */

  canFire(c) {
    const p = this.cur;
    return !!c && c.alive && !c.fall && c.owner === this.current && !this.hasFired && p.balls > 0 && p.powder >= 1;
  }

  muzzle(c, angle) {
    const dir = c.owner === 0 ? 1 : -1;
    const a = (angle * Math.PI) / 180;
    const px = c.x + c.w / 2, py = c.y + 3;
    return { x: px + dir * Math.cos(a) * 9, y: py - Math.sin(a) * 9, dir, a };
  }

  fire(id, angle, powder) {
    if (this.phase !== 'aim' && this.phase !== 'ai') return false;
    const c = this.obj(id);
    if (!this.canFire(c)) return false;
    const p = this.cur;
    powder = clamp(Math.round(powder), 1, Math.min(MAX_POWDER, p.powder));
    angle = clamp(Math.round(angle), 0, 90);
    p.powder -= powder;
    p.balls -= 1;
    p.shots++;
    this.hasFired = true;
    c.aim = { angle, powder };
    const m = this.muzzle(c, angle);
    const v = powder * SPEED_PER_POWDER;
    this.projectile = { x: m.x, y: m.y, vx: m.dir * Math.cos(m.a) * v, vy: -Math.sin(m.a) * v, ignore: c.id, owner: c.owner, cannon: c.id, trail: [], steps: 0 };
    this.returnPhase = this.phase;
    this.phase = 'flying';
    this.placing = null;
    sound.shot();
    this.emit();
    return true;
  }

  hitTest(x, y, ignoreId) {
    const px = x | 0, py = y | 0;
    if (py >= H) return { solid: true };
    if (px < 0 || px >= W) return null;
    if (py < 0) return this.heights[px] < py ? { solid: true } : null;
    if (this.solid[py * W + px]) return { solid: true };
    if (px < 200 || px > 440) {
      for (const o of this.objects)
        if (o.alive && o.id !== ignoreId && px >= o.x && px < o.x + o.w && py >= o.y && py < o.y + o.h) return { obj: o };
    }
    return null;
  }

  stepProjectile() {
    const pr = this.projectile;
    pr.vx += this.wind * WIND_ACC * SUBSTEP;
    pr.vy += GRAVITY * SUBSTEP;
    pr.x += pr.vx * SUBSTEP;
    pr.y += pr.vy * SUBSTEP;
    if (++pr.steps % 3 === 0) pr.trail.push([pr.x, pr.y]);
    if (pr.x < -4 || pr.x > W + 4 || pr.steps > 120 * 30) {
      this.say('Die Kugel fliegt aus dem Feld.');
      this.finishProjectile();
      return;
    }
    if (this.hitTest(pr.x, pr.y, pr.ignore)) {
      this.finishProjectile();
      this.explode(pr.x, pr.y, 1, pr.owner);
    }
  }

  finishProjectile() {
    const pr = this.projectile;
    const c = this.obj(pr.cannon);
    if (c) c.lastTrail = pr.trail.concat([[pr.x, pr.y]]);
    this.projectile = null;
  }

  explode(x, y, power, by) {
    const re = Math.round(8 * power), rb = Math.round(5 * power);
    const x0 = x | 0, y0 = y | 0;
    for (let dy = -re; dy <= re; dy++)
      for (let dx = -re; dx <= re; dx++) {
        const px = x0 + dx, py = y0 + dy;
        if (px < 0 || px >= W || py < 0 || py >= H) continue;
        const i = py * W + px;
        const t = this.solid[i];
        if (!t) continue;
        const d2 = dx * dx + dy * dy;
        if (t === EARTH ? d2 <= re * re : d2 <= rb * rb) {
          this.solid[i] = 0;
          if (Math.random() < 0.12) this.spawnDebris(px, py, t === EARTH ? '#5a4436' : t === BRICK ? '#c9a26b' : '#93a6bb');
        }
      }
    this.settleEarth(x0 - re - 1, x0 + re + 1);
    this.terrainDirty = true;
    this.flashes.push({ x, y, r: re * 1.7, t: 0, life: 0.4 });
    this.shake = Math.min(7, this.shake + 3.5 * power);
    sound.boom(power);

    const reach = 4 * power;
    for (const o of this.objects) {
      if (!o.alive) continue;
      const cx = clamp(x, o.x, o.x + o.w), cy = clamp(y, o.y, o.y + o.h);
      if (Math.hypot(x - cx, y - cy) <= reach) this.destroy(o, by);
    }
    this.checkSupport();
  }

  /** Loose earth above a crater slides down until it rests on something. Bricks stay where they are. */
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
        if (moved % 9 === 0) this.spawnDebris(x, ny, '#5a4436');
      }
      let top = 0;
      while (top < H && this.solid[top * W + x] === 0) top++;
      if (this.heights[x] >= 0) this.heights[x] = top;
    }
    if (moved > 40) {
      this.shake = Math.min(7, this.shake + 1.5);
      if (moved > 400) this.say('Ein Hang rutscht ab.');
    }
  }

  checkSupport() {
    for (const o of this.objects)
      if (o.alive && !o.fall && !this.supported(o)) o.fall = { vy: 0, acc: 0, startY: o.y };
  }

  destroy(o, by, cause = 'hit') {
    if (!o.alive) return;
    o.alive = false;
    o.fall = null;
    const owner = this.players[o.owner];
    if (by !== undefined && by !== o.owner) this.players[by].hits++;
    for (let i = 0; i < 18; i++) this.spawnDebris(o.x + Math.random() * o.w, o.y + Math.random() * o.h, ['#ffd23f', '#f4f1e8', '#7a4b2a', '#2b2d33'][i % 4]);
    const own = by === o.owner ? ' (eigener Treffer)' : '';
    const how = cause === 'fall' ? 'stürzt ab' : 'getroffen';
    switch (o.type) {
      case 'king':
        this.say(`Der König von ${owner.name} ist gefallen${own}.`, 'big');
        this.gameOver(1 - o.owner, `Der König von ${owner.name} wurde ${cause === 'fall' ? 'vom Einsturz begraben' : 'getroffen'}.`);
        break;
      case 'powder':
        this.say(`Das Pulverlager von ${owner.name} fliegt in die Luft. ${owner.powder} Pulver verloren${own}.`, 'hit');
        owner.powder = 0;
        this.blasts.push({ x: o.x + o.w / 2, y: o.y + o.h / 2, power: 1.7, delay: 0.25, by });
        break;
      case 'balls':
        this.say(`Das Kugellager von ${owner.name} ist zerstört. ${owner.balls} Kugeln verloren${own}.`, 'hit');
        owner.balls = 0;
        break;
      case 'gold': {
        const sacks = this.objectsOf(o.owner, 'gold').length + 1;
        const loss = Math.floor(owner.money / sacks);
        owner.money -= loss;
        this.say(`Ein Geldsack von ${owner.name} ist zerfetzt. ${loss} Gold verloren${own}.`, 'hit');
        break;
      }
      default:
        this.say(`${OBJECT_NAMES[o.type]} von ${owner.name} ${how}${own}.`, 'hit');
    }
  }

  spawnDebris(x, y, col) {
    if (this.particles.length > 600) return;
    this.particles.push({ x, y, vx: rand(-60, 60), vy: rand(-110, -20), life: rand(0.6, 1.4), col });
  }

  /* ---------- per-frame update ---------- */

  update(dt) {
    dt = Math.min(dt, 0.05);
    for (const p of this.particles) {
      p.vy += 220 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (this.isSolid(p.x, p.y) && p.vy > 0) { p.vy *= -0.3; p.vx *= 0.5; }
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y < H + 4);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.life);
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
          if (dist > 20) this.destroy(o, undefined, 'fall');
          break;
        }
        o.y += 1;
        if (o.y > H) { this.destroy(o, undefined, 'fall'); break; }
      }
    }

    for (const b of this.blasts) b.delay -= dt;
    const due = this.blasts.filter((b) => b.delay <= 0);
    this.blasts = this.blasts.filter((b) => b.delay > 0);
    due.forEach((b) => this.explode(b.x, b.y, b.power, b.by));
    if (this.blasts.length) busy = true;

    if (this.projectile) {
      busy = true;
      this.accum += dt * TIME_SCALE;
      while (this.accum >= SUBSTEP && this.projectile) {
        this.accum -= SUBSTEP;
        this.stepProjectile();
      }
    } else this.accum = 0;

    if (this.phase === 'flying' && !busy) {
      this.phase = this.returnPhase;
      this.afterShot();
    }
    if (this.phase === 'ai') {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) this.aiAct();
    }
    if (this.autoEnd > 0 && this.phase === 'aim') {
      this.autoEnd -= dt;
      if (this.autoEnd <= 0) { this.autoEnd = 0; this.endTurn(); }
    }
  }

  afterShot() {
    if (this.phase === 'over') return;
    // One shot per turn: once the dust settles the turn passes to the opponent.
    if (this.phase === 'ai') { this.aiStep = 'done'; this.aiTimer = 0.9; }
    else this.autoEnd = 1.0;
    this.emit();
  }

  /* ---------- economy & building ---------- */

  setTax(v) {
    this.cur.tax = clamp(Math.round(v), 0, 60);
    this.emit();
  }

  buy(key) {
    if (this.phase !== 'aim' && this.phase !== 'ai') return false;
    const p = this.cur;
    const price = this.prices[key];
    if (p.money < price) { if (p.type === 'human') sound.error(); return false; }
    p.money -= price;
    if (key === 'powder') p.powder += 30;
    else if (key === 'balls') p.balls += 2;
    else if (key === 'stones') { p.stones += 20; if (p.type === 'human') this.placing = 'stones'; }
    else if (PLACEABLE.includes(key)) { p.owed[key]++; if (p.type === 'human') this.placing = key; }
    if (p.type === 'human') sound.coin();
    this.emit();
    return true;
  }

  startPlacing(key) {
    const p = this.cur;
    if (this.phase !== 'aim') return;
    if (key === 'stones' ? p.stones > 0 : p.owed[key] > 0) this.placing = key;
    this.emit();
  }

  cancelPlacing() {
    this.placing = null;
    this.emit();
  }

  /** Where an item would land if dropped at (lx, ly), or null if not allowed there. */
  placementSpot(key, lx, ly, side = this.current) {
    const [h0, h1] = HOME[side];
    if (key === 'stones') {
      const x = Math.floor(lx / CELL) * CELL, y = Math.floor(ly / CELL) * CELL;
      if (x < h0 || x + CELL > h1 || y < 0 || y + CELL > H) return null;
      if (!this.rectFree(x, y, CELL, CELL)) return null;
      const touches =
        this.isSolid(x + 1, y + CELL) || this.isSolid(x - 1, y + 1) || this.isSolid(x + CELL, y + 1) || this.isSolid(x + 1, y - 1);
      return touches ? { x, y, w: CELL, h: CELL } : null;
    }
    const [w, h] = SIZES[key];
    const x = Math.round(lx - w / 2);
    if (x < h0 || x + w > h1) return null;
    let y = Math.max(0, Math.round(ly));
    const cx = x + (w >> 1);
    while (y < H && !this.isSolid(cx, y)) y++;
    if (y >= H) return null;
    const top = y - h;
    if (top < 0 || !this.rectFree(x, top, w, h, 1)) return null;
    const spot = { x, y: top, w, h };
    return this.supported(spot) ? spot : null;
  }

  place(lx, ly) {
    const key = this.placing;
    if (!key || this.phase !== 'aim') return false;
    const p = this.cur;
    const spot = this.placementSpot(key, lx, ly);
    if (!spot) { sound.error(); return false; }
    if (key === 'stones') {
      this.fillBrick(spot.x, spot.y, BRICK + this.current);
      p.stones--;
      if (p.stones <= 0) this.placing = null;
    } else {
      this.addObject(key, this.current, spot.x, spot.y);
      p.owed[key]--;
      this.placing = p.owed[key] > 0 ? key : null;
      if (key === 'cannon') this.selected = this.objects[this.objects.length - 1].id;
      this.say(`${p.name} stellt ${key === 'cannon' ? 'eine neue Kanone' : key === 'vane' ? 'eine Windfahne' : 'einen Förderturm'} auf.`);
    }
    sound.click();
    this.emit();
    return true;
  }

  /* ---------- computer players ---------- */

  aiAct() {
    const p = this.cur;
    if (this.aiStep === 'shop') {
      this.aiShop(p);
      this.aiStep = 'fire';
      this.aiTimer = 0.6;
      this.emit();
      return;
    }
    if (this.aiStep === 'fire') {
      const cannons = this.objectsOf(this.current, 'cannon').filter((k) => this.canFire(k));
      let pick = null;
      for (const c of cannons) {
        const shot = this.aiAim(p, c);
        if (shot && (!pick || shot.score < pick.shot.score)) pick = { c, shot };
      }
      if (!pick) { this.aiStep = 'done'; this.aiTimer = 0.8; return; }
      this.selected = pick.c.id;
      pick.c.aim = { angle: pick.shot.angle, powder: pick.shot.powder };
      this.fire(pick.c.id, pick.shot.angle, pick.shot.powder);
      return;
    }
    if (this.aiStep === 'done') this.endTurn();
  }

  aiShop(p) {
    const tryBuy = (k) => this.buy(k);
    while (p.balls < 4 && p.money >= this.prices.balls) tryBuy('balls');
    while (p.powder < 60 && p.money >= this.prices.powder + (p.balls > 0 ? 0 : this.prices.balls)) tryBuy('powder');
    const cannons = this.objectsOf(p.idx, 'cannon').length;
    if (cannons < 2 && p.money >= this.prices.cannon) this.aiBuild('cannon', p);
    if (p.level >= 2 && !this.hasVane(p.idx) && p.money >= this.prices.vane + 150) this.aiBuild('vane', p);
    if (this.objectsOf(p.idx, 'mine').length < 2 && p.money >= this.prices.mine + 250) this.aiBuild('mine', p);
    if (p.money >= this.prices.stones + 120) this.aiRepair(p);
    p.tax = p.pop < 120 ? 10 : p.money < 150 ? 28 : 20;
  }

  aiBuild(key, p) {
    const [h0, h1] = HOME[p.idx];
    let best = null;
    for (let x = h0 + 8; x < h1 - 8; x += 2) {
      const s = this.placementSpot(key, x, 0, p.idx);
      if (!s) continue;
      const front = p.idx === 0 ? s.x : W - s.x;
      const score = key === 'cannon' ? s.y * 2 - front * 0.1 : front;
      if (!best || score < best.score) best = { ...s, score };
    }
    if (!best) return;
    if (!this.buy(key)) return;
    this.addObject(key, p.idx, best.x, best.y);
    p.owed[key]--;
    this.say(`${p.name} baut ${key === 'cannon' ? 'eine Kanone' : key === 'vane' ? 'eine Windfahne' : 'einen Förderturm'}.`);
  }

  aiRepair(p) {
    const missing = p.originalBricks
      .filter(([x, y]) => !this.isSolid(x + 1, y + 1) && this.rectFree(x, y, CELL, CELL))
      .sort((a, b) => b[1] - a[1]);
    if (missing.length < 10) return;
    if (!this.buy('stones')) return;
    let n = 0;
    for (const [x, y] of missing) {
      if (n >= 20) break;
      if (!this.isSolid(x + 1, y + CELL) && !this.isSolid(x - 1, y + 1) && !this.isSolid(x + CELL, y + 1)) continue;
      this.fillBrick(x, y, BRICK + p.idx);
      n++;
    }
    p.stones = 0;
    if (n) this.say(`${p.name} bessert ${n} Steine an der Burg aus.`);
  }

  simulateShot(c, angle, powder, wind) {
    const m = this.muzzle(c, angle);
    const v = powder * SPEED_PER_POWDER;
    let x = m.x, y = m.y, vx = m.dir * Math.cos(m.a) * v, vy = -Math.sin(m.a) * v;
    const ax = wind * WIND_ACC;
    for (let i = 0; i < 120 * 20; i++) {
      vx += ax * SUBSTEP;
      vy += GRAVITY * SUBSTEP;
      x += vx * SUBSTEP;
      y += vy * SUBSTEP;
      if (x < 0 || x >= W) return null;
      const hit = this.hitTest(x, y, c.id);
      if (hit) return { x, y, obj: hit.obj || null };
    }
    return null;
  }

  aiAim(p, c) {
    const enemy = 1 - p.idx;
    const targets = this.objectsOf(enemy);
    const king = targets.find((o) => o.type === 'king');
    if (!king) return null;
    let target = king;
    if (Math.random() < 0.35) {
      const others = targets.filter((o) => ['cannon', 'powder', 'gold'].includes(o.type));
      if (others.length) target = others[randInt(0, others.length - 1)];
    }
    const tx = target.x + target.w / 2, ty = target.y + target.h / 2;
    const wind = this.hasVane(p.idx) ? this.wind : this.wind * rand(0.2, 0.8);
    const [h0, h1] = HOME[p.idx];
    const maxP = Math.min(MAX_POWDER, p.powder);
    const score = (ang, pw) => {
      const r = this.simulateShot(c, ang, pw, wind);
      if (!r) return 1e9;
      let d = Math.hypot(r.x - tx, r.y - ty);
      if (r.obj && r.obj.owner === enemy) d *= 0.5;
      if (r.obj && r.obj.owner === p.idx) d += 2000;
      if (r.x >= h0 && r.x < h1) d += 1500;
      return d;
    };
    let best = { s: 1e9, a: 45, p: Math.min(DEFAULT_POWDER, maxP) };
    for (let a = 12; a <= 84; a += 2)
      for (let pw = 4; pw <= maxP; pw++) {
        const s = score(a, pw);
        if (s < best.s) best = { s, a, p: pw };
      }
    for (let a = best.a - 2; a <= best.a + 2; a += 0.5)
      for (let pw = Math.max(1, best.p - 1); pw <= Math.min(maxP, best.p + 1); pw++) {
        const s = score(a, pw);
        if (s < best.s) best = { s, a, p: pw };
      }
    // Aim gets sharper as the duel goes on, so early rounds are not decided by a lucky first volley.
    const warmup = Math.max(0, 3 - this.round) * 2.5;
    const noise = ([0, 7, 4.5, 2.2, 0.8][p.level] ?? 3) + warmup;
    const angle = clamp(Math.round(best.a + rand(-noise, noise)), 5, 88);
    let powder = best.p;
    if (Math.random() < 0.45 - p.level * 0.1) powder = clamp(powder + randInt(-1, 1), 1, maxP);
    return { angle, powder, score: best.s };
  }
}
