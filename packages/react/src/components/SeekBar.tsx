import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  DEFAULT_SEEK_STEP,
  clamp,
  format,
  formatDuration,
  type ProgressView,
} from '@nickkupriyanov/soundline-core';
import { useClassNames, useUI } from '../context';

/** How far `PageUp`/`PageDown` travel, in multiples of `seekStep`. */
const PAGE_FACTOR = 10;

/** Everything the seek bar renders and does. */
export interface SeekBarProps {
  /** The playhead as the flow derived it. */
  progress: ProgressView;
  /** Whether seeking is possible right now; `false` renders a disabled slider. */
  canSeek: boolean;
  /** Seconds one arrow-key step moves. */
  seekStep: number;
  /** Commits a new playhead position, in seconds. */
  onSeek(seconds: number): void;
}

/**
 * The playhead, as a real slider.
 *
 * While a pointer drag is in flight the component keeps the value it is dragging
 * in its own state: the fill, the thumb and `aria-valuetext` follow the pointer,
 * and the playhead only moves once on release. That keeps a drag from fighting
 * the engine's own ticks, and it is also why a tick cannot pull the thumb back
 * under the pointer — nothing but the release calls `seek()`.
 *
 * The keyboard is the second half of the same contract: arrows move by
 * `seekStep`, `PageUp`/`PageDown` by ten steps, `Home`/`End` jump to the ends,
 * and every one of them is applied at once.
 */
export function SeekBar({ progress, canSeek, seekStep, onSeek }: SeekBarProps) {
  const cls = useClassNames();
  const { messages } = useUI();
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragPosition, setDragPosition] = useState<number | null>(null);

  const duration = progress.duration;
  const dragging = dragPosition !== null;
  const position = clamp(dragPosition ?? progress.position, 0, duration);
  const percent = duration > 0 ? clamp((position / duration) * 100, 0, 100) : 0;
  const valueText = format(messages.seekValue, {
    position: formatDuration(position),
    duration: progress.durationLabel,
  });

  const positionAt = useCallback(
    (clientX: number): number => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || duration <= 0) return 0;
      return clamp((clientX - rect.left) / rect.width, 0, 1) * duration;
    },
    [duration],
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!canSeek) return;
    // Without capture the drag ends the moment the pointer leaves the thin bar.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragPosition(positionAt(event.clientX));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return;
    setDragPosition(positionAt(event.clientX));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return;
    const next = positionAt(event.clientX);
    setDragPosition(null);
    onSeek(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!canSeek) return;
    const step = seekStep > 0 ? seekStep : DEFAULT_SEEK_STEP;
    const current = position;

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
        next = current + step * PAGE_FACTOR;
        break;
      case 'PageDown':
        next = current - step * PAGE_FACTOR;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = duration;
        break;
      default:
        break;
    }
    if (next === null) return;

    // The keys are the slider's own: the page must not scroll under them.
    event.preventDefault();
    setDragPosition(null);
    const value = clamp(next, 0, duration);
    if (value !== progress.position) onSeek(value);
  };

  return (
    <div
      ref={rootRef}
      className={cls('seek')}
      role="slider"
      tabIndex={canSeek ? 0 : -1}
      aria-label={messages.seekLabel}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(position)}
      aria-valuetext={valueText}
      aria-disabled={canSeek ? undefined : true}
      data-sn-dragging={dragging ? 'true' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDragPosition(null)}
      onLostPointerCapture={() => setDragPosition(null)}
      onKeyDown={onKeyDown}
    >
      <div className={cls('seekTrack')}>
        <div className={cls('seekBuffered')} style={{ width: `${progress.bufferedPercent}%` }} />
        <div className={cls('seekFill')} style={{ width: `${percent}%` }} />
        <div className={cls('seekThumb')} style={{ left: `${percent}%` }} />
      </div>
    </div>
  );
}
