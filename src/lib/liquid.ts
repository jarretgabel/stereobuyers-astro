// Small equivalents of the Liquid/Jekyll filters the old templates relied on.
export const truncate = (s: string, n: number, ellipsis = '...') =>
  s.length > n ? s.slice(0, Math.max(0, n - ellipsis.length)) + ellipsis : s;

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s);

export const stripNewlines = (s: string) => s.replace(/\r?\n/g, '');

export const isBlank = (v: unknown) => v === undefined || v === null || v === '' || v === false;

/** Liquid's `a | default: b` */
export const dflt = <T>(v: T | undefined | null | '' | false, fallback: T) => (isBlank(v) ? fallback : (v as T));

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Liquid `date: "%Y-%m-%d"` */
export const dateYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Liquid `date: "%B %-d, %Y"` */
export const dateLong = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

/** Liquid `date_to_xmlschema` (build machine's local timezone, like Jekyll) */
export const dateToXmlschema = (d: Date) => {
  const off = -d.getTimezoneOffset();
  const sign = off < 0 ? '-' : '+';
  const a = Math.abs(off);
  return `${dateYmd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
};
