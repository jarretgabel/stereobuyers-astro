// One-off migration helper: copies Jekyll page front matter and data into src/ and records Liquid bodies for porting.
// Usage: node scripts/migrate-from-jekyll.mjs ../stereobuyers
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';
import YAML from 'yaml';

const src = path.resolve(process.argv[2] ?? '../stereobuyers');
const out = path.resolve('.');
const skipDirs = new Set(['node_modules', '_site', '.git', '_includes', '_layouts', '_data', 'assets', '.jekyll-cache', 'scripts', 'admin']);
const skipFiles = new Set(['README.md', 'WORKLOG.md', 'google1c8280a911656484.html']);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(md|html)$/.test(e.name) && !skipFiles.has(e.name) && !e.name.startsWith('.')) acc.push(p);
  }
  return acc;
}

function urlFor(rel, data) {
  if (data.permalink) return data.permalink;
  if (rel.startsWith('_blog/')) return '/blog/' + path.basename(rel).replace(/\.(md|html)$/, '') + '.html';
  if (rel.startsWith('_service-area/')) return '/service-area/' + path.basename(rel).replace(/\.(md|html)$/, '') + '.html';
  if (rel.startsWith('_posts/')) {
    const m = path.basename(rel).match(/^(\d{4})-(\d{2})-(\d{2})-(.*)\.(md|html)$/);
    return `/${m[1]}/${m[2]}/${m[3]}/${m[4]}.html`;
  }
  if (rel === 'index.html') return '/';
  return '/' + rel.replace(/\.(md|html)$/, '.html');
}

const contentDir = path.join(out, 'src/content/pages');
const liquidDir = path.join(out, 'migration/liquid/pages');
fs.rmSync(contentDir, { recursive: true, force: true });
fs.rmSync(path.join(out, 'migration'), { recursive: true, force: true });
fs.mkdirSync(contentDir, { recursive: true });
fs.mkdirSync(liquidDir, { recursive: true });

const urls = [];
for (const file of walk(src)) {
  const rel = path.relative(src, file);
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.startsWith('---')) { console.warn('no front matter:', rel); continue; }
  const { data, content } = matter(raw);
  const url = urlFor(rel, data);
  urls.push(url);
  const id = url.endsWith('/') ? url.slice(1) + 'index' : url.slice(1).replace(/\.html$/, '');
  const collection = rel.startsWith('_posts/') ? 'posts' : rel.startsWith('_blog/') ? 'blog' : rel.startsWith('_service-area/') ? 'service-area' : 'pages';
  let lastmod;
  try {
    lastmod = execFileSync('git', ['log', '-1', '--format=%cI', '--', rel], { cwd: src, encoding: 'utf8' }).trim() || undefined;
  } catch { /* not tracked */ }
  const fm = { ...data, url, collection, source: rel, ...(lastmod ? { lastmod } : {}) };
  // Jekyll's sort left these ties in an arbitrary order; make the order explicit.
  if (url === '/business-to-business/') fm.navOrder = 9.5;
  if (url === '/recent-press-articles-and-news/') fm.navOrder = 10.5;
  if (rel.startsWith('_posts/')) fm.date = rel.match(/^_posts\/(\d{4}-\d{2}-\d{2})/)[1];
  const target = path.join(contentDir, id + '.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `---\n${YAML.stringify(fm, { lineWidth: 0 })}---\n`);
  const body = content.trim();
  if (body) {
    const bt = path.join(liquidDir, id + (rel.endsWith('.md') ? '.md' : '.html'));
    fs.mkdirSync(path.dirname(bt), { recursive: true });
    fs.writeFileSync(bt, content);
  }
}

const dataOut = path.join(out, 'src/data');
fs.mkdirSync(dataOut, { recursive: true });
for (const f of fs.readdirSync(path.join(src, '_data'))) {
  const raw = fs.readFileSync(path.join(src, '_data', f), 'utf8');
  const obj = f.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
  fs.writeFileSync(path.join(dataOut, f.replace(/\.ya?ml$/, '.json')), JSON.stringify(obj, null, 2) + '\n');
}
fs.writeFileSync(path.join(out, 'migration/urls.txt'), urls.sort().join('\n') + '\n');
console.log(`pages: ${urls.length}`);
