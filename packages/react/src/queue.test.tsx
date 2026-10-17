import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createMockAdapter, createMockEngine, type Track } from '@nickkupriyanov/soundline-core';
import { Player } from './Player';
import type { SoundlineProps } from './types';

const TRACK_DURATION = 100;

const tracks: Track[] = [
  {
    id: 'a',
    title: 'Alpha',
    artist: 'One',
    album: 'First',
    src: 'a.mp3',
    duration: TRACK_DURATION,
  },
  { id: 'b', title: 'Beta', artist: 'Two', src: 'b.mp3', duration: TRACK_DURATION },
];

/** A mock engine whose playhead never ticks by itself, so nothing races a clock. */
function engine() {
  return createMockEngine({ duration: TRACK_DURATION, tickMs: 60_000 });
}

function renderPlayer(overrides: Partial<SoundlineProps> = {}) {
  return render(
    <Player adapter={createMockAdapter({ tracks })} engine={engine()} locale="en" {...overrides} />,
  );
}

/** The title of the track the now-playing row currently shows. */
function nowPlayingTitle(): string {
  return (document.querySelector('.sn-title') as HTMLElement).textContent ?? '';
}

describe('the queue', () => {
  it('lists the tracks in playback order and marks the active one', async () => {
    renderPlayer();
    const listbox = await screen.findByRole('listbox', { name: 'Playlist' });

    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(screen.getByText('2 tracks')).toBeInTheDocument();

    expect(screen.getByRole('option', { name: '1. Alpha' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('option', { name: '2. Beta' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('walks the list with a roving tab index', async () => {
    renderPlayer();
    await screen.findByRole('listbox', { name: 'Playlist' });

    const alpha = screen.getByRole('option', { name: '1. Alpha' });
    const beta = screen.getByRole('option', { name: '2. Beta' });

    // Exactly one row is in the tab order, and it is the active one to start.
    expect(alpha).toHaveAttribute('tabindex', '0');
    expect(beta).toHaveAttribute('tabindex', '-1');

    alpha.focus();
    // A handled key is claimed: the page must not scroll under it.
    expect(fireEvent.keyDown(alpha, { key: 'ArrowDown' })).toBe(false);
    expect(beta).toHaveFocus();
    expect(beta).toHaveAttribute('tabindex', '0');
    expect(alpha).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(beta, { key: 'End' });
    expect(beta).toHaveFocus();

    fireEvent.keyDown(beta, { key: 'Home' });
    expect(alpha).toHaveFocus();

    // ArrowUp at the top stays put instead of wrapping.
    fireEvent.keyDown(alpha, { key: 'ArrowUp' });
    expect(alpha).toHaveFocus();
  });

  it('selects with Enter, Space and a click, without leaving the list', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await screen.findByRole('listbox', { name: 'Playlist' });

    const beta = screen.getByRole('option', { name: '2. Beta' });
    beta.focus();
    fireEvent.keyDown(beta, { key: 'Enter' });

    expect(nowPlayingTitle()).toBe('Beta');
    expect(screen.getByRole('option', { name: '2. Beta' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(beta).toHaveFocus();

    fireEvent.keyDown(beta, { key: ' ' });
    expect(screen.getByRole('option', { name: '2. Beta' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(screen.getByRole('option', { name: '1. Alpha' }));
    expect(nowPlayingTitle()).toBe('Alpha');
    expect(screen.getByRole('option', { name: '1. Alpha' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('removes a track without selecting it', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await screen.findByRole('listbox', { name: 'Playlist' });

    await user.click(screen.getByRole('button', { name: 'Remove Beta' }));

    expect(screen.queryByRole('option', { name: '2. Beta' })).toBeNull();
    expect(nowPlayingTitle()).toBe('Alpha');
    expect(screen.getByRole('option', { name: '1. Alpha' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows the empty state instead of the list when the playlist is empty', async () => {
    render(<Player adapter={createMockAdapter({ tracks: [] })} engine={engine()} locale="en" />);

    expect(
      await screen.findByText('There are no tracks in this playlist', {
        selector: '.sn-empty > span',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('hides the queue when the configuration asks for it', async () => {
    renderPlayer({ showQueue: false });
    await screen.findByRole('slider', { name: 'Playback position' });

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps `next` in step with the displayed order under shuffle', async () => {
    const user = userEvent.setup();
    renderPlayer();
    const listbox = await screen.findByRole('listbox', { name: 'Playlist' });

    await user.click(screen.getByRole('button', { name: 'Shuffle' }));

    // Whatever shuffle produced, the row after the active one is what `next`
    // must play — the widget never re-derives an order of its own.
    const rows = within(listbox).getAllByRole('option');
    const secondTitle = rows[1]?.querySelector('.sn-track-title')?.textContent ?? '';

    await user.click(screen.getByRole('button', { name: 'Next track' }));

    expect(nowPlayingTitle()).toBe(secondTitle);
    expect(rows[1]).toHaveAttribute('aria-selected', 'true');
  });
});
