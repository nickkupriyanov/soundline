import type { Meta, StoryObj } from '@storybook/react-vite';
import { createMockAdapter, type SoundlineTheme } from '../index';
import { DemoPlayer, demoTracks, demoTracksUnresolved } from './demo';

/**
 * Every state the widget can be in, reached the way a real application reaches
 * it: a slow track source, an empty one, a failing one, and the playback states
 * driven through the public actions.
 */
const meta: Meta<typeof DemoPlayer> = {
  title: 'States/Player',
  component: DemoPlayer,
  parameters: {
    docs: {
      description: {
        component:
          'A state here is not a drawing: each story hands the widget a different adapter or drives the engine, and what you see is the widget’s own output for that input.',
      },
    },
  },
  args: {
    adapter: createMockAdapter({ tracks: demoTracks }),
    locale: 'en',
    layout: 'card',
    state: 'idle',
  },
  argTypes: {
    adapter: { control: false },
    engine: { control: false },
    initialEngineRef: { control: false },
    components: { control: false },
    animations: { control: false },
    classNames: { control: false },
    messages: { control: false },
    onProgress: { control: false },
    onTrackChange: { control: false },
    onPlayingChange: { control: false },
    onVolumeChange: { control: false },
    onMutedChange: { control: false },
    onLoopChange: { control: false },
    onShuffleChange: { control: false },
    onRateChange: { control: false },
    onQueueChange: { control: false },
    onPlay: { control: false },
    onPause: { control: false },
    onEnded: { control: false },
    onError: { control: false },
    theme: { control: 'inline-radio', options: ['dark', 'light'] },
    locale: { control: 'inline-radio', options: ['en', 'ru'] },
    state: { control: false },
  },
  render: (args, context) => (
    <DemoPlayer {...args} theme={(context.globals.theme as SoundlineTheme) ?? args.theme} />
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  name: 'Idle — first track, paused',
  args: { state: 'idle' },
  parameters: {
    docs: {
      description: {
        story:
          'What a fresh page looks like: the queue loaded, the first track selected, the playhead at `0:00`, and nothing playing until the visitor asks.',
      },
    },
  },
};

export const Loading: Story = {
  name: 'Loading — slow track source',
  args: { adapter: createMockAdapter({ tracks: demoTracks, latency: 4000 }) },
  parameters: {
    docs: {
      description: {
        story:
          'The adapter takes four seconds, so the card sits in its loading state with the polite live region saying so. The state blocks animate their height as they swap.',
      },
    },
  },
};

export const Playing: Story = {
  name: 'Playing',
  args: { state: 'playing' },
  parameters: {
    docs: {
      description: {
        story:
          'Press-play, seen from outside: the equalizer breathes on the active row, the seek fill sweeps, and the transport button reads **Pause**.',
      },
    },
  },
};

export const Paused: Story = {
  name: 'Paused — mid-track',
  args: { state: 'paused' },
};

export const Ended: Story = {
  name: 'Ended — through the playlist',
  parameters: {
    docs: {
      description: {
        story:
          'The playlist reached its end: the driver walks to the last track and lets it play out. With repeat off there is nowhere to go next, so the live region announces the end of the playlist and the transport offers a restart.',
      },
    },
  },
  args: { state: 'ended' },
};

export const Empty: Story = {
  name: 'Empty — nothing to play',
  args: { adapter: createMockAdapter({ tracks: [] }) },
  parameters: {
    docs: {
      description: {
        story:
          'The queue loaded and is empty: the widget shows its empty block instead of a card with dead controls.',
      },
    },
  },
};

export const ListFailed: Story = {
  name: 'Error — the track list refused',
  args: { adapter: createMockAdapter({ tracks: demoTracks, failure: 'NETWORK_FAILURE' }) },
  parameters: {
    docs: {
      description: {
        story:
          '`getTracks` failed. The error block carries the localised message and a retry button, and `canRetry` is on because the list is what failed.',
      },
    },
  },
};

export const SourceFailed: Story = {
  name: 'Error — the source refused',
  args: {
    adapter: createMockAdapter({
      tracks: demoTracksUnresolved,
      sourceFailures: { 'neon-highway': 'NETWORK_FAILURE' },
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          'The list arrived, but resolving the selected track’s source failed — this playlist leaves the first track’s `src` to the adapter, so the controller actually asks it. The widget reports the failure with the phase it happened in and still knows there is a track to retry.',
      },
    },
  },
};
