/**
 * The player controller.
 *
 * Framework-free and free of I/O policy: it owns the reducer state, the resolved
 * configuration, the injected playback engine and track source, the in-flight
 * requests and the throttled progress reporting, and it exposes all of that as one
 * immutable snapshot for a binding to render.
 *
 * Four rules shape it:
 *
 * - **Nothing happens at creation.** No request, no subscription, no timer, no
 *   engine call. A binding calls `start()` when it is live and `stop()` when it
 *   goes away; both are idempotent, so a Strict Mode double mount is harmless.
 * - **Playback is injected.** The controller never touches an `<audio>` element:
 *   it drives whatever `PlaybackEngine` it was given, and it drops stale telemetry
 *   with a per-load token instead of trusting event ordering.
 * - **Controlled or not is fixed at creation.** A value the application supplies
 *   is a proposal: the controller announces it and waits for the application to
 *   send it back. A value the controller owns is applied immediately and still
 *   announced.
 * - **Position is telemetry, not a value.** `currentTime` never becomes a
 *   controlled input; it is mirrored from the engine, read back through
 *   `getEngineRef()` for server rendering, and reported through the throttled
 *   `onProgress` event.
 */
import type { ResolvedSource, TrackSourceAdapter } from './adapter';
import { DEFAULT_RATE, LOOP_MODES, MAX_RATE, MIN_RATE, resolvePlayerConfig } from './config';
import type { PlayerConfig, PlayerConfigInput } from './config';
import { createPlayerViewMemo } from './derive';
import type { PlayerView } from './derive';
import { clamp } from './duration';
import { createMediaEngine } from './engine';
import type { PlaybackEngine } from './engine';
import { createAbortError, isAbortError, PlaybackError, toPlaybackError } from './errors';
import {
  createPlayerState,
  createShuffledOrder,
  playerReducer,
  type CreatePlayerStateOptions,
  type PlayerAction,
  type PlayerError,
  type PlayerState,
} from './reducer';
import type { EngineState, LoopMode, PlaybackErrorPhase, Track } from './types';

/* -------------------------------------------------------------------------- */
/*  Public shape                                                               */
/* -------------------------------------------------------------------------- */

/** The immutable snapshot a binding renders: the raw state and the derived view. */
export interface PlayerSnapshot {
  /** Bumped whenever the snapshot below changes; stable while nothing does. */
  revision: number;
  state: Readonly<PlayerState>;
  view: Readonly<PlayerView>;
}

/** Why a value changed: the user asked for it, or the engine moved on its own. */
export type PlayerChangeReason = 'user' | 'automatic';

/** Carried by every change event, so a handler can tell intent from telemetry. */
export interface PlayerChangeMetadata {
  /** The playlist the change happened in. */
  contextKey: string;
  reason: PlayerChangeReason;
}

/** Carried by `onProgress`. */
export interface PlayerProgressMetadata {
  /** Total duration in seconds; `0` until the engine knows it. */
  duration: number;
  /** The track the progress belongs to, or `null` when nothing is loaded. */
  trackId: string | null;
}

/** Carried by `onError`. */
export interface PlayerErrorContext {
  /** The stage that failed: the track list, the source, or playback itself. */
  phase: PlaybackErrorPhase;
}

/**
 * Everything the application may want to know about.
 *
 * The value events report what the application asked for — in controlled mode
 * they are proposals, and an update coming from the application never echoes
 * back. `onPlay`/`onPause`/`onEnded` are the opposite: they report what the
 * engine actually did. `onProgress` is throttled.
 */
export interface PlayerControllerHandlers {
  /** Throttled playhead report; the final value always arrives on pause/seek. */
  onProgress?(seconds: number, metadata: PlayerProgressMetadata): void;
  onTrackChange?(trackId: string | null, metadata: PlayerChangeMetadata): void;
  onPlayingChange?(playing: boolean, metadata: PlayerChangeMetadata): void;
  onVolumeChange?(volume: number, metadata: PlayerChangeMetadata): void;
  onMutedChange?(muted: boolean, metadata: PlayerChangeMetadata): void;
  onLoopChange?(loop: LoopMode, metadata: PlayerChangeMetadata): void;
  onShuffleChange?(shuffle: boolean, metadata: PlayerChangeMetadata): void;
  onRateChange?(rate: number, metadata: PlayerChangeMetadata): void;
  onQueueChange?(queue: Track[], metadata: PlayerChangeMetadata): void;
  /** The engine started playing. */
  onPlay?(): void;
  /** The engine stopped playing (a pause, or a source that ended). */
  onPause?(): void;
  /** The source reached its end, before the queue decides what to do next. */
  onEnded?(): void;
  onError?(error: PlaybackError, context: PlayerErrorContext): void;
}

/**
 * The values the application may own, each as a `value`/`defaultValue` pair.
 *
 * Passing `queue`/`currentTrackId`/`playing`/… fixes that value into controlled
 * mode for the life of the controller; passing only the matching `default*` seeds
 * the initial value and lets the controller own it from then on.
 */
export interface PlayerControllerInputs {
  queue?: readonly Track[];
  defaultQueue?: readonly Track[];
  currentTrackId?: string | null;
  defaultTrackId?: string | null;
  playing?: boolean;
  defaultPlaying?: boolean;
  volume?: number;
  defaultVolume?: number;
  muted?: boolean;
  defaultMuted?: boolean;
  loop?: LoopMode;
  defaultLoop?: LoopMode;
  shuffle?: boolean;
  defaultShuffle?: boolean;
  rate?: number;
  defaultRate?: number;
}

/** Everything `createPlayerController` accepts. */
export interface PlayerControllerOptions {
  /** The track source. Required: the player cannot know a playlist on its own. */
  adapter: TrackSourceAdapter;
  /** The playback backend. Default: a lazy `HTMLAudioElement` engine. */
  engine?: PlaybackEngine;
  /** Presentation and behaviour settings that are not controlled values. */
  config?: PlayerConfigInput;
  /** Controlled and initial values. */
  inputs?: PlayerControllerInputs;
  handlers?: PlayerControllerHandlers;
  /**
   * Engine telemetry the server rendered from. The client starts from it so the
   * first snapshot matches the markup until the real engine reports something.
   */
  initialEngineRef?: EngineState;
  /** Clock in milliseconds, used only to throttle `onProgress`. Default: `Date.now`. */
  now?: () => number;
  /** Minimum spacing of `onProgress` reports, in milliseconds. Default: `250`. */
  progressIntervalMs?: number;
  /** Randomness for shuffle. Injected so a test always gets the same order. */
  random?: () => number;
}

/** The player, as the application drives it. */
export interface PlayerControllerActions {
  play(): void;
  pause(): void;
  toggle(): void;
  /** Moves the playhead to `seconds`, clamped to the known duration. */
  seek(seconds: number): void;
  /** Moves the playhead by `delta` seconds, from the engine's current position. */
  seekBy(delta: number): void;
  next(): void;
  previous(): void;
  /** Selects a track (or nothing) and loads its source. */
  selectTrack(trackId: string | null): void;
  enqueue(tracks: Track | readonly Track[]): void;
  removeFromQueue(trackId: string): void;
  reorderQueue(from: number, to: number): void;
  clearQueue(): void;
  setVolume(volume: number): void;
  toggleMute(): void;
  setLoop(loop: LoopMode): void;
  setShuffle(shuffle: boolean): void;
  setRate(rate: number): void;
  /** Repeats the failed load, or refetches a failed track list. */
  retry(): void;
  /** Restores the values the controller was created with and refetches the list. */
  reset(): void;
}

export interface PlayerController {
  getSnapshot(): PlayerSnapshot;
  /**
   * Serialisable engine telemetry, for server rendering.
   *
   * The object holds scalars only, so an application may render it into the page
   * and hand it back through `initialEngineRef`: the client's first snapshot is
   * then the one the server drew, and hydration has nothing to disagree about
   * until the real engine reports something.
   */
  getEngineRef(): EngineState;
  subscribe(listener: () => void): () => void;
  /** Configuration that is not a controlled value. Replaces the previous input. */
  updateConfig(config: PlayerConfigInput): void;
  /** Controlled and initial values. */
  updateInputs(inputs: PlayerControllerInputs): void;
  /**
   * Replaces the track source. The reference is stored and used on the next load;
   * this deliberately does not refetch, so an inline adapter in a binding cannot
   * loop. A different playlist is expressed by changing the context key.
   */
  updateAdapter(adapter: TrackSourceAdapter): void;
  /**
   * Replaces the playback backend and reloads the current source into it.
   *
   * The handover is exclusive: the previous engine is stopped, so it cannot keep
   * playing underneath the new one, and a source that was still resolving for it
   * is cancelled and resolved again for the replacement. The first engine stays
   * untouched until the controller is started, because until then it never drove
   * it.
   */
  updateEngine(engine: PlaybackEngine): void;
  readonly actions: PlayerControllerActions;
  start(): void;
  stop(): void;
}

/* -------------------------------------------------------------------------- */
/*  Constants and helpers                                                      */
/* -------------------------------------------------------------------------- */

/** Minimum spacing of `onProgress` reports, in milliseconds. */
export const DEFAULT_PROGRESS_INTERVAL = 250;

/** Safety valve on the engine-reconciliation loop; convergence takes one pass. */
const MAX_SYNC_PASSES = 8;

function isProduction(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.NODE_ENV === 'production';
}

function contractViolation(message: string): PlaybackError {
  return new PlaybackError({ code: 'ADAPTER_CONTRACT_VIOLATION', message });
}

/** Tracks must carry a unique, non-empty id; anything else is a bug. */
function requireTracks(value: unknown): Track[] {
  if (!Array.isArray(value))
    throw contractViolation('The adapter did not return a list of tracks.');

  const seen = new Set<string>();
  const tracks: Track[] = [];
  for (const candidate of value) {
    const track = candidate as Partial<Track> | null;
    if (!track || typeof track.id !== 'string' || track.id.length === 0) {
      throw contractViolation('A track is missing its id.');
    }
    if (seen.has(track.id)) throw contractViolation(`Track id "${track.id}" is used twice.`);
    seen.add(track.id);
    tracks.push(track as Track);
  }
  return tracks;
}

/** Whether two lists hold the very same tracks, element by element. */
function sameTracks(a: readonly Track[], b: readonly Track[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((track, index) => track === b[index]);
}

/**
 * Structural comparison of two config inputs, so re-supplying equal values — which
 * a binding does on every render — never invalidates the snapshot. Objects deeper
 * than three levels (the context payload) are compared by identity: the
 * application is expected to keep those stable.
 */
function sameConfigValue(a: unknown, b: unknown, depth = 0): boolean {
  if (a === b) return true;
  if (depth >= 3) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => sameConfigValue(item, b[index], depth + 1));
  }
  if (typeof a === 'function' || typeof b === 'function') return false;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (
      !sameConfigValue(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        depth + 1,
      )
    ) {
      return false;
    }
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/*  Implementation                                                             */
/* -------------------------------------------------------------------------- */

/** The values whose change is announced, tracked by identity where sensible. */
interface EmittedValues {
  trackId: string | null;
  queue: readonly Track[];
  playing: boolean;
  volume: number;
  muted: boolean;
  loop: LoopMode;
  shuffle: boolean;
  rate: number;
}

interface InitialValues {
  queue: Track[] | undefined;
  currentTrackId: string | null | undefined;
  playing: boolean;
  volume: number;
  muted: boolean;
  loop: LoopMode;
  shuffle: boolean;
  rate: number;
}

export function createPlayerController(options: PlayerControllerOptions): PlayerController {
  let adapter = options.adapter;
  let engine = options.engine ?? createMediaEngine();
  const handlers = options.handlers ?? {};
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const progressIntervalMs = Math.max(0, options.progressIntervalMs ?? DEFAULT_PROGRESS_INTERVAL);
  const givenInputs = options.inputs ?? {};

  /* -- controlled or not: fixed now, for the life of this controller -------- */

  const controlled = {
    queue: givenInputs.queue !== undefined,
    currentTrackId: givenInputs.currentTrackId !== undefined,
    playing: givenInputs.playing !== undefined,
    volume: givenInputs.volume !== undefined,
    muted: givenInputs.muted !== undefined,
    loop: givenInputs.loop !== undefined,
    shuffle: givenInputs.shuffle !== undefined,
    rate: givenInputs.rate !== undefined,
  };
  const warned = new Set<string>();

  function warnOnce(property: string): void {
    if (isProduction() || warned.has(property)) return;
    warned.add(property);
    console.warn(
      `[soundline] "${property}" appeared after the controller was created. The mode is fixed ` +
        `at creation, so the value is ignored: pass the controlled value from the first render ` +
        `or use the matching "default*" input.`,
    );
  }

  /* -- configuration -------------------------------------------------------- */

  let configOverrides: PlayerConfigInput = options.config ?? {};
  let config = resolvePlayerConfig(configOverrides);

  /* -- the values the controller owns --------------------------------------- */

  const initial: InitialValues = {
    queue: controlled.queue
      ? [...(givenInputs.queue as readonly Track[])]
      : givenInputs.defaultQueue
        ? [...givenInputs.defaultQueue]
        : undefined,
    currentTrackId: controlled.currentTrackId
      ? (givenInputs.currentTrackId as string | null)
      : givenInputs.defaultTrackId,
    playing: controlled.playing
      ? (givenInputs.playing as boolean)
      : (givenInputs.defaultPlaying ?? false),
    volume: controlled.volume ? (givenInputs.volume as number) : (givenInputs.defaultVolume ?? 1),
    muted: controlled.muted ? (givenInputs.muted as boolean) : (givenInputs.defaultMuted ?? false),
    loop: controlled.loop ? (givenInputs.loop as LoopMode) : (givenInputs.defaultLoop ?? 'off'),
    shuffle: controlled.shuffle
      ? (givenInputs.shuffle as boolean)
      : (givenInputs.defaultShuffle ?? false),
    rate: controlled.rate
      ? (givenInputs.rate as number)
      : (givenInputs.defaultRate ?? DEFAULT_RATE),
  };

  /**
   * Whether a value has been settled once. A `default*` arriving for the first
   * time is the initial value — a binding may only learn it after it mounts —
   * while a later change is ignored, because re-initialising would overwrite what
   * the user chose.
   */
  const initialized = {
    queue: controlled.queue || givenInputs.defaultQueue !== undefined,
    currentTrackId: controlled.currentTrackId || givenInputs.defaultTrackId !== undefined,
    playing: controlled.playing || givenInputs.defaultPlaying !== undefined,
    volume: controlled.volume || givenInputs.defaultVolume !== undefined,
    muted: controlled.muted || givenInputs.defaultMuted !== undefined,
    loop: controlled.loop || givenInputs.defaultLoop !== undefined,
    shuffle: controlled.shuffle || givenInputs.defaultShuffle !== undefined,
    rate: controlled.rate || givenInputs.defaultRate !== undefined,
  };

  function initialStateOptions(): CreatePlayerStateOptions {
    return {
      contextKey: config.context.key,
      ...(initial.queue ? { queue: initial.queue } : {}),
      ...(initial.currentTrackId === undefined ? {} : { currentTrackId: initial.currentTrackId }),
      playing: initial.playing,
      volume: initial.volume,
      muted: initial.muted,
      loop: initial.loop,
      shuffle: initial.shuffle,
      rate: initial.rate,
    };
  }

  let state = createPlayerState(initialStateOptions());

  /* -- bookkeeping ---------------------------------------------------------- */

  const listeners = new Set<() => void>();
  const memo = createPlayerViewMemo();
  let stateRevision = 0;
  let engineRevision = 0;
  let configRevision = 0;
  let snapshotRevision = 0;
  let cachedKey = '';
  let cached: PlayerSnapshot | null = null;
  let reason: PlayerChangeReason = 'automatic';

  let started = false;
  let unsubscribeEngine: (() => void) | null = null;

  let engineState: EngineState = options.initialEngineRef ?? engine.getState();
  /** The load token whose source is in the engine; `-1` forces a fresh load. */
  let loadedToken = -1;
  let loadedSrc: string | null = null;
  let tracksToken = 0;
  let tracksAbort: AbortController | null = null;
  let sourceAbort: AbortController | null = null;

  let lastProgressAt = Number.NEGATIVE_INFINITY;

  const emitted: EmittedValues = {
    trackId: state.currentTrackId,
    queue: state.queue,
    playing: state.playing,
    volume: state.volume,
    muted: state.muted,
    loop: state.loop,
    shuffle: state.shuffle,
    rate: state.rate,
  };

  function snapshotEmitted(): EmittedValues {
    return {
      trackId: state.currentTrackId,
      queue: state.queue,
      playing: state.playing,
      volume: state.volume,
      muted: state.muted,
      loop: state.loop,
      shuffle: state.shuffle,
      rate: state.rate,
    };
  }

  /** Treats the current state as already announced, for an external update. */
  function capture(keys: readonly (keyof EmittedValues)[]): void {
    const current = snapshotEmitted();
    for (const key of keys) (emitted as unknown as Record<string, unknown>)[key] = current[key];
  }

  function meta(changeReason: PlayerChangeReason): PlayerChangeMetadata {
    return { contextKey: config.context.key, reason: changeReason };
  }

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  /**
   * Fires the value events for everything that moved since the last time.
   *
   * Comparing here, rather than at each call site, is what makes an automatic
   * change (the queue ending, the adapter list arriving) and a user action look
   * the same: the action only has to say *why* the value moved.
   */
  function notifyChanges(): void {
    const context = meta(reason);
    reason = 'automatic';

    if (state.currentTrackId !== emitted.trackId) {
      emitted.trackId = state.currentTrackId;
      handlers.onTrackChange?.(state.currentTrackId, context);
    }
    if (state.queue !== emitted.queue) {
      emitted.queue = state.queue;
      handlers.onQueueChange?.([...state.queue], context);
    }
    if (state.playing !== emitted.playing) {
      emitted.playing = state.playing;
      handlers.onPlayingChange?.(state.playing, context);
    }
    if (state.volume !== emitted.volume) {
      emitted.volume = state.volume;
      handlers.onVolumeChange?.(state.volume, context);
    }
    if (state.muted !== emitted.muted) {
      emitted.muted = state.muted;
      handlers.onMutedChange?.(state.muted, context);
    }
    if (state.loop !== emitted.loop) {
      emitted.loop = state.loop;
      handlers.onLoopChange?.(state.loop, context);
    }
    if (state.shuffle !== emitted.shuffle) {
      emitted.shuffle = state.shuffle;
      handlers.onShuffleChange?.(state.shuffle, context);
    }
    if (state.rate !== emitted.rate) {
      emitted.rate = state.rate;
      handlers.onRateChange?.(state.rate, context);
    }
  }

  function emit(): void {
    notifyChanges();
    notify();
  }

  /**
   * Runs one transition and tells everyone who is listening.
   *
   * The state changes *before* anyone is notified, so a listener always reads the
   * value that goes with the notification. `silent` marks the values the
   * application itself just set: the state keeps them, the events stay quiet.
   */
  function apply(
    action: PlayerAction,
    options_: { reason?: PlayerChangeReason; silent?: readonly (keyof EmittedValues)[] } = {},
  ): void {
    const previous = state;
    const next = playerReducer(state, action);
    if (next === previous) return;

    state = next;
    stateRevision += 1;
    if (options_.silent && options_.silent.length > 0) capture(options_.silent);
    reason = options_.reason ?? 'automatic';
    emit();
    syncEngine();
  }

  /* -- snapshot ------------------------------------------------------------- */

  function snapshotKey(): string {
    return `${stateRevision}|${engineRevision}|${configRevision}`;
  }

  function getSnapshot(): PlayerSnapshot {
    const key = snapshotKey();
    if (cached !== null && key === cachedKey) return cached;

    snapshotRevision += 1;
    cachedKey = key;
    cached = {
      revision: snapshotRevision,
      state,
      view: memo.get(key, state, config, engineState),
    };
    return cached;
  }

  /* -- engine reconciliation ------------------------------------------------ */

  /**
   * Whether the reducer has to hear about this telemetry.
   *
   * Only the lifecycle and the known duration are mirrored into the state; the
   * playhead is not, so a progress tick never round-trips through the reducer —
   * the binding reads it from the derived view instead.
   */
  function needsSync(next: EngineState): boolean {
    return (
      next.status !== state.status ||
      (next.status === 'error' && (next.error ?? null) !== (state.error?.code ?? null)) ||
      (next.duration > 0 && next.duration !== state.duration)
    );
  }

  function sameTelemetry(a: EngineState, b: EngineState): boolean {
    return (
      a.status === b.status &&
      a.src === b.src &&
      a.currentTime === b.currentTime &&
      a.duration === b.duration &&
      a.buffered === b.buffered &&
      a.volume === b.volume &&
      a.muted === b.muted &&
      a.rate === b.rate &&
      a.error === b.error
    );
  }

  function engineError(next: EngineState): PlaybackError {
    return new PlaybackError({
      code: next.error ?? 'UNKNOWN',
      message: `Soundline: the engine could not play "${next.src ?? ''}"`,
    });
  }

  function handleEngineChange(): void {
    const previous = engineState;
    const next = engine.getState();

    if (!sameTelemetry(previous, next)) {
      engineState = next;
      engineRevision += 1;
    }

    if (next.status === 'error' && previous.status !== 'error') {
      // A playback failure stops the intent as well: the engine is not playing,
      // and the player must not claim it is.
      const error = engineError(next);
      apply({
        type: 'engineFailed',
        error: { code: error.code, phase: 'playback', message: error.message },
      });
      handlers.onError?.(error, { phase: 'playback' });
    } else if (next.status === 'ended' && previous.status !== 'ended') {
      // The queue decides what an ending means (loop, next track, stop). The
      // action is token-guarded, so a late end of a replaced source is dropped.
      apply({ type: 'ended', loadToken: loadedToken });
      handlers.onEnded?.();
    } else if (needsSync(next)) {
      apply({ type: 'engineSync', engine: next });
    } else {
      emit();
    }

    if (previous.status !== next.status) {
      if (next.status === 'playing') handlers.onPlay?.();
      else if (previous.status === 'playing') handlers.onPause?.();
    }

    maybeProgress(next.status === 'paused' || next.status === 'ended');
    syncEngine();
  }

  function attachEngine(): void {
    if (unsubscribeEngine) return;
    unsubscribeEngine = engine.subscribe(handleEngineChange);
  }

  function detachEngine(): void {
    if (!unsubscribeEngine) return;
    unsubscribeEngine();
    unsubscribeEngine = null;
  }

  /** Emits the playhead at most once per interval; boundary changes are forced. */
  function maybeProgress(force = false): void {
    if (!force && now() - lastProgressAt < progressIntervalMs) return;
    lastProgressAt = now();
    handlers.onProgress?.(engineState.currentTime, {
      duration: engineState.duration > 0 ? engineState.duration : state.duration,
      trackId: state.currentTrackId,
    });
  }

  function currentTrack(): Track | null {
    if (state.currentTrackId === null || state.index < 0) return null;
    return state.queue[state.index] ?? null;
  }

  async function resolveSourceFor(track: Track, signal: AbortSignal): Promise<ResolvedSource> {
    if (track.src) {
      return {
        src: track.src,
        ...(typeof track.duration === 'number' ? { duration: track.duration } : {}),
      };
    }
    if (adapter.resolveSource) return adapter.resolveSource(track, { signal });
    if (signal.aborted) throw createAbortError();
    throw new PlaybackError({
      code: 'SOURCE_UNAVAILABLE',
      message: `Soundline: track "${track.id}" has no source`,
    });
  }

  /** Points the engine at the selected track's source, dropping stale results. */
  async function loadSource(): Promise<void> {
    const token = state.loadToken;
    const track = currentTrack();

    sourceAbort?.abort();
    sourceAbort = null;
    // Claim the token now: while the source resolves, no second load can start.
    loadedToken = token;
    loadedSrc = null;

    if (!track) {
      engine.pause();
      return;
    }

    const controller = new AbortController();
    sourceAbort = controller;

    let resolved: ResolvedSource;
    try {
      resolved = await resolveSourceFor(track, controller.signal);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error) || token !== state.loadToken) return;
      const classified = toPlaybackError(error, 'SOURCE_UNAVAILABLE');
      apply({
        type: 'engineFailed',
        error: { code: classified.code, phase: 'source', message: classified.message },
      });
      handlers.onError?.(classified, { phase: 'source' });
      return;
    }

    if (controller.signal.aborted || token !== state.loadToken) return;

    loadedSrc = resolved.src;
    engine.load(resolved.src);
    maybeProgress(true);
    syncEngine();
  }

  function startPlayback(): void {
    void engine.play().catch((error: unknown) => {
      if (isAbortError(error)) return;
      // A real backend failure is already reported through the engine's status.
      if (engine.getState().status === 'error') return;
      // Anything else — the autoplay policy, most of all — is not an error to
      // render: playback simply did not start, so the intent follows reality.
      if (state.playing) apply({ type: 'pause' });
    });
  }

  let syncing = false;
  let syncAgain = false;

  /** One pass: push controls, load the source, start or stop playback. */
  function syncEngineOnce(): void {
    if (engineState.volume !== state.volume) engine.setVolume(state.volume);
    if (engineState.muted !== state.muted) engine.setMuted(state.muted);
    if (engineState.rate !== state.rate) engine.setRate(state.rate);

    if (state.loadToken !== loadedToken) {
      void loadSource();
      return;
    }

    if (state.playing) {
      if (engineState.status === 'playing') return;
      const canStart =
        loadedSrc !== null &&
        (engineState.status === 'ready' ||
          engineState.status === 'paused' ||
          engineState.status === 'ended');
      if (canStart) startPlayback();
    } else if (engineState.status === 'playing' || engineState.status === 'loading') {
      /*
       * `loading` is also the status of a stall: the element is still playing in
       * intent, so a pause has to reach it. The engine decides whether there is
       * anything to pause — a source that is merely being fetched is already
       * paused and keeps its `loading` status.
       */
      engine.pause();
    }
  }

  /**
   * Brings the engine in line with the state.
   *
   * An engine call may notify synchronously, which would re-enter this function;
   * the guard turns that into one more pass instead of a growing call stack. The
   * pass count is a safety valve — a converging engine settles in a single pass.
   */
  function syncEngine(): void {
    if (!started) return;
    if (syncing) {
      syncAgain = true;
      return;
    }

    syncing = true;
    try {
      let passes = 0;
      do {
        syncAgain = false;
        syncEngineOnce();
        passes += 1;
      } while (syncAgain && passes < MAX_SYNC_PASSES);
    } finally {
      syncing = false;
    }
  }

  function loadTracks(): void {
    if (!started) return;

    tracksAbort?.abort();
    const controller = new AbortController();
    tracksAbort = controller;
    const token = (tracksToken += 1);
    apply({ type: 'queueLoading', token });

    void (async () => {
      try {
        const tracks = requireTracks(
          await adapter.getTracks({ context: config.context, signal: controller.signal }),
        );
        if (controller.signal.aborted) return;
        apply({ type: 'queueLoaded', token, tracks });
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        const classified = toPlaybackError(error, 'ADAPTER_CONTRACT_VIOLATION');
        apply({
          type: 'queueFailed',
          token,
          error: { code: classified.code, phase: 'tracks', message: classified.message },
        });
        handlers.onError?.(classified, { phase: 'tracks' });
      }
    })();
  }

  /* -- adopting values from the application --------------------------------- */

  function adoptTrack(trackId: string | null): void {
    if (trackId === state.currentTrackId) return;
    apply({ type: 'select', trackId }, { silent: ['trackId'] });
  }

  function adoptQueue(tracks: readonly Track[]): void {
    if (state.queueStatus !== 'error' && sameTracks(state.queue, tracks)) return;
    apply({ type: 'setQueue', tracks: [...tracks] }, { silent: ['queue'] });
  }

  function adoptPlaying(playing: boolean): void {
    if (playing === state.playing) return;
    apply({ type: playing ? 'play' : 'pause' }, { silent: ['playing'] });
  }

  function adoptVolume(volume: number): void {
    const next = clamp(volume, 0, 1);
    if (next === state.volume) return;
    apply({ type: 'setVolume', volume: next }, { silent: ['volume'] });
  }

  function adoptMuted(muted: boolean): void {
    if (muted === state.muted) return;
    apply({ type: 'setMuted', muted }, { silent: ['muted'] });
  }

  function adoptLoop(loop: LoopMode): void {
    if (!LOOP_MODES.includes(loop) || loop === state.loop) return;
    apply({ type: 'setLoop', loop }, { silent: ['loop'] });
  }

  function adoptShuffle(shuffle: boolean): void {
    if (shuffle === state.shuffle) return;
    const order = shuffle
      ? createShuffledOrder(
          state.queue.map((track) => track.id),
          state.currentTrackId,
          random,
        )
      : undefined;
    apply(
      { type: 'setShuffle', shuffle, ...(order ? { order } : {}) },
      { silent: ['shuffle', 'queue'] },
    );
  }

  function adoptRate(rate: number): void {
    const next = clamp(rate, MIN_RATE, MAX_RATE);
    if (next === state.rate) return;
    apply({ type: 'setRate', rate: next }, { silent: ['rate'] });
  }

  function applyInputs(inputs: PlayerControllerInputs): void {
    if (controlled.queue) {
      if (inputs.queue !== undefined) adoptQueue(inputs.queue);
    } else if (inputs.queue !== undefined) {
      warnOnce('queue');
    } else if (!initialized.queue && inputs.defaultQueue !== undefined) {
      initialized.queue = true;
      adoptQueue(inputs.defaultQueue);
    }

    if (controlled.currentTrackId) {
      if (inputs.currentTrackId !== undefined) adoptTrack(inputs.currentTrackId);
    } else if (inputs.currentTrackId !== undefined) {
      warnOnce('currentTrackId');
    } else if (!initialized.currentTrackId && inputs.defaultTrackId !== undefined) {
      initialized.currentTrackId = true;
      adoptTrack(inputs.defaultTrackId);
    }

    if (controlled.playing) {
      if (inputs.playing !== undefined) adoptPlaying(inputs.playing);
    } else if (inputs.playing !== undefined) {
      warnOnce('playing');
    } else if (!initialized.playing && inputs.defaultPlaying !== undefined) {
      initialized.playing = true;
      adoptPlaying(inputs.defaultPlaying);
    }

    if (controlled.volume) {
      if (inputs.volume !== undefined) adoptVolume(inputs.volume);
    } else if (inputs.volume !== undefined) {
      warnOnce('volume');
    } else if (!initialized.volume && inputs.defaultVolume !== undefined) {
      initialized.volume = true;
      adoptVolume(inputs.defaultVolume);
    }

    if (controlled.muted) {
      if (inputs.muted !== undefined) adoptMuted(inputs.muted);
    } else if (inputs.muted !== undefined) {
      warnOnce('muted');
    } else if (!initialized.muted && inputs.defaultMuted !== undefined) {
      initialized.muted = true;
      adoptMuted(inputs.defaultMuted);
    }

    if (controlled.loop) {
      if (inputs.loop !== undefined) adoptLoop(inputs.loop);
    } else if (inputs.loop !== undefined) {
      warnOnce('loop');
    } else if (!initialized.loop && inputs.defaultLoop !== undefined) {
      initialized.loop = true;
      adoptLoop(inputs.defaultLoop);
    }

    if (controlled.shuffle) {
      if (inputs.shuffle !== undefined) adoptShuffle(inputs.shuffle);
    } else if (inputs.shuffle !== undefined) {
      warnOnce('shuffle');
    } else if (!initialized.shuffle && inputs.defaultShuffle !== undefined) {
      initialized.shuffle = true;
      adoptShuffle(inputs.defaultShuffle);
    }

    if (controlled.rate) {
      if (inputs.rate !== undefined) adoptRate(inputs.rate);
    } else if (inputs.rate !== undefined) {
      warnOnce('rate');
    } else if (!initialized.rate && inputs.defaultRate !== undefined) {
      initialized.rate = true;
      adoptRate(inputs.defaultRate);
    }
  }

  /* -- proposals (controlled mode) ------------------------------------------ */

  function proposeTrack(trackId: string | null): void {
    handlers.onTrackChange?.(trackId, meta('user'));
  }

  function proposeQueue(queue: readonly Track[]): void {
    handlers.onQueueChange?.([...queue], meta('user'));
  }

  function proposedState(action: PlayerAction): PlayerState | null {
    const projected = playerReducer(state, action);
    return projected === state ? null : projected;
  }

  /* -- the values ----------------------------------------------------------- */

  function setPlaying(next: boolean): void {
    if (next === state.playing) return;
    if (controlled.playing) {
      handlers.onPlayingChange?.(next, meta('user'));
      return;
    }
    apply({ type: next ? 'play' : 'pause' }, { reason: 'user' });
  }

  function setVolume(next: number): void {
    const value = clamp(next, 0, 1);
    if (value === state.volume) return;
    if (controlled.volume) {
      handlers.onVolumeChange?.(value, meta('user'));
      return;
    }
    apply({ type: 'setVolume', volume: value }, { reason: 'user' });
  }

  function setMuted(next: boolean): void {
    if (next === state.muted) return;
    if (controlled.muted) {
      handlers.onMutedChange?.(next, meta('user'));
      return;
    }
    apply({ type: 'setMuted', muted: next }, { reason: 'user' });
  }

  function setLoop(next: LoopMode): void {
    if (!LOOP_MODES.includes(next) || next === state.loop) return;
    if (controlled.loop) {
      handlers.onLoopChange?.(next, meta('user'));
      return;
    }
    apply({ type: 'setLoop', loop: next }, { reason: 'user' });
  }

  function setShuffle(next: boolean): void {
    if (next === state.shuffle) return;
    if (controlled.shuffle) {
      handlers.onShuffleChange?.(next, meta('user'));
      return;
    }
    const order = next
      ? createShuffledOrder(
          state.queue.map((track) => track.id),
          state.currentTrackId,
          random,
        )
      : undefined;
    apply({ type: 'setShuffle', shuffle: next, ...(order ? { order } : {}) }, { reason: 'user' });
  }

  function setRate(next: number): void {
    const value = clamp(next, MIN_RATE, MAX_RATE);
    if (value === state.rate) return;
    if (controlled.rate) {
      handlers.onRateChange?.(value, meta('user'));
      return;
    }
    apply({ type: 'setRate', rate: value }, { reason: 'user' });
  }

  function stepTo(type: 'next' | 'previous'): void {
    const projected = proposedState({ type });
    if (!projected) return;
    if (controlled.currentTrackId) {
      proposeTrack(projected.currentTrackId);
      return;
    }
    apply({ type }, { reason: 'user' });
  }

  function enqueue(tracks: Track | readonly Track[]): void {
    const list: Track[] = Array.isArray(tracks)
      ? [...(tracks as readonly Track[])]
      : [tracks as Track];
    if (list.length === 0) return;
    const projected = proposedState({ type: 'enqueue', tracks: list });
    if (!projected) return;
    if (controlled.queue) {
      proposeQueue(projected.queue);
      return;
    }
    apply({ type: 'enqueue', tracks: list }, { reason: 'user' });
  }

  function removeFromQueue(trackId: string): void {
    const projected = proposedState({ type: 'removeFromQueue', trackId });
    if (!projected) return;
    if (controlled.queue) {
      proposeQueue(projected.queue);
      return;
    }
    apply({ type: 'removeFromQueue', trackId }, { reason: 'user' });
  }

  function reorderQueue(from: number, to: number): void {
    const projected = proposedState({ type: 'moveInQueue', from, to });
    if (!projected) return;
    if (controlled.queue) {
      proposeQueue(projected.queue);
      return;
    }
    apply({ type: 'moveInQueue', from, to }, { reason: 'user' });
  }

  function clearQueue(): void {
    const projected = proposedState({ type: 'clearQueue' });
    if (!projected) return;
    if (controlled.queue) {
      proposeQueue(projected.queue);
      return;
    }
    apply({ type: 'clearQueue' }, { reason: 'user' });
  }

  /* -- actions -------------------------------------------------------------- */

  const actions: PlayerControllerActions = {
    play() {
      setPlaying(true);
    },

    pause() {
      setPlaying(false);
    },

    toggle() {
      setPlaying(!state.playing);
    },

    seek(seconds) {
      const time = Math.max(0, seconds);
      apply({ type: 'seek', time }, { reason: 'user' });
      engine.seek(time);
      maybeProgress(true);
    },

    seekBy(delta) {
      actions.seek(engineState.currentTime + delta);
    },

    next() {
      stepTo('next');
    },

    previous() {
      stepTo('previous');
    },

    selectTrack(trackId) {
      if (trackId === state.currentTrackId) return;
      if (controlled.currentTrackId) {
        proposeTrack(trackId);
        return;
      }
      apply({ type: 'select', trackId }, { reason: 'user' });
    },

    enqueue,
    removeFromQueue,
    reorderQueue,
    clearQueue,

    setVolume,

    toggleMute() {
      setMuted(!state.muted);
    },

    setLoop,
    setShuffle,
    setRate,

    retry() {
      if (state.queueStatus === 'error') {
        loadTracks();
        return;
      }
      if (state.error === null || state.index < 0) return;
      apply({ type: 'retry' }, { reason: 'user' });
    },

    reset() {
      // Force a fresh load: a reset source is never the one already in the engine.
      loadedToken = -1;
      loadedSrc = null;
      apply({ type: 'reset', options: initialStateOptions() }, { reason: 'user' });
      if (started && !initial.queue) loadTracks();
    },
  };

  /* -- public API ----------------------------------------------------------- */

  return {
    getSnapshot,

    getEngineRef() {
      return { ...engineState };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    updateConfig(next) {
      if (sameConfigValue(configOverrides, next)) return;
      const previous = config;
      configOverrides = next;
      config = resolvePlayerConfig(configOverrides);
      configRevision += 1;

      if (previous.context.key !== config.context.key) {
        apply({ type: 'contextChanged', key: config.context.key });
        if (started) loadTracks();
      }
      emit();
    },

    updateInputs(inputs) {
      applyInputs(inputs);
    },

    updateAdapter(next) {
      if (next === adapter) return;
      adapter = next;
    },

    updateEngine(next) {
      if (next === engine) return;
      const previous = engine;
      // Detach before pausing: the old backend is not the player's any more, so
      // its pause must not be mirrored as a state change. Pausing is what makes
      // the swap safe — otherwise the replaced engine keeps playing underneath
      // the new one.
      detachEngine();
      if (started) previous.pause();
      // A source being resolved for the old backend must not land in the new one
      // behind the reload's back.
      sourceAbort?.abort();
      sourceAbort = null;
      engine = next;
      engineState = engine.getState();
      engineRevision += 1;
      loadedToken = -1;
      loadedSrc = null;
      if (!started) return;
      attachEngine();
      emit();
      syncEngine();
    },

    actions,

    start() {
      if (started) return;
      started = true;
      engineState = engine.getState();
      attachEngine();
      apply({ type: 'started' });
      if (!initial.queue && state.queueStatus !== 'ready') loadTracks();
      syncEngine();
      emit();
    },

    stop() {
      if (!started) return;
      started = false;
      tracksAbort?.abort();
      tracksAbort = null;
      sourceAbort?.abort();
      sourceAbort = null;
      // A load that was still resolving never reached the engine. Its token was
      // already claimed, so leaving it would make the next `start()` believe the
      // source is in the engine and skip the load — the player would sit on
      // `playing: true` over an idle backend. A source that did land stays put:
      // a restart resumes it instead of reloading and losing the playhead.
      if (loadedSrc === null) loadedToken = -1;
      // Detach before pausing: a paused engine is not the player's business any
      // more, and leaving it running would keep audio alive after an unmount.
      detachEngine();
      engine.pause();
      apply({ type: 'stopped' });
    },
  };
}
