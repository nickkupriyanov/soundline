import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import type {
  EngineState,
  LoopMode,
  PlaybackEngine,
  PlaybackError,
  PlayerChangeMetadata,
  PlayerErrorContext,
  PlayerProgressMetadata,
  SnClassSlot,
  SoundlineLayout,
  SoundlineMessages,
  SoundlineTheme,
  Track,
  TrackSourceAdapter,
} from '@nickkupriyanov/soundline-core';
import type { SoundlineComponents } from './parts';

/**
 * React-facing types of the widget.
 *
 * The framework-free half — the domain model, the flow types, the copy and the
 * class names — lives in `@nickkupriyanov/soundline-core` and is re-exported here,
 * so modules in this package keep importing from `./types` exactly as before.
 */
export type * from '@nickkupriyanov/soundline-core';

/* -------------------------------------------------------------------------- */
/*  Component props                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Everything `<Player>` accepts.
 *
 * `adapter` is the one required prop: playback is wired through the injected
 * `engine`, or through the lazy `<audio>` engine core creates by default.
 *
 * A controlled value and its `default*` partner are mutually exclusive by
 * convention — passing the controlled one fixes that value's mode for the life
 * of the widget (see `docs/specification.md`, "Управляемые и неуправляемые
 * значения"). An update coming from the application never echoes back a change
 * event.
 */
export interface SoundlineProps<TData = unknown> {
  /** The track source. Required — the player cannot know a playlist on its own. */
  adapter: TrackSourceAdapter<TData>;
  /**
   * The playback backend. Default: a lazy `HTMLAudioElement` engine, created by
   * core. Pass a `createMockEngine()` to run without audio hardware.
   */
  engine?: PlaybackEngine;
  /**
   * Engine telemetry the server rendered from, so the first client snapshot
   * matches the markup until the real engine reports something.
   */
  initialEngineRef?: EngineState;

  /* -- Presentation ------------------------------------------------------- */

  /** `card` (default) or `compact`. */
  layout?: SoundlineLayout;
  /** `dark` (default) or `light`. */
  theme?: SoundlineTheme;
  /** Locale tag used for the copy and set as `lang`. Default: the browser's. */
  locale?: string;
  /** Per-string overrides merged on top of the locale defaults. */
  messages?: Partial<SoundlineMessages>;
  /** Seconds one keyboard seek step moves. */
  seekStep?: number;
  /** Volume one keyboard/step change moves, `0..1`. */
  volumeStep?: number;
  /** Whether the standard widget renders the queue. Default: `true`. */
  showQueue?: boolean;
  /** Pauses playback when the document becomes hidden. Default: `false`. */
  pauseWhenHidden?: boolean;
  /** Media Session integration; off unless asked for. Default: `false`. */
  mediaSession?: boolean | { skipSeconds?: number };

  /* -- Controlled and initial values -------------------------------------- */

  /** Controlled playback intent. */
  playing?: boolean;
  /** Uncontrolled initial playback intent. Default: `false`. */
  defaultPlaying?: boolean;
  onPlayingChange?: (playing: boolean, metadata: PlayerChangeMetadata) => void;

  /** Controlled volume, `0..1`. */
  volume?: number;
  /** Uncontrolled initial volume. Default: `1`. */
  defaultVolume?: number;
  onVolumeChange?: (volume: number, metadata: PlayerChangeMetadata) => void;

  /** Controlled mute state. */
  muted?: boolean;
  /** Uncontrolled initial mute state. Default: `false`. */
  defaultMuted?: boolean;
  onMutedChange?: (muted: boolean, metadata: PlayerChangeMetadata) => void;

  /** Controlled repeat mode. */
  loop?: LoopMode;
  /** Uncontrolled initial repeat mode. Default: `off`. */
  defaultLoop?: LoopMode;
  onLoopChange?: (loop: LoopMode, metadata: PlayerChangeMetadata) => void;

  /** Controlled shuffle flag. */
  shuffle?: boolean;
  /** Uncontrolled initial shuffle flag. Default: `false`. */
  defaultShuffle?: boolean;
  onShuffleChange?: (shuffle: boolean, metadata: PlayerChangeMetadata) => void;

  /** Controlled playback rate. */
  rate?: number;
  /** Uncontrolled initial playback rate. Default: `1`. */
  defaultRate?: number;
  onRateChange?: (rate: number, metadata: PlayerChangeMetadata) => void;

  /** Controlled selection: the track the application owns. `null` selects nothing. */
  currentTrackId?: string | null;
  /** Uncontrolled initial selection. Default: the first track of the queue. */
  defaultTrackId?: string | null;
  onTrackChange?: (trackId: string | null, metadata: PlayerChangeMetadata) => void;

  /** Controlled queue: the playlist the application owns. */
  queue?: readonly Track<TData>[];
  /** Uncontrolled initial queue. */
  defaultQueue?: readonly Track<TData>[];
  onQueueChange?: (queue: Track<TData>[], metadata: PlayerChangeMetadata) => void;

  /* -- Engine events ------------------------------------------------------ */

  /** Throttled playhead report; the final value always arrives on pause/seek. */
  onProgress?: (seconds: number, metadata: PlayerProgressMetadata) => void;
  /** The engine started playing. */
  onPlay?: () => void;
  /** The engine stopped playing (a pause, or a source that ended). */
  onPause?: () => void;
  /** The source reached its end, before the queue decides what to do next. */
  onEnded?: () => void;
  /** Any adapter or playback failure, with the phase it happened in. */
  onError?: (error: PlaybackError, context: PlayerErrorContext) => void;

  /* -- UI ----------------------------------------------------------------- */

  /** Extra class on the outermost element. */
  className?: string;
  /** Per-slot class overrides, added alongside the library's own classes. */
  classNames?: Partial<Record<SnClassSlot, string>>;
  /** Replace individual parts of the widget; anything absent keeps its default. */
  components?: SoundlineComponents;
  /** Replace the built-in animation kit (see `@nickkupriyanov/soundline-react/motion`). */
  animations?: AnimationKit;
  /** Move focus into the widget on mount. Default: `false`. */
  autoFocus?: boolean;
}

/** `SoundlineProps` plus the children the provider renders into its context. */
export type SoundlineProviderProps<TData = unknown> = SoundlineProps<TData> & {
  children: ReactNode;
};

/* -------------------------------------------------------------------------- */
/*  Animation kit                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Animation primitives the widget renders through. The default kit is pure CSS;
 * `@nickkupriyanov/soundline-react/motion` swaps in spring-based variants.
 */
export interface AnimationKit {
  /** Rendered once and kept mounted; animates its child on every `stepKey` change. */
  StepHost: (props: StepHostProps) => ReactNode;
  /** A `<button>` that joins a stagger group; used for the queue rows. */
  Item: (props: ItemProps) => ReactNode;
  /** Animated container used to follow its content height. */
  Height: (props: HeightProps) => ReactNode;
}

export interface StepHostProps {
  /** What the host is keyed on; a change replays the transition. */
  stepKey: string;
  /** `1` when moving forward, `-1` when moving back. */
  direction: 1 | -1;
  className?: string;
  children: ReactNode;
}

export interface ItemProps extends ComponentPropsWithoutRef<'button'> {
  /** Position inside the group; drives the delay. */
  index: number;
}

export interface HeightProps {
  className?: string;
  children: ReactNode;
}
