import type { KeyboardEvent } from 'react';
import { format, type QueueItemView } from '@nickkupriyanov/soundline-core';
import { useClassNames, useUI } from '../context';
import { RemoveIcon } from './icons';

/** Everything one queue row renders and does. */
export interface TrackItemProps {
  /** The row as the flow derived it: labels, position and state flags. */
  item: QueueItemView;
  /** Whether this row is the list's current tab stop (roving `tabindex`). */
  focused: boolean;
  /** Selects this track. */
  onSelect(trackId: string): void;
  /** Removes this track from the queue. */
  onRemove(trackId: string): void;
  /** Called when the row (not its button) receives focus. */
  onFocus(trackId: string): void;
  /** Key handling that walks the list; only the row's own keys reach it. */
  onKeyDown(event: KeyboardEvent<HTMLLIElement>, trackId: string): void;
  /** Registers the row element so the queue can move focus programmatically. */
  itemRef(element: HTMLLIElement | null): void;
}

/**
 * One row of the queue, as a listbox option.
 *
 * The row is a real option with `aria-selected`, and its accessible name is the
 * prepared `{index}. {title}` label rather than its whole text: that keeps the
 * nested remove button — a separate tab stop with its own label — from turning
 * the option's name into "track, artist, remove track".
 *
 * Removing is deliberately not a selection: the button stops the click from
 * reaching the row, and the row's key handler ignores key events that started on
 * the button.
 */
export function TrackItem({
  item,
  focused,
  onSelect,
  onRemove,
  onFocus,
  onKeyDown,
  itemRef,
}: TrackItemProps) {
  const cls = useClassNames();
  const { messages } = useUI();

  return (
    <li
      ref={itemRef}
      role="option"
      aria-selected={item.isActive}
      aria-label={item.label}
      tabIndex={focused ? 0 : -1}
      data-sn-track-id={item.id}
      className={cls(
        'trackItem',
        item.isActive && 'trackItemActive',
        item.isPlaying && 'trackItemPlaying',
      )}
      onClick={() => onSelect(item.id)}
      onFocus={() => onFocus(item.id)}
      onKeyDown={(event) => {
        // A key on the remove button belongs to the button, not to the option.
        if (event.target !== event.currentTarget) return;
        onKeyDown(event, item.id);
      }}
    >
      <span className={cls('trackTitle')}>{item.title}</span>
      {item.artist ? <span className={cls('trackArtist')}>{item.artist}</span> : null}

      <button
        type="button"
        className={cls('trackRemove')}
        aria-label={format(messages.removeTrackLabel, { title: item.title })}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(item.id);
        }}
      >
        <RemoveIcon />
      </button>
    </li>
  );
}
