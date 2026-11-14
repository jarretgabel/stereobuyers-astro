// Runs mobile Lighthouse on every URL in the sitemap and writes a sorted report.
// Usage: npm run audit -- [--base=https://www.stereobuyers.com] [--concurrency=4] [--limit=N] [--match=substring]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const run = promisify(execFile);
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const base = (args.base || 'https://www.stereobuyers.com').replace(/\/$/, '');
const concurrency = Number(args.concurrency || 4);
const limit = Number(args.limit || 0);
const match = args.match || '';
const outDir = 'audits';
const tmp = path.join(os.tmpdir(), `sb-audit-${process.pid}`);

const xml = await (await fetch(`${base}/sitemap.xml`)).text();
let urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
if (match) urls = urls.filter(u => u.includes(match));
if (limit) urls = urls.slice(0, limit);
await mkdir(tmp, { recursive: true });
await mkdir(outDir, { recursive: true });
console.log(`Auditing ${urls.length} pages from ${base} (concurrency ${concurrency})`);

const rows = [];
let next = 0;
async function worker(id) {
  while (next < urls.length) {
    const url = urls[next++];
    const file = path.join(tmp, `${id}-${next}.json`);
    try {
      await run('npx', ['-y', 'lighthouse', url, '--form-factor=mobile', '--quiet',
        '--only-categories=performance,accessibility,best-practices,seo',
        '--output=json', `--output-path=${file}`, '--chrome-flags=--headless=new'],
        { maxBuffer: 1 << 26, timeout: 180000 });
      const d = JSON.parse(await readFile(file, 'utf8'));
      const c = d.categories;
      const failing = c.accessibility.auditRefs.map(r => r.id).filter(k => d.audits[k].score === 0);
      rows.push({
        url, perf: Math.round(c.performance.score * 100), a11y: Math.round(c.accessibility.score * 100),
        bp: Math.round(c['best-practices'].score * 100), seo: Math.round(c.seo.score * 100),
        lcp: d.audits['largest-contentful-paint'].displayValue, failing,
      });
    } catch (e) {
      rows.push({ url, error: String(e.message).split('\n')[0] });
    }
    await rm(file, { force: true });
    process.stdout.write(`\r${rows.length}/${urls.length}`);
  }
}
await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
await rm(tmp, { recursive: true, force: true });

const ok = rows.filter(r => !r.error).sort((a, b) => Math.min(a.perf, a.a11y, a.bp, a.seo) - Math.min(b.perf, b.a11y, b.bp, b.seo));
const bad = rows.filter(r => r.error);
const avg = k => (ok.reduce((s, r) => s + r[k], 0) / (ok.length || 1)).toFixed(1);
const date = new Date().toISOString().slice(0, 10);
const md = [
  `# Lighthouse audit (mobile) - ${date}`, '',
  `${ok.length} pages audited${bad.length ? `, ${bad.length} failed` : ''}. Averages: performance ${avg('perf')}, accessibility ${avg('a11y')}, best practices ${avg('bp')}, SEO ${avg('seo')}.`, '',
  '| Page | Perf | A11y | BP | SEO | LCP | Failing a11y audits |', '|---|---|---|---|---|---|---|',
  ...ok.map(r => `| ${r.url.replace(base, '') || '/'} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${r.lcp} | ${r.failing.join(', ')} |`),
  ...(bad.length ? ['', '## Failed', ...bad.map(r => `- ${r.url}: ${r.error}`)] : []),
].join('\n');
await writeFile(path.join(outDir, `lighthouse-${date}.md`), md + '\n');
console.log(`\nWrote ${outDir}/lighthouse-${date}.md (worst pages first)`);
