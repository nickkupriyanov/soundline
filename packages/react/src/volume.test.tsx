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

/** A 100-pixel-wide box at x=0, so `clientX` reads through the track span. */
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

/** The visual track is inset 7px on each side of the 100px box. */
const INSET = 7;
/** Where the pointer has to be to land on a given percentage of the track. */
const point = (percent: number, width = 100): number =>
  INSET + (percent / 100) * (width - INSET * 2);

/** The visible percentage, which is feedback rather than a tab stop. */
function volumeValue(): HTMLElement {
  return document.querySelector('.sn-volume-value') as HTMLElement;
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

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: point(40) });
    expect(slider).toHaveAttribute('data-sn-dragging', 'true');
    expect(slider).toHaveAttribute('aria-valuenow', '40');

    fireEvent.pointerMove(slider, { pointerId: 1, clientX: point(70) });
    expect(slider).toHaveAttribute('aria-valuenow', '70');

    fireEvent.pointerUp(slider, { pointerId: 1, clientX: point(70) });
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

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: point(40) });
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: point(40) });

    expect(screen.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'false');
    expect(slider).toHaveAttribute('aria-valuenow', '40');
  });

  it('shows the level, including the remembered one while muted', async () => {
    const user = userEvent.setup();
    renderPlayer();
    const slider = await reachVolume();

    expect(volumeValue()).toHaveTextContent('100%');
    expect(volumeValue()).toHaveAttribute('aria-hidden', 'true');
    // The readout is feedback: it must not become another Tab stop.
    expect(volumeValue().tagName).toBe('SPAN');
    expect(volumeValue()).not.toHaveAttribute('tabindex');

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(volumeValue()).toHaveTextContent('95%');

    await user.click(screen.getByRole('button', { name: 'Mute' }));
    // Muting does not zero the level, and the readout keeps saying so.
    expect(volumeValue()).toHaveTextContent('95%');
    expect(slider).toHaveAttribute('aria-valuenow', '95');
  });

  it('maps every point of the inset track, including both ends', async () => {
    renderPlayer();
    const slider = await reachVolume();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(100));
    const thumb = document.querySelector('.sn-volume-thumb') as HTMLElement;

    // The visible track runs from 7px to 93px. The ends of the track are the
    // ends of the range, not a jump to 0 or 100 somewhere inside it.
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: point(0) });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    expect(volumeValue()).toHaveTextContent('0%');

    fireEvent.pointerMove(slider, { pointerId: 1, clientX: point(1) });
    expect(slider).toHaveAttribute('aria-valuenow', '1');
    expect(volumeValue()).toHaveTextContent('1%');

    fireEvent.pointerMove(slider, { pointerId: 1, clientX: point(50) });
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    expect(volumeValue()).toHaveTextContent('50%');

    fireEvent.pointerMove(slider, { pointerId: 1, clientX: point(99) });
    expect(slider).toHaveAttribute('aria-valuenow', '99');
    expect(volumeValue()).toHaveTextContent('99%');

    fireEvent.pointerMove(slider, { pointerId: 1, clientX: point(100) });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: point(100) });
    expect(volumeValue()).toHaveTextContent('100%');

    // The thumb's centre is at 7px at 0% and at width−7px at 100%; the CSS
    // correction is what keeps it inside the track instead of hanging over it.
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(thumb.style.left).toBe('calc(0% + 7.000px)');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(thumb.style.left).toBe('calc(100% - 7.000px)');
  });

  it('follows the dragged value in the readout before committing it', async () => {
    renderPlayer();
    const slider = await reachVolume();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(100));

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: point(25) });
    expect(volumeValue()).toHaveTextContent('25%');
    expect(slider).toHaveAttribute('aria-valuenow', '25');

    fireEvent.pointerMove(slider, { pointerId: 1, clientX: point(75) });
    expect(volumeValue()).toHaveTextContent('75%');
    expect(slider).toHaveAttribute('aria-valuenow', '75');

    // The readout never jumps: it is the same dragged value the slider speaks.
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: point(75) });
    expect(volumeValue()).toHaveTextContent('75%');
    expect(slider).toHaveAttribute('aria-valuenow', '75');
  });

  it('speaks the copy of the active locale', async () => {
    render(<Player adapter={createMockAdapter({ tracks })} engine={engine()} locale="ru" />);

    const slider = await screen.findByRole('slider', { name: 'Громкость' });
    expect(slider).toHaveAttribute('aria-valuetext', '100%');
    expect(screen.getByRole('button', { name: 'Выключить звук' })).toBeInTheDocument();
  });
});
