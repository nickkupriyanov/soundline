/**
 * Page visibility.
 *
 * A tab that goes away may sleep through playback, so whoever owns the engine
 * listens here: `pauseWhenHidden` on one side, a re-sync of the position on the
 * other. Both directions are reported — knowing that a tab *became* hidden is the
 * whole point.
 */

/** Whether the document is hidden right now; `false` where there is no document. */
export function isDocumentHidden(): boolean {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'hidden';
}

/**
 * Calls back with the new document visibility on every change. Returns the remover.
 *
 * Nothing is reported at subscribe time: this is a subscription to changes, not a
 * reading — a caller that needs the current value asks `isDocumentHidden()`.
 * Without a document (a server) nothing is watched.
 */
export function observeVisibilityChange(
  listener: (state: DocumentVisibilityState) => void,
): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = () => listener(document.visibilityState);
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
