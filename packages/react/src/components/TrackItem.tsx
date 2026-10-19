import { useAnimations, useClassNames } from '../context';
import type { TrackItemPartProps } from '../parts';
import { RemoveIcon } from './icons';

/**
 * One row of the queue.
 *
 * The row is two buttons and nothing else, so nothing focusable is ever nested in
 * something else focusable. Everything behavioural is in the prepared props:
 * `slotProps` carries the layout slot, the item id and the upstream `ref` the
 * list tracks the row by; `selectProps` carries the selecting button — the
 * tab order, `aria-current`, the name, the click, the arrow keys and the `ref`
 * the list moves focus through; `removeProps` carries the second button, labelled
 * and styled. The part only draws the content of the row.
 *
 * The row element itself comes from the animation kit (`Item`), so a track change
 * can stagger the list without a wrapper appearing between the list and its rows.
 * The equalizer is always rendered — reserved, but silent and invisible on a row
 * that is not playing — so starting playback never shifts the title sideways.
 * It is purely decorative: `aria-hidden`, no text, no pointer target of its own.
 *
 * The duration sits inside the selecting button, at the far end of a stable
 * column. It is the adapter's `durationLabel` (or an empty column when the
 * adapter did not know): the widget never asks for a duration of its own.
 *
 * The selecting button's accessible name is the prepared `{index}. {title}` label
 * rather than its whole text: the artist and duration beside it would otherwise
 * turn the name into "1. Alpha One 1:40".
 */
export function TrackItem({ item, slotProps, selectProps, removeProps }: TrackItemPartProps) {
  const cls = useClassNames();
  const { Item } = useAnimations();

  return (
    <Item index={item.position - 1} {...slotProps}>
      <button {...selectProps}>
        <span className={cls('trackLine')}>
          <span
            className={cls('eq')}
            aria-hidden="true"
            data-sn-idle={!item.isPlaying || undefined}
          >
            <span />
            <span />
            <span />
          </span>

          <span className={cls('trackTitle')}>{item.title}</span>
        </span>

        {item.artist ? <span className={cls('trackArtist')}>{item.artist}</span> : null}

        <span className={cls('trackDuration')}>{item.durationLabel ?? ''}</span>
      </button>

      <button {...removeProps}>
        <RemoveIcon />
      </button>
    </Item>
  );
}
