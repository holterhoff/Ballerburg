/*
 * Die Originalmusik von Ballerburg.
 * BALLER.MUS ist eine Datei aus Eckhard Kruses Musik-Editor (1986/87). Sie besteht aus einer Ablaufliste
 * (welche Takte in welcher Reihenfolge, mit Wiederholungen) und aus Takten mit 96 (Walzer: 72) Schritten.
 * In jedem Schritt bekommen die drei Stimmen des Atari-Soundchips (YM2149) einen Notenwert.
 * Diese Datei liest das Stück und rechnet es in Klang um; der Soundchip wird dabei nachgebildet.
 */
import { BALLER_MUS } from './ballermus.js';

/** Periods of the sound chip for each semitone (music.c: st_wert). */
const ST_WERT = [
  15, 16, 17, 18, 19, 20, 21, 22, 24, 25, 27, 28, 30, 32, 34, 36, 38, 40, 42, 45, 47, 50, 53, 56, 60,
  63, 67, 71, 75, 80, 84, 89, 95, 100, 106, 113, 119, 127, 134, 142, 150, 159, 169, 179, 190, 201, 213, 226, 239,
  253, 268, 284, 301, 319, 338, 358, 379, 402, 426, 451, 478, 506, 536, 568, 602, 638, 676, 716, 759, 804, 852, 903, 956,
  1013, 1073, 1136, 1204, 1276, 1351, 1432, 1517, 1607, 1703, 1804, 1911,
  2025, 2145, 2273, 2408, 2553, 2703, 2864, 3034, 3214, 3405, 3608, 3823,
];
/** Note number on the staff -> semitone (music.c: st_ton). */
const ST_TON = [
  0, 1, 3, 5, 7, 8, 10, 12, 13, 15, 17, 19, 20, 22, 24, 25, 27, 29, 31, 32, 34, 36, 37, 39, 41, 43, 44, 46, 48, 49, 51, 53,
  55, 56, 58, 60, 61, 63, 65, 67, 68, 70, 72, 73, 75, 77, 79, 80, 82, 84, 85, 87, 89, 91, 92, 94, 96,
];
const CHIP_CLOCK = 2000000; // Atari ST: YM2149 at 2 MHz

function words(bytes, from, count) {
  const out = new Int16Array(count);
  for (let i = 0; i < count; i++) out[i] = (bytes[from + 2 * i] << 8) | bytes[from + 2 * i + 1];
  return out;
}

/** Reads BALLER.MUS (like m_laden) and follows the play list (like m_musik). Returns one chip state per step. */
export function parseSong(bytes) {
  const head = words(bytes, 0, 8);
  const maxAbl = head[3], maxTkt = head[4], waltz = head[7];
  const wLen = waltz ? 72 : 96;
  let pos = 16 + 36;
  const liste = words(bytes, pos, (maxAbl + 1) * 4);
  pos += (maxAbl + 1) * 8;
  const takte = new Uint16Array(words(bytes, pos, (maxTkt + 1) * wLen).buffer);
  const note = (pattern, i) => (pattern < 0 ? 0 : takte[pattern * wLen + i] || 0);

  const steps = [];
  const tra = [0, 0, 0], lau = [100, 100, 100];
  const stack = [0, -2];
  let lp = 0, guard = 0;
  while (guard++ < 20000) {
    const v = liste[lp];
    if (v === -1) { // end of a block: return, or stop at the very end
      const mark = stack.pop();
      lp = stack.pop();
      if (mark === -2 || lp === undefined) break;
    } else if (v === -2) { tra[0] = liste[lp + 1]; tra[1] = liste[lp + 2]; tra[2] = liste[lp + 3]; lp += 4; }
    else if (v === -3) { lau[0] = liste[lp + 1]; lau[1] = liste[lp + 2]; lau[2] = liste[lp + 3]; lp += 4; }
    else if (v === -4) lp += 4; // tempo (the original player ignores it)
    else if (v === -5) { lp += 4; stack.push(lp, 0); } // start of a repeat
    else if (v === -6) { // leave the repeat after n passes
      lp += 4;
      if (stack[stack.length - 1] === liste[lp - 3]) {
        stack.length -= 2;
        let depth = 0;
        while (depth >= 0 && lp < liste.length) {
          if (liste[lp] === -1) depth = -1;
          depth += (liste[lp] === -5) - (liste[lp] === -7);
          lp += 4;
        }
      }
    } else if (v === -7) { stack[stack.length - 1]++; lp = stack[stack.length - 2]; } // repeat again
    else if (v === -8) { // call a sub list
      if (liste[lp + 1] < 0) lp += 4;
      else { stack.push(lp + 4, -5); lp = (liste[lp + 1] - 1) << 2; }
    } else { // one bar: noise pattern and three voices
      const [rau, k1, k2, k3] = [liste[lp], liste[lp + 1], liste[lp + 2], liste[lp + 3]];
      lp += 4;
      for (let i = 0; i < wLen; i++)
        steps.push({ noise: note(rau, i) & 255, voices: [k1, k2, k3].map((k, c) => voice(note(k, i), tra[c], lau[c])) });
    }
    if (lp >= liste.length) break;
  }
  return { steps, stepSeconds: 1.8 / wLen }; // m_wloop(): 1800/w_len ms, so one bar always lasts 1.8 s
}

/** One voice in one step (music.c: s_note). */
function voice(wert, tra, lau) {
  if ((wert & 0xc000) === 0xc000) return { noisePeriod: wert & 255, tone: false, noise: false, vol: 0 };
  let ton = ST_TON[(wert >> 2) & 63] ?? 0;
  if (wert & 0x4000) ton--;
  if (wert & 0x8000) ton++;
  ton = Math.max(0, Math.min(95, ton - tra));
  const period = (ST_WERT[ton] * (4 - (wert & 3)) + ST_WERT[ton + 1] * (wert & 3)) >> 2;
  return { period, tone: !!(wert & 0x1000), noise: !!(wert & 0x2000), vol: Math.floor((((wert >> 8) & 15) * lau) / 100) };
}

/** Logarithmic volume of the chip, 0..15. */
const LEVEL = Array.from({ length: 16 }, (_, v) => (v ? Math.pow(2, (v - 15) / 2) : 0));

/** Renders the song like the sound chip would play it: three square waves plus a noise generator. */
export function renderSong(sampleRate) {
  const raw = atob(BALLER_MUS);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const { steps, stepSeconds } = parseSong(bytes);
  const perStep = Math.round(stepSeconds * sampleRate);
  const out = new Float32Array(steps.length * perStep);
  const phase = [0, 0, 0];
  let lfsr = 1, noiseAcc = 0, noiseBit = 1, noisePeriod = 1;
  let s = 0;
  for (const st of steps) {
    if (st.noise) noisePeriod = st.noise & 31 || 1;
    for (const v of st.voices) if (v.noisePeriod) noisePeriod = v.noisePeriod & 31 || 1;
    const noiseStep = CHIP_CLOCK / (16 * noisePeriod) / sampleRate;
    const toneStep = st.voices.map((v) => (v.period ? CHIP_CLOCK / (16 * v.period) / sampleRate : 0));
    for (let i = 0; i < perStep; i++, s++) {
      noiseAcc += noiseStep;
      while (noiseAcc >= 1) { // 17-bit LFSR like the YM2149
        noiseAcc -= 1;
        noiseBit = (lfsr ^ (lfsr >> 3)) & 1;
        lfsr = (lfsr >> 1) | (noiseBit << 16);
      }
      let sample = 0;
      for (let c = 0; c < 3; c++) {
        const v = st.voices[c];
        if (!v.vol || (!v.tone && !v.noise)) continue;
        phase[c] = (phase[c] + toneStep[c]) % 1;
        // the chip mixes tone and noise with AND: a disabled source counts as "high"
        const t = v.tone ? phase[c] < 0.5 : true;
        const n = v.noise ? noiseBit === 1 : true;
        sample += (t && n ? 1 : -1) * LEVEL[v.vol];
      }
      out[s] = sample * 0.18;
    }
  }
  return out;
}
