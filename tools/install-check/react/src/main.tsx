/**
 * A throwaway consumer app used by `tools/verify-install.mjs`.
 *
 * It imports the *packed* library through its public entry points only (`.`,
 * `/styles.css`, plus the core package and its `/dom` subpath) so a broken
 * `exports` map, a missing type declaration or a missing stylesheet fails the
 * check. `motion` is deliberately absent: it is an optional peer, so the base
 * entry has to build without it.
 *
 * `#root` is hydrated: `scripts/prerender.mjs` puts the server's markup there
 * after the build, and the browser then checks that hydration attaches to it
 * without a complaint. The probes render into `#extra`, which the server never
 * renders.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { cx, type Track } from '@nickkupriyanov/soundline-core';
import { observeMediaQuery, trapFocus } from '@nickkupriyanov/soundline-core/dom';
import {
  Player,
  PlayerProvider,
  PlayerView,
  createMockAdapter,
  createMockEngine,
  usePlayerContext,
} from '@nickkupriyanov/soundline-react';
import '@nickkupriyanov/soundline-react/styles.css';

/** The playlist the packaged adapter serves. The scripts keep their own copy. */
const TRACKS: Track[] = [
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

/** Confirms the shipped stylesheet actually reaches the browser. */
function StyleProbe() {
  const [state, setState] = useState('pending');

  useEffect(() => {
    const probe = document.createElement('div');
    probe.className = cx('sn-root', 'probe');
    document.body.appendChild(probe);
    const accent = getComputedStyle(probe).getPropertyValue('--sn-accent').trim();
    const radius = getComputedStyle(probe).getPropertyValue('--sn-radius-card').trim();
    probe.remove();
    setState(accent && radius ? 'ok' : 'missing');
  }, []);

  return <p data-styles={state}>stylesheet: {state}</p>;
}

/** Confirms the `/dom` entry point is exported and reachable. */
function DomProbe() {
  const [reduced, setReduced] = useState('unknown');

  useEffect(() => {
    const stop = observeMediaQuery('(prefers-reduced-motion: reduce)', (matches) =>
      setReduced(matches ? 'reduce' : 'no-preference'),
    );
    return stop;
  }, []);

  return <p data-dom={typeof trapFocus === 'function' ? 'ok' : 'missing'}>dom: {reduced}</p>;
}

/** Confirms the headless API is exported. */
function HeadlessProbe() {
  const { snapshot } = usePlayerContext();
  return <p data-headless-state={snapshot.view.status}>headless state: {snapshot.view.status}</p>;
}

/** Client-only probes: entry points, the stylesheet, the DOM helpers, headless use. */
function Probes() {
  return (
    <StrictMode>
      <StyleProbe />
      <DomProbe />
      <PlayerProvider adapter={adapter} engine={engine}>
        <PlayerView />
        <HeadlessProbe />
      </PlayerProvider>
    </StrictMode>
  );
}

/**
 * Everything the page reports through `console` is kept where a browser check can
 * read it back: hydration mismatches are logged while React boots, which is before
 * any probe could install a listener.
 */
const problems: string[] = [];
for (const level of ['error', 'warn'] as const) {
  const original = console[level];
  console[level] = (...values: unknown[]) => {
    problems.push(`${level}: ${values.map((value) => String(value)).join(' ')}`);
    original(...values);
  };
}
(window as unknown as { __problems: string[] }).__problems = problems;

const root = document.getElementById('root');
const extra = document.getElementById('extra');
if (!root || !extra) throw new Error('missing #root or #extra');

// The very same element the prerender script rendered on the server.
hydrateRoot(root, <Player adapter={adapter} engine={engine} />);
createRoot(extra).render(<Probes />);
