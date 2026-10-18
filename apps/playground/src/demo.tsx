import { useEffect, useMemo } from 'react';
import {
  PlayerProvider,
  PlayerView,
  createMockEngine,
  usePlayerContext,
  type SoundlineProps,
  type Track,
} from '@nickkupriyanov/soundline-react';

/**
 * Demo data and a driver shared by the playground and its state gallery.
 *
 * Playback runs on a mock engine, so nothing is downloaded and the playhead walks
 * a virtual timeline. The driver only calls the public actions — `play`, `pause`
 * and `seek` — so every screen shows the real widget for a real input, never a
 * drawing of one.
 */

/** Duration every demo track plays for, in seconds. */
export const DEMO_DURATION = 214;

/** Six tracks with artwork, enough to show a queue that scrolls a little. */
export const demoTracks: Track[] = [
  {
    id: 'neon-highway',
    title: 'Neon Highway',
    artist: 'The Night Owls',
    album: 'Afterglow',
    duration: DEMO_DURATION,
    src: 'https://cdn.soundline.test/neon-highway.mp3',
    artwork: 'https://picsum.photos/seed/soundline-neon/640/640',
  },
  {
    id: 'paper-lanterns',
    title: 'Paper Lanterns',
    artist: 'Mira Voss',
    album: 'Slow Light',
    duration: 187,
    src: 'https://cdn.soundline.test/paper-lanterns.mp3',
    artwork: 'https://picsum.photos/seed/soundline-paper/640/640',
  },
  {
    id: 'glass-tide',
    title: 'Glass Tide',
    artist: 'Harbour Signal',
    album: 'Low Water',
    duration: 243,
    src: 'https://cdn.soundline.test/glass-tide.mp3',
    artwork: 'https://picsum.photos/seed/soundline-glass/640/640',
  },
  {
    id: 'static-bloom',
    title: 'Static Bloom',
    artist: 'The Night Owls',
    album: 'Afterglow',
    duration: 168,
    src: 'https://cdn.soundline.test/static-bloom.mp3',
    artwork: 'https://picsum.photos/seed/soundline-static/640/640',
  },
  {
    id: 'rust-and-rain',
    title: 'Rust and Rain',
    artist: 'Cinder Line',
    album: 'Weathering',
    duration: 205,
    src: 'https://cdn.soundline.test/rust-and-rain.mp3',
    artwork: 'https://picsum.photos/seed/soundline-rust/640/640',
  },
  {
    id: 'last-transmission',
    title: 'Last Transmission',
    artist: 'Harbour Signal',
    album: 'Low Water',
    duration: 259,
    src: 'https://cdn.soundline.test/last-transmission.mp3',
    artwork: 'https://picsum.photos/seed/soundline-signal/640/640',
  },
];

/** A playback state the demo driver can reach. */
export type DemoPlayback = 'idle' | 'playing' | 'paused' | 'ended';

/**
 * The demo playlist with the first track's `src` left out, so resolving it is the
 * adapter's job — which is how the "source refused" state is reached.
 */
export const demoTracksUnresolved: Track[] = demoTracks.map((track, index) =>
  index === 0 ? { ...track, src: undefined } : track,
);

/** The id of the last track — where the queue ends. */
export const LAST_TRACK_ID = demoTracks[demoTracks.length - 1]?.id ?? '';

/**
 * Moves the player into `target` once the queue is ready, using nothing but the
 * public actions. `idle` needs no driver — it is the state the widget starts in.
 *
 * `ended` plays the *last* track to its end: with repeat off that is the only way
 * to reach the end of the playlist, because ending any other track simply moves
 * on to the next one.
 */
export function PlaybackDriver({
  target,
  lastTrackId,
}: {
  target: DemoPlayback;
  lastTrackId?: string;
}) {
  const { snapshot, actions } = usePlayerContext();
  const view = snapshot.view;
  const activeId = view.queue.activeId;
  const ready = !view.loading && !view.empty && !view.error && view.nowPlaying !== null;
  const duration = view.progress.duration;

  useEffect(() => {
    if (!ready || target === 'idle') return;

    if (target === 'playing') {
      actions.play();
      return;
    }

    if (target === 'paused') {
      // Play for a moment so the playhead has somewhere to stop.
      actions.play();
      const timer = setTimeout(() => actions.pause(), 700);
      return () => clearTimeout(timer);
    }

    // `ended`: walk to the last track, then let it play out.
    if (lastTrackId && activeId !== lastTrackId) {
      actions.selectTrack(lastTrackId);
      return;
    }

    actions.play();
    const timer = setTimeout(() => actions.seek(duration), 300);
    return () => clearTimeout(timer);
  }, [ready, target, activeId, actions, duration, lastTrackId]);

  return null;
}

export interface DemoPlayerProps extends SoundlineProps {
  /** The playback state to drive to. Default: `idle` (paused at the start). */
  state?: DemoPlayback;
}

/**
 * The full widget on top of a mock engine: the same two pieces a consumer
 * composes — `PlayerProvider` and `PlayerView` — plus the optional driver.
 */
export function DemoPlayer({ state = 'idle', adapter, ...props }: DemoPlayerProps) {
  const engine = useMemo(() => createMockEngine({ duration: DEMO_DURATION, tickMs: 250 }), []);
  return (
    <PlayerProvider {...props} adapter={adapter} engine={engine}>
      <PlayerView />
      <PlaybackDriver target={state} lastTrackId={LAST_TRACK_ID} />
    </PlayerProvider>
  );
}
