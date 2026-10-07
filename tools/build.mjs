// Writes sw.js with the list of app files and a hash of their contents,
// so every change to the app produces a new cache and an update prompt.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const include = ['index.html', 'manifest.webmanifest', 'css', 'js', 'fonts', 'icons'];
const skip = (p) => p.endsWith('.DS_Store') || p.includes('/tests/');

function walk(p) {
  const s = statSync(p);
  if (s.isDirectory()) return readdirSync(p).sort().flatMap((n) => walk(join(p, n)));
  return [p];
}

const files = include.flatMap((x) => walk(join(root, x))).filter((p) => !skip(p))
  .filter((p) => !/icons\/(icon-1024|maskable-1024)\.png$/.test(p));
const hash = createHash('sha256');
for (const f of files) { hash.update(relative(root, f)); hash.update(readFileSync(f)); }
const digest = hash.digest('hex').slice(0, 12);
const assets = ['./'].concat(files.map((f) => './' + relative(root, f)));
const tpl = readFileSync(join(root, 'tools/sw-template.js'), 'utf8');
writeFileSync(join(root, 'sw.js'), tpl.replace('__HASH__', digest).replace('__ASSETS__', JSON.stringify(assets, null, 2)));
console.log(`sw.js: ${assets.length} files, cache whimsy-${digest}`);
