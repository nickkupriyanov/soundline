import { describe, expect, it } from 'vitest';
import { createId } from './ids';

describe('createId', () => {
  it('never repeats an id within a run', () => {
    const ids = Array.from({ length: 50 }, () => createId());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defaults the prefix to `sn`', () => {
    expect(createId()).toMatch(/^sn-\d+$/);
  });

  it('namespaces the id with the given prefix', () => {
    expect(createId('sn-player')).toMatch(/^sn-player-\d+$/);
    expect(createId('sn-player')).not.toMatch(/^sn-\d+$/);
  });

  it('keeps counting up', () => {
    const first = Number(createId().split('-').pop());
    const second = Number(createId().split('-').pop());
    expect(second).toBe(first + 1);
  });
});
