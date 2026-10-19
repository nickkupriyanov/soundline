import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  DEFAULT_SEEK_STEP,
  DEFAULT_VOLUME_STEP,
  clamp,
  format,
  formatDuration,
  type QueueItemView,
} from '@nickkupriyanov/soundline-core';
import { useAnimations, useClassNames, useComponents, usePlayerContext, useUI } from '../context';
import { VOLUME_TRACK_INSET, useSlider } from '../hooks/useSlider';
import { QueueList } from './QueueList';
import { TimeDisplay } from './TimeDisplay';

type ViewState = 'loading' | 'empty' | 'error' | 'ready';

/** The playing track's place in the playback order, or `null` when it is not there. */
function positionOf(items: readonly QueueItemView[], trackId: string | null): number | null {
  if (trackId === null) return null;
  return items.find((item) => item.id === trackId)?.position ?? null;
}

/**
 * Which way the queue moved: back only when it demonstrably did. The first
 * selection, a reorder and a track that is not in the queue all step in from the
 * right.
 */
function stepDirection(previousPosition: number | null, position: number | null): 1 | -1 {
  if (previousPosition === null || position === null) return 1;
  return position >= previousPosition ? 1 : -1;
}

function stateOf(view: { error: unknown; loading: boolean; empty: boolean }): ViewState {
  if (view.error) return 'error';
  if (view.loading) return 'loading';
  if (view.empty) return 'empty';
  return 'ready';
}

/**
 * The full widget: the card, the state blocks, now playing, the playhead, the
 * transport, the volume control and the queue.
 *
 * The ready card is composed in four blocks — now playing, the `progress` group
 * (seek bar + time), the `controls` group (transport + volume) and the queue —
 * so the spacing inside a group belongs to the group, not to a negative margin
 * on its neighbour.
 *
 * Every section is a part from `SoundlineComponents`, so an application may
 * replace any of them. What this view keeps is what a replacement must not have
 * to reproduce: the themed frame, the labelled region, the polite announcements,
 * focus management, the retry hand-off, the two prepared slider bundles, and the
 * three places where the animation kit steps in (the artwork, the states'
 * height, and the playing flag the stylesheet reads). The sliders' maths lives
 * in the parts' own prepared props rather than in the parts.
 */
export function PlayerView() {
  const { snapshot, actions } = usePlayerContext();
  const ui = useUI();
  const cls = useClassNames();
  const { Height, StepHost } = useAnimations();
  const {
    Artwork,
    Empty,
    Error: ErrorState,
    Header,
    Loading,
    NowPlaying,
    Queue,
    SeekBar,
    Transport,
    Volume,
  } = useComponents();
  const view = snapshot.view;

  const cardRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const previousTrackRef = useRef<string | null>(view.nowPlaying?.trackId ?? null);
  /**
   * The last element inside the card that held the focus, and whether the focus
   * was still inside when it moved.
   *
   * A removed element fires `focusout` with no `relatedTarget` when the document
   * has focus — exactly like a move to plain text or an empty part of the page.
   * The flag alone therefore cannot tell "the library replaced the content" from
   * "the visitor left": the element is the tiebreaker. A microtask after the
   * event is late enough for the unmount to have happened, so a node that is
   * still connected there belongs to a visitor who left, and is forgotten; one
   * that is gone belongs to the content swap the effect below has to cover. A
   * browser that drops the focus without the event is covered by the same pair.
   */
  const focusInsideRef = useRef(false);
  const lastFocusRef = useRef<Element | null>(null);

  const trackId = view.nowPlaying?.trackId ?? null;
  const state = stateOf(view);

  /* -- the step the artwork came in from ------------------------------------ */

  // Which way the queue moved is worked out once per track change and then held
  // for as long as that track shows. Recomputing it on every render would flip
  // the step mid-flight: the engine reporting and the playhead moving both
  // re-render the view while the transition is still running.
  const [step, setStep] = useState<{
    id: string | null;
    direction: 1 | -1;
    position: number | null;
  }>(() => ({ id: trackId, direction: 1, position: null }));

  const position = positionOf(view.queue.items, trackId);
  if (step.id !== trackId || step.position !== position) {
    const changed = step.id !== trackId;
    setStep({
      id: trackId,
      direction: changed ? stepDirection(step.position, position) : step.direction,
      position,
    });
  }

  /* -- the sliders, wired here so any part can render them ------------------ */

  const seek = useSlider({
    value: view.progress.position,
    min: 0,
    max: view.progress.duration,
    step: view.settings.seekStep || DEFAULT_SEEK_STEP,
    label: ui.messages.seekLabel,
    aria: (value) => ({
      min: 0,
      max: Math.round(view.progress.duration),
      now: Math.round(value),
      text: format(ui.messages.seekValue, {
        position: formatDuration(value),
        duration: view.progress.durationLabel,
      }),
    }),
    enabled: view.actions.canSeek,
    className: cls('seek'),
    onChange: (value) => {
      if (value !== view.progress.position) actions.seek(value);
    },
  });

  const volume = useSlider({
    value: view.volumeView.volume,
    min: 0,
    max: 1,
    step: view.settings.volumeStep || DEFAULT_VOLUME_STEP,
    label: ui.messages.volumeLabel,
    aria: (value) => {
      const percent = Math.round(value * 100);
      return {
        min: 0,
        max: 100,
        now: percent,
        text: format(ui.messages.volumeValue, { percent }),
      };
    },
    className: cls('volumeSlider'),
    style: (value) => ({ '--sn-volume-percent': `${Math.round(value * 100)}%` }) as CSSProperties,
    trackInset: VOLUME_TRACK_INSET,
    onChange: (value) => {
      if (value !== view.volumeView.volume) actions.setVolume(value);
      if (view.volumeView.muted) actions.toggleMute();
    },
  });

  const seekPercent =
    view.progress.duration > 0 ? clamp((seek.value / view.progress.duration) * 100, 0, 100) : 0;

  /* -- focus ---------------------------------------------------------------- */

  // Keeps track of whether the focus is inside the card. This has to be observed
  // rather than read at render time: by the time the effect below runs, a control
  // that unmounted with the previous render has already handed the focus to
  // `<body>`, and nothing in the DOM says where it came from.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const inside = (node: EventTarget | null): boolean =>
      node instanceof Node && (cardRef.current?.contains(node) ?? false);

    const onFocusIn = (event: FocusEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      const inCard = inside(target);
      lastFocusRef.current = inCard ? target : null;
      focusInsideRef.current = inCard;
    };
    const onFocusOut = (event: FocusEvent): void => {
      // Moving between two controls of the card is not leaving it.
      if (inside(event.relatedTarget)) return;
      focusInsideRef.current = false;

      /*
       * With no related target this is either the visitor clicking plain text
       * (nothing gains the focus) or the widget unmounting the control that had
       * it. The node answers a microtask later: still connected means the
       * visitor left and the ref must be forgotten, gone means the effect below
       * has a focus to take back.
       */
      const target = event.target;
      if (!(target instanceof Element) || !inside(target)) return;
      queueMicrotask(() => {
        if (lastFocusRef.current === target && target.isConnected) {
          lastFocusRef.current = null;
        }
      });
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  // Two things are kept true here. Nothing is focused by the library on the way
  // in unless `autoFocus` asks for it, and a content swap never leaves the focus
  // on `<body>`: when the track changes, or the widget trades its controls for a
  // state block (a failure, an empty list), the card takes back the focus it
  // lost — including the focus that went with a removed row. A visitor who is
  // somewhere else on the page keeps it — the check is the focus actually having
  // escaped from inside the card, not the render having happened.
  // `preventScroll` keeps that return from moving the page.
  useEffect(() => {
    const previous = previousTrackRef.current;
    previousTrackRef.current = trackId;

    if (!mountedRef.current) {
      mountedRef.current = true;
      if (ui.autoFocus) cardRef.current?.focus();
      return;
    }

    // The very first selection (queue loading → first track) is not a "change":
    // stealing focus then would pull the visitor out of the page on load.
    if (previous === null) return;

    const active = typeof document === 'undefined' ? null : document.activeElement;
    if (active && active !== document.body) return;

    /*
     * The control that held the focus may have gone with the content this render
     * replaced — deleting the last track, for one. That is the library's focus to
     * take back, not a visitor walking away, and the `focusout` that removal
     * produced has already cleared `focusInsideRef`. The element itself is still
     * the honest signal: it is detached now, while an element the visitor moved
     * to is not.
     */
    const last = lastFocusRef.current;
    const removedFromCard = last !== null && !last.isConnected;

    if (!focusInsideRef.current && !removedFromCard) return;
    focusInsideRef.current = false;
    lastFocusRef.current = null;
    cardRef.current?.focus({ preventScroll: true });
  }, [trackId, state, ui.autoFocus]);

  /* -- retry ---------------------------------------------------------------- */

  /**
   * Runs a retry without letting the focus fall to `<body>`.
   *
   * The error block's button is replaced by the loading block in the same
   * render that starts the retry, and replaced again by the new error or the
   * ready state. If the activation came from inside the card, the focus moves
   * to the card — which survives every one of those swaps — *before* the action
   * runs. The card is a `tabIndex={-1}` region, so the next `Tab` continues from
   * it into whatever is now the first control: the new Retry button after
   * another failure, the seek bar after a recovery.
   *
   * Only the user's activation goes through here. A programmatic
   * `actions.retry()` from the application never lands in this path, so it never
   * moves the focus. `preventScroll` keeps the hand-off from moving the page.
   */
  const retry = useCallback(() => {
    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      const card = cardRef.current;
      if (card && active && card.contains(active)) {
        card.focus({ preventScroll: true });
      }
    }
    actions.retry();
  }, [actions]);

  return (
    <div
      className={cls('root', ui.className)}
      data-sn-theme={ui.theme}
      data-sn-layout={ui.layout}
      data-sn-state={state}
      data-sn-playing={view.transport.playing ? 'true' : 'false'}
      lang={ui.locale}
    >
      <div
        className={cls('card')}
        ref={cardRef}
        tabIndex={-1}
        role="region"
        aria-label={ui.messages.playerLabel}
      >
        <Height>
          {state === 'error' && view.error ? (
            <ErrorState
              title={ui.messages.errorLabel}
              message={view.errorMessage}
              retryLabel={ui.messages.retryLabel}
              onRetry={view.actions.canRetry ? retry : undefined}
            />
          ) : state === 'loading' ? (
            <Loading label={ui.messages.loadingLabel} />
          ) : state === 'empty' ? (
            <Empty label={ui.messages.emptyLabel} />
          ) : (
            <>
              {view.nowPlaying ? (
                // The step host is keyed by track: a change animates the artwork and
                // resets its "failed" state.
                <NowPlaying
                  nowPlaying={view.nowPlaying}
                  slotProps={{ className: cls('nowPlaying') }}
                >
                  <StepHost stepKey={view.nowPlaying.trackId} direction={step.direction}>
                    <Artwork
                      key={view.nowPlaying.trackId}
                      nowPlaying={view.nowPlaying}
                      slotProps={{ className: cls('artwork') }}
                    />
                  </StepHost>
                </NowPlaying>
              ) : null}

              <div className={cls('progress')}>
                <SeekBar
                  progress={view.progress}
                  percent={seekPercent}
                  slotProps={seek.slotProps}
                />

                <TimeDisplay progress={view.progress} />
              </div>

              <div className={cls('controls')}>
                <Transport
                  transport={view.transport}
                  slotProps={{ className: cls('transport') }}
                  onToggle={actions.toggle}
                  onNext={actions.next}
                  onPrevious={actions.previous}
                  onShuffle={actions.setShuffle}
                  onLoop={actions.setLoop}
                />

                <Volume
                  view={view.volumeView}
                  percent={Math.round(volume.value * 100)}
                  slotProps={{ className: cls('volume') }}
                  buttonProps={{
                    type: 'button',
                    className: cls('volumeButton'),
                    'aria-label': view.volumeView.label,
                    'aria-pressed': view.volumeView.muted,
                    onClick: actions.toggleMute,
                  }}
                  sliderProps={volume.slotProps}
                />
              </div>

              {view.queue.show ? (
                <Queue
                  queue={view.queue}
                  slotProps={{ className: cls('queue') }}
                  header={
                    <Header
                      label={view.queue.label}
                      countLabel={view.queue.countLabel}
                      slotProps={{ className: cls('header') }}
                    />
                  }
                >
                  <QueueList
                    queue={view.queue}
                    onSelect={actions.selectTrack}
                    onRemove={actions.removeFromQueue}
                  />
                </Queue>
              ) : null}
            </>
          )}
        </Height>

        <span className={cls('live')} role="status" aria-live="polite" aria-atomic="true">
          {view.live.message}
        </span>
      </div>
    </div>
  );
}
