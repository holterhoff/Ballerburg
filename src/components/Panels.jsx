import { SHOP } from '../game/engine.js';
import { loadScores, clearScores } from '../game/scores.js';
import { useState } from 'react';

export function Drawer({ title, onClose, children }) {
  return (
    <div className="drawer-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" aria-label={title}>
        <header className="drawer-head">
          <h2>{title}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Schließen">
            Schließen <kbd>Esc</kbd>
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Market({ game, onClose }) {
  const p = game.cur;
  const g = game;
  const cannons = g.objectsOf(p.idx, 'cannon').length;
  const mines = g.objectsOf(p.idx, 'mine').length;
  const sacks = g.objectsOf(p.idx, 'gold').length;
  const canAct = g.phase === 'aim';
  return (
    <Drawer title={`Schatzkammer von ${p.name}`} onClose={onClose}>
      <section className="ledger">
        <h3>Du hast</h3>
        <dl>
          <div><dt>Gold</dt><dd>{p.money}</dd></div>
          <div><dt>Volk</dt><dd>{p.pop}{p.popChange !== 0 && <small className={p.popChange > 0 ? 'up' : 'down'}> {p.popChange > 0 ? '+' : ''}{p.popChange}</small>}</dd></div>
          <div><dt>Kanonen</dt><dd>{cannons}</dd></div>
          <div><dt>Pulver</dt><dd>{p.powder}</dd></div>
          <div><dt>Kugeln</dt><dd>{p.balls}</dd></div>
          <div><dt>Geldsäcke</dt><dd>{sacks}</dd></div>
          <div><dt>Fördertürme</dt><dd>{mines}</dd></div>
          <div><dt>Windfahne</dt><dd>{g.hasVane(p.idx) ? 'ja' : 'nein'}</dd></div>
        </dl>
        <p className="muted small-print">
          Letzte Einnahmen: {p.lastIncome} Gold.{sacks === 0 && ' Ohne Geldsäcke halbiert sich die Steuer.'}
        </p>
      </section>

      <section className="tax">
        <h3>Steuern</h3>
        <div className="tax-row">
          <button className="btn small" disabled={!canAct || p.tax <= 0} onClick={() => g.setTax(p.tax - 5)} aria-label="Steuern senken">−5</button>
          <output className="tax-val">{p.tax}%</output>
          <button className="btn small" disabled={!canAct || p.tax >= 60} onClick={() => g.setTax(p.tax + 5)} aria-label="Steuern erhöhen">+5</button>
        </div>
        <p className="muted small-print">Hohe Steuern bringen mehr Gold, aber das Volk wandert ab. Unter 12% wächst es wieder. Stirbt das Volk aus, ist die Fehde verloren.</p>
      </section>

      <section className="shop">
        <h3>Markt</h3>
        <ul>
          {SHOP.map((it) => {
            const price = g.prices[it.key];
            const afford = p.money >= price;
            return (
              <li key={it.key}>
                <div>
                  <strong>{it.label}</strong>
                  <small className="muted">{it.hint}</small>
                </div>
                <button className="btn buy" disabled={!canAct || !afford} onClick={() => { g.buy(it.key); if (['stones', 'cannon', 'vane', 'mine'].includes(it.key)) onClose(); }}>
                  {price} <span className="coin" aria-hidden="true" />
                  <span className="sr-only"> Gold, kaufen</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="muted small-print">Die Preise schwanken jede Runde leicht. Steine, Kanonen, Windfahnen und Fördertürme setzt du danach per Klick in deine Burg.</p>
      </section>
    </Drawer>
  );
}

export function Rules({ onClose }) {
  return (
    <Drawer title="Regeln" onClose={onClose}>
      <div className="prose">
        <p><strong>Ziel:</strong> Schalte den gegnerischen König aus. Du gewinnst auch, wenn der Gegner kapituliert, weil er keine Kanone, keine Kugeln oder kein Pulver mehr hat und nichts nachkaufen kann, oder wenn sein Volk die Burg verlassen hat.</p>
        <h3>Dein Zug</h3>
        <ol>
          <li>Wähle eine Kanone, indem du sie anklickst oder <kbd>Tab</kbd> drückst.</li>
          <li>Stelle <em>Winkel</em> und <em>Pulver</em> ein. Mehr Pulver heißt mehr Wucht, kostet aber auch mehr Vorrat. 12 Pulver bei 45° ist ein guter erster Versuch. Schon ein Grad Winkel verschiebt den Einschlag deutlich.</li>
          <li>Vorher bei Bedarf in der Schatzkammer einkaufen und bauen.</li>
          <li>Feuer. Pro Zug gibt es genau einen Schuss, danach ist der Gegner dran. Wer nicht schießen will, beendet den Zug ohne Schuss.</li>
        </ol>
        <h3>Wind</h3>
        <p>Der Wind lenkt jede Kugel ab und ändert sich jeden Zug. Die genaue Stärke siehst du nur mit einer intakten Windfahne, sonst nur grob die Richtung.</p>
        <h3>Burg und Vorräte</h3>
        <ul>
          <li><strong>Pulverlager</strong>: Ein Treffer lässt es explodieren, und der ganze Pulvervorrat ist weg.</li>
          <li><strong>Kugellager</strong>: Ein Treffer vernichtet alle Kugeln.</li>
          <li><strong>Geldsäcke</strong>: Jeder getroffene Sack kostet einen Teil deines Goldes.</li>
          <li><strong>Fördertürme</strong> bringen jede Runde 40 Gold zusätzlich.</li>
          <li>Verliert ein Teil seinen Halt, stürzt es ab. Ein tiefer Sturz zerstört es, auch den König.</li>
        </ul>
        <h3>Tastatur</h3>
        <p><kbd>↑</kbd><kbd>↓</kbd> Winkel (mit <kbd>Shift</kbd> ±10), <kbd>←</kbd><kbd>→</kbd> Pulver, <kbd>Leertaste</kbd> Feuer, <kbd>Tab</kbd> nächste Kanone, <kbd>M</kbd> Schatzkammer, <kbd>E</kbd> Zug ohne Schuss beenden, <kbd>Esc</kbd> Platzieren abbrechen.</p>
      </div>
    </Drawer>
  );
}

export function HonourBoard({ onClose }) {
  const [scores, setScores] = useState(loadScores);
  const rows = Object.entries(scores).sort((a, b) => b[1].w - a[1].w || a[1].l - b[1].l);
  return (
    <Drawer title="Ehrentafel" onClose={onClose}>
      {rows.length === 0 ? (
        <div className="empty">
          <p>Noch keine Fehde ausgetragen.</p>
          <p className="muted">Siege und Niederlagen werden hier in diesem Browser festgehalten.</p>
        </div>
      ) : (
        <>
          <table className="scores">
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Siege</th><th scope="col">Niederlagen</th></tr>
            </thead>
            <tbody>
              {rows.map(([n, s]) => (
                <tr key={n}><td>{n}</td><td>{s.w}</td><td>{s.l}</td></tr>
              ))}
            </tbody>
          </table>
          <button className="btn ghost small" onClick={() => { clearScores(); setScores({}); }}>Tafel löschen</button>
        </>
      )}
    </Drawer>
  );
}
