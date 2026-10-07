import { html } from './vendor/preact-htm.js';

const paths = {
  grimoire: html`<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="m12 7 .9 2.1L15 10l-2.1.9L12 13l-.9-2.1L9 10l2.1-.9L12 7Z"/>`,
  journal: html`<path d="M7 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7"/><path d="M7 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2"/><path d="M7 3v18"/><path d="M11 8h5M11 12h5"/>`,
  settings: html`<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>`,
  star: html`<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z"/>`,
  starFill: html`<path fill="currentColor" d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z"/>`,
  close: html`<path d="M6 6l12 12M18 6 6 18"/>`,
  more: html`<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>`,
  ban: html`<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>`,
  wand: html`<path d="m4 20 11-11"/><path d="m14 4 .7 1.6L16.3 6.3l-1.6.7L14 8.6l-.7-1.6-1.6-.7 1.6-.7L14 4Z"/><path d="m19 9 .5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5.5-1Z"/>`,
  shuffle: html`<path d="M4 7h3.5c2 0 3.2 1 4.2 2.6l1.6 2.8C14.3 14 15.5 17 17.5 17H20"/><path d="M4 17h3.5c1.2 0 2.1-.4 2.9-1.1"/><path d="M14.5 8.1c.8-.7 1.7-1.1 3-1.1H20"/><path d="m18 5 2 2-2 2M18 15l2 2-2 2"/>`,
  play: html`<path fill="currentColor" stroke="none" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/>`,
  pause: html`<path d="M9 5v14M15 5v14"/>`,
  check: html`<path d="m5 12.5 4.2 4.2L19 7"/>`,
  stop: html`<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>`,
  camera: html`<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z"/><circle cx="12" cy="13" r="3.5"/>`,
  trash: html`<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>`,
  download: html`<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/>`,
  upload: html`<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19h14"/>`,
  plus: html`<path d="M12 5v14M5 12h14"/>`,
  chevron: html`<path d="m9 6 6 6-6 6"/>`,
  chevronDown: html`<path d="m6 9 6 6 6-6"/>`,
  back: html`<path d="M19 12H5M11 6l-6 6 6 6"/>`,
  sparkle: html`<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="m19 16 .6 1.4L21 18l-1.4.6L19 20l-.6-1.4L17 18l1.4-.6L19 16Z"/>`,
  moon: html`<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z"/>`,
  dice: html`<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>`,
  info: html`<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>`,
  edit: html`<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z"/>`,
  phone: html`<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>`,
  laptop: html`<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M3 19h18"/>`,
  shield: html`<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/>`,
  refresh: html`<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>`,
};

export function Icon({ name, size = 20, label = null }) {
  return html`<svg class="icon" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden=${label ? null : 'true'} role=${label ? 'img' : null} aria-label=${label}>${paths[name]}</svg>`;
}
