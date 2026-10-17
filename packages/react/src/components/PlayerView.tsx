import { useEffect, useRef } from 'react';
import { useClassNames, useComponents, usePlayerContext, useUI } from '../context';
import { NowPlaying } from './NowPlaying';
import { SeekBar } from './SeekBar';
import { TimeDisplay } from './TimeDisplay';
import { Transport } from './Transport';

type ViewState = 'loading' | 'empty' | 'error' | 'ready';

function stateOf(view: { error: unknown; loading: boolean; empty: boolean }): ViewState {
  if (view.error) return 'error';
  if (view.loading) return 'loading';
  if (view.empty) return 'empty';
  return 'ready';
}

/**
 * The full widget: card, state blocks, now playing, the playhead and the
 * transport.
 *
 * The pieces are rendered directly here rather than through the extension map:
 * which parts an application may replace is decided in Iteration 9, and until
 * then a part that can be replaced would be a public contract without a
 * documented shape. Everything this view already does properly is the frame the
 * sections fit into: the themed card, the labelled region and the polite
 * announcements, plus keeping focus inside the card when a track change would
 * otherwise drop it onto `<body>`. The queue and the volume control arrive with
 * Iteration 8.
 */
export function PlayerView() {
  const { snapshot, actions } = usePlayerContext();
  const ui = useUI();
  const cls = useClassNames();
  const { Loading, Empty, Error: ErrorState } = useComponents();
  const view = snapshot.view;

  const cardRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const previousTrackRef = useRef<string | null>(view.nowPlaying?.trackId ?? null);

  const trackId = view.nowPlaying?.trackId ?? null;
  const state = stateOf(view);

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
              <NowPlaying key={view.nowPlaying.trackId} nowPlaying={view.nowPlaying} />
            ) : null}

            <SeekBar
              progress={view.progress}
              canSeek={view.actions.canSeek}
              seekStep={view.settings.seekStep}
              onSeek={actions.seek}
            />

            <TimeDisplay progress={view.progress} />

            <Transport
              transport={view.transport}
              onToggle={actions.toggle}
              onNext={actions.next}
              onPrevious={actions.previous}
              onShuffle={actions.setShuffle}
              onLoop={actions.setLoop}
            />
          </>
        )}

        <span className={cls('live')} role="status" aria-live="polite" aria-atomic="true">
          {view.live.message}
        </span>
      </div>
    </div>
  );
}
