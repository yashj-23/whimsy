// Everything that changes Whimsy's state goes through here, and gets saved on the way.
import { get, set, DEFAULT_PREFS, DEFAULT_CTX } from './state.js';
import * as store from './store.js';
import { DECK } from './deck.js';
import {
  draw, makeInstance, castCoins, chaosContext, ratingsFromSessions, ctxKey, indexDeck,
} from './engine.js';
import { TEMP_CONTEXT_HOURS, MAX_PINS, TIMES, APP_VERSION, ADAPTS } from './constants.js';
import { chime, shimmer, buzz, unlockAudio } from './feel.js';

const HISTORY_MAX = 400;
const NUDGES_MAX = 300;

export function uid(prefix = '') {
  const r = (crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + r;
}

// ───────────── deck ─────────────

let deckCache = { custom: null, deck: DECK, index: indexDeck(DECK) };

export function fullDeck() {
  const custom = get().customCards;
  if (deckCache.custom !== custom) {
    const deck = DECK.concat(custom.map(normalizeCustom));
    deckCache = { custom, deck, index: indexDeck(deck) };
  }
  return deckCache.deck;
}

export function cardById(id) {
  fullDeck();
  return deckCache.index.get(id) || null;
}

export function normalizeCustom(c) {
  const stuck = c.mode === 'stuck';
  return {
    id: c.id,
    custom: true,
    mode: stuck ? 'stuck' : 'bored',
    cats: stuck ? (c.cats && c.cats.length ? c.cats : ['any']) : undefined,
    snags: stuck ? (c.snags && c.snags.length ? c.snags : ['any']) : undefined,
    intents: stuck ? undefined : (c.intents && c.intents.length ? c.intents : ['make', 'explore', 'reset', 'play']),
    flavor: 'reframe',
    family: 'own-' + c.id,
    weird: c.weird || 1,
    effort: c.effort || 1,
    mins: c.mins || 5,
    where: c.where && c.where.length ? c.where : ['desk', 'home', 'out'],
    needs: c.needs || [],
    title: c.title || 'Untitled card',
    action: c.action || '',
    boundary: '',
    finish: c.finish || '',
    bridge: stuck ? (c.bridge || '') : '',
    adapt: {},
  };
}

// ───────────── persistence ─────────────

function savePrefs() { return store.kvSet('prefs', get().prefs).catch(storageFailed); }
function saveHistory() { return store.kvSet('history', get().history).catch(storageFailed); }
function saveNudges() { return store.kvSet('nudges', get().nudges).catch(storageFailed); }
function saveActive() { return store.kvSet('active', get().active).catch(storageFailed); }

function storageFailed(e) {
  console.error(e);
  toast("Couldn't save to this device. Check that storage isn't full or blocked.");
}

export async function boot() {
  let ok = true;
  try {
    ok = await store.isPersistentStorage();
    const [prefs, history, nudges, active, sessions, cards] = await Promise.all([
      store.kvGet('prefs'), store.kvGet('history'), store.kvGet('nudges'), store.kvGet('active'),
      store.all('sessions'), store.all('cards'),
    ]);
    const merged = mergePrefs(prefs);
    set({
      prefs: merged,
      history: Array.isArray(history) ? history : [],
      nudges: Array.isArray(nudges) ? nudges : [],
      active: active && active.instance ? active : (active && active.stage === 'empty' ? null : null),
      sessions: (sessions || []).sort((a, b) => b.createdAt - a.createdAt),
      customCards: (cards || []).sort((a, b) => a.createdAt - b.createdAt),
      storageOk: ok,
    });
    await store.kvSet('schema', store.SCHEMA);
  } catch (e) {
    console.error(e);
    ok = false;
    set({ storageOk: false });
  }
  expireTemporaryContext();
  set({ ready: true, installed: isInstalled() });
  if (ok) store.requestPersistence();
}

function mergePrefs(p) {
  if (!p || typeof p !== 'object') return { ...DEFAULT_PREFS };
  return {
    ...DEFAULT_PREFS,
    ...p,
    ctx: { ...DEFAULT_CTX, ...(p.ctx || {}) },
    rules: { ...DEFAULT_PREFS.rules, ...(p.rules || {}), quiet: { ...DEFAULT_PREFS.rules.quiet, ...((p.rules && p.rules.quiet) || {}) } },
    banned: Array.isArray(p.banned) ? p.banned : [],
    pins: Array.isArray(p.pins) ? p.pins : [],
  };
}

export function isInstalled() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch (e) { return false; }
}

// Time, energy and place are true only for a while. After a few hours they go back to the defaults.
export function expireTemporaryContext() {
  const { prefs } = get();
  if (!prefs.ctxAt) return;
  if (Date.now() - prefs.ctxAt < TEMP_CONTEXT_HOURS * 3600 * 1000) return;
  const ctx = { ...prefs.ctx, time: DEFAULT_CTX.time, energy: DEFAULT_CTX.energy, setting: DEFAULT_CTX.setting };
  const changed = ctx.time !== prefs.ctx.time || ctx.energy !== prefs.ctx.energy || ctx.setting !== prefs.ctx.setting;
  set({ prefs: { ...prefs, ctx, ctxAt: 0, rightNowOpen: changed ? true : prefs.rightNowOpen }, ctxReset: changed });
  savePrefs();
}

// ───────────── simple setters ─────────────

export function setTab(tab) {
  set({ tab });
  if (tab === 'home') expireTemporaryContext();
  try { window.scrollTo({ top: 0 }); } catch (e) { /* ignore */ }
}

export function setCtx(patch) {
  const { prefs } = get();
  const temp = 'time' in patch || 'energy' in patch || 'setting' in patch;
  set({
    prefs: { ...prefs, ctx: { ...prefs.ctx, ...patch }, ctxAt: temp ? Date.now() : prefs.ctxAt },
    ctxReset: temp ? false : get().ctxReset,
  });
  savePrefs();
}

export function setPrefs(patch) {
  set({ prefs: { ...get().prefs, ...patch } });
  savePrefs();
}

export function setRules(patch) {
  const { prefs } = get();
  set({ prefs: { ...prefs, rules: { ...prefs.rules, ...patch } } });
  savePrefs();
}

let toastTimer = null;
export function toast(text, action = null, ms = 3600) {
  clearTimeout(toastTimer);
  set({ toast: { text, action, id: Date.now() } });
  toastTimer = setTimeout(() => set({ toast: null }), ms);
}

export function dismissToast() {
  clearTimeout(toastTimer);
  set({ toast: null });
}

// ───────────── drawing ─────────────

function freshRound() {
  return {
    shownIds: [], excludeNeeds: [], excludeFamilies: [], excludeFlavors: [], penalFlavors: [],
    maxEffort: null, maxMins: null, skips: 0, anyCategory: false, flavorsSeen: [],
  };
}

function ratings() {
  const s = get();
  return ratingsFromSessions(s.sessions).concat(s.nudges);
}

export function openGrimoire({ chaos = false, reliable = false, round = null, ctx: forcedCtx = null } = {}) {
  unlockAudio();
  const { prefs } = get();
  let ctx = { ...(forcedCtx || prefs.ctx) };
  let coins = null;
  if (chaos) {
    ctx = chaosContext(ctx, Math.random);
  } else if (ctx.weird === 'fate') {
    coins = castCoins(Math.random);
    ctx.weird = coins.weird;
  }
  if (!forcedCtx) {
    // Drawing confirms the temporary context is still true.
    set({ prefs: { ...prefs, ctxAt: Date.now() }, ctxReset: false });
    savePrefs();
  }
  const active = { stage: 'card', ctx, chaos, reliable, coins, round: round || freshRound(), instance: null, why: null };
  set({ tab: 'home' });
  runDraw(active, true);
}

function runDraw(active, first = false) {
  const s = get();
  const r = draw({
    deck: fullDeck(),
    ctx: active.ctx,
    rules: s.prefs.rules,
    banned: s.prefs.banned,
    history: s.history,
    ratings: ratings(),
    session: active.round,
    anyCategory: active.round.anyCategory,
    onlyIds: active.reliable ? s.prefs.pins : null,
    now: new Date(),
  });
  if (!r.ok) {
    set({ active: { ...active, stage: 'empty', instance: null, why: null, diagnosis: r.diagnosis } });
    saveActive();
    return;
  }
  const inst = r.instance;
  const round = {
    ...active.round,
    shownIds: active.round.shownIds.concat(inst.id),
    flavorsSeen: active.round.flavorsSeen.includes(inst.flavor) ? active.round.flavorsSeen : active.round.flavorsSeen.concat(inst.flavor),
  };
  const history = s.history.concat({ id: inst.id, family: inst.family, flavor: inst.flavor, at: Date.now(), outcome: 'shown' }).slice(-HISTORY_MAX);
  set({
    active: { ...active, stage: 'card', instance: inst, why: r.why, round, coins: first ? active.coins : null, revealId: uid() },
    history,
  });
  saveActive();
  saveHistory();
  if (get().prefs.sound) shimmer();
  if (get().prefs.haptics) buzz(12);
}

function markLast(id, patch) {
  const h = get().history.slice();
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i].id === id) { h[i] = { ...h[i], ...patch }; break; }
  }
  set({ history: h });
  saveHistory();
}

function lowerTime(mins) {
  const below = TIMES.filter((t) => t < mins);
  return below.length ? below[below.length - 1] : 2;
}

export function another(reason = 'none') {
  const a = get().active;
  if (!a || !a.instance) return;
  const inst = a.instance;
  const round = { ...a.round };
  markLast(inst.id, { outcome: 'skipped', reason });
  if (reason === 'possible') {
    if (inst.needs.length) round.excludeNeeds = [...new Set(round.excludeNeeds.concat(inst.needs))];
    else round.excludeFamilies = round.excludeFamilies.concat(inst.family);
  } else if (reason === 'effort') {
    if (inst.effort > 1) round.maxEffort = inst.effort - 1;
    else round.maxMins = lowerTime(inst.mins);
  } else if (reason === 'relevant') {
    round.penalFlavors = round.penalFlavors.concat(inst.flavor);
    round.excludeFamilies = round.excludeFamilies.concat(inst.family);
    const nudges = get().nudges.concat({ id: inst.id, key: ctxKey(a.ctx), v: -0.5, at: Date.now() }).slice(-NUDGES_MAX);
    set({ nudges });
    saveNudges();
  } else if (reason === 'similar') {
    round.excludeFamilies = round.excludeFamilies.concat(inst.family);
  }
  round.skips += 1;
  if (round.skips % 3 === 0 && !a.reliable) {
    set({ active: { ...a, round, stage: 'crossroads' } });
    saveActive();
    return;
  }
  runDraw({ ...a, round });
}

export function crossroads(choice) {
  const a = get().active;
  if (!a) return;
  if (choice === 'stop') { closeActive(); return; }
  const round = { ...a.round };
  if (choice === 'smaller') {
    round.maxEffort = 1;
    round.maxMins = Math.min(a.ctx.time, 5);
  } else if (choice === 'different') {
    round.excludeFlavors = [...new Set(round.excludeFlavors.concat(round.flavorsSeen))];
    round.penalFlavors = [];
  }
  runDraw({ ...a, round });
}

// When nothing fits: the fixes the person can choose. Comfort rules are never relaxed here.
export function widen(how) {
  const a = get().active;
  if (!a) return;
  const round = { ...a.round };
  let ctx = a.ctx;
  if (how === 'category') round.anyCategory = true;
  if (how === 'time') {
    const next = TIMES.find((t) => t > ctx.time) || 60;
    ctx = { ...ctx, time: next };
    setCtx({ time: next });
  }
  if (how === 'energy') {
    ctx = { ...ctx, energy: Math.min(3, ctx.energy + 1) };
    setCtx({ energy: ctx.energy });
  }
  if (how === 'round') {
    Object.assign(round, { excludeNeeds: [], excludeFamilies: [], excludeFlavors: [], penalFlavors: [], maxEffort: null, maxMins: null });
  }
  runDraw({ ...a, ctx, round });
}

export function adapt(key) {
  const a = get().active;
  if (!a || !a.instance) return;
  const card = cardById(a.instance.id);
  if (!card) return;
  const inst = makeInstance(card, key, { now: new Date(), rng: Math.random, dice: a.instance.dice });
  if (!inst) return;
  set({ active: { ...a, instance: inst, adaptedFrom: a.adaptedFrom || a.instance.variant || 'original' } });
  saveActive();
  toast(key ? `Adapted: ${ADAPTS[key].toLowerCase()}` : 'Back to the original');
}

export function togglePin(id) {
  const { prefs } = get();
  if (prefs.pins.includes(id)) {
    setPrefs({ pins: prefs.pins.filter((x) => x !== id) });
    toast('Removed from your reliable cards');
    return;
  }
  if (prefs.pins.length >= MAX_PINS) {
    toast(`You can pin up to ${MAX_PINS} reliable cards. Unpin one in Settings first.`);
    return;
  }
  setPrefs({ pins: prefs.pins.concat(id) });
  toast('Pinned as a reliable card');
}

export function ban(id) {
  const { prefs } = get();
  if (prefs.banned.includes(id)) return;
  setPrefs({ banned: prefs.banned.concat(id), pins: prefs.pins.filter((x) => x !== id) });
  toast('This card will never appear again', { label: 'Undo', fn: () => unban(id) }, 6000);
  const a = get().active;
  if (a && a.instance && a.instance.id === id) {
    markLast(id, { outcome: 'banned' });
    runDraw(a);
  }
}

export function unban(id) {
  setPrefs({ banned: get().prefs.banned.filter((x) => x !== id) });
  toast('Card brought back');
}

export function closeActive() {
  set({ active: null });
  store.kvDelete('active').catch(storageFailed);
}

// ───────────── running a session ─────────────

export function start() {
  const a = get().active;
  if (!a || !a.instance) return;
  unlockAudio();
  markLast(a.instance.id, { outcome: 'accepted' });
  const style = get().prefs.timerStyle;
  set({
    active: {
      ...a, stage: 'running', startedAt: Date.now(), pausedAt: null, pausedTotal: 0,
      timerStyle: style, targetMins: a.instance.mins, chimed: false, timeUp: false,
    },
  });
  saveActive();
  if (get().prefs.haptics) buzz(15);
}

export function elapsedMs(a, now = Date.now()) {
  if (!a || !a.startedAt) return 0;
  const end = a.endedAt || now;
  const paused = a.pausedTotal + (a.pausedAt ? end - a.pausedAt : 0);
  return Math.max(0, end - a.startedAt - paused);
}

export function pause() {
  const a = get().active;
  if (!a || a.stage !== 'running' || a.pausedAt) return;
  set({ active: { ...a, pausedAt: Date.now() } });
  saveActive();
}

export function resume() {
  const a = get().active;
  if (!a || !a.pausedAt) return;
  set({ active: { ...a, pausedTotal: a.pausedTotal + (Date.now() - a.pausedAt), pausedAt: null } });
  saveActive();
}

export function setTimerStyle(style) {
  const a = get().active;
  if (!a) return;
  set({ active: { ...a, timerStyle: style, timeUp: style === 'countdown' ? a.timeUp : false } });
  setPrefs({ timerStyle: style });
  saveActive();
}

export function setTarget(mins) {
  const a = get().active;
  if (!a) return;
  const m = Math.max(1, Math.min(180, mins));
  const timeUp = elapsedMs(a) >= m * 60000;
  set({ active: { ...a, targetMins: m, timeUp, chimed: timeUp ? a.chimed : false } });
  saveActive();
}

// Called by the timer tick. Plays the chime once when a countdown ends.
export function checkTimeUp() {
  const a = get().active;
  if (!a || a.stage !== 'running' || a.timerStyle !== 'countdown' || a.chimed) return;
  if (elapsedMs(a) >= a.targetMins * 60000) {
    set({ active: { ...a, chimed: true, timeUp: true } });
    saveActive();
    const p = get().prefs;
    if (p.sound) chime();
    if (p.haptics) buzz([180, 90, 180]);
  }
}

export function finish(status) {
  const a = get().active;
  if (!a || a.stage !== 'running') return;
  const now = Date.now();
  set({ active: { ...a, stage: 'reflect', status, endedAt: now } });
  saveActive();
}

// Save the session to the journal. `then` decides what happens next.
export async function saveReflection({ rating = null, note = '', nextMove = '', photo = null }, then = 'home') {
  const a = get().active;
  if (!a || a.stage !== 'reflect') return;
  let photoId = null;
  if (photo) {
    photoId = uid('p-');
    try { await store.put('photos', { id: photoId, blob: photo }); } catch (e) { storageFailed(e); photoId = null; }
  }
  const inst = a.instance;
  const entry = {
    id: uid('s-'),
    createdAt: Date.now(),
    startedAt: a.startedAt,
    endedAt: a.endedAt,
    durationSec: Math.round(elapsedMs(a) / 1000),
    status: a.status,
    mode: a.ctx.mode,
    ctx: a.ctx,
    key: ctxKey(a.ctx),
    chaos: !!a.chaos,
    reliable: !!a.reliable,
    timerStyle: a.timerStyle,
    card: {
      id: inst.id, variant: inst.variant, title: inst.title, action: inst.action, boundary: inst.boundary,
      finish: inst.finish, bridge: inst.bridge, flavor: inst.flavor, family: inst.family, weird: inst.weird,
      effort: inst.effort, mins: inst.mins, cats: inst.cats, intents: inst.intents,
    },
    rating,
    note: note.trim(),
    nextMove: nextMove.trim(),
    photoId,
  };
  try { await store.put('sessions', entry); } catch (e) { storageFailed(e); }
  set({ sessions: [entry].concat(get().sessions) });
  closeActive();
  if (then === 'another') {
    openGrimoire({ ctx: a.ctx, chaos: false });
  } else if (then === 'different') {
    openGrimoire({ ctx: a.ctx, round: { ...freshRound(), excludeFlavors: [inst.flavor] } });
  } else {
    toast('Saved to your journal');
  }
}

// ───────────── journal ─────────────

export async function deleteSession(id) {
  const s = get().sessions.find((x) => x.id === id);
  if (!s) return;
  try {
    await store.remove('sessions', id);
    if (s.photoId) await store.remove('photos', s.photoId);
  } catch (e) { storageFailed(e); }
  set({ sessions: get().sessions.filter((x) => x.id !== id) });
  toast('Entry deleted');
}

export async function photoURL(photoId) {
  if (!photoId) return null;
  try {
    const p = await store.get('photos', photoId);
    return p && p.blob ? URL.createObjectURL(p.blob) : null;
  } catch (e) { return null; }
}

// Shrinks a photo so the journal stays light.
export async function compressPhoto(file, max = 1280, quality = 0.8) {
  const bitmap = await loadImage(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), 'image/jpeg', quality));
}

function loadImage(file) {
  if (window.createImageBitmap) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadImageEl(file));
  }
  return loadImageEl(file);
}

function loadImageEl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That image couldn't be read.")); };
    img.src = url;
  });
}

// ───────────── your own cards ─────────────

export async function saveCustomCard(card) {
  const now = Date.now();
  const existing = get().customCards.find((c) => c.id === card.id);
  const record = { ...card, id: card.id || uid('x-'), createdAt: existing ? existing.createdAt : now, updatedAt: now };
  try { await store.put('cards', record); } catch (e) { storageFailed(e); return; }
  const list = existing
    ? get().customCards.map((c) => (c.id === record.id ? record : c))
    : get().customCards.concat(record);
  set({ customCards: list });
  toast(existing ? 'Card updated' : 'Card added to your grimoire');
}

export async function deleteCustomCard(id) {
  try { await store.remove('cards', id); } catch (e) { storageFailed(e); return; }
  const { prefs } = get();
  set({ customCards: get().customCards.filter((c) => c.id !== id) });
  setPrefs({ pins: prefs.pins.filter((x) => x !== id), banned: prefs.banned.filter((x) => x !== id) });
  toast('Card deleted');
}

// ───────────── backup and restore ─────────────

// Builds the backup file. The interface decides how to hand it over (download, or the share sheet on phones).
export async function prepareBackup() {
  const data = await store.exportAll(APP_VERSION);
  const json = JSON.stringify(data);
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const name = `whimsy-backup-${stamp}.json`;
  const blob = new Blob([json], { type: 'application/json' });
  let file = null;
  try { file = new File([blob], name, { type: 'application/json' }); } catch (e) { file = null; }
  const touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  let canShare = false;
  try { canShare = !!(touch && file && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { canShare = false; }
  return { name, blob, file, canShare, size: blob.size, sessions: data.sessions.length, photos: data.photos.length };
}

export function downloadBackup(b) {
  const url = URL.createObjectURL(b.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = b.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  backupDone(`Backup saved as ${b.name}`);
}

// Must be called straight from a tap, so the phone allows the share sheet.
export function shareBackup(b) {
  return navigator.share({ files: [b.file], title: 'Whimsy backup' })
    .then(() => { backupDone('Backup saved'); return true; })
    .catch((e) => {
      if (e && e.name === 'AbortError') return false;
      downloadBackup(b);
      return true;
    });
}

function backupDone(text) {
  setPrefs({ lastBackupAt: Date.now() });
  toast(text);
}

export async function readBackupFile(file) {
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error("This file isn't a Whimsy backup."); }
  const summary = store.validateBackup(data);
  return { data, summary };
}

export async function restore(data) {
  await store.importAll(data);
  await reloadFromStore();
  toast('Backup restored');
}

export async function wipeEverything() {
  await store.wipe();
  set({
    prefs: { ...DEFAULT_PREFS }, history: [], nudges: [], sessions: [], customCards: [], active: null, ctxReset: false,
  });
  toast('Everything deleted from this device');
}

async function reloadFromStore() {
  const [prefs, history, nudges, sessions, cards] = await Promise.all([
    store.kvGet('prefs'), store.kvGet('history'), store.kvGet('nudges'), store.all('sessions'), store.all('cards'),
  ]);
  set({
    prefs: mergePrefs(prefs),
    history: Array.isArray(history) ? history : [],
    nudges: Array.isArray(nudges) ? nudges : [],
    sessions: (sessions || []).sort((a, b) => b.createdAt - a.createdAt),
    customCards: (cards || []).sort((a, b) => a.createdAt - b.createdAt),
    active: null,
  });
}
