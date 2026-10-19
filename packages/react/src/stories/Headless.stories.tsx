import { useMemo, type CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  PlayerProvider,
  createMockAdapter,
  createMockEngine,
  usePlayerContext,
  useUI,
} from '../index';
import { DEMO_DURATION, demoTracks } from './demo';

/**
 * The widget owns no data.
 *
 * `usePlayerContext()` exposes the same snapshot and actions the built-in UI
 * renders, so a fully custom front end is a few dozen lines — and it shows
 * exactly what the shipped widget shows.
 */
function CustomPanel() {
  const { snapshot, actions } = usePlayerContext();
  const ui = useUI();
  const view = snapshot.view;

  const chip: CSSProperties = {
    padding: '8px 12px',
    fontSize: 13,
    color: 'inherit',
    background: 'var(--sn-control)',
    border: '1px solid var(--sn-border)',
    borderRadius: 10,
    cursor: 'pointer',
  };

  const activeChip: CSSProperties = {
    ...chip,
    color: 'var(--sn-accent-contrast)',
    background: 'var(--sn-accent)',
    borderColor: 'transparent',
  };

  return (
    <div
      style={{
        width: 420,
        boxSizing: 'border-box',
        padding: 20,
        color: 'var(--sn-text)',
        background: 'var(--sn-surface)',
        border: '1px solid var(--sn-border)',
        borderRadius: 'var(--sn-radius-card)',
        fontFamily: 'inherit',
      }}
    >
      <p style={{ margin: '0 0 4px', fontSize: 12, opacity: 0.6 }}>{ui.messages.playerLabel}</p>

      {view.error ? (
        <p style={{ margin: '0 0 16px', fontSize: 14 }}>{view.errorMessage}</p>
      ) : view.loading ? (
        <p style={{ margin: '0 0 16px', fontSize: 14 }}>{ui.messages.loadingLabel}</p>
      ) : view.empty ? (
        <p style={{ margin: '0 0 16px', fontSize: 14 }}>{ui.messages.emptyLabel}</p>
      ) : (
        <>
          <strong style={{ fontSize: 17 }}>{view.nowPlaying?.title ?? '—'}</strong>
          <p style={{ margin: '2px 0 14px', fontSize: 13, opacity: 0.7 }}>
            {view.nowPlaying?.subtitle ?? ''}
          </p>

          <div
            aria-hidden="true"
            style={{
              height: 6,
              marginBottom: 6,
              overflow: 'hidden',
              background: 'var(--sn-control)',
              borderRadius: 999,
            }}
          >
            <div
              style={{
                width: `${view.progress.percent}%`,
                height: '100%',
                background: 'var(--sn-accent)',
              }}
            />
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 12, opacity: 0.6 }}>
            {view.progress.positionLabel} / {view.progress.durationLabel}
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <button
              type="button"
              style={activeChip}
              disabled={!view.transport.canPlay}
              onClick={actions.toggle}
            >
              {view.transport.playing ? ui.messages.pauseLabel : ui.messages.playLabel}
            </button>
            <button
              type="button"
              style={chip}
              disabled={!view.transport.canPrev}
              onClick={actions.previous}
            >
              {view.transport.previousLabel}
            </button>
            <button
              type="button"
              style={chip}
              disabled={!view.transport.canNext}
              onClick={actions.next}
            >
              {view.transport.nextLabel}
            </button>
          </div>
        </>
      )}

      {view.queue.items.length > 0 ? (
        <>
          <p style={{ margin: '0 0 8px', fontSize: 12, opacity: 0.6 }}>{view.queue.label}</p>
          <ol
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              margin: 0,
              padding: 0,
              listStyle: 'none',
            }}
          >
            {view.queue.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={item.isActive ? 'true' : undefined}
                  onClick={() => actions.selectTrack(item.id)}
                  style={{
                    ...chip,
                    width: '100%',
                    textAlign: 'left',
                    ...(item.isActive ? activeChip : {}),
                  }}
                >
                  {item.position}. {item.title}
                  {item.artist ? <span style={{ opacity: 0.7 }}> — {item.artist}</span> : null}
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}

function HeadlessDemo() {
  const adapter = useMemo(() => createMockAdapter({ tracks: demoTracks }), []);
  const engine = useMemo(() => createMockEngine({ duration: DEMO_DURATION, tickMs: 250 }), []);

  return (
    <PlayerProvider adapter={adapter} engine={engine} theme="dark" locale="en">
      <CustomPanel />
    </PlayerProvider>
  );
}

const meta: Meta<typeof HeadlessDemo> = {
  title: 'Headless/Custom UI',
  component: HeadlessDemo,
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          'Build your own front end on the same controller: `usePlayerContext()` returns one snapshot and the actions, and everything drawn here comes from `snapshot.view` — the labels, the percentages and the availability flags all included.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const CustomUi: Story = {};
