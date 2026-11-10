let ctx = null;
let muted = false;

function ac() {
  if (muted) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, dur, { type = 'square', gain = 0.08, slide = null, delay = 0 } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { freq = 800, gain = 0.4, delay = 0 } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

let music = null; // the playing original tune
let musicPcm = null;

export const sound = {
  /** Original: ende() plays BALLER.MUS when a game is over, until the player clicks. */
  async playMusic() {
    const a = ac();
    if (!a || music) return;
    const { renderSong } = await import('./music.js');
    if (!musicPcm) musicPcm = renderSong(a.sampleRate);
    if (music || muted) return;
    const buf = a.createBuffer(1, musicPcm.length, a.sampleRate);
    buf.copyToChannel(musicPcm, 0);
    const src = a.createBufferSource();
    src.buffer = buf;
    src.connect(a.destination);
    src.onended = () => { if (music === src) music = null; };
    src.start();
    music = src;
  },
  stopMusic() {
    if (!music) return;
    try { music.stop(); } catch { /* already stopped */ }
    music = null;
  },
  get muted() {
    return muted;
  },
  setMuted(m) {
    muted = m;
    if (m) this.stopMusic();
  },
  shot() {
    noise(0.3, { freq: 1200, gain: 0.35 });
    tone(150, 0.25, { slide: 50, gain: 0.12 });
  },
  boom(power = 1) {
    noise(0.5 + 0.3 * power, { freq: 380, gain: 0.5 * Math.min(1.5, power) });
    tone(90, 0.4, { type: 'triangle', slide: 30, gain: 0.2 });
  },
  click() {
    tone(720, 0.04, { gain: 0.04 });
  },
  error() {
    tone(150, 0.14, { type: 'sawtooth', gain: 0.06 });
  },
  coin() {
    tone(988, 0.06, { gain: 0.05 });
    tone(1319, 0.12, { gain: 0.05, delay: 0.06 });
  },
  fanfare() {
    const notes = [392, 523, 659, 784, 659, 784, 1047];
    const lens = [0.12, 0.12, 0.12, 0.25, 0.12, 0.12, 0.5];
    let t = 0;
    notes.forEach((n, i) => {
      tone(n, lens[i], { type: 'square', gain: 0.07, delay: t });
      tone(n / 2, lens[i], { type: 'triangle', gain: 0.06, delay: t });
      t += lens[i] * 0.95;
    });
  },
};
