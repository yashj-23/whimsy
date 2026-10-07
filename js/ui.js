// Shared building blocks.
import { html, useEffect, useRef, useState } from './vendor/preact-htm.js';
import { segments } from './dice.js';
import { Icon } from './icons.js';

let idCounter = 0;
export function useId(prefix = 'w') {
  const ref = useRef(null);
  if (!ref.current) ref.current = `${prefix}-${++idCounter}`;
  return ref.current;
}

// Arrow keys move between options in a group, like native radio buttons.
function onRadioKeys(e, options, value, onChange) {
  const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  e.preventDefault();
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  let n = i;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % options.length;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + options.length) % options.length;
  if (e.key === 'Home') n = 0;
  if (e.key === 'End') n = options.length - 1;
  onChange(options[n].value);
  const group = e.currentTarget.closest('[role=radiogroup]');
  requestAnimationFrame(() => {
    const btn = group && group.querySelectorAll('[role=radio]')[n];
    if (btn) btn.focus();
  });
}

export function Segmented({ options, value, onChange, label, size = 'md', className = '' }) {
  return html`<div class=${`seg seg-${size} ${className}`} role="radiogroup" aria-label=${label}>
    ${options.map((o) => html`<button type="button" role="radio" aria-checked=${o.value === value ? 'true' : 'false'}
      tabindex=${o.value === value ? 0 : -1}
      class=${'seg-opt' + (o.value === value ? ' on' : '')}
      onClick=${() => onChange(o.value)}
      onKeyDown=${(e) => onRadioKeys(e, options, value, onChange)}>${o.label}</button>`)}
  </div>`;
}

export function Orbs({ options, value, onChange, label }) {
  return html`<div class="orbs" role="radiogroup" aria-label=${label}>
    ${options.map((o) => html`<button type="button" role="radio" aria-checked=${o.value === value ? 'true' : 'false'}
      tabindex=${o.value === value ? 0 : -1}
      class=${'orb' + (o.value === value ? ' on' : '')} style=${`--c:${o.color}`}
      onClick=${() => onChange(o.value)}
      onKeyDown=${(e) => onRadioKeys(e, options, value, onChange)}>
        <span class="orb-ball" aria-hidden="true"></span>
        <span class="orb-label">${o.label}</span>
      </button>`)}
  </div>`;
}

export function Pills({ options, value, onChange, label, multi = false }) {
  const isOn = (v) => (multi ? value.includes(v) : value === v);
  const toggle = (v) => {
    if (!multi) return onChange(v);
    onChange(value.includes(v) ? value.filter((x) => x !== v) : value.concat(v));
  };
  if (multi) {
    return html`<div class="pills" role="group" aria-label=${label}>
      ${options.map((o) => html`<button type="button" aria-pressed=${isOn(o.value) ? 'true' : 'false'}
        class=${'pill' + (isOn(o.value) ? ' on' : '')} onClick=${() => toggle(o.value)}>${o.label}</button>`)}
    </div>`;
  }
  return html`<div class="pills" role="radiogroup" aria-label=${label}>
    ${options.map((o) => html`<button type="button" role="radio" aria-checked=${isOn(o.value) ? 'true' : 'false'}
      tabindex=${isOn(o.value) ? 0 : -1}
      class=${'pill' + (isOn(o.value) ? ' on' : '')} onClick=${() => toggle(o.value)}
      onKeyDown=${(e) => onRadioKeys(e, options, value, onChange)}>${o.label}</button>`)}
  </div>`;
}

export function Toggle({ checked, onChange, label, hint }) {
  const id = useId('tg');
  return html`<div class="toggle-row">
    <div class="toggle-text">
      <label for=${id} class="toggle-label">${label}</label>
      ${hint && html`<p class="toggle-hint" id=${id + '-h'}>${hint}</p>`}
    </div>
    <button type="button" id=${id} role="switch" aria-checked=${checked ? 'true' : 'false'}
      aria-describedby=${hint ? id + '-h' : null}
      class=${'switch' + (checked ? ' on' : '')} onClick=${() => onChange(!checked)}>
      <span class="switch-knob"></span>
    </button>
  </div>`;
}

// Text with World Dice values highlighted.
export function DiceText({ text }) {
  return segments(text).map((s) => (s.dice ? html`<mark class="dice">${s.text}</mark>` : s.text));
}

export function Sheet({ open, onClose, title, children, wide = false }) {
  const ref = useRef(null);
  const titleId = useId('sheet');
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const el = ref.current;
    const focusables = () => el ? [...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled) : [];
    requestAnimationFrame(() => {
      const f = focusables();
      const target = f.find((x) => !x.classList.contains('sheet-close')) || f[0];
      if (target) target.focus();
    });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.documentElement.classList.add('sheet-open');
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.documentElement.classList.remove('sheet-open');
      if (prev && prev.focus) prev.focus();
    };
  }, [open]);
  if (!open) return null;
  return html`<div class="sheet-backdrop" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class=${'sheet' + (wide ? ' sheet-wide' : '')} role="dialog" aria-modal="true" aria-labelledby=${titleId} ref=${ref}>
      <div class="sheet-head">
        <h2 id=${titleId} class="sheet-title">${title}</h2>
        <button type="button" class="icon-btn sheet-close" onClick=${onClose} aria-label="Close"><${Icon} name="close"/></button>
      </div>
      <div class="sheet-body">${children}</div>
    </div>
  </div>`;
}

// A button that asks for a second tap before doing something destructive.
export function ConfirmButton({ onConfirm, children, confirmLabel = 'Tap again to confirm', className = 'btn btn-danger' }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return html`<button type="button" class=${className + (armed ? ' armed' : '')}
    onClick=${() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
    ${armed ? confirmLabel : children}
  </button>`;
}

export function fmtDuration(sec) {
  if (sec < 60) return `${Math.max(1, sec)} sec`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} hr ${m % 60} min`;
}

export function fmtClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString(undefined, { weekday: diff < 7 ? 'long' : undefined, day: 'numeric', month: 'long', year: sameYear ? undefined : 'numeric' });
}

export function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
