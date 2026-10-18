import { useEffect, useMemo, type ReactNode } from 'react';
import { createMockEngine, type Track } from '../index';
import { PlayerProvider } from '../Player';
import { PlayerView } from '../components/PlayerView';
import { usePlayerContext } from '../context';
import type { SoundlineProps } from '../types';

/**
 * Everything the stories and the state gallery share: a small playlist with
 * artwork, a deterministic mock engine, and a driver that walks the real widget
 * into a playback state through its public actions.
 *
 * Nothing here is a mock-up of the UI: the driver only calls `play`, `pause` and
 * `seek`, so what a story shows is exactly what the widget renders when a user
 * does the same thing.
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
 * The full widget on top of a mock engine.
 *
 * Same two pieces a consumer composes — `PlayerProvider` and `PlayerView` — plus
 * the optional driver. The engine is created once per mount, so a story that is
 * revisited starts clean instead of inheriting the previous playhead.
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

/** A centred, captioned column used by the stories that show one player. */
export function StoryStage({ caption, children }: { caption?: ReactNode; children: ReactNode }) {
  return (
    <div className="sb-stack">
      {caption ? <p className="sb-note">{caption}</p> : null}
      <div>{children}</div>
    </div>
  );
}
