import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Game, DEFAULT_OPTIONS } from './game/engine.js';
import { sound } from './game/sound.js';
import { SIDE_COLORS, TIME_CHOICES } from './game/render.js';
import Stage from './components/Stage.jsx';
import { MenuBar, Btn } from './components/Gem.jsx';
import {
  Notice, AimDialog, MarketDialog, KingDialog, SetupDialog, ComputerDialog, OptionsDialog,
  RulesDialog, ScoresDialog, AboutDialog, GameOverDialog,
} from './components/Dialogs.jsx';

const DEFAULT_SIDES = [
  { type: 'human', name: 'Spieler 1', strategy: 2, strength: 2, castle: 'original1' },
  { type: 'ai', name: 'Spieler 2', strategy: 2, strength: 2, castle: 'original2' },
];

function playersFrom(sides) {
  return sides.map((s, i) => ({
    name: s.type === 'ai' ? `Computer ${i + 1}` : s.name.trim() || `Spieler ${i + 1}`,
    type: s.type, strategy: s.strategy, strength: s.strength, castle: s.castle,
  }));
}

/**
 * The weather vane of the original info box (werdran()): a pole with a flag of 20 px. Without wind
 * the flag hangs down, the stronger the wind the higher it flies (angle |wind|/15, at most 90°).
 * The outer edge bends a little less than the flag (0.82), so the cloth sags. This version lets it
 * flutter: the stronger the wind, the faster and wider the cloth waves.
 */
function WindGauge({ wind, known }) {
  const [t, setT] = useState(0);
  const strength = known ? Math.min(1, Math.abs(wind) / 23) : 0;
  useEffect(() => {
    if (!known) return undefined;
    let id;
    const start = performance.now();
    const tick = (now) => { setT((now - start) / 1000); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [known]);
  const x = 30, top = 5, foot = 48;
  let flag = null;
  if (known) {
    const c = wind > 0 ? 1 : -1;
    const speed = 2 + 9 * strength; // flaps per second (in radians/2pi)
    const wave = Math.sin(t * speed);
    const wave2 = Math.sin(t * speed * 1.7 + 1.3);
    // calm: the cloth sways slowly, storm: it snaps quickly with a wider swing
    let wk = Math.min(1.57, (c * wind) / 15) + (0.04 + 0.1 * strength) * wave;
    wk = Math.max(0, Math.min(1.57, wk));
    let wl = wk * (0.82 - 0.08 * strength * wave2);
    wl = Math.max(0, Math.min(1.57, wl));
    const s1 = c * 20 * Math.sin(wk), c1 = 20 * Math.cos(wk);
    const s2 = c * 20 * Math.sin(wl), c2 = 20 * Math.cos(wl);
    // attachment: down the pole when the flag flies, across the top when it hangs limp
    const limp = wk < 0.2;
    const a = limp ? [x - 1, top] : [x + 1, top];
    const b = limp ? [x + 2, top] : [x + 1, top + 6];
    const e1 = [b[0] + s1, b[1] + c1];
    const e2 = [a[0] + s1, a[1] + c1];
    const mid = [(e1[0] + e2[0]) / 2 + s2 * (0.15 + 0.1 * strength * wave2), (e1[1] + e2[1]) / 2 + c2 * 0.15];
    flag = [a, b, e1, mid, e2].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');
  }
  return (
    <svg className="wind-gauge" viewBox="0 0 60 50" aria-hidden="true">
      <line x1={x} y1={foot} x2={x} y2={top} stroke="currentColor" strokeWidth="2" />
      {flag && <polygon points={flag} fill="var(--paper)" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />}
    </svg>
  );
}

export default function App() {
  const [, force] = useReducer((x) => x + 1, 0);
  const [sides, setSides] = useState(DEFAULT_SIDES);
  const [terrain, setTerrain] = useState('zufall');
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [muted, setMuted] = useState(false);
  const [dialog, setDialog] = useState(null);
  const gameRef = useRef(null);

  const start = useCallback((s = sides, field = null, opts = options) => {
    gameRef.current = new Game({ players: playersFrom(s), terrainData: field, terrain, options: opts }, force);
    setDialog(null);
    force();
  }, [sides, terrain, options]);

  useEffect(() => {
    start();
    // the very first game starts right away, like the original after loading
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = gameRef.current;
  const p = g?.cur;
  const humanTurn = !!g && p.type === 'human' && g.phase === 'aim';
  const advice = humanTurn ? g.advice(p) : null; // recomputed live, so a purchase updates it at once

  const setMode = (types) => {
    const next = sides.map((s, i) => ({ ...s, type: types[i] }));
    setSides(next);
    if (g) g.setControl(types);
  };

  const onPick = ({ x, y }, secondary) => {
    if (!g || dialog) return;
    if (g.building) {
      if (secondary) g.stopBuilding();
      else g.layBrick(x, y);
      return;
    }
    if (!humanTurn || secondary) return;
    const own = g.objectsOf(g.current);
    const hit = (types, r) => own.find((o) => types.includes(o.type) && g.near(o, x, y, r));
    const cannon = hit(['cannon'], 4);
    if (cannon) {
      const problem = g.shotProblem();
      setDialog(problem ? { type: 'notice', text: problem } : { type: 'aim', id: cannon.id });
      return;
    }
    if (hit(['gold', 'powder', 'balls'], 4)) { setDialog({ type: 'market' }); return; }
    if (hit(['king'], 4)) { const r = g.audience(); if (r) setDialog({ type: 'king', result: r }); }
  };

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape' && g?.building && !dialog) g.stopBuilding();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [g, dialog]);

  const mode = sides.map((s) => s.type).join('-');
  const menus = [
    { title: 'Ballerburg', items: [{ label: 'Über Ballerburg …', onSelect: () => setDialog({ type: 'about' }) }] },
    {
      title: 'Spiel',
      items: [
        { label: 'Neues Spiel …', onSelect: () => setDialog({ type: 'setup' }) },
        { label: 'Aufgeben', disabled: !humanTurn, onSelect: () => g.surrender() },
        { separator: true },
        { label: muted ? 'Ton einschalten' : 'Ton ausschalten', onSelect: () => { sound.setMuted(!muted); setMuted(!muted); } },
      ],
    },
    {
      title: 'Modus',
      items: [
        { label: 'Spieler – Spieler', checked: mode === 'human-human', onSelect: () => setMode(['human', 'human']) },
        { label: 'Spieler – Computer', checked: mode === 'human-ai', onSelect: () => setMode(['human', 'ai']) },
        { label: 'Computer – Spieler', checked: mode === 'ai-human', onSelect: () => setMode(['ai', 'human']) },
        { label: 'Computer – Computer', checked: mode === 'ai-ai', onSelect: () => setMode(['ai', 'ai']) },
        { separator: true },
        { label: 'Computer wählen …', onSelect: () => setDialog({ type: 'computer' }) },
        { label: 'Optionen …', onSelect: () => setDialog({ type: 'options' }) },
        { separator: true },
        ...TIME_CHOICES.map(([k, label]) => ({
          label: `Tageszeit: ${label}`,
          checked: options.timeOfDay === k,
          onSelect: () => { const o = { ...options, timeOfDay: k }; setOptions(o); g?.setOptions(o); },
        })),
      ],
    },
    { title: 'Regeln', items: [{ label: 'Spielregeln …', onSelect: () => setDialog({ type: 'rules' }) }] },
    { title: 'Ergebnisse', items: [{ label: 'Ergebnisliste …', onSelect: () => setDialog({ type: 'scores' }) }] },
  ];

  const close = () => setDialog(null);
  const over = g?.phase === 'over';
  // Original: the Ballerburg tune plays when a game ends
  useEffect(() => {
    if (over) sound.playMusic();
    else sound.stopMusic();
  }, [over]);
  const known = g ? g.hasVane(g.current) : false;
  const lastMsg = g?.messages[0];

  return (
    <div className="desk">
      <a className="skip-link" href="#spielfeld">Zum Spielfeld springen</a>
      <MenuBar menus={menus} />
      <main id="spielfeld" className="desk-main">
        {g && (
          <div className="screen">
            <Stage game={g} onPick={onPick} />

            <div className={`infobox ${g.current === 1 ? 'side-right' : 'side-left'}`} style={{ '--side': SIDE_COLORS[g.current].main }}>
              <div className="info-who"><b>{p.name}</b><br />{over ? 'Spiel beendet' : 'ist am Zug …'}</div>
              <div className="info-wind">
                <span className="info-label">Wind:</span>
                <span className="info-val">{known ? `${g.wind > 0 ? '▸' : g.wind < 0 ? '◂' : ''} ${String(Math.abs(g.wind)).padStart(2, '0')}` : '–'}</span>
                <WindGauge wind={g.wind} known={known} />
              </div>
              <button className="gem-btn info-done" disabled={!humanTurn || g.hasFired} onClick={() => g.pass()}>Fertig</button>
            </div>

            <div className="roundbox">Runde {g.round}</div>
            {g.building && (
              <div className="buildbox" role="status">
                <span>Anbauen: an Mauer oder Boden entlangmalen · noch {g.building.left} Steine</span>
                <button className="gem-btn" onClick={() => g.stopBuilding()}>Fertig</button>
              </div>
            )}
          </div>
        )}

        {g && <p className="turn-hint">Tipp: Halte das Gerät quer, dann wird das Spielfeld größer.</p>}
        {g && (
          <section className="statusline" aria-live="polite">
            {advice ? (
              <span className={`advice ${advice.level}`}><b>Der König:</b> {advice.text}</span>
            ) : <span className="hint">
              {humanTurn
                ? 'Geschütz antippen zum Schießen · Lagerkammer für den Markt · König für eine Audienz'
                : g.phase === 'ai' ? `${p.name} überlegt …` : g.phase === 'flying' ? 'Die Kugel fliegt …' : ''}
            </span>}
            {lastMsg && <span className={`msg ${lastMsg.tone}`}>{lastMsg.text}</span>}
          </section>
        )}
      </main>

      {dialog?.type === 'notice' && <Notice text={dialog.text} onClose={close} />}
      {dialog?.type === 'aim' && g && (
        <AimDialog
          cannon={g.obj(dialog.id)}
          game={g}
          onCancel={close}
          onFire={(a, pw) => { close(); if (!g.fire(dialog.id, a, pw)) sound.error(); }}
        />
      )}
      {dialog?.type === 'market' && g && <MarketDialog game={g} onClose={() => { close(); force(); }} />}
      {dialog?.type === 'king' && <KingDialog result={dialog.result} onClose={close} />}
      {dialog?.type === 'setup' && (
        <SetupDialog
          initial={{ sides, terrain }}
          onCancel={close}
          onStart={({ sides: s, terrain: t, field }) => { setSides(s); setTerrain(t); start(s, field); }}
        />
      )}
      {dialog?.type === 'computer' && (
        <ComputerDialog
          sides={sides}
          onCancel={close}
          onApply={(v) => { setSides(v); g?.setComputers(v); close(); }}
        />
      )}
      {dialog?.type === 'options' && (
        <OptionsDialog options={options} onCancel={close} onApply={(o) => { setOptions(o); g?.setOptions(o); close(); }} />
      )}
      {dialog?.type === 'rules' && <RulesDialog onClose={close} />}
      {dialog?.type === 'scores' && <ScoresDialog onClose={close} />}
      {dialog?.type === 'about' && <AboutDialog onClose={close} />}
      {over && !dialog && <GameOverDialog game={g} onNew={() => setDialog({ type: 'setup' })} onScores={() => setDialog({ type: 'scores' })} />}
      {!g && <Btn onClick={() => start()}>Start</Btn>}
    </div>
  );
}
