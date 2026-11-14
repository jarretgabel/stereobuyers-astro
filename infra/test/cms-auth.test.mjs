import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../functions/cms-auth/index.mjs';

const config = { clientId: 'cid', clientSecret: 'secret', origins: ['https://www.stereobuyers.com'] };
const make = (fetchImpl) => createHandler({ getConfig: async () => config, fetchImpl, makeState: () => 'abc123' });
const ev = (rawPath, queryStringParameters, cookies) => ({ rawPath, queryStringParameters, cookies, requestContext: { domainName: 'x.lambda-url.us-east-1.on.aws' } });

test('/auth redirects to GitHub with state cookie', async () => {
  const r = await make()(ev('/auth', {}));
  assert.equal(r.statusCode, 302);
  const u = new URL(r.headers.location);
  assert.equal(u.origin + u.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(u.searchParams.get('client_id'), 'cid');
  assert.equal(u.searchParams.get('state'), 'abc123');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://x.lambda-url.us-east-1.on.aws/callback');
  assert.match(r.cookies[0], /cms_oauth_state=abc123.*HttpOnly/);
});

test('/callback rejects a missing or mismatched state', async () => {
  const noCookie = await make()(ev('/callback', { code: 'c', state: 'abc123' }, []));
  assert.match(noCookie.body, /authorization:github:error/);
  const wrong = await make()(ev('/callback', { code: 'c', state: 'zzz' }, ['cms_oauth_state=abc123']));
  assert.match(wrong.body, /authorization:github:error/);
});

test('/callback exchanges the code and only hands the token to allowed origins', async () => {
  let sent;
  const f = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return { json: async () => ({ access_token: 'tok' }) }; };
  const r = await make(f)(ev('/callback', { code: 'thecode', state: 'abc123' }, ['cms_oauth_state=abc123']));
  assert.equal(sent.body.code, 'thecode');
  assert.equal(sent.body.client_secret, 'secret');
  assert.match(r.body, /authorization:github:success:/);
  assert.ok(r.body.includes('\\"token\\":\\"tok\\"'));
  assert.match(r.body, /https:\/\/www\.stereobuyers\.com/);
  assert.ok(r.cookies[0].includes('Max-Age=0'));
});

test('GitHub errors are reported, not swallowed', async () => {
  const f = async () => ({ json: async () => ({ error: 'bad_verification_code', error_description: 'The code is bad.' }) });
  const r = await make(f)(ev('/callback', { code: 'c', state: 'abc123' }, ['cms_oauth_state=abc123']));
  assert.match(r.body, /The code is bad/);
});

test('unknown paths are 404', async () => {
  assert.equal((await make()(ev('/', {}))).statusCode, 404);
});
