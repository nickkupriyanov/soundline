import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  createMockAdapter,
  createMockEngine,
  cx,
  type Track,
} from '@nickkupriyanov/soundline-core';
import { Player } from './Player';
import { DefaultSeekBar, DefaultTrackItem, DefaultTransport } from './parts';
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

/** The title of the track the now-playing row currently shows. */
function nowPlayingTitle(): string {
  return (document.querySelector('.sn-title') as HTMLElement).textContent ?? '';
}

describe('component replacement', () => {
  it('replaces the queue header without touching the list', async () => {
    renderPlayer({
      components: {
        Header: ({ label, countLabel, slotProps }) => (
          <p {...slotProps} data-testid="custom-header">
            {label} — {countLabel}
          </p>
        ),
      },
    });

    const header = await screen.findByTestId('custom-header');
    expect(header).toHaveTextContent('Playlist — 2 tracks');
    // The slot class rides along in the prepared props.
    expect(header).toHaveClass('sn-header');

    expect(await screen.findByRole('listbox', { name: 'Playlist' })).toBeInTheDocument();
  });

  it('replaces the artwork but still draws it inside the now-playing row', async () => {
    renderPlayer({
      components: {
        Artwork: ({ nowPlaying, slotProps }) => (
          <div {...slotProps} data-testid="custom-artwork">
            cover: {nowPlaying.title}
          </div>
        ),
      },
    });

    const artwork = await screen.findByTestId('custom-artwork');
    expect(artwork).toHaveClass('sn-artwork');
    expect(artwork).toHaveTextContent('cover: Alpha');

    // The row around it, and the labels beside it, are still the defaults.
    expect(document.querySelector('.sn-now-playing')).not.toBeNull();
    expect(screen.getByText('One', { selector: '.sn-artist' })).toBeInTheDocument();
    expect(document.querySelector('.sn-artwork img')).toBeNull();
  });

  it('hands the library artwork to a replaced now-playing row', async () => {
    renderPlayer({
      components: {
        NowPlaying: ({ nowPlaying, slotProps, children }) => (
          <div {...slotProps} data-testid="custom-now-playing">
            {children}
            <em>{nowPlaying.title}</em>
          </div>
        ),
      },
    });

    const row = await screen.findByTestId('custom-now-playing');
    expect(row).toHaveClass('sn-now-playing');
    expect(row.querySelector('.sn-artwork-fallback')).not.toBeNull();
    expect(screen.getByText('Alpha', { selector: 'em' })).toBeInTheDocument();
  });

  it('plays through a replaced transport', async () => {
    const user = userEvent.setup();
    const onPlay = vi.fn();

    renderPlayer({
      onPlay,
      components: {
        Transport: ({ transport, slotProps, onToggle }) => (
          <div {...slotProps} data-testid="custom-transport">
            <button type="button" onClick={onToggle}>
              {transport.playLabel}
            </button>
          </div>
        ),
      },
    });

    const play = await screen.findByRole('button', { name: 'Play' });
    expect(play.closest('[data-testid="custom-transport"]')).toHaveClass('sn-transport');

    await user.click(play);

    // The label follows the derived view, so the flow really started.
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(onPlay).toHaveBeenCalled();
  });

  it('keeps the playhead working when the seek bar is replaced', async () => {
    renderPlayer({
      components: {
        SeekBar: ({ progress, percent, slotProps }) => (
          <div {...slotProps} data-testid="custom-seek">
            <span data-testid="fill">{Math.round(percent)}</span>
            <span data-testid="label">{progress.durationLabel}</span>
          </div>
        ),
      },
    });

    const slider = await screen.findByRole('slider', { name: 'Playback position' });
    expect(screen.getByTestId('label')).toHaveTextContent('1:40');

    slider.focus();
    // A handled key is claimed: the page must not scroll under it.
    expect(fireEvent.keyDown(slider, { key: 'ArrowRight' })).toBe(false);

    expect(slider).toHaveAttribute('aria-valuenow', '5');
    expect(slider).toHaveAttribute('aria-valuetext', '0:05 of 1:40');
    expect(screen.getByTestId('fill')).toHaveTextContent('5');
    // The flow moved, not just the picture: the default readout agrees.
    expect(screen.getByText('0:05')).toBeInTheDocument();

    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
  });

  it('drags a replaced seek bar and commits on release', async () => {
    renderPlayer({
      components: {
        SeekBar: ({ percent, slotProps }) => (
          <div {...slotProps} data-testid="custom-seek">
            <span data-testid="fill">{Math.round(percent)}</span>
          </div>
        ),
      },
    });

    const slider = await screen.findByRole('slider', { name: 'Playback position' });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(100));

    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 25 });
    expect(slider).toHaveAttribute('data-sn-dragging', 'true');
    expect(slider).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByTestId('fill')).toHaveTextContent('25');
    // The playhead has not moved yet: the readout still shows the start.
    expect(screen.getByText('0:00')).toBeInTheDocument();

    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 60 });
    expect(slider).not.toHaveAttribute('data-sn-dragging');
    expect(slider).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByText('1:00')).toBeInTheDocument();
  });

  it('keeps the volume working when the control is replaced', async () => {
    const user = userEvent.setup();

    renderPlayer({
      components: {
        Volume: ({ percent, slotProps, buttonProps, sliderProps }) => (
          <div {...slotProps} data-testid="custom-volume">
            <button {...buttonProps}>{buttonProps['aria-label']}</button>
            <div {...sliderProps} />
            <span data-testid="level">{percent}</span>
          </div>
        ),
      },
    });

    const slider = await screen.findByRole('slider', { name: 'Volume' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    expect(slider).toHaveAttribute('aria-valuetext', '0%');
    expect(screen.getByTestId('level')).toHaveTextContent('0');

    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(slider).toHaveAttribute('aria-valuenow', '5');

    // The prepared button speaks the state the flow is in.
    expect(screen.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Mute' }));
    expect(screen.getByRole('button', { name: 'Unmute' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the queue a working listbox when its frame is replaced', async () => {
    const user = userEvent.setup();

    renderPlayer({
      components: {
        Queue: ({ slotProps, header, children }) => (
          <section {...slotProps} data-testid="custom-queue">
            {header}
            {children}
          </section>
        ),
      },
    });

    const frame = await screen.findByTestId('custom-queue');
    expect(frame).toHaveClass('sn-queue');

    const beta = within(frame).getByRole('option', { name: '2. Beta' });
    beta.focus();
    fireEvent.keyDown(beta, { key: 'Enter' });

    expect(nowPlayingTitle()).toBe('Beta');
    expect(within(frame).getByRole('option', { name: '2. Beta' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(within(frame).getByRole('option', { name: '1. Alpha' }));
    expect(nowPlayingTitle()).toBe('Alpha');
  });

  it('keeps selection, removal and the arrow keys with a replaced row', async () => {
    const user = userEvent.setup();

    renderPlayer({
      components: {
        TrackItem: ({ item, slotProps, removeProps }) => (
          <li
            {...slotProps}
            data-testid={`row-${item.id}`}
            className={`${slotProps.className} mine`}
          >
            <span>
              {item.position}. {item.title}
            </span>
            <button {...removeProps} data-testid={`remove-${item.id}`}>
              ×
            </button>
          </li>
        ),
      },
    });

    const alpha = await screen.findByTestId('row-a');
    const beta = screen.getByTestId('row-b');

    expect(alpha).toHaveClass('sn-track-item', 'mine');
    expect(alpha).toHaveAttribute('aria-selected', 'true');

    // Exactly one row is in the tab order, and the arrow keys move it.
    expect(alpha).toHaveAttribute('tabindex', '0');
    expect(beta).toHaveAttribute('tabindex', '-1');

    alpha.focus();
    fireEvent.keyDown(alpha, { key: 'ArrowDown' });
    expect(beta).toHaveFocus();
    expect(beta).toHaveAttribute('tabindex', '0');
    expect(alpha).toHaveAttribute('tabindex', '-1');

    // Removing is deliberately not a selection: the prepared button stops it.
    await user.click(screen.getByTestId('remove-b'));
    expect(screen.queryByTestId('row-b')).toBeNull();
    expect(nowPlayingTitle()).toBe('Alpha');
  });

  it('replaces the error state and keeps retry wired', async () => {
    const user = userEvent.setup();
    // A track without a source, so the adapter is asked for one — and fails.
    const sourced: Track[] = [{ id: 'a', title: 'Alpha', duration: TRACK_DURATION }];
    const adapter = createMockAdapter({
      tracks: sourced,
      sourceFailures: { a: 'SOURCE_UNAVAILABLE' },
    });
    const resolveSource = vi.spyOn(adapter, 'resolveSource');

    render(
      <Player
        adapter={adapter}
        engine={engine()}
        locale="en"
        components={{
          Error: ({ title, message, retryLabel, onRetry }) => (
            <div data-testid="custom-error">
              <strong>{title}</strong>
              <span>{message}</span>
              <button type="button" onClick={onRetry}>
                {retryLabel}
              </button>
            </div>
          ),
        }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Play' }));

    const error = await screen.findByTestId('custom-error');
    expect(error).toHaveTextContent('Playback error');
    expect(resolveSource).toHaveBeenCalledTimes(1);

    await user.click(within(error).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(resolveSource.mock.calls.length).toBeGreaterThan(1));
  });
});

describe('classes and parts together', () => {
  it('merges the consumer class into the props of a replaced part', async () => {
    renderPlayer({
      classNames: { transport: 'my-transport', trackItem: 'my-row' },
      components: {
        Transport: ({ transport, slotProps, onToggle }) => (
          <div {...slotProps} data-testid="custom-transport">
            <button type="button" onClick={onToggle}>
              {transport.playLabel}
            </button>
          </div>
        ),
      },
    });

    expect(await screen.findByTestId('custom-transport')).toHaveClass(
      'sn-transport',
      'my-transport',
    );
    // The part nobody replaced keeps its own class *and* the consumer's.
    expect(screen.getByRole('option', { name: '1. Alpha' })).toHaveClass('sn-track-item', 'my-row');
  });

  it('isolates two widgets on one page', async () => {
    const user = userEvent.setup();
    const other: Track[] = [{ id: 'z', title: 'Zeta', src: 'z.mp3', duration: TRACK_DURATION }];

    const { container } = render(
      <>
        <Player
          adapter={createMockAdapter({ tracks })}
          engine={engine()}
          locale="en"
          components={{ Header: () => <p data-testid="replaced-header">replaced</p> }}
        />
        <Player adapter={createMockAdapter({ tracks: other })} engine={engine()} locale="en" />
      </>,
    );

    await screen.findByTestId('replaced-header');

    const roots = container.querySelectorAll<HTMLElement>('.sn-root');
    const [first, second] = [roots[0] as HTMLElement, roots[1] as HTMLElement];

    // Only the first widget lost its header; both kept their own list.
    expect(document.querySelectorAll('.sn-header')).toHaveLength(1);
    expect(within(first).getAllByRole('option')).toHaveLength(2);
    expect(within(second).getAllByRole('option')).toHaveLength(1);

    // And their data stay apart: selecting in one leaves the other alone.
    await user.click(within(second).getByRole('option', { name: '1. Zeta' }));

    expect(within(second).getByText('Zeta', { selector: '.sn-title' })).toBeInTheDocument();
    expect(within(first).getByText('Alpha', { selector: '.sn-title' })).toBeInTheDocument();
  });
});

describe('default parts', () => {
  it('can be wrapped instead of re-implemented', async () => {
    renderPlayer({
      components: {
        Transport: (props) => (
          <div className="wrapped">
            <DefaultTransport {...props} />
          </div>
        ),
        SeekBar: (props) => (
          <div className="wrapped-seek">
            <DefaultSeekBar {...props} />
          </div>
        ),
        // A default is a component like any other: it can be re-fed prepared
        // props with one of them adjusted.
        TrackItem: ({ removeProps, ...props }) => (
          <DefaultTrackItem
            {...props}
            removeProps={{ ...removeProps, className: cx(removeProps.className, 'always-on') }}
          />
        ),
      },
    });

    expect(await screen.findByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(await screen.findByRole('slider', { name: 'Playback position' })).toBeInTheDocument();

    expect(document.querySelector('.wrapped .sn-transport')).not.toBeNull();
    expect(document.querySelector('.wrapped-seek .sn-seek')).not.toBeNull();
    expect(document.querySelector('.sn-track-remove.always-on')).not.toBeNull();
  });
});
