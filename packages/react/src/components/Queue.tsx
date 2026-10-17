import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import type { QueueView } from '@nickkupriyanov/soundline-core';
import { useClassNames } from '../context';
import { TrackItem } from './TrackItem';

/** Everything the queue renders and does. */
export interface QueueProps {
  /** The playlist as the flow derived it: every row, in playback order. */
  queue: QueueView;
  /** Selects the track with this id. */
  onSelect(trackId: string): void;
  /** Removes the track with this id. */
  onRemove(trackId: string): void;
}

/**
 * The playlist, as a listbox.
 *
 * The rows are rendered in the order they will be played — the derived queue *is*
 * the playback order — so what a visitor sees and what `next`/`previous` do can
 * never disagree; shuffle only changes both together.
 *
 * Navigation is a roving `tabindex`: exactly one row is in the tab order, the
 * arrow keys walk the list (`Home`/`End` jump to the ends), and `Enter`/`Space`
 * or a click selects. Focus stays on a row when the list changes under it: the
 * remembered row falls back to the active track, then to the first row.
 */
export function Queue({ queue, onSelect, onRemove }: QueueProps) {
  const cls = useClassNames();
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const { items } = queue;
  const holds = (id: string | null): id is string =>
    id !== null && items.some((row) => row.id === id);
  const focusId = holds(focusedId)
    ? focusedId
    : holds(queue.activeId)
      ? queue.activeId
      : (items[0]?.id ?? null);

  const focusItem = useCallback((id: string): void => {
    setFocusedId(id);
    itemRefs.current.get(id)?.focus();
  }, []);

  const registerItem = useCallback(
    (id: string) =>
      (element: HTMLLIElement | null): void => {
        if (element) itemRefs.current.set(id, element);
        else itemRefs.current.delete(id);
      },
    [],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>, trackId: string): void => {
    const index = items.findIndex((row) => row.id === trackId);
    if (index < 0) return;

    let target: string | null = null;
    switch (event.key) {
      case 'ArrowDown':
        target = items[Math.min(index + 1, items.length - 1)]?.id ?? null;
        break;
      case 'ArrowUp':
        target = items[Math.max(index - 1, 0)]?.id ?? null;
        break;
      case 'Home':
        target = items[0]?.id ?? null;
        break;
      case 'End':
        target = items[items.length - 1]?.id ?? null;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect(trackId);
        return;
      default:
        return;
    }

    // The keys are the list's own: the page must not scroll under them.
    event.preventDefault();
    if (target !== null && target !== trackId) focusItem(target);
  };

  return (
    <div className={cls('queue')}>
      <div className={cls('queueHeader')}>
        <span>{queue.label}</span>
        <span className={cls('queueCount')}>{queue.countLabel}</span>
      </div>

      <ul className={cls('queueList')} role="listbox" aria-label={queue.label}>
        {items.map((item) => (
          <TrackItem
            key={item.id}
            item={item}
            focused={item.id === focusId}
            onSelect={onSelect}
            onRemove={onRemove}
            onFocus={setFocusedId}
            onKeyDown={onKeyDown}
            itemRef={registerItem(item.id)}
          />
        ))}
      </ul>
    </div>
  );
}
