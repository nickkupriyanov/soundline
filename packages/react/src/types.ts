import type { ComponentPropsWithRef, ReactNode } from 'react';
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
 * Animation primitives the widget renders through.
 *
 * The markup stays the library's — the three primitives are the only thing a kit
 * replaces, so the widget's DOM, its accessibility contract and its classes are
 * the same whichever kit is in use. The default kit is pure CSS and ships in the
 * main entry point; `@nickkupriyanov/soundline-react/motion` swaps in
 * spring-based variants and is the only entry point that pulls `motion` in.
 *
 * A custom kit is expected to keep three promises:
 *
 * - render the same class hooks (`sn-step-host`/`sn-step`, `sn-stagger-item`,
 *   `sn-height`/`sn-height-inner`), so the stylesheet keeps working;
 * - keep `Item` the row element itself and forward its `ref` — the queue moves
 *   focus through it;
 * - honour reduced motion, unless it is the CSS kit, which the stylesheet's kill
 *   switch already covers.
 */
export interface AnimationKit {
  /**
   * Rendered once and kept mounted; animates its child on every `stepKey`
   * change. The children of two different steps may overlap — they share one box
   * — so the surrounding layout never jumps mid-transition.
   */
  StepHost: (props: StepHostProps) => ReactNode;
  /** The row element of a stagger group; the queue renders its rows through it. */
  Item: (props: ItemProps) => ReactNode;
  /**
   * Container that follows the height of the content it holds. Measuring is the
   * binding's half (the stylesheet reads the class hooks); the kit only decides
   * how the change is carried out.
   */
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

/**
 * The props of a staggered row: the prepared slot props of `TrackItem` plus the
 * row's position in the group. `ref` is part of the contract — it is how the
 * queue moves focus along the list.
 */
export interface ItemProps extends ComponentPropsWithRef<'li'> {
  /** Zero-based position inside the group; drives the delay. */
  index: number;
}

export interface HeightProps {
  className?: string;
  children: ReactNode;
}
