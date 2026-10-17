import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { format, type QueueView } from '@nickkupriyanov/soundline-core';
import { useClassNames, useComponents, useUI } from '../context';

/** Everything the listbox needs to render and drive the playlist. */
export interface QueueListProps {
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
 *
 * This component is the library's own half of the queue, not a part: the rows it
 * builds are the `TrackItem` part, and every contract that must survive a
 * replacement — the role, the roving tab order, the key handling, the click that
 * must not select on the remove button — is prepared here and handed to that
 * part in its props.
 */
export function QueueList({ queue, onSelect, onRemove }: QueueListProps) {
  const cls = useClassNames();
  const { messages } = useUI();
  const { TrackItem } = useComponents();
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
    // A key on the remove button belongs to the button, not to the option.
    if (event.target !== event.currentTarget) return;

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
    <ul className={cls('queueList')} role="listbox" aria-label={queue.label}>
      {items.map((item) => (
        <TrackItem
          key={item.id}
          item={item}
          slotProps={{
            ref: registerItem(item.id),
            role: 'option',
            'aria-selected': item.isActive,
            'aria-label': item.label,
            tabIndex: item.id === focusId ? 0 : -1,
            'data-sn-track-id': item.id,
            className: cls(
              'trackItem',
              item.isActive && 'trackItemActive',
              item.isPlaying && 'trackItemPlaying',
            ),
            onClick: () => onSelect(item.id),
            onFocus: () => setFocusedId(item.id),
            onKeyDown: (event) => onKeyDown(event, item.id),
          }}
          removeProps={{
            type: 'button',
            className: cls('trackRemove'),
            'aria-label': format(messages.removeTrackLabel, { title: item.title }),
            onClick: (event) => {
              // Removing is deliberately not a selection.
              event.stopPropagation();
              onRemove(item.id);
            },
          }}
        />
      ))}
    </ul>
  );
}
