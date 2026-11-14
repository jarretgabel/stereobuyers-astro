// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.stereobuyers.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'preserve' },
});
