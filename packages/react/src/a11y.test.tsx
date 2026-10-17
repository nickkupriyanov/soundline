/**
 * The accessibility promises that are about motion.
 *
 * The animation layer must never *require* a visitor to tolerate movement: the
 * height container clips content only while a transition is in flight, and under
 * `prefers-reduced-motion: reduce` nothing is measured or clipped at all — the
 * content simply takes its natural height. That is what this file checks. The
 * full role/name/state audit and the axe pass belong to Iteration 11.
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAdapter, createMockEngine, type Track } from '@nickkupriyanov/soundline-core';
import { REDUCED_MOTION_QUERY } from '@nickkupriyanov/soundline-core/dom';
import { Player } from './Player';

const TRACK_DURATION = 100;

const tracks: Track[] = [
  { id: 'a', title: 'Alpha', artist: 'One', src: 'a.mp3', duration: TRACK_DURATION },
  { id: 'b', title: 'Beta', artist: 'Two', src: 'b.mp3', duration: TRACK_DURATION },
];

/* -- a host whose content can "resize" and whose OS settings can change ------ */

/** The height every element reports, so a test can make the content grow. */
let contentHeight = 100;
/** The callback `ResizeObserver` was constructed with, for the test to fire. */
let trigger: (() => void) | null = null;
/** Whether the OS currently asks for reduced motion. */
let reduced = false;
const mediaListeners = new Set<(event: { matches: boolean }) => void>();

class FakeResizeObserver {
  constructor(callback: () => void) {
    trigger = callback;
  }
  observe() {}
  disconnect() {
    trigger = null;
  }
}

function rect(height: number): DOMRect {
  return {
    width: 400,
    height,
    top: 0,
    left: 0,
    right: 400,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function stubMatchMedia(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return reduced && query === REDUCED_MOTION_QUERY;
        },
        media: query,
        onchange: null,
        addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
          mediaListeners.add(listener);
        },
        removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
          mediaListeners.delete(listener);
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

/** Turns the OS setting over while the widget is open, as the browser would. */
function setReducedMotion(value: boolean): void {
  reduced = value;
  act(() => {
    for (const listener of mediaListeners) listener({ matches: value });
  });
}

function resizeContentTo(height: number): void {
  contentHeight = height;
  act(() => trigger?.());
}

function heightBox(): HTMLElement {
  return document.querySelector('.sn-height') as HTMLElement;
}

function renderPlayer() {
  return render(
    <Player
      adapter={createMockAdapter({ tracks })}
      engine={createMockEngine({ tickMs: 60_000 })}
      locale="en"
    />,
  );
}

beforeEach(() => {
  contentHeight = 100;
  trigger = null;
  reduced = false;
  mediaListeners.clear();
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() =>
    rect(contentHeight),
  );
  stubMatchMedia();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('motion and accessibility', () => {
  it('clips the card content only while the height is changing', async () => {
    renderPlayer();
    await screen.findByRole('listbox', { name: 'Playlist' });

    const box = heightBox();
    expect(box).not.toHaveAttribute('data-sn-animating');

    resizeContentTo(180);
    expect(box).toHaveAttribute('data-sn-animating', 'true');
  });

  it('measures nothing at all when the OS asks for reduced motion', async () => {
    reduced = true;
    renderPlayer();
    await screen.findByRole('listbox', { name: 'Playlist' });

    // The widget is fully there; only the animation is gone.
    expect(screen.getByRole('region', { name: 'Audio player' })).toBeInTheDocument();
    expect(trigger).toBeNull();
    expect(heightBox()).not.toHaveAttribute('data-sn-animating');

    resizeContentTo(180);
    expect(heightBox()).not.toHaveAttribute('data-sn-animating');
  });

  it('stops clipping the moment the OS setting changes', async () => {
    renderPlayer();
    await screen.findByRole('listbox', { name: 'Playlist' });

    resizeContentTo(180);
    expect(heightBox()).toHaveAttribute('data-sn-animating', 'true');

    // The visitor turns animations off without reloading the page.
    setReducedMotion(true);
    expect(heightBox()).not.toHaveAttribute('data-sn-animating');

    resizeContentTo(260);
    expect(heightBox()).not.toHaveAttribute('data-sn-animating');
  });
});
