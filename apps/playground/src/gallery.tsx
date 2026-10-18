import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createMockAdapter,
  type SoundlineTheme,
  type TrackSourceAdapter,
} from '@nickkupriyanov/soundline-react';
import '@nickkupriyanov/soundline-react/styles.css';
import './app.css';
import './gallery.css';
import { DemoPlayer, demoTracks, demoTracksUnresolved, type DemoPlayback } from './demo';

/**
 * The state gallery.
 *
 * Every case drives the real widget — a slow source, an empty one, a failing one,
 * or the playback states reached through the public actions — and marks itself on
 * the figure with explicit `data-*` hooks (`data-sn-case`, `data-sn-state`,
 * `data-sn-layout`, `data-sn-theme`). The browser checks read those attributes
 * instead of counting figures, so adding a case never needs a check update.
 */
interface GalleryCase {
  /** `data-sn-case`. */
  id: string;
  caption: string;
  /** The state the driver walks to. */
  state: DemoPlayback;
  layout: 'card' | 'compact';
  /** `data-sn-state`, mirroring the widget's own state block. */
  view: 'ready' | 'loading' | 'empty' | 'error';
  adapter: TrackSourceAdapter;
}

const tracks = createMockAdapter({ tracks: demoTracks });

const CASES: readonly GalleryCase[] = [
  {
    id: 'idle',
    caption: '1 · idle',
    state: 'idle',
    layout: 'card',
    view: 'ready',
    adapter: tracks,
  },
  {
    id: 'playing',
    caption: '2 · playing',
    state: 'playing',
    layout: 'card',
    view: 'ready',
    adapter: tracks,
  },
  {
    id: 'paused',
    caption: '3 · paused',
    state: 'paused',
    layout: 'card',
    view: 'ready',
    adapter: tracks,
  },
  {
    id: 'ended',
    caption: '4 · ended',
    state: 'ended',
    layout: 'card',
    view: 'ready',
    adapter: tracks,
  },
  {
    id: 'loading',
    caption: '5 · loading',
    state: 'idle',
    layout: 'card',
    view: 'loading',
    adapter: createMockAdapter({ tracks: demoTracks, latency: 60000 }),
  },
  {
    id: 'empty',
    caption: '6 · empty',
    state: 'idle',
    layout: 'card',
    view: 'empty',
    adapter: createMockAdapter({ tracks: [] }),
  },
  {
    id: 'error-list',
    caption: '7 · list failed',
    state: 'idle',
    layout: 'card',
    view: 'error',
    adapter: createMockAdapter({ tracks: demoTracks, failure: 'NETWORK_FAILURE' }),
  },
  {
    id: 'error-source',
    caption: '8 · source failed',
    state: 'idle',
    layout: 'card',
    view: 'error',
    adapter: createMockAdapter({
      tracks: demoTracksUnresolved,
      sourceFailures: { 'neon-highway': 'NETWORK_FAILURE' },
    }),
  },
  {
    id: 'compact',
    caption: '9 · compact',
    state: 'idle',
    layout: 'compact',
    view: 'ready',
    adapter: tracks,
  },
];

function Gallery() {
  const [theme, setTheme] = useState<SoundlineTheme>('dark');

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('theme');
    if (requested === 'light' || requested === 'dark') setTheme(requested);
  }, []);

  return (
    <div className="gallery" data-sn-theme={theme}>
      {CASES.map((item) => (
        <figure
          key={item.id}
          className="gallery__item"
          data-sn-case={item.id}
          data-sn-state={item.view}
          data-sn-layout={item.layout}
          data-sn-theme={theme}
        >
          <figcaption>{item.caption}</figcaption>
          <DemoPlayer
            adapter={item.adapter}
            state={item.state}
            layout={item.layout}
            theme={theme}
            locale="en"
          />
        </figure>
      ))}
    </div>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
