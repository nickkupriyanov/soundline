import { describe, expect, it } from 'vitest';
import { clamp, formatDuration, parseDuration } from './duration';

describe('clamp', () => {
  it('keeps a value inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('pulls values to the nearest bound', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('collapses a non-numeric value to the minimum', () => {
    expect(clamp(Number.NaN, 0, 10)).toBe(0);
  });
});

describe('formatDuration', () => {
  it('renders m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(599)).toBe('9:59');
  });

  it('grows to h:mm:ss past an hour', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('always renders hours with units: hms', () => {
    expect(formatDuration(65, { units: 'hms' })).toBe('0:01:05');
    expect(formatDuration(3661, { units: 'hms' })).toBe('1:01:01');
  });

  it('floors fractional seconds', () => {
    expect(formatDuration(59.9)).toBe('0:59');
  });

  it('reads a non-finite or negative value as zero', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00');
    expect(formatDuration(-10)).toBe('0:00');
  });
});

describe('parseDuration', () => {
  it('reads plain seconds', () => {
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('90.5')).toBe(90.5);
    expect(parseDuration(' 42 ')).toBe(42);
  });

  it('reads m:ss and h:mm:ss', () => {
    expect(parseDuration('1:23')).toBe(83);
    expect(parseDuration('0:05')).toBe(5);
    expect(parseDuration('1:02:03')).toBe(3723);
  });

  it('round-trips what formatDuration produces', () => {
    for (const seconds of [0, 5, 65, 599, 3600, 3661]) {
      expect(parseDuration(formatDuration(seconds))).toBe(seconds);
      expect(parseDuration(formatDuration(seconds, { units: 'hms' }))).toBe(seconds);
    }
  });

  it('returns null for anything it cannot read fully', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('   ')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('1:60')).toBeNull();
    expect(parseDuration('1:23:45:6')).toBeNull();
    expect(parseDuration('-1:00')).toBeNull();
  });
});
