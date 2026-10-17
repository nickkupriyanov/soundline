import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockAdapter, createMockEngine, type Track } from '@nickkupriyanov/soundline-core';
import { Player } from './Player';
import type { SoundlineProps } from './types';

/** Two 100-second tracks: the labels the tests assert on are exactly `1:40`. */
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

/**
 * A mock engine whose playhead never ticks by itself: every move in these tests
 * is one the test asked for, so no assertion races a clock.
 */
function engine() {
  return createMockEngine({ duration: TRACK_DURATION, tickMs: 60_000 });
}

function renderPlayer(overrides: Partial<SoundlineProps> = {}) {
  return render(
    <Player adapter={createMockAdapter({ tracks })} engine={engine()} locale="en" {...overrides} />,
  );
}

/** Renders the widget and waits for the queue to settle, returning the seek bar. */
async function reachSlider(): Promise<HTMLElement> {
  return screen.findByRole('slider', { name: 'Playback position' });
}

/** A 100-pixel-wide bar at x=0, so `clientX` reads directly as a percentage. */
function rect(width: number): DOMRect {
  return {
    left: 0,
    top: 0,
    width,
    height: 22,
    right: width,
    bottom: 22,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('the now-playing row', () => {
  it('shows the track, its labels and the full playhead', async () => {
    renderPlayer();
    const slider = await reachSlider();

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();

    // Nothing has been loaded yet, but the bar already describes the whole track.
    expect(screen.getByText('0:00')).toBeInTheDocument();
    expect(screen.getByText('1:40')).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    expect(slider).toHaveAttribute('aria-valuetext', '0:00 of 1:40');
    expect(slider).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('draws the placeholder when the track has no artwork', async () => {
    renderPlayer();
    await reachSlider();

    expect(document.querySelector('.sn-artwork img')).toBeNull();
    expect(document.querySelector('.sn-artwork-fallback')).not.toBeNull();
  });

  it('falls back to the placeholder when the artwork cannot load', async () => {
    const withArtwork: Track = { ...(tracks[0] as Track), artwork: 'missing.png' };
    renderPlayer({ adapter: createMockAdapter({ tracks: [withArtwork] }) });
    await reachSlider();

    const image = document.querySelector('.sn-artwork img');
    expect(image).not.toBeNull();

    fireEvent.error(image as Element);

    expect(document.querySelector('.sn-artwork img')).toBeNull();
    expect(document.querySelector('.sn-artwork-fallback')).not.toBeNull();
  });
});

describe('the transport', () => {
  it('plays and pauses through the engine, swapping the label', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await reachSlider();

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(await screen.findByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('walks the queue and disables "next" at the last track', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await reachSlider();

    expect(screen.getByRole('button', { name: 'Previous track' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next track' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Next track' }));

    expect(await screen.findByText('Beta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next track' })).toBeDisabled();
    // Going back is always possible: it restarts the track at the very least.
    expect(screen.getByRole('button', { name: 'Previous track' })).toBeEnabled();
  });

  it('enables "next" at the last track once the playlist repeats', async () => {
    const user = userEvent.setup();
    renderPlayer({ defaultLoop: 'all' });
    await reachSlider();

    await user.click(screen.getByRole('button', { name: 'Next track' }));
    await screen.findByText('Beta');

    expect(screen.getByRole('button', { name: 'Repeat playlist' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Next track' })).toBeEnabled();
  });

  it('toggles shuffle with aria-pressed', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await reachSlider();

    const shuffle = screen.getByRole('button', { name: 'Shuffle' });
    expect(shuffle).toHaveAttribute('aria-pressed', 'false');

    await user.click(shuffle);
    expect(screen.getByRole('button', { name: 'Shuffle' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Shuffle' }));
    expect(screen.getByRole('button', { name: 'Shuffle' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('cycles repeat off → all → one → off', async () => {
    const user = userEvent.setup();
    renderPlayer();
    await reachSlider();

    const repeat = () => screen.getByRole('button', { name: /^Repeat/ });
    expect(repeat()).toHaveAccessibleName('Repeat off');
    expect(repeat()).toHaveAttribute('aria-pressed', 'false');

    await user.click(repeat());
    expect(screen.getByRole('button', { name: 'Repeat playlist' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Repeat playlist' }));
    expect(screen.getByRole('button', { name: 'Repeat track' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Repeat track' }));
    expect(screen.getByRole('button', { name: 'Repeat off' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('the seek bar', () => {
  it('moves the playhead with the keyboard', async () => {
    renderPlayer();
    const slider = await reachSlider();
    slider.focus();

    // A handled key is claimed: the page must not scroll under it.
    expect(fireEvent.keyDown(slider, { key: 'ArrowRight' })).toBe(false);
    expect(slider).toHaveAttribute('aria-valuenow', '5');
    expect(slider).toHaveAttribute('aria-valuetext', '0:05 of 1:40');
    expect(screen.getByText('0:05')).toBeInTheDocument();

    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(slider).toHaveAttribute('aria-valuenow', '55');

    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    expect(slider).toHaveAttribute('aria-valuetext', '1:40 of 1:40');

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');

    // Stops at the ends instead of running past them.
    fireEvent.keyDown(slider, { key: 'PageDown' });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
  });

  it('honours `seekStep`', async () => {
    renderPlayer({ seekStep: 30 });
    const slider = await reachSlider();

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '30');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '60');
  });

  it('follows the pointer and only moves the playhead on release', async () => {
    renderPlayer();
    const slider = await reachSlider();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(100));

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 25 });
    expect(slider).toHaveAttribute('data-sn-dragging', 'true');
    expect(slider).toHaveAttribute('aria-valuenow', '25');
    expect(slider).toHaveAttribute('aria-valuetext', '0:25 of 1:40');
    // The playhead has not moved yet: the time readout still shows the start.
    expect(screen.getByText('0:00')).toBeInTheDocument();

    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 60 });
    expect(slider).toHaveAttribute('aria-valuenow', '60');

    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 60 });
    expect(slider).not.toHaveAttribute('data-sn-dragging');
    expect(slider).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByText('1:00')).toBeInTheDocument();
  });

  it('keeps the dragged value while the engine reports a new position', async () => {
    const mockEngine = engine();
    render(<Player adapter={createMockAdapter({ tracks })} engine={mockEngine} locale="en" />);
    const slider = await reachSlider();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(100));

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 25 });
    expect(slider).toHaveAttribute('aria-valuenow', '25');

    // A tick, a media key, another tab: the engine moves on its own.
    act(() => mockEngine.seek(80));

    expect(slider).toHaveAttribute('aria-valuenow', '25');
    expect(slider).toHaveAttribute('aria-valuetext', '0:25 of 1:40');

    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 25 });
    expect(slider).toHaveAttribute('aria-valuenow', '25');
  });

  it('does not exist until the queue settles, and not in an empty playlist', async () => {
    render(<Player adapter={createMockAdapter({ tracks: [], latency: 20 })} engine={engine()} />);

    // Nothing to seek in a state that has not loaded yet: no slider at all.
    expect(screen.queryByRole('slider')).toBeNull();

    expect(
      await screen.findByText('There are no tracks in this playlist', {
        selector: '.sn-empty > span',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
  });

  it('speaks the copy of the active locale', async () => {
    render(<Player adapter={createMockAdapter({ tracks })} engine={engine()} locale="ru" />);

    const slider = await screen.findByRole('slider', { name: 'Позиция воспроизведения' });
    expect(slider).toHaveAttribute('aria-valuetext', '0:00 из 1:40');
    expect(screen.getByRole('button', { name: 'Воспроизвести' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повтор выключен' })).toBeInTheDocument();
  });
});
