import { useEffect, useRef } from 'react';
import { useClassNames, useComponents, usePlayerContext, useUI } from '../context';
import { Progress } from './Progress';

type ViewState = 'loading' | 'empty' | 'error' | 'ready';

function stateOf(view: { error: unknown; loading: boolean; empty: boolean }): ViewState {
  if (view.error) return 'error';
  if (view.loading) return 'loading';
  if (view.empty) return 'empty';
  return 'ready';
}

/**
 * The full widget: card, state blocks, playhead and the live region.
 *
 * This is the Iteration 6 skeleton — the transport, queue and now-playing
 * sections arrive with Iterations 7–9. What it already does properly is the
 * frame every section fits into: the themed card, the labelled region and the
 * polite announcements, plus keeping focus inside the card when a track change
 * would otherwise drop it onto `<body>`.
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
          <Progress progress={view.progress} />
        )}

        <span className={cls('live')} role="status" aria-live="polite" aria-atomic="true">
          {view.live.message}
        </span>
      </div>
    </div>
  );
}
