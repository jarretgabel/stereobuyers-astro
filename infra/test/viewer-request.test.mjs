import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildKvsData } from '../scripts/generate-redirect-data.mjs';

const urls = readFileSync(new URL('../../migration/urls.txt', import.meta.url), 'utf8').split('\n');
const store = new Map(buildKvsData(urls).data.map((e) => [e.key, e.value]));
const fakeCf = {
  kvs: () => ({
    get: async (k) => {
      if (!store.has(k)) throw new Error('KeyNotFound');
      return store.get(k);
    },
  }),
};
const code = readFileSync(new URL('../functions/viewer-request.js', import.meta.url), 'utf8');
const ctx = vm.createContext({ require: () => fakeCf });
vm.runInContext(code, ctx);

async function run(uri, { host = 'www.stereobuyers.com', qs = {} } = {}) {
  return ctx.handler({ request: { uri, headers: { host: { value: host } }, querystring: qs } });
}
const loc = (r) => r.headers.location.value;

test('function code fits the 10KB limit', () => assert.ok(Buffer.byteLength(code) < 10_000));

test('directory URLs map to index.html', async () => {
  assert.equal((await run('/')).uri, '/index.html');
  assert.equal((await run('/about/')).uri, '/about/index.html');
});

test('file pages and assets pass through', async () => {
  const p = '/stereo-equipment-and-components-we-buy/devore-fidelity/devore-fidelity-gibbon-3.html';
  assert.equal((await run(p)).uri, p);
  assert.equal((await run('/assets/css/main.css')).uri, '/assets/css/main.css');
  assert.equal((await run('/sitemap.xml')).uri, '/sitemap.xml');
});

test('extension-less directory URL redirects to trailing slash', async () => {
  const r = await run('/about');
  assert.equal(r.statusCode, 301);
  assert.equal(loc(r), 'https://www.stereobuyers.com/about/');
});

test('extension-less file URL redirects to .html', async () => {
  const r = await run('/stereo-equipment-and-components-we-buy/devore-fidelity/devore-fidelity-gibbon-3');
  assert.equal(loc(r), 'https://www.stereobuyers.com/stereo-equipment-and-components-we-buy/devore-fidelity/devore-fidelity-gibbon-3.html');
});

test('unknown extension-less URL is passed through (origin 404)', async () => {
  assert.equal((await run('/nope')).uri, '/nope');
});

test('.html URL for a directory-only page redirects to the directory', async () => {
  assert.equal(loc(await run('/get-a-quote.html')), 'https://www.stereobuyers.com/get-a-quote/');
});

test('apex redirects to www, preserving path and query', async () => {
  const r = await run('/about/', { host: 'stereobuyers.com', qs: { a: { value: '1' }, b: { value: '' } } });
  assert.equal(r.statusCode, 301);
  assert.equal(loc(r), 'https://www.stereobuyers.com/about/?a=1&b');
  assert.equal(loc(await run('/', { host: 'stereobuyers.com' })), 'https://www.stereobuyers.com/');
});

test('legacy redirects', async () => {
  assert.equal(loc(await run('/feedback/')), 'https://g.page/r/Cc3QI0XLBTnOEAg/review');
  assert.equal(loc(await run('/feedback')), 'https://g.page/r/Cc3QI0XLBTnOEAg/review');
  assert.equal(loc(await run('/meet-the-stereo-buyers/')), 'https://www.stereobuyers.com/about/');
  const how = 'https://www.stereobuyers.com/how-to-sell-your-high-end-audio-equipment-and-components-with-StereoBuyers/';
  assert.equal(loc(await run('/m/how-to-sell-your-high-end-audio-equipment-and-components-with-StereoBuyers/')), how);
  assert.equal(loc(await run('/mobile/how-to-sell-your-high-end-audio-equipment-and-components-with-StereoBuyers/')), how);
  const b = 'https://www.stereobuyers.com/stereo-equipment-and-components-we-buy/devore-fidelity/';
  assert.equal(loc(await run('/stereo-equipment-and-components-we-buy/davore-fidelity/')), b);
  assert.equal(loc(await run('/stereo-equipment-and-components-we-buy/davore-fidelity/x.html')), b + 'x.html');
});

test('root brand pages are NOT redirected (they exist on the current site)', async () => {
  assert.equal((await run('/audio-research/')).uri, '/audio-research/index.html');
  assert.equal((await run('/krell/')).uri, '/krell/index.html');
});
