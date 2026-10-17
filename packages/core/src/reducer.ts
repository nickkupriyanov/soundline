/**
 * The player state machine.
 *
 * Pure and synchronous: it never reads the clock, never touches the DOM and never
 * performs I/O. The controller owns the engine, the requests and the throttling;
 * everything here is a deterministic transition that can be replayed in a test.
 *
 * Three ideas carry most of the design:
 *
 * - **The queue is the playback order.** It is stored exactly as the tracks will
 *   be played — next/previous are `index ± 1` — so the displayed order and the
 *   transport can never disagree. Shuffle rearranges the queue and remembers the
 *   order it replaced, which is what makes un-shuffling lossless.
 * - **`playing` is intent, `status` is telemetry.** The reducer records what the
 *   user asked for; the engine reports what actually happens. `pendingPlay` bridges
 *   the two while a source is still loading.
 * - **A load is a token.** Every (re)load bumps `loadToken`; the controller loads
 *   the current source whenever that token or the selection changes, and drops
 *   stale engine events.
 */
import { LOOP_MODES, MAX_RATE, MIN_RATE } from './config';
import { DEFAULT_CONTEXT_KEY } from './context';
import { clamp } from './duration';
import type {
  EngineState,
  EngineStatus,
  LoopMode,
  PlaybackErrorCode,
  PlaybackErrorPhase,
  Track,
} from './types';

/* -------------------------------------------------------------------------- */
/*  Model                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A failure the player has to show, tagged with the phase that produced it.
 *
 * `message` is the raw text an adapter or an engine gave — it may be empty when
 * only a code was reported — and the binding renders `messages.genericError` (or
 * the copy that matches `code`) rather than trusting it.
 */
export interface PlayerError {
  code: PlaybackErrorCode;
  phase: PlaybackErrorPhase;
  message: string;
}

/** Lifecycle of the track list, independent of the engine. */
export type QueueStatus = 'idle' | 'loading' | 'ready' | 'error';

/** The whole player, as the reducer sees it. */
export interface PlayerState {
  /** Key of the playlist the queue belongs to. */
  contextKey: string;
  /** The tracks in playback order. */
  queue: Track[];
  /** Selected track, or `null` when nothing is selected. */
  currentTrackId: string | null;
  /** Position of the current track in `queue`; `-1` when none is selected. */
  index: number;
  /** Bumped on every track-list request so stale responses can be dropped. */
  queueToken: number;
  queueStatus: QueueStatus;
  queueError: PlayerError | null;
  /** The user's intent to play, not a mirror of the engine. */
  playing: boolean;
  /** Set when play was asked for and the engine is not ready to start yet. */
  pendingPlay: boolean;
  /** Set while the controller is started; cleared by `stop()`. */
  started: boolean;
  /** Engine lifecycle, mirrored from telemetry. */
  status: EngineStatus;
  currentTime: number;
  duration: number;
  /** Seconds buffered ahead of `currentTime`. */
  buffered: number;
  /** Why playback failed, tagged with the phase. */
  error: PlayerError | null;
  volume: number;
  muted: boolean;
  rate: number;
  loop: LoopMode;
  shuffle: boolean;
  /** The order the queue had before shuffle was on; `null` when shuffle is off. */
  order: string[] | null;
  /** Bumped whenever a new source must be loaded; stale engine events drop. */
  loadToken: number;
}

/** Everything a fresh state can be seeded with. */
export interface CreatePlayerStateOptions {
  contextKey?: string;
  /**
   * `undefined` selects the first track (or nothing, when empty); `null` selects
   * nothing explicitly, which is how a controlled `currentTrackId` starts empty.
   */
  currentTrackId?: string | null;
  queue?: Track[];
  playing?: boolean;
  volume?: number;
  muted?: boolean;
  rate?: number;
  loop?: LoopMode;
  shuffle?: boolean;
  order?: string[] | null;
  queueStatus?: QueueStatus;
  started?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function clampVolume(volume: number): number {
  return clamp(volume, 0, 1);
}

function clampRate(rate: number): number {
  return clamp(rate, MIN_RATE, MAX_RATE);
}

function indexOfTrack(queue: readonly Track[], trackId: string | null): number {
  if (trackId === null) return -1;
  return queue.findIndex((track) => track.id === trackId);
}

function trackAt(state: PlayerState): Track | null {
  return state.index >= 0 ? (state.queue[state.index] ?? null) : null;
}

/** Puts the current track back in sync with the queue after a reorder. */
function withQueue(
  state: PlayerState,
  queue: Track[],
  currentTrackId: string | null = state.currentTrackId,
): PlayerState {
  return { ...state, queue, currentTrackId, index: indexOfTrack(queue, currentTrackId) };
}

/**
 * Rebuilds a queue from an explicit id order.
 *
 * Ids that are not in the queue are ignored; any track the order forgot is kept
 * at the end, so a malformed order can never drop a track.
 */
function reorderByIds(queue: readonly Track[], ids: readonly string[]): Track[] {
  const byId = new Map(queue.map((track) => [track.id, track] as const));
  const ordered: Track[] = [];
  for (const id of ids) {
    const track = byId.get(id);
    if (track) {
      ordered.push(track);
      byId.delete(id);
    }
  }
  for (const track of queue) {
    if (byId.has(track.id)) ordered.push(track);
  }
  return ordered;
}

/** Moves one element of an array, returning a copy. */
function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/**
 * Starts loading `track` (or clears the source when it is `null`).
 *
 * A load resets the playhead and the error and bumps the token; whether playback
 * begins afterwards is the engine's decision, driven by `playing`.
 */
function beginLoad(state: PlayerState, track: Track | null): PlayerState {
  return {
    ...state,
    status: 'loading',
    currentTime: 0,
    duration: track?.duration ?? 0,
    buffered: 0,
    error: null,
    pendingPlay: state.playing,
    loadToken: state.loadToken + 1,
  };
}

/**
 * A shuffled playback order with the current track pinned first.
 *
 * Randomness is injected — the controller passes its own source, the tests pass a
 * seeded one — so the same inputs always produce the same order.
 */
export function createShuffledOrder(
  ids: readonly string[],
  currentTrackId: string | null,
  random: () => number = Math.random,
): string[] {
  const rest = ids.filter((id) => id !== currentTrackId);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = rest[i];
    rest[i] = rest[j] as string;
    rest[j] = swap as string;
  }
  return currentTrackId !== null && ids.includes(currentTrackId) ? [currentTrackId, ...rest] : rest;
}

/* -------------------------------------------------------------------------- */
/*  Actions                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The closed list of transitions. Anything not here is controller policy: an
 * adapter call, an engine call, a throttled progress event.
 */
export type PlayerAction =
  /** The playlist changed: the queue and the selection are dropped. */
  | { type: 'contextChanged'; key: string }
  | { type: 'queueLoading'; token: number }
  | { type: 'queueLoaded'; token: number; tracks: Track[] }
  | { type: 'queueFailed'; token: number; error: PlayerError }
  /**
   * Replaces the playback order wholesale, without a token and without a load:
   * the queue a controlled application owns, pushed in from the outside.
   */
  | { type: 'setQueue'; tracks: Track[] }
  | { type: 'enqueue'; tracks: Track[] }
  | { type: 'removeFromQueue'; trackId: string }
  | { type: 'moveInQueue'; from: number; to: number }
  | { type: 'clearQueue' }
  /** Selects a track (or nothing) and loads its source. */
  | { type: 'select'; trackId: string | null }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  /** Mirrors engine telemetry (status, playhead, buffer, duration, failure). */
  | { type: 'engineSync'; engine: EngineState }
  /** The source reached its end; token-guarded so it is handled exactly once. */
  | { type: 'ended'; loadToken: number }
  | { type: 'engineFailed'; error: PlayerError }
  | { type: 'seek'; time: number }
  | { type: 'setVolume'; volume: number }
  | { type: 'setMuted'; muted: boolean }
  | { type: 'toggleMute' }
  | { type: 'setRate'; rate: number }
  | { type: 'setLoop'; loop: LoopMode }
  | { type: 'cycleLoop' }
  | { type: 'setShuffle'; shuffle: boolean; order?: string[] }
  | { type: 'toggleShuffle'; order?: string[] }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'started' }
  | { type: 'stopped' }
  | { type: 'retry' }
  | { type: 'reset'; options?: CreatePlayerStateOptions };

/* -------------------------------------------------------------------------- */
/*  Creation                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A fresh state.
 *
 * Without an explicit `currentTrackId` the first track is selected but no source
 * is loaded: nothing happens until the controller starts and loads it.
 */
export function createPlayerState(options: CreatePlayerStateOptions = {}): PlayerState {
  const queue = options.queue ? [...options.queue] : [];
  const requested = options.currentTrackId;
  const currentTrackId =
    requested === undefined
      ? (queue[0]?.id ?? null)
      : requested === null
        ? null
        : indexOfTrack(queue, requested) >= 0
          ? requested
          : null;
  const track = queue.find((item) => item.id === currentTrackId) ?? null;

  return {
    contextKey: options.contextKey ?? DEFAULT_CONTEXT_KEY,
    queue,
    currentTrackId,
    index: indexOfTrack(queue, currentTrackId),
    queueToken: 0,
    queueStatus: options.queueStatus ?? (options.queue === undefined ? 'idle' : 'ready'),
    queueError: null,
    playing: options.playing ?? false,
    pendingPlay: false,
    started: options.started ?? false,
    status: 'idle',
    currentTime: 0,
    duration: track?.duration ?? 0,
    buffered: 0,
    error: null,
    volume: clampVolume(options.volume ?? 1),
    muted: options.muted ?? false,
    rate: clampRate(options.rate ?? 1),
    loop: options.loop ?? 'off',
    shuffle: options.shuffle ?? false,
    order: options.order ?? null,
    loadToken: 0,
  };
}

/* -------------------------------------------------------------------------- */
/*  Transitions                                                                */
/* -------------------------------------------------------------------------- */

/** The index a step moves to, or `null` when it would leave the queue. */
function stepIndex(state: PlayerState, delta: 1 | -1): number | null {
  const length = state.queue.length;
  if (length === 0) return null;
  if (state.index < 0) return 0;

  const raw = state.index + delta;
  if (raw < 0 || raw > length - 1) {
    if (state.loop !== 'all') return null;
  }
  return (raw + length) % length;
}

/** Moves the selection by one track. */
function step(state: PlayerState, delta: 1 | -1): PlayerState {
  const target = stepIndex(state, delta);
  if (target === null) {
    // Before the first track, `previous` restarts it rather than doing nothing.
    if (state.queue.length > 0 && delta === -1 && state.index === 0) {
      return beginLoad(state, state.queue[0] as Track);
    }
    return state;
  }
  const track = state.queue[target] as Track;
  if (target === state.index) return beginLoad(state, track);
  return beginLoad({ ...state, currentTrackId: track.id, index: target }, track);
}

/** Advances the queue after a source reached its end, honouring the loop mode. */
function applyEnded(state: PlayerState): PlayerState {
  const track = trackAt(state);

  if (state.loop === 'one' && track) {
    return beginLoad(state, track);
  }

  const target = stepIndex(state, 1);
  if (target !== null) {
    const next = state.queue[target] as Track;
    return beginLoad({ ...state, currentTrackId: next.id, index: target }, next);
  }

  return {
    ...state,
    status: 'ended',
    playing: false,
    pendingPlay: false,
    currentTime: state.duration,
  };
}

/** Never null: load an explicit track (or clear it). */
function loadTrack(state: PlayerState, trackId: string | null): PlayerState {
  const index = indexOfTrack(state.queue, trackId);
  if (trackId !== null && index < 0) return state;
  if (trackId === state.currentTrackId) return state;
  const track = index >= 0 ? (state.queue[index] as Track) : null;
  return beginLoad({ ...state, currentTrackId: trackId, index }, track);
}

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case 'contextChanged': {
      if (action.key === state.contextKey) return state;
      return {
        ...state,
        contextKey: action.key,
        queue: [],
        currentTrackId: null,
        index: -1,
        queueStatus: 'idle',
        queueError: null,
        order: null,
        playing: false,
        pendingPlay: false,
        status: 'idle',
        currentTime: 0,
        duration: 0,
        buffered: 0,
        error: null,
        loadToken: state.loadToken + 1,
      };
    }

    case 'queueLoading':
      return { ...state, queueStatus: 'loading', queueError: null, queueToken: action.token };

    case 'queueLoaded': {
      if (action.token !== state.queueToken) return state;
      const incoming = [...action.tracks];

      if (incoming.length === 0) {
        return {
          ...state,
          queue: [],
          currentTrackId: null,
          index: -1,
          queueStatus: 'ready',
          queueError: null,
          order: null,
          playing: false,
          pendingPlay: false,
          // An empty list is a valid end state, not an error.
          status: state.status === 'playing' ? 'paused' : state.status,
        };
      }

      const keepsCurrent =
        state.currentTrackId !== null &&
        incoming.some((track) => track.id === state.currentTrackId);
      const selectedId = keepsCurrent
        ? (state.currentTrackId as string)
        : (incoming[0] as Track).id;
      // Playback order is the queue order: when shuffle is on, the selected track
      // stays first and the rest keep the adapter's order.
      const ordered =
        state.shuffle && keepsCurrent
          ? reorderByIds(incoming, [selectedId, ...incoming.map((track) => track.id)])
          : incoming;
      const index = indexOfTrack(ordered, selectedId);
      const track = ordered[index] as Track;

      const base: PlayerState = {
        ...state,
        queue: ordered,
        currentTrackId: selectedId,
        index,
        queueStatus: 'ready',
        queueError: null,
        order: state.shuffle ? incoming.map((item) => item.id) : null,
      };
      return keepsCurrent ? base : beginLoad(base, track);
    }

    case 'queueFailed':
      if (action.token !== state.queueToken) return state;
      return { ...state, queueStatus: 'error', queueError: action.error };

    case 'setQueue': {
      const incoming = [...action.tracks];

      if (incoming.length === 0) {
        if (state.queue.length === 0 && state.currentTrackId === null) return state;
        return {
          ...state,
          queue: [],
          currentTrackId: null,
          index: -1,
          queueStatus: 'ready',
          queueError: null,
          order: null,
          playing: false,
          pendingPlay: false,
          // An empty list is a valid end state, not an error.
          status: state.status === 'playing' ? 'paused' : state.status,
          currentTime: 0,
          duration: 0,
          buffered: 0,
        };
      }

      const keepsCurrent =
        state.currentTrackId !== null &&
        incoming.some((track) => track.id === state.currentTrackId);
      const selectedId = keepsCurrent
        ? (state.currentTrackId as string)
        : (incoming[0] as Track).id;
      // Same rule as a loaded list: when shuffle is on, the selected track stays
      // first and the rest keep the order the application sent.
      const ordered =
        state.shuffle && keepsCurrent
          ? reorderByIds(incoming, [selectedId, ...incoming.map((track) => track.id)])
          : incoming;
      const index = indexOfTrack(ordered, selectedId);
      const track = ordered[index] as Track;

      const base: PlayerState = {
        ...state,
        queue: ordered,
        currentTrackId: selectedId,
        index,
        queueStatus: 'ready',
        queueError: null,
        order: state.shuffle ? incoming.map((item) => item.id) : null,
      };
      return keepsCurrent ? base : beginLoad(base, track);
    }

    case 'enqueue': {
      if (action.tracks.length === 0) return state;
      const queue = [...state.queue, ...action.tracks];
      const order = state.order
        ? [...state.order, ...action.tracks.map((track) => track.id)]
        : null;
      const next = withQueue({ ...state, order }, queue);
      if (next.currentTrackId !== null) return next;
      const first = queue[0] as Track;
      return beginLoad({ ...next, currentTrackId: first.id, index: 0 }, first);
    }

    case 'removeFromQueue': {
      const index = indexOfTrack(state.queue, action.trackId);
      if (index < 0) return state;
      const queue = state.queue.filter((track) => track.id !== action.trackId);
      const order = state.order ? state.order.filter((id) => id !== action.trackId) : null;

      if (action.trackId !== state.currentTrackId) {
        return withQueue({ ...state, order }, queue);
      }
      if (queue.length === 0) {
        return {
          ...state,
          queue: [],
          order: null,
          currentTrackId: null,
          index: -1,
          playing: false,
          pendingPlay: false,
          status: 'idle',
          currentTime: 0,
          duration: 0,
          buffered: 0,
        };
      }
      // The next track takes over the slot the removed one left.
      const target = Math.min(index, queue.length - 1);
      const track = queue[target] as Track;
      return beginLoad({ ...state, queue, order, currentTrackId: track.id, index: target }, track);
    }

    case 'moveInQueue': {
      const { from, to } = action;
      const length = state.queue.length;
      if (from === to || from < 0 || to < 0 || from >= length || to >= length) return state;
      const queue = move(state.queue, from, to);
      // `order` is the pre-shuffle order and is left alone: a manual move happens
      // inside the shuffled view, so un-shuffling still restores the original list.
      return withQueue({ ...state, order: state.order }, queue);
    }

    case 'clearQueue':
      if (state.queue.length === 0 && state.currentTrackId === null) return state;
      return {
        ...state,
        queue: [],
        order: null,
        currentTrackId: null,
        index: -1,
        queueStatus: 'ready',
        queueError: null,
        playing: false,
        pendingPlay: false,
        status: 'idle',
        currentTime: 0,
        duration: 0,
        buffered: 0,
        error: null,
      };

    case 'select':
      return loadTrack(state, action.trackId);

    case 'play': {
      if (state.queue.length === 0) {
        return state.playing || state.pendingPlay
          ? { ...state, playing: false, pendingPlay: false }
          : state;
      }
      // Asking to play again while it is already playing (or on its way) is a
      // no-op; only `ended` and `error` need a fresh load.
      if (state.playing && state.status !== 'ended' && state.status !== 'error') return state;

      let next = state;
      if (state.currentTrackId === null || state.index < 0) {
        const first = state.queue[0] as Track;
        next = beginLoad({ ...state, currentTrackId: first.id, index: 0 }, first);
      } else if (state.status === 'idle' || state.status === 'ended' || state.status === 'error') {
        next = beginLoad(state, trackAt(state));
      }
      const canStart =
        next.status === 'ready' || next.status === 'paused' || next.status === 'playing';
      return { ...next, playing: true, pendingPlay: !canStart };
    }

    case 'pause':
      if (!state.playing && !state.pendingPlay) return state;
      return { ...state, playing: false, pendingPlay: false };

    case 'toggle':
      return playerReducer(state, { type: state.playing ? 'pause' : 'play' });

    case 'engineSync': {
      const { engine } = action;
      return {
        ...state,
        status: engine.status,
        currentTime: engine.currentTime,
        buffered: engine.buffered,
        ...(engine.duration > 0 ? { duration: engine.duration } : {}),
        ...(engine.status === 'error' && state.error === null
          ? {
              error: {
                code: engine.error ?? 'UNKNOWN',
                phase: 'playback' as PlaybackErrorPhase,
                message: '',
              },
            }
          : {}),
        ...(engine.status === 'ready' || engine.status === 'playing' || engine.status === 'paused'
          ? { pendingPlay: false }
          : {}),
      };
    }

    case 'ended': {
      // A stale end (the source was reloaded meanwhile) is dropped, and a queue
      // that already stopped at the end is not advanced twice.
      if (action.loadToken !== state.loadToken || state.status === 'ended') return state;
      return applyEnded(state);
    }

    case 'engineFailed':
      return { ...state, status: 'error', error: action.error, playing: false, pendingPlay: false };

    case 'seek': {
      if (state.duration <= 0) return state;
      const time = clamp(action.time, 0, state.duration);
      if (time === state.currentTime) return state;
      return { ...state, currentTime: time };
    }

    case 'setVolume': {
      const volume = clampVolume(action.volume);
      return volume === state.volume ? state : { ...state, volume };
    }

    case 'setMuted':
      return action.muted === state.muted ? state : { ...state, muted: action.muted };

    case 'toggleMute':
      return { ...state, muted: !state.muted };

    case 'setRate': {
      const rate = clampRate(action.rate);
      return rate === state.rate ? state : { ...state, rate };
    }

    case 'setLoop':
      if (!LOOP_MODES.includes(action.loop) || action.loop === state.loop) return state;
      return { ...state, loop: action.loop };

    case 'cycleLoop': {
      const next = LOOP_MODES[(LOOP_MODES.indexOf(state.loop) + 1) % LOOP_MODES.length] as LoopMode;
      return { ...state, loop: next };
    }

    case 'setShuffle': {
      if (action.shuffle === state.shuffle) return state;
      if (action.shuffle) {
        const ids = state.queue.map((track) => track.id);
        const order = action.order ?? ids;
        return withQueue({ ...state, shuffle: true, order: ids }, reorderByIds(state.queue, order));
      }
      const ids = state.order ?? state.queue.map((track) => track.id);
      return withQueue({ ...state, shuffle: false, order: null }, reorderByIds(state.queue, ids));
    }

    case 'toggleShuffle':
      return playerReducer(state, {
        type: 'setShuffle',
        shuffle: !state.shuffle,
        ...(action.order === undefined ? {} : { order: action.order }),
      });

    case 'next':
      return step(state, 1);

    case 'previous':
      return step(state, -1);

    case 'started':
      return state.started ? state : { ...state, started: true };

    case 'stopped':
      return state.started ? { ...state, started: false } : state;

    case 'retry': {
      const track = trackAt(state);
      if (!track || state.error === null) return state;
      return { ...beginLoad(state, track), playing: true };
    }

    case 'reset':
      return createPlayerState(action.options);

    default:
      return state;
  }
}
