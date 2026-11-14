// Helpers shared by the product-page includes (type-label, product-name, brand names...).
import { capitalize, isBlank } from './liquid';

const UPPER = new Set(['cd', 'dac', 'av', 'dvd', 'sacd']);

/** _includes/type-label.html */
export function typeLabel(type: unknown): string {
  let raw = String(type ?? '').trim();
  if (!raw.includes(' ')) raw = raw.replace(/-/g, ' ');
  return raw
    .split(' ')
    .filter(Boolean)
    .map((w) => (UPPER.has(w.toLowerCase()) ? w.toUpperCase() : capitalize(w)))
    .join(' ');
}

/** _includes/product-name.html */
export function productName(title: unknown): string {
  return String(title ?? '').split(' - High End')[0].split(' – High End')[0].trim();
}

/** `b.faq_brand | default: b.brand | default: b.title | split: ' – ' | first` */
export function brandName(p: Record<string, any>): string {
  const v = [p.faq_brand, p.brand, p.title].find((x) => !isBlank(x));
  return String(v ?? '').split(' – ')[0];
}

/** _includes/product-h1.html */
export function productH1(page: Record<string, any>): string {
  if (!isBlank(page.title)) return String(page.title);
  if (!isBlank(page.component)) {
    const comp = String(page.component);
    const hasBrand = !isBlank(page.brand) && comp.includes(String(page.brand));
    return `${hasBrand ? '' : `${page.brand ?? ''} `}${comp} – High End Stereo Equipment We Buy`;
  }
  return '';
}

/** Liquid: `{{ page.brand | downcase | replace: " ", "-" | ... }}` as used by product-footer. */
export const brandLayoutSlug = (brand: unknown) =>
  String(brand ?? '').toLowerCase().replace(/ /g, '-').replace(/&/g, '').replace(/--/g, '-');
