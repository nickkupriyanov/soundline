import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTEXT_KEY, DEFAULT_PLAYLIST_CONTEXT, contextKeyOf } from './context';

describe('DEFAULT_PLAYLIST_CONTEXT', () => {
  it('is the implicit single playlist', () => {
    expect(DEFAULT_CONTEXT_KEY).toBe('default');
    expect(DEFAULT_PLAYLIST_CONTEXT).toEqual({ key: DEFAULT_CONTEXT_KEY });
  });
});

describe('contextKeyOf', () => {
  it('reads the key of a context', () => {
    expect(contextKeyOf({ key: 'album-7' })).toBe('album-7');
  });

  it('falls back to the default playlist when none was given', () => {
    expect(contextKeyOf(undefined)).toBe(DEFAULT_CONTEXT_KEY);
  });

  it('keeps the context data out of the key', () => {
    expect(contextKeyOf({ key: 'album-7', data: { token: 'x' } })).toBe('album-7');
  });
});
