import { html, useState, useRef, useMemo } from '../vendor/preact-htm.js';
import { useApp } from '../state.js';
import * as act from '../actions.js';
import { Toggle, Segmented, Pills, Sheet, ConfirmButton, useId } from '../ui.js';
import { Icon } from '../icons.js';
import { BackupButton } from '../backup-button.js';
import { isNativeApp, isMacApp } from '../native.js';
import { DECK } from '../deck.js';
import {
  NEEDS, CATEGORIES, SNAGS, INTENTS, WEIRD, TIMES, SETTINGS, EFFORT, MAX_PINS, APP_VERSION,
} from '../constants.js';
import { plain } from '../dice.js';

function titleOf(id) {
  const c = act.cardById(id);
  return c ? plain(c.title.replace(/\{(\w+)\}/g, '…')) : 'A card that no longer exists';
}

function Section({ title, lead, children, id }) {
  return html`<section class="panel settings-section" aria-labelledby=${id}>
    <h2 class="panel-title" id=${id}>${title}</h2>
    ${lead && html`<p class="muted section-lead">${lead}</p>`}
    ${children}
  </section>`;
}

const BLANK = {
  mode: 'stuck', title: '', action: '', finish: '', bridge: '', cats: [], snags: [], intents: [],
  weird: 1, effort: 1, mins: 5, where: ['desk', 'home', 'out'], needs: [],
};

function CardForm({ initial, onDone }) {
  const [c, setC] = useState({ ...BLANK, ...(initial || {}) });
  const [err, setErr] = useState('');
  const up = (patch) => setC({ ...c, ...patch });
  const ids = { title: useId('f'), action: useId('f'), finish: useId('f'), bridge: useId('f') };
  const stuck = c.mode === 'stuck';
  async function submit(e) {
    e.preventDefault();
    if (!c.title.trim()) return setErr('Give the card a title.');
    if (!c.action.trim()) return setErr('Write what to do.');
    if (stuck && !c.cats.length) return setErr('Pick at least one category, or "Any".');
    if (!stuck && !c.intents.length) return setErr('Pick at least one kind of break.');
    if (!c.where.length) return setErr('Pick at least one place it works.');
    await act.saveCustomCard({
      ...c,
      title: c.title.trim(), action: c.action.trim(), finish: c.finish.trim(), bridge: c.bridge.trim(),
    });
    onDone();
  }
  const catOpts = [{ value: 'any', label: 'Any' }].concat(Object.entries(CATEGORIES).map(([value, x]) => ({ value, label: x.label })));
  const snagOpts = Object.entries(SNAGS).filter(([k]) => k !== 'unsure').map(([value, x]) => ({ value, label: x.label }));
  const intentOpts = [
    { value: 'make', label: 'Make something' }, { value: 'explore', label: 'Explore' }, { value: 'reset', label: 'Reset' }, { value: 'play', label: 'Just for fun' },
  ];
  return html`<form class="card-form" onSubmit=${submit} novalidate>
    <div class="form-row">
      <span class="input-label">Use it when I want to</span>
      <${Segmented} options=${[{ value: 'stuck', label: 'Get unstuck' }, { value: 'bored', label: 'Be surprised' }]} value=${c.mode} onChange=${(mode) => up({ mode })} label="Mode" size="sm"/>
    </div>
    <label class="input-label" for=${ids.title}>Title</label>
    <input id=${ids.title} class="input" type="text" maxlength="60" value=${c.title} onInput=${(e) => up({ title: e.target.value })} placeholder="Short and memorable"/>
    <label class="input-label" for=${ids.action}>What to do</label>
    <textarea id=${ids.action} class="input" rows="3" maxlength="400" value=${c.action} onInput=${(e) => up({ action: e.target.value })} placeholder="One clear instruction"></textarea>
    <label class="input-label" for=${ids.finish}>Finish line <span class="muted">(optional)</span></label>
    <input id=${ids.finish} class="input" type="text" maxlength="160" value=${c.finish} onInput=${(e) => up({ finish: e.target.value })} placeholder="How you know you're done"/>
    ${stuck ? html`
      <label class="input-label" for=${ids.bridge}>Bridge back <span class="muted">(optional)</span></label>
      <input id=${ids.bridge} class="input" type="text" maxlength="160" value=${c.bridge} onInput=${(e) => up({ bridge: e.target.value })} placeholder="How to carry it back to the real task"/>
      <div class="form-row"><span class="input-label">Categories</span>
        <${Pills} multi=${true} options=${catOpts} value=${c.cats} onChange=${(cats) => up({ cats: cats.includes('any') && !c.cats.includes('any') ? ['any'] : cats.filter((x) => x !== 'any' || cats.length === 1) })} label="Categories"/></div>
      <div class="form-row"><span class="input-label">Snags it helps with <span class="muted">(none means any)</span></span>
        <${Pills} multi=${true} options=${snagOpts} value=${c.snags} onChange=${(snags) => up({ snags })} label="Snags"/></div>
    ` : html`
      <div class="form-row"><span class="input-label">Kind of break</span>
        <${Pills} multi=${true} options=${intentOpts} value=${c.intents} onChange=${(intents) => up({ intents })} label="Kind of break"/></div>
    `}
    <div class="form-row"><span class="input-label">Weirdness</span>
      <${Segmented} options=${[1, 2, 3].map((v) => ({ value: v, label: WEIRD[v].label }))} value=${c.weird} onChange=${(weird) => up({ weird })} label="Weirdness" size="sm"/></div>
    <div class="form-row"><span class="input-label">Effort</span>
      <${Segmented} options=${[1, 2, 3].map((v) => ({ value: v, label: EFFORT[v].replace(' effort', '') }))} value=${c.effort} onChange=${(effort) => up({ effort })} label="Effort" size="sm"/></div>
    <div class="form-row"><span class="input-label">Takes about</span>
      <${Segmented} options=${TIMES.map((t) => ({ value: t, label: `${t} min` }))} value=${c.mins} onChange=${(mins) => up({ mins })} label="Minutes" size="sm"/></div>
    <div class="form-row"><span class="input-label">Works</span>
      <${Pills} multi=${true} options=${Object.entries(SETTINGS).map(([value, x]) => ({ value, label: x.label }))} value=${c.where} onChange=${(where) => up({ where })} label="Where it works"/></div>
    <div class="form-row"><span class="input-label">It needs me to</span>
      <${Pills} multi=${true} options=${[
        { value: 'outside', label: 'Go outside' }, { value: 'move', label: 'Move around' }, { value: 'talk', label: 'Talk out loud' },
        { value: 'sound', label: 'Make sound' }, { value: 'camera', label: 'Use the camera' }]}
        value=${c.needs} onChange=${(needs) => up({ needs })} label="Needs"/></div>
    ${err && html`<p class="error" role="alert">${err}</p>`}
    <div class="stack">
      <button type="submit" class="btn btn-primary btn-lg">${initial && initial.id ? 'Save changes' : 'Add to my grimoire'}</button>
    </div>
  </form>`;
}

function Browse() {
  const s = useApp();
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('stuck');
  const id = useId('search');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return act.fullDeck().filter((c) => c.mode === mode && (!needle || (c.title + ' ' + c.action).toLowerCase().includes(needle)));
  }, [q, mode, s.customCards]);
  return html`<div class="browse">
    <div class="browse-tools">
      <${Segmented} options=${[{ value: 'stuck', label: 'Get unstuck' }, { value: 'bored', label: 'Surprise me' }]} value=${mode} onChange=${setMode} label="Which cards" size="sm"/>
      <label class="visually-hidden" for=${id}>Search cards</label>
      <input id=${id} class="input" type="search" placeholder="Search cards" value=${q} onInput=${(e) => setQ(e.target.value)}/>
    </div>
    <p class="muted">${list.length} ${list.length === 1 ? 'card' : 'cards'}. Dice words show as … until drawn.</p>
    <ul class="browse-list">
      ${list.map((c) => {
        const pinned = s.prefs.pins.includes(c.id);
        const banned = s.prefs.banned.includes(c.id);
        return html`<li class=${'browse-item' + (banned ? ' banned' : '')}>
          <div class="browse-text">
            <span class="browse-title">${c.title.replace(/\{(\w+)\}/g, '…')}${c.custom ? html` <span class="tag">Yours</span>` : ''}</span>
            <span class="browse-action">${c.action.replace(/\{(\w+)\}/g, '…')}</span>
            <span class="browse-meta">${WEIRD[c.weird].label}, ${c.mins} min${c.mode === 'stuck' ? `, ${c.cats.includes('any') ? 'any category' : c.cats.map((k) => CATEGORIES[k].label).join(', ')}` : ''}</span>
          </div>
          <div class="browse-btns">
            <button type="button" class=${'icon-btn' + (pinned ? ' pinned' : '')} aria-pressed=${pinned ? 'true' : 'false'} onClick=${() => act.togglePin(c.id)} aria-label=${pinned ? `Unpin ${c.title}` : `Pin ${c.title} as reliable`}>
              <${Icon} name=${pinned ? 'starFill' : 'star'} size=${18}/></button>
            <button type="button" class=${'icon-btn' + (banned ? ' banned-on' : '')} aria-pressed=${banned ? 'true' : 'false'} onClick=${() => (banned ? act.unban(c.id) : act.ban(c.id))} aria-label=${banned ? `Bring back ${c.title}` : `Never show ${c.title}`}>
              <${Icon} name="ban" size=${18}/></button>
          </div>
        </li>`;
      })}
    </ul>
  </div>`;
}

export function Settings() {
  const s = useApp();
  const { rules } = s.prefs;
  const [editing, setEditing] = useState(null); // null | {} (new) | card
  const [browse, setBrowse] = useState(false);
  const [restoreInfo, setRestoreInfo] = useState(null);
  const [restoreErr, setRestoreErr] = useState('');
  const fileRef = useRef(null);
  const fromId = useId('qf');
  const toId = useId('qt');
  const pins = s.prefs.pins;
  const banned = s.prefs.banned;

  async function onRestoreFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setRestoreErr('');
    try {
      setRestoreInfo(await act.readBackupFile(f));
    } catch (x) {
      setRestoreErr(x.message || "That file couldn't be read.");
    }
  }

  async function doRestore() {
    try {
      await act.restore(restoreInfo.data);
      setRestoreInfo(null);
    } catch (x) {
      setRestoreErr(x.message || 'Restore failed. Nothing was changed.');
      setRestoreInfo(null);
    }
  }

  return html`<section class="settings" aria-labelledby="settings-title">
    <header class="page-head">
      <h1 id="settings-title" class="display">Settings</h1>
      <p class="muted">Rules the grimoire always follows, your cards, and your data.</p>
    </header>

    <${Section} title="Comfort rules" id="sec-rules" lead="The grimoire never breaks these, even in chaos. Cards that would are swapped for a version that fits, or skipped.">
      ${Object.entries(NEEDS).map(([k, n]) => html`<${Toggle} key=${k} checked=${!!rules[k]} onChange=${(v) => act.setRules({ [k]: v })} label=${n.rule}/>`)}
      <div class="divider"></div>
      <${Toggle} checked=${rules.quiet.on} onChange=${(on) => act.setRules({ quiet: { ...rules.quiet, on } })}
        label="Quiet hours" hint="Only calm, silent, indoor cards during these hours."/>
      ${rules.quiet.on && html`<div class="time-range">
        <label for=${fromId}>From</label>
        <input id=${fromId} class="input input-time" type="time" value=${rules.quiet.from} onChange=${(e) => act.setRules({ quiet: { ...rules.quiet, from: e.target.value || '22:00' } })}/>
        <label for=${toId}>to</label>
        <input id=${toId} class="input input-time" type="time" value=${rules.quiet.to} onChange=${(e) => act.setRules({ quiet: { ...rules.quiet, to: e.target.value || '07:00' } })}/>
      </div>`}
    </${Section}>

    <${Section} title="Reliable cards" id="sec-pins" lead=${`Pin up to ${MAX_PINS} cards that always help, with the star on any card. "Something reliable" draws only from these.`}>
      ${pins.length === 0 ? html`<p class="muted">No pinned cards yet.</p>` : html`<ul class="simple-list">
        ${pins.map((id) => html`<li><span>${titleOf(id)}</span>
          <button type="button" class="btn btn-ghost btn-sm" onClick=${() => act.togglePin(id)}>Unpin</button></li>`)}
      </ul>`}
    </${Section}>

    <${Section} title="Never show" id="sec-ban" lead="Cards you've banned. Bring any of them back here.">
      ${banned.length === 0 ? html`<p class="muted">No banned cards.</p>` : html`<ul class="simple-list">
        ${banned.map((id) => html`<li><span>${titleOf(id)}</span>
          <button type="button" class="btn btn-ghost btn-sm" onClick=${() => act.unban(id)}>Bring back</button></li>`)}
      </ul>`}
    </${Section}>

    <${Section} title="Your cards" id="sec-own" lead="Write your own cards. They're drawn alongside the built-in ones and follow the same rules.">
      ${s.customCards.length > 0 && html`<ul class="simple-list">
        ${s.customCards.map((c) => html`<li><span>${c.title} <span class="tag">${c.mode === 'stuck' ? 'Unstuck' : 'Surprise'}</span></span>
          <span class="row-btns">
            <button type="button" class="icon-btn" onClick=${() => setEditing(c)} aria-label=${`Edit ${c.title}`}><${Icon} name="edit" size=${18}/></button>
            <${ConfirmButton} onConfirm=${() => act.deleteCustomCard(c.id)} className="icon-btn danger-icon" confirmLabel="Delete?">
              <${Icon} name="trash" size=${18} label=${`Delete ${c.title}`}/>
            </${ConfirmButton}>
          </span></li>`)}
      </ul>`}
      <div class="row-btns">
        <button type="button" class="btn btn-soft" onClick=${() => setEditing({})}><${Icon} name="plus" size=${18}/> Add a card</button>
        <button type="button" class="btn btn-ghost" onClick=${() => setBrowse(true)}>Browse every card</button>
      </div>
      <p class="muted fine">${DECK.length} built-in cards, ${s.customCards.length} of yours. Browsing spoils some surprises.</p>
    </${Section}>

    <${Section} title="Feel" id="sec-feel">
      <${Toggle} checked=${s.prefs.sound} onChange=${(sound) => act.setPrefs({ sound })} label="Sounds" hint="A soft shimmer when a card appears, and a chime when time is up."/>
      <${Toggle} checked=${s.prefs.haptics} onChange=${(haptics) => act.setPrefs({ haptics })} label="Vibration" hint="On phones that support it."/>
      <${Toggle} checked=${s.prefs.keepAwake} onChange=${(keepAwake) => act.setPrefs({ keepAwake })} label="Keep the screen on during a countdown" hint="So the chime plays when time is up. Turns off when you pause or finish."/>
      <div class="form-row">
        <span class="input-label">Motion</span>
        <${Segmented} options=${[{ value: 'system', label: 'Match device' }, { value: 'reduce', label: 'Reduced' }, { value: 'full', label: 'Full' }]}
          value=${s.prefs.motion} onChange=${(motion) => act.setPrefs({ motion })} label="Motion" size="sm"/>
      </div>
    </${Section}>

    <${Section} title="Your data" id="sec-data">
      <p class="data-line"><${Icon} name="shield" size=${18}/> Everything is stored only on this device, in this app. Each device keeps its own journal.</p>
      ${!s.storageOk && html`<p class="error" role="alert">Storage isn't available here (private browsing?). Nothing will be kept after you close the app.</p>`}
      <p class="muted">${s.prefs.lastBackupAt ? `Last backup: ${new Date(s.prefs.lastBackupAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.` : 'No backup yet.'} Backups include your journal, photos, cards and settings. To move your journal to another device, back up here and restore there.</p>
      <div class="row-btns">
        <${BackupButton}/>
        <button type="button" class="btn btn-soft" onClick=${() => fileRef.current && fileRef.current.click()}><${Icon} name="upload" size=${18}/> Restore</button>
        <input ref=${fileRef} type="file" accept="application/json,.json" class="visually-hidden" tabindex="-1" aria-hidden="true" onChange=${onRestoreFile}/>
      </div>
      ${restoreErr && html`<p class="error" role="alert">${restoreErr}</p>`}
      <div class="divider"></div>
      <p class="muted">Delete removes your journal, photos, cards and settings from this device. It can't be undone.</p>
      <${ConfirmButton} onConfirm=${act.wipeEverything} confirmLabel="Tap again to delete everything"><${Icon} name="trash" size=${18}/> Delete everything</${ConfirmButton}>
    </${Section}>

    ${isNativeApp ? html`<${Section} title="About" id="sec-install">
      <p class="data-line"><${Icon} name="check" size=${18}/> You're using the Whimsy app for ${isMacApp ? 'Mac' : 'Android'}.</p>
      <p class="muted fine">Whimsy ${APP_VERSION}. New versions are on the Releases page of github.com/yashj-23/whimsy.</p>
    </${Section}>` : html`<${Section} title="Install Whimsy" id="sec-install">
      ${s.installed ? html`<p class="data-line"><${Icon} name="check" size=${18}/> You're using the installed app.</p>`
        : html`<p class="muted">Whimsy works best installed. It opens in its own window, works offline, and keeps its data separate from your browser.</p>`}
      <div class="install-grid">
        <div><h3><${Icon} name="laptop" size=${18}/> MacBook</h3><p>In Safari, choose File, then Add to Dock. In Chrome, click the install icon at the right of the address bar.</p></div>
        <div><h3><${Icon} name="phone" size=${18}/> iPhone</h3><p>In Safari, tap Share, then Add to Home Screen.</p></div>
        <div><h3><${Icon} name="phone" size=${18}/> Android</h3><p>In Chrome, open the menu, then Install app.</p></div>
      </div>
      <p class="muted fine">Whimsy ${APP_VERSION}</p>
    </${Section}>`}

    <${Sheet} open=${!!editing} onClose=${() => setEditing(null)} title=${editing && editing.id ? 'Edit card' : 'New card'} wide=${true}>
      ${editing && html`<${CardForm} initial=${editing} onDone=${() => setEditing(null)}/>`}
    </${Sheet}>
    <${Sheet} open=${browse} onClose=${() => setBrowse(false)} title="Every card" wide=${true}>
      <${Browse}/>
    </${Sheet}>
    <${Sheet} open=${!!restoreInfo} onClose=${() => setRestoreInfo(null)} title="Restore this backup?">
      ${restoreInfo && html`<p>This backup has ${restoreInfo.summary.sessions} journal ${restoreInfo.summary.sessions === 1 ? 'entry' : 'entries'}, ${restoreInfo.summary.photos} ${restoreInfo.summary.photos === 1 ? 'photo' : 'photos'} and ${restoreInfo.summary.cards} of your own ${restoreInfo.summary.cards === 1 ? 'card' : 'cards'}${restoreInfo.summary.exportedAt ? `, made ${new Date(restoreInfo.summary.exportedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.</p>
        <p class="muted">Restoring replaces everything currently on this device.</p>
        <div class="stack">
          <button type="button" class="btn btn-primary btn-lg" onClick=${doRestore}>Replace and restore</button>
          <button type="button" class="btn btn-ghost btn-lg" onClick=${() => setRestoreInfo(null)}>Cancel</button>
        </div>`}
    </${Sheet}>
  </section>`;
}
