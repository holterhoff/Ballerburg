import { useState } from 'react';
import { Dialog, Btn } from './Gem.jsx';
import { CASTLES } from '../game/castles.js';
import { SIDE_COLORS } from '../game/render.js';
import { newRoomCode, useOpenRooms } from '../online/useOnlineMatch.js';
import { transportKind } from '../online/transport.js';

const NAME_KEY = 'bb:online-name';
const loadName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const saveName = (n) => { try { localStorage.setItem(NAME_KEY, n); } catch { /* egal */ } };

/**
 * Online spielen: einen Raum eröffnen oder einem beitreten. Im Raum sieht man, wer da ist;
 * der Gastgeber spielt die linke Burg, der erste Gast die rechte, alle weiteren schauen zu.
 */
export function OnlineDialog({ room, online, castles, onEnter, onStart, onLeave, onClose }) {
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState('');
  const { rooms, status } = useOpenRooms(!room);
  const clean = name.trim().slice(0, 16);

  const enter = (c, host) => {
    if (!clean) return;
    saveName(clean);
    onEnter({ code: c, name: clean, host });
  };

  if (!room) {
    return (
      <Dialog title="Online spielen" onClose={onClose} className="narrow">
        <label className="gem-field">
          <span>Dein Name:</span>
          <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="z. B. Ritter Kunibert" data-autofocus />
        </label>
        <fieldset className="gem-box">
          <legend>Neuer Raum</legend>
          <p className="gem-small">Du eröffnest einen Raum und spielst die linke Burg. Den Raumcode gibst du deinem Gegner.</p>
          <div className="gem-actions"><Btn def disabled={!clean} onClick={() => enter(newRoomCode(), true)}>Raum eröffnen</Btn></div>
        </fieldset>
        <fieldset className="gem-box">
          <legend>Raum beitreten</legend>
          <label className="gem-field">
            <span>Raumcode:</span>
            <input value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} placeholder="ABCD" />
            <Btn disabled={!clean || code.length !== 4} onClick={() => enter(code, false)}>Beitreten</Btn>
          </label>
          <h3>Offene Räume</h3>
          {status === 'error' && <p className="gem-small">Keine Verbindung zum Server.</p>}
          {status !== 'error' && rooms.length === 0 && <p className="gem-small">Gerade wartet niemand. Eröffne selbst einen Raum.</p>}
          <ul className="online-rooms">
            {rooms.map((r) => (
              <li key={r.code}>
                <button className="gem-btn" disabled={!clean} onClick={() => enter(r.code, false)}>
                  {r.code} · {r.hostName}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
        {transportKind === 'local' && <p className="gem-small">Testmodus ohne Server: Es verbinden sich nur Tabs in diesem Browser.</p>}
        <div className="gem-actions"><Btn onClick={onClose}>Schließen</Btn></div>
      </Dialog>
    );
  }

  const { members, status: roomStatus, isHost, versionMismatch } = online;
  const players = members.slice(0, 2);
  const watchers = members.slice(2);
  return (
    <Dialog title={`Raum ${room.code}`} onClose={onClose} className="narrow">
      <p className="gem-text">Raumcode: <b className="online-code">{room.code}</b></p>
      {roomStatus === 'connecting' && <p className="gem-small">Verbinde …</p>}
      {roomStatus === 'error' && <p className="gem-small">Keine Verbindung zum Server. Es wird weiter versucht.</p>}
      <fieldset className="gem-box">
        <legend>Im Raum</legend>
        <ul className="online-members">
          {[0, 1].map((i) => (
            <li key={i} style={{ '--side': SIDE_COLORS[i].main }}>
              <span className="online-side">{i === 0 ? 'Links' : 'Rechts'}</span>
              {players[i] ? <b>{players[i].name}</b> : <i>wartet auf Mitspieler …</i>}
              {isHost && <span className="online-castle"> · {CASTLES[castles[i]]?.name}</span>}
            </li>
          ))}
          {watchers.map((m) => <li key={m.id} className="online-watch">schaut zu: {m.name}</li>)}
        </ul>
      </fieldset>
      {versionMismatch && <p className="gem-small">Achtung: Nicht alle haben dieselbe Version von Ballerburg. Bitte die Seite neu laden.</p>}
      {isHost
        ? <p className="gem-small">Es gelten deine Burgen, das Gelände und die Spielart aus „Neues Spiel“ und „Modus“. Sobald ein Mitspieler da ist, kannst du starten.</p>
        : <p className="gem-small">Der Gastgeber startet die Partie. Du spielst die rechte Burg.</p>}
      <div className="gem-actions">
        <Btn onClick={onLeave}>Raum verlassen</Btn>
        {isHost && <Btn def disabled={players.length < 2} onClick={onStart}>Partie starten</Btn>}
      </div>
    </Dialog>
  );
}
