/**
 * The public surface shared by `@nickkupriyanov/soundline-react` and
 * `@nickkupriyanov/soundline-react/motion`. Each entry point adds its own
 * `Player` component bound to an animation kit.
 *
 * The framework-free modules are re-exported straight from
 * `@nickkupriyanov/soundline-core`: the controller, the derived view model, the
 * reducer and the domain contract all live there, so a second binding renders the
 * same behaviour.
 */

/* -- The widget ------------------------------------------------------------- */

export { PlayerView } from './components/PlayerView';
export { PlayerProvider, createPlayer } from './Player';
export { usePlayerController, usePlayerFlow, usePlayerUI } from './usePlayerFlow';
export { useAnimations, useClassNames, useComponents, usePlayerContext, useUI } from './context';
export type { SoundlineUIContextValue, UsePlayerFlowResult } from './context';
export { cssAnimations } from './animations/css';

/* -- Replaceable parts ------------------------------------------------------ */

export {
  DEFAULT_COMPONENTS,
  DefaultArtwork,
  DefaultEmpty,
  DefaultError,
  DefaultHeader,
  DefaultLoading,
  DefaultNowPlaying,
  DefaultQueue,
  DefaultSeekBar,
  DefaultTrackItem,
  DefaultTransport,
  DefaultVolume,
} from './parts';
export type {
  ArtworkPartProps,
  EmptyPartProps,
  ErrorPartProps,
  HeaderPartProps,
  LoadingPartProps,
  NowPlayingPartProps,
  PartComponent,
  QueuePartProps,
  SeekBarPartProps,
  SlotProps,
  SoundlineComponents,
  TrackItemPartProps,
  TransportPartProps,
  VolumePartProps,
} from './parts';
export { nextLoopMode } from './components/Transport';

/* -- Domain, copy and helpers from core ------------------------------------- */

export {
  DEFAULT_PROGRESS_INTERVAL,
  DEFAULT_RATE,
  DEFAULT_SEEK_STEP,
  DEFAULT_SKIP_SECONDS,
  DEFAULT_VOLUME_STEP,
  FALLBACK_LAYOUT,
  FALLBACK_LOCALE,
  FALLBACK_THEME,
  LOOP_MODES,
  MAX_RATE,
  MIN_RATE,
  SN_CLASS,
  PlaybackError,
  createMockAdapter,
  createMockEngine,
  createPlayerController,
  createStaticAdapter,
  cx,
  defaultMessages,
  format,
  isPlaybackError,
  resolveMessages,
  toPlaybackError,
} from '@nickkupriyanov/soundline-core';

/* -- React-facing and domain types ------------------------------------------ */

export type * from './types';
