/**
 * Identifier helpers.
 *
 * Ids are for accessibility wiring (a slider and its label, a listbox and its
 * options), not for identity across sessions: they only have to be unique and
 * stable while the widget is mounted. A module-scoped counter does that without
 * touching `crypto` or `Date`, which keeps the output deterministic in tests and
 * identical between server render and hydration.
 */

let counter = 0;

/**
 * A fresh, stable id, unique within the running library.
 *
 * The `prefix` namespaces the id — pass one per widget when several players live
 * on a page: `createId('sn-player')` → `sn-player-1`.
 */
export function createId(prefix = 'sn'): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
