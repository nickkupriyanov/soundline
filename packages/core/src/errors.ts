/**
 * The error contract between an adapter, the engine and the player.
 *
 * An adapter or an engine throws `PlaybackError` to state *what it knows*: the
 * code is a classification, and `isPlaybackError()` recognises it even when it
 * was produced by a second copy of this package. Anything else that is thrown is
 * normalised to the fallback code chosen by the caller.
 */
import type { PlaybackErrorCode } from './types';

/** Every code, in the order of the specification table. */
export const PLAYBACK_ERROR_CODES: readonly PlaybackErrorCode[] = [
  'TRACK_NOT_FOUND',
  'SOURCE_UNAVAILABLE',
  'NOT_SUPPORTED',
  'DECODE_FAILED',
  'NETWORK_FAILURE',
  'ADAPTER_CONTRACT_VIOLATION',
  'UNKNOWN',
];

const CODE_SET: ReadonlySet<string> = new Set<string>(PLAYBACK_ERROR_CODES);

export interface PlaybackErrorOptions {
  code: PlaybackErrorCode;
  message: string;
  /** The engine or adapter failure that caused this one. */
  cause?: unknown;
}

/**
 * Thrown by an adapter or an engine to classify a failure.
 *
 * Use it directly in an adapter:
 *
 * ```ts
 * throw new PlaybackError({ code: 'TRACK_NOT_FOUND', message: 'No such track' });
 * ```
 */
export class PlaybackError extends Error {
  readonly code: PlaybackErrorCode;

  constructor(options: PlaybackErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'PlaybackError';
    this.code = options.code;
  }
}

/** Narrows an unknown value to a `PlaybackErrorCode`. */
export function isPlaybackErrorCode(value: unknown): value is PlaybackErrorCode {
  return typeof value === 'string' && CODE_SET.has(value);
}

/**
 * Structural check, deliberately not `instanceof`: an adapter may hold a second
 * copy of this package, and a real failure must not be downgraded to `UNKNOWN`
 * because of that.
 */
export function isPlaybackError(value: unknown): value is PlaybackError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { name?: unknown; code?: unknown; message?: unknown };
  return (
    candidate.name === 'PlaybackError' &&
    isPlaybackErrorCode(candidate.code) &&
    typeof candidate.message === 'string'
  );
}

/**
 * Turns anything an adapter or an engine threw into a `PlaybackError`.
 *
 * `fallbackCode` belongs to the caller: only it knows what the failure means —
 * a missing track becomes `TRACK_NOT_FOUND`, an unresolvable URL becomes
 * `SOURCE_UNAVAILABLE`, and anything unclassified becomes `UNKNOWN`.
 */
export function toPlaybackError(value: unknown, fallbackCode: PlaybackErrorCode): PlaybackError {
  if (isPlaybackError(value)) return value;

  const message = value instanceof Error ? value.message : String(value);
  return new PlaybackError({ code: fallbackCode, message, cause: value });
}

/**
 * `true` for a cancellation the library itself triggered. A cancelled load is
 * not a failure and must not reach `onError`.
 */
export function isAbortError(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const name = (value as { name?: unknown }).name;
  return name === 'AbortError' || name === 'TimeoutError';
}

/**
 * Creates the cancellation error a superseded request is rejected with.
 *
 * The library builds it itself instead of relying on `DOMException`, so an
 * adapter, an engine and the controller all mean the same thing by "aborted" —
 * on the server as much as in a browser — and `isAbortError()` recognises it.
 */
export function createAbortError(message = 'The request was aborted'): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}
