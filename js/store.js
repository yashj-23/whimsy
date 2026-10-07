// Local storage for Whimsy: IndexedDB on this device. Nothing leaves the device.
// Stores: kv (settings and small state), sessions (journal), cards (your own cards), photos (blobs).

const DB_NAME = 'whimsy';
const DB_VERSION = 1;
export const SCHEMA = 1;
const STORES = ['kv', 'sessions', 'cards', 'photos'];

let dbPromise = null;
let memory = null; // fallback when IndexedDB is unavailable

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let r;
    try {
      r = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      memory = { kv: new Map(), sessions: new Map(), cards: new Map(), photos: new Map() };
      resolve(null);
      return;
    }
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
    };
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    r.onerror = () => {
      memory = { kv: new Map(), sessions: new Map(), cards: new Map(), photos: new Map() };
      resolve(null);
    };
    r.onblocked = () => {};
  });
  return dbPromise;
}

export async function isPersistentStorage() {
  const db = await open();
  return !!db;
}

async function withStore(name, mode, fn) {
  const db = await open();
  if (!db) return fn(null);
  const tx = db.transaction(name, mode);
  const result = fn(tx.objectStore(name));
  const value = result instanceof IDBRequest ? await req(result) : await result;
  if (mode === 'readwrite') await done(tx);
  return value;
}

// ───────────── key/value ─────────────

export async function kvGet(key) {
  const db = await open();
  if (!db) return memory.kv.get(key);
  return withStore('kv', 'readonly', (s) => s.get(key));
}

export async function kvSet(key, value) {
  const db = await open();
  if (!db) { memory.kv.set(key, value); return; }
  await withStore('kv', 'readwrite', (s) => s.put(value, key));
}

export async function kvDelete(key) {
  const db = await open();
  if (!db) { memory.kv.delete(key); return; }
  await withStore('kv', 'readwrite', (s) => s.delete(key));
}

// ───────────── records ─────────────

export async function all(name) {
  const db = await open();
  if (!db) return [...memory[name].values()];
  return withStore(name, 'readonly', (s) => s.getAll());
}

export async function put(name, value) {
  const db = await open();
  if (!db) { memory[name].set(value.id, value); return; }
  await withStore(name, 'readwrite', (s) => s.put(value));
}

export async function get(name, id) {
  const db = await open();
  if (!db) return memory[name].get(id);
  return withStore(name, 'readonly', (s) => s.get(id));
}

export async function remove(name, id) {
  const db = await open();
  if (!db) { memory[name].delete(id); return; }
  await withStore(name, 'readwrite', (s) => s.delete(id));
}

// ───────────── whole-database operations ─────────────

export async function wipe() {
  const db = await open();
  if (!db) {
    for (const k of STORES) memory[k].clear();
    return;
  }
  const tx = db.transaction(STORES, 'readwrite');
  for (const k of STORES) tx.objectStore(k).clear();
  await done(tx);
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function dataURLToBlob(url) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url || '');
  if (!m) throw new Error('A photo in the backup is damaged.');
  const type = m[1] || 'application/octet-stream';
  const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function exportAll(appVersion) {
  const kvKeys = ['prefs', 'history', 'nudges'];
  const kv = {};
  for (const k of kvKeys) {
    const v = await kvGet(k);
    if (v !== undefined) kv[k] = v;
  }
  const photos = [];
  for (const p of await all('photos')) {
    photos.push({ id: p.id, type: p.blob.type, data: await blobToDataURL(p.blob) });
  }
  return {
    app: 'whimsy',
    schema: SCHEMA,
    version: appVersion,
    exportedAt: new Date().toISOString(),
    kv,
    sessions: await all('sessions'),
    cards: await all('cards'),
    photos,
  };
}

export function validateBackup(data) {
  if (!data || typeof data !== 'object' || data.app !== 'whimsy') {
    throw new Error("This file isn't a Whimsy backup.");
  }
  if (typeof data.schema !== 'number' || data.schema > SCHEMA) {
    throw new Error('This backup was made by a newer version of Whimsy. Update the app, then restore again.');
  }
  for (const k of ['sessions', 'cards', 'photos']) {
    if (data[k] !== undefined && !Array.isArray(data[k])) throw new Error('The backup file is damaged.');
  }
  return {
    sessions: (data.sessions || []).length,
    cards: (data.cards || []).length,
    photos: (data.photos || []).length,
    exportedAt: data.exportedAt || null,
  };
}

// Replaces everything on this device with the backup. Photos are decoded before anything is cleared,
// so a damaged backup never leaves you with an empty app.
export async function importAll(data) {
  validateBackup(data);
  const migrated = migrate(data);
  const photos = migrated.photos.map((p) => ({ id: p.id, blob: dataURLToBlob(p.data) }));
  await wipe();
  for (const [k, v] of Object.entries(migrated.kv || {})) await kvSet(k, v);
  for (const s of migrated.sessions) if (s && s.id) await put('sessions', s);
  for (const c of migrated.cards) if (c && c.id) await put('cards', c);
  for (const p of photos) await put('photos', p);
  await kvSet('schema', SCHEMA);
}

// Future schema changes go here, one step at a time.
export function migrate(data) {
  const out = { kv: data.kv || {}, sessions: data.sessions || [], cards: data.cards || [], photos: data.photos || [] };
  // schema 1 is current; nothing to change yet
  return out;
}

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persisted) {
      if (await navigator.storage.persisted()) return true;
      if (navigator.storage.persist) return await navigator.storage.persist();
    }
  } catch (e) { /* not supported */ }
  return false;
}

export async function storageEstimate() {
  try {
    if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate();
  } catch (e) { /* not supported */ }
  return null;
}
