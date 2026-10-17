/**
 * The Media Session integration of the widget.
 *
 * A browser shows the track on the lock screen, in the notification shade or on
 * the keyboard's media keys only if the page *claims* it through
 * `navigator.mediaSession`. This hook makes that claim: it mirrors the current
 * track into `MediaMetadata`, publishes the play/pause state and the position,
 * and binds the hardware buttons back to the controller's actions.
 *
 * Everything here is optional by contract — the API is absent on the server and
 * in `jsdom`, and a browser may support only some actions. Detection is therefore
 * structural and every call is guarded: where the API or an individual action is
 * missing, the widget simply carries on.
 */
import { useEffect, useRef } from 'react';
import { clamp, type PlayerController, type PlayerView } from '@nickkupriyanov/soundline-core';

/** The actions the widget claims; the browser only calls what it supports. */
const CLAIMED_ACTIONS = [
  'play',
  'pause',
  'nexttrack',
  'previoustrack',
  'seekbackward',
  'seekforward',
  'seekto',
] as const satisfies readonly MediaSessionAction[];

/** The session the page may claim, or `null` where the API is missing. */
function mediaSessionOf(): MediaSession | null {
  if (typeof navigator === 'undefined') return null;
  const session: MediaSession | undefined = navigator.mediaSession;
  return session && typeof session.setActionHandler === 'function' ? session : null;
}

/**
 * Registers one handler, ignoring a browser that does not know the action.
 *
 * `setActionHandler` throws `NotSupportedError` for an action a browser does not
 * implement — that is not a failure of the widget, so it is swallowed rather than
 * allowed to break the other registrations.
 */
function setHandler(
  session: MediaSession,
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null,
): void {
  try {
    session.setActionHandler(action, handler);
  } catch {
    /* The browser does not support this action; the rest still work. */
  }
}

/** The current track as `MediaMetadata`, or `null` when nothing is loaded. */
function metadataOf(view: PlayerView): MediaMetadata | null {
  if (typeof MediaMetadata === 'undefined') return null;
  const now = view.nowPlaying;
  if (!now) return null;
  return new MediaMetadata({
    title: now.title,
    ...(now.artist === null ? {} : { artist: now.artist }),
    ...(now.album === null ? {} : { album: now.album }),
    // `Track` carries no artwork dimensions, so the single source is what the
    // browser gets; it scales what it is given.
    ...(now.artwork === null ? {} : { artwork: [{ src: now.artwork }] }),
  });
}

function playbackStateOf(playing: boolean, hasTrack: boolean): MediaSessionPlaybackState {
  if (playing) return 'playing';
  return hasTrack ? 'paused' : 'none';
}

/**
 * Publishes the playhead, so the browser can show a progress bar and extrapolate
 * it between our updates from `playbackRate`.
 *
 * `setPositionState` rejects a position outside `0..duration` or a non-positive
 * duration, hence the clamp and the reset to nothing when no source is loaded.
 */
function publishPosition(
  session: MediaSession,
  position: number,
  duration: number,
  rate: number,
): void {
  try {
    if (duration > 0) {
      session.setPositionState({
        duration,
        position: clamp(position, 0, duration),
        playbackRate: rate > 0 ? rate : 1,
      });
    } else {
      session.setPositionState();
    }
  } catch {
    /* An unsupported or momentarily invalid position is not worth breaking over. */
  }
}

/**
 * Claims the browser's media session for the widget while `enabled` is true.
 *
 * Nothing is registered until the effect runs, and everything is released when
 * the widget unmounts or the application turns the integration off, so a
 * `Strict Mode` double mount leaves exactly one claim behind.
 */
export function useMediaSession(
  controller: PlayerController,
  enabled: boolean,
  skipSeconds: number,
): void {
  // The step is read at call time, so changing it does not re-register handlers.
  const skipRef = useRef(skipSeconds);
  skipRef.current = skipSeconds;

  useEffect(() => {
    if (!enabled) return;
    const session = mediaSessionOf();
    if (!session) return;

    /** Pushes the whole player picture into the session. */
    const sync = (): void => {
      const { view, state } = controller.getSnapshot();
      session.metadata = metadataOf(view);
      session.playbackState = playbackStateOf(state.playing, view.nowPlaying !== null);
      publishPosition(session, view.progress.position, view.progress.duration, state.rate);
    };

    const actions = controller.actions;
    const handlers: Record<(typeof CLAIMED_ACTIONS)[number], MediaSessionActionHandler> = {
      play: () => actions.play(),
      pause: () => actions.pause(),
      nexttrack: () => actions.next(),
      previoustrack: () => actions.previous(),
      // The browser may hand us its own step (a configurable skip length); the
      // configured one is the fallback.
      seekbackward: (details) => actions.seekBy(-(details.seekOffset ?? skipRef.current)),
      seekforward: (details) => actions.seekBy(details.seekOffset ?? skipRef.current),
      seekto: (details) => {
        if (typeof details.seekTime === 'number') actions.seek(details.seekTime);
      },
    };

    // Paint the first frame before listening, then keep in step with every
    // transition (progress ticks do not notify, and do not need to: the browser
    // advances the position itself from `playbackRate`).
    sync();
    const unsubscribe = controller.subscribe(sync);
    for (const action of CLAIMED_ACTIONS) setHandler(session, action, handlers[action]);

    return () => {
      unsubscribe();
      for (const action of CLAIMED_ACTIONS) setHandler(session, action, null);
    };
  }, [controller, enabled]);
}
