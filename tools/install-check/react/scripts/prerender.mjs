/**
 * Puts the widget's server-rendered markup into the built page.
 *
 * This is what makes the browser check a hydration check: `tools/check-hydration.mjs`
 * refuses to run unless the served `index.html` already contains the widget, and the
 * page then hydrates exactly this markup.
 *
 * Run after `vite build`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createElement } from 'react';

const { createMockAdapter, createMockEngine } = await import('@nickkupriyanov/soundline-core');
const { Player } = await import('@nickkupriyanov/soundline-react');
const { renderToString } = await import('react-dom/server');

const TRACKS = [
  {
    id: 'install-a',
    title: 'Install Check A',
    artist: 'Soundline',
    album: 'Packaging',
    duration: 180,
    src: 'https://cdn.example.test/a.mp3',
  },
  {
    id: 'install-b',
    title: 'Install Check B',
    artist: 'Soundline',
    album: 'Packaging',
    duration: 165,
    src: 'https://cdn.example.test/b.mp3',
  },
  {
    id: 'install-c',
    title: 'Install Check C',
    artist: 'Soundline',
    album: 'Packaging',
    duration: 210,
    src: 'https://cdn.example.test/c.mp3',
  },
];

const adapter = createMockAdapter({ tracks: TRACKS });
const engine = createMockEngine({ duration: 180, tickMs: 250 });
const html = renderToString(createElement(Player, { adapter, engine }));

const file = new URL('../dist/index.html', import.meta.url);
const page = await readFile(file, 'utf8');
if (!page.includes('<div id="root"></div>')) {
  throw new Error('the built page has no empty #root to fill');
}

await writeFile(
  file,
  page.replace('<div id="root"></div>', `<div id="root">${html}</div>`),
  'utf8',
);
console.log(`✓ prerendered ${html.length} characters of widget markup into dist/index.html`);
