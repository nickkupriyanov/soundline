/**
 * Playlist context helpers.
 *
 * A context identifies the playlist a player works against. Until an application
 * supplies its own, the widget works against a single implicit playlist, so a
 * consumer that plays one list needs no extra configuration.
 */
import type { PlaylistContext } from './types';

/** Key of the implicit single playlist. */
export const DEFAULT_CONTEXT_KEY = 'default';

/** The context used when the application does not supply one. */
export const DEFAULT_PLAYLIST_CONTEXT: PlaylistContext = { key: DEFAULT_CONTEXT_KEY };

/** Reads the key of a context, falling back to the default playlist. */
export function contextKeyOf(context: PlaylistContext | undefined): string {
  return context?.key ?? DEFAULT_CONTEXT_KEY;
}
