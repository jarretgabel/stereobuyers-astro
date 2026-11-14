// Post-build: drops rules whose classes appear in no built page or script, then minifies.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { transform } from 'lightningcss';

const dist = 'dist';
const cssPath = path.join(dist, 'assets/css/main.css');
const used = new Set();
let scriptText = fs.readFileSync(path.join(dist, 'assets/js/main.js'), 'utf8');

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.html')) {
      const html = fs.readFileSync(p, 'utf8');
      for (const m of html.matchAll(/class=(?:"([^"]*)"|'([^']*)')/g)) (m[1] ?? m[2]).split(/\s+/).forEach((c) => used.add(c));
      for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) scriptText += m[1];
    }
  }
};
walk(dist);

const isUsed = (name) => used.has(name) || scriptText.includes(name);
const selectorAlive = (sel) => sel.every((c) => c.type !== 'class' || isUsed(c.name));

const before = fs.readFileSync(cssPath);
const { code } = transform({
  filename: 'main.css',
  code: before,
  minify: true,
  targets: { chrome: 100 << 16, safari: 15 << 16, firefox: 100 << 16 },
  visitor: {
    Rule: {
      style(rule) {
        if (!rule.value.selectors.some(selectorAlive)) return [];
      },
    },
  },
});
const cssOut = Buffer.from(code.toString().replaceAll('url(../media/', 'url(/assets/media/'));
console.log(`optimize-css: ${before.length} -> ${cssOut.length} bytes`);

// Content-hash the CSS and JS into /_astro (served with a 1-year immutable cache) and rewrite page references.
const jsPath = path.join(dist, 'assets/js/main.js');
const hashed = (buf, ext) => `/_astro/main.${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8)}.${ext}`;
const jsBuf = fs.readFileSync(jsPath);
const map = { '/assets/css/main.css': hashed(cssOut, 'css'), '/assets/js/main.js': hashed(jsBuf, 'js') };
fs.mkdirSync(path.join(dist, '_astro'), { recursive: true });
fs.writeFileSync(path.join(dist, map['/assets/css/main.css']), cssOut);
fs.writeFileSync(path.join(dist, map['/assets/js/main.js']), jsBuf);
fs.rmSync(cssPath);
fs.rmSync(jsPath);

const rewrite = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) rewrite(p);
    else if (entry.name.endsWith('.html')) {
      let html = fs.readFileSync(p, 'utf8');
      const out = Object.entries(map).reduce((h, [from, to]) => h.replaceAll(from, to), html);
      if (out !== html) fs.writeFileSync(p, out);
    }
  }
};
rewrite(dist);
