// Spielstand als kleines, verschickbares Paket.
//
// Im Online-Spiel rechnet immer das Gerät des Spielers, der gerade am Zug ist. Nach jeder Änderung
// (Kauf, Steuern, Anbauen) und am Ende des Zugs schickt es den ganzen Spielstand an die anderen.
// Das Gelände (640 x 400 Felder) wird lauflängenkodiert, dann ist ein Stand nur wenige Kilobyte groß.

/** Nur für die Darstellung oder nur für dieses Gerät: wird nicht verschickt. */
const LOCAL = new Set([
  'onChange', 'onTurnEnd', 'mySide', 'particles', 'flashes', 'blasts', 'bolts', 'projectile',
  'stepAcc', 'aiTimer', 'aiStep', 'turnEnding', 'shake', 'skyFlash', 'terrainDirty', 'selected', 'building',
]);
const BYTES = ['solid', 'interior'];

/** Lauflängen-Kodierung eines Byte-Feldes: [Wert, Anzahl, Wert, Anzahl, …] als Base64. */
function packBytes(arr) {
  const out = [];
  for (let i = 0; i < arr.length;) {
    const v = arr[i];
    let n = 1;
    while (i + n < arr.length && arr[i + n] === v && n < 65535) n++;
    out.push(v, n & 255, n >> 8);
    i += n;
  }
  return toBase64(Uint8Array.from(out));
}

function unpackBytes(b64, length) {
  const src = fromBase64(b64);
  const arr = new Uint8Array(length);
  let o = 0;
  for (let i = 0; i < src.length; i += 3) {
    const n = src[i + 1] | (src[i + 2] << 8);
    arr.fill(src[i], o, o + n);
    o += n;
  }
  return arr;
}

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Den Spielstand einpacken. */
export function packGame(g) {
  const data = {};
  for (const [k, v] of Object.entries(g)) {
    if (LOCAL.has(k) || typeof v === 'function') continue;
    if (BYTES.includes(k)) data[k] = packBytes(v);
    else if (k === 'blueprint') data[k] = v.map(packBytes);
    else if (k === 'heights') data[k] = toBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    else data[k] = v;
  }
  return JSON.parse(JSON.stringify(data));
}

/**
 * Einen empfangenen Stand übernehmen. `mySide` ist die Burg dieses Geräts (0 links, 1 rechts, -1 Zuschauer):
 * Die eigene Burg spielt ein Mensch, die andere gilt als "remote" und wird nur über das Netz bewegt.
 */
export function applyGame(g, data, mySide) {
  for (const [k, v] of Object.entries(data)) {
    if (LOCAL.has(k)) continue;
    if (BYTES.includes(k)) g[k] = unpackBytes(v, g[k]?.length || v.length);
    else if (k === 'blueprint') g[k] = v.map((b, i) => unpackBytes(b, g.blueprint?.[i]?.length || g.solid.length));
    else if (k === 'heights') { const b = fromBase64(v); g[k] = new Float32Array(b.buffer, 0, b.length / 4); }
    else g[k] = v;
  }
  for (const p of g.players) p.type = p.idx === mySide ? 'human' : 'remote';
  g.mySide = mySide;
  if (g.phase !== 'over' && g.phase !== 'flying') g.phase = g.cur.type === 'remote' ? 'remote' : 'aim';
  if (g.cur.type === 'human' && g.phase === 'aim') {
    const cannons = g.objectsOf(g.current, 'cannon');
    g.selected = (cannons.find((c) => c.id === g.cur.lastCannon) || cannons[0])?.id ?? null;
  } else g.selected = null;
  g.building = null;
  g.projectile = null;
  g.turnEnding = 0;
  g.terrainDirty = true;
  g.emit();
}
