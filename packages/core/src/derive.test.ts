import { describe, expect, it } from 'vitest';
import { resolvePlayerConfig } from './config';
import { createPlayerViewMemo, derivePlayerView, type PlayerView } from './derive';
import { defaultMessages } from './i18n';
import { createPlayerState, playerReducer, type CreatePlayerStateOptions } from './reducer';
import type { EngineState, Track } from './types';

const TRACKS: Track[] = [
  { id: 'a', title: 'Alpha', artist: 'Ann', album: 'First', duration: 83, artwork: 'a.png' },
  { id: 'b', title: 'Beta', duration: 245 },
  { id: 'c', title: 'Gamma', artist: 'Gus', duration: 5 },
];

const config = resolvePlayerConfig();

function state(overrides: CreatePlayerStateOptions = {}) {
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

describe('derivePlayerView — now playing', () => {
  it('describes the current track, its subtitle and its labels', () => {
    const view = derivePlayerView(state(), config);
    expect(view.nowPlaying).not.toBeNull();
    expect(view.nowPlaying?.trackId).toBe('a');
    expect(view.nowPlaying?.title).toBe('Alpha');
    expect(view.nowPlaying?.artist).toBe('Ann');
    expect(view.nowPlaying?.album).toBe('First');
    expect(view.nowPlaying?.artwork).toBe('a.png');
    expect(view.nowPlaying?.subtitle).toBe('Ann — First');
    expect(view.nowPlaying?.label).toBe('Now playing: Alpha');
    expect(view.nowPlaying?.durationLabel).toBe('1:23');
  });

  it('has no subtitle when neither artist nor album is known', () => {
    const view = derivePlayerView(state({ currentTrackId: 'b' }), config);
    expect(view.nowPlaying?.subtitle).toBeNull();
  });

  it('is null when nothing is selected', () => {
    const view = derivePlayerView(state({ currentTrackId: null }), config);
    expect(view.nowPlaying).toBeNull();
  });
});

describe('derivePlayerView — progress', () => {
  it('renders position, duration, percentages and the value text', () => {
    const view = derivePlayerView(
      state(),
      config,
      engineState({ currentTime: 41.5, duration: 83, buffered: 20 }),
    );
    expect(view.progress.position).toBe(41.5);
    expect(view.progress.duration).toBe(83);
    expect(view.progress.percent).toBe(50);
    expect(view.progress.positionLabel).toBe('0:41');
    expect(view.progress.durationLabel).toBe('1:23');
    expect(view.progress.valueText).toBe('0:41 of 1:23');
  });

  it('clamps the buffered layer to 100%', () => {
    const view = derivePlayerView(
      state(),
      config,
      engineState({ currentTime: 70, duration: 83, buffered: 999 }),
    );
    expect(view.progress.bufferedPercent).toBe(100);
  });

  it('stays at zero while the duration is unknown', () => {
    const view = derivePlayerView(state({ currentTrackId: null }), config);
    expect(view.progress.percent).toBe(0);
    expect(view.progress.bufferedPercent).toBe(0);
    expect(view.progress.valueText).toBe('0:00 of 0:00');
  });

  it('falls back to the mirrored telemetry without an engine argument', () => {
    const mirrored = playerReducer(state(), {
      type: 'engineSync',
      engine: engineState({ currentTime: 10, duration: 83 }),
    });
    expect(derivePlayerView(mirrored, config).progress.position).toBe(10);
  });
});

describe('derivePlayerView — transport', () => {
  it('names the play action and mirrors the intent', () => {
    const view = derivePlayerView(state({ playing: true }), config);
    expect(view.transport.playing).toBe(true);
    expect(view.transport.action).toBe('pause');
    expect(view.transport.playLabel).toBe(defaultMessages.en.pauseLabel);
  });

  it('offers next but not next-past-the-end without repeat', () => {
    expect(derivePlayerView(state(), config).transport.canNext).toBe(true);
    const last = derivePlayerView(state({ currentTrackId: 'c' }), config);
    expect(last.transport.canNext).toBe(false);
  });

  it('offers next-past-the-end with repeat all', () => {
    const base = state({ currentTrackId: 'c', loop: 'all' });
    expect(derivePlayerView(base, config).transport.canNext).toBe(true);
  });

  it('describes loop and shuffle', () => {
    const shuffledOne = state({ shuffle: true, loop: 'one' });
    const view = derivePlayerView(shuffledOne, config);
    expect(view.transport.shuffle).toEqual({
      active: true,
      label: defaultMessages.en.shuffleLabel,
    });
    expect(view.transport.loop).toEqual({ mode: 'one', label: defaultMessages.en.repeatOneLabel });
  });

  it('formats the playback rate', () => {
    const view = derivePlayerView(state({ rate: 1.5 }), config);
    expect(view.transport.rate).toBe(1.5);
    expect(view.transport.rateValue).toBe('1.5×');
  });

  it('cannot play an empty queue', () => {
    const view = derivePlayerView(createPlayerState(), config);
    expect(view.transport.canPlay).toBe(false);
    expect(view.transport.canNext).toBe(false);
    expect(view.transport.canPrev).toBe(false);
    expect(view.actions.canToggle).toBe(false);
  });
});

describe('derivePlayerView — volume', () => {
  it('renders the percentage and the value text', () => {
    const view = derivePlayerView(state({ volume: 0.75 }), config);
    expect(view.volumeView.volume).toBe(0.75);
    expect(view.volumeView.percent).toBe(75);
    expect(view.volumeView.valueText).toBe('75%');
    expect(view.volumeView.label).toBe(defaultMessages.en.muteLabel);
  });

  it('names the unmute action while muted', () => {
    const view = derivePlayerView(state({ muted: true }), config);
    expect(view.volumeView.muted).toBe(true);
    expect(view.volumeView.label).toBe(defaultMessages.en.unmuteLabel);
  });
});

describe('derivePlayerView — queue', () => {
  it('numbers the rows and marks the active, playing one', () => {
    const view = derivePlayerView(state({ currentTrackId: 'b', playing: true }), config);
    expect(view.queue.count).toBe(3);
    expect(view.queue.countLabel).toBe('3 tracks');
    expect(view.queue.activeId).toBe('b');
    expect(view.queue.items.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(view.queue.items[1]).toMatchObject({
      id: 'b',
      isActive: true,
      isPlaying: true,
      durationLabel: '4:05',
      label: '2. Beta',
    });
    expect(view.queue.items[0]?.isActive).toBe(false);
  });

  it('shows the configured queue visibility', () => {
    const hidden = derivePlayerView(state(), resolvePlayerConfig({ showQueue: false }));
    expect(hidden.queue.show).toBe(false);
  });
});

describe('derivePlayerView — states and announcement', () => {
  it('announces the current track', () => {
    expect(derivePlayerView(state(), config).live.message).toBe('Now playing: Alpha');
  });

  it('announces the current track while it plays', () => {
    const playing = { ...state(), status: 'playing' as const };
    expect(derivePlayerView(playing, config).live.message).toBe('Now playing: Alpha');
  });

  it('names the track again, in the paused wording, once playback stops', () => {
    const paused = { ...state({ playing: true }), status: 'paused' as const };
    expect(derivePlayerView(paused, config).live.message).toBe('Paused: Alpha');
  });

  it('does not announce a pause for a track that never started', () => {
    // `idle` is the engine before the first `play`, so "Paused: Alpha" here would
    // be a lie the visitor never asked for.
    const idle = { ...state(), status: 'idle' as const };
    expect(derivePlayerView(idle, config).live.message).toBe('Now playing: Alpha');
  });

  it('keeps a failure above the paused wording', () => {
    const failed = playerReducer(
      { ...state({ playing: true }), status: 'paused' },
      {
        type: 'engineFailed',
        error: { code: 'NETWORK_FAILURE', phase: 'playback', message: 'offline' },
      },
    );
    expect(derivePlayerView(failed, config).live.message).toBe(defaultMessages.en.genericError);
  });

  it('announces loading while the list arrives', () => {
    const view = derivePlayerView(createPlayerState(), config);
    expect(view.loading).toBe(true);
    expect(view.live.message).toBe(defaultMessages.en.loadingLabel);
  });

  it('announces an empty playlist', () => {
    const view = derivePlayerView(
      state({ queue: [], queueStatus: 'ready', currentTrackId: null }),
      config,
    );
    expect(view.empty).toBe(true);
    expect(view.live.message).toBe(defaultMessages.en.emptyLabel);
  });

  it('announces a failure', () => {
    const failed = playerReducer(state(), {
      type: 'engineFailed',
      error: { code: 'NETWORK_FAILURE', phase: 'playback', message: 'offline' },
    });
    const view = derivePlayerView(failed, config);
    expect(view.error?.code).toBe('NETWORK_FAILURE');
    expect(view.live.message).toBe(defaultMessages.en.genericError);
    expect(view.errorMessage).toBe(defaultMessages.en.genericError);
  });

  it('announces a track list that could not be fetched', () => {
    const failed = playerReducer(state({ queue: [], queueStatus: 'loading' }), {
      type: 'queueFailed',
      token: 0,
      error: { code: 'NETWORK_FAILURE', phase: 'tracks', message: 'offline' },
    });

    const view = derivePlayerView(failed, config);
    // The failure is the state, not a forever-loading card with an empty list.
    expect(view.error?.code).toBe('NETWORK_FAILURE');
    expect(view.loading).toBe(false);
    expect(view.empty).toBe(false);
    // A failed list is not a failed track: both the region and the error state
    // name the playlist instead of blaming a track nobody tried to play.
    expect(view.live.message).toBe(defaultMessages.en.queueError);
    expect(view.errorMessage).toBe(defaultMessages.en.queueError);
  });

  it('carries no failure copy while nothing has failed', () => {
    expect(derivePlayerView(state(), config).errorMessage).toBe('');
  });

  it('names an unsupported format instead of blaming the load', () => {
    const failed = playerReducer(state(), {
      type: 'engineFailed',
      error: { code: 'NOT_SUPPORTED', phase: 'source', message: 'flac' },
    });

    const view = derivePlayerView(failed, config);
    // The dictionary has a string for this case; a failure that has its own words
    // must not be rendered with the generic ones.
    expect(view.live.message).toBe(defaultMessages.en.unsupportedLabel);
    expect(view.errorMessage).toBe(defaultMessages.en.unsupportedLabel);
  });

  it('announces the end of the playlist', () => {
    const ended = { ...state({ currentTrackId: 'c' }), status: 'ended' as const };
    const view = derivePlayerView(ended, config);
    expect(view.live.message).toBe(defaultMessages.en.endedLabel);
  });
});

describe('derivePlayerView — actions and settings', () => {
  it('enables seeking once a duration is known', () => {
    expect(derivePlayerView(state(), config).actions.canSeek).toBe(true);
    const unknown = derivePlayerView(state({ currentTrackId: null }), config);
    expect(unknown.actions.canSeek).toBe(false);
  });

  it('enables retry only after a failure with a selected track', () => {
    const failed = playerReducer(state(), {
      type: 'engineFailed',
      error: { code: 'UNKNOWN', phase: 'playback', message: '' },
    });
    expect(derivePlayerView(failed, config).actions.canRetry).toBe(true);
    expect(derivePlayerView(state(), config).actions.canRetry).toBe(false);
  });

  it('enables retry for a failed track list, even with no track selected', () => {
    const failed = playerReducer(state({ queue: [], queueStatus: 'loading' }), {
      type: 'queueFailed',
      token: 0,
      error: { code: 'NETWORK_FAILURE', phase: 'tracks', message: 'offline' },
    });

    // Retrying a list needs no track — the controller re-fetches it.
    expect(derivePlayerView(failed, config).actions.canRetry).toBe(true);
  });

  it('exposes the presentation settings', () => {
    const view = derivePlayerView(
      state(),
      resolvePlayerConfig({
        locale: 'ru',
        theme: 'light',
        layout: 'compact',
        seekStep: 10,
        volumeStep: 0.1,
      }),
    );
    expect(view.settings).toEqual({
      locale: 'ru',
      theme: 'light',
      layout: 'compact',
      showQueue: true,
      seekStep: 10,
      volumeStep: 0.1,
      contextKey: 'default',
    });
  });
});

describe('createPlayerViewMemo', () => {
  const config = resolvePlayerConfig();

  it('returns the same object for the same key', () => {
    const memo = createPlayerViewMemo();
    const first = memo.get('1|0|0', state(), config);
    const second = memo.get('1|0|0', state(), config);
    expect(second).toBe(first);
  });

  it('recomputes when the key changes', () => {
    const memo = createPlayerViewMemo();
    const snapshot = state();
    const first: PlayerView = memo.get('1|0|0', snapshot, config);
    const second = memo.get('2|0|0', snapshot, config);
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
  });
});
