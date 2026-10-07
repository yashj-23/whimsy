import { html, render, useEffect } from './vendor/preact-htm.js';
import { useApp, get, set } from './state.js';
import * as act from './actions.js';
import { Icon } from './icons.js';
import { isNativeApp, isMacApp } from './native.js';
import { Home } from './screens/home.js';
import { DrawScreen } from './screens/card.js';
import { Running } from './screens/session.js';
import { Reflect } from './screens/reflect.js';
import { Journal } from './screens/journal.js';
import { Settings } from './screens/settings.js';

const TABS = [
  { id: 'home', label: 'Grimoire', icon: 'grimoire' },
  { id: 'journal', label: 'Journal', icon: 'journal' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

function Nav({ tab, active, where }) {
  const busy = active && (active.stage === 'running' || active.stage === 'reflect');
  return html`<nav class=${'nav nav-' + where} aria-label="Main">
    ${where === 'side' && html`<div class="brand">
      <img src="icons/emblem-192.png" alt="" width="40" height="40"/>
      <span class="brand-name">Whimsy</span>
    </div>`}
    <ul>
      ${TABS.map((t) => html`<li>
        <button type="button" class=${'nav-item' + (tab === t.id ? ' on' : '')} aria-current=${tab === t.id ? 'page' : null}
          onClick=${() => act.setTab(t.id)}>
          <${Icon} name=${t.icon} size=${where === 'side' ? 20 : 22}/>
          <span>${t.label}</span>
          ${t.id === 'home' && busy && tab !== 'home' && html`<span class="nav-live" aria-label="Session in progress"></span>`}
        </button>
      </li>`)}
    </ul>
    ${where === 'side' && html`<p class="side-foot">A grimoire of small, strange experiments.</p>`}
  </nav>`;
}

function Toast({ toast }) {
  if (!toast) return null;
  return html`<div class="toast" role="status" key=${toast.id}>
    <span class="toast-dot" aria-hidden="true"></span>
    <span>${toast.text}</span>
    ${toast.action && html`<button type="button" class="toast-action" onClick=${() => { act.dismissToast(); toast.action.fn(); }}>${toast.action.label}</button>`}
  </div>`;
}

function Main({ s }) {
  if (s.tab === 'journal') return html`<${Journal}/>`;
  if (s.tab === 'settings') return html`<${Settings}/>`;
  const a = s.active;
  if (a && a.stage === 'running') return html`<${Running}/>`;
  if (a && a.stage === 'reflect') return html`<${Reflect} key=${a.startedAt}/>`;
  if (a) return html`<${DrawScreen}/>`;
  return html`<${Home}/>`;
}

function App() {
  const s = useApp();

  useEffect(() => {
    const m = s.prefs.motion;
    const root = document.documentElement;
    root.dataset.motion = m === 'system' ? (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'full') : m;
  }, [s.prefs.motion]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.documentElement.classList.contains('sheet-open')) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const st = get();
      if (st.tab !== 'home') return;
      if (e.key === 'Escape' && st.active && ['card', 'empty', 'crossroads'].includes(st.active.stage)) {
        act.closeActive();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!s.ready) return html`<div class="loading" aria-busy="true"><img src="icons/emblem-192.png" alt="Whimsy" width="72" height="72"/></div>`;

  const stageClass = s.tab === 'home' && s.active ? ' stage-' + s.active.stage : '';
  return html`<div class=${'shell' + stageClass}>
    <${Nav} tab=${s.tab} active=${s.active} where="side"/>
    <main class="main" id="main">
      <header class="mobile-head">
        <img src="icons/emblem-192.png" alt="" width="30" height="30"/>
        <span class="brand-name">Whimsy</span>
      </header>
      ${s.updateReady && html`<div class="update" role="status">
        <span>A new version of Whimsy is ready.</span>
        <button type="button" class="btn btn-soft btn-sm" onClick=${applyUpdate}><${Icon} name="refresh" size=${16}/> Update</button>
      </div>`}
      <div class="main-inner"><${Main} s=${s}/></div>
    </main>
    <${Nav} tab=${s.tab} active=${s.active} where="bottom"/>
    <${Toast} toast=${s.toast}/>
  </div>`;
}

// ───────────── service worker: offline use and updates ─────────────

let waitingWorker = null;
let updateRequested = false;
function applyUpdate() {
  updateRequested = true;
  if (waitingWorker) waitingWorker.postMessage('skip-waiting');
  else window.location.reload();
}

function setupServiceWorker() {
  if (isNativeApp) return; // the Mac and Android apps carry their files inside; no offline cache needed
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The first install also changes the controller; only reload when the person tapped Update.
    if (reloading || !updateRequested) return;
    reloading = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (w) => { waitingWorker = w; set({ updateReady: true }); };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
    const check = () => reg.update().catch(() => {});
    setInterval(check, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }).catch(() => {});
}

window.addEventListener('pageshow', () => act.expireTemporaryContext());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') act.expireTemporaryContext();
});

if (isNativeApp) document.documentElement.classList.add('native-app');
if (isMacApp) {
  document.documentElement.classList.add('native-mac');
  const strip = document.createElement('div');
  strip.className = 'drag-strip';
  strip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(strip);
}

render(html`<${App}/>`, document.getElementById('app'));
act.boot();
setupServiceWorker();
