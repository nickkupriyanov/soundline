import { useClassNames } from '../context';
import type { TrackItemPartProps } from '../parts';
import { RemoveIcon } from './icons';

/**
 * One row of the queue, as a listbox option.
 *
 * Everything behavioural is in the prepared props: `slotProps` carries the
 * `option` role, the `aria-selected`, the tab order, the selection click, the
 * arrow-key handling and the upstream `ref` the list moves focus through;
 * `removeProps` carries a button that is labelled, styled and kept from
 * selecting the row. The part only draws the content of the row.
 *
 * The row's accessible name is the prepared `{index}. {title}` label rather than
 * its whole text: that keeps the nested remove button — a separate tab stop with
 * its own label — from turning the option's name into "track, artist, remove
 * track".
 */
export function TrackItem({ item, slotProps, removeProps }: TrackItemPartProps) {
  const cls = useClassNames();

  return (
    <li {...slotProps}>
      <span className={cls('trackTitle')}>{item.title}</span>
      {item.artist ? <span className={cls('trackArtist')}>{item.artist}</span> : null}

      <button {...removeProps}>
        <RemoveIcon />
      </button>
    </li>
  );
}
