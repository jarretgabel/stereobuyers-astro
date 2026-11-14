// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.stereobuyers.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'preserve' },
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
