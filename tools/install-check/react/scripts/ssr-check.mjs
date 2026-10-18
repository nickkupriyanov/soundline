/**
 * Server rendering and client hydration of the packed React binding.
 *
 * The application is a real consumer: it imports the tarball-installed packages,
 * renders the widget in Node (where there is no DOM at all) and then hydrates that
 * exact markup in jsdom, failing on any React mismatch report. That covers the two
 * conditions the specification states for server rendering — no DOM access while
 * importing, and no markup mismatch — without needing a browser.
 *
 * The playlist is a mock adapter and the playback a mock engine, the same two
 * substitutions `@nickkupriyanov/soundline-react` ships: the server never fetches
 * and never builds an `<audio>`.
 */
import { createElement } from 'react';
import { JSDOM } from 'jsdom';

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

const { createMockAdapter, createMockEngine } = await import('@nickkupriyanov/soundline-core');
const { Player } = await import('@nickkupriyanov/soundline-react');

const adapter = createMockAdapter({ tracks: TRACKS });
const engine = createMockEngine({ duration: 180, tickMs: 250 });
const element = createElement(Player, { adapter, engine });

/* 1. The server: plain Node, no `window`, no `document`. */
const { renderToString } = await import('react-dom/server');
const html = renderToString(element);

if (!html.includes('sn-root')) {
  throw new Error(`the server render produced no widget: ${html.slice(0, 240)}`);
}

/* 2. The client: hydrate that markup and listen for mismatch reports. */
const dom = new JSDOM(`<!doctype html><html><body><div id="root">${html}</div></body></html>`, {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});

// Node defines a few of these as getter-only globals, so they are replaced with
// `defineProperty`; the ones that need their `this` get it bound.
const BOUND = new Set(['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']);
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'Event',
  'KeyboardEvent',
  'CustomEvent',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
]) {
  const value = dom.window[name];
  if (value === undefined) continue;
  Object.defineProperty(globalThis, name, {
    value: BOUND.has(name) ? value.bind(dom.window) : value,
    configurable: true,
    writable: true,
  });
}
globalThis.window.matchMedia ??= (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
});
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const problems = [];
const originalError = console.error;
console.error = (...args) => problems.push(args.map((value) => String(value)).join(' '));

try {
  const { hydrateRoot } = await import('react-dom/client');
  const root = hydrateRoot(dom.window.document.getElementById('root'), element);
  // Let the layout effects and the first availability answer land.
  await new Promise((resolve) => setTimeout(resolve, 150));
  root.unmount();
} finally {
  console.error = originalError;
}

const mismatches = problems.filter((line) =>
  /hydrat|did not match|mismatch|server rendered|server html/i.test(line),
);
if (mismatches.length > 0) {
  throw new Error(`hydration reported mismatches:\n${mismatches.join('\n')}`);
}

console.log('✓ server render and client hydration agree');
