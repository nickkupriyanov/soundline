import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEngineState,
  createMediaEngine,
  codeForMediaError,
  type PlaybackEngine,
} from './engine';
import { PlaybackError } from './errors';
import { createMockEngine } from './mock';

/* -------------------------------------------------------------------------- */
/*  Shared snapshot                                                            */
/* -------------------------------------------------------------------------- */

describe('createEngineState', () => {
  it('is a neutral snapshot', () => {
    expect(createEngineState()).toEqual({
      status: 'idle',
      src: null,
      currentTime: 0,
      duration: 0,
      buffered: 0,
      volume: 1,
      muted: false,
      rate: 1,
      error: null,
    });
  });

  it('applies overrides', () => {
    expect(createEngineState({ status: 'playing', volume: 0.5, muted: true })).toMatchObject({
      status: 'playing',
      volume: 0.5,
      muted: true,
      src: null,
    });
  });
});

describe('codeForMediaError', () => {
  it('maps the media error codes the player classifies', () => {
    expect(codeForMediaError({ code: 2 } as MediaError)).toBe('NETWORK_FAILURE');
    expect(codeForMediaError({ code: 3 } as MediaError)).toBe('DECODE_FAILED');
    expect(codeForMediaError({ code: 4 } as MediaError)).toBe('NOT_SUPPORTED');
    expect(codeForMediaError({ code: 1 } as MediaError)).toBe('UNKNOWN');
    expect(codeForMediaError(null)).toBe('UNKNOWN');
  });
});

/* -------------------------------------------------------------------------- */
/*  Media engine (no DOM in the node test environment)                         */
/* -------------------------------------------------------------------------- */

describe('createMediaEngine', () => {
  it('is constructed lazily, without touching the DOM', () => {
    const engine = createMediaEngine();
    expect(engine.getState()).toEqual(createEngineState());
  });

  it('refuses to load without a DOM and reports why', () => {
    const engine = createMediaEngine();
    expect(() => engine.load('track.mp3')).toThrow(PlaybackError);
  });

  it('rejects play before anything is loaded', async () => {
    const engine = createMediaEngine();
    await expect(engine.play()).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE' });
  });

  it('notifies subscribers and stops on unsubscribe', () => {
    const engine = createMediaEngine();
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);

    engine.setVolume(0.4);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    engine.setVolume(0.2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(engine.getState().volume).toBe(0.2);
  });

  it('hands out copies, not its internal snapshot', () => {
    const engine = createMediaEngine();
    const snapshot = engine.getState();
    snapshot.volume = 0;
    expect(engine.getState().volume).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/*  The contract, exercised on the fake engine                                 */
/* -------------------------------------------------------------------------- */

function describeEngineContract(name: string, create: () => PlaybackEngine): void {
  describe(`PlaybackEngine contract (${name})`, () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('starts idle and walks load → play → pause', async () => {
      const engine = create();
      expect(engine.getState().status).toBe('idle');

      engine.load('track.mp3');
      expect(engine.getState()).toMatchObject({ status: 'ready', src: 'track.mp3' });

      await engine.play();
      expect(engine.getState().status).toBe('playing');

      engine.pause();
      expect(engine.getState().status).toBe('paused');
    });

    it('reports every telemetry change to subscribers', async () => {
      const engine = create();
      const listener = vi.fn();
      const unsubscribe = engine.subscribe(listener);

      engine.load('track.mp3');
      await engine.play();
      engine.pause();

      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3);
      unsubscribe();
      const seen = listener.mock.calls.length;
      engine.setVolume(0.5);
      expect(listener).toHaveBeenCalledTimes(seen);
    });

    it('applies volume, mute and rate to the snapshot', () => {
      const engine = create();
      engine.setVolume(0.35);
      engine.setMuted(true);
      engine.setRate(1.5);

      expect(engine.getState()).toMatchObject({ volume: 0.35, muted: true, rate: 1.5 });
    });

    it('seeks and clamps to the known duration', () => {
      const engine = create();
      engine.load('track.mp3');

      engine.seek(5);
      expect(engine.getState().currentTime).toBe(5);

      engine.seek(-10);
      expect(engine.getState().currentTime).toBe(0);

      engine.seek(99999);
      expect(engine.getState().currentTime).toBe(engine.getState().duration);
    });

    it('rejects play with no source', async () => {
      const engine = create();
      await expect(engine.play()).rejects.toBeInstanceOf(PlaybackError);
    });
  });
}

describeEngineContract('createMockEngine', () => createMockEngine({ duration: 60 }));
