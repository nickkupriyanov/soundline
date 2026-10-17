/**
 * The track source contract.
 *
 * An adapter answers two questions: *which* tracks make up the playlist, and
 * *what URL* to play for a given track. The first is required, the second is
 * optional — an adapter that already puts `src` on its tracks needs nothing more.
 *
 * Every call carries an `AbortSignal`. The controller aborts it when a request is
 * superseded (the playlist context changed, the player moved on) and a real
 * adapter is expected to pass the signal to `fetch`. A cancellation is not a
 * failure: the library drops it before it can reach `onError`.
 */
import { createAbortError, PlaybackError } from './errors';
import type { PlaylistContext, Track } from './types';

/* -------------------------------------------------------------------------- */
/*  Contract                                                                   */
/* -------------------------------------------------------------------------- */

/** What an adapter receives for one `getTracks` call. */
export interface TrackQuery<TContextData = unknown> {
  /** The playlist to load. */
  context: PlaylistContext<TContextData>;
  /** Aborted when the request is superseded. */
  signal: AbortSignal;
}

/** The playable source of one track, as resolved by an adapter. */
export interface ResolvedSource {
  /** The URL the engine loads. */
  src: string;
  /** Duration in seconds, when the adapter already knows it. */
  duration?: number;
  /** MIME type, when the adapter already knows it. */
  type?: string;
}

/**
 * The track source a player works against.
 *
 * `getTracks` returns the playlist in playback order. `resolveSource` is optional
 * and used when track listings do not carry a URL — the adapter resolves one on
 * demand, which is how a signed or expiring URL is kept out of the list.
 */
export interface TrackSourceAdapter<TData = unknown, TContextData = unknown> {
  getTracks(query: TrackQuery<TContextData>): Promise<Track<TData>[]>;
  resolveSource?(track: Track<TData>, options: { signal: AbortSignal }): Promise<ResolvedSource>;
}

/* -------------------------------------------------------------------------- */
/*  Static adapter                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Wraps a fixed list of tracks into an adapter.
 *
 * The list is copied on every call, so a consumer can mutate their own array
 * without surprising the player, and `resolveSource` reads `track.src` directly.
 * A track without a source fails with `SOURCE_UNAVAILABLE` rather than resolving
 * to an empty URL.
 */
export function createStaticAdapter<TData = unknown, TContextData = unknown>(
  tracks: readonly Track<TData>[],
): TrackSourceAdapter<TData, TContextData> {
  const snapshot = [...tracks];

  return {
    getTracks({ signal }) {
      if (signal.aborted) return Promise.reject(createAbortError());
      return Promise.resolve([...snapshot]);
    },
    resolveSource(track, { signal }) {
      if (signal.aborted) return Promise.reject(createAbortError());
      if (!track.src) {
        return Promise.reject(
          new PlaybackError({
            code: 'SOURCE_UNAVAILABLE',
            message: `Soundline: track "${track.id}" has no source`,
          }),
        );
      }
      return Promise.resolve({
        src: track.src,
        ...(typeof track.duration === 'number' ? { duration: track.duration } : {}),
      });
    },
  };
}
