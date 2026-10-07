import { html, useState, useEffect } from '../vendor/preact-htm.js';
import { useApp } from '../state.js';
import * as act from '../actions.js';
import { adaptOptions } from '../engine.js';
import { DiceText, Sheet } from '../ui.js';
import { Icon } from '../icons.js';
import {
  CATEGORIES, SNAGS, INTENTS, WEIRD, SKIP_REASONS, NEEDS, SETTINGS, ADAPTS,
} from '../constants.js';

export function cardAccent(inst, ctx) {
  if (inst.mode === 'stuck') {
    const cat = inst.cats && inst.cats.includes(ctx.cat) ? ctx.cat : (inst.cats && inst.cats.find((c) => CATEGORIES[c])) || ctx.cat;
    return CATEGORIES[cat] ? CATEGORIES[cat].color : '#EE8579';
  }
  const it = ctx.intent && INTENTS[ctx.intent] ? ctx.intent : 'any';
  return INTENTS[it].color;
}

export function cardContext(inst, ctx) {
  if (inst.mode === 'stuck') {
    const catLabel = inst.cats && (inst.cats.includes(ctx.cat) || inst.cats.includes('any')) ? CATEGORIES[ctx.cat].label : 'Any category';
    const snag = ctx.snag && ctx.snag !== 'unsure' && inst.snags && inst.snags.includes(ctx.snag) ? SNAGS[ctx.snag].label : null;
    return snag ? `${catLabel}, ${snag.toLowerCase()}` : catLabel;
  }
  return INTENTS[ctx.intent] ? (ctx.intent === 'any' ? 'Surprise' : INTENTS[ctx.intent].label) : 'Surprise';
}

function Coins({ coins }) {
  return html`<div class="coins" aria-label=${`Three coins: ${coins.heads} heads. Fate chose ${WEIRD[coins.weird].label}.`}>
    ${coins.coins.map((h, i) => html`<span class=${'coin' + (h ? ' heads' : '')} style=${`--i:${i}`} aria-hidden="true">${h ? 'H' : 'T'}</span>`)}
    <span class="coins-text">Fate chose ${WEIRD[coins.weird].label}</span>
  </div>`;
}

function WhyPanel({ why, inst }) {
  return html`<div class="why" id="why-panel">
    <dl>
      <div><dt>Matched</dt><dd>${why.matched.join(', ')}</dd></div>
      <div><dt>Fits</dt><dd>${why.fits.join(', ')}</dd></div>
      ${why.relaxed.length > 0 && html`<div><dt>Relaxed</dt><dd>${why.relaxed.join('. ')}</dd></div>`}
      <div><dt>Draw</dt><dd>${why.drawType}${why.weight !== 1 ? ` (weight ${why.weight})` : ''}</dd></div>
      <div><dt>Novelty</dt><dd>${why.novelty}</dd></div>
      <div><dt>Pool</dt><dd>${why.pool} ${why.pool === 1 ? 'card' : 'cards'} could have been drawn</dd></div>
      ${inst.needs.length > 0 && html`<div><dt>Needs</dt><dd>${inst.needs.map((n) => NEEDS[n].short).join(', ')}</dd></div>`}
    </dl>
  </div>`;
}

export function CardFace({ inst, ctx, children, compact = false, extra = null }) {
  const [more, setMore] = useState(() => compact && typeof window !== 'undefined' && window.matchMedia('(min-width: 701px)').matches);
  const hasMore = !!(inst.boundary || inst.finish || inst.bridge);
  const showMore = more;
  return html`<article class=${'card' + (compact ? ' card-compact' : '')} style=${`--accent:${cardAccent(inst, ctx)}`} aria-labelledby="card-title">
    <div class="card-meta">
      <span class="card-context"><span class="dot" aria-hidden="true"></span>${cardContext(inst, ctx)}</span>
      <span class="card-tags">
        <span class="tag tag-weird" style=${`--c:${WEIRD[inst.weird].color}`}>${WEIRD[inst.weird].label}</span>
        <span class="tag">${inst.mins} min</span>
      </span>
    </div>
    ${extra}
    <h2 class="card-title display" id="card-title" tabindex="-1"><${DiceText} text=${inst.title}/></h2>
    <p class="card-action"><${DiceText} text=${inst.action}/></p>
    ${inst.variant && html`<p class="card-adapted"><${Icon} name="wand" size=${15}/> ${ADAPTS[inst.variant]}</p>`}
    ${hasMore && html`<button type="button" class="card-more-toggle" aria-expanded=${more ? 'true' : 'false'} onClick=${() => setMore(!more)}>
      ${more ? 'Less' : inst.mode === 'stuck' ? 'How far, when to stop, and the way back' : 'How far, and when to stop'}
      <${Icon} name=${more ? 'chevronDown' : 'chevron'} size=${15}/>
    </button>`}
    ${hasMore && showMore && html`<dl class="card-more">
      ${inst.boundary && html`<div><dt>Boundary</dt><dd><${DiceText} text=${inst.boundary}/></dd></div>`}
      ${inst.finish && html`<div><dt>Finish line</dt><dd><${DiceText} text=${inst.finish}/></dd></div>`}
      ${inst.bridge && html`<div><dt>Bridge back</dt><dd><${DiceText} text=${inst.bridge}/></dd></div>`}
    </dl>`}
    ${children}
  </article>`;
}

export function DrawScreen() {
  const s = useApp();
  const a = s.active;
  if (!a) return null;
  if (a.stage === 'empty') return html`<${Empty} a=${a} s=${s}/>`;
  if (a.stage === 'crossroads') return html`<${Crossroads} a=${a}/>`;
  return html`<${CardStage} a=${a} s=${s}/>`;
}

function TopBar({ a, s, inst }) {
  const [menu, setMenu] = useState(false);
  const pinned = inst && s.prefs.pins.includes(inst.id);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (!e.target.closest('.menu-wrap')) setMenu(false); };
    const esc = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [menu]);
  return html`<div class="draw-top">
    <button type="button" class="icon-btn" onClick=${act.closeActive} aria-label="Close the grimoire"><${Icon} name="close"/></button>
    <span class="draw-top-label">
      ${a.chaos ? 'Chaos chose for you' : a.reliable ? 'From your reliable cards' : 'The Grimoire'}
    </span>
    ${inst ? html`<div class="draw-top-actions">
      <button type="button" class=${'icon-btn' + (pinned ? ' pinned' : '')} aria-pressed=${pinned ? 'true' : 'false'}
        onClick=${() => act.togglePin(inst.id)} aria-label=${pinned ? 'Unpin from reliable cards' : 'Pin as a reliable card'} title=${pinned ? 'Pinned as reliable' : 'Pin as reliable'}>
        <${Icon} name=${pinned ? 'starFill' : 'star'}/>
      </button>
      <div class="menu-wrap">
        <button type="button" class="icon-btn" aria-haspopup="menu" aria-expanded=${menu ? 'true' : 'false'} onClick=${() => setMenu(!menu)} aria-label="More options">
          <${Icon} name="more"/>
        </button>
        ${menu && html`<div class="menu" role="menu">
          <button type="button" role="menuitem" class="menu-item danger" onClick=${() => { setMenu(false); act.ban(inst.id); }}>
            <${Icon} name="ban" size=${18}/> Never show this card again
          </button>
        </div>`}
      </div>
    </div>` : html`<span class="draw-top-actions"></span>`}
  </div>`;
}

function CardStage({ a, s }) {
  const inst = a.instance;
  const [why, setWhy] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [adaptOpen, setAdaptOpen] = useState(false);
  useEffect(() => {
    setSkipping(false);
    setWhy(false);
    const h = document.getElementById('card-title');
    if (h) h.focus({ preventScroll: true });
  }, [a.revealId]);
  const card = act.cardById(inst.id);
  const adaptOpts = card ? adaptOptions(inst, card, { ctx: a.ctx, rules: s.prefs.rules, banned: s.prefs.banned, session: a.round, now: new Date() }) : [];
  const ctxLine = a.chaos
    ? `${a.ctx.mode === 'stuck' ? 'Get unstuck' : 'Surprise me'}, ${WEIRD[a.ctx.weird].label.toLowerCase()}, within your ${a.ctx.time} min`
    : null;

  return html`<section class="draw" aria-label="Your card">
    <${TopBar} a=${a} s=${s} inst=${inst}/>
    <div class="flip-stage" key=${a.revealId}>
      <div class="flip">
        <div class="flip-back" aria-hidden="true">
          <img src="icons/emblem-192.png" alt="" width="96" height="96"/>
        </div>
        <div class="flip-front">
          <${CardFace} inst=${inst} ctx=${a.ctx}
            extra=${html`${a.coins && html`<${Coins} coins=${a.coins}/>`}${ctxLine && html`<p class="chaos-line"><${Icon} name="dice" size=${15}/> ${ctxLine}</p>`}`}/>
        </div>
      </div>
    </div>

    ${skipping ? html`<div class="skip-reasons" role="group" aria-label="Why skip this one? Optional">
      <p class="skip-q">Why skip this one?</p>
      <div class="pills">
        ${SKIP_REASONS.map((r) => html`<button type="button" class="pill" onClick=${() => act.another(r.key)}>${r.label}</button>`)}
      </div>
      <button type="button" class="link-btn" onClick=${() => setSkipping(false)}>Keep this card</button>
    </div>` : html`<div class="card-actions">
      <button type="button" class="btn btn-primary btn-lg" onClick=${act.start}><${Icon} name="play" size=${18}/> Start</button>
      <button type="button" class="btn btn-soft btn-lg" onClick=${() => setAdaptOpen(true)} disabled=${!adaptOpts.length}
        title=${adaptOpts.length ? '' : 'No other versions fit your rules right now'}><${Icon} name="wand" size=${18}/> Adapt</button>
      <button type="button" class="btn btn-soft btn-lg" onClick=${() => setSkipping(true)}><${Icon} name="shuffle" size=${18}/> Another</button>
    </div>`}

    <div class="why-wrap">
      <button type="button" class="link-btn" aria-expanded=${why ? 'true' : 'false'} aria-controls="why-panel" onClick=${() => setWhy(!why)}>
        <${Icon} name="info" size=${16}/> Why this card?
      </button>
      ${why && html`<${WhyPanel} why=${a.why} inst=${inst}/>`}
    </div>

    <${Sheet} open=${adaptOpen} onClose=${() => setAdaptOpen(false)} title="Adapt this card">
      <p class="sheet-lead">Keep the idea, change how you do it.</p>
      <div class="adapt-list">
        ${adaptOpts.map((o) => html`<button type="button" class="adapt-opt" onClick=${() => { setAdaptOpen(false); act.adapt(o.key); }}>
          <span>${o.label}</span><${Icon} name="chevron" size=${16}/>
        </button>`)}
      </div>
    </${Sheet}>
  </section>`;
}

function Crossroads({ a }) {
  return html`<section class="draw" aria-labelledby="cross-title">
    <${TopBar} a=${a} s=${{ prefs: { pins: [] } }} inst=${null}/>
    <div class="panel crossroads">
      <h2 id="cross-title" class="display">Three skips. Change course?</h2>
      <p>The grimoire can shrink the challenge, try a completely different kind of move, or let you go.</p>
      <div class="stack">
        <button type="button" class="btn btn-primary btn-lg" onClick=${() => act.crossroads('smaller')}>A smaller challenge</button>
        <button type="button" class="btn btn-soft btn-lg" onClick=${() => act.crossroads('different')}>A different direction</button>
        <button type="button" class="btn btn-ghost btn-lg" onClick=${() => act.crossroads('stop')}>Stop for now</button>
      </div>
    </div>
  </section>`;
}

const NEED_PHRASES = {
  outside: 'need you to go outside', move: 'need you to move around', talk: 'need you to talk out loud',
  sound: 'need you to make sound', camera: 'need the camera',
};

function reasonText(key, n, ctx, roundLimited) {
  const cards = n === 1 ? '1 card' : `${n} cards`;
  if (key === 'banned') return `${cards} ${n === 1 ? 'is' : 'are'} on your never-show list`;
  if (key === 'time') return `${cards} need more than your ${ctx.time} minutes${roundLimited ? ' or this round’s limit' : ''}`;
  if (key === 'energy') return `${cards} need more energy than you have${roundLimited ? ' or this round allows' : ''}`;
  if (key === 'setting') return `${cards} don't work ${SETTINGS[ctx.setting].label.toLowerCase()}`;
  if (key === 'quiet') return `${cards} ${n === 1 ? 'is' : 'are'} too lively for quiet hours`;
  if (key.startsWith('comfort:')) return `${cards} ${NEED_PHRASES[key.slice(8)]}`;
  return `${cards} don't fit`;
}

function Empty({ a, s }) {
  const d = a.diagnosis || { counts: {}, total: 0 };
  const entries = Object.entries(d.counts).sort((x, y) => y[1] - x[1]);
  const comfort = entries.some(([k]) => k.startsWith('comfort:') || k === 'quiet');
  const stuck = a.ctx.mode === 'stuck';
  return html`<section class="draw" aria-labelledby="empty-title">
    <${TopBar} a=${a} s=${s} inst=${null}/>
    <div class="panel empty">
      <h2 id="empty-title" class="display">${d.reliable ? 'None of your reliable cards fit right now' : 'Nothing in the grimoire fits right now'}</h2>
      <p>The grimoire never breaks your rules to find a card. Here's what ruled things out:</p>
      ${entries.length ? html`<ul class="reasons">${entries.map(([k, n]) => html`<li>${reasonText(k, n, a.ctx, d.sessionLimited)}</li>`)}</ul>`
        : html`<p class="muted">There are no cards here yet.</p>`}
      <div class="stack">
        ${!d.reliable && stuck && !a.round.anyCategory && html`<button type="button" class="btn btn-primary" onClick=${() => act.widen('category')}>Look in every category</button>`}
        ${(d.counts.time || 0) > 0 && a.ctx.time < 60 && html`<button type="button" class="btn btn-soft" onClick=${() => act.widen('time')}>I have a bit more time</button>`}
        ${(d.counts.energy || 0) > 0 && a.ctx.energy < 3 && html`<button type="button" class="btn btn-soft" onClick=${() => act.widen('energy')}>I have a bit more energy</button>`}
        ${d.sessionLimited && html`<button type="button" class="btn btn-soft" onClick=${() => act.widen('round')}>Forget this round's skips</button>`}
        ${comfort && html`<button type="button" class="btn btn-ghost" onClick=${() => { act.closeActive(); act.setTab('settings'); }}>Review comfort rules</button>`}
        <button type="button" class="btn btn-ghost" onClick=${act.closeActive}>Back</button>
      </div>
    </div>
  </section>`;
}
