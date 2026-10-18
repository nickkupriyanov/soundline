import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createMockAdapter, type SoundlineTheme } from '../index';
import { motionAnimations } from '../motion';
import { DemoPlayer, demoTracks } from './demo';

/**
 * The ready-made widget.
 *
 * Playback runs on a mock engine, so nothing is downloaded and the playhead walks
 * a virtual timeline — press play and the equalizer, the seek fill and the
 * automatic `next` all behave the same as they would with a real `<audio>`.
 */
const meta: Meta<typeof DemoPlayer> = {
  title: 'Widget/Player',
  component: DemoPlayer,
  parameters: {
    docs: {
      description: {
        component:
          'Use the theme toolbar to switch the designed palettes. `Player` and the mock helpers come from `@nickkupriyanov/soundline-core`, so the same widget runs on a real engine by passing one.',
      },
    },
  },
  args: {
    adapter: createMockAdapter({ tracks: demoTracks }),
    locale: 'en',
    layout: 'card',
    showQueue: true,
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
    layout: { control: 'inline-radio', options: ['card', 'compact'] },
    state: { control: 'inline-radio', options: ['idle', 'playing', 'paused', 'ended'] },
  },
  render: (args, context) => (
    <DemoPlayer {...args} theme={(context.globals.theme as SoundlineTheme) ?? args.theme} />
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Russian: Story = {
  args: { locale: 'ru' },
};

export const Compact: Story = {
  name: 'Compact layout',
  args: { layout: 'compact' },
};

export const WithoutQueue: Story = {
  name: 'Single track — no queue',
  args: { showQueue: false },
};

export const Playing: Story = {
  args: { state: 'playing' },
};

export const CustomAccent: Story = {
  name: 'Themed with CSS variables',
  decorators: [
    (Story) => (
      <div
        style={
          {
            '--sn-accent': '#7c5cff',
            '--sn-accent-hover': '#8f74ff',
            '--sn-accent-press': '#6a49f0',
            '--sn-accent-ink': '#ab9dff',
            '--sn-accent-soft': 'rgba(124, 92, 255, 0.18)',
            '--sn-accent-soft-strong': 'rgba(124, 92, 255, 0.3)',
            '--sn-accent-glow': 'rgba(124, 92, 255, 0.45)',
            '--sn-focus-ring': 'rgba(124, 92, 255, 0.6)',
            '--sn-radius-card': '18px',
          } as CSSProperties
        }
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Theming is CSS custom properties only — no Tailwind, no CSS-in-JS, no runtime. The same accent reads correctly in either theme.',
      },
    },
  },
};

export const MotionSprings: Story = {
  name: 'Motion springs (optional peer)',
  args: { state: 'playing' },
  render: (args, context) => (
    <DemoPlayer
      {...args}
      animations={motionAnimations}
      theme={(context.globals.theme as SoundlineTheme) ?? args.theme}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The same widget rendered through the `motion` kit instead of the CSS one — springs and staggered rows in place of keyframes. `motion` stays an optional peer; the main entry point never imports it.',
      },
    },
  },
};

export const Narrow: Story = {
  name: 'Narrow container',
  decorators: [
    (Story) => (
      <div style={{ width: 300 }}>
        <Story />
      </div>
    ),
  ],
};
