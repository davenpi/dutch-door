import { defineConfig } from 'vite';

// Relative asset paths, so the built site works from any folder or host.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
