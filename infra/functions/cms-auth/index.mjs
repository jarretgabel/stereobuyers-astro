// GitHub OAuth client for Sveltia/Decap CMS, served from a Lambda Function URL.
//   GET /auth     -> redirects to GitHub (state is kept in a short-lived cookie)
//   GET /callback -> exchanges the code for a token and hands it to the CMS window
import { randomBytes } from 'node:crypto';

const STATE_COOKIE = 'cms_oauth_state';

const html = (statusCode, body, cookies = []) => ({
  statusCode,
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  cookies,
  body,
});

// JSON that is safe inside an inline <script>.
const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');

function handoff(origins, status, payload) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  return html(
    200,
    `<!doctype html><meta charset="utf-8"><title>Signing in…</title><p>Signing in…</p>
<script>
(function () {
  var allowed = ${safeJson(origins)};
  var message = ${safeJson(message)};
  function receive(e) {
    if (allowed.indexOf(e.origin) === -1 || !window.opener) return;
    window.opener.postMessage(message, e.origin);
    window.removeEventListener('message', receive);
    window.close();
  }
  window.addEventListener('message', receive);
  if (window.opener) window.opener.postMessage('authorizing:github', '*');
})();
</script>`,
    [`${STATE_COOKIE}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`],
  );
}

export function createHandler({ getConfig, fetchImpl = fetch, makeState = () => randomBytes(16).toString('hex') }) {
  return async function handler(event) {
    const path = event.rawPath || '/';
    if (path !== '/auth' && path !== '/callback') return { statusCode: 404, headers: { 'content-type': 'text/plain' }, body: 'Not found' };
    const query = event.queryStringParameters || {};
    const redirectUri = `https://${event.requestContext.domainName}/callback`;
    const { clientId, clientSecret, origins } = await getConfig();

    if (path === '/auth') {
      const state = makeState();
      const url = new URL('https://github.com/login/oauth/authorize');
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: 'repo,user', state }).toString();
      return {
        statusCode: 302,
        headers: { location: url.toString(), 'cache-control': 'no-store' },
        cookies: [`${STATE_COOKIE}=${state}; Max-Age=600; Path=/; Secure; HttpOnly; SameSite=Lax`],
        body: '',
      };
    }

    if (path === '/callback') {
      const cookie = (event.cookies || []).find((c) => c.startsWith(`${STATE_COOKIE}=`));
      const expected = cookie ? cookie.slice(STATE_COOKIE.length + 1) : '';
      if (!query.state || !expected || query.state !== expected) {
        return handoff(origins, 'error', { message: 'Sign-in session expired. Please close this window and try again.' });
      }
      if (query.error || !query.code) {
        return handoff(origins, 'error', { message: query.error_description || 'GitHub sign-in was cancelled.' });
      }
      const res = await fetchImpl('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code: query.code, redirect_uri: redirectUri }),
      });
      const data = await res.json();
      if (!data.access_token) return handoff(origins, 'error', { message: data.error_description || 'GitHub did not return a token.' });
      return handoff(origins, 'success', { token: data.access_token, provider: 'github' });
    }

    return { statusCode: 404, headers: { 'content-type': 'text/plain' }, body: 'Not found' };
  };
}

let cached;
async function loadConfig() {
  if (cached) return cached;
  const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
  const ssm = new SSMClient({});
  const get = async (name) => (await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }))).Parameter.Value;
  cached = {
    clientId: await get(process.env.CLIENT_ID_PARAM),
    clientSecret: await get(process.env.CLIENT_SECRET_PARAM),
    origins: process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  };
  return cached;
}

export const handler = createHandler({ getConfig: loadConfig });
