import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { cx, format, type QueueItemView, type QueueView } from '@nickkupriyanov/soundline-core';
import { useClassNames, useComponents, useUI } from '../context';
import { useExitingRows } from '../hooks/useExitingRows';

/** Everything the list needs to render and drive the playlist. */
export interface QueueListProps {
  /** The playlist as the flow derived it: every row, in playback order. */
  queue: QueueView;
  /** Selects the track with this id. */
  onSelect(trackId: string): void;
  /** Removes the track with this id. */
  onRemove(trackId: string): void;
}

/**
 * The playlist, as a list of rows.
 *
 * The rows are rendered in the order they will be played — the derived queue *is*
 * the playback order — so what a visitor sees and what `next`/`previous` do can
 * never disagree; shuffle only changes both together.
 *
 * A row holds two buttons and nothing else: the one that selects the track and
 * the one that removes it. They are deliberately *siblings* rather than a button
 * inside a listbox option: an option is a value, and a focusable control inside
 * one is both invalid (`nested-interactive`, WCAG 4.1.2) and awkward to announce.
 * A plain list of rows with real buttons keeps the same picture, the same tab
 * stops and the same keyboard behaviour without that contradiction. The current
 * track is marked with `aria-current` on its button — the "value selected out of a
 * list" of a listbox has no honest equivalent once the rows are buttons.
 *
 * Navigation is a roving `tabindex` over the *selecting* buttons: exactly one row
 * is in the tab order, the arrow keys walk the list (`Home`/`End` jump to the
 * ends), and the remove button of every row stays separately reachable. Focus
 * stays on a row when the list changes under it: the remembered row falls back to
 * the active track, then to the first row, and a removal takes the focus along
 * instead of dropping it on `<body>`.
 *
 * A removed row is not dropped at once: it is held for the length of its exit
 * (`useExitingRows`), marked `data-sn-exiting` so the animation kit can fade it
 * out, and hidden from the assistive tree and the tab order while it goes. Only a
 * removal asked for here is held — a playlist switch, a shuffle or a queue the
 * application replaced are instant.
 *
 * This component is the library's own half of the queue, not a part: the rows it
 * builds are the `TrackItem` part, and every contract that must survive a
 * replacement — the tab order, the arrows, the click that must not select, the
 * labels — is prepared here and handed to that part in its props.
 */
export function QueueList({ queue, onSelect, onRemove }: QueueListProps) {
  const cls = useClassNames();
  const { messages } = useUI();
  const { TrackItem } = useComponents();
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const selectRefs = useRef(new Map<string, HTMLButtonElement>());
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const { items } = queue;
  const { exiting, markLeaving, exitDurationMs } = useExitingRows(items);

  const holds = (id: string | null): id is string =>
    id !== null && items.some((row) => row.id === id);
  const focusId = holds(focusedId)
    ? focusedId
    : holds(queue.activeId)
      ? queue.activeId
      : (items[0]?.id ?? null);

  /**
   * Whether the removal in flight takes the focus away with it.
   *
   * The row unmounts with the focus inside it — on the selecting button or on its
   * own remove button — so the click that asks for the removal is the last moment
   * that can tell. A removal nobody was focused on leaves the flag alone.
   */
  const focusedRowRemoved = useRef(false);

  const focusItem = useCallback((id: string): void => {
    setFocusedId(id);
    selectRefs.current.get(id)?.focus();
  }, []);

  const registerRow = useCallback(
    (id: string) =>
      (element: HTMLLIElement | null): void => {
        if (element) rowRefs.current.set(id, element);
        else rowRefs.current.delete(id);
      },
    [],
  );

  const registerSelect = useCallback(
    (id: string) =>
      (element: HTMLButtonElement | null): void => {
        if (element) selectRefs.current.set(id, element);
        else selectRefs.current.delete(id);
      },
    [],
  );

  // The removal has happened by the time this runs: the focus goes to the row
  // that inherits the roving `tabindex`. When the list emptied itself out there
  // is nothing to hand it to, and the empty state takes over (the view re-homes
  // the focus on the card).
  useEffect(() => {
    if (!focusedRowRemoved.current) return;
    focusedRowRemoved.current = false;
    if (focusId === null) return;
    selectRefs.current.get(focusId)?.focus();
  }, [items, focusId]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, track: string): void => {
    const index = items.findIndex((row) => row.id === track);
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
      default:
        // `Enter` and `Space` belong to the button itself: they become a click.
        return;
    }

    // The keys are the list's own: the page must not scroll under them.
    event.preventDefault();
    if (target !== null && target !== track) focusItem(target);
  };

  /**
   * A row, in or on its way out.
   *
   * A leaving row is the same element drawn the same way — the exit is a
   * transition on it, not a second kind of row — but it is inert: `data-sn-exiting`
   * is what the animation layer sees, `aria-hidden` takes it out of the
   * assistive tree, and both buttons leave the tab order and lose their
   * handlers, so nothing can be activated in the moment it is disappearing.
   */
  const renderRow = (item: QueueItemView, leaving: boolean) => (
    <TrackItem
      key={item.id}
      item={item}
      slotProps={{
        ...(leaving
          ? { 'data-sn-exiting': 'true', 'aria-hidden': 'true' }
          : { ref: registerRow(item.id) }),
        'data-sn-track-id': item.id,
        // The state classes are slots too: each one has to go through `cls`, or a
        // consumer's `classNames.trackItemActive`/`trackItemPlaying` never reaches
        // the DOM. `cx` joins the resolved slots without repeating the base class.
        className: cx(
          cls('trackItem'),
          item.isActive && cls('trackItemActive'),
          item.isPlaying && cls('trackItemPlaying'),
        ),
        ...(leaving
          ? { style: { '--sn-exit-duration': `${exitDurationMs}ms` } as CSSProperties }
          : null),
      }}
      selectProps={{
        type: 'button',
        ...(leaving ? null : { ref: registerSelect(item.id) }),
        className: cls('trackSelect'),
        'aria-label': item.label,
        'aria-current': !leaving && item.isActive ? 'true' : undefined,
        tabIndex: leaving ? -1 : item.id === focusId ? 0 : -1,
        onClick: leaving ? undefined : () => onSelect(item.id),
        onFocus: leaving ? undefined : () => setFocusedId(item.id),
        onKeyDown: leaving ? undefined : (event) => onKeyDown(event, item.id),
      }}
      removeProps={{
        type: 'button',
        className: cls('trackRemove'),
        'aria-label': format(messages.removeTrackLabel, { title: item.title }),
        ...(leaving ? { tabIndex: -1 } : null),
        onClick: leaving
          ? undefined
          : () => {
              // Asked before the removal, while the row is still in the document.
              const row = rowRefs.current.get(item.id);
              const active = typeof document === 'undefined' ? null : document.activeElement;
              focusedRowRemoved.current = Boolean(row && active && row.contains(active));
              // The row leaves with its transition rather than at once; removing
              // is deliberately not a selection.
              markLeaving(item.id);
              onRemove(item.id);
            },
      }}
    />
  );

  /**
   * The rows to render, in order: the list as it is, with the rows on their way
   * out put back where they were.
   *
   * A leaving row keeps the place it left — `position` is the one it had when it
   * was removed — so a row removed from the middle of the list does not have the
   * rows below jump up before its exit is over.
   */
  const sequence: Array<readonly [QueueItemView, boolean]> = items.map(
    (item): readonly [QueueItemView, boolean] => [item, false],
  );
  for (const ghost of [...exiting].sort((a, b) => a.position - b.position)) {
    sequence.splice(Math.min(Math.max(ghost.position - 1, 0), sequence.length), 0, [ghost, true]);
  }

  return (
    <ul className={cls('queueList')} aria-label={queue.label}>
      {sequence.map(([item, leaving]) => renderRow(item, leaving))}
    </ul>
  );
}
