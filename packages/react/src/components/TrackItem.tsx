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
 * can stagger the list without a wrapper appearing between the list and its rows;
 * the playing row also carries the equalizer, which is purely decorative —
 * `aria-hidden`, no text, no pointer target of its own.
 *
 * The selecting button's accessible name is the prepared `{index}. {title}` label
 * rather than its whole text: the artist line beside it would otherwise turn the
 * name into "1. Alpha One".
 */
export function TrackItem({ item, slotProps, selectProps, removeProps }: TrackItemPartProps) {
  const cls = useClassNames();
  const { Item } = useAnimations();

  return (
    <Item index={item.position - 1} {...slotProps}>
      <button {...selectProps}>
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
      </button>

      <button {...removeProps}>
        <RemoveIcon />
      </button>
    </Item>
  );
}
