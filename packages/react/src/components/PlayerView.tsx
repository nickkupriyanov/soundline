import { useEffect, useRef, type CSSProperties } from 'react';
import {
  DEFAULT_SEEK_STEP,
  DEFAULT_VOLUME_STEP,
  clamp,
  format,
  formatDuration,
} from '@nickkupriyanov/soundline-core';
import { useClassNames, useComponents, usePlayerContext, useUI } from '../context';
import { useSlider } from '../hooks/useSlider';
import { QueueList } from './QueueList';
import { TimeDisplay } from './TimeDisplay';

type ViewState = 'loading' | 'empty' | 'error' | 'ready';

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
 * Every section is a part from `SoundlineComponents`, so an application may
 * replace any of them. What this view keeps is what a replacement must not have
 * to reproduce: the themed frame, the labelled region, the polite announcements,
 * focus management, and the two prepared slider bundles. The sliders' maths lives
 * in the parts' own prepared props rather than in the parts.
 */
export function PlayerView() {
  const { snapshot, actions } = usePlayerContext();
  const ui = useUI();
  const cls = useClassNames();
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

  const trackId = view.nowPlaying?.trackId ?? null;
  const state = stateOf(view);

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
    onChange: (value) => {
      if (value !== view.volumeView.volume) actions.setVolume(value);
      if (view.volumeView.muted) actions.toggleMute();
    },
  });

  const seekPercent =
    view.progress.duration > 0 ? clamp((seek.value / view.progress.duration) * 100, 0, 100) : 0;

  /* -- focus ---------------------------------------------------------------- */

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
    if (!active || active === document.body) cardRef.current?.focus();
  }, [trackId, ui.autoFocus]);

  return (
    <div
      className={cls('root', ui.className)}
      data-sn-theme={ui.theme}
      data-sn-layout={ui.layout}
      data-sn-state={state}
      lang={ui.locale}
    >
      <div
        className={cls('card')}
        ref={cardRef}
        tabIndex={-1}
        role="region"
        aria-label={ui.messages.playerLabel}
      >
        {state === 'error' && view.error ? (
          <ErrorState
            title={ui.messages.errorLabel}
            message={ui.messages.genericError}
            retryLabel={ui.messages.retryLabel}
            onRetry={view.actions.canRetry ? actions.retry : undefined}
          />
        ) : state === 'loading' ? (
          <Loading label={ui.messages.loadingLabel} />
        ) : state === 'empty' ? (
          <Empty label={ui.messages.emptyLabel} />
        ) : (
          <>
            {view.nowPlaying ? (
              // Keyed by track: a change resets the artwork's "failed" state.
              <NowPlaying
                key={view.nowPlaying.trackId}
                nowPlaying={view.nowPlaying}
                slotProps={{ className: cls('nowPlaying') }}
              >
                <Artwork nowPlaying={view.nowPlaying} slotProps={{ className: cls('artwork') }} />
              </NowPlaying>
            ) : null}

            <SeekBar progress={view.progress} percent={seekPercent} slotProps={seek.slotProps} />

            <TimeDisplay progress={view.progress} />

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

        <span className={cls('live')} role="status" aria-live="polite" aria-atomic="true">
          {view.live.message}
        </span>
      </div>
    </div>
  );
}
