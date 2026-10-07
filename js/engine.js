// The selection engine. Pure functions only: no DOM, no storage, no clock unless passed in.
// draw() takes the person's context and history and returns one card that fits, plus the reasons.
//
// Order of work
//   1. Hard rules (never bend): bans, comfort rules, quiet hours, setting, time, energy, session limits.
//      A card that breaks a rule can be rescued by one of its own adaptations (indoors, still, quiet...).
//   2. Category must match (Get unstuck), unless the person explicitly chose to broaden it.
//   3. Soft preferences relax in a fixed ladder: flavor variety, repeat window, weirdness, snag/intent.
//   4. Weighted choice: 75% leans gently on ratings, 25% ignores them entirely.

import { RESCUE_ORDER, CATEGORIES, SNAGS, INTENTS, WEIRD, EFFORT, SETTINGS, NEEDS, ADAPTS, MODES } from './constants.js';
import { rollDice, applyDice, tokensIn } from './dice.js';

const DAY = 86400000;
const TEXT_FIELDS = ['title', 'action', 'boundary', 'finish', 'bridge'];

// ───────────── helpers ─────────────

export function indexDeck(deck) {
  const map = new Map();
  for (const c of deck) map.set(c.id, c);
  return map;
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return ((h || 0) * 60 + (m || 0)) % 1440;
}

export function inQuietHours(quiet, now) {
  if (!quiet || !quiet.on) return false;
  const m = now.getHours() * 60 + now.getMinutes();
  const a = toMinutes(quiet.from);
  const b = toMinutes(quiet.to);
  if (a === b) return false;
  return a < b ? m >= a && m < b : m >= a || m < b;
}

export function blockedNeeds(rules, now, session) {
  const set = new Set();
  for (const k of Object.keys(NEEDS)) if (rules && rules[k]) set.add(k);
  if (rules && inQuietHours(rules.quiet, now)) {
    set.add('outside'); set.add('sound'); set.add('talk');
  }
  for (const n of (session && session.excludeNeeds) || []) set.add(n);
  return set;
}

// A card as it would be with one adaptation applied (or the original when key is null).
export function versionOf(card, key) {
  if (!key) return { ...card, variant: null };
  const v = card.adapt && card.adapt[key];
  if (!v) return null;
  let weird = v.weird ?? card.weird;
  if (key === 'weirder' && v.weird == null) weird = Math.min(3, card.weird + 1);
  return {
    ...card,
    title: v.title ?? card.title,
    action: v.action ?? card.action,
    boundary: v.boundary, // boundaries are usually time-specific, so they are not inherited
    finish: v.finish ?? card.finish,
    bridge: v.bridge ?? card.bridge,
    needs: v.needs ?? card.needs,
    where: v.where ?? card.where,
    mins: v.mins ?? card.mins,
    effort: v.effort ?? card.effort,
    weird,
    variant: key,
  };
}

function makeEnv({ ctx, rules, banned, session, now }) {
  const s = session || {};
  return {
    blocked: blockedNeeds(rules, now, s),
    quiet: inQuietHours(rules && rules.quiet, now),
    maxEffort: Math.min(ctx.energy || 3, s.maxEffort || 3),
    maxMins: Math.min(ctx.time || 60, s.maxMins || Infinity),
    banned: new Set(banned || []),
    setting: ctx.setting,
  };
}

// Returns null when the version fits, otherwise the first rule it breaks.
export function hardFail(v, env) {
  if (env.banned.has(v.id)) return 'banned';
  if (v.mins > env.maxMins) return 'time';
  if (v.effort > env.maxEffort) return 'energy';
  if (!v.where.includes(env.setting)) return 'setting';
  for (const n of v.needs) if (env.blocked.has(n)) return 'comfort:' + n;
  if (env.quiet && v.effort >= 3) return 'quiet';
  return null;
}

// The original form if it fits, otherwise the first adaptation that rescues it.
export function fitVersion(card, env) {
  const base = versionOf(card, null);
  const reason = hardFail(base, env);
  if (!reason) return { version: base, rescued: null };
  if (reason === 'banned') return { fail: reason };
  for (const key of RESCUE_ORDER) {
    const v = versionOf(card, key);
    if (v && !hardFail(v, env)) return { version: v, rescued: key };
  }
  return { fail: reason };
}

function categoryOk(card, ctx, anyCategory) {
  if (ctx.mode !== 'stuck' || anyCategory) return true;
  return card.cats.includes('any') || card.cats.includes(ctx.cat);
}

function aimOk(card, ctx) {
  if (ctx.mode === 'stuck') {
    if (!ctx.snag || ctx.snag === 'unsure') return true;
    return card.snags.includes(ctx.snag) || card.snags.includes('any');
  }
  if (!ctx.intent || ctx.intent === 'any') return true;
  return card.intents.includes(ctx.intent);
}

export function ctxKey(ctx) {
  return ctx.mode === 'stuck' ? 'snag:' + (ctx.snag || 'unsure') : 'intent:' + (ctx.intent || 'any');
}

// Ratings: [{ id, key, v }] oldest first. A card's weight stays between 0.5 and 2,
// so one poor rating never buries it and a great one never dominates.
export function ratingWeight(id, key, ratings) {
  let same = 0, other = 0, ns = 0, no = 0;
  for (let i = ratings.length - 1; i >= 0; i--) {
    const r = ratings[i];
    if (r.id !== id || r.v == null) continue;
    if (r.key === key) { if (ns < 8) { same += r.v; ns++; } }
    else if (no < 8) { other += r.v; no++; }
  }
  const score = same + 0.5 * other;
  return Math.max(0.5, Math.min(2, 1 + 0.25 * score));
}

function weightedPick(items, weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

// ───────────── card instances ─────────────

// A drawn card with World Dice values rolled. `dice` keeps earlier values when adapting.
export function makeInstance(card, variantKey, { now, rng, dice = {} }) {
  const v = versionOf(card, variantKey);
  if (!v) return null;
  const names = tokensIn(TEXT_FIELDS.map((f) => v[f]));
  const values = rollDice(names, now, rng, dice);
  const inst = {
    id: card.id,
    variant: variantKey || null,
    mode: card.mode,
    cats: card.cats || null,
    snags: card.snags || null,
    intents: card.intents || null,
    flavor: card.flavor,
    family: card.family,
    weird: v.weird,
    effort: v.effort,
    mins: v.mins,
    needs: v.needs,
    where: v.where,
    dice: values,
  };
  for (const f of TEXT_FIELDS) inst[f] = applyDice(v[f], values) || '';
  return inst;
}

// Adaptations the person can switch to right now (only ones that still respect the hard rules).
export function adaptOptions(instance, card, { ctx, rules, banned, session, now }) {
  if (!card) return [];
  const env = makeEnv({ ctx, rules, banned: (banned || []).filter((id) => id !== card.id), session: { excludeNeeds: (session && session.excludeNeeds) || [] }, now });
  const out = [];
  if (instance.variant) {
    const base = versionOf(card, null);
    if (!hardFail(base, env)) out.push({ key: null, label: 'Back to the original' });
  }
  for (const key of Object.keys(card.adapt || {})) {
    if (key === instance.variant) continue;
    const v = versionOf(card, key);
    if (v && !hardFail(v, env)) out.push({ key, label: ADAPTS[key] || key });
  }
  return out;
}

// ───────────── context helpers ─────────────

export function castCoins(rng) {
  const coins = [rng() < 0.5, rng() < 0.5, rng() < 0.5];
  const heads = coins.filter(Boolean).length;
  const weird = heads <= 1 ? 1 : heads === 2 ? 2 : 3; // 50% Nudge, 37.5% Twist, 12.5% Absurd
  return { coins, heads, weird };
}

// Total Chaos: randomizes what to do, never your limits (time, energy, setting, rules stay).
export function chaosContext(ctx, rng) {
  const mode = rng() < 0.5 ? 'stuck' : 'bored';
  const cats = Object.keys(CATEGORIES);
  const intents = Object.keys(INTENTS);
  return {
    ...ctx,
    mode,
    cat: cats[Math.floor(rng() * cats.length)],
    snag: 'unsure',
    intent: intents[Math.floor(rng() * intents.length)],
    weird: 1 + Math.floor(rng() * 3),
  };
}

export function ratingsFromSessions(sessions) {
  const out = [];
  for (const s of sessions || []) {
    if (s.rating == null || !s.card) continue;
    out.push({ id: s.card.id, key: s.key, v: s.rating });
  }
  return out;
}

function noveltyText(id, history, now) {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].id === id) {
      const ago = now.getTime() - history[i].at;
      if (ago < DAY) return 'Shown earlier today';
      const d = Math.round(ago / DAY);
      return d === 1 ? 'Last shown yesterday' : `Last shown ${d} days ago`;
    }
  }
  return 'Never shown to you before';
}

// ───────────── the draw ─────────────

const LADDER = [
  { weird: 'exact', aim: 'exact', win: 'full', vary: true,  sess: true },
  { weird: 'exact', aim: 'exact', win: 'full', vary: false, sess: true },
  { weird: 'exact', aim: 'exact', win: 'half', vary: false, sess: true },
  { weird: 'near',  aim: 'exact', win: 'half', vary: false, sess: true },
  { weird: 'exact', aim: 'exact', win: 'last', vary: false, sess: false },
  { weird: 'near',  aim: 'exact', win: 'last', vary: false, sess: false },
  { weird: 'any',   aim: 'exact', win: 'last', vary: false, sess: false },
  { weird: 'any',   aim: 'broad', win: 'last', vary: false, sess: false },
  { weird: 'any',   aim: 'broad', win: 'none', vary: false, sess: false },
];

export function draw({
  deck, ctx, rules = {}, banned = [], history = [], ratings = [], session = {},
  now = new Date(), rng = Math.random, anyCategory = false, onlyIds = null,
}) {
  const env = makeEnv({ ctx, rules, banned, session, now });
  const last = history.length ? history[history.length - 1] : null;

  // Reliable mode: only pinned cards, any mode or category, hard rules still apply.
  if (onlyIds) {
    const pinned = deck.filter((c) => onlyIds.includes(c.id));
    const fits = [];
    for (const card of pinned) {
      const f = fitVersion(card, env);
      if (f.version) fits.push({ card, ...f });
    }
    let pool = fits.filter((c) => !last || c.card.id !== last.id);
    if (!pool.length) pool = fits;
    if (!pool.length) return { ok: false, diagnosis: diagnose(pinned, env, ctx, session, true) };
    const chosen = pool[Math.floor(rng() * pool.length)];
    const instance = makeInstance(chosen.card, chosen.rescued, { now, rng });
    return {
      ok: true,
      instance,
      why: buildWhy({ chosen, ctx, env, history, now, explore: false, pool: pool.length, reliable: true, weight: 1 }),
    };
  }

  // Hard rules + mode + category.
  const inMode = deck.filter((c) => c.mode === ctx.mode && categoryOk(c, ctx, anyCategory));
  const candidates = [];
  for (const card of inMode) {
    const f = fitVersion(card, env);
    if (f.version) candidates.push({ card, version: f.version, rescued: f.rescued });
  }
  if (!candidates.length) {
    return { ok: false, diagnosis: diagnose(inMode, env, ctx, session, false) };
  }

  // Proportional repeat windows, based on how many cards fit exactly.
  const exact = candidates.filter((c) => c.version.weird === ctx.weird && aimOk(c.card, ctx));
  const families = new Set(exact.map((c) => c.card.family));
  const winFull = Math.min(30, Math.floor(exact.length * 0.6));
  const famFull = Math.min(12, Math.floor(families.size * 0.6));
  const recentIds = (n) => new Set(history.slice(Math.max(0, history.length - n)).map((h) => h.id));
  const recentFams = (n) => new Set(history.slice(Math.max(0, history.length - n)).map((h) => h.family));

  const s = session || {};
  const sessShown = new Set(s.shownIds || []);
  const sessFams = new Set(s.excludeFamilies || []);
  const sessFlavors = new Set(s.excludeFlavors || []);

  let pool = [];
  let level = -1;
  for (let i = 0; i < LADDER.length; i++) {
    const L = LADDER[i];
    let ids = new Set(), fams = new Set();
    if (L.win === 'full') { ids = recentIds(winFull); fams = recentFams(famFull); }
    else if (L.win === 'half') { ids = recentIds(Math.floor(winFull / 2)); fams = recentFams(Math.floor(famFull / 2)); }
    else if (L.win === 'last' && last) { ids = new Set([last.id]); }
    pool = candidates.filter((c) => {
      const w = c.version.weird;
      if (L.weird === 'exact' && w !== ctx.weird) return false;
      if (L.weird === 'near' && Math.abs(w - ctx.weird) > 1) return false;
      if (L.aim === 'exact' && !aimOk(c.card, ctx)) return false;
      if (ids.has(c.card.id) || fams.has(c.card.family)) return false;
      if (L.vary && last && c.card.flavor === last.flavor) return false;
      if (L.sess && (sessShown.has(c.card.id) || sessFams.has(c.card.family) || sessFlavors.has(c.card.flavor))) return false;
      if (L.win !== 'none' && last && c.card.id === last.id) return false;
      return true;
    });
    if (pool.length) { level = i; break; }
  }
  if (!pool.length) pool = candidates; // unreachable in practice: the last rung only drops soft rules
  if (level === -1) level = LADDER.length - 1;

  const explore = rng() < 0.25;
  const key = ctxKey(ctx);
  const penal = new Set(s.penalFlavors || []);
  const weights = pool.map((c) => {
    let w = explore ? 1 : ratingWeight(c.card.id, key, ratings);
    if (penal.has(c.card.flavor)) w *= 0.35;
    if (ctx.mode === 'stuck' && ctx.snag === 'unsure' && c.card.snags.includes('unsure')) w *= 1.4;
    return w;
  });
  const chosen = weightedPick(pool, weights, rng);
  const weight = weights[pool.indexOf(chosen)];
  const instance = makeInstance(chosen.card, chosen.rescued, { now, rng });
  return {
    ok: true,
    instance,
    why: buildWhy({ chosen, ctx, env, history, now, explore, pool: pool.length, level, weight, anyCategory }),
  };
}

function buildWhy({ chosen, ctx, env, history, now, explore, pool, level = 0, weight, reliable = false, anyCategory = false }) {
  const { card, version, rescued } = chosen;
  const matched = [];
  const relaxed = [];
  if (reliable) {
    matched.push('One of your reliable cards');
  } else if (ctx.mode === 'stuck') {
    if (anyCategory) relaxed.push('You broadened the search to every category');
    else matched.push(card.cats.includes('any') ? `Works for any category, including ${CATEGORIES[ctx.cat].label}` : CATEGORIES[ctx.cat].label);
    if (ctx.snag && ctx.snag !== 'unsure') {
      if (card.snags.includes(ctx.snag)) matched.push(SNAGS[ctx.snag].label);
      else if (card.snags.includes('any')) matched.push(`Works for any snag, including "${SNAGS[ctx.snag].label}"`);
      else relaxed.push(`Not specifically for "${SNAGS[ctx.snag].label}"; nothing closer was left`);
    } else {
      matched.push('Any snag');
    }
  } else {
    if (ctx.intent && ctx.intent !== 'any') {
      if (card.intents.includes(ctx.intent)) matched.push(INTENTS[ctx.intent].label);
      else relaxed.push(`Not specifically "${INTENTS[ctx.intent].label}"; nothing closer was left`);
    } else {
      matched.push('Anything goes');
    }
  }
  if (!reliable) {
    if (version.weird === ctx.weird) matched.push(WEIRD[ctx.weird].label);
    else relaxed.push(`Closest weirdness available: ${WEIRD[version.weird].label} instead of ${WEIRD[ctx.weird].label}`);
  }
  if (level >= 1 && history.length && card.flavor === history[history.length - 1].flavor) relaxed.push('Same kind of move as your last card');

  const fits = [
    `${version.mins} min, within your ${env.maxMins === Infinity ? 'time' : env.maxMins + ' min'}`,
    EFFORT[version.effort],
    `Works ${SETTINGS[ctx.setting].label.toLowerCase()}`,
  ];
  if (env.blocked.size) fits.push('Respects your comfort rules');
  if (env.quiet) fits.push('Calm enough for quiet hours');
  if (rescued) fits.push(`Adapted to fit: ${ADAPTS[rescued]}`);

  return {
    mode: MODES[ctx.mode].label,
    matched,
    fits,
    relaxed,
    drawType: reliable
      ? 'Reliable draw: picked from your pinned cards'
      : explore
        ? 'Exploration draw: ignored your ratings this time'
        : 'Preference draw: gently weighted by your ratings',
    weight: Math.round(weight * 100) / 100,
    novelty: noveltyText(card.id, history, now),
    pool,
    level,
  };
}

// Why nothing fits, in terms the person can act on.
function diagnose(cards, env, ctx, session, reliable) {
  const counts = {};
  for (const card of cards) {
    const f = fitVersion(card, env);
    if (f.version) continue;
    counts[f.fail] = (counts[f.fail] || 0) + 1;
  }
  const s = session || {};
  return {
    total: cards.length,
    counts,
    reliable,
    sessionLimited: !!((s.excludeNeeds && s.excludeNeeds.length) || (s.maxEffort && s.maxEffort < 3) || s.maxMins),
  };
}

// For tests and the deck checker: every card that could ever be drawn in a context.
export function eligible(deck, ctx, opts = {}) {
  const env = makeEnv({ ctx, rules: opts.rules || {}, banned: opts.banned || [], session: opts.session || {}, now: opts.now || new Date(2026, 0, 1, 12, 0) });
  return deck
    .filter((c) => c.mode === ctx.mode && categoryOk(c, ctx, opts.anyCategory))
    .map((card) => ({ card, ...fitVersion(card, env) }))
    .filter((x) => x.version);
}
