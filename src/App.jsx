import { useCallback, useEffect, useReducer, useState } from 'react';
import { Game } from './game/engine.js';
import { MAX_POWDER } from './game/constants.js';
import { sound } from './game/sound.js';
import { SIDE_COLORS } from './game/render.js';
import { CASTLES } from './game/castles.js';
import Stage from './components/Stage.jsx';
import Setup from './components/Setup.jsx';
import { Market, Rules, HonourBoard } from './components/Panels.jsx';

const PLACE_LABEL = { stones: 'Steine setzen', cannon: 'Kanone aufstellen', vane: 'Windfahne aufstellen', mine: 'Förderturm aufstellen' };

function Wind({ game }) {
  const known = game.hasVane(game.current);
  const w = game.wind;
  const dir = w === 0 ? '·' : w > 0 ? '→' : '←';
  const rough = Math.abs(w) < 3 ? 'kaum Wind' : Math.abs(w) < 8 ? 'mäßiger Wind' : 'starker Wind';
  return (
    <div className="wind" title={known ? 'Windfahne intakt' : 'Ohne Windfahne nur eine grobe Schätzung'}>
      <span className="label">Wind</span>
      {known ? (
        <span className="wind-val">
          <span className="arrow" aria-hidden="true">{dir}</span> {Math.abs(w)}
        </span>
      ) : (
        <span className="wind-val unknown">{w === 0 ? 'still' : `${dir} ${rough}`}</span>
      )}
    </div>
  );
}

function Stepper({ label, value, min, max, steps, onChange, unit = '' }) {
  return (
    <div className="stepper">
      <span className="label">{label}</span>
      <div className="stepper-row">
        {steps.map((s) => (
          <button key={`m${s}`} className="btn small" onClick={() => onChange(Math.max(min, value - s))} disabled={value <= min} aria-label={`${label} minus ${s}`}>
            −{s}
          </button>
        ))}
        <output className="stepper-val">{value}{unit}</output>
        {steps.slice().reverse().map((s) => (
          <button key={`p${s}`} className="btn small" onClick={() => onChange(Math.min(max, value + s))} disabled={value >= max} aria-label={`${label} plus ${s}`}>
            +{s}
          </button>
        ))}
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </div>
  );
}

function PlayerCard({ game, idx }) {
  const p = game.players[idx];
  const active = game.current === idx && game.phase !== 'over';
  const cannons = game.objectsOf(idx, 'cannon').length;
  return (
    <article className={`player-card ${active ? 'active' : ''}`} style={{ '--side': SIDE_COLORS[idx].main }}>
      <header>
        <span className="side-dot" aria-hidden="true" />
        <h3>{p.name}</h3>
        <small className="muted">{p.type === 'ai' ? 'Computer' : 'Mensch'} · {CASTLES[p.castle].name}</small>
      </header>
      <dl>
        <div><dt>Gold</dt><dd>{p.money}</dd></div>
        <div><dt>Volk</dt><dd>{p.pop}</dd></div>
        <div><dt>Kanonen</dt><dd>{cannons}</dd></div>
        <div><dt>Pulver</dt><dd>{p.powder}</dd></div>
        <div><dt>Kugeln</dt><dd>{p.balls}</dd></div>
        <div><dt>Treffer</dt><dd>{p.hits}/{p.shots}</dd></div>
      </dl>
    </article>
  );
}

export default function App() {
  const [, force] = useReducer((x) => x + 1, 0);
  const [game, setGame] = useState(null);
  const [panel, setPanel] = useState(null);
  const [setupOpen, setSetupOpen] = useState(true);
  const [muted, setMuted] = useState(false);

  const startGame = (cfg) => {
    setGame(new Game(cfg, force));
    setSetupOpen(false);
    setPanel(null);
  };

  const g = game;
  const p = g?.cur;
  const humanTurn = !!g && p.type === 'human' && g.phase === 'aim';
  const sel = g ? g.obj(g.selected) : null;
  const ownCannons = g ? g.objectsOf(g.current, 'cannon') : [];

  const setAim = useCallback(
    (patch) => {
      if (!sel) return;
      sel.aim = { ...sel.aim, ...patch };
      force();
    },
    [sel],
  );

  const fire = useCallback(() => {
    if (!humanTurn || !sel) return;
    if (!g.fire(sel.id, sel.aim.angle, Math.min(sel.aim.powder, p.powder))) sound.error();
  }, [humanTurn, sel, g, p]);

  const cycleCannon = useCallback(() => {
    if (!ownCannons.length) return;
    const i = ownCannons.findIndex((c) => c.id === g.selected);
    g.selected = ownCannons[(i + 1) % ownCannons.length].id;
    sound.click();
    force();
  }, [ownCannons, g]);

  const onPick = ({ x, y }, secondary) => {
    if (!g) return;
    if (g.placing) {
      if (secondary) g.cancelPlacing();
      else g.place(x, y);
      return;
    }
    if (!humanTurn) return;
    const hit = ownCannons.find((c) => x >= c.x - 3 && x < c.x + c.w + 3 && y >= c.y - 6 && y < c.y + c.h + 3);
    if (hit) {
      g.selected = hit.id;
      sound.click();
      force();
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input:not([type="range"]), textarea, select')) return;
      if (e.key === 'Escape') {
        if (panel) setPanel(null);
        else if (g?.placing) g.cancelPlacing();
        return;
      }
      if (!g || setupOpen || panel || !humanTurn) return;
      const big = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowUp' && sel) { setAim({ angle: Math.min(90, sel.aim.angle + big) }); e.preventDefault(); }
      else if (e.key === 'ArrowDown' && sel) { setAim({ angle: Math.max(0, sel.aim.angle - big) }); e.preventDefault(); }
      else if (e.key === 'ArrowRight' && sel) { setAim({ powder: Math.min(MAX_POWDER, sel.aim.powder + big) }); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' && sel) { setAim({ powder: Math.max(1, sel.aim.powder - big) }); e.preventDefault(); }
      else if (e.key === ' ' || e.key === 'Enter') { if (!e.target.closest('button')) { fire(); e.preventDefault(); } }
      else if (e.key === 'Tab') { cycleCannon(); e.preventDefault(); }
      else if (e.key === 'm' || e.key === 'M') setPanel('market');
      else if (e.key === 'e' || e.key === 'E') g.endTurn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [g, setupOpen, panel, humanTurn, sel, setAim, fire, cycleCannon]);

  const toggleMute = () => {
    sound.setMuted(!muted);
    setMuted(!muted);
  };

  const canFire = humanTurn && sel && g.canFire(sel);
  const powderMax = Math.max(1, Math.min(MAX_POWDER, p?.powder ?? 1));
  const owedList = p ? [['stones', p.stones], ['cannon', p.owed.cannon], ['vane', p.owed.vane], ['mine', p.owed.mine]].filter(([, n]) => n > 0) : [];
  const winner = g?.phase === 'over' ? g.players[g.winner] : null;

  return (
    <div className="app">
      <a className="skip-link" href="#spielfeld">Zum Spielfeld springen</a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <h1>Burgfehde</h1>
        </div>
        <nav aria-label="Spielmenü">
          <button className={`btn ghost ${setupOpen ? 'current' : ''}`} onClick={() => setSetupOpen(true)}>Neue Fehde</button>
          <button className={`btn ghost ${panel === 'rules' ? 'current' : ''}`} onClick={() => setPanel('rules')}>Regeln</button>
          <button className={`btn ghost ${panel === 'scores' ? 'current' : ''}`} onClick={() => setPanel('scores')}>Ehrentafel</button>
          <button className="btn ghost" onClick={toggleMute} aria-pressed={muted}>{muted ? 'Ton aus' : 'Ton an'}</button>
        </nav>
      </header>

      <main id="spielfeld">
        {setupOpen || !g ? (
          <Setup onStart={startGame} onCancel={() => setSetupOpen(false)} canCancel={!!g && g.phase !== 'over'} />
        ) : (
          <>
            <section className="stage-wrap" aria-label="Schlachtfeld">
              <div className="stage-frame">
                <Stage game={g} onPick={onPick} />

                <div className="hud hud-left" style={{ '--side': SIDE_COLORS[g.current].main }}>
                  <div className="turn">
                    <span className="side-dot" aria-hidden="true" />
                    <span><strong>{p.name}</strong> {g.phase === 'over' ? '' : 'ist am Zug'}</span>
                  </div>
                  <Wind game={g} />
                </div>
                <div className="hud hud-right">
                  <span className="label">Runde</span> <strong className="num">{g.round}</strong>
                </div>

                {g.placing && (
                  <div className="placing-banner" role="status">
                    {PLACE_LABEL[g.placing]}
                    {g.placing === 'stones' && <> · noch {p.stones}</>}: in deine Burgzone klicken
                    <button className="btn small" onClick={() => g.cancelPlacing()}>Später <kbd>Esc</kbd></button>
                  </div>
                )}
                {g.phase === 'ai' && <div className="thinking" role="status">{p.name} überlegt …</div>}

                {winner && (
                  <div className="victory" role="dialog" aria-labelledby="victory-title">
                    <div className="victory-card" style={{ '--side': SIDE_COLORS[g.winner].main }}>
                      <p className="label">Nach {g.round} Runden</p>
                      <h2 id="victory-title">{winner.name} gewinnt die Fehde</h2>
                      <p>{g.endReason}</p>
                      <blockquote>„{g.verdict(winner)}“<footer>Der König von {winner.name}</footer></blockquote>
                      <div className="victory-actions">
                        <button className="btn primary" onClick={() => setSetupOpen(true)}>Neue Fehde</button>
                        <button className="btn ghost" onClick={() => setPanel('scores')}>Ehrentafel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="deck" aria-label="Befehle">
              <div className="deck-aim">
                {humanTurn ? (
                  sel && sel.alive ? (
                    <>
                      <div className="cannon-tabs" role="tablist" aria-label="Kanone wählen">
                        {ownCannons.map((c, i) => (
                          <button key={c.id} role="tab" aria-selected={c.id === g.selected} className={`tab ${c.id === g.selected ? 'on' : ''}`} onClick={() => { g.selected = c.id; force(); }}>
                            Kanone {i + 1}
                          </button>
                        ))}
                      </div>
                      <Stepper label="Winkel" value={sel.aim.angle} min={0} max={90} steps={[10, 1]} unit="°" onChange={(v) => setAim({ angle: v })} />
                      <Stepper label="Pulver" value={Math.min(sel.aim.powder, powderMax)} min={1} max={powderMax} steps={[5, 1]} onChange={(v) => setAim({ powder: v })} />
                      <button className="btn fire" onClick={fire} disabled={!canFire}>
                        {g.hasFired ? 'Schuss ist raus' : p.balls === 0 ? 'Keine Kugeln' : p.powder < 1 ? 'Kein Pulver' : 'Feuer'}
                      </button>
                    </>
                  ) : (
                    <div className="empty">
                      <p>Keine Kanone in deiner Burg.</p>
                      <p className="muted">Kaufe in der Schatzkammer eine neue und stelle sie auf, sonst kapituliert dein König nächste Runde.</p>
                    </div>
                  )
                ) : (
                  <div className="empty">
                    <p>{g.phase === 'over' ? 'Die Fehde ist entschieden.' : g.phase === 'flying' ? 'Die Kugel fliegt …' : `${p.name} ist am Zug.`}</p>
                  </div>
                )}
              </div>

              <div className="deck-actions">
                <button className="btn" onClick={() => setPanel('market')} disabled={!humanTurn}>Schatzkammer <kbd>M</kbd></button>
                {humanTurn && owedList.map(([k, n]) => (
                  <button key={k} className={`btn ${g.placing === k ? 'current' : ''}`} onClick={() => g.startPlacing(k)}>
                    {PLACE_LABEL[k]} ({n})
                  </button>
                ))}
                <button className="btn" onClick={() => g.endTurn()} disabled={!humanTurn || g.hasFired}>
                  Ohne Schuss beenden <kbd>E</kbd>
                </button>
                <p className="muted small-print">Ein Schuss pro Zug: Erst einkaufen und bauen, dann feuern. Der Schuss beendet den Zug.</p>
                <button className="btn text danger" onClick={() => g.surrender()} disabled={!humanTurn}>Kapitulieren</button>
              </div>

              <div className="deck-players">
                <PlayerCard game={g} idx={0} />
                <PlayerCard game={g} idx={1} />
              </div>

              <section className="chronicle" aria-label="Chronik" aria-live="polite">
                <h3 className="label">Chronik</h3>
                <ol>
                  {g.messages.map((m) => (
                    <li key={m.id} className={m.tone}>
                      <span className="round-tag">R{m.round}</span> {m.text}
                    </li>
                  ))}
                </ol>
              </section>
            </section>
          </>
        )}
      </main>

      <footer className="foot">
        <p>Burgfehde ist ein eigenständiges Artillerie-Duell im Geist der Burgenspiele der 1980er. Ton per Web Audio, Ehrentafel nur lokal im Browser.</p>
      </footer>

      {panel === 'market' && g && <Market game={g} onClose={() => setPanel(null)} />}
      {panel === 'rules' && <Rules onClose={() => setPanel(null)} />}
      {panel === 'scores' && <HonourBoard onClose={() => setPanel(null)} />}
    </div>
  );
}

