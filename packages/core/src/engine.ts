/**
 * The playback contract and the default browser implementation.
 *
 * `PlaybackEngine` is the single side-effect seam of the library: the controller
 * never touches an `<audio>` element itself, it drives whatever engine it was
 * given. That is what lets the whole flow be tested — and mocked — without sound.
 *
 * Two ideas carry the design:
 *
 * - **Intent vs reality.** The reducer owns what the user asked for; an engine
 *   owns what the audio backend actually does. Every method here is
 *   fire-and-forget except `play()`, whose promise rejects when the backend
 *   cannot start, so the failure is surfaced exactly once.
 * - **Lazy DOM.** `createMediaEngine()` is safe to import and to construct
 *   anywhere: nothing reads `window` or `document` at import time, and the
 *   element is built on first use, never at construction. Server rendering a
 *   binding that uses it therefore never throws.
 */
import { clamp } from './duration';
import { PlaybackError, toPlaybackError } from './errors';
import type { EngineState, EngineStatus, PlaybackErrorCode } from './types';

/* -------------------------------------------------------------------------- */
/*  Contract                                                                   */
/* -------------------------------------------------------------------------- */

/** Options accepted by {@link PlaybackEngine.load}. */
export interface LoadOptions {
  /** Start playback once the source is ready. Default: `false`. */
  autoplay?: boolean;
}

/**
 * The playback backend.
 *
 * `subscribe()` reports that telemetry changed; the listener reads the new
 * snapshot from `getState()`. `subscribe()` returns its own unsubscribe, so a
 * binding can tear down without knowing how the engine is implemented.
 */
export interface PlaybackEngine {
  /** Points the engine at a source. Resets the playhead and any error. */
  load(src: string, options?: LoadOptions): void;
  /**
   * Starts (or resumes) playback.
   *
   * Resolves once the backend is playing. Rejects with a `PlaybackError` when it
   * cannot start — nothing is loaded, the source is unsupported, the autoplay
   * policy blocked it.
   */
  play(): Promise<void>;
  /** Stops playback, keeping the playhead. */
  pause(): void;
  /** Moves the playhead to `seconds`, clamped to the known duration. */
  seek(seconds: number): void;
  /** Sets volume in the `0..1` range. */
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  /** Sets the playback rate, `1` being the source speed. */
  setRate(rate: number): void;
  /** The latest telemetry. The returned object is a copy; mutating it is a no-op. */
  getState(): EngineState;
  /** Notifies on every telemetry change. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/* -------------------------------------------------------------------------- */
/*  Shared snapshot                                                            */
/* -------------------------------------------------------------------------- */

/** A neutral snapshot: nothing loaded, nothing playing, full volume. */
export function createEngineState(overrides: Partial<EngineState> = {}): EngineState {
  return {
    status: 'idle',
    src: null,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    muted: false,
    rate: 1,
    error: null,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*  Media element engine                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Injection point of {@link createMediaEngine}.
 *
 * `createElement` exists so a consumer can supply the element — a shared
 * `<audio>`, an element carrying custom attributes — instead of letting the
 * engine build its own. It defaults to `document.createElement('audio')` and is
 * only called on first use.
 */
export interface MediaEngineOptions {
  createElement?: () => HTMLAudioElement;
}

/** Maps a `MediaError` to the code the player classifies with. */
export function codeForMediaError(error: MediaError | null | undefined): PlaybackErrorCode {
  switch (error?.code) {
    case 2: // MEDIA_ERR_NETWORK
      return 'NETWORK_FAILURE';
    case 3: // MEDIA_ERR_DECODE
      return 'DECODE_FAILED';
    case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
      return 'NOT_SUPPORTED';
    default:
      return 'UNKNOWN';
  }
}

/** Seconds of audio buffered ahead of the playhead. */
function bufferedAhead(element: HTMLAudioElement): number {
  const ranges = element.buffered;
  const time = element.currentTime;
  for (let index = 0; index < ranges.length; index += 1) {
    if (ranges.start(index) <= time && time <= ranges.end(index)) {
      return Math.max(0, ranges.end(index) - time);
    }
  }
  return 0;
}

/**
 * The default engine: a thin wrapper around an `HTMLAudioElement`.
 *
 * The element is created on first use, so constructing the engine is free and
 * running it on the server is safe until something actually loads. Media events
 * are translated into the telemetry contract: `loadedmetadata`, `durationchange`,
 * `timeupdate`, `progress`, `play`, `pause`, `waiting`, `ended` and `error`.
 */
export function createMediaEngine(options: MediaEngineOptions = {}): PlaybackEngine {
  const listeners = new Set<() => void>();
  const state = createEngineState();
  let element: HTMLAudioElement | null = null;

  function notify(): void {
    // Iterate a copy: a listener may unsubscribe itself while being called.
    for (const listener of [...listeners]) listener();
  }

  function ensureElement(): HTMLAudioElement {
    if (element) return element;

    const created = options.createElement
      ? options.createElement()
      : typeof document === 'undefined'
        ? null
        : document.createElement('audio');

    if (!created) {
      throw new PlaybackError({
        code: 'NOT_SUPPORTED',
        message: 'Soundline: createMediaEngine() needs a DOM; pass your own engine on the server',
      });
    }

    created.preload = 'metadata';
    created.volume = state.volume;
    created.muted = state.muted;
    created.playbackRate = state.rate;

    created.addEventListener('loadedmetadata', () =>
      sync(state.status === 'loading' ? 'ready' : undefined),
    );
    created.addEventListener('durationchange', () => sync());
    created.addEventListener('timeupdate', () => sync());
    created.addEventListener('progress', () => sync());
    created.addEventListener('play', () => sync('playing'));
    created.addEventListener('pause', () => sync('paused'));
    created.addEventListener('waiting', () => sync('loading'));
    created.addEventListener('ended', () => {
      state.currentTime = Number.isFinite(created.duration) ? created.duration : state.currentTime;
      state.status = 'ended';
      notify();
    });
    created.addEventListener('error', () => {
      state.status = 'error';
      state.error = codeForMediaError(created.error);
      notify();
    });

    element = created;
    return created;
  }

  /** Mirrors the element into the snapshot and, when given, moves the status. */
  function sync(status?: EngineStatus): void {
    const current = element;
    if (!current) return;
    state.currentTime = current.currentTime;
    if (Number.isFinite(current.duration)) state.duration = current.duration;
    state.buffered = bufferedAhead(current);
    state.volume = current.volume;
    state.muted = current.muted;
    state.rate = current.playbackRate;
    if (status) state.status = status;
    notify();
  }

  function load(src: string, loadOptions: LoadOptions = {}): void {
    const current = ensureElement();
    state.src = src;
    state.status = 'loading';
    state.currentTime = 0;
    state.duration = 0;
    state.buffered = 0;
    state.error = null;
    current.src = src;
    current.load();
    notify();
    if (loadOptions.autoplay) void play();
  }

  function play(): Promise<void> {
    const current = element;
    if (!current || state.src === null) {
      return Promise.reject(
        new PlaybackError({ code: 'SOURCE_UNAVAILABLE', message: 'Soundline: nothing is loaded' }),
      );
    }
    return current.play().then(
      () => sync('playing'),
      (cause: unknown) => {
        // Only a real media failure changes the status: an autoplay-policy
        // rejection is not an error the player should render.
        if (current.error) {
          state.status = 'error';
          state.error = codeForMediaError(current.error);
          notify();
        }
        throw toPlaybackError(cause, 'UNKNOWN');
      },
    );
  }

  function pause(): void {
    if (!element) return;
    element.pause();
    if (state.status === 'playing') state.status = 'paused';
    notify();
  }

  function seek(seconds: number): void {
    if (!element) return;
    const time = state.duration > 0 ? clamp(seconds, 0, state.duration) : Math.max(0, seconds);
    element.currentTime = time;
    state.currentTime = time;
    state.buffered = bufferedAhead(element);
    notify();
  }

  function setVolume(volume: number): void {
    const next = clamp(volume, 0, 1);
    state.volume = next;
    if (element) element.volume = next;
    notify();
  }

  function setMuted(muted: boolean): void {
    state.muted = muted;
    if (element) element.muted = muted;
    notify();
  }

  function setRate(rate: number): void {
    state.rate = rate;
    if (element) element.playbackRate = rate;
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
