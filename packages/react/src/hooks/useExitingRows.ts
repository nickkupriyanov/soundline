/**
 * The rows a list is holding on to while they leave.
 *
 * A row that vanishes the moment the reducer drops it has no exit: the element
 * is gone before anything can animate. This hook is the other half — it keeps a
 * removed row in the caller's hands for the length of the exit, so the CSS kit
 * can fade and collapse it and the rows below close the gap when it is finally
 * unmounted.
 *
 * Only a removal the visitor asked for is held: `markLeaving` is called by the
 * list's own remove button, so a playlist switch, a shuffle or a queue the
 * application replaced are different events and stay instant. The mark is a
 * request, not a fact: it lives only until the removal it asked for arrives. A
 * removal the application refused (a controlled queue that kept the row) leaves
 * the row in place, and the mark expires after the exit window — otherwise a
 * much later, unrelated update that drops the same row would replay an animation
 * for a click from the past.
 *
 * The duration is reported as well as used, so the caller writes one number into
 * the row (`--sn-exit-duration`) and runs the unmount timer with the same one.
 * Under `prefers-reduced-motion: reduce` nothing is held at all: the row is gone
 * at once, which is what "no animation" has to mean.
 *
 * The hook is deliberately internal: a consumer changes the exit by replacing the
 * animation kit, never by keeping rows alive here.
 */
import { useEffect, useRef, useState } from 'react';
import { REDUCED_MOTION_QUERY } from '@nickkupriyanov/soundline-core/dom';
import { useMediaQuery } from './useMediaQuery';

/** How long a row takes to leave, in milliseconds. Mirrors `--sn-duration`. */
export const ROW_EXIT_DURATION = 240;

export interface ExitingRows<T> {
  /** The rows that are on their way out, in the order they were removed. */
  exiting: readonly T[];
  /** Asks for this row to leave with the transition rather than at once. */
  markLeaving(id: string): void;
  /** The length of the exit, in milliseconds. */
  exitDurationMs: number;
}

/**
 * Follows a list of rows and reports the ones that are leaving through it.
 *
 * `rows` must be the same array the caller renders: the diff is by identity, and
 * rows are compared by `id`.
 */
export function useExitingRows<T extends { id: string }>(rows: readonly T[]): ExitingRows<T> {
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY);
  const [held, setHeld] = useState<readonly T[]>([]);
  const previous = useRef(rows);
  /** Removal requests the list is waiting for, each with its expiry timer. */
  const leaving = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  /** Forgets one request, timer included. */
  const forget = (id: string): void => {
    const timer = leaving.current.get(id);
    if (timer !== undefined) clearTimeout(timer);
    leaving.current.delete(id);
  };

  // Diffed while rendering rather than in an effect: an effect runs after the
  // commit, and a row the reducer has already dropped would visibly come back for
  // a frame before its exit started.
  if (previous.current !== rows) {
    const ids = new Set(rows.map((row) => row.id));
    const gone = previous.current.filter((row) => !ids.has(row.id));
    previous.current = rows;

    // A request is answered by the first list that no longer holds its row. One
    // whose row is still here was refused: drop it now rather than let it fire on
    // some later update.
    for (const id of [...leaving.current.keys()]) {
      if (ids.has(id)) forget(id);
    }

    const asked = gone.filter((row) => {
      if (!leaving.current.has(row.id)) return false;
      forget(row.id);
      return true;
    });
    if (asked.length > 0 && !reduced) setHeld((current) => [...current, ...asked]);
  }

  // A row the list has again — the application put it back within the exit — is
  // no longer leaving, and must not collide with the row that is.
  const goneIds = new Set(rows.map((row) => row.id));
  const exiting = held.filter((row) => !goneIds.has(row.id));

  useEffect(() => {
    if (exiting.length === 0) return;
    // One timer for whatever is leaving: a burst of removals goes out together.
    const timer = setTimeout(() => setHeld([]), ROW_EXIT_DURATION);
    return () => clearTimeout(timer);
  }, [held]);

  // Requests still pending when the list goes away must not keep timers alive.
  useEffect(
    () => () => {
      for (const id of [...leaving.current.keys()]) forget(id);
    },
    [],
  );

  return {
    exiting,
    markLeaving: (id: string) => {
      forget(id);
      // The request is answered by the render that drops the row, which normally
      // happens in this very task. The timer is the backstop for a removal the
      // application never made.
      const timer = setTimeout(() => leaving.current.delete(id), ROW_EXIT_DURATION);
      leaving.current.set(id, timer);
    },
    exitDurationMs: ROW_EXIT_DURATION,
  };
}
