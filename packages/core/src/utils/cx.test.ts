import { describe, expect, it } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('joins truthy values with a single space', () => {
    expect(cx('sn-root', 'sn-card')).toBe('sn-root sn-card');
  });

  it('skips empty, false, null and undefined', () => {
    expect(cx('sn-root', '', false, null, undefined, 'sn-card')).toBe('sn-root sn-card');
  });

  it('returns an empty string when nothing is truthy', () => {
    expect(cx(false, null, undefined)).toBe('');
  });
});
