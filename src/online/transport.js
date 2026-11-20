// Echtzeit-Verbindung für das Online-Spiel (übernommen aus der Kniffel-App).
//
// Mit gesetzten Supabase-Werten läuft alles über Supabase Realtime
// (Presence = wer ist im Raum, Broadcast = Spielzüge). Ohne Zugangsdaten fällt das Spiel
// auf BroadcastChannel zurück: Das verbindet nur Tabs desselben Browsers und dient zum Testen.
// Alle Kanäle tragen das Präfix "bb-", damit sie sich nicht mit anderen Apps im selben Supabase-Projekt mischen.

import { createClient } from '@supabase/supabase-js';

/* global __SUPABASE_URL__, __SUPABASE_KEY__ */
const url = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '';
const key = typeof __SUPABASE_KEY__ !== 'undefined' ? __SUPABASE_KEY__ : '';

export const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
export const transportKind = supabase ? 'supabase' : 'local';

/**
 * Öffnet einen Kanal.
 * @param {string} name Kanalname (ohne Präfix)
 * @param {{ presenceKey: string, onPresence: (list: object[]) => void, onMessage: (event: string, payload: any) => void, onStatus?: (status: 'online' | 'error') => void }} handlers
 * @returns {{ track: (meta: object) => void, send: (event: string, payload: any) => void, close: () => void }}
 */
export function openChannel(name, handlers) {
  return supabase ? openSupabase(`bb-${name}`, handlers) : openLocal(`bb-${name}`, handlers);
}

// Kanäle, die gerade geschlossen werden: erst neu öffnen, wenn das Schließen fertig ist,
// sonst liefert supabase-js den gerade schließenden Kanal zurück.
const closing = new Map();

function openSupabase(name, { presenceKey, onPresence, onMessage, onStatus }) {
  let tracked = null;
  let ready = false;
  let closed = false;
  let channel = null;
  const queue = [];

  const start = () => {
    if (closed) return;
    channel = supabase.channel(name, { config: { broadcast: { self: false }, presence: { key: presenceKey } } });
    channel.on('presence', { event: 'sync' }, () => onPresence(Object.values(channel.presenceState()).flat()));
    channel.on('broadcast', { event: 'msg' }, ({ payload }) => onMessage(payload.event, payload.data));
    channel.subscribe(async (status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onStatus?.('error');
      if (status !== 'SUBSCRIBED') return;
      onStatus?.('online');
      ready = true;
      if (tracked) await channel.track(tracked);
      for (const fn of queue.splice(0)) fn();
    });
  };
  const pending = closing.get(name);
  if (pending) pending.then(start);
  else start();

  const whenReady = (fn) => (ready ? fn() : queue.push(fn));

  return {
    track(meta) {
      tracked = meta;
      whenReady(() => channel.track(meta));
    },
    send(event, data) {
      whenReady(() => channel.send({ type: 'broadcast', event: 'msg', payload: { event, data } }));
    },
    close() {
      closed = true;
      if (!channel) return;
      const done = supabase.removeChannel(channel).catch(() => {});
      closing.set(name, done);
      done.finally(() => { if (closing.get(name) === done) closing.delete(name); });
    },
  };
}

// --- Fallback: Tabs im selben Browser -------------------------------------------------

const HEARTBEAT_MS = 2000;
const EXPIRE_MS = 6000;

function openLocal(name, { presenceKey, onPresence, onMessage, onStatus }) {
  const bc = new BroadcastChannel(name);
  const peers = new Map(); // key → { meta, seen }
  let mine = null;

  const emitPresence = () => {
    const list = [...peers.values()].map((p) => p.meta);
    if (mine) list.push(mine);
    onPresence(list);
  };

  bc.onmessage = ({ data }) => {
    const { kind, key: from, meta, event, payload } = data;
    if (kind === 'here' || kind === 'hello') {
      if (meta) peers.set(from, { meta, seen: Date.now() });
      if (kind === 'hello' && mine) bc.postMessage({ kind: 'here', key: presenceKey, meta: mine });
      emitPresence();
    } else if (kind === 'bye') {
      peers.delete(from);
      emitPresence();
    } else if (kind === 'msg') {
      onMessage(event, payload);
    }
  };

  const heartbeat = setInterval(() => {
    if (mine) bc.postMessage({ kind: 'here', key: presenceKey, meta: mine });
    const now = Date.now();
    let changed = false;
    for (const [k, p] of peers) if (now - p.seen > EXPIRE_MS) { peers.delete(k); changed = true; }
    if (changed) emitPresence();
  }, HEARTBEAT_MS);

  bc.postMessage({ kind: 'hello', key: presenceKey, meta: null });
  queueMicrotask(() => { emitPresence(); onStatus?.('online'); });

  return {
    track(meta) {
      mine = meta;
      bc.postMessage({ kind: 'hello', key: presenceKey, meta });
      emitPresence();
    },
    send(event, payload) {
      bc.postMessage({ kind: 'msg', event, payload });
    },
    close() {
      clearInterval(heartbeat);
      if (mine) bc.postMessage({ kind: 'bye', key: presenceKey });
      bc.close();
    },
  };
}
