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

/* -------------------------------------------------------------------------- */
/*  The media engine, driven by a fake element                                 */
/* -------------------------------------------------------------------------- */

/**
 * Just enough of an `<audio>` element for the engine: the media events it listens
 * to, the properties it mirrors and a `pause()` that records being asked.
 */
class FakeAudio extends EventTarget {
  src = '';
  currentTime = 0;
  duration = 100;
  volume = 1;
  muted = false;
  playbackRate = 1;
  preload = 'metadata';
  paused = true;
  error: MediaError | null = null;
  buffered = { length: 0, start: () => 0, end: () => 0 };
  loadCalls = 0;
  pauseCalls = 0;
  /** Whether `load()` should report metadata at once, as a cached source would. */
  autoMetadata = true;

  load(): void {
    this.loadCalls += 1;
    if (!this.autoMetadata) return;
    this.duration = 100;
    this.dispatchEvent(new Event('loadedmetadata'));
  }

  play(): Promise<void> {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  }

  pause(): void {
    this.pauseCalls += 1;
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
}

function mediaEngine() {
  const audio = new FakeAudio();
  const engine = createMediaEngine({
    createElement: () => audio as unknown as HTMLAudioElement,
  });
  return { audio, engine };
}

async function playLoaded(engine: PlaybackEngine): Promise<void> {
  engine.load('track.mp3');
  await engine.play();
}

describe('createMediaEngine (injected element)', () => {
  it('leaves the loading status when a stalled source resumes', async () => {
    const { audio, engine } = mediaEngine();
    await playLoaded(engine);
    expect(engine.getState().status).toBe('playing');

    // The source ran dry: the player shows its loading block.
    audio.dispatchEvent(new Event('waiting'));
    expect(engine.getState().status).toBe('loading');

    // Resumed playback only announces `playing`; without that listener the
    // status would stay `loading` while the audio is already running.
    audio.dispatchEvent(new Event('playing'));
    expect(engine.getState().status).toBe('playing');
  });

  it('pauses a stalled element and ignores a late `playing` event', async () => {
    const { audio, engine } = mediaEngine();
    await playLoaded(engine);
    audio.dispatchEvent(new Event('waiting'));

    engine.pause();
    expect(audio.pauseCalls).toBe(1);
    expect(audio.paused).toBe(true);
    expect(engine.getState().status).toBe('paused');

    // A stale event from the aborted resume must not claim playback again.
    audio.dispatchEvent(new Event('playing'));
    expect(engine.getState().status).toBe('paused');
  });

  it('does not move a source that is still loading to `paused`', () => {
    const { audio, engine } = mediaEngine();
    audio.autoMetadata = false;
    const listener = vi.fn();
    engine.subscribe(listener);

    engine.load('track.mp3');
    expect(engine.getState().status).toBe('loading');

    const seen = listener.mock.calls.length;
    engine.pause();
    // There is nothing playing to pause, and the loading status has to survive
    // for `loadedmetadata` to turn it into `ready`.
    expect(audio.pauseCalls).toBe(0);
    expect(engine.getState().status).toBe('loading');
    expect(listener).toHaveBeenCalledTimes(seen);

    audio.dispatchEvent(new Event('loadedmetadata'));
    expect(engine.getState().status).toBe('ready');
  });
});
