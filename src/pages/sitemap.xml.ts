import type { APIRoute } from 'astro';
import { pages, blogPosts, SITE_URL } from '../lib/site';

const excluded = (url: string) =>
  url === '/stereo-equipment-we-do-not-buy/' || url.includes('404');

export const GET: APIRoute = () => {
  const entries = [...pages, ...blogPosts]
    .filter((p) => !p.noindex && !excluded(p.url))
    .sort((a, b) => a.url.localeCompare(b.url))
    .map(
      (p) => `  <url>
    <loc>${SITE_URL}${p.url}</loc>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ''}
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>`,
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
