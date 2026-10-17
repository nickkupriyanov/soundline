/**
 * The player configuration.
 *
 * Everything the reducer, the derivation and every binding need to know about the
 * application is resolved once, so they all work from identical values.
 *
 * `locale`, `theme` and `layout` fall back to deterministic constants rather than
 * to the browser: a binding applies the visitor's preferences *after* mounting,
 * which is what keeps server rendering and hydration identical. An application
 * that passes them explicitly gets the same answer on both sides with no extra
 * work.
 */
import { DEFAULT_PLAYLIST_CONTEXT } from './context';
import { resolveMessages } from './i18n';
import type {
  LoopMode,
  PlaylistContext,
  SoundlineLayout,
  SoundlineMessages,
  SoundlineTheme,
} from './types';

/* -------------------------------------------------------------------------- */
/*  Defaults                                                                   */
/* -------------------------------------------------------------------------- */

/** Deterministic locale, replaced by a binding once it runs on the client. */
export const FALLBACK_LOCALE = 'en';
/** Colours are dark by default. */
export const FALLBACK_THEME: SoundlineTheme = 'dark';
/** The full card is the default silhouette. */
export const FALLBACK_LAYOUT: SoundlineLayout = 'card';

/** Seconds one keyboard seek step moves the playhead. */
export const DEFAULT_SEEK_STEP = 5;
/** Volume one keyboard step moves, in the `0..1` range. */
export const DEFAULT_VOLUME_STEP = 0.05;
/** Source speed, `1` being unmodified. */
export const DEFAULT_RATE = 1;
/** Slowest accepted playback rate. */
export const MIN_RATE = 0.25;
/** Fastest accepted playback rate. */
export const MAX_RATE = 4;
/** Seconds a Media Session skip handler moves the playhead. */
export const DEFAULT_SKIP_SECONDS = 10;

/** The repeat modes in the order the transport cycles them. */
export const LOOP_MODES: readonly LoopMode[] = ['off', 'all', 'one'];

const THEMES = new Set<string>(['dark', 'light']);
const LAYOUTS = new Set<string>(['card', 'compact']);

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The Media Session integration, always resolved to a decision plus a step.
 *
 * `mediaSession: true` turns it on with the default skip distance; an object
 * turns it on and overrides the distance; anything else leaves it off.
 */
export interface MediaSessionConfig {
  enabled: boolean;
  /** Seconds the `seekbackward`/`seekforward` handlers move the playhead. */
  skipSeconds: number;
}

/** What an application may pass in; every field is optional. */
export interface PlayerConfigInput {
  locale?: string;
  messages?: Partial<SoundlineMessages>;
  theme?: SoundlineTheme;
  layout?: SoundlineLayout;
  /** Seconds one keyboard seek step moves. Default: {@link DEFAULT_SEEK_STEP}. */
  seekStep?: number;
  /** Volume one keyboard/step change moves, `0..1`. Default: {@link DEFAULT_VOLUME_STEP}. */
  volumeStep?: number;
  /** Whether the standard widget renders the queue. Default: `true`. */
  showQueue?: boolean;
  /** Pauses playback when the document becomes hidden. Default: `false`. */
  pauseWhenHidden?: boolean;
  /** Media Session integration; off unless asked for. Default: `false`. */
  mediaSession?: boolean | { skipSeconds?: number };
  /** The playlist the player works against. Default: the implicit single playlist. */
  context?: PlaylistContext;
}

/** The resolved configuration: every field is present and validated. */
export interface PlayerConfig {
  locale: string;
  messages: SoundlineMessages;
  theme: SoundlineTheme;
  layout: SoundlineLayout;
  seekStep: number;
  volumeStep: number;
  showQueue: boolean;
  pauseWhenHidden: boolean;
  mediaSession: MediaSessionConfig;
  context: PlaylistContext;
}

/* -------------------------------------------------------------------------- */
/*  Resolution                                                                 */
/* -------------------------------------------------------------------------- */

/** A positive, finite number, or the fallback. */
function positiveOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Narrows an unknown value to a shipped theme. */
export function isSoundlineTheme(value: unknown): value is SoundlineTheme {
  return typeof value === 'string' && THEMES.has(value);
}

/** Narrows an unknown value to a shipped layout. */
export function isSoundlineLayout(value: unknown): value is SoundlineLayout {
  return typeof value === 'string' && LAYOUTS.has(value);
}

/** Resolves the three accepted shapes of `mediaSession` to one decision. */
export function resolveMediaSession(input: PlayerConfigInput['mediaSession']): MediaSessionConfig {
  if (input === true) return { enabled: true, skipSeconds: DEFAULT_SKIP_SECONDS };
  if (input && typeof input === 'object') {
    return { enabled: true, skipSeconds: positiveOr(input.skipSeconds, DEFAULT_SKIP_SECONDS) };
  }
  return { enabled: false, skipSeconds: DEFAULT_SKIP_SECONDS };
}

/**
 * Resolves an input into the configuration the rest of the core reads.
 *
 * Every fallback is a constant, never a browser lookup, so the same input always
 * resolves to the same output — the property SSR and hydration rely on.
 */
export function resolvePlayerConfig(input: PlayerConfigInput = {}): PlayerConfig {
  return {
    locale: input.locale ? input.locale : FALLBACK_LOCALE,
    messages: resolveMessages(input.locale, input.messages),
    theme: isSoundlineTheme(input.theme) ? input.theme : FALLBACK_THEME,
    layout: isSoundlineLayout(input.layout) ? input.layout : FALLBACK_LAYOUT,
    seekStep: positiveOr(input.seekStep, DEFAULT_SEEK_STEP),
    volumeStep: positiveOr(input.volumeStep, DEFAULT_VOLUME_STEP),
    showQueue: input.showQueue ?? true,
    pauseWhenHidden: input.pauseWhenHidden ?? false,
    mediaSession: resolveMediaSession(input.mediaSession),
    context: input.context ?? DEFAULT_PLAYLIST_CONTEXT,
  };
}
