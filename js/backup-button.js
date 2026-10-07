import { html, useState } from './vendor/preact-htm.js';
import * as act from './actions.js';
import { Sheet } from './ui.js';
import { Icon } from './icons.js';

function kb(n) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

// On a Mac the backup downloads straight away. On a phone it opens the share sheet,
// so it can go to Files, iCloud Drive, or AirDrop to another device.
export function BackupButton({ label = 'Back up', className = 'btn btn-soft', size = 18 }) {
  const [ready, setReady] = useState(null);
  const [busy, setBusy] = useState(false);
  async function begin() {
    if (busy) return;
    setBusy(true);
    try {
      const b = await act.prepareBackup();
      if (b.android) await act.shareBackupAndroid(b);
      else if (b.canShare) setReady(b);
      else act.downloadBackup(b);
    } catch (e) {
      act.toast("The backup couldn't be made. Try again.");
    }
    setBusy(false);
  }
  return html`
    <button type="button" class=${className} onClick=${begin} disabled=${busy}><${Icon} name="download" size=${size}/> ${label}</button>
    <${Sheet} open=${!!ready} onClose=${() => setReady(null)} title="Your backup is ready">
      ${ready && html`
        <p>${ready.sessions} journal ${ready.sessions === 1 ? 'entry' : 'entries'} and ${ready.photos} ${ready.photos === 1 ? 'photo' : 'photos'}, ${kb(ready.size)}.</p>
        <p class="muted">Save it to Files or iCloud Drive, or AirDrop it to your Mac and restore it there.</p>
        <div class="stack">
          <button type="button" class="btn btn-primary btn-lg" onClick=${() => { const b = ready; setReady(null); act.shareBackup(b); }}>Save or send the file</button>
          <button type="button" class="btn btn-ghost" onClick=${() => { const b = ready; setReady(null); act.downloadBackup(b); }}>Download instead</button>
        </div>`}
    </${Sheet}>`;
}
