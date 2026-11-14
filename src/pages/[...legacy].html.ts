// Fallback for the old /foo.html URLs. The CloudFront function 301s these (its KeyValueStore lists the path as a
// directory page); this stub covers any gap by forwarding visitors and pointing crawlers at the new URL.
import type { APIRoute } from 'astro';
import { allPages, SITE_URL } from '../lib/site';

export function getStaticPaths() {
  return allPages
    .filter((p) => p.legacyUrl)
    .map((p) => ({ params: { legacy: p.legacyUrl.slice(1, -'.html'.length) }, props: { url: p.url } }));
}

export const GET: APIRoute = ({ props }) => {
  const url = props.url as string;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Redirecting…</title>
<meta name="sb-legacy-redirect" content="1">
<link rel="canonical" href="${SITE_URL}${url}">
<meta http-equiv="refresh" content="0; url=${url}">
</head>
<body><p>This page has moved to <a href="${url}">${url}</a>.</p></body>
</html>
`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
};
