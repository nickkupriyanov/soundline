import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createMockAdapter, createMockEngine, type Track } from '@nickkupriyanov/soundline-core';
import { Player, PlayerProvider } from './Player';
import { PlayerView } from './components/PlayerView';
import { usePlayerContext } from './context';

const tracks: Track[] = [
  { id: 'a', title: 'Alpha', artist: 'One', src: 'a.mp3', duration: 100 },
  { id: 'b', title: 'Beta', artist: 'Two', src: 'b.mp3', duration: 120 },
];

/**
 * A mock engine whose playhead does not tick during the test: the binding isn't
 * about the timeline, and a silent clock keeps every assertion deterministic.
 */
function mockEngine() {
  return createMockEngine({ tickMs: 60_000 });
}

describe('Player', () => {
  it('renders the card, the labelled region and the live region', () => {
    render(<Player adapter={createMockAdapter({ tracks })} engine={mockEngine()} locale="en" />);

    const region = screen.getByRole('region', { name: 'Audio player' });
    expect(region).toHaveClass('sn-card');

    const root = region.closest('.sn-root');
    expect(root).toHaveAttribute('data-sn-theme', 'dark');
    expect(root).toHaveAttribute('data-sn-layout', 'card');
    expect(root).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('status')).toHaveClass('sn-live');
  });

  it('applies the theme, layout and locale from the props', () => {
    render(
      <Player
        adapter={createMockAdapter({ tracks })}
        engine={mockEngine()}
        theme="light"
        layout="compact"
        locale="ru"
      />,
    );

    const region = screen.getByRole('region', { name: 'Аудиоплеер' });
    const root = region.closest('.sn-root');
    expect(root).toHaveAttribute('data-sn-theme', 'light');
    expect(root).toHaveAttribute('data-sn-layout', 'compact');
    expect(root).toHaveAttribute('lang', 'ru');
  });

  it('applies the browser locale after mounting', () => {
    render(<Player adapter={createMockAdapter({ tracks })} engine={mockEngine()} />);

    const root = screen.getByRole('region').closest('.sn-root');
    expect(root).toHaveAttribute('lang', navigator.language);
  });

  it('adds consumer classes alongside the library ones', async () => {
    render(
      <Player
        adapter={createMockAdapter({ tracks: [] })}
        engine={mockEngine()}
        classNames={{ empty: 'my-empty' }}
      />,
    );

    const label = await screen.findByText('There are no tracks in this playlist', {
      selector: '.sn-empty > span',
    });
    expect(label.closest('.sn-empty')).toHaveClass('sn-empty', 'my-empty');
  });

  it('lets an application replace a part', async () => {
    render(
      <Player
        adapter={createMockAdapter({ tracks: [] })}
        engine={mockEngine()}
        components={{ Empty: () => <p data-testid="custom-empty">nothing here</p> }}
      />,
    );

    expect(await screen.findByTestId('custom-empty')).toHaveTextContent('nothing here');
  });
});

/* -------------------------------------------------------------------------- */
/*  The flow, driven through the controller the provider owns                   */
/* -------------------------------------------------------------------------- */

function Probe() {
  const { snapshot, actions } = usePlayerContext();

  return (
    <div>
      <button type="button" onClick={() => actions.toggle()}>
        toggle
      </button>
      <button
        type="button"
        onClick={(event) => {
          // Drop focus first, so the assertion sees whether the widget reclaims it.
          event.currentTarget.blur();
          actions.next();
        }}
      >
        next
      </button>
      <span data-testid="status">{snapshot.state.status}</span>
      <span data-testid="track">{snapshot.state.currentTrackId ?? 'none'}</span>
      <span data-testid="playing">{String(snapshot.state.playing)}</span>
    </div>
  );
}

function Harness() {
  return (
    <PlayerProvider adapter={createMockAdapter({ tracks })} engine={mockEngine()}>
      <PlayerView />
      <Probe />
    </PlayerProvider>
  );
}

describe('Player flow', () => {
  it('plays and pauses the selected mock track', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId('track')).toHaveTextContent('a'));

    await user.click(screen.getByRole('button', { name: 'toggle' }));
    await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('true'));
    expect(screen.getByTestId('status')).toHaveTextContent('playing');

    await user.click(screen.getByRole('button', { name: 'toggle' }));
    await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('false'));
    expect(screen.getByTestId('status')).toHaveTextContent('paused');
  });

  it('moves to the next mock track', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId('track')).toHaveTextContent('a'));

    await user.click(screen.getByRole('button', { name: 'next' }));
    await waitFor(() => expect(screen.getByTestId('track')).toHaveTextContent('b'));
  });

  it('does not take the focus when a track change comes from outside the widget', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId('track')).toHaveTextContent('a'));

    // The change was asked for by a control outside the card. The focus was never
    // the widget's, so the card must not pull it — or the page — into itself.
    await user.click(screen.getByRole('button', { name: 'next' }));

    await waitFor(() => expect(screen.getByTestId('track')).toHaveTextContent('b'));
    const card = screen.getByRole('region', { name: 'Audio player' });
    expect(card).not.toHaveFocus();
    expect(card.contains(document.activeElement)).toBe(false);
  });
});
