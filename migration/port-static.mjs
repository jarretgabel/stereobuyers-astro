// Ports Jekyll includes and page bodies that contain no Liquid logic (only {{ site.baseurl }} and plain includes).
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('../stereobuyers');
const pascal = (name) => name.replace(/\.(html|svg)$/, '').split(/[-_]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
const clean = (s) => s.replace(/\{\{\s*site\.baseurl\s*\}\}/g, '');
const INC = /\{%-?\s*include\s+([\w.-]+)\s*-?%\}/g;
const logic = (s) => (clean(s).replace(INC, '').match(/\{%|\{\{/g) ?? []).length > 0;
const needsRaw = (s) => /[{}]/.test(s.replace(/<!--[\s\S]*?-->/g, '')) || /<(script|style)\b/i.test(s);
const written = new Set();

function writeComponent(file, name, markup, raw) {
  const target = path.resolve('src/components', name + '.astro');
  if (raw) {
    const rawPath = path.resolve('src/components/raw', file);
    fs.mkdirSync(path.dirname(rawPath), { recursive: true });
    fs.writeFileSync(rawPath, markup);
    fs.writeFileSync(target, `---\nimport html from './raw/${file}?raw';\n---\n<Fragment set:html={html} />\n`);
  } else fs.writeFileSync(target, markup);
}

function toAstro(content, fromDir) {
  const imports = new Set();
  const body = clean(content).replace(INC, (_, f) => {
    const n = pascal(f);
    imports.add(`import ${n} from '${path.relative(fromDir, path.resolve('src/components', n + '.astro')).replace(/\\/g, '/')}';`);
    return `<${n} />`;
  });
  return imports.size ? `---\n${[...imports].join('\n')}\n---\n${body}` : body;
}

// 1. includes without logic
const incDir = path.join(SRC, '_includes');
const staticIncludes = fs.readdirSync(incDir).filter((f) => /\.(html|svg)$/.test(f) && !logic(fs.readFileSync(path.join(incDir, f), 'utf8')));
for (const f of staticIncludes) {
  const text = fs.readFileSync(path.join(incDir, f), 'utf8');
  const name = pascal(f);
  const hasNested = INC.test(text);
  INC.lastIndex = 0;
  const raw = needsRaw(clean(text)) ;
  if (raw && hasNested) { console.log('SKIP (raw + nested includes):', f); continue; }
  writeComponent(f, name, raw ? clean(text) : toAstro(text, path.resolve('src/components')), raw);
  written.add(f);
}
console.log('static includes ported:', [...written].join(', '));

// 2. page bodies without logic
const bodiesRoot = path.resolve('migration/liquid/pages');
const todo = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else {
      const id = path.relative(bodiesRoot, p).replace(/\.(html|md)$/, '');
      const text = fs.readFileSync(p, 'utf8');
      const includes = [...text.matchAll(INC)].map((m) => m[1]);
      if (logic(text) || includes.some((i) => !written.has(i))) { todo.push(id); continue; }
      if (p.endsWith('.md')) { todo.push(id + '  (markdown body)'); continue; }
      const target = path.resolve('src/page-bodies', id + '.astro');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      if (needsRaw(clean(text.replace(INC, '')))) {
        const rawPath = path.resolve('src/page-bodies/raw', id + '.html');
        fs.mkdirSync(path.dirname(rawPath), { recursive: true });
        fs.writeFileSync(rawPath, clean(text));
        const rel = path.relative(path.dirname(target), rawPath).replace(/\\/g, '/');
        fs.writeFileSync(target, `---\nimport html from '${rel}?raw';\n---\n<Fragment set:html={html} />\n`);
      } else fs.writeFileSync(target, toAstro(text, path.dirname(target)));
    }
  }
})(bodiesRoot);
console.log('\nbodies still to port by hand:\n' + todo.join('\n'));
