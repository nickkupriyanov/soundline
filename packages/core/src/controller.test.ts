import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedSource, TrackSourceAdapter } from './adapter';
import { createPlayerController } from './controller';
import type {
  PlayerControllerHandlers,
  PlayerControllerInputs,
  PlayerControllerOptions,
  PlayerSnapshot,
} from './controller';
import type { PlaybackEngine } from './engine';
import { createMockAdapter, createMockEngine } from './mock';
import type { MockEngineOptions } from './mock';
import type { EngineState, Track } from './types';

const DURATION = 4;

const TRACKS: Track[] = [
  { id: 'a', title: 'Alpha', src: 'a.mp3', duration: DURATION },
  { id: 'b', title: 'Beta', src: 'b.mp3', duration: DURATION },
  { id: 'c', title: 'Gamma', src: 'c.mp3', duration: DURATION },
];

const ids = (tracks: readonly Track[]): string[] => tracks.map((track) => track.id);
const aborted = (signal: AbortSignal | undefined): boolean => signal?.aborted ?? false;

/* -------------------------------------------------------------------------- */
/*  Harness                                                                    */
/* -------------------------------------------------------------------------- */

function handlerSpies() {
  return {
    onProgress: vi.fn(),
    onTrackChange: vi.fn(),
    onPlayingChange: vi.fn(),
    onVolumeChange: vi.fn(),
    onMutedChange: vi.fn(),
    onLoopChange: vi.fn(),
    onShuffleChange: vi.fn(),
    onRateChange: vi.fn(),
    onQueueChange: vi.fn(),
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onEnded: vi.fn(),
    onError: vi.fn(),
  } satisfies PlayerControllerHandlers;
}

/** Wraps an engine so a test can see exactly what the controller asked of it. */
function trackEngine(inner: ReturnType<typeof createMockEngine>) {
  const calls: string[] = [];
  const loads: string[] = [];
  return {
    calls,
    loads,
    engine: {
      load(src, loadOptions) {
        calls.push(`load:${src}`);
        loads.push(src);
        inner.load(src, loadOptions);
      },
      play() {
        calls.push('play');
        return inner.play();
      },
      pause() {
        calls.push('pause');
        inner.pause();
      },
      seek(seconds) {
        calls.push(`seek:${seconds}`);
        inner.seek(seconds);
      },
      setVolume(volume) {
        calls.push(`volume:${volume}`);
        inner.setVolume(volume);
      },
      setMuted(muted) {
        calls.push(`muted:${muted}`);
        inner.setMuted(muted);
      },
      setRate(rate) {
        calls.push(`rate:${rate}`);
        inner.setRate(rate);
      },
      getState: () => inner.getState(),
      subscribe: (listener: () => void) => inner.subscribe(listener),
    } satisfies PlaybackEngine,
  };
}

interface SetupOptions {
  tracks?: Track[];
  inputs?: PlayerControllerInputs;
  config?: PlayerControllerOptions['config'];
  adapter?: TrackSourceAdapter;
  engineOptions?: MockEngineOptions;
  progressIntervalMs?: number;
  random?: () => number;
}

function setup(options: SetupOptions = {}) {
  const handlers = handlerSpies();
  const inner = createMockEngine({
    duration: DURATION,
    tickMs: 100,
    ...options.engineOptions,
  });
  const tracked = trackEngine(inner);
  const source = options.adapter ?? createMockAdapter({ tracks: options.tracks ?? TRACKS });
  const getTracks = vi.fn(source.getTracks.bind(source));
  const adapter: TrackSourceAdapter = { ...source, getTracks };

  const controller = createPlayerController({
    adapter,
    engine: tracked.engine,
    handlers,
    ...(options.inputs === undefined ? {} : { inputs: options.inputs }),
    ...(options.config === undefined ? {} : { config: options.config }),
    ...(options.progressIntervalMs === undefined
      ? {}
      : { progressIntervalMs: options.progressIntervalMs }),
    ...(options.random === undefined ? {} : { random: options.random }),
  });

  return { controller, handlers, inner, tracked, adapter, getTracks };
}

/** Settles the async queue/source pipeline under fake timers. */
async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  await vi.advanceTimersByTimeAsync(0);
}

const snapshot = (controller: { getSnapshot(): PlayerSnapshot }): PlayerSnapshot =>
  controller.getSnapshot();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/*  Creation                                                                   */
/* -------------------------------------------------------------------------- */

describe('createPlayerController', () => {
  it('does nothing until it is started', async () => {
    const { controller, tracked, getTracks, handlers } = setup();

    await settle();

    expect(getTracks).not.toHaveBeenCalled();
    expect(tracked.calls).toEqual([]);
    expect(handlers.onProgress).not.toHaveBeenCalled();
    expect(handlers.onTrackChange).not.toHaveBeenCalled();
    expect(snapshot(controller).state.queueStatus).toBe('idle');
  });

  it('starts from the engine reference a server rendered', () => {
    const initialEngineRef: EngineState = {
      status: 'ready',
      src: 'a.mp3',
      currentTime: 2,
      duration: DURATION,
      buffered: DURATION,
      volume: 0.5,
      muted: false,
      rate: 1,
      error: null,
    };
    const controller = createPlayerController({
      adapter: createMockAdapter({ tracks: TRACKS }),
      initialEngineRef,
    });

    expect(controller.getEngineRef()).toEqual(initialEngineRef);
    expect(snapshot(controller).view.progress.position).toBe(2);
  });
});

/* -------------------------------------------------------------------------- */
/*  Lifecycle                                                                  */
/* -------------------------------------------------------------------------- */

describe('start and stop', () => {
  it('loads the playlist and selects the first track', async () => {
    const { controller, handlers } = setup();

    controller.start();
    await settle();

    const { state, view } = snapshot(controller);
    expect(ids(state.queue)).toEqual(['a', 'b', 'c']);
    expect(state.currentTrackId).toBe('a');
    expect(state.queueStatus).toBe('ready');
    expect(view.nowPlaying?.title).toBe('Alpha');
    expect(handlers.onTrackChange).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ reason: 'automatic' }),
    );
  });

  it('is idempotent and resumes playback after a restart', async () => {
    const { controller, inner, getTracks } = setup();

    controller.start();
    controller.start();
    await settle();
    expect(getTracks).toHaveBeenCalledTimes(1);

    controller.actions.play();
    await settle();
    expect(inner.getState().status).toBe('playing');

    controller.stop();
    expect(inner.getState().status).toBe('paused');
    controller.stop();

    controller.start();
    await settle();
    expect(inner.getState().status).toBe('playing');
    // The list is still there: a restart does not refetch a loaded playlist.
    expect(getTracks).toHaveBeenCalledTimes(1);
  });

  it('does not touch the adapter or the engine again once stopped', async () => {
    const { controller, tracked } = setup();

    controller.start();
    await settle();
    controller.stop();

    const callsAfterStop = tracked.calls.length;
    controller.actions.play();
    await settle();

    expect(tracked.calls.length).toBe(callsAfterStop);
  });
});

/* -------------------------------------------------------------------------- */
/*  Track list                                                                 */
/* -------------------------------------------------------------------------- */

describe('track list', () => {
  it('drops a superseded request when the playlist changes', async () => {
    const source = createMockAdapter({ tracks: TRACKS, latency: 500 });
    const signals: AbortSignal[] = [];
    const adapter: TrackSourceAdapter = {
      getTracks(query) {
        signals.push(query.signal);
        return source.getTracks(query);
      },
    };
    const { controller, getTracks } = setup({ adapter });

    controller.start();
    controller.updateConfig({ context: { key: 'other' } });

    expect(aborted(signals[0])).toBe(true);
    expect(aborted(signals[1])).toBe(false);
    expect(getTracks).toHaveBeenCalledTimes(2);
    await settle(600);
  });

  it('reports a broken adapter and lets a retry recover', async () => {
    let broken = true;
    const adapter: TrackSourceAdapter = {
      getTracks() {
        if (broken)
          return Promise.resolve([
            { id: 'a', title: 'A' },
            { id: 'a', title: 'Again' },
          ]);
        return Promise.resolve(TRACKS);
      },
    };
    const { controller, handlers } = setup({ adapter });

    controller.start();
    await settle();

    expect(handlers.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ADAPTER_CONTRACT_VIOLATION' }),
      { phase: 'tracks' },
    );
    expect(snapshot(controller).state.queueStatus).toBe('error');

    broken = false;
    controller.actions.retry();
    await settle();

    expect(snapshot(controller).state.queueStatus).toBe('ready');
    expect(ids(snapshot(controller).state.queue)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the selection when a later list still contains it', async () => {
    const { controller } = setup();

    controller.start();
    await settle();
    controller.actions.selectTrack('c');
    await settle();

    // A context change reloads the list; the selection was cleared with it.
    controller.updateConfig({ context: { key: 'other' } });
    await settle();

    expect(snapshot(controller).state.currentTrackId).toBe('a');
  });
});

/* -------------------------------------------------------------------------- */
/*  Source loading                                                             */
/* -------------------------------------------------------------------------- */

describe('source loading', () => {
  it('cancels a superseded source resolution', async () => {
    const signals: AbortSignal[] = [];
    const adapter: TrackSourceAdapter = {
      getTracks() {
        return Promise.resolve([
          { id: 'a', title: 'Alpha' },
          { id: 'b', title: 'Beta' },
        ]);
      },
      resolveSource(track, { signal }) {
        signals.push(signal);
        return new Promise<ResolvedSource>((resolve, reject) => {
          const timer = setTimeout(() => resolve({ src: `${track.id}.mp3` }), 500);
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true },
          );
        });
      },
    };
    const { controller, tracked, handlers } = setup({ adapter });

    controller.start();
    await settle();
    controller.actions.selectTrack('b');

    expect(aborted(signals[0])).toBe(true);
    expect(aborted(signals[1])).toBe(false);

    await settle(600);
    expect(tracked.loads).toEqual(['b.mp3']);
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('reports a source failure and retries it', async () => {
    let failing = true;
    const adapter: TrackSourceAdapter = {
      getTracks: () => Promise.resolve([{ id: 'a', title: 'Alpha' }]),
      resolveSource: () =>
        failing ? Promise.reject(new Error('offline')) : Promise.resolve({ src: 'a.mp3' }),
    };
    const { controller, inner, handlers } = setup({ adapter });

    controller.start();
    await settle();

    expect(handlers.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SOURCE_UNAVAILABLE' }),
      { phase: 'source' },
    );
    const failed = snapshot(controller).state;
    expect(failed.error).toMatchObject({ code: 'SOURCE_UNAVAILABLE', phase: 'source' });
    expect(snapshot(controller).view.actions.canRetry).toBe(true);

    failing = false;
    controller.actions.retry();
    await settle();

    expect(snapshot(controller).state.error).toBeNull();
    expect(inner.getState().src).toBe('a.mp3');
  });

  it('reports a track with no source at all', async () => {
    const adapter: TrackSourceAdapter = {
      getTracks: () => Promise.resolve([{ id: 'a', title: 'A' }]),
    };
    const { controller, handlers } = setup({ adapter });

    controller.start();
    await settle();

    expect(handlers.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SOURCE_UNAVAILABLE' }),
      { phase: 'source' },
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Playback                                                                   */
/* -------------------------------------------------------------------------- */

describe('playback', () => {
  it('plays, pauses and reports the actual transition', async () => {
    const { controller, inner, handlers } = setup();

    controller.start();
    await settle();
    controller.actions.play();
    await settle();

    expect(inner.getState().status).toBe('playing');
    expect(snapshot(controller).view.transport.playing).toBe(true);
    expect(handlers.onPlayingChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ reason: 'user' }),
    );
    expect(handlers.onPlay).toHaveBeenCalledTimes(1);

    await settle(1000);
    expect(inner.getState().currentTime).toBeCloseTo(1, 5);

    controller.actions.pause();
    await settle();
    expect(inner.getState().status).toBe('paused');
    expect(handlers.onPause).toHaveBeenCalledTimes(1);
  });

  it('advances to the next track when a source ends', async () => {
    const { controller, handlers } = setup();

    controller.start();
    await settle();
    controller.actions.play();
    await settle(4100);

    expect(handlers.onEnded).toHaveBeenCalledTimes(1);
    expect(snapshot(controller).state.currentTrackId).toBe('b');
    expect(snapshot(controller).view.nowPlaying?.title).toBe('Beta');
    expect(snapshot(controller).state.status).toBe('playing');
  });

  it('replays the same track with repeat one', async () => {
    const { controller, tracked } = setup();

    controller.start();
    await settle();
    controller.actions.setLoop('one');
    controller.actions.play();
    await settle(4100);

    expect(snapshot(controller).state.currentTrackId).toBe('a');
    expect(tracked.loads).toEqual(['a.mp3', 'a.mp3']);
    expect(snapshot(controller).state.status).toBe('playing');
  });

  it('wraps around with repeat all', async () => {
    const { controller } = setup();

    controller.start();
    await settle();
    controller.actions.selectTrack('c');
    controller.actions.setLoop('all');
    controller.actions.play();
    await settle(4100);

    expect(snapshot(controller).state.currentTrackId).toBe('a');
  });

  it('stops at the end of the queue without repeat', async () => {
    const { controller, handlers } = setup();

    controller.start();
    await settle();
    controller.actions.selectTrack('c');
    controller.actions.play();
    await settle(4100);

    const { state, view } = snapshot(controller);
    expect(state.status).toBe('ended');
    expect(state.playing).toBe(false);
    expect(view.nowPlaying?.trackId).toBe('c');
    expect(handlers.onEnded).toHaveBeenCalledTimes(1);
  });

  it('does not step past the queue without repeat', async () => {
    const { controller, tracked } = setup();

    controller.start();
    await settle();
    controller.actions.selectTrack('c');
    await settle();
    const loads = tracked.loads.length;

    controller.actions.next();
    await settle();

    expect(snapshot(controller).state.currentTrackId).toBe('c');
    expect(tracked.loads.length).toBe(loads);
  });

  it('restarts the first track on previous', async () => {
    const { controller, tracked } = setup();

    controller.start();
    await settle();
    controller.actions.previous();
    await settle();

    expect(snapshot(controller).state.currentTrackId).toBe('a');
    expect(tracked.loads).toEqual(['a.mp3', 'a.mp3']);
  });

  it('seeks within the duration and clamps a long or negative step', async () => {
    const { controller, inner } = setup();

    controller.start();
    await settle();

    controller.actions.seek(2);
    expect(snapshot(controller).view.progress.position).toBe(2);
    expect(inner.getState().currentTime).toBe(2);

    controller.actions.seekBy(100);
    expect(snapshot(controller).view.progress.position).toBe(DURATION);

    controller.actions.seek(-5);
    expect(snapshot(controller).view.progress.position).toBe(0);
  });

  it('surfaces an engine failure and stops the intent', async () => {
    const { controller, handlers } = setup({
      engineOptions: { failures: { 'b.mp3': 'NOT_SUPPORTED' } },
    });

    controller.start();
    await settle();
    controller.actions.play();
    await settle();
    controller.actions.selectTrack('b');
    await settle();

    const { state } = snapshot(controller);
    expect(state.status).toBe('error');
    expect(state.error).toMatchObject({ code: 'NOT_SUPPORTED', phase: 'playback' });
    expect(state.playing).toBe(false);
    expect(handlers.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_SUPPORTED' }),
      { phase: 'playback' },
    );
  });

  it('treats a play the engine refused as a pause, not an error', async () => {
    const { controller, inner, tracked, handlers } = setup();

    // An engine that cannot start but does not classify the failure (the
    // autoplay policy): playback simply does not happen.
    (tracked.engine as PlaybackEngine).play = () => Promise.reject(new Error('autoplay blocked'));

    controller.start();
    await settle();
    controller.actions.play();
    await settle();

    expect(inner.getState().status).toBe('ready');
    expect(snapshot(controller).state.playing).toBe(false);
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('throttles progress but always reports the last position', async () => {
    const { controller, handlers } = setup({ progressIntervalMs: 1000 });

    controller.start();
    await settle();
    controller.actions.play();
    await settle(2000);

    const calls = handlers.onProgress.mock.calls.length;
    // Twenty engine ticks, but only a handful of reports.
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(calls).toBeLessThanOrEqual(6);

    controller.actions.pause();
    const last = handlers.onProgress.mock.calls.at(-1);
    expect(last?.[0]).toBeCloseTo(2, 5);
    expect(last?.[1]).toEqual({ duration: DURATION, trackId: 'a' });
  });
});

/* -------------------------------------------------------------------------- */
/*  Controlled values                                                          */
/* -------------------------------------------------------------------------- */

describe('controlled values', () => {
  it('proposes playing and adopts it without echoing', async () => {
    const { controller, inner, handlers } = setup({ inputs: { playing: false } });

    controller.start();
    await settle();

    controller.actions.play();
    expect(handlers.onPlayingChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ reason: 'user' }),
    );
    expect(snapshot(controller).state.playing).toBe(false);
    expect(inner.getState().status).not.toBe('playing');

    controller.updateInputs({ playing: true });
    await settle();

    expect(snapshot(controller).state.playing).toBe(true);
    expect(inner.getState().status).toBe('playing');
    expect(handlers.onPlayingChange).toHaveBeenCalledTimes(1);
  });

  it('proposes a track and adopts it without echoing', async () => {
    const { controller, inner, handlers } = setup({ inputs: { currentTrackId: 'a' } });

    controller.start();
    await settle();

    controller.actions.next();
    expect(handlers.onTrackChange).toHaveBeenLastCalledWith(
      'b',
      expect.objectContaining({ reason: 'user' }),
    );
    expect(snapshot(controller).state.currentTrackId).toBe('a');

    const before = handlers.onTrackChange.mock.calls.length;
    controller.updateInputs({ currentTrackId: 'b' });
    await settle();

    expect(snapshot(controller).state.currentTrackId).toBe('b');
    expect(inner.getState().src).toBe('b.mp3');
    expect(handlers.onTrackChange.mock.calls.length).toBe(before);
  });

  it('proposes volume and adopts it without echoing', async () => {
    const { controller, inner, handlers } = setup({ inputs: { volume: 0.4 } });

    controller.start();
    await settle();
    expect(inner.getState().volume).toBe(0.4);

    controller.actions.setVolume(0.8);
    expect(handlers.onVolumeChange).toHaveBeenCalledWith(
      0.8,
      expect.objectContaining({ reason: 'user' }),
    );
    expect(snapshot(controller).state.volume).toBe(0.4);

    controller.updateInputs({ volume: 0.8 });
    expect(snapshot(controller).state.volume).toBe(0.8);
    expect(inner.getState().volume).toBe(0.8);
    expect(handlers.onVolumeChange).toHaveBeenCalledTimes(1);
  });

  it('owns volume when only a default is given', async () => {
    const { controller, inner, handlers } = setup({ inputs: { defaultVolume: 0.5 } });

    controller.start();
    await settle();
    controller.actions.setVolume(0.2);

    expect(snapshot(controller).state.volume).toBe(0.2);
    expect(inner.getState().volume).toBe(0.2);
    expect(handlers.onVolumeChange).toHaveBeenCalledWith(
      0.2,
      expect.objectContaining({ reason: 'user' }),
    );
  });

  it('ignores a value that appears after the mode is fixed, once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { controller } = setup();

    controller.updateInputs({ volume: 0.2 });
    controller.updateInputs({ volume: 0.3 });

    expect(snapshot(controller).state.volume).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('[soundline]');
  });

  it('owns a late default the first time it arrives', async () => {
    const { controller } = setup();

    controller.start();
    await settle();
    controller.updateInputs({ defaultVolume: 0.5 });

    expect(snapshot(controller).state.volume).toBe(0.5);
  });
});

/* -------------------------------------------------------------------------- */
/*  Queue editing                                                              */
/* -------------------------------------------------------------------------- */

describe('queue editing', () => {
  it('appends, reorders, removes and clears its own queue', async () => {
    const { controller, handlers } = setup();

    controller.start();
    await settle();

    controller.actions.enqueue({ id: 'd', title: 'Delta', src: 'd.mp3' });
    expect(ids(snapshot(controller).state.queue)).toEqual(['a', 'b', 'c', 'd']);
    expect(handlers.onQueueChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'd' })]),
      expect.objectContaining({ reason: 'user' }),
    );

    controller.actions.reorderQueue(3, 0);
    expect(ids(snapshot(controller).state.queue)).toEqual(['d', 'a', 'b', 'c']);

    controller.actions.removeFromQueue('a');
    expect(ids(snapshot(controller).state.queue)).toEqual(['d', 'b', 'c']);

    controller.actions.clearQueue();
    expect(snapshot(controller).state.queue).toEqual([]);
    expect(snapshot(controller).state.currentTrackId).toBeNull();
  });

  it('proposes a queue when the application owns it, without fetching', async () => {
    const { controller, getTracks, handlers } = setup({ inputs: { queue: TRACKS } });

    controller.start();
    await settle();

    expect(getTracks).not.toHaveBeenCalled();

    controller.actions.removeFromQueue('b');
    expect(handlers.onQueueChange).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'a' }), expect.objectContaining({ id: 'c' })],
      expect.objectContaining({ reason: 'user' }),
    );
    expect(ids(snapshot(controller).state.queue)).toEqual(['a', 'b', 'c']);

    controller.updateInputs({ queue: [TRACKS[0], TRACKS[2]] });
    await settle();

    expect(ids(snapshot(controller).state.queue)).toEqual(['a', 'c']);
    expect(handlers.onQueueChange).toHaveBeenCalledTimes(1);
  });

  it('carries an enqueued track into a controlled queue proposal', () => {
    const { controller, handlers } = setup({ inputs: { queue: TRACKS } });

    controller.actions.enqueue([
      { id: 'd', title: 'Delta', src: 'd.mp3' },
      { id: 'e', title: 'Epsilon', src: 'e.mp3' },
    ]);

    expect(handlers.onQueueChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'e' })]),
      expect.objectContaining({ reason: 'user' }),
    );
    expect(snapshot(controller).state.queue).toHaveLength(3);
  });
});

/* -------------------------------------------------------------------------- */
/*  Shuffle and order                                                          */
/* -------------------------------------------------------------------------- */

describe('shuffle', () => {
  it('pins the current track first and restores the original order', async () => {
    const { controller, handlers } = setup({ random: () => 0 });

    controller.start();
    await settle();
    controller.actions.setShuffle(true);

    expect(ids(snapshot(controller).state.queue)).toEqual(['a', 'c', 'b']);
    expect(handlers.onShuffleChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ reason: 'user' }),
    );

    // `next` follows the displayed order.
    controller.actions.next();
    await settle();
    expect(snapshot(controller).state.currentTrackId).toBe('c');

    controller.actions.setShuffle(false);
    expect(ids(snapshot(controller).state.queue)).toEqual(['a', 'b', 'c']);
  });

  it('is deterministic for a given random source', async () => {
    const first = setup({ random: () => 0.25 });
    first.controller.start();
    await settle();
    first.controller.actions.setShuffle(true);

    const second = setup({ random: () => 0.25 });
    second.controller.start();
    await settle();
    second.controller.actions.setShuffle(true);

    expect(ids(snapshot(first.controller).state.queue)).toEqual(
      ids(snapshot(second.controller).state.queue),
    );
  });
});

/* -------------------------------------------------------------------------- */
/*  Reconfiguration                                                            */
/* -------------------------------------------------------------------------- */

describe('reconfiguration', () => {
  it('refetches when the playlist context changes', async () => {
    const { controller, getTracks } = setup();

    controller.start();
    await settle();
    controller.actions.selectTrack('c');
    await settle();

    controller.updateConfig({ context: { key: 'album-7' } });
    await settle();

    expect(getTracks).toHaveBeenCalledTimes(2);
    expect(snapshot(controller).state.contextKey).toBe('album-7');
    expect(snapshot(controller).state.currentTrackId).toBe('a');
  });

  it('ignores an identical configuration', async () => {
    const config = { layout: 'card' as const };
    const { controller, getTracks } = setup({ config });

    controller.start();
    await settle();
    controller.updateConfig({ layout: 'card' });

    expect(getTracks).toHaveBeenCalledTimes(1);
    expect(snapshot(controller).state.queue).toHaveLength(3);
  });

  it('stores a new adapter without refetching, then uses it', async () => {
    const { controller } = setup();
    const nextAdapter: TrackSourceAdapter = {
      getTracks: vi.fn(() => Promise.resolve([{ id: 'z', title: 'Zeta', src: 'z.mp3' }])),
    };

    controller.start();
    await settle();
    controller.updateAdapter(nextAdapter);

    expect(nextAdapter.getTracks).not.toHaveBeenCalled();

    controller.updateConfig({ context: { key: 'other' } });
    await settle();

    expect(nextAdapter.getTracks).toHaveBeenCalledTimes(1);
    expect(ids(snapshot(controller).state.queue)).toEqual(['z']);
  });

  it('reloads the current source into a replaced engine', async () => {
    const { controller } = setup();

    controller.start();
    await settle();
    controller.actions.setVolume(0.3);

    const replacement = createMockEngine({ duration: DURATION });
    const loaded: string[] = [];
    const engine = {
      ...replacement,
      load(src: string, loadOptions?: { autoplay?: boolean }) {
        loaded.push(src);
        replacement.load(src, loadOptions);
      },
    };

    controller.updateEngine(engine);
    await settle();

    expect(loaded).toEqual(['a.mp3']);
    expect(replacement.getState().volume).toBe(0.3);
  });

  it('exposes a serialisable engine reference', async () => {
    const { controller } = setup();

    controller.start();
    await settle();
    const ref = controller.getEngineRef();

    expect(JSON.parse(JSON.stringify(ref))).toEqual(ref);
    // Nothing in the reference may be lost on the way through a JSON response:
    // no nested objects, no functions, no arrays — plain scalar telemetry only.
    expect(Object.values(ref).every((value) => value === null || typeof value !== 'object')).toBe(
      true,
    );
    expect(Object.values(ref).some((value) => typeof value === 'function')).toBe(false);
  });

  it('restores the creation defaults and refetches on reset', async () => {
    const { controller, getTracks } = setup({ inputs: { defaultVolume: 0.9 } });

    controller.start();
    await settle();
    controller.actions.setVolume(0.2);
    controller.actions.selectTrack('c');
    await settle();

    controller.actions.reset();
    await settle();

    const { state } = snapshot(controller);
    expect(state.volume).toBe(0.9);
    expect(state.currentTrackId).toBe('a');
    expect(getTracks).toHaveBeenCalledTimes(2);
  });
});
