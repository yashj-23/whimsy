import { html } from '../vendor/preact-htm.js';
import { useApp } from '../state.js';
import * as act from '../actions.js';
import { Segmented, Orbs, Pills } from '../ui.js';
import { Icon } from '../icons.js';
import { CATEGORIES, SNAGS, INTENTS, TIMES, ENERGY, SETTINGS, WEIRD, TEMP_CONTEXT_HOURS } from '../constants.js';

const MODE_OPTS = [
  { value: 'stuck', label: 'Get unstuck' },
  { value: 'bored', label: 'Surprise me' },
];
const CAT_OPTS = Object.entries(CATEGORIES).map(([value, c]) => ({ value, label: c.short || c.label, color: c.color }));
const INTENT_OPTS = Object.entries(INTENTS).map(([value, c]) => ({ value, label: c.label, color: c.color }));
const SNAG_OPTS = Object.entries(SNAGS).map(([value, s]) => ({ value, label: s.label }));
const TIME_OPTS = TIMES.map((t) => ({ value: t, label: `${t} min` }));
const ENERGY_OPTS = [{ value: 1, label: 'Low' }, { value: 2, label: 'Normal' }, { value: 3, label: 'High' }];
const SETTING_OPTS = [{ value: 'desk', label: 'Desk' }, { value: 'home', label: 'Home' }, { value: 'out', label: 'Out' }];
const SETTING_SHORT = { desk: 'Desk', home: 'Home', out: 'Out' };
const WEIRD_OPTS = [1, 2, 3, 'fate'].map((v) => ({ value: v, label: WEIRD[v].label }));

export function Home() {
  const s = useApp();
  const { ctx } = s.prefs;
  const open = s.prefs.rightNowOpen;
  const stuck = ctx.mode === 'stuck';
  const pins = s.prefs.pins.filter((id) => act.cardById(id));

  return html`<section class="home" aria-labelledby="home-title">
    <header class="home-head">
      <h1 id="home-title" class="display">What do you need?</h1>
    </header>

    <${Segmented} options=${MODE_OPTS} value=${ctx.mode} onChange=${(mode) => act.setCtx({ mode })} label="Mode" size="lg" className="mode-seg"/>

    ${stuck ? html`
      <div class="field">
        <h2 class="field-label" id="cat-label">What are you working on?</h2>
        <${Orbs} options=${CAT_OPTS} value=${ctx.cat} onChange=${(cat) => act.setCtx({ cat })} label="Category"/>
      </div>
      <div class="field">
        <h2 class="field-label">What's the snag?</h2>
        <${Pills} options=${SNAG_OPTS} value=${ctx.snag} onChange=${(snag) => act.setCtx({ snag })} label="Snag"/>
        <p class="field-hint">${SNAGS[ctx.snag].hint}</p>
      </div>
    ` : html`
      <div class="field">
        <h2 class="field-label">What kind of break?</h2>
        <${Orbs} options=${INTENT_OPTS} value=${ctx.intent} onChange=${(intent) => act.setCtx({ intent })} label="Kind of break"/>
      </div>
    `}

    <div class=${'panel right-now' + (open ? ' open' : '')}>
      <button type="button" class="right-now-head" aria-expanded=${open ? 'true' : 'false'} aria-controls="right-now-body"
        onClick=${() => act.setPrefs({ rightNowOpen: !open })}>
        <span class="right-now-title">Right now</span>
        <span class="right-now-summary">
          <span class="tag">${ctx.time} min</span>
          <span class="tag">${ENERGY[ctx.energy].label}</span>
          <span class="tag">${SETTING_SHORT[ctx.setting]}</span>
          <span class="tag tag-weird" style=${`--c:${WEIRD[ctx.weird].color}`}>${WEIRD[ctx.weird].label}</span>
        </span>
        <span class="right-now-change">${open ? 'Done' : 'Change'}<${Icon} name=${open ? 'chevronDown' : 'chevron'} size=${16}/></span>
      </button>
      ${s.ctxReset && html`<p class="note-reset" role="status">It's been a while, so time, energy and place went back to the usual. Check they still fit.</p>`}
      ${open && html`<div class="right-now-body" id="right-now-body">
        <div class="rn-row">
          <span class="rn-label" id="rn-time">Time I have</span>
          <${Segmented} options=${TIME_OPTS} value=${ctx.time} onChange=${(time) => act.setCtx({ time })} label="Time I have" size="sm"/>
        </div>
        <div class="rn-row">
          <span class="rn-label">Energy</span>
          <${Segmented} options=${ENERGY_OPTS} value=${ctx.energy} onChange=${(energy) => act.setCtx({ energy })} label="Energy" size="sm"/>
        </div>
        <div class="rn-row">
          <span class="rn-label">Where I am</span>
          <${Segmented} options=${SETTING_OPTS} value=${ctx.setting} onChange=${(setting) => act.setCtx({ setting })} label="Where I am" size="sm"/>
        </div>
        <div class="rn-row">
          <span class="rn-label">Weirdness</span>
          <${Segmented} options=${WEIRD_OPTS} value=${ctx.weird} onChange=${(weird) => act.setCtx({ weird })} label="Weirdness" size="sm"/>
        </div>
        <p class="rn-hint">${WEIRD[ctx.weird].hint}. Time, energy and place reset after ${TEMP_CONTEXT_HOURS} hours.</p>
      </div>`}
    </div>

    <div class="cta">
      <button type="button" class="grimoire-btn" onClick=${() => act.openGrimoire()}>
        <span class="grimoire-stars" aria-hidden="true"></span>
        <span class="grimoire-label">Open the Grimoire</span>
      </button>
      <div class="cta-secondary">
        <button type="button" class="btn btn-ghost" onClick=${() => act.openGrimoire({ chaos: true })}>
          <${Icon} name="dice" size=${18}/> Let chaos choose
        </button>
        ${pins.length > 0 && html`<button type="button" class="btn btn-ghost" onClick=${() => act.openGrimoire({ reliable: true })}>
          <${Icon} name="starFill" size=${18}/> Something reliable
        </button>`}
      </div>
    </div>
  </section>`;
}
