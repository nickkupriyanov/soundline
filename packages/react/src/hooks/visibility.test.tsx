/**
 * `pauseWhenHidden`, as tests.
 *
 * A phone locking the screen or a tab going to the background fires
 * `visibilitychange`; the binding decides whether that means "stop" — core never
 * listens to the document. The event itself is what this suite drives, because
 * the claim under test is the *reaction*, not the subscription.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockAdapter, createMockEngine, type Track } from '@nickkupriyanov/soundline-core';
import { PlayerProvider } from '../Player';
import { PlayerView } from '../components/PlayerView';
import { usePlayerContext } from '../context';

const tracks: Track[] = [
  { id: 'a', title: 'Alpha', artist: 'One', src: 'a.mp3', duration: 120 },
  { id: 'b', title: 'Beta', artist: 'Two', src: 'b.mp3', duration: 120 },
];

/** `visibilityState`/`hidden` are read-only in `jsdom`; own properties make them writable. */
function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
}

afterEach(() => {
  delete (document as unknown as Record<string, unknown>).visibilityState;
  delete (document as unknown as Record<string, unknown>).hidden;
});

/** Reports the tab going to the background (or coming back). */
function visibilitychange(state: DocumentVisibilityState): void {
  setVisibility(state);
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

function Probe() {
  const { snapshot } = usePlayerContext();
  return <span data-testid="playing">{String(snapshot.state.playing)}</span>;
}

function Harness({ pauseWhenHidden }: { pauseWhenHidden?: boolean }) {
  return (
    <PlayerProvider
      adapter={createMockAdapter({ tracks })}
      engine={createMockEngine({ duration: 120, tickMs: 60_000 })}
      pauseWhenHidden={pauseWhenHidden}
    >
      <PlayerView />
      <Probe />
    </PlayerProvider>
  );
}

/** Starts playback through the widget's own button, so the flow is the real one. */
async function startPlaying(): Promise<void> {
  const user = userEvent.setup();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: 'Play' }));
  await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('true'));
}

describe('pauseWhenHidden', () => {
  it('pauses when the document becomes hidden and the application asked for it', async () => {
    render(<Harness pauseWhenHidden />);
    await startPlaying();

    visibilitychange('hidden');

    await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('false'));
  });

  it('keeps playing when the default applies', async () => {
    render(<Harness />);
    await startPlaying();

    visibilitychange('hidden');

    expect(screen.getByTestId('playing')).toHaveTextContent('true');
  });

  it('does not resume on its own when the document comes back', async () => {
    render(<Harness pauseWhenHidden />);
    await startPlaying();

    visibilitychange('hidden');
    await waitFor(() => expect(screen.getByTestId('playing')).toHaveTextContent('false'));

    visibilitychange('visible');

    expect(screen.getByTestId('playing')).toHaveTextContent('false');
  });
});
