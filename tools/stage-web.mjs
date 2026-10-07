// Copies only the app's web files into a folder, for the Mac and Android builds.
// Usage: node tools/stage-web.mjs <destination>
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dest = resolve(process.argv[2] || '');
if (!process.argv[2]) { console.error('Usage: node tools/stage-web.mjs <destination>'); process.exit(1); }
const items = ['index.html', 'manifest.webmanifest', 'css', 'js', 'fonts', 'icons'];
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const item of items) cpSync(join(root, item), join(dest, item), { recursive: true });
console.log(`Staged web files in ${dest}`);
