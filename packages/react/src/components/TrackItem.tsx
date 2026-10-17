import { useAnimations, useClassNames } from '../context';
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
 * The row element itself comes from the animation kit (`Item`), so a track
 * change can stagger the list without a wrapper appearing between the listbox
 * and its options; the playing row also carries the equalizer, which is purely
 * decorative — `aria-hidden`, no text, no pointer target of its own.
 *
 * The row's accessible name is the prepared `{index}. {title}` label rather than
 * its whole text: that keeps the nested remove button — a separate tab stop with
 * its own label — from turning the option's name into "track, artist, remove
 * track".
 */
export function TrackItem({ item, slotProps, removeProps }: TrackItemPartProps) {
  const cls = useClassNames();
  const { Item } = useAnimations();

  return (
    <Item index={item.position - 1} {...slotProps}>
      <span className={cls('trackLine')}>
        {item.isPlaying ? (
          <span className={cls('eq')} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        ) : null}

        <span className={cls('trackTitle')}>{item.title}</span>
      </span>

      {item.artist ? <span className={cls('trackArtist')}>{item.artist}</span> : null}

      <button {...removeProps}>
        <RemoveIcon />
      </button>
    </Item>
  );
}
