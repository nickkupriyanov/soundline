import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockAdapter, createMockEngine, type Track } from '@nickkupriyanov/soundline-core';
import { REDUCED_MOTION_QUERY } from '@nickkupriyanov/soundline-core/dom';
import { Player } from './Player';
import { ROW_EXIT_DURATION } from './hooks/useExitingRows';
import { expectNoA11yViolations } from './test/a11y';
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

/** Answers the reduced-motion query the way the OS would. */
function stubReducedMotion(reduced: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: reduced && query === REDUCED_MOTION_QUERY,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

/** The rows the list is holding on to while they leave. */
function leavingRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.sn-track-item[data-sn-exiting]'));
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

/** The button of a row that selects the track; the row's own name is on it. */
function trackButton(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

describe('the queue', () => {
  it('lists the tracks in playback order and marks the active one', async () => {
    renderPlayer();
    const list = await screen.findByRole('list', { name: 'Playlist' });

    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('2 tracks')).toBeInTheDocument();

    // The active row is marked as the current one; the other rows are not
    // "false", they simply say nothing about it.
    expect(trackButton('1. Alpha')).toHaveAttribute('aria-current', 'true');
    expect(trackButton('2. Beta')).not.toHaveAttribute('aria-current');
  });

  it('uses the stylesheet’s state classes on the current and playing rows', async () => {
    const user = userEvent.setup();
    renderPlayer({
      classNames: {
        trackItem: 'custom-row',
        trackItemActive: 'custom-active',
        trackItemPlaying: 'custom-playing',
      },
    });
    const list = await screen.findByRole('list', { name: 'Playlist' });
    const [alpha, beta] = within(list).getAllByRole('listitem');

    // The class names are slots, including the state ones: a consumer override
    // has to land beside the library class, not replace it.
    expect(alpha).toHaveClass(
      'sn-track-item',
      'custom-row',
      'sn-track-item-active',
      'custom-active',
    );
    expect(beta).not.toHaveClass('sn-track-item-active');
    expect(beta).not.toHaveClass('custom-active');
    expect(beta).not.toHaveClass('sn-track-item-playing');
    expect(beta).not.toHaveClass('custom-playing');

    await user.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(alpha).toHaveClass('sn-track-item-playing', 'custom-playing'));
    expect(beta).not.toHaveClass('sn-track-item-playing');
    expect(beta).not.toHaveClass('custom-playing');
  });

  it('keeps the two buttons of a row as siblings, never nested', async () => {
    renderPlayer();
    await screen.findByRole('list', { name: 'Playlist' });

    const select = trackButton('1. Alpha');
    // Nested interactive controls are what axe's `nested-interactive` forbids.
    expect(select.querySelector('button')).toBeNull();
    expect(trackButton('Remove Alpha')).not.toBe(select);
    expect(select.contains(trackButton('Remove Alpha'))).toBe(false);
  });

  it('shows the adapter duration and keeps the column when it is unknown', async () => {
    const known = { ...(tracks[0] as Track) };
    const { duration: _duration, ...unknown } = tracks[1] as Track;
    renderPlayer({ adapter: createMockAdapter({ tracks: [known, unknown] }) });
    const list = await screen.findByRole('list', { name: 'Playlist' });
    const [alpha, beta] = within(list).getAllByRole('listitem');

    // The duration comes from the adapter's `durationLabel`; it is inside the
    // selecting button, with the remove button still a sibling of its own.
    expect(alpha?.querySelector('.sn-track-duration')).toHaveTextContent('1:40');
    expect(alpha?.querySelector('.sn-track-duration')?.closest('button')).toBe(
      trackButton('1. Alpha'),
    );
    expect(beta?.querySelector('.sn-track-duration')).toBeInTheDocument();
    expect(beta?.querySelector('.sn-track-duration')?.textContent).toBe('');
  });

  it("reserves the equalizer's place on every row, playing or not", async () => {
    const user = userEvent.setup();
    renderPlayer();
    const list = await screen.findByRole('list', { name: 'Playlist' });
    const rows = within(list).getAllByRole('listitem');

    // The placeholder is present before playback, so the title does not step
    // aside when the bars start; only its bars are invisible.
    for (const row of rows) {
      expect(row.querySelectorAll('.sn-eq')).toHaveLength(1);
      expect(row.querySelector('.sn-eq')).toHaveAttribute('data-sn-idle', 'true');
    }

    await user.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(rows[0]).toHaveClass('sn-track-item-playing'));
    expect(rows[0]?.querySelector('.sn-eq')).not.toHaveAttribute('data-sn-idle');
    expect(rows[1]?.querySelector('.sn-eq')).toHaveAttribute('data-sn-idle', 'true');
    // Both rows still reserve the same slot.
    for (const row of rows) expect(row.querySelectorAll('.sn-eq')).toHaveLength(1);
  });

  it('walks the list with a roving tab index', async () => {
    renderPlayer();
    await screen.findByRole('list', { name: 'Playlist' });

    const alpha = trackButton('1. Alpha');
    const beta = trackButton('2. Beta');

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

  it('leaves Enter and Space to the button itself', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await screen.findByRole('list', { name: 'Playlist' });

    const beta = trackButton('2. Beta');
    beta.focus();

    // A real button turns both keys into a click, so the widget never has to
    // re-implement activation.
    await user.keyboard('{Enter}');
    expect(nowPlayingTitle()).toBe('Beta');
    expect(trackButton('2. Beta')).toHaveAttribute('aria-current', 'true');
    expect(beta).toHaveFocus();

    // Space would re-select the same track: the point is that it does not move
    // the focus out of the list.
    await user.keyboard(' ');
    expect(beta).toHaveFocus();

    await user.click(trackButton('1. Alpha'));
    expect(nowPlayingTitle()).toBe('Alpha');
    expect(trackButton('1. Alpha')).toHaveAttribute('aria-current', 'true');
  });

  it('removes a track without selecting it', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await screen.findByRole('list', { name: 'Playlist' });

    await user.click(screen.getByRole('button', { name: 'Remove Beta' }));

    expect(screen.queryByRole('button', { name: '2. Beta' })).toBeNull();
    expect(nowPlayingTitle()).toBe('Alpha');
    expect(trackButton('1. Alpha')).toHaveAttribute('aria-current', 'true');
  });

  it('shows the empty state instead of the list when the playlist is empty', async () => {
    render(<Player adapter={createMockAdapter({ tracks: [] })} engine={engine()} locale="en" />);

    expect(
      await screen.findByText('There are no tracks in this playlist', {
        selector: '.sn-empty > span',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('hides the queue when the configuration asks for it', async () => {
    renderPlayer({ showQueue: false });
    await screen.findByRole('slider', { name: 'Playback position' });

    expect(screen.queryByRole('list')).toBeNull();
  });

  it('keeps `next` in step with the displayed order under shuffle', async () => {
    const user = userEvent.setup();
    renderPlayer();
    const list = await screen.findByRole('list', { name: 'Playlist' });

    await user.click(screen.getByRole('button', { name: 'Shuffle' }));

    // Whatever shuffle produced, the row after the active one is what `next`
    // must play — the widget never re-derives an order of its own.
    const rows = within(list).getAllByRole('listitem');
    const secondTitle = rows[1]?.querySelector('.sn-track-title')?.textContent ?? '';

    await user.click(screen.getByRole('button', { name: 'Next track' }));

    expect(nowPlayingTitle()).toBe(secondTitle);
    expect(rows[1]?.querySelector('button')).toHaveAttribute('aria-current', 'true');
  });

  it('holds a removed row for its exit instead of dropping it at once', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayer();
    const list = await screen.findByRole('list', { name: 'Playlist' });
    const before = within(list).getAllByRole('listitem');

    await user.click(screen.getByRole('button', { name: 'Remove Alpha' }));

    // The row is still there, but it is on its way out: it stays where it was, it
    // is out of the assistive tree, and nothing in it can be reached or clicked.
    const [leaving] = leavingRows();
    expect(leaving).toBeDefined();
    expect(leaving).toHaveAttribute('aria-hidden', 'true');
    expect(list.children[0]).toBe(leaving);
    expect(within(leaving as HTMLElement).queryByRole('button')).toBeNull();
    expect(leaving?.querySelectorAll('button[tabindex="-1"]')).toHaveLength(2);
    expect(list.children).toHaveLength(before.length);

    // A row on its way out is still part of the widget, so the widget must stay
    // valid with it in it.
    await expectNoA11yViolations(container);

    // …and it is gone for good once the exit has run.
    await waitFor(() => expect(leavingRows()).toHaveLength(0));
    expect(within(list).getAllByRole('listitem')).toHaveLength(before.length - 1);
  });

  it('drops a removed row at once when the OS asks for reduced motion', async () => {
    stubReducedMotion(true);
    const user = userEvent.setup();
    renderPlayer();
    const list = await screen.findByRole('list', { name: 'Playlist' });

    await user.click(screen.getByRole('button', { name: 'Remove Beta' }));

    // No exit to run: nothing is held back and the list is one row shorter.
    expect(leavingRows()).toHaveLength(0);
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('does not animate a row the application removed from a controlled queue', async () => {
    const mock = engine();
    const adapter = createMockAdapter({ tracks });
    const shared = { adapter, engine: mock, locale: 'en', onQueueChange: () => {} } as const;

    const { rerender } = render(<Player {...shared} queue={tracks} />);
    const list = await screen.findByRole('list', { name: 'Playlist' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);

    // The application owns the list, so dropping a row itself is an instant
    // change — not a row leaving through the list.
    rerender(<Player {...shared} queue={tracks.slice(0, 1)} />);

    expect(leavingRows()).toHaveLength(0);
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('does not replay a refused removal on a later queue update', async () => {
    const user = userEvent.setup();
    const mock = engine();
    const adapter = createMockAdapter({ tracks });
    const shared = { adapter, engine: mock, locale: 'en', onQueueChange: () => {} } as const;

    const { rerender } = render(<Player {...shared} queue={tracks} />);
    const list = await screen.findByRole('list', { name: 'Playlist' });

    // The application refuses the removal and keeps the same queue. The request
    // the row made must not stay armed after that.
    await user.click(screen.getByRole('button', { name: 'Remove Beta' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);

    // Long after the click, an unrelated update drops the same row. It has to go
    // silently instead of replaying the exit of a removal that never happened.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ROW_EXIT_DURATION + 30));
    });
    rerender(<Player {...shared} queue={tracks.slice(0, 1)} />);

    expect(leavingRows()).toHaveLength(0);
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });
});
