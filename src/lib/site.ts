import matter from 'gray-matter';
import breadcrumbNames from '../data/breadcrumb_names.json';
import faq from '../data/faq.json';
import imageSizes from '../data/image_sizes.json';
import equipment from '../data/equipment.json';
import press from '../data/press.json';
import brandPagesData from '../data/brand_pages.json';
import krell from '../data/krell.json';
import levinson from '../data/levinson.json';
import mcintosh from '../data/mcintosh.json';
import conrad from '../data/conrad.json';
import settingsData from '../data/settings.json';

export const SITE_URL = 'https://www.stereobuyers.com';

export const data = {
  breadcrumb_names: breadcrumbNames as Record<string, string>,
  faq: faq as any[],
  image_sizes: imageSizes as Record<string, any>,
  equipment: equipment as any,
  press: press as any,
  brand_pages: brandPagesData as any,
  krell: krell as any,
  levinson: levinson as any,
  mcintosh: mcintosh as any,
  conrad: conrad as any,
};

export const settings = settingsData;
export const site = { url: SITE_URL, baseurl: '', phone: settingsData.phone, data };

/** A Jekyll-style page: all front matter keys plus the generated fields below. */
export interface Page {
  url: string;
  id: string;
  collection: 'pages' | 'posts' | 'blog' | 'service-area';
  source: string;
  lastmod?: string;
  layout?: string;
  title?: string;
  slug?: string;
  [key: string]: any;
}

const files = import.meta.glob('/src/content/pages/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function toDate(v: unknown) {
  return v instanceof Date ? v : v ? new Date(String(v)) : undefined;
}

/** Jekyll reads sub-directories (sorted) before the files of a directory, so `site.pages` follows that order. */
function jekyllOrder(a: Page, b: Page) {
  const sa = String(a.source ?? a.id).split('/');
  const sb = String(b.source ?? b.id).split('/');
  for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
    if (sa[i] === sb[i]) continue;
    const aFile = i === sa.length - 1;
    const bFile = i === sb.length - 1;
    if (aFile !== bFile) return aFile ? 1 : -1;
    return sa[i] < sb[i] ? -1 : 1;
  }
  return sa.length - sb.length;
}

function derivedUrl(id: string, fm: Record<string, any>) {
  if (fm.permalink) return String(fm.permalink);
  if (id === 'index') return '/';
  return id.endsWith('/index') ? `/${id.slice(0, -5)}` : `/${id}.html`;
}

export const allPages: Page[] = Object.entries(files).map(([file, raw]) => {
  const fm = matter(raw).data as Record<string, any>;
  const id = file.replace('/src/content/pages/', '').replace(/\.md$/, '');
  const page = { ...fm, id } as Page;
  // Entries saved through the CMS don't carry the generated fields, so derive them from the file path.
  page.url ??= derivedUrl(id, fm);
  const entryDir = id.endsWith('/index') ? '' : id.split('/')[0];
  page.collection ??= entryDir === 'blog' ? 'blog' : entryDir === 'service-area' ? 'service-area' : 'pages';
  page.source ??= `${id}.md`;
  if (page.date) page.date = toDate(page.date);
  if (page.slug === undefined && (page.collection === 'blog' || page.collection === 'service-area')) page.slug = id.split('/').pop();
  return page;
}).sort(jekyllOrder);

/** Jekyll's `site.pages`: everything except posts and collection documents. */
export const pages = allPages.filter((p) => p.collection === 'pages');
export const posts = allPages
  .filter((p) => p.collection === 'posts')
  // Jekyll sorts by date then path ascending, and site.posts is that list reversed.
  .sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
export const blogPosts = allPages.filter((p) => p.collection === 'blog');

export function pageByUrl(url: string) {
  return allPages.find((p) => p.url === url);
}
