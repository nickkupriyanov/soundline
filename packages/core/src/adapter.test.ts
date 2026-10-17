import { describe, expect, it } from 'vitest';
import { createStaticAdapter } from './adapter';
import { isAbortError } from './errors';
import type { Track } from './types';

const TRACKS: Track[] = [
  { id: 'a', title: 'Alpha', src: 'a.mp3', duration: 60 },
  { id: 'b', title: 'Beta' },
];

const context = { key: 'default' };
const open = (): AbortSignal => new AbortController().signal;

describe('createStaticAdapter', () => {
  it('returns a copy of the tracks, so the caller cannot mutate the source', async () => {
    const adapter = createStaticAdapter(TRACKS);

    const tracks = await adapter.getTracks({ context, signal: open() });
    expect(tracks).toEqual(TRACKS);
    expect(tracks).not.toBe(TRACKS);

    tracks[0] = { ...tracks[0], title: 'Changed' };
    expect((await adapter.getTracks({ context, signal: open() }))[0]?.title).toBe('Alpha');
  });

  it('resolves a source from the track', async () => {
    const adapter = createStaticAdapter(TRACKS);
    await expect(adapter.resolveSource!(TRACKS[0], { signal: open() })).resolves.toEqual({
      src: 'a.mp3',
      duration: 60,
    });
  });

  it('fails a track without a source', async () => {
    const adapter = createStaticAdapter(TRACKS);
    await expect(adapter.resolveSource!(TRACKS[1], { signal: open() })).rejects.toMatchObject({
      code: 'SOURCE_UNAVAILABLE',
    });
  });

  it('rejects a request that was aborted before it started', async () => {
    const adapter = createStaticAdapter(TRACKS);
    const aborted = AbortSignal.abort();

    await expect(adapter.getTracks({ context, signal: aborted })).rejects.toMatchObject({
      name: 'AbortError',
    });
    await expect(adapter.resolveSource!(TRACKS[0], { signal: aborted })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('produces errors `isAbortError` recognises', async () => {
    const adapter = createStaticAdapter(TRACKS);
    const error = await adapter.getTracks({ context, signal: AbortSignal.abort() }).then(
      () => null,
      (thrown: unknown) => thrown,
    );
    expect(isAbortError(error)).toBe(true);
  });
});
