import { forwardRef, type CSSProperties } from 'react';
import { cx } from '@nickkupriyanov/soundline-core';
import { useAnimatedHeight } from '../hooks/useAnimatedHeight';
import type { AnimationKit, HeightProps, ItemProps, StepHostProps } from '../types';

/**
 * The default animation kit: no runtime, no dependencies.
 *
 * Every primitive is the plain element the widget would render anyway — the
 * movement itself is in the stylesheet (core's `animations.css`), keyed on the
 * class hooks these components write. That is why the kit can be the default:
 * without the CSS the player renders and behaves exactly the same, it just does
 * not move, and `prefers-reduced-motion` is honoured by the stylesheet rather
 * than by a branch in here.
 */

/**
 * One step of content — the artwork — keyed on the current track.
 *
 * The two neighbouring steps never coexist here: the key remounts the child, so
 * the new artwork plays the entrance transition from the stylesheet while the old
 * one is already gone. The Motion kit is the one that crossfades.
 */
function StepHost({ stepKey, direction, className, children }: StepHostProps) {
  return (
    <div
      className={cx('sn-step-host', className)}
      data-direction={direction === 1 ? 'forward' : 'back'}
    >
      <div className="sn-step" key={stepKey}>
        {children}
      </div>
    </div>
  );
}

/**
 * A row of the queue, delayed by its place in the group.
 *
 * This is the row element itself — an `<li>` inside the list — not a wrapper
 * around one: the library's prepared props (the slot classes, the item id and the
 * `ref`) spread straight onto it, so the layout stays exactly what it would be
 * without a kit.
 */
const Item = forwardRef<HTMLLIElement, ItemProps>(function Item(
  { index, className, style, children, ...rest },
  ref,
) {
  return (
    <li
      {...rest}
      ref={ref}
      className={cx('sn-stagger-item', className)}
      style={{ ...style, '--sn-index': index } as CSSProperties}
    >
      {children}
    </li>
  );
});

/**
 * A container that follows the height of what it holds.
 *
 * Core measures the content and says when a change is worth a transition; the
 * inline `height` (only while a change is in flight) and the inline duration are
 * this half. Once the height settles the inline height is dropped, so the box
 * goes back to sizing itself and a longer title still wraps.
 */
function Height({ className, children }: HeightProps) {
  const { ref, height, animating, durationMs } = useAnimatedHeight();

  return (
    <div
      className={cx('sn-height', className)}
      data-sn-animating={animating ? 'true' : undefined}
      style={{
        ...(animating && height !== undefined ? { height } : null),
        transitionDuration: `${durationMs}ms`,
      }}
    >
      <div className="sn-height-inner" ref={ref}>
        {children}
      </div>
    </div>
  );
}

/** The default kit, bound to `<Player>`. */
export const cssAnimations: AnimationKit = {
  StepHost,
  Item,
  Height,
};
