import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createMockAdapter, createMockEngine, type Track } from '@nickkupriyanov/soundline-core';
import { Player, motionAnimations } from './motion';

const here = dirname(fileURLToPath(import.meta.url));

const TRACK_DURATION = 100;

const tracks: Track[] = [
  { id: 'a', title: 'Alpha', artist: 'One', src: 'a.mp3', duration: TRACK_DURATION },
  { id: 'b', title: 'Beta', artist: 'Two', src: 'b.mp3', duration: TRACK_DURATION },
];

/** A mock engine whose playhead never ticks by itself, so nothing races a clock. */
function engine() {
  return createMockEngine({ duration: TRACK_DURATION, tickMs: 60_000 });
}

/* -------------------------------------------------------------------------- */
/*  The main entry point stays free of Motion                                  */
/* -------------------------------------------------------------------------- */

const FROM = /\bfrom\s*['"]([^'"]+)['"]/g;
const SIDE_EFFECT_IMPORT = /\bimport\s*['"]([^'"]+)['"]/g;

/** Every module reachable from `entry` through the package's own relative imports. */
function moduleGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [resolve(here, entry)];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, 'utf8');
    for (const pattern of [FROM, SIDE_EFFECT_IMPORT]) {
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1] as string;
        if (!specifier.startsWith('.')) {
          // A bare specifier: the tests below are about which ones are reachable.
          seen.add(specifier);
          continue;
        }
        const base = resolve(dirname(file), specifier);
        for (const candidate of [
          `${base}.ts`,
          `${base}.tsx`,
          `${base}/index.ts`,
          `${base}/index.tsx`,
        ]) {
          try {
            readFileSync(candidate);
            queue.push(candidate);
            break;
          } catch {
            // Not this one; try the next spelling.
          }
        }
      }
    }
  }

  return seen;
}

describe('the /motion entry point', () => {
  it('reaches `motion`, which is what makes the other half of this test worth having', () => {
    expect([...moduleGraph('motion.ts')].some((module) => /^motion(\/|$)/.test(module))).toBe(true);
  });

  it('is never reachable from the main entry point', () => {
    const graph = moduleGraph('index.ts');

    expect([...graph].some((module) => /^motion(\/|$)/.test(module))).toBe(false);
    expect([...graph].some((module) => module.endsWith('animations/motion.tsx'))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*  The spring kit itself                                                      */
/* -------------------------------------------------------------------------- */

describe('the Motion kit', () => {
  it('renders the same widget, marked as driven by Motion', async () => {
    render(<Player adapter={createMockAdapter({ tracks })} engine={engine()} locale="en" />);

    const listbox = await screen.findByRole('listbox', { name: 'Playlist' });
    const rows = within(listbox).getAllByRole('option');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      // The class hooks of the CSS kit stay, so the stylesheet still applies.
      expect(row).toHaveClass('sn-track-item', 'sn-stagger-item');
      expect(row).toHaveAttribute('data-sn-motion', 'true');
    }

    expect(document.querySelector('.sn-step')).toHaveAttribute('data-sn-motion', 'true');
    expect(document.querySelector('.sn-height')).toHaveAttribute('data-sn-motion', 'true');
  });

  it('keeps the widget working: rows select, the transport plays', async () => {
    const user = userEvent.setup();
    render(<Player adapter={createMockAdapter({ tracks })} engine={engine()} locale="en" />);

    await screen.findByRole('listbox', { name: 'Playlist' });
    await user.click(screen.getByRole('option', { name: '2. Beta' }));
    expect(await screen.findByText('Beta', { selector: '.sn-title' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() =>
      expect(document.querySelector('.sn-root')).toHaveAttribute('data-sn-playing', 'true'),
    );
  });

  it('is the kit `createPlayer` binds for this entry point', () => {
    expect(motionAnimations.StepHost).toBeTypeOf('function');
    expect(motionAnimations.Height).toBeTypeOf('function');
    // A row is an exotic component (it forwards the ref the queue moves focus
    // through), so it is checked by rendering it instead of by its typeof.
    expect(motionAnimations.Item).toBeDefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  The primitives on their own                                                */
/* -------------------------------------------------------------------------- */

describe('the Motion primitives', () => {
  it('keeps the row an `<li>` with the class hooks and the index', () => {
    const seen: (HTMLLIElement | null)[] = [];

    render(
      <ul>
        <motionAnimations.Item
          index={2}
          ref={(node) => {
            seen.push(node);
          }}
        >
          <span>Alpha</span>
        </motionAnimations.Item>
      </ul>,
    );

    const row = screen.getByRole('listitem');
    expect(row).toHaveClass('sn-stagger-item');
    expect(row.style.getPropertyValue('--sn-index')).toBe('2');
    expect(seen).toContain(row);
  });

  it('names the direction of the step it was given', () => {
    const { rerender } = render(
      <motionAnimations.StepHost stepKey="a" direction={1}>
        <span>art</span>
      </motionAnimations.StepHost>,
    );
    expect(document.querySelector('.sn-step-host')).toHaveAttribute('data-direction', 'forward');

    rerender(
      <motionAnimations.StepHost stepKey="b" direction={-1}>
        <span>art</span>
      </motionAnimations.StepHost>,
    );
    expect(document.querySelector('.sn-step-host')).toHaveAttribute('data-direction', 'back');
  });

  it('wraps the content in the measured box', () => {
    render(
      <motionAnimations.Height>
        <span>content</span>
      </motionAnimations.Height>,
    );

    const box = document.querySelector('.sn-height') as HTMLElement;
    expect(box).toHaveAttribute('data-sn-motion', 'true');
    expect(box.querySelector('.sn-height-inner')).toHaveTextContent('content');
  });
});
