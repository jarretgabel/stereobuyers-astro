// CloudFront Function (cloudfront-js-2.0), viewer-request. Keep under 10KB.
// Needs a KeyValueStore (see scripts/generate-redirect-data.mjs): key "/path" -> "d" | "f" | "b".
const cf = require('cloudfront');

const CANONICAL_HOST = 'www.stereobuyers.com';
const APEX_HOST = 'stereobuyers.com';
const BRAND_DIR = '/stereo-equipment-and-components-we-buy/';
const HOW_TO_SELL = '/how-to-sell-your-high-end-audio-equipment-and-components-with-StereoBuyers/';

// Exact-path legacy redirects (paths compared without a trailing slash).
const EXACT = {
  '/feedback': 'https://g.page/r/Cc3QI0XLBTnOEAg/review',
  '/meet-the-stereo-buyers': '/about/',
  '/m/how-to-sell-your-high-end-audio-equipment-and-components-with-StereoBuyers': HOW_TO_SELL,
  '/mobile/how-to-sell-your-high-end-audio-equipment-and-components-with-StereoBuyers': HOW_TO_SELL,
};
// Prefix legacy redirects (typo'd brand slug -> correct slug, rest of the path kept).
const PREFIX = [[BRAND_DIR + 'davore-fidelity', BRAND_DIR + 'devore-fidelity']];

function queryString(querystring) {
  const parts = [];
  for (const k in querystring) {
    const q = querystring[k];
    const values = q.multiValue ? q.multiValue.map(function (m) { return m.value; }) : [q.value];
    for (let i = 0; i < values.length; i++) parts.push(values[i] === '' ? k : k + '=' + values[i]);
  }
  return parts.length ? '?' + parts.join('&') : '';
}

async function lookup(key) {
  try {
    return await cf.kvs().get(key);
  } catch (e) {
    return null;
  }
}

// Returns a redirect target (path or absolute URL) or null when the URI should be served as-is.
async function resolvePath(uri) {
  const bare = uri.length > 1 && uri.endsWith('/') ? uri.slice(0, -1) : uri;
  if (EXACT[bare]) return EXACT[bare];
  for (let i = 0; i < PREFIX.length; i++) {
    const from = PREFIX[i][0];
    const to = PREFIX[i][1];
    if (bare === from || bare.startsWith(from + '/')) return to + uri.slice(from.length);
  }
  const last = uri.slice(uri.lastIndexOf('/') + 1);
  if (uri.endsWith('/')) return null;
  if (last.endsWith('.html')) {
    // /foo.html where only the directory page /foo/ exists (old Jekyll/Apache URLs).
    if (last === 'index.html') return null;
    return (await lookup(uri.slice(0, -5))) === 'd' ? uri.slice(0, -5) + '/' : null;
  }
  if (last.indexOf('.') !== -1) return null;
  const kind = await lookup(uri);
  if (kind === 'd' || kind === 'b') return uri + '/';
  if (kind === 'f') return uri + '.html';
  return null;
}

async function handler(event) {
  const request = event.request;
  const host = request.headers.host ? request.headers.host.value : '';
  const target = await resolvePath(request.uri);
  const qs = queryString(request.querystring);

  if (target && target.charAt(0) !== '/') {
    return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: target } } };
  }
  if (target || host === APEX_HOST) {
    // Relative redirects keep non-production hosts (e.g. *.cloudfront.net) on their own origin.
    const location = (host === APEX_HOST ? 'https://' + CANONICAL_HOST : '') + (target || request.uri) + qs;
    return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: location } } };
  }
  if (request.uri.endsWith('/')) request.uri += 'index.html';
  return request;
}
