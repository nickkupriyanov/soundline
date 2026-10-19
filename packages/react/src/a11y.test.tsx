/**
 * The accessibility contract of the widget, as tests.
 *
 * Three groups, because "accessible" here is three different claims:
 *
 * 1. **Motion.** The animation layer must never *require* a visitor to tolerate
 *    movement: the height container clips content only while a transition is in
 *    flight, and under `prefers-reduced-motion: reduce` nothing is measured or
 *    clipped at all — the content simply takes its natural height.
 * 2. **Announcements, roles, names and states.** What a screen reader is told and
 *    by which role, name and state: the wording of the live region, the
 *    play/pause name swap, `aria-pressed` on the toggles, the two sibling buttons
 *    of a queue row, and the keyboard walk that reaches every control and leaves
 *    again.
 * 3. **axe.** One automated pass per state the widget can be in, so a regression
 *    in roles, names or relationships fails here instead of in production.
 *
 * What no test here can say anything about is contrast (`jsdom` applies no
 * stylesheet, so axe's colour rules are off as well) and what a screen reader
 * actually speaks. The palette is a documented known limit rather than a checked
 * guarantee; the announcement rules are asserted on the region's text rather than
 * trusted to axe.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAdapter, createMockEngine, type Track } from '@nickkupriyanov/soundline-core';
import { REDUCED_MOTION_QUERY } from '@nickkupriyanov/soundline-core/dom';
import { Player } from './Player';
import { expectNoA11yViolations } from './test/a11y';
import type { SoundlineProps } from './types';

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

/**
 * The widget in its usual state: two tracks, a playhead that never ticks by
 * itself, English copy — plus whatever the caller needs instead.
 */
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

/** The labelled region every part of the widget renders inside. */
function card(): HTMLElement {
  return screen.getByRole('region', { name: 'Audio player' });
}

/** The playing order, as the visitor sees it. */
function playlist(): Promise<HTMLElement> {
  return screen.findByRole('list', { name: 'Playlist' });
}

/** The polite region that carries the announcements. */
function live(): HTMLElement {
  return screen.getByRole('status');
}

/** The widget's own state flag, which the tests below use to wait for a state. */
function renderedState(): string | null {
  return document.querySelector('.sn-root')?.getAttribute('data-sn-state') ?? null;
}

/** The name the tests expect a visitor to hear for whatever is focused. */
function spokenName(element: Element | null): string {
  if (element === null) return '<none>';
  const label = element.getAttribute('aria-label');
  if (label) return label;
  const text = element.textContent?.trim() ?? '';
  return text.length > 0 ? text : element.tagName.toLowerCase();
}

/** Tabs until the named control has the focus, so a walk is never counted by hand. */
async function tabUntil(user: UserEvent, name: string): Promise<void> {
  for (let step = 0; step < 20; step += 1) {
    await user.tab();
    if (spokenName(document.activeElement) === name) return;
  }
  throw new Error(`the tab walk never reached "${name}"`);
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
    await playlist();

    const box = heightBox();
    expect(box).not.toHaveAttribute('data-sn-animating');

    resizeContentTo(180);
    expect(box).toHaveAttribute('data-sn-animating', 'true');
  });

  it('measures nothing at all when the OS asks for reduced motion', async () => {
    reduced = true;
    renderPlayer();
    await playlist();

    // The widget is fully there; only the animation is gone.
    expect(card()).toBeInTheDocument();
    expect(trigger).toBeNull();
    expect(heightBox()).not.toHaveAttribute('data-sn-animating');

    resizeContentTo(180);
    expect(heightBox()).not.toHaveAttribute('data-sn-animating');
  });

  it('stops clipping the moment the OS setting changes', async () => {
    renderPlayer();
    await playlist();

    resizeContentTo(180);
    expect(heightBox()).toHaveAttribute('data-sn-animating', 'true');

    // The visitor turns animations off without reloading the page.
    setReducedMotion(true);
    expect(heightBox()).not.toHaveAttribute('data-sn-animating');

    resizeContentTo(260);
    expect(heightBox()).not.toHaveAttribute('data-sn-animating');
  });
});

describe('the live region', () => {
  it('names the track from the moment the playlist is there', async () => {
    renderPlayer();
    await playlist();

    expect(live()).toHaveAttribute('aria-live', 'polite');
    expect(live()).toHaveTextContent('Now playing: Alpha');
  });

  it('never claims a pause before playback has started', async () => {
    renderPlayer();
    await playlist();

    // `idle` is the engine before the first `play`: "Paused: Alpha" here would
    // announce something the visitor never did.
    expect(live()).not.toHaveTextContent('Paused');
  });

  it('names the new track when the visitor moves on', async () => {
    renderPlayer();
    await playlist();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Play' }));
    await user.click(screen.getByRole('button', { name: 'Next track' }));

    expect(live()).toHaveTextContent('Now playing: Beta');
  });

  it('names the track again, in the paused wording, when playback stops', async () => {
    renderPlayer();
    await playlist();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Play' }));
    await user.click(screen.getByRole('button', { name: 'Pause' }));

    await waitFor(() => expect(live()).toHaveTextContent('Paused: Alpha'));
  });

  it('says when the playlist ran out', async () => {
    renderPlayer({
      engine: createMockEngine({ duration: 0.05, tickMs: 1 }),
      defaultPlaying: true,
    });

    await waitFor(() => expect(live()).toHaveTextContent('End of playlist'));
  });

  it('says what went wrong instead of repeating the track', async () => {
    renderPlayer({ engine: createMockEngine({ failures: { 'a.mp3': 'SOURCE_UNAVAILABLE' } }) });
    await screen.findByRole('button', { name: 'Try again' });

    expect(live()).toHaveTextContent('The track could not be loaded');
  });

  it('says when the track list itself could not be fetched', async () => {
    renderPlayer({ adapter: createMockAdapter({ tracks, failure: 'NETWORK_FAILURE' }) });
    await waitFor(() => expect(renderedState()).toBe('error'));

    // Not "loading tracks…" forever with an empty list: the failure is the state.
    expect(live()).toHaveTextContent('The playlist could not be loaded');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('roles, names and states', () => {
  it('keeps every control inside one labelled region', async () => {
    renderPlayer();
    const list = await playlist();
    const region = card();

    for (const control of [
      list,
      screen.getByRole('slider', { name: 'Playback position' }),
      screen.getByRole('slider', { name: 'Volume' }),
      screen.getByRole('button', { name: 'Play' }),
      screen.getByRole('button', { name: 'Mute' }),
    ]) {
      expect(region.contains(control)).toBe(true);
    }
  });

  it('gives both sliders a value in words, not only in numbers', async () => {
    renderPlayer();

    const seek = await screen.findByRole('slider', { name: 'Playback position' });
    expect(seek).toHaveAttribute('aria-valuemin', '0');
    expect(seek).toHaveAttribute('aria-valuemax', '100');
    expect(seek).toHaveAttribute('aria-valuetext', '0:00 of 1:40');

    const volume = screen.getByRole('slider', { name: 'Volume' });
    expect(volume).toHaveAttribute('aria-valuenow', '100');
    expect(volume).toHaveAttribute('aria-valuetext', '100%');
  });

  it('renames the play button instead of pressing it', async () => {
    renderPlayer();
    await playlist();
    const user = userEvent.setup();

    const play = screen.getByRole('button', { name: 'Play' });
    expect(play).not.toHaveAttribute('aria-pressed');

    await user.click(play);

    const pause = screen.getByRole('button', { name: 'Pause' });
    // The same element, renamed: "Pause, pressed" is not a state worth hearing.
    expect(pause).toBe(play);
    expect(pause).not.toHaveAttribute('aria-pressed');
  });

  it('presses the shuffle toggle and says so', async () => {
    renderPlayer();
    await playlist();
    const user = userEvent.setup();

    const shuffle = screen.getByRole('button', { name: 'Shuffle' });
    expect(shuffle).toHaveAttribute('aria-pressed', 'false');

    await user.click(shuffle);
    expect(shuffle).toHaveAttribute('aria-pressed', 'true');
  });

  it('walks the repeat toggle through its modes, named and pressed', async () => {
    renderPlayer();
    await playlist();
    const user = userEvent.setup();

    const off = screen.getByRole('button', { name: 'Repeat off' });
    expect(off).toHaveAttribute('aria-pressed', 'false');

    await user.click(off);
    const all = screen.getByRole('button', { name: 'Repeat playlist' });
    expect(all).toHaveAttribute('aria-pressed', 'true');

    await user.click(all);
    const one = screen.getByRole('button', { name: 'Repeat track' });
    expect(one).toHaveAttribute('aria-pressed', 'true');

    await user.click(one);
    expect(screen.getByRole('button', { name: 'Repeat off' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('mutes as a pressed toggle, with the name the action will undo', async () => {
    renderPlayer();
    await playlist();
    const user = userEvent.setup();

    const mute = screen.getByRole('button', { name: 'Mute' });
    expect(mute).toHaveAttribute('aria-pressed', 'false');

    await user.click(mute);
    expect(screen.getByRole('button', { name: 'Unmute' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks the current row and names the row and its remove button', async () => {
    renderPlayer();
    const list = await playlist();

    const alpha = within(list).getByRole('button', { name: '1. Alpha' });
    const beta = within(list).getByRole('button', { name: '2. Beta' });
    expect(alpha).toHaveAttribute('aria-current', 'true');
    expect(beta).not.toHaveAttribute('aria-current');
    expect(within(list).getByRole('button', { name: 'Remove Alpha' })).toBeInTheDocument();

    // One row in the tab order at a time: the roving tabindex that makes the
    // arrow keys the way through the list.
    expect(alpha).toHaveAttribute('tabindex', '0');
    expect(beta).toHaveAttribute('tabindex', '-1');

    // Two buttons, neither inside the other.
    expect(alpha.querySelector('button')).toBeNull();
  });

  it('takes the focus back when a track change leaves it nowhere', async () => {
    renderPlayer();
    await playlist();
    const user = userEvent.setup();

    // The visitor is on a control that the next state unmounts.
    const seek = screen.getByRole('slider', { name: 'Playback position' });
    act(() => seek.focus());
    expect(document.activeElement).toBe(seek);

    await user.click(screen.getByRole('button', { name: 'Next track' }));

    // The playhead is remounted with the new track, and the focus is inside the
    // widget rather than on `<body>`.
    expect(card().contains(document.activeElement)).toBe(true);
  });

  it('never steals a focus that is somewhere else on the page', async () => {
    // The track changes on its own — the engine reaches the end and the flow
    // moves on — so the focus is never moved by a click.
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Outside</button>
        <Player
          adapter={createMockAdapter({ tracks })}
          engine={createMockEngine({ duration: 0.05, tickMs: 1 })}
          locale="en"
        />
      </>,
    );
    await playlist();
    const outside = screen.getByRole('button', { name: 'Outside' });
    act(() => outside.focus());

    await user.click(screen.getByRole('button', { name: 'Play' }));
    act(() => outside.focus());
    await waitFor(() => expect(live()).toHaveTextContent('Now playing: Beta'));

    expect(document.activeElement).toBe(outside);
  });
});

describe('the keyboard', () => {
  it('reaches every control in order and leaves the widget again', async () => {
    render(
      <div>
        <button type="button">Before</button>
        <Player
          adapter={createMockAdapter({ tracks })}
          engine={createMockEngine({ tickMs: 60_000 })}
          locale="en"
        />
        <button type="button">After</button>
      </div>,
    );
    await playlist();
    const user = userEvent.setup();

    const visited: string[] = [];
    for (let step = 0; step < 20; step += 1) {
      await user.tab();
      const name = spokenName(document.activeElement);
      visited.push(name);
      if (name === 'After') break;
    }

    // One entry per tab stop: nothing skipped, nothing focusable twice, and the
    // queue contributes one row plus the buttons inside it.
    expect(visited).toEqual([
      'Before',
      'Playback position',
      'Shuffle',
      'Previous track',
      'Play',
      'Next track',
      'Repeat off',
      'Mute',
      'Volume',
      '1. Alpha',
      'Remove Alpha',
      'Remove Beta',
      'After',
    ]);

    // …and the walk runs the same way back: no trap in either direction.
    await user.tab({ shift: true });
    expect(spokenName(document.activeElement)).toBe('Remove Beta');
  });

  it('moves the playhead with the arrows without moving the focus', async () => {
    renderPlayer();
    const seek = await screen.findByRole('slider', { name: 'Playback position' });
    const user = userEvent.setup();

    await user.click(seek);
    await user.keyboard('{ArrowRight}');

    await waitFor(() => expect(seek).toHaveAttribute('aria-valuenow', '5'));
    expect(document.activeElement).toBe(seek);
  });

  it('walks the queue rows with the arrows without leaving the list', async () => {
    renderPlayer();
    const list = await playlist();
    const user = userEvent.setup();

    await tabUntil(user, '1. Alpha');
    expect(document.activeElement).toBe(within(list).getByRole('button', { name: '1. Alpha' }));

    await user.keyboard('{ArrowDown}');
    expect(spokenName(document.activeElement)).toBe('2. Beta');
    expect(list.contains(document.activeElement)).toBe(true);

    await user.keyboard('{End}');
    expect(spokenName(document.activeElement)).toBe('2. Beta');
    await user.keyboard('{Home}');
    expect(spokenName(document.activeElement)).toBe('1. Alpha');
    expect(list.contains(document.activeElement)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  axe                                                                        */
/* -------------------------------------------------------------------------- */

interface StateCase {
  /** What the state is, in the words of the report. */
  name: string;
  /** Renders it. */
  renderCase(): ReturnType<typeof renderPlayer>;
  /** Waits until the widget is really in that state. */
  settled?(): Promise<unknown>;
}

/** Plays a track and pauses it again: the state a visitor sees most often. */
async function playThenPause(): Promise<void> {
  const user = userEvent.setup();
  await playlist();
  await user.click(screen.getByRole('button', { name: 'Play' }));
  await user.click(screen.getByRole('button', { name: 'Pause' }));
  await waitFor(() => expect(live()).toHaveTextContent('Paused: Alpha'));
}

const stateCases: StateCase[] = [
  {
    name: 'idle playlist, nothing played yet',
    renderCase: () => renderPlayer(),
    settled: () => playlist(),
  },
  {
    name: 'playing',
    renderCase: () => renderPlayer({ defaultPlaying: true }),
    settled: () => screen.findByRole('button', { name: 'Pause' }),
  },
  {
    name: 'paused after playback',
    renderCase: () => renderPlayer(),
    settled: playThenPause,
  },
  {
    name: 'end of the playlist',
    renderCase: () =>
      renderPlayer({
        engine: createMockEngine({ duration: 0.05, tickMs: 1 }),
        defaultPlaying: true,
      }),
    settled: () => waitFor(() => expect(live()).toHaveTextContent('End of playlist')),
  },
  {
    name: 'loading the track list',
    renderCase: () => renderPlayer({ adapter: createMockAdapter({ tracks, latency: 60_000 }) }),
    settled: () => waitFor(() => expect(renderedState()).toBe('loading')),
  },
  {
    name: 'empty playlist',
    renderCase: () => renderPlayer({ adapter: createMockAdapter({ tracks: [] }) }),
    settled: () => waitFor(() => expect(renderedState()).toBe('empty')),
  },
  {
    name: 'track that failed to load',
    renderCase: () =>
      renderPlayer({ engine: createMockEngine({ failures: { 'a.mp3': 'SOURCE_UNAVAILABLE' } }) }),
    settled: () => waitFor(() => expect(renderedState()).toBe('error')),
  },
  {
    name: 'track list that failed to load',
    renderCase: () =>
      renderPlayer({ adapter: createMockAdapter({ tracks, failure: 'NETWORK_FAILURE' }) }),
    settled: () => waitFor(() => expect(renderedState()).toBe('error')),
  },
  {
    name: 'every toggle pressed',
    renderCase: () => renderPlayer(),
    async settled() {
      const user = userEvent.setup();
      await playlist();
      await user.click(screen.getByRole('button', { name: 'Mute' }));
      await user.click(screen.getByRole('button', { name: 'Shuffle' }));
      await user.click(screen.getByRole('button', { name: 'Repeat off' }));
    },
  },
  {
    name: 'light theme, Russian copy',
    renderCase: () => renderPlayer({ theme: 'light', locale: 'ru' }),
    settled: () => screen.findByRole('list', { name: 'Плейлист' }),
  },
  {
    name: 'compact layout without the queue',
    renderCase: () => renderPlayer({ layout: 'compact', showQueue: false }),
    settled: () => screen.findByRole('slider', { name: 'Playback position' }),
  },
];

describe('axe', () => {
  for (const state of stateCases) {
    it(`finds no violation in: ${state.name}`, async () => {
      const result = state.renderCase();
      await state.settled?.();

      await expectNoA11yViolations(result.container);
    });
  }
});
