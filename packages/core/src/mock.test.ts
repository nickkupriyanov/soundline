import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isAbortError, isPlaybackError } from './errors';
import { createMockAdapter, createMockEngine } from './mock';
import type { Track } from './types';

const TRACKS: Track[] = [
  { id: 'a', title: 'Alpha', src: 'a.mp3', duration: 30 },
  { id: 'b', title: 'Beta', src: 'b.mp3', duration: 40 },
];

const open = (): AbortSignal => new AbortController().signal;

/* -------------------------------------------------------------------------- */
/*  Mock engine                                                                */
/* -------------------------------------------------------------------------- */

describe('createMockEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('advances the playhead from the clock, deterministically', async () => {
    const engine = createMockEngine({ duration: 10, tickMs: 100 });
    engine.load('a.mp3');
    await engine.play();

    vi.advanceTimersByTime(2400);
    expect(engine.getState().currentTime).toBeCloseTo(2.4, 5);
  });

  it('reports ended at the configured duration', async () => {
    const engine = createMockEngine({ duration: 1, tickMs: 100 });
    engine.load('a.mp3');
    await engine.play();

    vi.advanceTimersByTime(1500);
    expect(engine.getState()).toMatchObject({ status: 'ended', currentTime: 1 });
  });

  it('honours latency before the source is ready', () => {
    const engine = createMockEngine({ duration: 5, latency: 500 });
    engine.load('a.mp3');
    expect(engine.getState().status).toBe('loading');

    vi.advanceTimersByTime(500);
    expect(engine.getState()).toMatchObject({ status: 'ready', duration: 5 });
  });

  it('injects a load failure', () => {
    const engine = createMockEngine({ duration: 5, failures: { 'bad.mp3': 'NOT_SUPPORTED' } });
    engine.load('bad.mp3');

    expect(engine.getState()).toMatchObject({ status: 'error', error: 'NOT_SUPPORTED' });
  });

  it('resolves a play issued during a slow load once it is ready', async () => {
    const engine = createMockEngine({ duration: 5, latency: 500 });
    engine.load('a.mp3');

    const playing = engine.play();
    vi.advanceTimersByTime(500);
    await playing;

    expect(engine.getState().status).toBe('playing');
  });

  it('rejects a play during a load when the load fails', async () => {
    const engine = createMockEngine({
      duration: 5,
      latency: 500,
      failures: { 'bad.mp3': 'DECODE_FAILED' },
    });
    engine.load('bad.mp3');

    const playing = engine.play();
    vi.advanceTimersByTime(500);
    await expect(playing).rejects.toMatchObject({ code: 'DECODE_FAILED' });
  });

  it('rejects play with no source, as a `PlaybackError`', async () => {
    const engine = createMockEngine({ duration: 5 });
    const error = await engine.play().then(
      () => null,
      (thrown: unknown) => thrown,
    );

    expect(isPlaybackError(error)).toBe(true);
    expect(error).toMatchObject({ code: 'SOURCE_UNAVAILABLE' });
  });

  it('restarts from the beginning after ended', async () => {
    const engine = createMockEngine({ duration: 1, tickMs: 100 });
    engine.load('a.mp3');
    await engine.play();
    vi.advanceTimersByTime(1500);
    expect(engine.getState().status).toBe('ended');

    await engine.play();
    expect(engine.getState()).toMatchObject({ status: 'playing', currentTime: 0 });
  });

  it('is deterministic: the same options produce the same timeline', () => {
    const first = createMockEngine({ duration: 10, tickMs: 100 });
    const second = createMockEngine({ duration: 10, tickMs: 100 });

    first.load('x');
    second.load('x');
    void first.play();
    void second.play();
    vi.advanceTimersByTime(1200);

    expect(first.getState()).toEqual(second.getState());
  });
});

/* -------------------------------------------------------------------------- */
/*  Mock adapter                                                               */
/* -------------------------------------------------------------------------- */

describe('createMockAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('returns the configured tracks', async () => {
    const adapter = createMockAdapter({ tracks: TRACKS });
    await expect(
      adapter.getTracks({ context: { key: 'default' }, signal: open() }),
    ).resolves.toEqual(TRACKS);
  });

  it('injects a getTracks failure as a `PlaybackError`', async () => {
    const adapter = createMockAdapter({ tracks: TRACKS, failure: 'NETWORK_FAILURE' });
    const error = await adapter.getTracks({ context: { key: 'default' }, signal: open() }).then(
      () => null,
      (thrown: unknown) => thrown,
    );

    expect(isPlaybackError(error)).toBe(true);
    expect(error).toMatchObject({ code: 'NETWORK_FAILURE' });
  });

  it('resolves a source from the track', async () => {
    const adapter = createMockAdapter({ tracks: TRACKS });
    await expect(adapter.resolveSource!(TRACKS[0], { signal: open() })).resolves.toEqual({
      src: 'a.mp3',
      duration: 30,
    });
  });

  it('fails an unknown track with TRACK_NOT_FOUND', async () => {
    const adapter = createMockAdapter({ tracks: TRACKS });
    const ghost: Track = { id: 'z', title: 'Ghost', src: 'z.mp3' };

    await expect(adapter.resolveSource!(ghost, { signal: open() })).rejects.toMatchObject({
      code: 'TRACK_NOT_FOUND',
    });
  });

  it('injects a source failure', async () => {
    const adapter = createMockAdapter({
      tracks: TRACKS,
      sourceFailures: { b: 'SOURCE_UNAVAILABLE' },
    });
    await expect(adapter.resolveSource!(TRACKS[1], { signal: open() })).rejects.toMatchObject({
      code: 'SOURCE_UNAVAILABLE',
    });
  });

  it('honours latency and abort', async () => {
    const adapter = createMockAdapter({ tracks: TRACKS, latency: 1000 });
    const controller = new AbortController();

    const pending = adapter.getTracks({ context: { key: 'default' }, signal: controller.signal });
    controller.abort();

    const error = await pending.then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(isAbortError(error)).toBe(true);
    vi.advanceTimersByTime(1000);
  });
});
