/**
 * The public domain model of Soundline.
 *
 * Everything a binding needs to render — tracks, the playlist context, the
 * engine telemetry, the control vocabulary, error codes and copy — is declared
 * here and nowhere else. The module is pure types: no runtime code, no React and
 * no DOM, so importing it can never touch `window`.
 *
 * The engine and track source *interfaces* arrive with Iteration 3, where they
 * are implemented; this file already carries the data they exchange.
 */

/* -------------------------------------------------------------------------- */
/*  Domain model                                                              */
/* -------------------------------------------------------------------------- */

/**
 * A playable track.
 *
 * `id` is the identity of the track inside its context: selection, the queue and
 * element keys all use it, and it must not change when display data does.
 * Display data that the widget does not know about (price, cover colour, a
 * backend record) belongs in `data`, never in the identity.
 *
 * `src` is optional on purpose: an adapter that does not put URLs in its track
 * list resolves them lazily through `TrackSourceAdapter.resolveSource`.
 */
export interface Track<TData = unknown> {
  /** Stable track id. Unique within a playlist context. */
  id: string;
  /** Human title, shown in the player and in the queue. */
  title: string;
  /** Performer, shown under the title when present. */
  artist?: string;
  /** Collection the track belongs to, shown when present. */
  album?: string;
  /** Cover image URL. A missing or broken image falls back to a placeholder. */
  artwork?: string;
  /** Playable source URL. Omitted when the adapter resolves sources lazily. */
  src?: string;
  /** Source duration in seconds, when the adapter already knows it. */
  duration?: number;
  /** Typed display data: anything the built-in widget ignores. */
  data?: TData;
}

/**
 * The playlist a player works against.
 *
 * `key` identifies it: changing the key means a different playlist, so in-flight
 * loads are aborted and the queue and the selection are cleared. `data` carries
 * typed context data (a playlist id, filters, an auth scope) that the adapter
 * receives with every query.
 */
export interface PlaylistContext<TData = unknown> {
  key: string;
  data?: TData;
}

/**
 * The atomic selection of the player: exactly one track, or none.
 *
 * `null` means "nothing selected" — an empty player, not an empty queue.
 */
export interface PlayerSelection {
  trackId: string | null;
}

/* -------------------------------------------------------------------------- */
/*  Engine                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lifecycle of a playback engine.
 *
 * `idle` — nothing loaded; `loading` — the source is being fetched; `ready` — a
 * source is loaded but not started; `playing`/`paused` — a started source;
 * `ended` — playback reached the end of the source; `error` — the engine could
 * not play the source (the reason is in `EngineState.error`).
 */
export type EngineStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';

/**
 * A snapshot of engine telemetry.
 *
 * This is raw, unformatted playback state — the derived view (`PlayerView`)
 * turns it into labels and percentages. `currentTime`, `duration` and `buffered`
 * are seconds; `buffered` is how much audio is available ahead of
 * `currentTime`; `error` is a code, never a thrown value, so the snapshot stays
 * serialisable.
 */
export interface EngineState {
  status: EngineStatus;
  /** The currently loaded source, or `null` when nothing is loaded. */
  src: string | null;
  /** Playhead position in seconds. */
  currentTime: number;
  /** Total duration in seconds; `0` until the engine knows it. */
  duration: number;
  /** Seconds buffered ahead of `currentTime`. */
  buffered: number;
  /** Volume in the `0..1` range. */
  volume: number;
  muted: boolean;
  /** Playback rate, `1` being the source speed. */
  rate: number;
  /** Why the engine failed, when `status` is `error`. */
  error: PlaybackErrorCode | null;
}

/* -------------------------------------------------------------------------- */
/*  Controls and presentation                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Repeat mode. `all` wraps around the queue, `one` repeats the current track and
 * `off` stops at the end. The transport cycles `off → all → one → off`.
 */
export type LoopMode = 'off' | 'all' | 'one';

/** Colour theme. Both are plain custom properties; `dark` is the default. */
export type SoundlineTheme = 'dark' | 'light';

/**
 * How much of the widget is rendered. `card` is the full card with artwork and
 * queue; `compact` is the narrow panel without the queue.
 */
export type SoundlineLayout = 'card' | 'compact';

/** Locales whose copy ships in the box. Any other tag falls back to `en`. */
export type SoundlineLocale = 'en' | 'ru';

/* -------------------------------------------------------------------------- */
/*  Errors                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every way playback can fail, in the order of the specification table.
 *
 * `ADAPTER_CONTRACT_VIOLATION` means the application's adapter returned
 * something the library cannot use; `UNKNOWN` is the fallback for anything the
 * library did not classify itself.
 */
export type PlaybackErrorCode =
  | 'TRACK_NOT_FOUND'
  | 'SOURCE_UNAVAILABLE'
  | 'NOT_SUPPORTED'
  | 'DECODE_FAILED'
  | 'NETWORK_FAILURE'
  | 'ADAPTER_CONTRACT_VIOLATION'
  | 'UNKNOWN';

/**
 * Stage of the flow that failed. `tracks` is the track list load, `source` is
 * resolving a track's URL, `playback` is the engine itself.
 */
export type PlaybackErrorPhase = 'tracks' | 'source' | 'playback';

/* -------------------------------------------------------------------------- */
/*  Copy                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Every user-facing string of the widget.
 *
 * A dictionary holds plain text with `{placeholder}` markers and no markup, and
 * the binding renders the result as text, so a dictionary can never inject HTML.
 * A new string is added to the interface, the `en` and the `ru` dictionaries in
 * the same change. Labels used as accessible names say so in the key.
 */
export interface SoundlineMessages {
  /** Accessible name of the player region. */
  playerLabel: string;
  playLabel: string;
  pauseLabel: string;
  previousLabel: string;
  nextLabel: string;
  /** Accessible name of the seek slider. */
  seekLabel: string;
  /** `aria-valuetext` of the seek slider, e.g. `{position} of {duration}`. */
  seekValue: string;
  /** Accessible name of the volume slider. */
  volumeLabel: string;
  /** `aria-valuetext` of the volume slider, `{percent}%`. */
  volumeValue: string;
  muteLabel: string;
  unmuteLabel: string;
  shuffleLabel: string;
  repeatOffLabel: string;
  repeatAllLabel: string;
  repeatOneLabel: string;
  /** Accessible name of the playback-rate control. */
  rateLabel: string;
  /** Playback rate as text, `{rate}×`. */
  rateValue: string;
  /** Accessible name of the playlist: the list, and the queue's own header. */
  queueLabel: string;
  /** Number of tracks, `{count} tracks`. */
  queueCount: string;
  /** Accessible name of a queue option, `{index}. {title}`. */
  trackLabel: string;
  /** Accessible name of the remove button, `Remove {title}`. */
  removeTrackLabel: string;
  /** Announcement of the current track, `Now playing: {title}`. */
  currentTrackLabel: string;
  /**
   * Announcement once playback is paused, `Paused: {title}`.
   *
   * The live region says this instead of `currentTrackLabel`, so a screen reader
   * hears *and* names the play/pause change: the button only swaps its name,
   * which a visitor with the focus elsewhere would not hear.
   */
  pausedTrackLabel: string;
  /** Announced while the track list loads. */
  loadingLabel: string;
  /** Announced when the queue is empty. */
  emptyLabel: string;
  /** Title of the error state. */
  errorLabel: string;
  /** Fallback description of a failed load. */
  genericError: string;
  retryLabel: string;
  /** Announced when the queue finished playing. */
  endedLabel: string;
  /** Shown when the browser cannot play the track's format. */
  unsupportedLabel: string;
}

/* -------------------------------------------------------------------------- */
/*  Stable class names                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Every customisable class slot of the widget.
 *
 * A slot is an extension point, not a DOM structure: `classNames` maps a slot to
 * a class the consumer adds, and `SN_CLASS` maps it to the stable base class the
 * stylesheet uses. The set grows with the components that consume it.
 */
export type SnClassSlot =
  | 'root'
  | 'card'
  | 'header'
  | 'nowPlaying'
  | 'artwork'
  | 'artworkFallback'
  | 'trackInfo'
  | 'title'
  | 'artist'
  | 'album'
  | 'transport'
  | 'playButton'
  | 'previousButton'
  | 'nextButton'
  | 'shuffleButton'
  | 'repeatButton'
  | 'seek'
  | 'seekTrack'
  | 'seekBuffered'
  | 'seekFill'
  | 'seekThumb'
  | 'timeDisplay'
  | 'currentTime'
  | 'totalTime'
  | 'volume'
  | 'volumeButton'
  | 'volumeSlider'
  | 'volumeThumb'
  | 'queue'
  | 'queueHeader'
  | 'queueCount'
  | 'queueList'
  | 'trackItem'
  | 'trackSelect'
  | 'trackItemActive'
  | 'trackItemPlaying'
  | 'trackLine'
  | 'eq'
  | 'trackTitle'
  | 'trackArtist'
  | 'trackRemove'
  | 'loading'
  | 'empty'
  | 'error'
  | 'live';
