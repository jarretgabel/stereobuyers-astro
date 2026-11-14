import fs from 'fs';
const pairs = [['09/01/recent-posts','09/30/recent-posts'],['10/01/recent-buys','09/30/recent-buys'],['10/03/b2b','10/02/b2b'],['10/03/logos','10/02/logos'],['10/04/testimonial','10/03/testimonial'],['10/05/equipment-we-buy','10/04/equipment-we-buy'],['10/06/service-and-payment','10/05/service-and-payment'],['10/07/how-it-works','10/06/how-it-works'],['10/08/why','10/07/why'],['10/09/process','10/08/process'],['10/10/home','10/09/home']];
const n = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/> </g, '><').replace(/ ?\/>/g, '>').replace(/&#39;/g, "'").replace(/&#58;/g, ':').replace(/&amp;/g, '&').replace(/'/g, '"').replace(/ alt=""/g, ' alt').replace(/> /g, '>').replace(/ </g, '<').trim();
const m = (s) => n(s.slice(s.indexOf('<main'), s.indexOf('</main')));
for (const [a, b] of pairs) {
  const x = m(fs.readFileSync(`/tmp/dist-home/2015/${a}.html`, 'utf8'));
  const y = m(fs.readFileSync(`/tmp/sb-oracle/2015/${b}.html`, 'utf8'));
  console.log(a, x === y ? 'SAME' : 'DIFF');
  if (x !== y) {
    let i = 0; while (x[i] === y[i]) i++;
    const s = Math.max(0, i - 60);
    console.log(i, 'ours:', x.slice(s, i + 100)); console.log('orcl:', y.slice(s, i + 100));
  }
}
