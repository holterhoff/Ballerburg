const KEY = 'burgfehde.scores.v1';

export function loadScores() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function recordResult(winner, loser) {
  try {
    const s = loadScores();
    s[winner] = s[winner] || { w: 0, l: 0 };
    s[loser] = s[loser] || { w: 0, l: 0 };
    s[winner].w++;
    s[loser].l++;
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: results are simply not kept */
  }
}

export function clearScores() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
