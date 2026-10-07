// Sound and haptics. Audio must be unlocked by a tap before it can play (iPhone rule).
let ac = null;

export function unlockAudio() {
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume();
  } catch (e) { /* no audio */ }
}

function tone(freq, start, length, peak, type = 'sine') {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + length);
  o.connect(g);
  g.connect(ac.destination);
  o.start(start);
  o.stop(start + length + 0.05);
}

// Three rising bell notes.
export function chime() {
  unlockAudio();
  if (!ac) return;
  const t = ac.currentTime + 0.02;
  tone(659.25, t, 1.4, 0.16);
  tone(880.0, t + 0.2, 1.4, 0.14);
  tone(1318.5, t + 0.4, 1.8, 0.11);
  tone(1318.5 * 2, t + 0.4, 0.8, 0.02, 'triangle');
}

// A very soft shimmer for the card reveal.
export function shimmer() {
  unlockAudio();
  if (!ac) return;
  const t = ac.currentTime + 0.01;
  tone(1567.98, t, 0.5, 0.035);
  tone(2093.0, t + 0.07, 0.6, 0.03);
  tone(2637.0, t + 0.14, 0.7, 0.02);
}

export function buzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) { /* not supported */ }
}
