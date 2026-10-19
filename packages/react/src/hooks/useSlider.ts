/**
 * The slider contract, prepared once for every slider in the widget.
 *
 * A slider a part renders must not re-implement the behaviour that makes it a
 * slider: the pointer drag that only commits on release, the arrow/`Home`/`End`
 * keys, the `aria-valuenow`/`aria-valuetext` pair and the "the page must not
 * scroll under the keys" rule. That behaviour lives here, and a part receives
 * the finished bundle in `slotProps`.
 *
 * The hook is deliberately internal: a consumer replaces the *look* of a slider
 * through `SeekBar`/`Volume`, never the maths.
 */
import {
  useCallback,
  useState,
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { clamp } from '@nickkupriyanov/soundline-core';
import type { SlotProps } from '../parts';

/** How far `PageUp`/`PageDown` travel, in multiples of the step. */
export const PAGE_FACTOR = 10;

/**
 * How far the volume slider's visual track sits from the edges of its box.
 *
 * The thumb is 14px and the track is shorter than the box by this amount on each
 * side, so the circle fits at 0% and 100% instead of hanging over the ends. The
 * pointer maths reads the same number; see `useSlider`'s `trackInset`.
 */
export const VOLUME_TRACK_INSET = 7;

/** The `aria` values of a slider, in the units it speaks (`1:23 of 4:05`, `70%`). */
export interface SliderAria {
  min: number;
  max: number;
  now: number;
  text: string;
}

export interface UseSliderOptions {
  /** The value the flow reports, in the slider's own units. */
  value: number;
  min: number;
  max: number;
  /** How far one arrow key moves, in the slider's own units. */
  step: number;
  /** The slider's accessible name. */
  label: string;
  /** `aria-valuemin`/`max`/`now`/`valuetext` for a given value. */
  aria(value: number): SliderAria;
  /** Extra class for the slider element, already merged with the consumer's. */
  className?: string | undefined;
  /** `false` keeps the slider out of the tab order and reports it as disabled. */
  enabled?: boolean;
  /** Inline hooks for a given value, such as `--sn-volume-percent`. */
  style?(value: number): CSSProperties | undefined;
  /** Commits a value: at once on a key press, on release during a drag. */
  onChange(value: number): void;
  pageFactor?: number;
  /**
   * How far the visual track is inset from the element's edges, in pixels.
   *
   * The pointer is mapped onto the same inset span, so the ends of the track are
   * exactly the ends of the value range: a press on the visible start reads
   * `min`, a press on the visible end reads `max`, and neither jumps. Default:
   * `0` (the element's whole box is the track).
   */
  trackInset?: number;
}

export interface SliderControls {
  /** The value on screen: the dragged one while a drag is in flight. */
  value: number;
  dragging: boolean;
  /** Spread on the slider element: the whole `slider` contract. */
  slotProps: SlotProps<ComponentPropsWithoutRef<'div'>>;
}

/**
 * Wires a slider element.
 *
 * The value a drag is heading for is kept here and nowhere else, so an engine
 * tick cannot pull the thumb back under the pointer, and `onChange` is called
 * exactly once per gesture.
 */
export function useSlider(options: UseSliderOptions): SliderControls {
  const {
    value,
    min,
    max,
    step,
    label,
    aria,
    className,
    enabled = true,
    style,
    onChange,
    pageFactor = PAGE_FACTOR,
    trackInset = 0,
  } = options;

  const [dragValue, setDragValue] = useState<number | null>(null);

  const dragging = dragValue !== null;
  const current = clamp(dragValue ?? value, min, max);

  /** Where a pointer sits on the bar, in the slider's own units. */
  const positionAt = useCallback(
    (clientX: number, element: HTMLElement): number => {
      const rect = element.getBoundingClientRect();
      // A track that is inset by more than its own half-width would otherwise
      // divide by zero; fall back to the range's start.
      const inset = Math.min(Math.max(trackInset, 0), rect.width / 2);
      const width = rect.width - inset * 2;
      if (width <= 0 || max <= min) return min;
      return clamp(((clientX - rect.left - inset) / width) * (max - min) + min, min, max);
    },
    [max, min, trackInset],
  );

  const commit = useCallback(
    (next: number): void => {
      setDragValue(null);
      onChange(clamp(next, min, max));
    },
    [max, min, onChange],
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!enabled) return;
    // Without capture the drag ends the moment the pointer leaves the thin bar.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragValue(positionAt(event.clientX, event.currentTarget));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return;
    setDragValue(positionAt(event.clientX, event.currentTarget));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return;
    const next = positionAt(event.clientX, event.currentTarget);
    setDragValue(null);
    onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!enabled) return;

    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = current + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = current - step;
        break;
      case 'PageUp':
        next = current + step * pageFactor;
        break;
      case 'PageDown':
        next = current - step * pageFactor;
        break;
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
      default:
        break;
    }
    if (next === null) return;

    // The keys are the slider's own: the page must not scroll under them.
    event.preventDefault();
    commit(next);
  };

  const ariaValues = aria(current);

  return {
    value: current,
    dragging,
    slotProps: {
      className,
      role: 'slider',
      tabIndex: enabled ? 0 : -1,
      'aria-label': label,
      'aria-orientation': 'horizontal',
      'aria-valuemin': ariaValues.min,
      'aria-valuemax': ariaValues.max,
      'aria-valuenow': ariaValues.now,
      'aria-valuetext': ariaValues.text,
      'aria-disabled': enabled ? undefined : true,
      'data-sn-dragging': dragging ? 'true' : undefined,
      style: style?.(current),
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: () => setDragValue(null),
      onLostPointerCapture: () => setDragValue(null),
      onKeyDown,
    },
  };
}
