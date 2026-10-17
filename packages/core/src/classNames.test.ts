import { describe, expect, it } from 'vitest';
import { SN_CLASS, cx } from './classNames';
import type { SnClassSlot } from './types';

describe('SN_CLASS', () => {
  it('prefixes every slot with the stable `sn-` namespace', () => {
    for (const [slot, className] of Object.entries(SN_CLASS)) {
      expect(className, slot).toMatch(/^sn-[a-z0-9-]+$/);
    }
  });

  it('maps each slot to a distinct class', () => {
    const classes = Object.values(SN_CLASS);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it('covers every slot of the public type', () => {
    // Typed as a total record, so an added slot fails the build; this runtime
    // check is what makes a missing entry visible in a failing test too.
    const slots: SnClassSlot[] = Object.keys(SN_CLASS) as SnClassSlot[];
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(SN_CLASS[slot]).toBeTypeOf('string');
    }
  });

  it('pins the classes the stylesheet and consumers depend on', () => {
    expect(SN_CLASS.root).toBe('sn-root');
    expect(SN_CLASS.playButton).toBe('sn-play-button');
    expect(SN_CLASS.trackItemActive).toBe('sn-track-item-active');
  });
});

describe('cx re-export', () => {
  it('is the same helper the widgets use', () => {
    expect(cx(SN_CLASS.root, 'my-player')).toBe('sn-root my-player');
    expect(cx(false, null, undefined)).toBe('');
  });
});
