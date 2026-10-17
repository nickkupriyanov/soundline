/**
 * Stable class names.
 *
 * `SN_CLASS` is the single source of truth for the base class of every slot: the
 * stylesheet and the bindings read it, so a class the consumer sees in the DOM
 * never depends on markup nesting. Consumer classes are added *alongside* these
 * — via `classNames` — never instead of them.
 *
 * `cx` is re-exported here so that the public entry point exposes the whole
 * class-name story in one place; its implementation lives next to the other
 * tiny helpers in `./utils/cx`.
 */
import type { SnClassSlot } from './types';

export type { ClassValue } from './utils/cx';
export { cx } from './utils/cx';

/** Base class for every customisable slot. BEM-ish, but flat and non-invasive. */
export const SN_CLASS: Record<SnClassSlot, string> = {
  root: 'sn-root',
  card: 'sn-card',
  header: 'sn-header',
  nowPlaying: 'sn-now-playing',
  artwork: 'sn-artwork',
  artworkFallback: 'sn-artwork-fallback',
  trackInfo: 'sn-track-info',
  title: 'sn-title',
  artist: 'sn-artist',
  album: 'sn-album',
  transport: 'sn-transport',
  playButton: 'sn-play-button',
  previousButton: 'sn-previous-button',
  nextButton: 'sn-next-button',
  shuffleButton: 'sn-shuffle-button',
  repeatButton: 'sn-repeat-button',
  seek: 'sn-seek',
  seekTrack: 'sn-seek-track',
  seekBuffered: 'sn-seek-buffered',
  seekFill: 'sn-seek-fill',
  seekThumb: 'sn-seek-thumb',
  timeDisplay: 'sn-time-display',
  currentTime: 'sn-current-time',
  totalTime: 'sn-total-time',
  volume: 'sn-volume',
  volumeButton: 'sn-volume-button',
  volumeSlider: 'sn-volume-slider',
  volumeThumb: 'sn-volume-thumb',
  queue: 'sn-queue',
  queueHeader: 'sn-queue-header',
  queueCount: 'sn-queue-count',
  queueList: 'sn-queue-list',
  trackItem: 'sn-track-item',
  trackItemActive: 'sn-track-item-active',
  trackItemPlaying: 'sn-track-item-playing',
  trackLine: 'sn-track-line',
  eq: 'sn-eq',
  trackTitle: 'sn-track-title',
  trackArtist: 'sn-track-artist',
  trackRemove: 'sn-track-remove',
  loading: 'sn-loading',
  empty: 'sn-empty',
  error: 'sn-error',
  live: 'sn-live',
};
