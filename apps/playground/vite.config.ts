import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // The playground runs against the sources so the dev server hot-reloads
      // the library itself. A consumer imports the built package instead.
      {
        find: '@nickkupriyanov/soundline-react/styles.css',
        replacement: source('../../packages/core/src/styles/index.css'),
      },
      {
        find: '@nickkupriyanov/soundline-react/motion',
        replacement: source('../../packages/react/src/motion.ts'),
      },
      {
        find: '@nickkupriyanov/soundline-react',
        replacement: source('../../packages/react/src/index.ts'),
      },
      // The `/dom` subpath has to be matched first: the entry below is a prefix
      // alias and would otherwise rewrite it into `…/src/index.ts/dom`.
      {
        find: '@nickkupriyanov/soundline-core/dom',
        replacement: source('../../packages/core/src/dom/index.ts'),
      },
      {
        find: '@nickkupriyanov/soundline-core',
        replacement: source('../../packages/core/src/index.ts'),
      },
    ],
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: source('index.html'),
        gallery: source('gallery.html'),
      },
    },
  },
});
