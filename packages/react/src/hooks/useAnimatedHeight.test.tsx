import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REDUCED_MOTION_QUERY } from '@nickkupriyanov/soundline-core/dom';
import { ANIMATED_HEIGHT_DURATION, useAnimatedHeight } from './useAnimatedHeight';

/** The height every element reports, so a test can "resize" the content. */
let contentHeight = 100;
/** The callback `ResizeObserver` was constructed with, for the test to fire. */
let trigger: (() => void) | null = null;

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

/** The height probe: core's answer, surfaced as data attributes. */
function Probe() {
  const { ref, height, animating, durationMs } = useAnimatedHeight(120);

  return (
    <div
      data-testid="box"
      data-animating={String(animating)}
      data-height={height === undefined ? 'none' : String(height)}
      data-duration={durationMs}
    >
      <div data-testid="inner" ref={ref} />
    </div>
  );
}

/** Fires a resize and lets React act on it. */
function resizeTo(height: number): void {
  contentHeight = height;
  act(() => trigger?.());
}

function box(): HTMLElement {
  return screen.getByTestId('box');
}

beforeEach(() => {
  vi.useFakeTimers();
  contentHeight = 100;
  trigger = null;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() =>
    rect(contentHeight),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useAnimatedHeight', () => {
  it('reports the content height and only clips while it changes', () => {
    render(<Probe />);
    expect(box()).toHaveAttribute('data-animating', 'false');
    expect(box()).toHaveAttribute('data-height', '100');
    expect(box()).toHaveAttribute('data-duration', '120');

    resizeTo(160);
    expect(box()).toHaveAttribute('data-animating', 'true');
    expect(box()).toHaveAttribute('data-height', '160');

    act(() => vi.advanceTimersByTime(120));
    expect(box()).toHaveAttribute('data-animating', 'false');
    expect(box()).toHaveAttribute('data-height', '160');
  });

  it('measures nothing at all when the OS asks for reduced motion', () => {
    stubReducedMotion(true);
    render(<Probe />);

    expect(box()).toHaveAttribute('data-animating', 'false');
    expect(box()).toHaveAttribute('data-height', 'none');
    // Nothing was observed, so there is no transition to clip for.
    expect(trigger).toBeNull();
  });

  it('stops observing when the widget goes away', () => {
    const { unmount } = render(<Probe />);
    expect(trigger).not.toBeNull();

    unmount();
    expect(trigger).toBeNull();
  });

  it('ships a default duration a binding can rely on', () => {
    expect(ANIMATED_HEIGHT_DURATION).toBe(320);
  });
});
