import { html, useEffect, useState, useRef } from '../vendor/preact-htm.js';
import { useApp } from '../state.js';
import * as act from '../actions.js';
import { Segmented, fmtClock } from '../ui.js';
import { Icon } from '../icons.js';
import { CardFace } from './card.js';

const STYLE_OPTS = [
  { value: 'countdown', label: 'Countdown' },
  { value: 'stopwatch', label: 'Stopwatch' },
  { value: 'none', label: 'No timer' },
];

function useTick(active) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => { setN((n) => n + 1); act.checkTimeUp(); }, 250);
    const onVis = () => { setN((n) => n + 1); act.checkTimeUp(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis); };
  }, [active]);
}

// Keeps the screen on while a session runs, so the end chime can play. Released when you leave.
function useWakeLock(on) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) { setHeld(false); return undefined; }
    let lock = null;
    let alive = true;
    const grab = async () => {
      if (document.visibilityState !== 'visible' || lock) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (!alive) { lock.release(); return; }
        setHeld(true);
        lock.addEventListener('release', () => { lock = null; if (alive) setHeld(false); });
      } catch (e) { setHeld(false); }
    };
    grab();
    document.addEventListener('visibilitychange', grab);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', grab);
      if (lock) lock.release().catch(() => {});
    };
  }, [on]);
  return held;
}

function stepDown(m) { return m > 5 ? m - 5 : Math.max(1, m - 1); }
function stepUp(m) { return m >= 5 ? m + 5 : m + 1; }

export function Running() {
  const s = useApp();
  const a = s.active;
  useTick(true);
  const ringRef = useRef(null);
  const awake = useWakeLock(!!(a && s.prefs.keepAwake && a.timerStyle === 'countdown' && !a.pausedAt && !a.timeUp));
  if (!a) return null;
  const elapsed = act.elapsedMs(a);
  const target = a.targetMins * 60000;
  const paused = !!a.pausedAt;
  const style = a.timerStyle;
  const timeUp = style === 'countdown' && elapsed >= target;
  let big = '';
  let sub = '';
  let progress = 0;
  if (style === 'countdown') {
    big = timeUp ? "Time's up" : fmtClock(target - elapsed);
    sub = timeUp ? `${fmtClock(elapsed)} so far` : `of ${a.targetMins} min`;
    progress = Math.min(1, elapsed / target);
  } else if (style === 'stopwatch') {
    big = fmtClock(elapsed);
    sub = 'No rush';
    progress = (elapsed % 60000) / 60000;
  } else {
    big = 'Take your time';
    sub = 'Tap Done when you are';
    progress = 0;
  }
  const R = 112;
  const C = 2 * Math.PI * R;

  return html`<section class="running" aria-labelledby="card-title">
    <div class="running-top">
      <span class="draw-top-label">${paused ? 'Paused' : 'In progress'}</span>
    </div>
    <${CardFace} inst=${a.instance} ctx=${a.ctx} compact=${true}/>

    <div class=${'timer' + (timeUp ? ' up' : '') + (paused ? ' paused' : '') + (style === 'none' ? ' quiet' : '')}>
      <svg class="timer-ring" viewBox="0 0 260 260" aria-hidden="true" ref=${ringRef}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#FFD3B8"/>
            <stop offset="0.55" stop-color="#F48C7F"/>
            <stop offset="1" stop-color="#E2577A"/>
          </linearGradient>
        </defs>
        <circle cx="130" cy="130" r=${R} class="ring-track"/>
        ${style !== 'none' && html`<circle cx="130" cy="130" r=${R} class="ring-fill"
          stroke-dasharray=${C} stroke-dashoffset=${C * (1 - progress)} transform="rotate(-90 130 130)"/>`}
      </svg>
      <div class="timer-read" role="timer" aria-live=${timeUp ? 'assertive' : 'off'}>
        <span class=${'timer-big' + (style === 'none' || timeUp ? ' timer-words' : '')}>${big}</span>
        <span class="timer-sub">${sub}</span>
      </div>
    </div>

    ${style === 'countdown' && !timeUp && html`<div class="adjust" role="group" aria-label="Adjust countdown">
      <button type="button" class="icon-btn" onClick=${() => act.setTarget(stepDown(a.targetMins))} aria-label="Less time" disabled=${a.targetMins <= 1}>−</button>
      <span>${a.targetMins} min</span>
      <button type="button" class="icon-btn" onClick=${() => act.setTarget(stepUp(a.targetMins))} aria-label="More time">+</button>
    </div>`}

    <${Segmented} options=${STYLE_OPTS} value=${style} onChange=${act.setTimerStyle} label="Timer style" size="sm" className="timer-style"/>

    <div class="run-actions">
      ${timeUp ? html`
        <button type="button" class="btn btn-primary btn-lg" onClick=${() => act.finish('completed')}><${Icon} name="check" size=${18}/> Done</button>
        <button type="button" class="btn btn-soft btn-lg" onClick=${() => act.setTimerStyle('stopwatch')}>Keep going</button>
      ` : html`
        ${style !== 'none' && (paused
          ? html`<button type="button" class="btn btn-soft btn-lg" onClick=${act.resume}><${Icon} name="play" size=${18}/> Resume</button>`
          : html`<button type="button" class="btn btn-soft btn-lg" onClick=${act.pause}><${Icon} name="pause" size=${18}/> Pause</button>`)}
        <button type="button" class="btn btn-primary btn-lg" onClick=${() => act.finish('completed')}><${Icon} name="check" size=${18}/> Done</button>
      `}
      <button type="button" class="btn btn-ghost btn-lg" onClick=${() => act.finish('stopped')}><${Icon} name="stop" size=${18}/> Stop here</button>
    </div>
    <p class="fine">${awake
      ? 'Your screen stays on until time is up, so the chime can play.'
      : 'Your time is kept even if you leave the app. If the screen locks, the end chime may not play.'}</p>
  </section>`;
}
