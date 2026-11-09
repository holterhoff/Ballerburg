import { useEffect, useRef, useState } from 'react';
import { CASTLES, buildCastle } from '../game/castles.js';
import { AI_PROFILES, profileById } from '../game/profiles.js';
import { SIDE_COLORS, drawCastlePreview, drawTerrainPreview } from '../game/render.js';
import { TERRAINS, generateHeights } from '../game/terrain.js';

function CastlePreview({ castle, side }) {
  const ref = useRef(null);
  useEffect(() => {
    drawCastlePreview(ref.current, buildCastle(castle, side), side);
  }, [castle, side]);
  return <canvas ref={ref} className="castle-preview" aria-label={`Vorschau ${CASTLES[castle].name}`} role="img" />;
}

function TerrainPicker({ kind, heights, onKind, onReroll }) {
  const ref = useRef(null);
  useEffect(() => {
    drawTerrainPreview(ref.current, heights);
  }, [heights]);
  return (
    <fieldset className="terrain-form">
      <legend>Schlachtfeld</legend>
      <div className="terrain-body">
        <div className="field">
          <span>Berg</span>
          <div className="castle-pick">
            {TERRAINS.map((t) => (
              <button key={t.key} type="button" className={kind === t.key ? 'on' : ''} aria-pressed={kind === t.key} onClick={() => onKind(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <small className="muted">Jede Form wird bei jeder Partie neu gewürfelt. Unterhöhlte Hänge rutschen im Spiel nach.</small>
          <button type="button" className="btn small reroll" onClick={onReroll}>Neu würfeln</button>
        </div>
        <canvas ref={ref} className="terrain-preview" role="img" aria-label="Vorschau des Schlachtfelds" />
      </div>
    </fieldset>
  );
}

const DEFAULT = [
  { type: 'human', name: 'Wilhelmine', ai: 'grimm', castle: 'falkenfeste' },
  { type: 'ai', name: 'Ottokar', ai: 'grimm', castle: 'falkenfeste' },
];

function SideForm({ side, value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const profile = profileById(value.ai);
  return (
    <fieldset className="side-form" style={{ '--side': SIDE_COLORS[side].main }}>
      <legend>
        <span className="side-dot" aria-hidden="true" />
        {side === 0 ? 'Linke Burg' : 'Rechte Burg'}
      </legend>

      <div className="segmented" role="radiogroup" aria-label="Wer spielt diese Burg?">
        {[
          ['human', 'Mensch'],
          ['ai', 'Computer'],
        ].map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={value.type === k} className={value.type === k ? 'on' : ''} onClick={() => set({ type: k })}>
            {label}
          </button>
        ))}
      </div>

      {value.type === 'human' ? (
        <label className="field">
          <span>Name</span>
          <input value={value.name} maxLength={20} onChange={(e) => set({ name: e.target.value })} placeholder={side === 0 ? 'Spielerin links' : 'Spieler rechts'} />
        </label>
      ) : (
        <div className="field">
          <span>Gegner</span>
          <div className="ai-list">
            {AI_PROFILES.map((p) => (
              <button key={p.id} type="button" className={`ai-pick ${value.ai === p.id ? 'on' : ''}`} onClick={() => set({ ai: p.id })} aria-pressed={value.ai === p.id}>
                <strong>{p.name}</strong>
                <span className="pips" aria-label={`Stärke ${p.level} von 4`}>
                  {'■'.repeat(p.level)}
                  <i>{'■'.repeat(4 - p.level)}</i>
                </span>
              </button>
            ))}
          </div>
          <small className="muted">{profile.desc}</small>
        </div>
      )}

      <div className="field">
        <span>Burg</span>
        <div className="castle-pick">
          {Object.entries(CASTLES).map(([k, c]) => (
            <button key={k} type="button" className={value.castle === k ? 'on' : ''} onClick={() => set({ castle: k })} aria-pressed={value.castle === k}>
              {c.name}
            </button>
          ))}
        </div>
        <CastlePreview castle={value.castle} side={side} />
        <small className="muted">{CASTLES[value.castle].desc}</small>
      </div>
    </fieldset>
  );
}

export default function Setup({ onStart, onCancel, canCancel }) {
  const [sides, setSides] = useState(DEFAULT);
  const [error, setError] = useState('');
  const [terrain, setTerrain] = useState('zufall');
  const [heights, setHeights] = useState(() => generateHeights('zufall'));
  const pickTerrain = (k) => {
    setTerrain(k);
    setHeights(generateHeights(k));
  };

  const start = (e) => {
    e.preventDefault();
    const players = sides.map((s, i) => {
      const prof = profileById(s.ai);
      const name = s.type === 'ai' ? prof.name : s.name.trim();
      return { name, type: s.type, level: prof.level, castle: s.castle, side: i };
    });
    if (players.some((p) => !p.name)) {
      setError('Bitte gib jeder Burg mit menschlichem Spieler einen Namen.');
      return;
    }
    if (players[0].name === players[1].name) players[1].name += ' II';
    onStart({ players, heights });
  };

  return (
    <form className="setup" onSubmit={start}>
      <header className="setup-head">
        <h2>Neue Fehde</h2>
        <p className="muted">Wähle für jede Seite, wer spielt und welche Burg verteidigt wird. Wer den ersten Schuss hat, entscheidet das Los.</p>
      </header>
      <div className="setup-grid">
        {sides.map((s, i) => (
          <SideForm key={i} side={i} value={s} onChange={(v) => { setError(''); setSides((all) => all.map((x, j) => (j === i ? v : x))); }} />
        ))}
      </div>
      <TerrainPicker kind={terrain} heights={heights} onKind={pickTerrain} onReroll={() => setHeights(generateHeights(terrain))} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="setup-actions">
        {canCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Zurück zur laufenden Partie
          </button>
        )}
        <button type="submit" className="btn primary">Fehde beginnen</button>
      </div>
    </form>
  );
}
