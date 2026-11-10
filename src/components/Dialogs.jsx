import { useEffect, useRef, useState } from 'react';
import { Dialog, Btn, Spinner } from './Gem.jsx';
import Cannon3D from './Cannon3D.jsx';
import { MARKET, STRATEGIES } from '../game/engine.js';
import { ANGLE_MAX, POWDER_MIN, POWDER_MAX, H } from '../game/constants.js';
import { CASTLES, buildCastle, chamberCapacity } from '../game/castles.js';
import { generateTerrain } from '../game/terrain.js';
import { drawCastlePreview, drawTerrainPreview, SIDE_COLORS, TIME_CHOICES } from '../game/render.js';
import { loadScores, clearScores } from '../game/scores.js';

export function Notice({ text, button = 'Abbruch', onClose }) {
  return (
    <Dialog title="" onClose={onClose} className="narrow">
      <p className="gem-text">{text}</p>
      <div className="gem-actions"><Btn def data-autofocus onClick={onClose}>{button}</Btn></div>
    </Dialog>
  );
}

/** Original: sch_obj() in cannoneer.c — angle 0..180 in steps of 1 and 10, powder 5..20 in steps of 1 and 3. */
export function AimDialog({ cannon, game, onFire, onCancel }) {
  const p = game.cur;
  const maxPowder = Math.max(POWDER_MIN, Math.min(POWDER_MAX, p.powder));
  const [angle, setAngle] = useState(cannon.aim.angle);
  const [powder, setPowder] = useState(Math.min(cannon.aim.powder, maxPowder));
  const ref = useRef(null);
  const dir = cannon.owner === 0 ? 1 : -1;
  const [no3d, setNo3d] = useState(false);

  // 2D fallback drawing, used only when WebGL is not available
  useEffect(() => {
    if (!ref.current) return;
    const c = ref.current.getContext('2d');
    const w = 240, h = 110;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#000';
    for (let x = 0; x < w; x += 2) c.fillRect(x, h - 12 + ((x / 2) % 2), 1, 1);
    c.fillRect(0, h - 10, w, 10);
    const cx = w / 2 + dir * 10, cy = h - 26;
    const a = (angle * Math.PI) / 180;
    c.save();
    c.translate(cx, cy);
    c.scale(dir, 1);
    c.rotate(-a);
    c.fillRect(-8, -9, 62, 18);
    c.fillStyle = '#fff';
    c.fillRect(48, -5, 6, 10);
    c.restore();
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(cx, cy + 4, 13, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(cx, cy + 4, 4, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#000';
    c.setLineDash([3, 3]);
    c.beginPath();
    c.arc(cx, cy, 44, -Math.PI / 2 - (Math.PI / 2) * dir, dir > 0 ? -a : -Math.PI + a, dir < 0);
    c.stroke();
    c.setLineDash([]);
  }, [angle, dir, no3d]);

  useEffect(() => {
    const key = (e) => {
      const big = e.shiftKey;
      if (e.key === 'ArrowUp') { setAngle((v) => Math.min(ANGLE_MAX, v + (big ? 10 : 1))); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { setAngle((v) => Math.max(0, v - (big ? 10 : 1))); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { setPowder((v) => Math.min(maxPowder, v + (big ? 3 : 1))); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { setPowder((v) => Math.max(POWDER_MIN, v - (big ? 3 : 1))); e.preventDefault(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [maxPowder]);

  return (
    <Dialog title="Geschütz ausrichten" onClose={onCancel} className="aim">
      <div className="aim-grid">
        <div className="aim-controls">
          <Spinner label="Winkel" value={angle} onChange={setAngle} min={0} max={ANGLE_MAX} coarse={10} unit="°" />
          <Spinner label="Pulver" value={powder} onChange={setPowder} min={POWDER_MIN} max={maxPowder} coarse={3} />
          <p className="gem-small">Über 90° schießt das Geschütz nach hinten. Vorrat: {p.powder} Pulver, {p.balls} Kugeln.</p>
        </div>
        {no3d ? (
          <canvas ref={ref} width={240} height={110} className="aim-preview" aria-label={`Geschütz bei ${angle} Grad`} role="img" />
        ) : (
          <Cannon3D angle={angle} powder={powder} side={cannon.owner} onUnavailable={() => setNo3d(true)} />
        )}
      </div>
      <div className="gem-actions">
        <Btn onClick={onCancel}>Abbruch</Btn>
        <Btn def data-autofocus onClick={() => onFire(angle, powder)}>Feuer</Btn>
      </div>
    </Dialog>
  );
}

/** Original: markt() in market.c — your stores, taxes in steps of 2, and the market. */
export function MarketDialog({ game, onClose }) {
  const p = game.cur;
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const row = (label, value) => (
    <div className="ledger-row"><span>{label}</span><b>{value}</b></div>
  );
  return (
    <Dialog title="" onClose={onClose} className="market">
      <section className="gem-box">
        <h3>Du hast:</h3>
        <div className="ledger">
          {row('Geld', p.money)}
          {row('Fördertürme', game.objectsOf(p.idx, 'mine').length)}
          {row('Geschütze', game.objectsOf(p.idx, 'cannon').length)}
          {row('Windfahne', game.hasVane(p.idx) ? 1 : 0)}
          {row('Pulver', p.powder)}
          {row('Kugeln', p.balls)}
          {row('Volk', p.pop)}
          <div className="ledger-row">
            <span>Steuern in %</span>
            <span className="tax">
              <button className="gem-arrow" onClick={() => { game.setTax(p.tax - 2); refresh(); }} aria-label="Steuern senken">◂</button>
              <b>{p.tax}</b>
              <button className="gem-arrow" onClick={() => { game.setTax(p.tax + 2); refresh(); }} aria-label="Steuern erhöhen">▸</button>
            </span>
          </div>
        </div>
      </section>
      <section className="gem-box">
        <h3>Markt:</h3>
        <div className="ledger">
          {MARKET.map((m) => (
            <button
              key={m.key}
              className="ledger-row buy"
              disabled={!game.canBuy(m.key)}
              onClick={() => {
                if (game.buy(m.key)) {
                  if (m.key === 'stones') onClose();
                  else refresh();
                }
              }}
            >
              <span>{m.label}</span><b>{game.priceOf(m.key) === 0 ? 'frei' : game.priceOf(m.key)}</b>
            </button>
          ))}
        </div>
      </section>
      <p className="gem-small">Grau = zu teuer, kein Platz, Lager voll oder schon vorhanden. Deine Kammern fassen {p.caps.money} Gold, {p.caps.powder} Pulver und {p.caps.balls} Kugeln.</p>
      <div className="gem-actions"><Btn def data-autofocus onClick={onClose}>Fertig</Btn></div>
    </Dialog>
  );
}

export function KingDialog({ result, onClose }) {
  return (
    <Dialog title="" onClose={onClose} className="narrow">
      {result.refused ? <p className="gem-text">{result.text}</p> : result.greeting ? (
        <>
          <p className="gem-text"><b>Ein Grußwort des Königs</b></p>
          <p className="gem-text king-quote">„{result.text}“</p>
          <p className="gem-small">Ballerburg: erfunden 1987 von Eckhard Kruse.</p>
        </>
      ) : (
        <>
          <p className="gem-text">Der König spricht:</p>
          <p className="gem-text king-quote">„{result.text}“</p>
        </>
      )}
      <div className="gem-actions"><Btn def data-autofocus onClick={onClose}>{result.refused ? 'Schade' : 'Sehr wohl, Majestät'}</Btn></div>
    </Dialog>
  );
}

function capsOf(key) {
  const c = CASTLES[key];
  return `${chamberCapacity('gold', c.gold)} Gold · ${chamberCapacity('powder', c.powder)} Pulver · ${chamberCapacity('balls', c.balls)} Kugeln`;
}

function CastlePicker({ side, value, onChange }) {
  const keys = Object.keys(CASTLES);
  const i = keys.indexOf(value);
  const ref = useRef(null);
  useEffect(() => {
    drawCastlePreview(ref.current, buildCastle(value, side, H - 10), side, CASTLES[value].start);
  }, [value, side]);
  return (
    <div className="castle-picker">
      <canvas ref={ref} className="castle-preview" role="img" aria-label={`Vorschau ${CASTLES[value].name}`} />
      <div className="picker-row">
        <button className="gem-arrow" type="button" onClick={() => onChange(keys[(i + keys.length - 1) % keys.length])} aria-label="vorherige Burg">◂</button>
        <b>{CASTLES[value].name}</b>
        <button className="gem-arrow" type="button" onClick={() => onChange(keys[(i + 1) % keys.length])} aria-label="nächste Burg">▸</button>
      </div>
      <p className="gem-small">{CASTLES[value].desc}</p>
      <p className="gem-small">Lager: {capsOf(value)}</p>
    </div>
  );
}

function StrategyPicker({ value, onChange }) {
  return (
    <div className="strategy">
      <ul className="strategy-list" role="listbox" aria-label="Computerstrategie">
        {STRATEGIES.map((s, k) => (
          <li key={s.name}>
            <button type="button" role="option" aria-selected={value.strategy === k} className={value.strategy === k ? 'on' : ''} onClick={() => onChange({ ...value, strategy: k })}>
              {s.name}
            </button>
          </li>
        ))}
      </ul>
      <div className="strength" role="radiogroup" aria-label="Stärke">
        {[1, 2, 3, 4].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value.strength === n} className={value.strength === n ? 'on' : ''} onClick={() => onChange({ ...value, strength: n })}>{n}</button>
        ))}
      </div>
      <p className="gem-small">{STRATEGIES[value.strategy].desc} Stärke 4 trifft am genauesten.</p>
    </div>
  );
}

/** "Neues Spiel": names, castles, battlefield. */
export function SetupDialog({ initial, onStart, onCancel }) {
  const [sides, setSides] = useState(initial.sides);
  const terrain = 'zufall';
  const [field, setField] = useState(() => generateTerrain(initial.terrain, initial.sides.map((s) => CASTLES[s.castle].width)));
  const ref = useRef(null);
  const reroll = (kind = terrain, s = sides) => setField(generateTerrain(kind, s.map((x) => CASTLES[x.castle].width)));
  useEffect(() => drawTerrainPreview(ref.current, field.heights), [field]);
  const set = (i, patch) => {
    const next = sides.map((s, j) => (j === i ? { ...s, ...patch } : s));
    setSides(next);
    if (patch.castle) reroll(terrain, next);
  };
  return (
    <Dialog title="Neues Spiel: Wählen Sie die Burgen!" onClose={onCancel} className="setup">
      <div className="setup-cols">
        {sides.map((s, i) => (
          <fieldset key={i} className="gem-box side" style={{ '--side': SIDE_COLORS[i].main }}>
            <legend>{i === 0 ? 'Links' : 'Rechts'}</legend>
            <div className="mode-row" role="radiogroup" aria-label="Spieler">
              {[['human', 'Spieler'], ['ai', 'Computer']].map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={s.type === k} className={s.type === k ? 'on' : ''} onClick={() => set(i, { type: k })}>{label}</button>
              ))}
            </div>
            {s.type === 'human' ? (
              <label className="gem-field">
                <span>Name:</span>
                <input value={s.name} maxLength={20} onChange={(e) => set(i, { name: e.target.value })} />
              </label>
            ) : (
              <StrategyPicker value={s} onChange={(v) => set(i, v)} />
            )}
            <CastlePicker side={i} value={s.castle} onChange={(c) => set(i, { castle: c })} />
          </fieldset>
        ))}
      </div>
      <fieldset className="gem-box">
        <legend>Schlachtfeld</legend>
        <div className="terrain-row">
          <span>Der Berg wird zufällig gewürfelt.</span>
          <Btn type="button" onClick={() => reroll()}>Neu würfeln</Btn>
        </div>
        <canvas ref={ref} className="terrain-preview" role="img" aria-label="Vorschau des Schlachtfelds" />
      </fieldset>
      <div className="gem-actions">
        <Btn onClick={onCancel}>Abbruch</Btn>
        <Btn def data-autofocus onClick={() => onStart({ sides, terrain, field })}>OK</Btn>
      </div>
    </Dialog>
  );
}

/** "Modus → Computer wählen": strategy and strength for both computer players. */
export function ComputerDialog({ sides, onApply, onCancel }) {
  const [v, setV] = useState(sides);
  return (
    <Dialog title="Computer wählen" onClose={onCancel} className="setup">
      <div className="setup-cols">
        {v.map((s, i) => (
          <fieldset key={i} className="gem-box">
            <legend>Computer {i + 1} ({i === 0 ? 'links' : 'rechts'})</legend>
            <StrategyPicker value={s} onChange={(n) => setV(v.map((x, j) => (j === i ? { ...x, ...n } : x)))} />
          </fieldset>
        ))}
      </div>
      <div className="gem-actions">
        <Btn onClick={onCancel}>Abbruch</Btn>
        <Btn def onClick={() => onApply(v)}>OK</Btn>
      </div>
    </Dialog>
  );
}

export function OptionsDialog({ options, onApply, onCancel }) {
  const [o, setO] = useState(options);
  const ext = (k, val) => setO({ ...o, extensions: { ...o.extensions, [k]: val } });
  return (
    <Dialog title="Optionen" onClose={onCancel} className="narrow">
      <label className="gem-check-row"><input type="checkbox" checked={o.autoCapitulate} onChange={(e) => setO({ ...o, autoCapitulate: e.target.checked })} /> König kapituliert in aussichtsloser Lage</label>
      <label className="gem-check-row"><input type="checkbox" checked={o.allowBuilding} onChange={(e) => setO({ ...o, allowBuilding: e.target.checked })} /> Anbauen erlaubt</label>
      <label className="gem-field">
        <span>Rundenlimit:</span>
        <select value={o.maxRounds} onChange={(e) => setO({ ...o, maxRounds: Number(e.target.value) })}>
          {[0, 10, 20, 30, 50, 100].map((n) => <option key={n} value={n}>{n ? `${n} Runden` : 'keins'}</option>)}
        </select>
      </label>
      <label className="gem-field">
        <span>Tageszeit:</span>
        <select value={o.timeOfDay} onChange={(e) => setO({ ...o, timeOfDay: e.target.value })}>
          {TIME_CHOICES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
      <fieldset className="gem-box">
        <legend>Erweiterungen (nicht im Original)</legend>
        <label className="gem-check-row"><input type="checkbox" checked={o.extensions.landslides} onChange={(e) => ext('landslides', e.target.checked)} /> Unterhöhlte Hänge rutschen nach</label>
        <label className="gem-check-row"><input type="checkbox" checked={o.extensions.falling} onChange={(e) => ext('falling', e.target.checked)} /> Burgteile ohne Halt stürzen ab</label>
      </fieldset>
      <div className="gem-actions">
        <Btn onClick={onCancel}>Abbruch</Btn>
        <Btn def onClick={() => onApply(o)}>OK</Btn>
      </div>
    </Dialog>
  );
}

const RULES = [
  ['Worum es geht', [
    'Zwei Burgen stehen sich gegenüber, dazwischen ein Berg. Jede Seite versucht, die Burg des Gegners zu zerstören.',
    'Verloren hat, wessen König getroffen wird, wessen Volk ausstirbt oder wessen König in aussichtsloser Lage kapituliert: ohne Geschütz, mit schrumpfendem Volk, fast ohne Geld und ohne Förderturm.',
    'Jede Seite kann von einem Menschen oder vom Computer gespielt werden. Die sieben Computergegner verfolgen verschiedene Strategien, ihre Treffsicherheit stellst du mit der Stärke 1 bis 4 ein.',
  ]],
  ['Ein Zug', [
    'Klicke auf eine deiner Lagerkammern (Geld, Pulver, Kugeln), um die Schatzkammer zu öffnen. Dort siehst du deinen Besitz, stellst die Steuern ein und kaufst auf dem Markt.',
    'Hohe Steuern bringen mehr Geld, aber das Volk wandert ab. Bei niedrigen Steuern wächst es.',
    'Klicke auf ein Geschütz, stelle Winkel und Pulver ein und feuere. Mit dem Schuss endet dein Zug. Wer nicht schießen will, klickt auf „Fertig“.',
    'Klicke auf deinen König, um ihn um Rat zu fragen. Er empfängt dich höchstens einmal pro Zug.',
  ]],
  ['Markt und Burg', [
    'Anbauen: 20 Steine, die du per Klick an Mauern oder Boden setzt. Ein Rechtsklick oder Esc beendet das Bauen, übrige Steine verfallen.',
    'Fördertürme bringen jede Runde zusätzliches Geld, bis zu fünf passen vor die Burg.',
    'Ohne Windfahne siehst du die Windstärke nicht. Der Wind ändert sich jeden Zug und lenkt die Kugeln ab.',
    'Treffer in Lagerkammern kosten bis zu 200 Gold, das ganze Pulver oder zwei Kugeln. Jeder Einschlag in einer Burg kann Einwohner kosten.',
  ]],
];

export function RulesDialog({ onClose }) {
  const [page, setPage] = useState(0);
  const [title, paras] = RULES[page];
  return (
    <Dialog title={`Spielregeln (Seite ${page + 1})`} onClose={onClose} className="rules">
      <h3>{title}</h3>
      {paras.map((t) => <p key={t} className="gem-text">{t}</p>)}
      <div className="gem-actions">
        {RULES.map((_, k) => k !== page && <Btn key={k} onClick={() => setPage(k)}>Seite {k + 1}</Btn>)}
        <Btn def data-autofocus onClick={onClose}>Fertig</Btn>
      </div>
    </Dialog>
  );
}

export function ScoresDialog({ onClose }) {
  const [scores, setScores] = useState(loadScores);
  const rows = Object.entries(scores).sort((a, b) => b[1].w - a[1].w || a[1].l - b[1].l);
  return (
    <Dialog title="Ergebnisse" onClose={onClose} className="narrow">
      {rows.length === 0 ? <p className="gem-text">Noch keine Partie beendet. Siege und Niederlagen werden in diesem Browser gespeichert.</p> : (
        <table className="gem-table">
          <thead><tr><th scope="col">Name</th><th scope="col">Siege</th><th scope="col">Niederlagen</th></tr></thead>
          <tbody>{rows.map(([n, s]) => <tr key={n}><td>{n}</td><td>{s.w}</td><td>{s.l}</td></tr>)}</tbody>
        </table>
      )}
      <div className="gem-actions">
        {rows.length > 0 && <Btn onClick={() => { clearScores(); setScores({}); }}>Löschen</Btn>}
        <Btn def data-autofocus onClick={onClose}>Fertig</Btn>
      </div>
    </Dialog>
  );
}

export function AboutDialog({ onClose }) {
  return (
    <Dialog title="B U R G F E H D E" onClose={onClose} className="narrow about">
      <p className="gem-text">Ein Burgen-Artilleriespiel für den Browser.</p>
      <p className="gem-text">Die Spiellogik ist eine Portierung von <b>Ballerburg</b>, © 1987, 1989 Eckhard Kruse, und der SDL-Fassung © 2010, 2015 Thomas Huth. Grafik, Burgen und Texte von Burgfehde sind eigene Arbeiten.</p>
      <p className="gem-text">Dieses Programm ist freie Software unter der GNU General Public License, Version 3 oder später. Es kommt ohne jede Gewährleistung. Den Quellcode und den Lizenztext findest du im Projektarchiv (Datei LICENSE).</p>
      <p className="gem-small"><a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noreferrer">GNU GPL v3 lesen</a></p>
      <div className="gem-actions"><Btn def data-autofocus onClick={onClose}>OK</Btn></div>
    </Dialog>
  );
}

export function GameOverDialog({ game, onNew, onScores }) {
  const w = game.players[game.winner];
  return (
    <Dialog title="" className="narrow gameover">
      <p className="gem-text big">!! {w.name} hat gewonnen !!</p>
      <p className="gem-text">( {game.endReason} )</p>
      <p className="gem-small">Nach {game.round} Runden. Treffer: {game.players.map((p) => `${p.name} ${p.hits}/${p.shots}`).join(', ')}.</p>
      <div className="gem-actions">
        <Btn onClick={onScores}>Ergebnisse</Btn>
        <Btn def data-autofocus onClick={onNew}>Neues Spiel</Btn>
      </div>
    </Dialog>
  );
}
