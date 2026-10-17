/**
 * The accessibility regressions that were fixed, as tests.
 *
 * Each case here names a bug that reached a visitor: a focus that fell to
 * `<body>` when the element holding it unmounted, and a failed track list that
 * was never announced. They live in their own file so that a future refactor has
 * to keep them passing on purpose rather than by accident.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createMockAdapter, createMockEngine, type Track } from '@nickkupriyanov/soundline-core';
import { Player } from './Player';
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
    const user = userEvent.setup();
    renderPlayer({ adapter: createMockAdapter({ tracks: [tracks[0]!] }) });
    const list = await playlist();

    const remove = within(list).getByRole('button', { name: 'Remove Alpha' });
    remove.focus();
    await user.keyboard('{Enter}');

    // The list gave way to the empty state; the focus follows it into the card.
    await waitFor(() => expect(renderedState()).toBe('empty'));
    const card = screen.getByRole('region', { name: 'Audio player' });
    expect(card.contains(document.activeElement)).toBe(true);
  });

  it('re-homes the focus when a failure replaces the state holding it', async () => {
    // The second track cannot be loaded, and playback runs off the first one on
    // its own: the error state replaces the controls while nobody is clicking.
    renderPlayer({
      engine: createMockEngine({
        duration: 0.05,
        tickMs: 1,
        failures: { 'b.mp3': 'SOURCE_UNAVAILABLE' },
      }),
      defaultPlaying: true,
    });

    const seek = await screen.findByRole('slider', { name: 'Playback position' });
    act(() => seek.focus());
    expect(document.activeElement).toBe(seek);

    await waitFor(() => expect(renderedState()).toBe('error'));

    // The playhead unmounted with the failure; the focus did not stay on the
    // document body.
    const card = screen.getByRole('region', { name: 'Audio player' });
    expect(card.contains(document.activeElement)).toBe(true);
  });

  it('announces a track list that failed instead of loading forever', async () => {
    renderPlayer({ adapter: createMockAdapter({ tracks, failure: 'NETWORK_FAILURE' }) });

    await waitFor(() => expect(renderedState()).toBe('error'));
    expect(screen.getByRole('status')).toHaveTextContent('The track could not be loaded');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
