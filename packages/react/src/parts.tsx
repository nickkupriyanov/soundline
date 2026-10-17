import type { ComponentPropsWithoutRef, ComponentPropsWithRef, ReactNode } from 'react';
import type {
  LoopMode,
  NowPlayingView,
  ProgressView,
  QueueItemView,
  QueueView,
  TransportView,
  VolumeView,
} from '@nickkupriyanov/soundline-core';
import { Artwork as DefaultArtwork } from './components/Artwork';
import {
  EmptyBlock as DefaultEmpty,
  ErrorBlock as DefaultError,
  LoadingBlock as DefaultLoading,
} from './components/blocks';
import { Header as DefaultHeader } from './components/Header';
import { NowPlaying as DefaultNowPlaying } from './components/NowPlaying';
import { Queue as DefaultQueue } from './components/Queue';
import { SeekBar as DefaultSeekBar } from './components/SeekBar';
import { TrackItem as DefaultTrackItem } from './components/TrackItem';
import { Transport as DefaultTransport } from './components/Transport';
import { VolumeControl as DefaultVolume } from './components/VolumeControl';

/**
 * The extension points of the widget.
 *
 * Every part receives the data it renders and the actions it triggers — nothing
 * else. The library keeps the behaviour that must not be re-implemented (focus,
 * keyboard navigation, the playhead maths, the flow itself) and hands a part
 * only values it cannot get wrong: a part that owns an element gets a prepared
 * props bundle to spread on it, and a part that sits inside a shell the library
 * owns gets the shell's content as `children`.
 *
 * A replacement is per part and independent of `classNames`: the prepared props
 * already carry the slot class with the consumer's override merged in, so a
 * replaced part keeps both its look and its accessible name.
 *
 * ```tsx
 * import { Player, DefaultTransport, type TransportPartProps } from '@nickkupriyanov/soundline-react';
 *
 * // Wrap the default rather than rewriting it.
 * function LoudTransport(props: TransportPartProps) {
 *   return (
 *     <div className="loud">
 *       <DefaultTransport {...props} />
 *     </div>
 *   );
 * }
 *
 * <Player adapter={adapter} components={{ Transport: LoudTransport }} />;
 * ```
 */

/**
 * Props for an element whose behaviour and accessibility the library prepared.
 *
 * Spread them on your own element: they carry the handler wiring, the role, the
 * `aria-*` contract, the tab order and the slot class. The `data-*` allowance
 * keeps the library's DOM hooks (such as `data-sn-dragging`) on the element even
 * when the part that renders it was replaced.
 */
export type SlotProps<Props> = Props & { [key: `data-${string}`]: string | undefined };

/** A part is a component, or a function returning nodes — whatever fits the call site. */
export type PartComponent<Props> = (props: Props) => ReactNode;

/* -------------------------------------------------------------------------- */
/*  Header                                                                     */
/* -------------------------------------------------------------------------- */

/** The header row of the queue. */
export interface HeaderPartProps {
  /** The queue's accessible/visible name, already localised. */
  label: string;
  /** `2 tracks`, already localised. */
  countLabel: string;
  /** Spread on your own element: the `sn-header` slot class lives here. */
  slotProps: SlotProps<ComponentPropsWithoutRef<'div'>>;
}

/* -------------------------------------------------------------------------- */
/*  Now playing                                                                */
/* -------------------------------------------------------------------------- */

/** The artwork of the current track. */
export interface ArtworkPartProps {
  /** The current track, with its labels and its artwork URL. */
  nowPlaying: NowPlayingView;
  /**
   * Spread on your own element: the `sn-artwork` box class and its sizing live
   * here. The part is remounted on every track change, so a replacement may keep
   * "the image failed" in its own state.
   */
  slotProps: SlotProps<ComponentPropsWithoutRef<'div'>>;
}

/** The current track: the artwork and the labels beside it. */
export interface NowPlayingPartProps {
  /** The current track, ready to render. */
  nowPlaying: NowPlayingView;
  /** Spread on your own element: the `sn-now-playing` slot class lives here. */
  slotProps: SlotProps<ComponentPropsWithoutRef<'div'>>;
  /**
   * The artwork, already rendered through the `Artwork` part. Place it wherever
   * your layout wants it; drop it and the artwork disappears with it.
   */
  children: ReactNode;
}

/* -------------------------------------------------------------------------- */
/*  Transport                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The transport row.
 *
 * A replacement owns its buttons and must therefore honour the accessibility
 * contract the default keeps: an accessible name per button, `aria-pressed` on
 * the two toggles (but *not* on play/pause, whose name already changes), and
 * `disabled` mirrored from the `can*` flags. The repeat button walks the cycle
 * `off → all → one` — use `nextLoopMode` from this package rather than
 * re-deriving it.
 */
export interface TransportPartProps {
  /** The controls, their labels and which of them are available. */
  transport: TransportView;
  /** Spread on your own row element: the `sn-transport` slot class lives here. */
  slotProps: SlotProps<ComponentPropsWithoutRef<'div'>>;
  /** Starts or stops playback, following `transport.action`. */
  onToggle(): void;
  onNext(): void;
  onPrevious(): void;
  onShuffle(shuffle: boolean): void;
  onLoop(loop: LoopMode): void;
}

/* -------------------------------------------------------------------------- */
/*  Seek and volume                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The playhead.
 *
 * The drag, the keyboard and the `slider` contract are the library's: they
 * arrive in `slotProps`, so a replacement only draws the track, the fill and the
 * thumb. While a drag is in flight `percent` follows the pointer; the playhead
 * itself only moves on release.
 */
export interface SeekBarPartProps {
  /** The playhead as the flow derived it, with both labels formatted. */
  progress: ProgressView;
  /** `0..100` of the position on screen — follows a drag. */
  percent: number;
  /** Spread on your own element: role, `aria-*`, tab order, pointer and key handling. */
  slotProps: SlotProps<ComponentPropsWithoutRef<'div'>>;
}

/**
 * The volume control.
 *
 * As with the playhead, the drag and the keyboard come prepared; moving either
 * the slider or the button is the only thing a replacement decides. The level
 * and the mute flag are two separate values, so muting never loses the level, and
 * touching the slider lifts the mute.
 */
export interface VolumePartProps {
  /** The volume as the flow derived it: level, mute flag and labels. */
  view: VolumeView;
  /** `0..100` of the level on screen — follows a drag. */
  percent: number;
  /** Spread on your own container: the `sn-volume` slot class lives here. */
  slotProps: SlotProps<ComponentPropsWithoutRef<'div'>>;
  /**
   * Spread on your own mute button. Carries the `aria-pressed` state and the
   * `Mute`/`Unmute` name, so the button cannot get out of step with the flow.
   */
  buttonProps: SlotProps<ComponentPropsWithoutRef<'button'>>;
  /** Spread on your own slider element. */
  sliderProps: SlotProps<ComponentPropsWithoutRef<'div'>>;
}

/* -------------------------------------------------------------------------- */
/*  Queue                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One row of the queue.
 *
 * The roving tab index, the selection, the removal and the arrow keys are the
 * library's and arrive in `slotProps`/`removeProps`; the content of the row is
 * yours. The prepared props are what keeps a replacement a real listbox option.
 */
export interface TrackItemPartProps {
  /** The row as the flow derived it: labels, position and state flags. */
  item: QueueItemView;
  /**
   * Spread on your own row element (an `<li role="option">`): the tab order, the
   * `aria-selected`, the slot classes and the key handling. The library uses the
   * same bundle's `ref` to move focus along the list.
   */
  slotProps: SlotProps<ComponentPropsWithRef<'li'>>;
  /** Spread on your own remove button: the label, the class and the click that must not select. */
  removeProps: SlotProps<ComponentPropsWithoutRef<'button'>>;
}

/**
 * The queue panel.
 *
 * The listbox itself, its rows and their keyboard navigation belong to the
 * library and arrive as `children`; this part is the frame around them. Place
 * `header` and `children` as your layout wants — dropping either one is a valid
 * (if drastic) choice.
 */
export interface QueuePartProps {
  /** The playlist as the flow derived it: every row, in playback order. */
  queue: QueueView;
  /** Spread on your own panel: the `sn-queue` slot class lives here. */
  slotProps: SlotProps<ComponentPropsWithoutRef<'div'>>;
  /** The header row, already rendered through the `Header` part. */
  header: ReactNode;
  /** The listbox, already rendered with one row per track. */
  children: ReactNode;
}

/* -------------------------------------------------------------------------- */
/*  States                                                                     */
/* -------------------------------------------------------------------------- */

/** The track list is being fetched. */
export interface LoadingPartProps {
  /** The accessible/visible text, already localised. */
  label: string;
}

/** The track list loaded and is empty. */
export interface EmptyPartProps {
  /** The accessible/visible text, already localised. */
  label: string;
}

/** A load failed. */
export interface ErrorPartProps {
  /** Title of the error state. */
  title: string;
  /** The human description, already localised. */
  message: string;
  /** Label of the retry button. */
  retryLabel: string;
  /** Present when retrying is meaningful. */
  onRetry?: (() => void) | undefined;
}

/* -------------------------------------------------------------------------- */
/*  The map                                                                    */
/* -------------------------------------------------------------------------- */

/** Every part an application may replace; anything absent keeps its default. */
export interface SoundlineComponents {
  Header?: PartComponent<HeaderPartProps>;
  Artwork?: PartComponent<ArtworkPartProps>;
  NowPlaying?: PartComponent<NowPlayingPartProps>;
  Transport?: PartComponent<TransportPartProps>;
  SeekBar?: PartComponent<SeekBarPartProps>;
  Volume?: PartComponent<VolumePartProps>;
  Queue?: PartComponent<QueuePartProps>;
  TrackItem?: PartComponent<TrackItemPartProps>;
  Loading?: PartComponent<LoadingPartProps>;
  Empty?: PartComponent<EmptyPartProps>;
  Error?: PartComponent<ErrorPartProps>;
}

/* Every default, so an application can wrap rather than re-implement. */

export {
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
};

/** What the widget renders when the application replaces nothing. */
export const DEFAULT_COMPONENTS: Required<SoundlineComponents> = {
  Header: DefaultHeader,
  Artwork: DefaultArtwork,
  NowPlaying: DefaultNowPlaying,
  Transport: DefaultTransport,
  SeekBar: DefaultSeekBar,
  Volume: DefaultVolume,
  Queue: DefaultQueue,
  TrackItem: DefaultTrackItem,
  Loading: DefaultLoading,
  Empty: DefaultEmpty,
  Error: DefaultError,
};
