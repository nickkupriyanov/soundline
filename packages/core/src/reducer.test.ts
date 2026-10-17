import { describe, expect, it } from 'vitest';
import {
  createPlayerState,
  createShuffledOrder,
  playerReducer,
  type CreatePlayerStateOptions,
  type PlayerState,
} from './reducer';
import type { EngineState, Track } from './types';

const TRACKS: Track[] = [
  { id: 'a', title: 'Alpha', artist: 'Ann', album: 'First', duration: 60 },
  { id: 'b', title: 'Beta', duration: 120 },
  { id: 'c', title: 'Gamma', duration: 180 },
];

function fresh(overrides: CreatePlayerStateOptions = {}): PlayerState {
  return createPlayerState({ queue: TRACKS, ...overrides });
}

function engineState(overrides: Partial<EngineState> = {}): EngineState {
  return {
    status: 'playing',
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

function run(state: PlayerState, ...actions: Parameters<typeof playerReducer>[1][]): PlayerState {
  return actions.reduce(playerReducer, state);
}

function ids(state: PlayerState): string[] {
  return state.queue.map((track) => track.id);
}

describe('createPlayerState', () => {
  it('selects the first track when none is given', () => {
    const state = fresh();
    expect(state.currentTrackId).toBe('a');
    expect(state.index).toBe(0);
    expect(state.queueStatus).toBe('ready');
    expect(state.status).toBe('idle');
    expect(state.duration).toBe(60);
  });

  it('selects nothing when `currentTrackId` is explicitly null', () => {
    const state = fresh({ currentTrackId: null });
    expect(state.currentTrackId).toBeNull();
    expect(state.index).toBe(-1);
  });

  it('drops a selection the queue does not contain', () => {
    expect(fresh({ currentTrackId: 'z' }).currentTrackId).toBeNull();
  });

  it('starts idle without a queue', () => {
    const state = createPlayerState();
    expect(state.queueStatus).toBe('idle');
    expect(state.currentTrackId).toBeNull();
    expect(state.queue).toEqual([]);
  });

  it('clamps volume and rate into range', () => {
    expect(fresh({ volume: 2 }).volume).toBe(1);
    expect(fresh({ volume: -1 }).volume).toBe(0);
    expect(fresh({ rate: 99 }).rate).toBe(4);
    expect(fresh({ rate: 0.01 }).rate).toBe(0.25);
  });

  it('takes the context key and controls', () => {
    const state = fresh({ contextKey: 'album-7', muted: true, loop: 'all', shuffle: true });
    expect(state.contextKey).toBe('album-7');
    expect(state.muted).toBe(true);
    expect(state.loop).toBe('all');
    expect(state.shuffle).toBe(true);
  });
});

describe('queue lifecycle', () => {
  it('ignores a loaded list from a stale token', () => {
    const state = run(createPlayerState(), { type: 'queueLoading', token: 2 });
    const loaded = playerReducer(state, { type: 'queueLoaded', token: 1, tracks: TRACKS });
    expect(loaded).toBe(state);
  });

  it('selects the first track when the list arrives', () => {
    const state = run(
      createPlayerState(),
      { type: 'queueLoading', token: 1 },
      {
        type: 'queueLoaded',
        token: 1,
        tracks: TRACKS,
      },
    );
    expect(ids(state)).toEqual(['a', 'b', 'c']);
    expect(state.currentTrackId).toBe('a');
    expect(state.status).toBe('loading');
    expect(state.queueStatus).toBe('ready');
    expect(state.loadToken).toBe(1);
  });

  it('keeps the current track when it survives a reload', () => {
    const base = fresh();
    const state = run(
      base,
      { type: 'queueLoading', token: 1 },
      {
        type: 'queueLoaded',
        token: 1,
        tracks: [TRACKS[2], TRACKS[0]],
      },
    );
    expect(state.currentTrackId).toBe('a');
    expect(state.index).toBe(1);
    expect(state.loadToken).toBe(base.loadToken);
  });

  it('returns to an empty, non-error state for an empty list', () => {
    const state = run(
      fresh(),
      { type: 'queueLoading', token: 1 },
      {
        type: 'queueLoaded',
        token: 1,
        tracks: [],
      },
    );
    expect(state.queue).toEqual([]);
    expect(state.currentTrackId).toBeNull();
    expect(state.queueStatus).toBe('ready');
    expect(state.playing).toBe(false);
  });

  it('records a track-list failure', () => {
    const error = { code: 'NETWORK_FAILURE', phase: 'tracks', message: 'offline' } as const;
    const state = run(
      createPlayerState(),
      { type: 'queueLoading', token: 1 },
      {
        type: 'queueFailed',
        token: 1,
        error,
      },
    );
    expect(state.queueStatus).toBe('error');
    expect(state.queueError).toEqual(error);
  });
});

describe('selection and loading', () => {
  it('loads the track and resets the playhead', () => {
    const base = run(fresh(), { type: 'engineSync', engine: engineState({ currentTime: 30 }) });
    const state = playerReducer(base, { type: 'select', trackId: 'b' });
    expect(state.currentTrackId).toBe('b');
    expect(state.index).toBe(1);
    expect(state.status).toBe('loading');
    expect(state.currentTime).toBe(0);
    expect(state.duration).toBe(120);
    expect(state.loadToken).toBe(base.loadToken + 1);
  });

  it('is a no-op when the same track is re-selected', () => {
    const base = fresh();
    expect(playerReducer(base, { type: 'select', trackId: 'a' })).toBe(base);
  });

  it('ignores an unknown track id', () => {
    const base = fresh();
    expect(playerReducer(base, { type: 'select', trackId: 'z' })).toBe(base);
  });

  it('clears the source when nothing is selected', () => {
    const state = playerReducer(fresh(), { type: 'select', trackId: null });
    expect(state.currentTrackId).toBeNull();
    expect(state.index).toBe(-1);
    expect(state.status).toBe('loading');
  });
});

describe('play, pause and toggle', () => {
  it('plays without a reload when the source is ready', () => {
    const base = run(fresh(), { type: 'engineSync', engine: engineState({ status: 'ready' }) });
    const state = playerReducer(base, { type: 'play' });
    expect(state.playing).toBe(true);
    expect(state.pendingPlay).toBe(false);
    expect(state.loadToken).toBe(base.loadToken);
  });

  it('waits for the engine while a source is loading', () => {
    const base = run(fresh(), { type: 'play' });
    expect(base.status).toBe('loading');
    expect(base.playing).toBe(true);
    expect(base.pendingPlay).toBe(true);
  });

  it('clears pendingPlay once the engine is ready', () => {
    const playing = playerReducer(fresh(), { type: 'play' });
    const ready = playerReducer(playing, {
      type: 'engineSync',
      engine: engineState({ status: 'ready' }),
    });
    expect(ready.pendingPlay).toBe(false);
    expect(ready.playing).toBe(true);
  });

  it('loads the current track when playing from idle', () => {
    const base = run(fresh(), {
      type: 'select',
      trackId: 'a',
    });
    const idle = { ...base, status: 'idle' as const };
    const state = playerReducer(idle, { type: 'play' });
    expect(state.status).toBe('loading');
    expect(state.loadToken).toBe(base.loadToken + 1);
  });

  it('reloads after the queue ended', () => {
    const ended = { ...fresh(), status: 'ended' as const, playing: false };
    const state = playerReducer(ended, { type: 'play' });
    expect(state.status).toBe('loading');
    expect(state.playing).toBe(true);
  });

  it('is a no-op when play is asked for again while playing', () => {
    const playing = run(
      fresh(),
      { type: 'engineSync', engine: engineState({ status: 'playing' }) },
      {
        type: 'play',
      },
    );
    expect(playerReducer(playing, { type: 'play' })).toBe(playing);
  });

  it('does nothing for an empty queue', () => {
    const state = createPlayerState();
    expect(playerReducer(state, { type: 'play' })).toBe(state);
  });

  it('pauses and clears the pending play', () => {
    const playing = run(fresh(), { type: 'play' });
    const paused = playerReducer(playing, { type: 'pause' });
    expect(paused.playing).toBe(false);
    expect(paused.pendingPlay).toBe(false);
  });

  it('toggles between intent and pause', () => {
    const playing = playerReducer(fresh(), { type: 'toggle' });
    expect(playing.playing).toBe(true);
    expect(playerReducer(playing, { type: 'toggle' }).playing).toBe(false);
  });
});

describe('seek, volume, mute and rate', () => {
  it('clamps a seek into the track duration', () => {
    const base = run(fresh(), { type: 'engineSync', engine: engineState({ duration: 60 }) });
    expect(playerReducer(base, { type: 'seek', time: 30 }).currentTime).toBe(30);
    expect(playerReducer(base, { type: 'seek', time: 100 }).currentTime).toBe(60);
    expect(playerReducer(base, { type: 'seek', time: -5 }).currentTime).toBe(0);
  });

  it('ignores a seek when the duration is unknown', () => {
    const base = createPlayerState({ queue: [{ id: 'x', title: 'X' }] });
    expect(base.duration).toBe(0);
    expect(playerReducer(base, { type: 'seek', time: 10 })).toBe(base);
  });

  it('clamps volume and ignores a no-op', () => {
    const base = fresh();
    expect(playerReducer(base, { type: 'setVolume', volume: 0.5 }).volume).toBe(0.5);
    expect(playerReducer(base, { type: 'setVolume', volume: 3 }).volume).toBe(1);
    expect(playerReducer(base, { type: 'setVolume', volume: 1 })).toBe(base);
  });

  it('sets and toggles mute', () => {
    const base = fresh();
    expect(playerReducer(base, { type: 'setMuted', muted: true }).muted).toBe(true);
    expect(playerReducer(base, { type: 'toggleMute' }).muted).toBe(true);
    expect(playerReducer(base, { type: 'setMuted', muted: false })).toBe(base);
  });

  it('clamps the playback rate', () => {
    const base = fresh();
    expect(playerReducer(base, { type: 'setRate', rate: 1.5 }).rate).toBe(1.5);
    expect(playerReducer(base, { type: 'setRate', rate: 100 }).rate).toBe(4);
    expect(playerReducer(base, { type: 'setRate', rate: 1 })).toBe(base);
  });
});

describe('loop and shuffle', () => {
  it('cycles the loop mode', () => {
    let state = fresh();
    state = playerReducer(state, { type: 'cycleLoop' });
    expect(state.loop).toBe('all');
    state = playerReducer(state, { type: 'cycleLoop' });
    expect(state.loop).toBe('one');
    state = playerReducer(state, { type: 'cycleLoop' });
    expect(state.loop).toBe('off');
  });

  it('sets an explicit loop mode', () => {
    expect(playerReducer(fresh(), { type: 'setLoop', loop: 'one' }).loop).toBe('one');
    expect(playerReducer(fresh(), { type: 'setLoop', loop: 'nope' as never }).loop).toBe('off');
  });

  it('reorders the queue to a provided shuffled order and remembers the original', () => {
    const state = playerReducer(fresh(), {
      type: 'setShuffle',
      shuffle: true,
      order: ['b', 'c', 'a'],
    });
    expect(ids(state)).toEqual(['b', 'c', 'a']);
    expect(state.order).toEqual(['a', 'b', 'c']);
    expect(state.index).toBe(2);
    expect(state.currentTrackId).toBe('a');
  });

  it('restores the original order when shuffle is turned off', () => {
    const shuffled = playerReducer(fresh(), {
      type: 'setShuffle',
      shuffle: true,
      order: ['b', 'c', 'a'],
    });
    const restored = playerReducer(shuffled, { type: 'setShuffle', shuffle: false });
    expect(ids(restored)).toEqual(['a', 'b', 'c']);
    expect(restored.order).toBeNull();
    expect(restored.index).toBe(0);
  });

  it('toggles shuffle both ways', () => {
    const on = playerReducer(fresh(), { type: 'toggleShuffle', order: ['c', 'a', 'b'] });
    expect(on.shuffle).toBe(true);
    expect(ids(on)).toEqual(['c', 'a', 'b']);
    expect(playerReducer(on, { type: 'toggleShuffle' }).shuffle).toBe(false);
  });

  it('is a no-op when the shuffle flag does not move', () => {
    const base = fresh();
    expect(playerReducer(base, { type: 'setShuffle', shuffle: false })).toBe(base);
  });
});

describe('createShuffledOrder', () => {
  it('pins the current track first and keeps every other track', () => {
    const order = createShuffledOrder(['a', 'b', 'c', 'd'], 'c', () => 0);
    expect(order[0]).toBe('c');
    expect([...order].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is deterministic for a given random source', () => {
    const seeded = () => 0.5;
    expect(createShuffledOrder(['a', 'b', 'c'], 'a', seeded)).toEqual(
      createShuffledOrder(['a', 'b', 'c'], 'a', seeded),
    );
  });

  it('falls back to a plain shuffle when the current track is not in the list', () => {
    const order = createShuffledOrder(['a', 'b'], null, () => 0);
    expect([...order].sort()).toEqual(['a', 'b']);
  });
});

describe('next and previous', () => {
  it('moves forward and backward', () => {
    const forward = playerReducer(fresh(), { type: 'next' });
    expect(forward.currentTrackId).toBe('b');
    expect(playerReducer(forward, { type: 'previous' }).currentTrackId).toBe('a');
  });

  it('does nothing at the end without repeat', () => {
    const base = run(fresh(), { type: 'select', trackId: 'c' });
    expect(playerReducer(base, { type: 'next' })).toBe(base);
  });

  it('wraps at the end with repeat all', () => {
    const base = run(fresh(), { type: 'select', trackId: 'c' }, { type: 'setLoop', loop: 'all' });
    expect(playerReducer(base, { type: 'next' }).currentTrackId).toBe('a');
  });

  it('wraps backwards with repeat all', () => {
    const base = run(fresh(), { type: 'setLoop', loop: 'all' });
    expect(playerReducer(base, { type: 'previous' }).currentTrackId).toBe('c');
  });

  it('restarts the first track on previous without repeat', () => {
    const base = run(fresh(), { type: 'engineSync', engine: engineState({ currentTime: 10 }) });
    const state = playerReducer(base, { type: 'previous' });
    expect(state.currentTrackId).toBe('a');
    expect(state.currentTime).toBe(0);
    expect(state.loadToken).toBe(base.loadToken + 1);
  });
});

describe('end of a source', () => {
  function playing(index = 0): PlayerState {
    const selected = run(fresh({ playing: true }), { type: 'select', trackId: TRACKS[index].id });
    return playerReducer(selected, {
      type: 'engineSync',
      engine: engineState({ status: 'playing', duration: 200 }),
    });
  }

  function end(state: PlayerState): PlayerState {
    return playerReducer(state, { type: 'ended', loadToken: state.loadToken });
  }

  it('advances to the next track with repeat off', () => {
    const state = end(playing());
    expect(state.currentTrackId).toBe('b');
    expect(state.status).toBe('loading');
    expect(state.playing).toBe(true);
  });

  it('replays the same track with repeat one', () => {
    const base = run(playing(), { type: 'setLoop', loop: 'one' });
    const state = end(base);
    expect(state.currentTrackId).toBe('a');
    expect(state.status).toBe('loading');
    expect(state.loadToken).toBe(base.loadToken + 1);
  });

  it('wraps with repeat all at the end', () => {
    const base = run(playing(2), { type: 'setLoop', loop: 'all' });
    expect(end(base).currentTrackId).toBe('a');
  });

  it('stops at the end without repeat', () => {
    const state = end(playing(2));
    expect(state.status).toBe('ended');
    expect(state.playing).toBe(false);
    expect(state.currentTime).toBe(200);
  });

  it('handles the end of a source exactly once', () => {
    const base = playing();
    const ended = end(base);
    const again = playerReducer(ended, { type: 'ended', loadToken: base.loadToken });
    expect(again.currentTrackId).toBe('b');
    expect(again.loadToken).toBe(ended.loadToken);
  });

  it('ignores a stale end', () => {
    const base = playing();
    expect(playerReducer(base, { type: 'ended', loadToken: base.loadToken + 5 })).toBe(base);
  });
});

describe('engine telemetry', () => {
  it('mirrors status, time, buffered and duration', () => {
    const state = playerReducer(fresh(), {
      type: 'engineSync',
      engine: engineState({ status: 'playing', currentTime: 12, buffered: 3, duration: 60 }),
    });
    expect(state.status).toBe('playing');
    expect(state.currentTime).toBe(12);
    expect(state.buffered).toBe(3);
    expect(state.duration).toBe(60);
  });

  it('keeps the known duration when the engine reports zero', () => {
    const state = playerReducer(fresh(), {
      type: 'engineSync',
      engine: engineState({ status: 'ready', duration: 0 }),
    });
    expect(state.duration).toBe(60);
  });

  it('records an engine failure', () => {
    const error = { code: 'DECODE_FAILED', phase: 'playback', message: 'bad codec' } as const;
    const state = playerReducer(fresh(), { type: 'engineFailed', error });
    expect(state.status).toBe('error');
    expect(state.error).toEqual(error);
    expect(state.playing).toBe(false);
  });

  it('falls back to a coded error when only the engine code is known', () => {
    const state = playerReducer(fresh(), {
      type: 'engineSync',
      engine: engineState({ status: 'error', error: 'NOT_SUPPORTED' }),
    });
    expect(state.status).toBe('error');
    expect(state.error).toEqual({ code: 'NOT_SUPPORTED', phase: 'playback', message: '' });
  });
});

describe('queue editing', () => {
  it('appends tracks and keeps the selection', () => {
    const extra: Track = { id: 'd', title: 'Delta' };
    const state = playerReducer(fresh(), { type: 'enqueue', tracks: [extra] });
    expect(ids(state)).toEqual(['a', 'b', 'c', 'd']);
    expect(state.currentTrackId).toBe('a');
  });

  it('selects the first enqueued track when the player was empty', () => {
    const extra: Track = { id: 'd', title: 'Delta' };
    const state = playerReducer(createPlayerState(), { type: 'enqueue', tracks: [extra] });
    expect(state.currentTrackId).toBe('d');
    expect(state.status).toBe('loading');
  });

  it('advances when the current track is removed', () => {
    const state = playerReducer(fresh(), { type: 'removeFromQueue', trackId: 'a' });
    expect(ids(state)).toEqual(['b', 'c']);
    expect(state.currentTrackId).toBe('b');
    expect(state.index).toBe(0);
  });

  it('falls back to the previous track when the last one is removed', () => {
    const base = run(fresh(), { type: 'select', trackId: 'c' });
    const state = playerReducer(base, { type: 'removeFromQueue', trackId: 'c' });
    expect(state.currentTrackId).toBe('b');
    expect(state.index).toBe(1);
  });

  it('keeps the selection when another track is removed', () => {
    const state = playerReducer(fresh(), { type: 'removeFromQueue', trackId: 'c' });
    expect(state.currentTrackId).toBe('a');
    expect(ids(state)).toEqual(['a', 'b']);
  });

  it('empties the player when the last track is removed', () => {
    const base = createPlayerState({ queue: [TRACKS[0]] });
    const state = playerReducer(base, { type: 'removeFromQueue', trackId: 'a' });
    expect(state.queue).toEqual([]);
    expect(state.currentTrackId).toBeNull();
    expect(state.status).toBe('idle');
  });

  it('moves a track and keeps the current one in view', () => {
    const base = run(fresh(), { type: 'select', trackId: 'b' });
    const state = playerReducer(base, { type: 'moveInQueue', from: 0, to: 2 });
    expect(ids(state)).toEqual(['b', 'c', 'a']);
    expect(state.currentTrackId).toBe('b');
    expect(state.index).toBe(0);
  });

  it('ignores an out-of-range move', () => {
    const base = fresh();
    expect(playerReducer(base, { type: 'moveInQueue', from: 0, to: 9 })).toBe(base);
  });

  it('clears the queue', () => {
    const state = playerReducer(fresh(), { type: 'clearQueue' });
    expect(state.queue).toEqual([]);
    expect(state.currentTrackId).toBeNull();
    expect(state.queueStatus).toBe('ready');
  });
});

describe('context, retry, reset and lifecycle', () => {
  it('resets the queue and the selection when the context changes', () => {
    const state = playerReducer(fresh({ volume: 0.4, loop: 'all' }), {
      type: 'contextChanged',
      key: 'album-7',
    });
    expect(state.contextKey).toBe('album-7');
    expect(state.queue).toEqual([]);
    expect(state.currentTrackId).toBeNull();
    expect(state.queueStatus).toBe('idle');
    expect(state.volume).toBe(0.4);
    expect(state.loop).toBe('all');
  });

  it('ignores a context change to the same key', () => {
    const base = fresh();
    expect(playerReducer(base, { type: 'contextChanged', key: base.contextKey })).toBe(base);
  });

  it('retries a failed track', () => {
    const failed = playerReducer(fresh(), {
      type: 'engineFailed',
      error: { code: 'NETWORK_FAILURE', phase: 'playback', message: 'offline' },
    });
    const state = playerReducer(failed, { type: 'retry' });
    expect(state.status).toBe('loading');
    expect(state.error).toBeNull();
    expect(state.playing).toBe(true);
  });

  it('ignores a retry without an error', () => {
    const base = fresh();
    expect(playerReducer(base, { type: 'retry' })).toBe(base);
  });

  it('resets to a fresh state, seeded by options', () => {
    const played = playerReducer(fresh({ volume: 0.3 }), {
      type: 'engineSync',
      engine: engineState({ status: 'playing' }),
    });
    const state = playerReducer(played, { type: 'reset', options: { queue: TRACKS } });
    expect(state.status).toBe('idle');
    expect(state.playing).toBe(false);
    expect(state.currentTrackId).toBe('a');
    expect(state.volume).toBe(1);
  });

  it('tracks the started flag idempotently', () => {
    const started = playerReducer(fresh(), { type: 'started' });
    expect(started.started).toBe(true);
    expect(playerReducer(started, { type: 'started' })).toBe(started);
    expect(playerReducer(started, { type: 'stopped' }).started).toBe(false);
  });

  it('returns the same object for an unknown action', () => {
    const base = fresh();
    expect(playerReducer(base, { type: 'nope' } as never)).toBe(base);
  });
});
