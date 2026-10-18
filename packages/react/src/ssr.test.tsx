/**
 * Server rendering and hydration.
 *
 * The claim under test is one sentence: **the markup a server produces is the
 * markup the client hydrates, and the widget then comes alive.** Three rules make
 * that true, and each is asserted here.
 *
 * 1. **The first render is deterministic.** The visitor's language is read
 *    *after* mounting, so the very first render — the server's and the client's
 *    alike — uses core's `FALLBACK_LOCALE`; the theme is never detected at all
 *    (`FALLBACK_THEME`). The visitor's language arrives as an ordinary update.
 * 2. **The server pass touches no DOM.** `createMediaEngine()` builds no element
 *    until something actually loads, and a server render never starts the
 *    controller, so the `<audio>` element exists only on the client.
 * 3. **The telemetry is serialisable.** `getEngineRef()` is a plain object an
 *    application may render into the page and hand back as `initialEngineRef`;
 *    the client's first snapshot is then literally the server's.
 *
 * A hydration failure is caught three ways, because React reports it in three
 * ways: `onRecoverableError` (the mismatch itself), a silent `console.error`
 * (which also catches act warnings), and the identity of the server-rendered
 * node — a failed hydration throws the server DOM away and builds its own.
 */
import { act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  createMockAdapter,
  createMockEngine,
  type EngineState,
  type Track,
} from '@nickkupriyanov/soundline-core';
import { Player } from './Player';

const TRACK_DURATION = 100;

const tracks: Track[] = [
  { id: 'a', title: 'Alpha', artist: 'One', src: 'a.mp3', duration: TRACK_DURATION },
  { id: 'b', title: 'Beta', artist: 'Two', src: 'b.mp3', duration: TRACK_DURATION },
];

/**
 * A mock engine whose playhead does not tick during a test: this suite is about
 * the hand-over between the markup and the client, not about the timeline.
 */
function mockEngine() {
  return createMockEngine({ duration: TRACK_DURATION, tickMs: 60_000 });
}

/** The telemetry a server pass rendered a paused, one-third-played track from. */
const serverTelemetry: EngineState = {
  status: 'ready',
  src: 'a.mp3',
  currentTime: 42,
  duration: TRACK_DURATION,
  buffered: TRACK_DURATION,
  volume: 1,
  muted: false,
  rate: 1,
  error: null,
};

/* -------------------------------------------------------------------------- */
/*  A host that runs on the client                                             */
/* -------------------------------------------------------------------------- */

/**
 * The visitor's browser in this suite is Russian and its locale is read only
 * after mounting — which is exactly the switch this suite watches.
 */
const browserLanguage = 'ru-RU';

beforeAll(() => {
  Object.defineProperty(navigator, 'language', {
    configurable: true,
    get: () => browserLanguage,
  });
});

afterAll(() => {
  delete (navigator as unknown as Record<string, unknown>).language;
});

const mounted: Array<{ root: Root; container: HTMLElement }> = [];

afterEach(async () => {
  for (const { root, container } of mounted.splice(0)) {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  }
  // Stubs have to outlive the unmount: a stopped controller pauses its engine,
  // and jsdom has no media playback to fall back to.
  vi.restoreAllMocks();
});

/**
 * Takes a server pass into the document and hydrates it the way a page does.
 *
 * `server` defaults to the very element being hydrated — the true page flow — and
 * is only passed separately to stage a deliberate mismatch.
 *
 * The console is watched during the hydration itself, not afterwards: React's
 * warnings about a mismatch — and the act warnings a badly wrapped hydration
 * produces — reach `console.error`, and both would have to be part of the
 * "clean" claim.
 */
async function hydrate(element: ReactElement, server: ReactElement = element) {
  const container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = renderToString(server);
  const serverNode = container.firstElementChild as Element;

  const recoverable: unknown[] = [];
  const consoleErrors: unknown[][] = [];
  const consoleError = vi
    .spyOn(console, 'error')
    .mockImplementation((...args: unknown[]) => consoleErrors.push(args));

  let root: Root | null = null;
  await act(async () => {
    root = hydrateRoot(container, element, {
      onRecoverableError: (error) => recoverable.push(error),
    });
  });
  consoleError.mockRestore();

  mounted.push({ root: root as unknown as Root, container });
  return { container, recoverable, consoleErrors, serverNode };
}

/* -------------------------------------------------------------------------- */
/*  The server pass                                                            */
/* -------------------------------------------------------------------------- */

describe('server rendering', () => {
  it('is deterministic and speaks the fallback locale, whatever the visitor uses', () => {
    const element = <Player adapter={createMockAdapter({ tracks })} engine={mockEngine()} />;
    const html = renderToString(element);

    expect(renderToString(element)).toBe(html);
    expect(html).toContain('lang="en"');
    expect(html).toContain('Audio player');
    // No playlist is known to this pass, so it renders the loading state — and the
    // visitor's language has not been read yet, so the copy is the fallback one.
    expect(html).toContain('data-sn-state="loading"');
    expect(html).toContain('Loading tracks…');
    expect(html).not.toContain('Аудиоплеер');
    expect(html).not.toContain('<audio');
  });

  it('leaves the DOM alone, even through the default media engine', () => {
    // No `engine` prop: this is the path an application takes by simply rendering
    // `<Player adapter={adapter} />` on the server.
    const createElement = vi.spyOn(document, 'createElement');

    const html = renderToString(<Player adapter={createMockAdapter({ tracks })} />);

    expect(html).not.toContain('<audio');
    expect(createElement).not.toHaveBeenCalled();
  });

  it('renders the telemetry it was handed, so the client can start from it', () => {
    // The playlist is known on the server — that is what lets the pass render the
    // transport and the playhead instead of the loading state.
    const element = (
      <Player
        adapter={createMockAdapter({ tracks })}
        engine={mockEngine()}
        defaultQueue={tracks}
        initialEngineRef={serverTelemetry}
      />
    );
    const html = renderToString(element);

    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('0:42 of 1:40');
  });
});

/* -------------------------------------------------------------------------- */
/*  The client pass                                                            */
/* -------------------------------------------------------------------------- */

describe('hydration', () => {
  it('reuses the server markup, then switches to the visitor’s language', async () => {
    const { container, recoverable, consoleErrors, serverNode } = await hydrate(
      <Player adapter={createMockAdapter({ tracks })} engine={mockEngine()} />,
    );

    expect(recoverable).toEqual([]);
    expect(consoleErrors).toEqual([]);
    // Hydration has to adopt the node the server produced, not replace it.
    expect(container.firstElementChild).toBe(serverNode);

    const root = container.querySelector('.sn-root');
    expect(root).toHaveAttribute('lang', browserLanguage);
    expect(container.querySelector('.sn-card')).toHaveAttribute('aria-label', 'Аудиоплеер');
  });

  it('comes alive: the queue arrives and the transport drives the engine', async () => {
    const user = userEvent.setup();
    const { container, recoverable } = await hydrate(
      <Player adapter={createMockAdapter({ tracks })} engine={mockEngine()} />,
    );

    await waitFor(() => expect(container.querySelectorAll('.sn-track-item')).toHaveLength(2));
    expect(recoverable).toEqual([]);

    await user.click(container.querySelector('.sn-play-button') as HTMLElement);

    expect(container.querySelector('.sn-root')).toHaveAttribute('data-sn-playing', 'true');
    expect(container.querySelector('.sn-live')).toHaveTextContent('Сейчас играет: Alpha');
  });

  it('hydrates controlled values to the markup the server rendered', async () => {
    const element = (
      <Player
        adapter={createMockAdapter({ tracks })}
        engine={mockEngine()}
        defaultQueue={tracks}
        theme="light"
        locale="en"
        playing={false}
        volume={0.5}
      />
    );

    const html = renderToString(element);
    expect(html).toContain('data-sn-theme="light"');
    expect(html).toContain('aria-valuenow="50"');

    const { container, recoverable, consoleErrors, serverNode } = await hydrate(element);

    expect(recoverable).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(container.firstElementChild).toBe(serverNode);
    expect(container.querySelector('.sn-volume-slider')).toHaveAttribute('aria-valuenow', '50');
  });

  it('starts from the server telemetry and hands the playhead to the engine', async () => {
    const { container, recoverable, consoleErrors, serverNode } = await hydrate(
      <Player
        adapter={createMockAdapter({ tracks })}
        engine={mockEngine()}
        defaultQueue={tracks}
        initialEngineRef={serverTelemetry}
      />,
    );

    expect(recoverable).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(container.firstElementChild).toBe(serverNode);

    // Mounted and started: the engine owns the telemetry again.
    await waitFor(() =>
      expect(container.querySelector('.sn-seek')).toHaveAttribute('aria-valuenow', '0'),
    );
  });

  it('builds the audio element only once it is live on the client', async () => {
    // jsdom implements no media playback; the element's own calls are stubbed so
    // the test is about *when* something is built, not about audio. The stubs are
    // restored by the suite's cleanup, after the widget has been unmounted.
    vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const createElement = vi.spyOn(document, 'createElement');

    const element = <Player adapter={createMockAdapter({ tracks })} />;
    const html = renderToString(element);
    expect(html).not.toContain('<audio');

    await hydrate(element);

    expect(createElement.mock.calls.some(([tag]) => tag === 'audio')).toBe(true);
  });

  it('would notice a mismatch — the harness is able to fail', async () => {
    // The checks above are only worth anything if they can fail. A server pass in
    // Russian, hydrated with an English client, is the smallest real mismatch there
    // is: the text differs, so React has to say so on one of the two channels.
    const adapter = createMockAdapter({ tracks });
    const { container, recoverable, consoleErrors } = await hydrate(
      <Player adapter={adapter} engine={mockEngine()} locale="en" />,
      <Player adapter={adapter} engine={mockEngine()} locale="ru" />,
    );

    expect(container.querySelector('.sn-card')).toHaveAttribute('aria-label', 'Audio player');
    expect(recoverable.length + consoleErrors.length).toBeGreaterThan(0);
  });
});
