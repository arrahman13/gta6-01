// Save games: a thin wrapper over localStorage with a memory fallback, so the
// same code runs in the browser, in a headless test, or anywhere storage is
// denied. A snapshot is plain JSON: money, story progress, collectibles,
// stats and where the player was standing.

import { SAVE_KEY } from './config.js';

const memory = new Map();

function store() {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__ps_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return {
        get: (k) => localStorage.getItem(k),
        set: (k, v) => localStorage.setItem(k, v),
        del: (k) => localStorage.removeItem(k),
      };
    }
  } catch {
    /* storage blocked: fall through to memory */
  }
  return {
    get: (k) => (memory.has(k) ? memory.get(k) : null),
    set: (k, v) => memory.set(k, v),
    del: (k) => memory.delete(k),
  };
}

export function saveGame(snapshot) {
  try {
    store().set(SAVE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = store().get(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function wipeGame() {
  try {
    store().del(SAVE_KEY);
  } catch {
    /* nothing to wipe */
  }
}
