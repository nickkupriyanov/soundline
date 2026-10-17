import { describe, expect, it } from 'vitest';
import {
  PLAYBACK_ERROR_CODES,
  PlaybackError,
  createAbortError,
  isAbortError,
  isPlaybackError,
  isPlaybackErrorCode,
  toPlaybackError,
} from './errors';

describe('PLAYBACK_ERROR_CODES', () => {
  it('lists every code in the order of the specification', () => {
    expect(PLAYBACK_ERROR_CODES).toEqual([
      'TRACK_NOT_FOUND',
      'SOURCE_UNAVAILABLE',
      'NOT_SUPPORTED',
      'DECODE_FAILED',
      'NETWORK_FAILURE',
      'ADAPTER_CONTRACT_VIOLATION',
      'UNKNOWN',
    ]);
  });
});

describe('isPlaybackErrorCode', () => {
  it('accepts a known code', () => {
    expect(isPlaybackErrorCode('SOURCE_UNAVAILABLE')).toBe(true);
  });

  it('rejects an unknown code, a non-string and a missing value', () => {
    expect(isPlaybackErrorCode('boom')).toBe(false);
    expect(isPlaybackErrorCode(42)).toBe(false);
    expect(isPlaybackErrorCode(undefined)).toBe(false);
  });
});

describe('PlaybackError', () => {
  it('carries the name, code, message and cause', () => {
    const cause = new Error('media element failed');
    const error = new PlaybackError({ code: 'DECODE_FAILED', message: 'Broken file', cause });

    expect(error.name).toBe('PlaybackError');
    expect(error.code).toBe('DECODE_FAILED');
    expect(error.message).toBe('Broken file');
    expect(error.cause).toBe(cause);
    expect(error).toBeInstanceOf(Error);
  });

  it('leaves the cause undefined when one was not given', () => {
    expect(new PlaybackError({ code: 'UNKNOWN', message: 'nope' }).cause).toBeUndefined();
  });
});

describe('isPlaybackError', () => {
  it('recognises a real error', () => {
    expect(isPlaybackError(new PlaybackError({ code: 'UNKNOWN', message: 'nope' }))).toBe(true);
  });

  it('recognises a structurally identical object from another copy of the package', () => {
    const foreign = { name: 'PlaybackError', code: 'NETWORK_FAILURE', message: 'offline' };
    expect(isPlaybackError(foreign)).toBe(true);
  });

  it('rejects a plain error, a wrong name, an unknown code and a missing message', () => {
    expect(isPlaybackError(new Error('nope'))).toBe(false);
    expect(isPlaybackError({ name: 'SomeError', code: 'UNKNOWN', message: 'nope' })).toBe(false);
    expect(isPlaybackError({ name: 'PlaybackError', code: 'BOOM', message: 'nope' })).toBe(false);
    expect(isPlaybackError({ name: 'PlaybackError', code: 'UNKNOWN' })).toBe(false);
    expect(isPlaybackError(null)).toBe(false);
    expect(isPlaybackError('nope')).toBe(false);
  });
});

describe('toPlaybackError', () => {
  it('passes a classified error through untouched', () => {
    const original = new PlaybackError({ code: 'TRACK_NOT_FOUND', message: 'gone' });
    expect(toPlaybackError(original, 'UNKNOWN')).toBe(original);
  });

  it('wraps a plain error with the fallback code and keeps the cause', () => {
    const cause = new Error('fetch failed');
    const error = toPlaybackError(cause, 'NETWORK_FAILURE');

    expect(error.code).toBe('NETWORK_FAILURE');
    expect(error.message).toBe('fetch failed');
    expect(error.cause).toBe(cause);
  });

  it('wraps a thrown non-error value', () => {
    const error = toPlaybackError('boom', 'ADAPTER_CONTRACT_VIOLATION');

    expect(error.code).toBe('ADAPTER_CONTRACT_VIOLATION');
    expect(error.message).toBe('boom');
  });
});

describe('isAbortError', () => {
  it('recognises an abort and a timeout', () => {
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError({ name: 'TimeoutError' })).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isAbortError(new Error('AbortError'))).toBe(false);
    expect(isAbortError({ name: 'NetworkError' })).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});

describe('createAbortError', () => {
  it('builds an error that `isAbortError` recognises', () => {
    const error = createAbortError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AbortError');
    expect(isAbortError(error)).toBe(true);
  });

  it('takes a custom message', () => {
    expect(createAbortError('superseded').message).toBe('superseded');
  });
});
