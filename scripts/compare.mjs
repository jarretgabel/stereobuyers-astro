// Parity check: compares built pages in dist/ against a Jekyll build (the "oracle").
// Usage: node scripts/compare.mjs [--oracle /tmp/sb-oracle] [--dist dist] [--show 40] <url-prefix|url>...
//   e.g. node scripts/compare.mjs /stereo-equipment-and-components-we-buy/krell/    (all pages under a prefix)
//        node scripts/compare.mjs --all
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import * as cheerio from 'cheerio';

const args = process.argv.slice(2);
let oracle = '/tmp/sb-oracle';
let show = 30;
let distDir = 'dist';
const targets = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--oracle') oracle = args[++i];
  else if (args[i] === '--dist') distDir = args[++i];
  else if (args[i] === '--show') show = Number(args[++i]);
  else targets.push(args[i]);
}
const dist = path.resolve(distDir);
const urls = fs.readFileSync(path.resolve('migration/urls.txt'), 'utf8').split('\n').filter(Boolean)
  // posts: the oracle was built in a different timezone, so their URL dates differ by a day
  .filter((u) => !/^\/2015\//.test(u));
const selected = targets.includes('--all') ? urls : urls.filter((u) => targets.some((t) => u === t || u.startsWith(t)));
if (!selected.length) { console.error('no matching urls'); process.exit(2); }

const fileFor = (root, url) => path.join(root, url.endsWith('/') ? url + 'index.html' : url);
const ws = (s) => s.replace(/\s+/g, ' ').trim();

function canon($, node, out, depth = 0) {
  for (const n of node.children ?? []) {
    if (n.type === 'text') { const t = ws(n.data); if (t) out.push(t); }
    else if (n.type === 'tag' || n.type === 'script' || n.type === 'style') {
      // data-astro-rerun is an intentional runtime marker for client-side navigation
      const attrs = Object.entries(n.attribs).filter(([k]) => k !== 'data-astro-rerun').map(([k, v]) => `${k.toLowerCase()}="${ws(v)}"`).sort().join(' ');
      out.push(`<${n.name}${attrs ? ' ' + attrs : ''}>`);
      if (n.name === 'script' || n.name === 'style') {
        // The footer year script is wrapped in an IIFE for client-side navigation; compare its body unwrapped
        const t = $(n).text().includes('copyright-year')
          ? $(n).text().replace(/^\s*\/\/[^\n]*\n/, '').replace(/^\s*\(function\(\) \{/, '').replace(/\}\)\(\)\s*$/, '')
          : $(n).text();
        if (t.trim()) out.push(ws(t));
      } else canon($, n, out, depth + 1);
    }
  }
}

function describe(file) {
  const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
  const out = [];
  out.push('## HEAD');
  const head = [];
  head.push('title: ' + ws($('title').text()));
  $('meta').each((_, m) => {
    const key = m.attribs.name ?? m.attribs.property ?? m.attribs.itemprop ?? m.attribs.charset ?? '';
    if (/^og:url$/i.test(key)) return; // intentionally corrected to match canonical
    if (/^astro-view-transitions-/i.test(key)) return; // client-side navigation runtime flags
    head.push(`meta ${key.toLowerCase()}: ${ws(m.attribs.content ?? '')}`);
  });
  $('link').each((_, l) => head.push(`link ${l.attribs.rel} ${l.attribs.sizes ?? ''}: ${l.attribs.href}`));
  const ld = [];
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      const j = JSON.parse($(s).text());
      const strip = (o) => { if (o && typeof o === 'object') { delete o.dateModified; Object.values(o).forEach(strip); } };
      if (j['@type'] === 'WebPage') delete j.dateModified; else strip(j);
      const sort = (v) => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v;
      ld.push(JSON.stringify(sort(j), null, 1));
    } catch (e) { ld.push('INVALID JSON-LD'); }
  });
  out.push(...head.sort(), '## JSON-LD', ...ld.sort());
  $('script[type="application/ld+json"]').remove();
  out.push('## BODY');
  const body = $('body').get(0);
  if (body) {
    const attrs = Object.entries(body.attribs).map(([k, v]) => `${k}="${ws(v)}"`).join(' ');
    out.push(`<body ${attrs}>`);
    canon($, body, out);
  }
  return out.join('\n') + '\n';
}

let ok = 0, bad = 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmp-'));
for (const url of selected) {
  const a = fileFor(oracle, url), b = fileFor(dist, url);
  if (!fs.existsSync(b)) { console.log(`MISSING ${url}`); bad++; continue; }
  if (!fs.existsSync(a)) { console.log(`NO-ORACLE ${url}`); continue; }
  const fa = path.join(tmp, 'oracle.txt'), fb = path.join(tmp, 'dist.txt');
  fs.writeFileSync(fa, describe(a)); fs.writeFileSync(fb, describe(b));
  let diff = '';
  try { execFileSync('diff', ['-u', fa, fb]); } catch (e) { diff = e.stdout?.toString() ?? ''; }
  if (diff) { bad++; console.log(`DIFF ${url}\n` + diff.split('\n').slice(2, 2 + show).join('\n')); } else ok++;
}
console.log(`\n${ok} identical, ${bad} different (of ${selected.length})`);
process.exit(bad ? 1 : 0);
