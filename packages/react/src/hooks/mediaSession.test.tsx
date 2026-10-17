/**
 * The Media Session integration, as tests.
 *
 * `jsdom` has neither `navigator.mediaSession` nor `MediaMetadata`, so the suite
 * installs both by hand and then asserts the two halves of the contract: what
 * the widget *publishes* (metadata, playback state, position) and what it
 * *accepts* (the hardware buttons bound back to the controller's actions). The
 * remaining cases pin the fallbacks down — no API, an action the browser refuses
 * — because "modern" must never mean "crashes where the API is missing".
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAdapter, createMockEngine, type Track } from '@nickkupriyanov/soundline-core';
import { PlayerProvider } from '../Player';
import { PlayerView } from '../components/PlayerView';
import { usePlayerContext } from '../context';
import type { SoundlineProps } from '../types';

const tracks: Track[] = [
  {
    id: 'a',
    title: 'Alpha',
    artist: 'One',
    album: 'First',
    artwork: 'a.png',
    src: 'a.mp3',
    duration: 120,
  },
  { id: 'b', title: 'Beta', artist: 'Two', src: 'b.mp3', duration: 120 },
];

/* -------------------------------------------------------------------------- */
/*  A Media Session stand-in                                                   */
/* -------------------------------------------------------------------------- */

type Handler = (details?: MediaSessionActionDetails) => void;

/** The bits of `MediaMetadata` the hook sets, so a test can read them back. */
class FakeMediaMetadata {
  title: string;
  artist?: string;
  album?: string;
  artwork?: { src: string }[];

  constructor(init: MediaMetadataInit) {
    this.title = init.title ?? '';
    if (init.artist !== undefined) this.artist = init.artist;
    if (init.album !== undefined) this.album = init.album;
    if (init.artwork !== undefined) this.artwork = init.artwork as { src: string }[];
  }
}

interface FakeMediaSession {
  metadata: unknown;
  playbackState: string;
  position: unknown;
  /** The handlers currently registered, by action. */
  handlers: Map<string, Handler | null>;
  /** Actions `setActionHandler` refuses, like a browser without support for them. */
  refuse: Set<string>;
  setActionHandler(action: string, handler: Handler | null): void;
  setPositionState(state?: unknown): void;
}

function installMediaSession(): FakeMediaSession {
  const session: FakeMediaSession = {
    metadata: null,
    playbackState: 'none',
    position: undefined,
    handlers: new Map(),
    refuse: new Set(),
    setActionHandler(action, handler) {
      if (session.refuse.has(action)) throw new Error(`unsupported action: ${action}`);
      session.handlers.set(action, handler);
    },
    setPositionState(state) {
      session.position = state;
    },
  };

  Object.defineProperty(navigator, 'mediaSession', { configurable: true, get: () => session });
  return session;
}

function removeMediaSession(): void {
  delete (navigator as unknown as Record<string, unknown>).mediaSession;
}

beforeEach(() => {
  vi.stubGlobal('MediaMetadata', FakeMediaMetadata);
});

afterEach(() => {
  vi.unstubAllGlobals();
  removeMediaSession();
});

/* -------------------------------------------------------------------------- */
/*  Harness                                                                    */
/* -------------------------------------------------------------------------- */

function Probe() {
  const { snapshot } = usePlayerContext();

  return (
    <>
      <span data-testid="track">{snapshot.state.currentTrackId ?? 'none'}</span>
      <span data-testid="playing">{String(snapshot.state.playing)}</span>
      <span data-testid="position">{snapshot.state.currentTime}</span>
    </>
  );
}

function Harness(props: Pick<SoundlineProps, 'mediaSession'>) {
  return (
    <PlayerProvider
      adapter={createMockAdapter({ tracks })}
      engine={createMockEngine({ duration: 120, tickMs: 60_000 })}
      {...props}
    >
      <PlayerView />
      <Probe />
    </PlayerProvider>
  );
}

/** Runs a registered handler the way the browser would. */
async function press(session: FakeMediaSession, action: string, details?: object): Promise<void> {
  const handler = session.handlers.get(action);
  expect(handler).toBeTypeOf('function');
  await act(async () => {
    handler?.(details as MediaSessionActionDetails);
  });
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('Media Session', () => {
  it('claims nothing while the integration is off', async () => {
    const session = installMediaSession();
    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId('track')).toHaveTextContent('a'));

    expect(session.handlers.size).toBe(0);
    expect(session.metadata).toBeNull();
  });

  it('publishes the current track, the state and the position', async () => {
    const session = installMediaSession();
    render(<Harness mediaSession />);

    await waitFor(() =>
      expect(session.metadata).toMatchObject({
        title: 'Alpha',
        artist: 'One',
        album: 'First',
        artwork: [{ src: 'a.png' }],
      }),
    );
    expect(session.playbackState).toBe('paused');
    expect(session.position).toMatchObject({ duration: 120, position: 0, playbackRate: 1 });
  });

  it('follows the playhead and the playing state', async () => {
    const session = installMediaSession();
    render(<Harness mediaSession />);

    await waitFor(() => expect(screen.getByTestId('track')).toHaveTextContent('a'));

    await press(session, 'play');
    await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('true'));
    expect(session.playbackState).toBe('playing');

    await press(session, 'pause');
    await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('false'));
    expect(session.playbackState).toBe('paused');
  });

  it('moves through the queue from the media keys', async () => {
    const session = installMediaSession();
    render(<Harness mediaSession />);

    await waitFor(() => expect(screen.getByTestId('track')).toHaveTextContent('a'));

    await press(session, 'nexttrack');
    await waitFor(() => expect(screen.getByTestId('track')).toHaveTextContent('b'));
    await waitFor(() => expect(session.metadata).toMatchObject({ title: 'Beta' }));

    await press(session, 'previoustrack');
    await waitFor(() => expect(screen.getByTestId('track')).toHaveTextContent('a'));
  });

  it('seeks by the configured skip distance, and by the browser one when given', async () => {
    const session = installMediaSession();
    render(<Harness mediaSession={{ skipSeconds: 30 }} />);

    await waitFor(() => expect(screen.getByTestId('track')).toHaveTextContent('a'));

    await press(session, 'seekforward', { action: 'seekforward' });
    await waitFor(() => expect(screen.getByTestId('position')).toHaveTextContent('30'));
    expect(session.position).toMatchObject({ position: 30 });

    await press(session, 'seekbackward', { action: 'seekbackward' });
    await waitFor(() => expect(screen.getByTestId('position')).toHaveTextContent('0'));

    await press(session, 'seekforward', { action: 'seekforward', seekOffset: 5 });
    await waitFor(() => expect(screen.getByTestId('position')).toHaveTextContent('5'));
  });

  it('jumps to an absolute position on `seekto`', async () => {
    const session = installMediaSession();
    render(<Harness mediaSession />);

    await waitFor(() => expect(screen.getByTestId('track')).toHaveTextContent('a'));

    await press(session, 'seekto', { action: 'seekto', seekTime: 80 });
    await waitFor(() => expect(screen.getByTestId('position')).toHaveTextContent('80'));
    expect(session.position).toMatchObject({ position: 80 });
  });

  it('falls back silently where the API is missing', async () => {
    removeMediaSession();
    render(<Harness mediaSession />);

    await waitFor(() => expect(screen.getByTestId('track')).toHaveTextContent('a'));
    // Nothing threw, and the widget still works through its own controls.
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('keeps the other handlers when the browser refuses one action', async () => {
    const session = installMediaSession();
    session.refuse.add('previoustrack');
    render(<Harness mediaSession />);

    await waitFor(() => expect(session.handlers.has('play')).toBe(true));

    expect(session.handlers.has('previoustrack')).toBe(false);
    expect(session.handlers.has('nexttrack')).toBe(true);
  });

  it('releases the session on unmount', async () => {
    const session = installMediaSession();
    const { unmount } = render(<Harness mediaSession />);

    await waitFor(() => expect(session.handlers.has('play')).toBe(true));

    unmount();

    // Every handler is handed back as `null`; the browser stops calling us.
    expect([...session.handlers.values()].every((handler) => handler === null)).toBe(true);
  });
});
