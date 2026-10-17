import type { CSSProperties } from 'react';
import { cx } from '@nickkupriyanov/soundline-core';
import type { AnimationKit, HeightProps, ItemProps, StepHostProps } from '../types';

/**
 * The default animation kit: no runtime, no dependencies.
 *
 * This is the minimal shell the skeleton renders through so `createPlayer()` and
 * a provider already agree on the kit's shape. The real CSS transitions — the
 * artwork crossfade, the queue stagger, the height follow — land with Iteration
 * 10; here every primitive is a plain wrapper that only sets its hook class and
 * the `--sn-index` custom property.
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

function Item({ index, className, style, type = 'button', children, ...rest }: ItemProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx('sn-stagger-item', className)}
      style={{ ...style, '--sn-index': index } as CSSProperties}
    >
      {children}
    </button>
  );
}

function Height({ className, children }: HeightProps) {
  return <div className={cx('sn-height', className)}>{children}</div>;
}

/** The default kit, bound to `<Player>`. */
export const cssAnimations: AnimationKit = {
  StepHost,
  Item,
  Height,
};
