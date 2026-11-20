import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { openChannel } from './transport.js';
import { packGame, applyGame } from './snapshot.js';
import { Game } from '../game/engine.js';
import { recordResult } from '../game/scores.js';

/* global __APP_VERSION__ */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0';

/**
 * Protokoll (Broadcast im Kanal "room-CODE", Presence = wer ist im Raum):
 *   hello {from}                    – nach jedem (Wieder-)Verbinden: "schickt mir den aktuellen Stand"
 *   start {rev, cfg, seats, snap}   – Gastgeber startet: Burgen, Gelände, Optionen und Startstand
 *   state {rev, snap}               – vollständiger Spielstand vom Gerät, das gerade am Zug ist
 *                                     (nach jedem Kauf, jeder Steueränderung, jedem Anbau und am Zugende)
 *   fire  {rev, id, angle, powder}  – ein Schuss, damit die anderen die Kugel fliegen sehen
 *   leave {from}                    – jemand hat den Raum verlassen
 * Es gilt immer der Stand mit der höchsten `rev`. Die Lobby (Kanal "lobby") zeigt per Presence die offenen Räume.
 */

const SEND_DELAY_MS = 250;
const SETTLE_TIMEOUT_MS = 6000;

/** Eindeutige Kennung dieses Tabs (zwei Tabs im selben Browser sind zwei Spieler). */
export function clientId() {
  try {
    let id = sessionStorage.getItem('bb:client');
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('bb:client', id); }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function newRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // ohne I und O (Verwechslungsgefahr)
  return Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
}

/** Offene Räume, die gerade von Gastgebern angekündigt werden. */
export function useOpenRooms(active) {
  const [rooms, setRooms] = useState([]);
  const [status, setStatus] = useState('connecting');
  useEffect(() => {
    if (!active) return undefined;
    const ch = openChannel('lobby', {
      presenceKey: clientId(),
      onPresence: (list) => setRooms(list.filter((r) => r.code).sort((a, b) => a.createdAt - b.createdAt)),
      onMessage: () => {},
      onStatus: setStatus,
    });
    return () => ch.close();
  }, [active]);
  return { rooms, status };
}

/** Ist gerade etwas in Bewegung (Kugel, fallende Burgteile)? Dann einen neuen Stand erst danach übernehmen. */
const busy = (g) => !!g.projectile || g.phase === 'flying' || g.objects.some((o) => o.alive && o.fall);

/**
 * Ein Online-Raum für Ballerburg. Der Gastgeber spielt die linke Burg, der erste Gast die rechte;
 * wer später kommt, schaut zu. Gerechnet wird immer auf dem Gerät, dessen Burg am Zug ist.
 *
 * @param {{code: string, name: string, host: boolean} | null} room
 * @param {(game: Game | null) => void} onGame neue Partie (oder null beim Verlassen)
 */
export function useOnlineMatch(room, onGame, force) {
  const me = useMemo(clientId, []);
  const [members, setMembers] = useState([]);
  const [status, setStatus] = useState('connecting');
  const [seats, setSeats] = useState(null); // [clientId links, clientId rechts]
  const chRef = useRef(null);
  const gameRef = useRef(null);
  const revRef = useRef(0);
  const sendTimer = useRef(null);
  const pending = useRef(null); // empfangener Stand, der wartet, bis die Kugel gelandet ist
  const onGameRef = useRef(onGame);
  onGameRef.current = onGame;
  const forceRef = useRef(force);
  forceRef.current = force;
  const applying = useRef(false);

  const mySide = seats ? seats.indexOf(me) : -1;
  const mySideRef = useRef(mySide);
  mySideRef.current = mySide;

  const sendState = useCallback(() => {
    clearTimeout(sendTimer.current);
    sendTimer.current = null;
    const g = gameRef.current;
    if (!g || !chRef.current) return;
    revRef.current += 1;
    chRef.current.send('state', { rev: revRef.current, snap: packGame(g) });
  }, []);

  /** Eigene Änderungen (Kauf, Steuern, Anbau) kurz sammeln und dann verschicken. */
  const scheduleSend = useCallback(() => {
    const g = gameRef.current;
    if (applying.current || !g || g.mySide < 0 || g.current !== g.mySide || g.phase !== 'aim') return;
    clearTimeout(sendTimer.current);
    sendTimer.current = setTimeout(sendState, SEND_DELAY_MS);
  }, [sendState]);

  /** Eine Partie in diesem Gerät einrichten: Rückmeldungen ins Netz verdrahten. */
  const adopt = useCallback((g, side) => {
    g.mySide = side;
    g.onChange = () => { forceRef.current?.(); scheduleSend(); };
    g.onTurnEnd = (moverSide) => { if (moverSide === g.mySide) sendState(); };
    gameRef.current = g;
    onGameRef.current(g);
  }, [scheduleSend, sendState]);

  /** Einen Stand übernehmen, ohne ihn als eigene Änderung gleich wieder zu verschicken. */
  const receive = (g, snap) => {
    applying.current = true;
    try { applyGame(g, snap, g.mySide); } finally { applying.current = false; }
  };

  const applyPending = useCallback(() => {
    const p = pending.current;
    const g = gameRef.current;
    if (!p || !g) return;
    if (busy(g) && Date.now() - p.at < SETTLE_TIMEOUT_MS) return;
    pending.current = null;
    const wasOver = g.phase === 'over';
    receive(g, p.snap);
    // Ergebnisliste: auch der Zuschauer und der Verlierer tragen das Ende ein
    if (!wasOver && g.phase === 'over' && g.winner != null) {
      recordResult(g.players[g.winner].name, g.players[1 - g.winner].name);
    }
  }, []);

  // empfangene Stände übernehmen, sobald nichts mehr fliegt
  useEffect(() => {
    if (!room) return undefined;
    const t = setInterval(applyPending, 150);
    return () => clearInterval(t);
  }, [room, applyPending]);

  const joinedAt = useRef(Date.now());
  useEffect(() => {
    if (!room) return undefined;
    const { code, name, host } = room;
    const ch = openChannel(`room-${code}`, {
      presenceKey: me,
      onPresence: (list) => setMembers([...list].sort((a, b) => a.joinedAt - b.joinedAt)),
      onStatus: (s) => {
        setStatus(s);
        if (s === 'online') ch.send('hello', { from: me });
      },
      onMessage: (event, payload) => {
        const g = gameRef.current;
        if (event === 'hello') {
          if (g && g.seats) ch.send('start', { rev: revRef.current, cfg: g.onlineCfg, seats: g.seats, snap: packGame(g) });
          return;
        }
        if (event === 'start') {
          if (g && payload.rev <= revRef.current) return;
          revRef.current = payload.rev;
          const side = payload.seats.indexOf(me);
          setSeats(payload.seats);
          let game = g;
          if (!game || game.onlineCode !== code || game.startId !== payload.cfg.startId) {
            game = new Game(payload.cfg, () => {});
            game.onlineCode = code;
            game.startId = payload.cfg.startId;
            game.onlineCfg = payload.cfg;
            game.seats = payload.seats;
            adopt(game, side);
          }
          pending.current = null;
          game.mySide = side;
          receive(game, payload.snap);
          return;
        }
        if (!g) return;
        if (event === 'state') {
          if (payload.rev <= revRef.current) return;
          revRef.current = payload.rev;
          pending.current = { snap: payload.snap, at: Date.now() };
          applyPending();
          return;
        }
        if (event === 'fire') {
          revRef.current = Math.max(revRef.current, payload.rev);
          if (!g.remoteFire(payload.id, payload.angle, payload.powder)) {
            // Stand verpasst? Dann den neuesten anfordern.
            ch.send('hello', { from: me });
          }
        }
      },
    });
    ch.track({ id: me, name, host, joinedAt: joinedAt.current, version: APP_VERSION });
    chRef.current = ch;

    // Gastgeber: Raum in der Lobby ankündigen
    let lobby = null;
    if (host) {
      lobby = openChannel('lobby', { presenceKey: me, onPresence: () => {}, onMessage: () => {} });
      lobby.track({ code, hostName: name, createdAt: Date.now() });
    }

    // Handy entsperrt oder Netz wieder da: neuesten Stand anfordern
    const wake = () => { if (document.visibilityState === 'visible') ch.send('hello', { from: me }); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);

    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      clearTimeout(sendTimer.current);
      ch.send('leave', { from: me });
      ch.close();
      lobby?.close();
      chRef.current = null;
    };
  }, [room, me, adopt, applyPending]);

  /** Gastgeber: Partie mit den beiden ersten Spielern im Raum starten. */
  const start = useCallback(({ castles, terrain, field, options }) => {
    const players = members.slice(0, 2);
    if (players.length < 2) return;
    const seatIds = players.map((m) => m.id);
    const cfg = {
      startId: `${Date.now()}`,
      players: players.map((m, i) => ({ name: m.name, type: i === 0 ? 'human' : 'remote', castle: castles[i] })),
      terrain,
      terrainData: field || undefined,
      options,
    };
    const game = new Game(cfg, () => {});
    game.onlineCode = room.code;
    game.startId = cfg.startId;
    // der Gast baut die Partie aus demselben Gelände nach
    game.onlineCfg = { ...cfg, terrainData: { heights: Array.from(game.heights), baseY: game.baseY } };
    game.seats = seatIds;
    setSeats(seatIds);
    adopt(game, seatIds.indexOf(me));
    receive(game, packGame(game));
    revRef.current += 1;
    chRef.current?.send('start', { rev: revRef.current, cfg: game.onlineCfg, seats: seatIds, snap: packGame(game) });
  }, [members, room, me, adopt]);

  /** Vor einem eigenen Schuss: offenen Stand sofort schicken, dann den Schuss selbst. */
  const fire = useCallback((id, angle, powder) => {
    const g = gameRef.current;
    if (!g || g.current !== g.mySide) return false;
    if (sendTimer.current) sendState();
    if (!g.fire(id, angle, powder)) return false;
    revRef.current += 1;
    chRef.current?.send('fire', { rev: revRef.current, id, angle: g.obj(id)?.aim.angle ?? angle, powder: g.obj(id)?.aim.powder ?? powder });
    return true;
  }, [sendState]);

  const leave = useCallback(() => {
    gameRef.current = null;
    setSeats(null);
    revRef.current = 0;
    onGameRef.current(null);
  }, []);

  const present = new Set(members.map((m) => m.id));
  const opponentAway = !!(seats && mySide >= 0 && !present.has(seats[1 - mySide]));
  const versions = new Set(members.map((m) => m.version));

  return {
    me, members, status, seats, mySide, start, fire, leave,
    isHost: !!room?.host, opponentAway, versionMismatch: versions.size > 1,
  };
}
