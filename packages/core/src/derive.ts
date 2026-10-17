/**
 * The derived view model.
 *
 * `derivePlayerView` is pure: it receives the player state, the resolved
 * configuration and — optionally — the engine's latest telemetry, and returns
 * everything a binding renders: labels, percentages, the queue rows, the
 * announcement and which actions are available.
 *
 * It never reads the clock, never touches the DOM and never calls an engine, so
 * the controller's snapshot cache and every binding work from one implementation
 * instead of formatting the same numbers three times.
 */
import type { PlayerConfig } from './config';
import { clamp, formatDuration } from './duration';
import { format } from './i18n';
import type { PlayerError, PlayerState } from './reducer';
import type {
  EngineState,
  EngineStatus,
  LoopMode,
  SoundlineLayout,
  SoundlineTheme,
  Track,
} from './types';

/* -------------------------------------------------------------------------- */
/*  View model                                                                 */
/* -------------------------------------------------------------------------- */

/** The current track, with the labels a binding shows and announces. */
export interface NowPlayingView {
  /** The track as it sits in the queue, including its custom `data`. */
  track: Track;
  trackId: string;
  title: string;
  artist: string | null;
  album: string | null;
  artwork: string | null;
  /** `artist — album`, or whichever of the two exists. */
  subtitle: string | null;
  /** Accessible/announcement label: `Now playing: {title}`. */
  label: string;
  duration: number;
  durationLabel: string;
}

/** The playhead, ready for a slider and a time readout. */
export interface ProgressView {
  position: number;
  duration: number;
  /** `0..100`. */
  percent: number;
  /** `0..100`, counting the buffered seconds ahead of the playhead. */
  bufferedPercent: number;
  positionLabel: string;
  durationLabel: string;
  /** `aria-valuetext`, e.g. `1:23 of 4:05`. */
  valueText: string;
}

/** The transport controls, their state labels and which are available. */
export interface TransportView {
  playing: boolean;
  /** The action the primary button performs right now. */
  action: 'play' | 'pause';
  playLabel: string;
  previousLabel: string;
  nextLabel: string;
  canPlay: boolean;
  canNext: boolean;
  canPrev: boolean;
  shuffle: { active: boolean; label: string };
  loop: { mode: LoopMode; label: string };
  rate: number;
  rateLabel: string;
  rateValue: string;
}

/** The volume control. */
export interface VolumeView {
  volume: number;
  muted: boolean;
  /** `0..100`. */
  percent: number;
  /** The accessible name of the mute button: `Mute` or `Unmute`. */
  label: string;
  /** `aria-valuetext`, e.g. `75%`. */
  valueText: string;
}

/** One row of the queue. */
export interface QueueItemView {
  track: Track;
  id: string;
  /** 1-based position in the playback order. */
  position: number;
  title: string;
  artist: string | null;
  album: string | null;
  artwork: string | null;
  duration: number | null;
  durationLabel: string | null;
  isActive: boolean;
  isPlaying: boolean;
  /** Accessible name: `{index}. {title}`. */
  label: string;
}

/** The playlist, as a list of rows in playback order. */
export interface QueueView {
  items: QueueItemView[];
  count: number;
  countLabel: string;
  label: string;
  activeId: string | null;
  /** Whether the configuration asks the standard widget to show the queue. */
  show: boolean;
}

/** Presentation settings the binding needs and may not read from the state. */
export interface PlayerSettingsView {
  locale: string;
  theme: SoundlineTheme;
  layout: SoundlineLayout;
  showQueue: boolean;
  seekStep: number;
  volumeStep: number;
  contextKey: string;
}

/** What the user may do right now. */
export interface PlayerActionsView {
  canSeek: boolean;
  canToggle: boolean;
  canRetry: boolean;
  canNext: boolean;
  canPrev: boolean;
}

export interface PlayerView {
  status: EngineStatus;
  /** The track list is being fetched, or the source is still loading. */
  loading: boolean;
  /** The track list loaded and is empty. */
  empty: boolean;
  /**
   * A failure that leaves nothing to play: the current source would not load, or
   * the track list itself could not be fetched. `actions.canRetry` says whether
   * anything can be done about it.
   */
  error: PlayerError | null;
  nowPlaying: NowPlayingView | null;
  progress: ProgressView;
  transport: TransportView;
  volumeView: VolumeView;
  queue: QueueView;
  settings: PlayerSettingsView;
  actions: PlayerActionsView;
  /**
   * The polite live-region announcement for the current state.
   *
   * One string per state — a failure, the end of the playlist, loading, an empty
   * list, or the track in its playing (`Now playing: …`) or paused
   * (`Paused: …`) wording. The binding renders it into a single `polite` region
   * and never queues announcements of its own.
   */
  live: { message: string };
}

/* -------------------------------------------------------------------------- */
/*  Derivation                                                                 */
/* -------------------------------------------------------------------------- */

const SUBTITLE_SEPARATOR = ' — ';

function subtitleOf(track: Track): string | null {
  const parts = [track.artist, track.album].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(SUBTITLE_SEPARATOR) : null;
}

function loopLabelOf(mode: LoopMode, config: PlayerConfig): string {
  if (mode === 'one') return config.messages.repeatOneLabel;
  if (mode === 'all') return config.messages.repeatAllLabel;
  return config.messages.repeatOffLabel;
}

/**
 * Builds the view.
 *
 * `engine` is the engine's latest telemetry snapshot. The controller passes it so
 * a progress tick renders without a reducer round-trip; a pure test passes
 * nothing and the telemetry mirrored into the state is used instead. Either way
 * every value in the result comes from the arguments — nothing is read from the
 * environment.
 */
export function derivePlayerView(
  state: PlayerState,
  config: PlayerConfig,
  engine?: EngineState | null,
): PlayerView {
  const { messages } = config;
  const telemetry: Pick<EngineState, 'status' | 'currentTime' | 'duration' | 'buffered'> =
    engine ?? {
      status: state.status,
      currentTime: state.currentTime,
      duration: state.duration,
      buffered: state.buffered,
    };

  const currentTime = telemetry.currentTime;
  const duration = telemetry.duration > 0 ? telemetry.duration : state.duration;
  const buffered = telemetry.buffered;
  const playing = state.playing;

  /* -- now playing --------------------------------------------------------- */

  const track = state.currentTrackId
    ? (state.queue.find((item) => item.id === state.currentTrackId) ?? null)
    : null;
  const nowPlaying: NowPlayingView | null = track
    ? {
        track,
        trackId: track.id,
        title: track.title,
        artist: track.artist ?? null,
        album: track.album ?? null,
        artwork: track.artwork ?? null,
        subtitle: subtitleOf(track),
        label: format(messages.currentTrackLabel, { title: track.title }),
        duration,
        durationLabel: formatDuration(duration),
      }
    : null;

  /* -- progress ------------------------------------------------------------ */

  const positionLabel = formatDuration(currentTime);
  const durationLabel = formatDuration(duration);
  const progress: ProgressView = {
    position: currentTime,
    duration,
    percent: duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0,
    bufferedPercent: duration > 0 ? clamp(((currentTime + buffered) / duration) * 100, 0, 100) : 0,
    positionLabel,
    durationLabel,
    valueText: format(messages.seekValue, { position: positionLabel, duration: durationLabel }),
  };

  /* -- transport ----------------------------------------------------------- */

  const hasTrack = track !== null && state.index >= 0;
  const count = state.queue.length;
  const canPlay = count > 0 && telemetry.status !== 'error';
  const canNext = canPlay && (state.index < count - 1 || state.loop === 'all');
  // `previous` always has something to do: it walks back, or restarts the first
  // track when there is nothing before it.
  const canPrev = canPlay;
  const transport: TransportView = {
    playing,
    action: playing ? 'pause' : 'play',
    playLabel: playing ? messages.pauseLabel : messages.playLabel,
    previousLabel: messages.previousLabel,
    nextLabel: messages.nextLabel,
    canPlay,
    canNext,
    canPrev,
    shuffle: { active: state.shuffle, label: messages.shuffleLabel },
    loop: { mode: state.loop, label: loopLabelOf(state.loop, config) },
    rate: state.rate,
    rateLabel: messages.rateLabel,
    rateValue: format(messages.rateValue, { rate: state.rate }),
  };

  /* -- volume -------------------------------------------------------------- */

  const volumePercent = Math.round(state.volume * 100);
  const volumeView: VolumeView = {
    volume: state.volume,
    muted: state.muted,
    percent: volumePercent,
    label: state.muted ? messages.unmuteLabel : messages.muteLabel,
    valueText: format(messages.volumeValue, { percent: volumePercent }),
  };

  /* -- queue --------------------------------------------------------------- */

  const items: QueueItemView[] = state.queue.map((item, position) => {
    const isActive = item.id === state.currentTrackId;
    return {
      track: item,
      id: item.id,
      position: position + 1,
      title: item.title,
      artist: item.artist ?? null,
      album: item.album ?? null,
      artwork: item.artwork ?? null,
      duration: typeof item.duration === 'number' ? item.duration : null,
      durationLabel: typeof item.duration === 'number' ? formatDuration(item.duration) : null,
      isActive,
      isPlaying: isActive && playing,
      label: format(messages.trackLabel, { index: position + 1, title: item.title }),
    };
  });
  const queue: QueueView = {
    items,
    count,
    countLabel: format(messages.queueCount, { count }),
    label: messages.queueLabel,
    activeId: state.currentTrackId,
    show: config.showQueue,
  };

  /* -- announcement -------------------------------------------------------- */

  // The region says one thing at a time, in order of how much it matters: a
  // failure, the end of the playlist, the list still arriving, an empty list,
  // and otherwise the track itself — named while it plays, named again in the
  // paused wording when it stops. The pause wording is what tells a visitor who
  // is not on the play button that playback stopped: the button only swaps its
  // accessible name, and a name change of an unfocused button is never spoken.
  // `paused` is the engine's word, so the very first, never-started track keeps
  // the plain "now playing" wording instead of announcing a pause nobody asked
  // for.
  const loading = state.queueStatus === 'loading' || state.queueStatus === 'idle';
  const empty = state.queueStatus === 'ready' && count === 0;
  // `view.error` below folds the two failures together; the announcement does the
  // same, so an unreachable list says what happened instead of announcing
  // "loading" for as long as the widget lives.
  const failed = state.error ?? state.queueError;
  const liveMessage = failed
    ? messages.genericError
    : telemetry.status === 'ended' && !playing
      ? messages.endedLabel
      : state.queueStatus !== 'ready'
        ? messages.loadingLabel
        : empty
          ? messages.emptyLabel
          : nowPlaying
            ? telemetry.status === 'paused'
              ? format(messages.pausedTrackLabel, { title: nowPlaying.title })
              : nowPlaying.label
            : '';

  return {
    status: telemetry.status,
    loading: loading || telemetry.status === 'loading',
    empty,
    // A track that failed to load and a track list that could not be fetched are
    // the same thing to a visitor: something went wrong and there is nothing to
    // play. Swallowing the list failure here is what used to leave the widget
    // showing an empty card while the live region kept saying "Loading tracks…".
    error: state.error ?? state.queueError,
    nowPlaying,
    progress,
    transport,
    volumeView,
    queue,
    settings: {
      locale: config.locale,
      theme: config.theme,
      layout: config.layout,
      showQueue: config.showQueue,
      seekStep: config.seekStep,
      volumeStep: config.volumeStep,
      contextKey: config.context.key,
    },
    actions: {
      canSeek: canPlay && duration > 0,
      canToggle: canPlay,
      canRetry: state.error !== null ? hasTrack : state.queueError !== null,
      canNext,
      canPrev,
    },
    live: { message: liveMessage },
  };
}

/* -------------------------------------------------------------------------- */
/*  Memoisation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A snapshot cache for `derivePlayerView`.
 *
 * The derivation stays pure; the controller owns the key — `revision |
 * engineRevision | configRevision` — and calls `get` for every snapshot. The same
 * key returns the very same object, which is what lets a binding compare by
 * reference, and a new key recomputes exactly once.
 */
export interface PlayerViewMemo {
  get(
    key: string,
    state: PlayerState,
    config: PlayerConfig,
    engine?: EngineState | null,
  ): PlayerView;
}

/** Creates a fresh memo. One per controller. */
export function createPlayerViewMemo(): PlayerViewMemo {
  let cachedKey: string | null = null;
  let cached: PlayerView | null = null;
  return {
    get(key, state, config, engine) {
      if (cached !== null && key === cachedKey) return cached;
      cachedKey = key;
      cached = derivePlayerView(state, config, engine);
      return cached;
    },
  };
}
