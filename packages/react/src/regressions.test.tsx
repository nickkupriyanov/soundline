/**
 * The accessibility regressions that were fixed, as tests.
 *
 * Each case here names a bug that reached a visitor: a focus that fell to
 * `<body>` when the element holding it unmounted, and a failed track list that
 * was never announced. They live in their own file so that a future refactor has
 * to keep them passing on purpose rather than by accident.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  PlaybackError,
  createMockAdapter,
  createMockEngine,
  type PlaybackErrorCode,
  type Track,
  type TrackSourceAdapter,
} from '@nickkupriyanov/soundline-core';
import { Player, PlayerProvider } from './Player';
import { PlayerView } from './components/PlayerView';
import { usePlayerContext } from './context';
import type { SoundlineProps } from './types';

const TRACK_DURATION = 100;

const tracks: Track[] = [
  { id: 'a', title: 'Alpha', src: 'a.mp3', duration: TRACK_DURATION },
  { id: 'b', title: 'Beta', src: 'b.mp3', duration: TRACK_DURATION },
];

/** The widget in its usual state; `overrides` replace whatever a case needs. */
function renderPlayer(overrides: Partial<SoundlineProps> = {}) {
  return render(
    <Player
      adapter={createMockAdapter({ tracks })}
      engine={createMockEngine({ duration: TRACK_DURATION, tickMs: 60_000 })}
      locale="en"
      {...overrides}
    />,
  );
}

function playlist(): Promise<HTMLElement> {
  return screen.findByRole('list', { name: 'Playlist' });
}

/** The widget's own state flag, which the tests use to wait for a state. */
function renderedState(): string | null {
  return document.querySelector('.sn-root')?.getAttribute('data-sn-state') ?? null;
}

/**
 * A track source whose first `getTracks` refuses and whose later ones succeed.
 *
 * The retry path is the only caller, so the first call is the initial load. A
 * latency on the successful call keeps the loading state observable long enough
 * for a test to move the focus elsewhere.
 */
function listFailsOnce(latency = 0): TrackSourceAdapter {
  const inner = createMockAdapter({ tracks, latency });
  let calls = 0;

  return {
    async getTracks(query) {
      if (calls === 0) {
        calls += 1;
        throw new PlaybackError({
          code: 'NETWORK_FAILURE' satisfies PlaybackErrorCode,
          message: 'Soundline: the first list request fails on purpose',
        });
      }
      calls += 1;
      return inner.getTracks(query);
    },
    resolveSource: (track, options) => inner.resolveSource!(track, options),
  };
}

/** The card that survives every state swap: the region the retry hands focus to. */
function card(): HTMLElement {
  return screen.getByRole('region', { name: 'Audio player' });
}

describe('accessibility regressions', () => {
  it('moves the focus to the next row when the focused row is removed', async () => {
    const user = userEvent.setup();
    renderPlayer();
    const list = await playlist();

    // A keyboard visitor is on the remove button of the first row.
    const remove = within(list).getByRole('button', { name: 'Remove Alpha' });
    remove.focus();
    await user.keyboard('{Enter}');

    // The row the focus was in is gone: the focus must land on the row that
    // inherited the roving tabindex, not on `<body>`.
    expect(screen.queryByRole('button', { name: '1. Alpha' })).toBeNull();
    expect(list.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(within(list).getByRole('button', { name: '1. Beta' }));
  });

  it('keeps the focus inside the widget when the last row is removed', async () => {
    renderPlayer({ adapter: createMockAdapter({ tracks: [tracks[0]!] }) });
    const list = await playlist();

    const remove = within(list).getByRole('button', { name: 'Remove Alpha' });
    remove.focus();
    // A real browser announces the unmount of the focused row as `focusout` with
    // no related target, in the same task the row leaves the DOM. jsdom drops the
    // focus silently, so the event the browser sends and the removal are
    // reproduced together — otherwise this test would pass by accident.
    fireEvent.focusOut(remove, { relatedTarget: null });
    fireEvent.click(remove);

    // The list gave way to the empty state; the focus follows it into the card.
    await waitFor(() => expect(renderedState()).toBe('empty'));
    expect(card()).toHaveFocus();
  });

  it('keeps the focus on the page when the visitor blurred onto plain text', async () => {
    renderPlayer({ adapter: createMockAdapter({ tracks: [tracks[0]!] }) });
    const list = await playlist();

    const remove = within(list).getByRole('button', { name: 'Remove Alpha' });
    remove.focus();
    // A click on plain text leaves the focus on `<body>`: `focusout` without a
    // related target and no `focusin` to replace it. The element is still in the
    // page, so this is a visitor leaving, not content the widget is replacing.
    remove.blur();
    await Promise.resolve();
    fireEvent.click(remove);

    await waitFor(() => expect(renderedState()).toBe('empty'));
    expect(document.activeElement).toBe(document.body);
    expect(card()).not.toHaveFocus();
  });

  it('keeps the focus on an outside control when the content swaps', async () => {
    renderPlayer({ adapter: createMockAdapter({ tracks: [tracks[0]!] }) });
    const list = await playlist();

    const outside = document.createElement('button');
    outside.textContent = 'outside';
    document.body.append(outside);
    const remove = within(list).getByRole('button', { name: 'Remove Alpha' });

    outside.focus();
    fireEvent.click(remove);

    await waitFor(() => expect(screen.queryByRole('list')).toBeNull());
    expect(outside).toHaveFocus();
    expect(card()).not.toHaveFocus();

    outside.remove();
  });

  it('re-homes the focus when a failure replaces the state holding it', async () => {
    const user = userEvent.setup();
    // The second track cannot be loaded at all, and the failure is asked for
    // rather than waited for: nothing here races a clock.
    renderPlayer({
      engine: createMockEngine({ failures: { 'b.mp3': 'SOURCE_UNAVAILABLE' } }),
    });

    const seek = await screen.findByRole('slider', { name: 'Playback position' });
    act(() => seek.focus());
    expect(document.activeElement).toBe(seek);

    // Playing the track that fails replaces the controls, the playhead among them.
    await user.click(screen.getByRole('button', { name: 'Next track' }));
    await waitFor(() => expect(renderedState()).toBe('error'));

    // The playhead unmounted with the failure; the focus did not stay on the
    // document body.
    const card = screen.getByRole('region', { name: 'Audio player' });
    expect(card.contains(document.activeElement)).toBe(true);
  });

  it('does not take the focus on a programmatic track change', async () => {
    const adapter = createMockAdapter({ tracks });
    const engine = createMockEngine({ duration: TRACK_DURATION, tickMs: 60_000 });
    const withTrack = (trackId: string) => (
      <Player adapter={adapter} engine={engine} locale="en" currentTrackId={trackId} />
    );

    const { rerender } = render(withTrack('a'));
    await screen.findByRole('slider', { name: 'Playback position' });
    // Nothing on the page is focused: this is the state a programmatic change
    // used to break by pulling the focus — and the scroll position — into the card.
    expect(document.activeElement).toBe(document.body);

    rerender(withTrack('b'));
    expect(await screen.findByText('Beta', { selector: '.sn-title' })).toBeInTheDocument();

    expect(document.activeElement).toBe(document.body);
  });

  it('hands a keyboard retry to the card and then to the first control after recovery', async () => {
    const user = userEvent.setup();
    // A failed list has no track selected at all; the card is the only thing that
    // survives the error → loading → ready swaps.
    renderPlayer({ adapter: listFailsOnce() });

    const retry = await screen.findByRole('button', { name: 'Try again' });
    retry.focus();
    const focus = vi.spyOn(card(), 'focus');

    await user.keyboard('{Enter}');

    // Before `retry()` runs, and with the scroll position left alone.
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    await waitFor(() => expect(renderedState()).toBe('ready'));
    expect(card()).toHaveFocus();

    // `Tab` continues from the surviving card into the first control that exists
    // now: the seek bar, not `<body>`.
    await user.tab();
    expect(screen.getByRole('slider', { name: 'Playback position' })).toHaveFocus();
  });

  it('puts the next Tab on the new retry button after a second list failure', async () => {
    const user = userEvent.setup();
    renderPlayer({ adapter: createMockAdapter({ tracks, failure: 'NETWORK_FAILURE' }) });

    const first = await screen.findByRole('button', { name: 'Try again' });
    first.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(renderedState()).toBe('error'));
    const second = await screen.findByRole('button', { name: 'Try again' });
    expect(second).not.toBe(first);
    expect(card()).toHaveFocus();

    await user.tab();
    expect(second).toHaveFocus();
  });

  it('keeps the retry focus with the card when the source fails again', async () => {
    const user = userEvent.setup();
    const failures: Record<string, PlaybackErrorCode> = { 'a.mp3': 'NETWORK_FAILURE' };
    renderPlayer({ engine: createMockEngine({ failures }) });

    const first = await screen.findByRole('button', { name: 'Try again' });
    first.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(renderedState()).toBe('error'));
    const second = await screen.findByRole('button', { name: 'Try again' });
    expect(card()).toHaveFocus();

    await user.tab();
    expect(second).toHaveFocus();
  });

  it('recovers a failed source and sends the next Tab to the first control', async () => {
    const user = userEvent.setup();
    const failures: Record<string, PlaybackErrorCode> = { 'a.mp3': 'NETWORK_FAILURE' };
    renderPlayer({ engine: createMockEngine({ failures }) });

    const retry = await screen.findByRole('button', { name: 'Try again' });
    retry.focus();
    // Fix the backend between the failure and the retry: the same source loads.
    delete failures['a.mp3'];
    await user.keyboard('{Enter}');

    await waitFor(() => expect(renderedState()).toBe('ready'));
    expect(card()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('slider', { name: 'Playback position' })).toHaveFocus();
  });

  it('does not pull the focus back while the retry is loading', async () => {
    const user = userEvent.setup();
    renderPlayer({ adapter: listFailsOnce(80) });

    const retry = await screen.findByRole('button', { name: 'Try again' });
    retry.focus();
    await user.keyboard('{Enter}');
    expect(card()).toHaveFocus();

    // The visitor leaves the widget during the loading state; the eventual
    // render must not take the focus (or the page) back.
    const outside = document.createElement('button');
    outside.textContent = 'Page action';
    document.body.append(outside);
    outside.focus();

    await waitFor(() => expect(renderedState()).toBe('ready'));
    expect(outside).toHaveFocus();
    expect(card()).not.toHaveFocus();
    outside.remove();
  });

  it('does not move the focus for a retry the application calls', async () => {
    const user = userEvent.setup();

    function ApplicationRetry() {
      const { actions } = usePlayerContext();
      return (
        <button type="button" onClick={() => actions.retry()}>
          Retry from the page
        </button>
      );
    }

    render(
      <PlayerProvider
        adapter={createMockAdapter({ tracks, failure: 'NETWORK_FAILURE' })}
        engine={createMockEngine({ duration: TRACK_DURATION, tickMs: 60_000 })}
        locale="en"
      >
        <PlayerView />
        <ApplicationRetry />
      </PlayerProvider>,
    );

    const outside = await screen.findByRole('button', { name: 'Retry from the page' });
    outside.focus();
    await user.click(outside);

    await waitFor(() => expect(renderedState()).toBe('error'));
    expect(outside).toHaveFocus();
  });
  it('announces a track list that failed instead of loading forever', async () => {
    renderPlayer({ adapter: createMockAdapter({ tracks, failure: 'NETWORK_FAILURE' }) });

    await waitFor(() => expect(renderedState()).toBe('error'));
    // A failed list is not a failed track: the copy names the playlist.
    expect(screen.getByRole('status')).toHaveTextContent('The playlist could not be loaded');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('renders the copy that belongs to the failure it is showing', async () => {
    renderPlayer({ engine: createMockEngine({ failures: { 'a.mp3': 'NOT_SUPPORTED' } }) });

    await waitFor(() => expect(renderedState()).toBe('error'));
    // The dictionary has words for an unsupported format; the state block and the
    // live region both use them instead of the generic "could not be loaded".
    expect(screen.getByRole('status')).toHaveTextContent(
      'This audio format is not supported by the browser',
    );
  });
});
