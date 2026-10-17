/**
 * The Motion kit: the same three primitives, driven by springs.
 *
 * This module is the only place in the package that imports `motion` — the main
 * entry point never reaches it, and `motion` stays an optional peer. Use it
 * through `@nickkupriyanov/soundline-react/motion`, or by passing
 * `motionAnimations` to `<Player animations={…} />` if `motion` is already in the
 * application.
 */
import { forwardRef, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cx } from '@nickkupriyanov/soundline-core';
import { useAnimatedHeight } from '../hooks/useAnimatedHeight';
import type { AnimationKit, HeightProps, ItemProps, StepHostProps } from '../types';

/** The spring behind the steps and the rows: quick, no overshoot, no bounce. */
const SPRING = { type: 'spring', stiffness: 320, damping: 30 } as const;

/** Rows past this one share the last delay, so a long queue does not crawl in. */
const MAX_STAGGER = 12;

/**
 * Keeps the class hooks of the CSS kit and adds what only a runtime can do: the
 * outgoing artwork stays mounted while the new one comes in, so the change is a
 * real crossfade rather than an entrance on an empty box.
 *
 * `data-sn-motion='true'` is what tells the stylesheet to leave the keyframes to
 * Motion.
 */
function StepHost({ stepKey, direction, className, children }: StepHostProps) {
  const reduced = useReducedMotion();
  const from = direction * 12;

  return (
    <div
      className={cx('sn-step-host', className)}
      data-direction={direction === 1 ? 'forward' : 'back'}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={stepKey}
          className="sn-step"
          data-sn-motion="true"
          initial={reduced ? false : { opacity: 0, x: from, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -from, scale: 0.98 }}
          transition={reduced ? { duration: 0 } : SPRING}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * The event props Motion owns on the element it renders, with signatures of its
 * own — the drag gesture and the animation lifecycle. The queue passes none of
 * them, so they are dropped rather than handed to Motion to reinterpret.
 */
function withoutMotionOwnedEvents({
  onDrag,
  onDragStart,
  onDragEnd,
  onAnimationStart,
  onAnimationEnd,
  onAnimationIteration,
  ...rest
}: ItemProps) {
  return rest;
}

/**
 * A queue row that springs into place, with the delay of a stagger, and presses
 * in under the pointer. Everything behavioural still arrives in `rest` — this is
 * the row element, with the library's prepared props spread on it.
 */
const Item = forwardRef<HTMLLIElement, ItemProps>(function Item(props, ref) {
  const { index, className, style, children } = props;
  const reduced = useReducedMotion();
  const delay = Math.min(index, MAX_STAGGER) * 0.04;

  return (
    <motion.li
      {...withoutMotionOwnedEvents(props)}
      ref={ref}
      className={cx('sn-stagger-item', className)}
      style={{ ...style, '--sn-index': index } as CSSProperties}
      data-sn-motion="true"
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { ...SPRING, delay }}
      whileTap={reduced ? undefined : { scale: 0.985 }}
    >
      {children}
    </motion.li>
  );
});

/**
 * The height, animated by the same measurement the CSS kit uses.
 *
 * The difference is only in who carries it out: Motion springs the height while
 * it is known and lets it fall back to `auto` once it has settled.
 */
function Height({ className, children }: HeightProps) {
  const { ref, height, animating, durationMs } = useAnimatedHeight();
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={cx('sn-height', className)}
      data-sn-motion="true"
      data-sn-animating={animating ? 'true' : undefined}
      initial={false}
      animate={{ height: animating && height !== undefined ? height : 'auto' }}
      transition={
        reduced ? { duration: 0 } : { type: 'spring', bounce: 0, duration: durationMs / 1000 }
      }
    >
      <div className="sn-height-inner" ref={ref}>
        {children}
      </div>
    </motion.div>
  );
}

/** The spring kit, bound to the `Player` of the `/motion` entry point. */
export const motionAnimations: AnimationKit = {
  StepHost,
  Item,
  Height,
};
