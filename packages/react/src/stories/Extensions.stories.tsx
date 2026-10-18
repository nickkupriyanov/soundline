import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DefaultTransport,
  createMockAdapter,
  useAnimations,
  useClassNames,
  type SoundlineTheme,
  type TrackItemPartProps,
  type TransportPartProps,
} from '../index';
import { DemoPlayer, demoTracks } from './demo';

/**
 * Two ways to fit the widget to an application without forking it: swap a part,
 * or add slot classes. Both are independent — a replaced part still keeps the
 * library's class unless it chooses otherwise, and `classNames` keeps working on
 * top of a replacement.
 */
const meta: Meta<typeof DemoPlayer> = {
  title: 'Extensions/Player',
  component: DemoPlayer,
  parameters: {
    docs: {
      description: {
        component:
          'Every part is exported, so a replacement can wrap the default rather than re-implement it — and only the part an application passes is replaced.',
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
    components: { control: false },
    animations: { control: false },
    classNames: { control: false },
    messages: { control: false },
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

/**
 * A transport drawn as a pill bar.
 *
 * The replacement wraps `DefaultTransport`, so the accessible names, the pressed
 * states, the disabled mirroring and the repeat cycle are the library's; only the
 * frame around the row is the application's.
 */
function PillTransport(props: TransportPartProps) {
  return (
    <div
      style={{
        padding: '6px 10px',
        border: '1px solid var(--sn-border-strong)',
        borderRadius: 999,
        background: 'var(--sn-control)',
      }}
    >
      <DefaultTransport {...props} />
    </div>
  );
}

/**
 * A queue row with the duration on the right.
 *
 * The row renders the animation kit's `Item` (so it still staggers and still
 * accepts the `ref` the list moves focus through), spreads `slotProps` on it, and
 * hands `selectProps`/`removeProps` to its own two buttons — the two behaviours
 * a replacement may not drop.
 */
function DurationRow({ item, slotProps, selectProps, removeProps }: TrackItemPartProps) {
  const cls = useClassNames();
  const { Item } = useAnimations();

  return (
    <Item index={item.position - 1} {...slotProps}>
      <button {...selectProps}>
        <span className={cls('trackLine')}>
          {item.isPlaying ? (
            <span className={cls('eq')} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          ) : null}
          <span className={cls('trackTitle')}>{item.title}</span>
        </span>
        {item.artist ? <span className={cls('trackArtist')}>{item.artist}</span> : null}
      </button>

      {item.durationLabel ? (
        <span className="story-duration" aria-hidden="true">
          {item.durationLabel}
        </span>
      ) : null}

      <button {...removeProps}>×</button>
    </Item>
  );
}

export const CustomTransport: Story = {
  name: 'Replaced part — a transport in a pill',
  args: { components: { Transport: PillTransport }, state: 'playing' },
  parameters: {
    docs: {
      description: {
        story:
          'Only `Transport` is replaced; the seek bar, the queue and everything else keep their defaults. Wrapping the exported default keeps the accessibility contract without re-deriving it.',
      },
    },
  },
};

export const CustomRow: Story = {
  name: 'Replaced part — a queue row with the duration',
  args: { components: { TrackItem: DurationRow } },
  parameters: {
    docs: {
      description: {
        story:
          'The row still goes through the animation kit and still puts both buttons in place, so the keyboard walk, the roving tab order and the focus-after-removal behaviour are unchanged.',
      },
    },
  },
};

export const WithClassNames: Story = {
  name: 'Slot classes — no replacement at all',
  args: {
    classNames: {
      card: 'story-card',
      playButton: 'story-play',
      trackTitle: 'story-title',
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          '`classNames` adds a class per slot; the library keeps its own. It is orthogonal to `components`, which is why an application can do both.',
      },
    },
  },
};
