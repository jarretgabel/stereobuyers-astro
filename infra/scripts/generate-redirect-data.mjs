// Generates the CloudFront KeyValueStore import file used by functions/viewer-request.js.
// Key = extension-less path ("/about", "/foo/bar"); value = "d" (directory page only),
// "f" (.html file page only) or "b" (both exist). Usage: node generate-redirect-data.mjs [--dist ../dist]
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outFile = resolve(here, '../generated/redirect-kvs.json');

function walk(dir, base = '') {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    const rel = `${base}/${name}`;
    return statSync(full).isDirectory() ? walk(full, rel) : [rel];
  });
}

/** Normalise a list of site paths (as in migration/urls.txt) into URL paths. */
export function pathsFromDist(distDir) {
  return walk(distDir)
    .filter((p) => p.endsWith('.html'))
    // Redirect stubs for old .html URLs are not real pages: the path is served by its directory page.
    .filter((p) => !readFileSync(join(distDir, p), 'utf8').includes('name="sb-legacy-redirect"'))
    .map((p) => (p.endsWith('/index.html') ? p.slice(0, -'index.html'.length) : p))
    .concat(['/']);
}

export function buildKvsData(paths) {
  const kinds = new Map();
  for (const raw of paths) {
    const p = raw.trim();
    if (!p || p === '/') continue;
    const isDir = p.endsWith('/');
    if (!isDir && !p.endsWith('.html')) continue;
    const key = isDir ? p.slice(0, -1) : p.slice(0, -'.html'.length);
    const kind = isDir ? 'd' : 'f';
    const prev = kinds.get(key);
    kinds.set(key, prev && prev !== kind ? 'b' : kind);
  }
  return {
    data: [...kinds].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, value })),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--dist');
  const paths =
    i > -1
      ? pathsFromDist(resolve(process.argv[i + 1]))
      : readFileSync(join(root, 'migration/urls.txt'), 'utf8').split('\n');
  const data = buildKvsData(paths);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(data) + '\n');
  console.log(`Wrote ${data.data.length} entries to ${outFile}`);
}
