// A tiny app-wide store. Screens read with useApp(); actions write with set().
import { useEffect, useReducer } from './vendor/preact-htm.js';

export const DEFAULT_CTX = {
  mode: 'stuck', cat: 'code', snag: 'unsure', intent: 'any', weird: 1,
  time: 15, energy: 2, setting: 'desk',
};

export const DEFAULT_PREFS = {
  ctx: DEFAULT_CTX,
  ctxAt: 0,
  rules: {
    outside: false, move: false, talk: false, sound: false, camera: false,
    quiet: { on: false, from: '22:00', to: '07:00' },
  },
  banned: [],
  pins: [],
  sound: true,
  haptics: true,
  motion: 'system',
  timerStyle: 'countdown',
  keepAwake: true,
  lastBackupAt: null,
  rightNowOpen: false,
};

let state = {
  ready: false,
  storageOk: true,
  tab: 'home',
  prefs: DEFAULT_PREFS,
  ctxReset: false,
  history: [],
  nudges: [],
  sessions: [],
  customCards: [],
  active: null,
  toast: null,
  updateReady: false,
  installed: false,
};

const subs = new Set();

export function get() {
  return state;
}

export function set(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  for (const fn of subs) fn();
}

export function useApp() {
  const [, force] = useReducer((x) => x + 1, 0);
  const seen = state;
  useEffect(() => {
    subs.add(force);
    // State may have changed between render and subscribing (e.g. a fast startup). Catch up.
    if (state !== seen) force();
    return () => subs.delete(force);
  }, []);
  return state;
}
