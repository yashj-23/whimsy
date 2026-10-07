import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { useApp } from '../state.js';
import * as act from '../actions.js';
import { fmtDuration, useId } from '../ui.js';
import { Icon } from '../icons.js';
import { RATINGS } from '../constants.js';
import { plain } from '../dice.js';

export function Reflect() {
  const s = useApp();
  const a = s.active;
  const stuck = a.ctx.mode === 'stuck';
  const [rating, setRating] = useState(null);
  const [note, setNote] = useState('');
  const [nextMove, setNextMove] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoURL, setPhotoURL] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const nextId = useId('next');
  const noteId = useId('note');
  const headRef = useRef(null);

  useEffect(() => { if (headRef.current) headRef.current.focus(); }, []);
  useEffect(() => () => { if (photoURL) URL.revokeObjectURL(photoURL); }, [photoURL]);

  const secs = Math.round(act.elapsedMs(a) / 1000);
  const statusLine = a.status === 'stopped'
    ? `You stopped after ${fmtDuration(secs)}. That still counts.`
    : `Done in ${fmtDuration(secs)}.`;
  const detour = !stuck && a.ctx.time <= 5;

  async function onPhoto(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setErr('');
    try {
      const blob = await act.compressPhoto(f);
      if (photoURL) URL.revokeObjectURL(photoURL);
      setPhoto(blob);
      setPhotoURL(URL.createObjectURL(blob));
    } catch (x) {
      setErr("That photo couldn't be added. Try a different one.");
    }
  }

  async function save(then, skip = false) {
    if (busy) return;
    setBusy(true);
    await act.saveReflection(skip ? {} : { rating, note, nextMove, photo }, then);
  }

  return html`<section class="reflect" aria-labelledby="reflect-title">
    <div class="panel reflect-panel">
      <p class="reflect-card">${plain(a.instance.title)}</p>
      <h2 id="reflect-title" class="display" tabindex="-1" ref=${headRef}>${stuck ? 'Are you less stuck?' : 'Was that worth the break?'}</h2>
      <p class="muted">${statusLine}</p>

      <div class="rating" role="radiogroup" aria-labelledby="reflect-title">
        ${RATINGS[stuck ? 'stuck' : 'bored'].map((r) => html`<button type="button" role="radio" aria-checked=${rating === r.v ? 'true' : 'false'}
          class=${'rate' + (rating === r.v ? ' on' : '') + ` rate-${r.v < 0 ? 'low' : r.v === 1 ? 'mid' : 'high'}`}
          onClick=${() => setRating(rating === r.v ? null : r.v)}>${r.label}</button>`)}
      </div>

      ${stuck ? html`
        <label class="input-label" for=${nextId}>Your next move</label>
        <input id=${nextId} class="input" type="text" maxlength="160" placeholder="Optional, one line" value=${nextMove}
          onInput=${(e) => setNextMove(e.target.value)} enterkeyhint="done"
          onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); save('home'); } }}/>
      ` : html`
        <label class="input-label" for=${noteId}>Anything to remember?</label>
        <textarea id=${noteId} class="input" rows="3" maxlength="1000" placeholder="Optional" value=${note} onInput=${(e) => setNote(e.target.value)}></textarea>
        <div class="photo-row">
          ${photoURL ? html`<div class="photo-thumb">
              <img src=${photoURL} alt="Your photo for this session"/>
              <button type="button" class="icon-btn" onClick=${() => { setPhoto(null); setPhotoURL(null); }} aria-label="Remove photo"><${Icon} name="close" size=${16}/></button>
            </div>`
            : html`<button type="button" class="btn btn-soft" onClick=${() => fileRef.current && fileRef.current.click()}><${Icon} name="camera" size=${18}/> Add a photo</button>`}
          <input ref=${fileRef} type="file" accept="image/*" class="visually-hidden" tabindex="-1" aria-hidden="true" onChange=${onPhoto}/>
        </div>
        ${err && html`<p class="error" role="alert">${err}</p>`}
      `}

      ${detour && html`<p class="detour">That was your ${a.ctx.time}-minute detour. Finish here or keep exploring?</p>`}

      <div class="stack">
        ${stuck ? html`
          <button type="button" class="btn btn-primary btn-lg" onClick=${() => save('home')} disabled=${busy}>Back to my task</button>
          ${rating === -1 && html`<button type="button" class="btn btn-soft btn-lg" onClick=${() => save('different')} disabled=${busy}>Try a different kind of move</button>`}
        ` : html`
          <button type="button" class="btn btn-primary btn-lg" onClick=${() => save('home')} disabled=${busy}>Finish</button>
          <button type="button" class="btn btn-soft btn-lg" onClick=${() => save('another')} disabled=${busy}>${detour ? 'Keep exploring' : 'Draw another'}</button>
        `}
        <button type="button" class="link-btn" onClick=${() => save('home', true)} disabled=${busy}>Skip and save without answers</button>
      </div>
    </div>
  </section>`;
}
