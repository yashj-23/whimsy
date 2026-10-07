// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECK } from '../js/deck.js';
import {
  draw, versionOf, hardFail, fitVersion, adaptOptions, makeInstance, castCoins, chaosContext,
  ratingWeight, inQuietHours, indexDeck, eligible, blockedNeeds,
} from '../js/engine.js';
import { CATEGORIES, SNAGS, INTENTS, FLAVORS, NEEDS, ADAPTS, TIMES, SETTINGS } from '../js/constants.js';
import { tokensIn, knownToken, segments, plain, applyDice, rollDice } from '../js/dice.js';

function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const NOON = new Date(2026, 9, 7, 12, 30);
const baseCtx = { mode: 'stuck', cat: 'code', snag: 'unsure', intent: 'any', time: 15, energy: 2, setting: 'desk', weird: 1 };
const byId = indexDeck(DECK);

function envFor(ctx, rules = {}, banned = [], session = {}) {
  return {
    blocked: blockedNeeds(rules, NOON, session),
    quiet: inQuietHours(rules.quiet, NOON),
    maxEffort: Math.min(ctx.energy, session.maxEffort || 3),
    maxMins: Math.min(ctx.time, session.maxMins || Infinity),
    banned: new Set(banned),
    setting: ctx.setting,
  };
}

// Simulate a person drawing repeatedly, with history growing like the app's.
function drawMany(n, ctx, opts = {}) {
  const rng = seeded(opts.seed || 7);
  const history = [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = typeof ctx === 'function' ? ctx(rng) : ctx;
    const r = draw({ deck: DECK, ctx: c, rules: opts.rules, banned: opts.banned, history, session: opts.session, now: NOON, rng, anyCategory: opts.anyCategory });
    out.push({ r, ctx: c });
    if (r.ok) history.push({ id: r.instance.id, family: r.instance.family, flavor: r.instance.flavor, at: NOON.getTime() + i });
  }
  return out;
}

// ───────────── deck integrity ─────────────

test('every card is well formed', () => {
  const ids = new Set();
  for (const c of DECK) {
    assert.ok(c.id && !ids.has(c.id), `duplicate or missing id ${c.id}`);
    ids.add(c.id);
    assert.ok(['stuck', 'bored'].includes(c.mode), c.id);
    assert.ok(c.title && c.action && c.finish, `${c.id} needs title, action and finish`);
    assert.ok(FLAVORS[c.flavor], `${c.id} flavor ${c.flavor}`);
    assert.ok(c.family, `${c.id} family`);
    assert.ok([1, 2, 3].includes(c.weird), `${c.id} weird`);
    assert.ok([1, 2, 3].includes(c.effort), `${c.id} effort`);
    assert.ok(Number.isFinite(c.mins) && c.mins >= 2 && c.mins <= 60, `${c.id} mins`);
    assert.ok(c.where.length && c.where.every((w) => SETTINGS[w]), `${c.id} where`);
    assert.ok(c.needs.every((n) => NEEDS[n]), `${c.id} needs`);
    if (c.mode === 'stuck') {
      assert.ok(c.cats.length && c.cats.every((k) => k === 'any' || CATEGORIES[k]), `${c.id} cats`);
      assert.ok(c.snags.length && c.snags.every((k) => k === 'any' || SNAGS[k]), `${c.id} snags`);
      assert.ok(c.bridge, `${c.id} stuck cards need a bridge back`);
    } else {
      assert.ok(c.intents.length && c.intents.every((k) => k === 'play' || INTENTS[k]), `${c.id} intents`);
    }
    for (const [key, v] of Object.entries(c.adapt || {})) {
      assert.ok(ADAPTS[key], `${c.id} adapt key ${key}`);
      assert.ok(v.action, `${c.id} ${key} needs action`);
      const ver = versionOf(c, key);
      assert.ok(ver.where.every((w) => SETTINGS[w]) && ver.needs.every((n) => NEEDS[n]), `${c.id} ${key} fields`);
      assert.ok(ver.mins >= 2, `${c.id} ${key} mins`);
      if (key === 'smaller') assert.ok(ver.mins <= c.mins, `${c.id} smaller must not be longer`);
      if (key === 'weirder') assert.ok(ver.weird > c.weird || c.weird === 3, `${c.id} weirder must be weirder`);
      if (key === 'quiet') assert.ok(!ver.needs.includes('talk') && !ver.needs.includes('sound'), `${c.id} quiet must be silent`);
      if (key === 'still') assert.ok(!ver.needs.includes('move'), `${c.id} still must not move`);
      if (key === 'indoors') assert.ok(!ver.needs.includes('outside'), `${c.id} indoors must stay in`);
      if (key === 'nocam') assert.ok(!ver.needs.includes('camera'), `${c.id} nocam must not need camera`);
    }
    const toks = tokensIn([c.title, c.action, c.boundary, c.finish, c.bridge, ...Object.values(c.adapt || {}).flatMap((v) => [v.action, v.finish, v.title])]);
    for (const t of toks) assert.ok(knownToken(t), `${c.id} unknown dice token {${t}}`);
  }
  assert.ok(DECK.length >= 100, `deck has ${DECK.length} cards`);
});

test('outdoor cards always have a way to stay in', () => {
  for (const c of DECK) {
    if (!c.needs.includes('outside')) continue;
    const keys = Object.keys(c.adapt || {});
    const rescue = keys.some((k) => !versionOf(c, k).needs.includes('outside'));
    assert.ok(rescue, `${c.id} needs an indoor alternative`);
  }
});

// ───────────── hard rules ─────────────

test('a banned card never appears', () => {
  const ban = ['u-ten-year-old', 'c-duck', 'c-trust-nothing', 'u-two-minute-door'];
  for (const { r } of drawMany(800, { ...baseCtx, weird: 1, snag: 'broken' }, { banned: ban })) {
    if (r.ok) assert.ok(!ban.includes(r.instance.id));
  }
});

test('comfort rules are never broken, even in Total Chaos', () => {
  const rules = { outside: true, move: true, talk: true, sound: true, camera: true };
  const runs = drawMany(1500, (rng) => chaosContext({ ...baseCtx, setting: ['desk', 'home', 'out'][Math.floor(rng() * 3)], time: 60, energy: 3 }, rng), { rules });
  let ok = 0;
  for (const { r } of runs) {
    if (!r.ok) continue;
    ok++;
    for (const n of r.instance.needs) assert.fail(`chaos drew ${r.instance.id} needing ${n}`);
  }
  assert.ok(ok > 1400, `chaos found cards ${ok}/1500`);
});

test('time, energy and setting are always respected', () => {
  for (const time of TIMES) for (const energy of [1, 2, 3]) for (const setting of ['desk', 'home', 'out']) {
    for (const mode of ['stuck', 'bored']) {
      const ctx = { ...baseCtx, mode, time, energy, setting, cat: 'writing', weird: 2 };
      for (const { r } of drawMany(40, ctx, { seed: time * 7 + energy })) {
        if (!r.ok) continue;
        assert.ok(r.instance.mins <= time, `${r.instance.id} ${r.instance.mins} > ${time}`);
        assert.ok(r.instance.effort <= energy, `${r.instance.id} effort`);
        assert.ok(r.instance.where.includes(setting), `${r.instance.id} where`);
      }
    }
  }
});

test('quiet hours keep it calm', () => {
  const night = new Date(2026, 9, 7, 23, 15);
  const rules = { quiet: { on: true, from: '22:00', to: '07:00' } };
  assert.equal(inQuietHours(rules.quiet, night), true);
  assert.equal(inQuietHours(rules.quiet, NOON), false);
  assert.equal(inQuietHours({ on: true, from: '09:00', to: '17:00' }, NOON), true);
  const rng = seeded(3);
  for (let i = 0; i < 400; i++) {
    const r = draw({ deck: DECK, ctx: { ...baseCtx, mode: i % 2 ? 'stuck' : 'bored', energy: 3, time: 60, weird: 3, setting: 'home' }, rules, now: night, rng });
    if (!r.ok) continue;
    for (const n of ['talk', 'sound', 'outside']) assert.ok(!r.instance.needs.includes(n), `${r.instance.id} at night needs ${n}`);
    assert.ok(r.instance.effort < 3);
  }
});

test('a card that breaks a rule is rescued by its own adaptation', () => {
  const card = byId.get('u-walk-one-question');
  const env = envFor({ ...baseCtx, setting: 'desk' });
  const f = fitVersion(card, env);
  assert.ok(f.version, 'should be rescued');
  assert.ok(['indoors', 'smaller'].includes(f.rescued));
  assert.ok(!f.version.needs.includes('outside'));
  const quiet = fitVersion(byId.get('c-duck'), envFor(baseCtx, { talk: true }));
  assert.equal(quiet.rescued, 'quiet');
});

test('session limits from skips are hard rules too', () => {
  const session = { excludeNeeds: ['move'], maxEffort: 1, maxMins: 4 };
  for (const { r } of drawMany(300, { ...baseCtx, mode: 'bored', time: 60, energy: 3, setting: 'home' }, { session })) {
    if (!r.ok) continue;
    assert.ok(!r.instance.needs.includes('move'));
    assert.ok(r.instance.effort <= 1 && r.instance.mins <= 4);
  }
});

// ───────────── soft preferences and fallbacks ─────────────

test('never the same card twice in a row', () => {
  const runs = drawMany(600, { ...baseCtx, cat: 'design', snag: 'finish', weird: 3, time: 5, energy: 1 });
  for (let i = 1; i < runs.length; i++) {
    if (runs[i].r.ok && runs[i - 1].r.ok) assert.notEqual(runs[i].r.instance.id, runs[i - 1].r.instance.id);
  }
});

test('a tiny eligible pool does not crash and still returns something', () => {
  const ctx = { ...baseCtx, cat: 'learning', snag: 'options', weird: 3, time: 2, energy: 1, setting: 'out' };
  const rules = { talk: true, move: true, sound: true };
  for (const { r } of drawMany(100, ctx, { rules })) {
    assert.ok(r.ok, 'expected the ladder to find something');
    assert.ok(r.instance.mins <= 2 && r.instance.effort === 1);
  }
});

test('an impossible context returns a diagnosis instead of breaking a rule', () => {
  const everything = DECK.map((c) => c.id);
  const r = draw({ deck: DECK, ctx: baseCtx, banned: everything, now: NOON, rng: seeded(1) });
  assert.equal(r.ok, false);
  assert.ok(r.diagnosis.total > 0);
  assert.equal(r.diagnosis.counts.banned, r.diagnosis.total);
});

test('exact matches win when they exist', () => {
  for (const cat of Object.keys(CATEGORIES)) for (const weird of [1, 2, 3]) {
    const ctx = { ...baseCtx, cat, weird, time: 60, energy: 3, setting: 'home' };
    const exactExists = eligible(DECK, ctx).some((x) => x.version.weird === weird);
    const r = draw({ deck: DECK, ctx, now: NOON, rng: seeded(cat.length + weird) });
    assert.ok(r.ok);
    if (exactExists) assert.equal(r.instance.weird, weird, `${cat} w${weird} drew ${r.instance.id}`);
  }
});

test('category is never broadened unless asked', () => {
  for (const { r } of drawMany(500, { ...baseCtx, cat: 'code', weird: 3, snag: 'finish', time: 5, energy: 1 })) {
    if (!r.ok) continue;
    const card = byId.get(r.instance.id);
    assert.ok(card.cats.includes('any') || card.cats.includes('code'), `${card.id} is not for code`);
  }
});

test('variety: a session of draws spreads across cards', () => {
  const runs = drawMany(30, { ...baseCtx, cat: 'writing', time: 60, energy: 3, setting: 'home' });
  const distinct = new Set(runs.map((x) => x.r.instance.id));
  assert.ok(distinct.size >= 12, `only ${distinct.size} distinct cards in 30 draws`);
});

test('rating weights stay bounded', () => {
  assert.equal(ratingWeight('x', 'k', []), 1);
  assert.equal(ratingWeight('x', 'k', [{ id: 'x', key: 'k', v: -1 }]), 0.75);
  const many = Array.from({ length: 20 }, () => ({ id: 'x', key: 'k', v: 2 }));
  assert.equal(ratingWeight('x', 'k', many), 2);
  const bad = Array.from({ length: 20 }, () => ({ id: 'x', key: 'k', v: -1 }));
  assert.equal(ratingWeight('x', 'k', bad), 0.5);
  // a debugging win counts only half toward brainstorming
  assert.equal(ratingWeight('x', 'snag:angle', [{ id: 'x', key: 'snag:broken', v: 2 }]), 1.25);
});

test('three coins: 50% Nudge, 37.5% Twist, 12.5% Absurd', () => {
  const rng = seeded(99);
  const n = 40000;
  const c = { 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < n; i++) c[castCoins(rng).weird]++;
  assert.ok(Math.abs(c[1] / n - 0.5) < 0.015);
  assert.ok(Math.abs(c[2] / n - 0.375) < 0.015);
  assert.ok(Math.abs(c[3] / n - 0.125) < 0.015);
});

// ───────────── adaptations and dice ─────────────

test('adapt options respect hard rules and keep dice values', () => {
  const card = byId.get('u-word-oracle');
  const inst = makeInstance(card, null, { now: NOON, rng: seeded(5) });
  assert.ok(inst.dice.word);
  const opts = adaptOptions(inst, card, { ctx: baseCtx, rules: {}, banned: [], session: {}, now: NOON });
  assert.deepEqual(opts.map((o) => o.key).sort(), ['smaller', 'weirder']);
  const weirder = makeInstance(card, 'weirder', { now: NOON, rng: seeded(6), dice: inst.dice });
  assert.equal(weirder.dice.word, inst.dice.word);
  assert.equal(weirder.weird, 3);
  const back = adaptOptions(weirder, card, { ctx: baseCtx, rules: {}, banned: [], session: {}, now: NOON });
  assert.ok(back.some((o) => o.key === null));

  const duck = byId.get('c-duck');
  const silent = adaptOptions(makeInstance(duck, 'quiet', { now: NOON, rng: seeded(1) }), duck, { ctx: baseCtx, rules: { talk: true }, banned: [], session: {}, now: NOON });
  assert.ok(!silent.some((o) => o.key === null), 'original needs talking, so it must not be offered');
});

test('world dice are captured once and highlighted', () => {
  const values = rollDice(['num', 'few', 'page', 'word', 'coin'], new Date(2026, 9, 7, 12, 40), seeded(2));
  assert.equal(values.num, '1');   // 40 % 5 + 1
  assert.equal(values.few, '2');   // 40 % 3 + 1
  assert.equal(values.page, '7');
  const text = applyDice('Keep {few} of {num}.', values);
  assert.deepEqual(segments(text).map((s) => s.dice), [false, true, false, true, false]);
  assert.equal(plain(text), 'Keep 2 of 1.');
  const c = makeInstance(byId.get('u-clock-decides'), null, { now: new Date(2026, 9, 7, 12, 40), rng: seeded(2) });
  assert.ok(!/\{\w+\}/.test(c.action + c.finish), 'no unresolved tokens');
});

test('every card resolves without leftover tokens, in every version', () => {
  for (const card of DECK) {
    for (const key of [null, ...Object.keys(card.adapt || {})]) {
      const inst = makeInstance(card, key, { now: NOON, rng: seeded(4) });
      for (const f of ['title', 'action', 'boundary', 'finish', 'bridge']) {
        assert.ok(!/\{\w+\}/.test(inst[f] || ''), `${card.id}/${key} ${f}`);
      }
    }
  }
});

// ───────────── coverage: realistic contexts always find a card ─────────────

test('every reasonable context finds a card that matches the category', () => {
  const misses = [];
  for (const cat of Object.keys(CATEGORIES)) for (const snag of Object.keys(SNAGS)) for (const weird of [1, 2, 3])
    for (const time of [5, 15, 25]) for (const energy of [1, 2, 3]) for (const setting of ['desk', 'home', 'out']) {
      const ctx = { mode: 'stuck', cat, snag, weird, time, energy, setting, intent: 'any' };
      const r = draw({ deck: DECK, ctx, now: NOON, rng: seeded(1) });
      if (!r.ok) misses.push(JSON.stringify(ctx));
    }
  for (const intent of Object.keys(INTENTS)) for (const weird of [1, 2, 3]) for (const time of [2, 5, 15]) for (const energy of [1, 2, 3]) for (const setting of ['desk', 'home', 'out']) {
    const ctx = { mode: 'bored', intent, weird, time, energy, setting, cat: 'code', snag: 'unsure' };
    const r = draw({ deck: DECK, ctx, now: NOON, rng: seeded(1) });
    if (!r.ok) misses.push(JSON.stringify(ctx));
  }
  assert.deepEqual(misses, []);
});
