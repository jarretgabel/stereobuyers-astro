import fs from 'fs';
const map = { '10/01/recent-buys':1,'10/03/b2b':1,'10/05/equipment-we-buy':1,'10/07/how-it-works':1,'10/08/why':1,'10/09/process':1 };
for (const k of Object.keys(map)) {
  let s = fs.readFileSync(`migration/liquid/pages/2015/${k}.html`, 'utf8');
  const imports = new Set();
  s = s.replace(/\{% include responsive-img\.html ([^%]*?)\s*%\}/g, (_, a) => { imports.add('ResponsiveImg'); return `<ResponsiveImg ${a} />`; });
  s = s.replace(/\{% include arrow\.html %\}/g, () => { imports.add('Arrow'); return '<Arrow />'; });
  s = s.replace(/\{% include process_steps\.html %\}/g, () => { imports.add('ProcessSteps'); return '<ProcessSteps />'; });
  s = s.replace(/\{\{ site\.baseurl \}\}/g, '');
  const depth = k.split('/').length + 1 + 2; // page-bodies/2015/MM/DD
  const rel = '../../../../components/';
  const fm = imports.size ? '---\n' + [...imports].map(i => `import ${i} from '${rel}${i}.astro';`).join('\n') + '\n---\n' : '';
  const out = `src/page-bodies/2015/${k}.astro`;
  fs.mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(out, fm + s);
}
