/**
 * Duration helpers.
 *
 * Time is always formatted from a number of seconds, never from a clock, so the
 * derived view stays a pure function of the state. `formatDuration` and
 * `parseDuration` are exact inverses for the shapes the player can produce.
 */

/** Keeps `value` inside `[min, max]`; a non-numeric value collapses to `min`. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export interface FormatDurationOptions {
  /**
   * `auto` (default) renders `m:ss` and grows to `h:mm:ss` past an hour, so a
   * single track reads as short as possible. `hms` always renders hours, which
   * keeps a column of durations in one shape.
   */
  units?: 'auto' | 'hms';
}

/**
 * Formats seconds as a clock: `65` → `1:05`, `3661` → `1:01:01`.
 *
 * The value is floored, and anything that is not a finite positive number —
 * `NaN`, `Infinity`, a negative — reads as `0:00`, because a player shows a
 * duration, not an error.
 */
export function formatDuration(seconds: number, options: FormatDurationOptions = {}): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;

  if (options.units === 'hms' || hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(rest)}`;
  }
  return `${minutes}:${pad(rest)}`;
}

const CLOCK = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/;
const PLAIN_SECONDS = /^\d+(?:\.\d+)?$/;

/**
 * Reads a duration back into seconds: `'1:23'` → `83`, `'1:02:03'` → `3723`,
 * `'90.5'` → `90.5`.
 *
 * Returns `null` for anything it does not fully understand — an empty string,
 * trailing garbage, `1:60` — so a caller can tell "no value" from "zero".
 */
export function parseDuration(value: string): number | null {
  const text = value.trim();

  if (PLAIN_SECONDS.test(text)) {
    const seconds = Number(text);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const match = CLOCK.exec(text);
  if (!match) return null;

  const hours = match[1] === undefined ? 0 : Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (minutes > 59 || seconds > 59) return null;

  return hours * 3600 + minutes * 60 + seconds;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}
