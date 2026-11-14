// Shrinks oversized JPEG originals in assets/media in place.
// Caps width, then lowers quality (and finally width) until each file is under TARGET_BYTES.
// Usage: npm run images:shrink -- [--dry-run] [filename-substring ...]
// Re-run `npm run images` afterwards to regenerate the WebP variants.
import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DIR = 'public/assets/media';
const TARGET_BYTES = 550 * 1024;
const MAX_WIDTH = 2000;
const QUALITIES = [82, 78, 74, 70, 65];
const MIN_WIDTH = 1400;
const SKIP = /^(FB-OG-|Twitter-Card-)/i;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filters = args.filter((a) => !a.startsWith('--'));

const encode = (input, width, quality) =>
  sharp(input).rotate().resize({ width, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true }).toBuffer();

const files = (await readdir(DIR))
  .filter((f) => /\.jpe?g$/i.test(f) && !SKIP.test(f))
  .filter((f) => !filters.length || filters.some((s) => f.includes(s)))
  .sort();

let changed = 0, before = 0, after = 0, over = [];
for (const file of files) {
  const input = path.join(DIR, file);
  const size = (await stat(input)).size;
  if (size <= TARGET_BYTES) continue;

  let width = MAX_WIDTH, out;
  search: for (; width >= MIN_WIDTH; width -= 200) {
    for (const q of QUALITIES) {
      out = await encode(input, width, q);
      if (out.length <= TARGET_BYTES) break search;
    }
  }
  if (out.length >= size) continue;

  if (out.length > TARGET_BYTES) over.push(`${file} (${Math.round(out.length / 1024)} KB)`);
  before += size; after += out.length; changed++;
  console.log(`${file}: ${Math.round(size / 1024)} KB -> ${Math.round(out.length / 1024)} KB`);
  if (!dryRun) await writeFile(input, out);
}

console.log(`\n${changed} files ${dryRun ? 'would be ' : ''}shrunk: ${Math.round(before / 1e6)} MB -> ${Math.round(after / 1e6)} MB`);
if (over.length) console.log(`Still above target (but under 1 MB?): ${over.join(', ')}`);
