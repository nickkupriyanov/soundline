import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockAdapter, createMockEngine, type Track } from '@nickkupriyanov/soundline-core';
import { Player } from './Player';
import type { SoundlineProps } from './types';

const TRACK_DURATION = 100;

const tracks: Track[] = [
  { id: 'a', title: 'Alpha', src: 'a.mp3', duration: TRACK_DURATION },
  { id: 'b', title: 'Beta', src: 'b.mp3', duration: TRACK_DURATION },
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

/** Renders the widget and waits for the queue to settle, returning the slider. */
function reachVolume(): Promise<HTMLElement> {
  return screen.findByRole('slider', { name: 'Volume' });
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

describe('the volume control', () => {
  it('starts at full volume with a named slider', async () => {
    renderPlayer();
    const slider = await reachVolume();

    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    expect(slider).toHaveAttribute('aria-valuetext', '100%');
    expect(slider).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('mutes and unmutes, keeping the level', async () => {
    const user = userEvent.setup();
    renderPlayer();
    const slider = await reachVolume();

    await user.click(screen.getByRole('button', { name: 'Mute' }));

    expect(screen.getByRole('button', { name: 'Unmute' })).toHaveAttribute('aria-pressed', 'true');
    // Muting is not the same as turning the level down.
    expect(slider).toHaveAttribute('aria-valuenow', '100');

    await user.click(screen.getByRole('button', { name: 'Unmute' }));

    expect(screen.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'false');
    expect(slider).toHaveAttribute('aria-valuenow', '100');
  });

  it('moves by `volumeStep` and jumps to the ends with the keyboard', async () => {
    renderPlayer();
    const slider = await reachVolume();

    // A handled key is claimed: the page must not scroll under it.
    expect(fireEvent.keyDown(slider, { key: 'ArrowLeft' })).toBe(false);
    expect(slider).toHaveAttribute('aria-valuenow', '95');
    expect(slider).toHaveAttribute('aria-valuetext', '95%');

    fireEvent.keyDown(slider, { key: 'PageDown' });
    expect(slider).toHaveAttribute('aria-valuenow', '45');

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');

    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
  });

  it('honours a custom `volumeStep`', async () => {
    renderPlayer({ volumeStep: 0.25 });
    const slider = await reachVolume();

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '75');

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '50');
  });

  it('follows the pointer and only applies the level on release', async () => {
    renderPlayer();
    const slider = await reachVolume();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(100));

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 40 });
    expect(slider).toHaveAttribute('data-sn-dragging', 'true');
    expect(slider).toHaveAttribute('aria-valuenow', '40');

    fireEvent.pointerMove(slider, { pointerId: 1, clientX: 70 });
    expect(slider).toHaveAttribute('aria-valuenow', '70');

    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 70 });
    expect(slider).not.toHaveAttribute('data-sn-dragging');
    expect(slider).toHaveAttribute('aria-valuenow', '70');
    expect(slider).toHaveAttribute('aria-valuetext', '70%');
  });

  it('lifts the mute when the slider is moved', async () => {
    const user = userEvent.setup();
    renderPlayer();
    const slider = await reachVolume();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(100));

    await user.click(screen.getByRole('button', { name: 'Mute' }));
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 40 });
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 40 });

    expect(screen.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'false');
    expect(slider).toHaveAttribute('aria-valuenow', '40');
  });

  it('speaks the copy of the active locale', async () => {
    render(<Player adapter={createMockAdapter({ tracks })} engine={engine()} locale="ru" />);

    const slider = await screen.findByRole('slider', { name: 'Громкость' });
    expect(slider).toHaveAttribute('aria-valuetext', '100%');
    expect(screen.getByRole('button', { name: 'Выключить звук' })).toBeInTheDocument();
  });
});
