import { html, useState, useEffect } from '../vendor/preact-htm.js';
import { useApp } from '../state.js';
import * as act from '../actions.js';
import { Segmented, ConfirmButton, fmtDuration, dayLabel, timeLabel, DiceText } from '../ui.js';
import { Icon } from '../icons.js';
import { BackupButton } from '../backup-button.js';
import { CATEGORIES, INTENTS, FLAVORS, RATINGS, SKIP_REASONS, WEIRD } from '../constants.js';

const MODE_FILTER = [
  { value: 'all', label: 'All' },
  { value: 'stuck', label: 'Unstuck' },
  { value: 'bored', label: 'Surprise' },
];

function ratingLabel(s) {
  if (s.rating == null) return null;
  const r = RATINGS[s.mode].find((x) => x.v === s.rating);
  return r ? r.label : null;
}

function accent(s) {
  if (s.mode === 'stuck') return (CATEGORIES[s.ctx.cat] || {}).color || '#EE8579';
  return (INTENTS[s.ctx.intent] || INTENTS.any).color;
}

function contextLabel(s) {
  if (s.mode === 'stuck') return (CATEGORIES[s.ctx.cat] || {}).label || 'Unstuck';
  return s.ctx.intent && s.ctx.intent !== 'any' ? INTENTS[s.ctx.intent].label : 'Surprise';
}

function Photo({ id }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    let made = null;
    act.photoURL(id).then((u) => { made = u; if (alive) setUrl(u); else if (u) URL.revokeObjectURL(u); });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [id]);
  if (!url) return html`<div class="entry-photo placeholder" aria-hidden="true"></div>`;
  return html`<img class="entry-photo" src=${url} alt="Photo from this session"/>`;
}

function Entry({ s }) {
  const [open, setOpen] = useState(false);
  const r = ratingLabel(s);
  const good = s.rating != null && s.rating > 0;
  return html`<li class=${'entry' + (open ? ' open' : '')} style=${`--accent:${accent(s)}`}>
    <button type="button" class="entry-head" aria-expanded=${open ? 'true' : 'false'} onClick=${() => setOpen(!open)}>
      <span class="dot" aria-hidden="true"></span>
      <span class="entry-main">
        <span class="entry-title">${s.card.title.replace(/[⟦⟧]/g, '')}</span>
        <span class="entry-sub">${contextLabel(s)}, ${timeLabel(s.createdAt)}, ${fmtDuration(s.durationSec)}${s.status === 'stopped' ? ', stopped early' : ''}</span>
      </span>
      ${r && html`<span class=${'badge' + (good ? ' good' : s.rating < 0 ? ' low' : '')}>${r}</span>`}
    </button>
    ${(s.nextMove || s.note) && html`<p class="entry-note">${s.nextMove ? html`<strong>Next move:</strong> ${s.nextMove}` : s.note}</p>`}
    ${s.photoId && html`<${Photo} id=${s.photoId}/>`}
    ${open && html`<div class="entry-detail">
      <p class="entry-action"><${DiceText} text=${s.card.action}/></p>
      ${s.card.finish && html`<p class="muted"><strong>Finish line:</strong> <${DiceText} text=${s.card.finish}/></p>`}
      ${s.nextMove && s.note && html`<p>${s.note}</p>`}
      <p class="muted">${WEIRD[s.card.weird] ? WEIRD[s.card.weird].label : ''}${s.chaos ? ', chosen by chaos' : ''}${s.reliable ? ', a reliable card' : ''}</p>
      <${ConfirmButton} onConfirm=${() => act.deleteSession(s.id)} className="btn btn-danger btn-sm">
        <${Icon} name="trash" size=${16}/> Delete entry
      </${ConfirmButton}>
    </div>`}
  </li>`;
}

function insights(sessions, history) {
  const rated = sessions.filter((s) => s.rating != null);
  const groups = new Map();
  const add = (key, label, s) => {
    if (!groups.has(key)) groups.set(key, { label, helped: 0, rated: 0 });
    const g = groups.get(key);
    g.rated += 1;
    if (s.rating > 0) g.helped += 1;
  };
  for (const s of rated) {
    if (s.card.flavor && FLAVORS[s.card.flavor]) add('f:' + s.card.flavor, `${FLAVORS[s.card.flavor].plural} cards`, s);
    if (s.mode === 'stuck' && CATEGORIES[s.ctx.cat]) add('c:' + s.ctx.cat, `${CATEGORIES[s.ctx.cat].label} sessions`, s);
  }
  const rows = [...groups.values()].filter((g) => g.rated >= 2).sort((a, b) => (b.helped / b.rated) - (a.helped / a.rated) || b.rated - a.rated).slice(0, 5);
  const since = Date.now() - 60 * 86400000;
  const skips = {};
  for (const h of history) {
    if (h.outcome === 'skipped' && h.at >= since && h.reason && h.reason !== 'none') skips[h.reason] = (skips[h.reason] || 0) + 1;
  }
  const skipRows = Object.entries(skips).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, n]) => ({ label: (SKIP_REASONS.find((r) => r.key === k) || { label: k }).label, n }));
  const stopped = sessions.filter((s) => s.status === 'stopped').length;
  return { rows, skipRows, rated: rated.length, stopped };
}

export function Journal() {
  const s = useApp();
  const [mode, setMode] = useState('all');
  const [best, setBest] = useState(false);
  const list = s.sessions.filter((x) => (mode === 'all' || x.mode === mode) && (!best || (x.rating != null && x.rating >= 2)));
  const groups = [];
  for (const e of list) {
    const label = dayLabel(e.createdAt);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(e);
    else groups.push({ label, items: [e] });
  }
  const ins = insights(s.sessions, s.history);
  const backupDue = s.sessions.length >= 5 && (!s.prefs.lastBackupAt || Date.now() - s.prefs.lastBackupAt > 30 * 86400000);

  return html`<section class="journal" aria-labelledby="journal-title">
    <header class="page-head">
      <h1 id="journal-title" class="display">Journal</h1>
      <p class="muted">${s.sessions.length === 0 ? 'Every card you start is kept here.' : `${s.sessions.length} ${s.sessions.length === 1 ? 'session' : 'sessions'}, ${ins.rated} rated`}</p>
    </header>

    ${backupDue && html`<div class="panel nudge">
      <p>Your journal lives only on this device. A backup keeps it safe.</p>
      <${BackupButton} label="Back up now" className="btn btn-soft btn-sm" size=${16}/>
    </div>`}

    ${s.sessions.length > 0 && (ins.rows.length > 0 || ins.skipRows.length > 0) && html`<div class="panel insights">
      <h2 class="panel-title">What's working</h2>
      ${ins.rows.length > 0 ? html`<ul class="insight-list">
        ${ins.rows.map((g) => html`<li>
          <span>${g.label}</span>
          <span class="insight-bar" aria-hidden="true"><span style=${`width:${Math.round((g.helped / g.rated) * 100)}%`}></span></span>
          <span class="insight-num">helped ${g.helped} of ${g.rated}</span>
        </li>`)}
      </ul>` : html`<p class="muted">Rate a few more sessions and patterns will show up here.</p>`}
      ${ins.skipRows.length > 0 && html`<p class="muted skips-line">Why you skip cards lately: ${ins.skipRows.map((r) => `${r.label.toLowerCase()} (${r.n})`).join(', ')}.</p>`}
    </div>`}

    ${s.sessions.length > 0 && html`<div class="journal-filters">
      <${Segmented} options=${MODE_FILTER} value=${mode} onChange=${setMode} label="Show" size="sm"/>
      <button type="button" class=${'pill' + (best ? ' on' : '')} aria-pressed=${best ? 'true' : 'false'} onClick=${() => setBest(!best)}>
        <${Icon} name="sparkle" size=${15}/> Best only
      </button>
    </div>`}

    ${s.sessions.length === 0 ? html`<div class="panel empty-journal">
      <img src="icons/emblem-192.png" alt="" width="72" height="72"/>
      <p>Nothing here yet. Open the grimoire, start a card, and it will be kept here with how it went.</p>
      <button type="button" class="btn btn-primary" onClick=${() => act.setTab('home')}>Go to the grimoire</button>
    </div>` : list.length === 0 ? html`<p class="muted center">No sessions match this filter.</p>` : groups.map((g) => html`<div class="day">
      <h2 class="day-label">${g.label}</h2>
      <ul class="entries">${g.items.map((e) => html`<${Entry} key=${e.id} s=${e}/>`)}</ul>
    </div>`)}
  </section>`;
}
