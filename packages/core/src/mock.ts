/**
 * Deterministic fakes: a fake engine and a fake track source.
 *
 * They exist so the core, the React binding, Storybook and the playground can be
 * driven without a network or audio hardware. Both take every source of
 * non-determinism — the clock, the latency, the failures — as an option, so the
 * same inputs always produce the same timeline and a test never has to wait on
 * real time.
 *
 * The mock engine advances the playhead from an injected clock (`now`) and a
 * `setInterval` tick, which means `vi.useFakeTimers()` alone gives a test exact
 * control: advancing the timers advances both the tick and `Date.now()`.
 */
import type { TrackQuery, ResolvedSource, TrackSourceAdapter } from './adapter';
import { MAX_RATE, MIN_RATE } from './config';
import { clamp } from './duration';
import { createEngineState, type LoadOptions, type PlaybackEngine } from './engine';
import { createAbortError, PlaybackError } from './errors';
import type { EngineState, PlaybackErrorCode, Track } from './types';

/** Default duration of a mock source, in seconds. */
export const DEFAULT_MOCK_DURATION = 180;
/** Default interval at which the mock playhead advances, in milliseconds. */
export const DEFAULT_MOCK_TICK = 250;

/* -------------------------------------------------------------------------- */
/*  Mock engine                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Injection point of {@link createMockEngine}.
 *
 * `failures` maps a source URL to the code loading it should fail with, which is
 * how a test reaches the player's error states without a real network.
 */
export interface MockEngineOptions {
  /** Duration of every loaded source, in seconds. Default: {@link DEFAULT_MOCK_DURATION}. */
  duration?: number;
  /** Simulated load latency, in milliseconds. Default: `0` (ready synchronously). */
  latency?: number;
  /** Sources that fail to load, mapped to the code to report. */
  failures?: Readonly<Record<string, PlaybackErrorCode>>;
  /** Clock in milliseconds. Default: `Date.now`. */
  now?: () => number;
  /** How often the playhead advances while playing, in milliseconds. Default: {@link DEFAULT_MOCK_TICK}. */
  tickMs?: number;
}

/** Options of {@link createMockAdapter}. */
export interface MockAdapterOptions<TData = unknown> {
  /** The tracks `getTracks` returns. */
  tracks: readonly Track<TData>[];
  /** Simulated latency for both calls, in milliseconds. Default: `0`. */
  latency?: number;
  /** When set, `getTracks` fails with this code. */
  failure?: PlaybackErrorCode | null;
  /** Track ids whose `resolveSource` fails, mapped to the code to report. */
  sourceFailures?: Readonly<Record<string, PlaybackErrorCode>>;
}

function durationOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * A fake playback engine on a virtual timeline.
 *
 * `load` becomes `ready` after `latency` milliseconds (synchronously by default);
 * `play` starts a ticker that advances the playhead from `now()` at the current
 * rate and reports `ended` at the configured duration. A `play()` issued while a
 * slow source is still loading resolves once that source is ready, mirroring how
 * a media element starts as soon as it can.
 */
export function createMockEngine(options: MockEngineOptions = {}): PlaybackEngine {
  const duration = durationOr(options.duration, DEFAULT_MOCK_DURATION);
  const latency = Math.max(0, options.latency ?? 0);
  const failures = options.failures ?? {};
  const now = options.now ?? Date.now;
  const tickMs = Math.max(1, options.tickMs ?? DEFAULT_MOCK_TICK);

  const listeners = new Set<() => void>();
  const state = createEngineState();
  let loadTimer: ReturnType<typeof setTimeout> | null = null;
  let ticker: ReturnType<typeof setInterval> | null = null;
  let startedAt = 0;
  let startOffset = 0;
  let pendingPlay: { resolve: () => void; reject: (error: unknown) => void } | null = null;

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  function stopTicker(): void {
    if (ticker !== null) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  function stopLoadTimer(): void {
    if (loadTimer !== null) {
      clearTimeout(loadTimer);
      loadTimer = null;
    }
  }

  function takePending(): { resolve: () => void; reject: (error: unknown) => void } | null {
    const pending = pendingPlay;
    pendingPlay = null;
    return pending;
  }

  /** The playhead implied by the clock, clamped to the source duration. */
  function sample(): number {
    if (state.status !== 'playing') return state.currentTime;
    return Math.min(duration, startOffset + ((now() - startedAt) / 1000) * state.rate);
  }

  function finish(): void {
    stopTicker();
    state.currentTime = duration;
    state.buffered = duration;
    state.status = 'ended';
    notify();
  }

  function tick(): void {
    const time = sample();
    state.currentTime = time;
    state.buffered = duration;
    if (time >= duration) {
      finish();
      return;
    }
    notify();
  }

  function startTicker(): void {
    stopTicker();
    startedAt = now();
    startOffset = state.currentTime;
    ticker = setInterval(tick, tickMs);
  }

  function completeLoad(src: string): void {
    loadTimer = null;
    const code = failures[src];
    if (code !== undefined) {
      state.status = 'error';
      state.error = code;
      notify();
      takePending()?.reject(
        new PlaybackError({ code, message: `Soundline: mock failure for "${src}"` }),
      );
      return;
    }

    state.status = 'ready';
    state.duration = duration;
    state.buffered = duration;
    notify();

    const pending = takePending();
    if (pending) void play().then(pending.resolve, pending.reject);
  }

  function load(src: string, loadOptions: LoadOptions = {}): void {
    stopTicker();
    stopLoadTimer();
    takePending()?.reject(createAbortError());

    state.src = src;
    state.status = 'loading';
    state.currentTime = 0;
    state.duration = 0;
    state.buffered = 0;
    state.error = null;
    notify();

    if (latency > 0) loadTimer = setTimeout(() => completeLoad(src), latency);
    else completeLoad(src);

    if (loadOptions.autoplay) void play();
  }

  function play(): Promise<void> {
    if (state.status === 'error') {
      return Promise.reject(
        new PlaybackError({
          code: state.error ?? 'UNKNOWN',
          message: 'Soundline: the mock engine is in an error state',
        }),
      );
    }
    if (state.src === null) {
      return Promise.reject(
        new PlaybackError({ code: 'SOURCE_UNAVAILABLE', message: 'Soundline: nothing is loaded' }),
      );
    }
    if (state.status === 'loading') {
      return new Promise<void>((resolve, reject) => {
        pendingPlay = { resolve, reject };
      });
    }

    if (state.status === 'ended') state.currentTime = 0;
    state.status = 'playing';
    startTicker();
    notify();
    return Promise.resolve();
  }

  function pause(): void {
    if (pendingPlay !== null) {
      takePending()?.reject(createAbortError());
      notify();
      return;
    }
    if (state.status !== 'playing') return;
    state.currentTime = sample();
    stopTicker();
    state.status = 'paused';
    notify();
  }

  function seek(seconds: number): void {
    const time = clamp(seconds, 0, duration);
    state.currentTime = time;
    startOffset = time;
    startedAt = now();
    if (state.status === 'ended' && time < duration) state.status = 'paused';
    notify();
  }

  function setVolume(volume: number): void {
    state.volume = clamp(volume, 0, 1);
    notify();
  }

  function setMuted(muted: boolean): void {
    state.muted = muted;
    notify();
  }

  function setRate(rate: number): void {
    if (state.status === 'playing') {
      // Re-anchor the clock so the change does not jump the playhead.
      state.currentTime = sample();
      startOffset = state.currentTime;
      startedAt = now();
    }
    state.rate = clamp(rate, MIN_RATE, MAX_RATE);
    notify();
  }

  function getState(): EngineState {
    return { ...state };
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { load, play, pause, seek, setVolume, setMuted, setRate, getState, subscribe };
}

/* -------------------------------------------------------------------------- */
/*  Mock adapter                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A fake track source.
 *
 * It returns the configured tracks, resolves sources from `track.src` and can be
 * told to fail: `failure` fails `getTracks`, `sourceFailures` fails a source, an
 * unknown track id fails with `TRACK_NOT_FOUND` and a track without a source
 * fails with `SOURCE_UNAVAILABLE`. `latency` uses a real timer that honours the
 * request's `AbortSignal`.
 */
export function createMockAdapter<TData = unknown, TContextData = unknown>(
  options: MockAdapterOptions<TData>,
): TrackSourceAdapter<TData, TContextData> {
  const latency = Math.max(0, options.latency ?? 0);
  const failure = options.failure ?? null;
  const sourceFailures = options.sourceFailures ?? {};
  const snapshot = [...options.tracks];
  const known = new Set(snapshot.map((track) => track.id));

  function delay(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(createAbortError());
    if (latency <= 0) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, latency);

      function onAbort(): void {
        clearTimeout(timer);
        reject(createAbortError());
      }

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  return {
    async getTracks(query: TrackQuery<TContextData>): Promise<Track<TData>[]> {
      await delay(query.signal);
      if (failure) {
        throw new PlaybackError({ code: failure, message: 'Soundline: mock getTracks failure' });
      }
      return [...snapshot];
    },
    async resolveSource(track: Track<TData>, { signal }): Promise<ResolvedSource> {
      await delay(signal);
      if (!known.has(track.id)) {
        throw new PlaybackError({
          code: 'TRACK_NOT_FOUND',
          message: `Soundline: the adapter does not know track "${track.id}"`,
        });
      }
      const code = sourceFailures[track.id];
      if (code) {
        throw new PlaybackError({
          code,
          message: `Soundline: mock source failure for "${track.id}"`,
        });
      }
      if (!track.src) {
        throw new PlaybackError({
          code: 'SOURCE_UNAVAILABLE',
          message: `Soundline: track "${track.id}" has no source`,
        });
      }
      return {
        src: track.src,
        ...(typeof track.duration === 'number' ? { duration: track.duration } : {}),
      };
    },
  };
}
