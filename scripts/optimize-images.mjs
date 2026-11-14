// Generates resized WebP variants of public/assets/media JPEGs into public/assets/media/optimized.
// Usage: npm run images -- [--force] [filename-substring ...]
import { readdir, readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SRC_DIR = 'public/assets/media';
const OUT_DIR = 'public/assets/media/optimized';
const MANIFEST = 'src/data/image_sizes.json';
const WIDTHS = [480, 768, 1200];
const QUALITY = 72;
const SKIP = /^(FB-OG-|Twitter-Card-)/i;
// PNGs used as product/card images (other PNGs are UI assets and stay as-is)
const EXTRA = new Set(['why-stereobuyers.png', 'how-it-works.png', 'b2b.png', 'process.png', 'napo-stereobuyers-partnership.png']);

const args = process.argv.slice(2);
const force = args.includes('--force');
const filters = args.filter((a) => !a.startsWith('--'));

const slug = (name) =>
  name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const mtime = async (p) => {
  try { return (await stat(p)).mtimeMs; } catch { return 0; }
};

await mkdir(OUT_DIR, { recursive: true });
const files = (await readdir(SRC_DIR))
  .filter((f) => (/\.jpe?g$/i.test(f) || EXTRA.has(f)) && !SKIP.test(f))
  .filter((f) => !filters.length || filters.some((s) => f.includes(s)))
  .sort();

let manifest = {};
try { manifest = JSON.parse(await readFile(MANIFEST, 'utf8')); } catch {}

let done = 0, skipped = 0, failed = 0;
for (const file of files) {
  const input = path.join(SRC_DIR, file);
  const base = slug(file);
  try {
    const srcTime = await mtime(input);
    const meta = await sharp(input).metadata();
    const rotated = meta.orientation && meta.orientation >= 5;
    const srcW = rotated ? meta.height : meta.width;
    const srcH = rotated ? meta.width : meta.height;
    const widths = [...new Set(WIDTHS.map((w) => Math.min(w, srcW)))];

    for (const w of widths) {
      const output = path.join(OUT_DIR, `${base}-${w}.webp`);
      if (!force && (await mtime(output)) > srcTime) { skipped++; continue; }
      await sharp(input).rotate().resize({ width: w, withoutEnlargement: true })
        .webp({ quality: QUALITY }).toFile(output);
      done++;
    }
    manifest[`/${SRC_DIR}/${file}`] = { base, width: srcW, height: srcH, widths };
  } catch (err) {
    failed++;
    console.error(`FAILED ${file}: ${err.message}`);
  }
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`${files.length} source images: ${done} written, ${skipped} up to date, ${failed} failed`);
