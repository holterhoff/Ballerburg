/*
 * Die Originalgeräusche von Ballerburg, nachgebaut wie der Soundchip des Atari ST (YM2149) sie spielt.
 * Im Original setzt baller() die Register per Dosound():
 *   Kanal A: Ton mit Periode 15*256 und Rauschen mit Periode 31, beide zusammen (Mischer 192),
 *   Lautstärke über die Hüllkurve, Form 0 (einmal abklingen, dann still), Hüllkurvenperiode r*256.
 * Jeder Aufruf startet die Hüllkurve neu. Daraus entstehen Abschuss, Einschlag und Explosion.
 * Im Flug pfeift Kanal B mit Lautstärke 10 und der Periode 1000 + 2*y (y = Höhe der Kugel).
 */

const CLOCK = 2000000;
const TONE_A = 15 * 256; // reg 0/1
const NOISE = 31; // reg 6
/** Logarithmic volume of the chip, 0..15 (same curve as in music.js). */
const level = (v) => (v <= 0 ? 0 : Math.pow(2, (v - 15) / 2));
const OUT = 0.18; // same output scale as the music

/**
 * Renders a series of envelope restarts on channel A.
 * triggers: [{ t: seconds, r: coarse envelope period }]
 */
export function renderBaller(sampleRate, triggers) {
  const last = triggers[triggers.length - 1];
  const decay = (r) => (256 * Math.max(1, r * 256)) / CLOCK; // shape 0: one decay of 16 steps
  const length = Math.ceil((last.t + decay(last.r) + 0.02) * sampleRate);
  const out = new Float32Array(length);
  const toneStep = CLOCK / (16 * TONE_A) / sampleRate;
  const noiseStep = CLOCK / (16 * NOISE) / sampleRate;
  let phase = 0, noiseAcc = 0, lfsr = 1, bit = 1;
  let k = 0, start = 0, dur = decay(triggers[0].r);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    while (k + 1 < triggers.length && t >= triggers[k + 1].t) {
      k++;
      start = triggers[k].t;
      dur = decay(triggers[k].r);
    }
    phase = (phase + toneStep) % 1;
    noiseAcc += noiseStep;
    while (noiseAcc >= 1) { // 17-bit LFSR like the YM2149
      noiseAcc -= 1;
      bit = (lfsr ^ (lfsr >> 3)) & 1;
      lfsr = (lfsr >> 1) | (bit << 16);
    }
    const e = t < start ? 0 : 1 - (t - start) / dur; // 1 .. 0
    if (e <= 0) continue;
    const vol = level(Math.ceil(e * 30) / 2); // the YM2149 has 32 envelope steps
    out[i] = (phase < 0.5 && bit === 1 ? 1 : -1) * vol * OUT;
  }
  return out;
}

/** Original: baller(0) right before the ball leaves the barrel. */
export const SHOT = [{ t: 0, r: 0 }];

/** Original: the impact in schuss() calls baller(22 + c*3) for the four circles it digs. */
export const IMPACT = [0, 1, 2, 3].map((c) => ({ t: c * 0.01, r: 22 + c * 3 }));

/**
 * Original: expls(..., d) calls baller((d & 31) ^ 31) in every one of its d frames.
 * Each frame took about 20 ms (10 ms in expls, 10 ms in baller).
 */
export function explosion(d) {
  const out = [];
  for (let i = 0; i < d; i++) out.push({ t: i * 0.02, r: ((d - 1 - i) & 31) ^ 31 });
  return out;
}

/** Channel B while the ball flies: period 1000 + 2*y, at least 30. */
export function whistleFrequency(y) {
  const a = Math.max(30, Math.round(1000 + 2 * y));
  return CLOCK / (16 * a);
}
export const WHISTLE_GAIN = level(10) * OUT;
