import { forwardRef } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createMockAdapter, createMockEngine, type Track } from '@nickkupriyanov/soundline-core';
import { Player } from './Player';
import type { AnimationKit, ItemProps, SoundlineProps } from './types';

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

/** The one step host of the now-playing block. */
function stepHost(): HTMLElement {
  return document.querySelector('.sn-step-host') as HTMLElement;
}

describe('the animated step of the artwork', () => {
  it('wraps the artwork in a step the kit can animate', async () => {
    renderPlayer();
    await screen.findByRole('listbox', { name: 'Playlist' });

    const host = stepHost();
    expect(host).not.toBeNull();
    expect(host.querySelector('.sn-step > .sn-artwork')).not.toBeNull();
    // The very first track has nothing to come from: it steps in from the right.
    expect(host).toHaveAttribute('data-direction', 'forward');
  });

  it('steps forward on the way down the queue and back on the way up', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await screen.findByRole('listbox', { name: 'Playlist' });

    await user.click(screen.getByRole('button', { name: 'Next track' }));
    await screen.findByText('Beta', { selector: '.sn-title' });
    expect(stepHost()).toHaveAttribute('data-direction', 'forward');

    await user.click(screen.getByRole('button', { name: 'Previous track' }));
    await screen.findByText('Alpha', { selector: '.sn-title' });
    expect(stepHost()).toHaveAttribute('data-direction', 'back');
  });
});

describe('the staggered queue', () => {
  it('gives every row its place in the group', async () => {
    renderPlayer();
    const listbox = await screen.findByRole('listbox', { name: 'Playlist' });

    const rows = within(listbox).getAllByRole('option');
    expect(rows).toHaveLength(2);
    for (const [index, row] of rows.entries()) {
      expect(row).toHaveClass('sn-stagger-item');
      expect(row.style.getPropertyValue('--sn-index')).toBe(String(index));
    }
  });
});

describe('the height the states share', () => {
  it('wraps the card content in the container that follows it', async () => {
    renderPlayer();
    await screen.findByRole('listbox', { name: 'Playlist' });

    const box = document.querySelector('.sn-height') as HTMLElement;
    const inner = box.querySelector('.sn-height-inner');
    expect(inner).not.toBeNull();
    // The wrapper adds a box, not a gap: the sections it holds are all inside it.
    expect(inner?.querySelector('.sn-now-playing')).not.toBeNull();
    expect(inner?.querySelector('.sn-queue')).not.toBeNull();
    // Nothing is in flight in a test: the content sizes itself.
    expect(box).not.toHaveAttribute('data-sn-animating');
  });
});

describe('the playing track', () => {
  it('breathes in the queue and marks the root while the engine plays', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await screen.findByRole('listbox', { name: 'Playlist' });

    const root = document.querySelector('.sn-root') as HTMLElement;
    expect(root).toHaveAttribute('data-sn-playing', 'false');
    expect(document.querySelector('.sn-eq')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(root).toHaveAttribute('data-sn-playing', 'true'));

    const active = screen.getByRole('option', { name: '1. Alpha' });
    const equalizer = active.querySelector('.sn-eq');
    expect(equalizer).not.toBeNull();
    expect(equalizer).toHaveAttribute('aria-hidden', 'true');
    expect(equalizer?.children).toHaveLength(3);

    // Only the row that is playing carries it.
    expect(screen.getByRole('option', { name: '2. Beta' }).querySelector('.sn-eq')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(root).toHaveAttribute('data-sn-playing', 'false'));
    expect(document.querySelector('.sn-eq')).toBeNull();
  });
});

describe('replacing the kit', () => {
  /** A kit that marks its own elements: enough to prove the widget renders through it. */
  const markedKit: AnimationKit = {
    StepHost: ({ stepKey, direction, children }) => (
      <div data-testid="step" data-step={stepKey} data-direction={direction}>
        {children}
      </div>
    ),
    Item: forwardRef<HTMLLIElement, ItemProps>(function MarkedItem(
      { index, children, ...rest },
      ref,
    ) {
      return (
        <li {...rest} ref={ref} data-testid="row" data-index={index}>
          {children}
        </li>
      );
    }),
    Height: ({ children }) => <div data-testid="height">{children}</div>,
  };

  it('renders the widget through the kit the application passed', async () => {
    const user = userEvent.setup();
    renderPlayer({ animations: markedKit });

    const rows = await screen.findAllByTestId('row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('data-index', '0');
    expect(screen.getByTestId('height')).toBeInTheDocument();
    expect(screen.getByTestId('step')).toHaveAttribute('data-step', 'a');

    // The default kit's own hooks are gone with it.
    expect(document.querySelector('.sn-stagger-item')).toBeNull();
    expect(document.querySelector('.sn-step-host')).toBeNull();
    expect(document.querySelector('.sn-height')).toBeNull();

    // And the widget still works: the rows are real options, the transport plays.
    await user.click(screen.getByRole('option', { name: '2. Beta' }));
    expect(await screen.findByText('Beta', { selector: '.sn-title' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() =>
      expect(document.querySelector('.sn-root')).toHaveAttribute('data-sn-playing', 'true'),
    );
  });
});

describe('the kit contract', () => {
  it('keeps the row a listbox option that can still take focus', async () => {
    renderPlayer();
    const listbox = await screen.findByRole('listbox', { name: 'Playlist' });
    const alpha = within(listbox).getByRole('option', { name: '1. Alpha' });

    act(() => alpha.focus());
    expect(alpha).toHaveFocus();
    expect(listbox.contains(document.activeElement)).toBe(true);
  });
});
