import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { clamp, format, type VolumeView } from '@nickkupriyanov/soundline-core';
import { useClassNames, useUI } from '../context';
import { MuteIcon, VolumeIcon } from './icons';

/** How far `PageUp`/`PageDown` travel, in multiples of `volumeStep`. */
const PAGE_FACTOR = 10;

/** Everything the volume control renders and does. */
export interface VolumeControlProps {
  /** The volume as the flow derived it: level, mute flag and labels. */
  view: VolumeView;
  /** Level one keyboard step moves, `0..1`. */
  volumeStep: number;
  /** Commits a new level, `0..1`. */
  onVolumeChange(volume: number): void;
  /** Flips the mute flag. */
  onToggleMute(): void;
}

/**
 * The volume control: a mute button and a real slider.
 *
 * The slider keeps its own value only while a pointer drag is in flight, exactly
 * like the seek bar: the fill, the thumb and `aria-valuetext` follow the pointer,
 * and the engine's level is updated once, on release.
 *
 * Muting never loses the level — `volume` and `muted` are separate values in core
 * — so unmuting restores it. Touching the slider is itself a request to hear
 * something, so moving it (by pointer or by key) lifts the mute; that is why the
 * control receives `onToggleMute` next to `onVolumeChange` rather than reading
 * the flag itself.
 */
export function VolumeControl({
  view,
  volumeStep,
  onVolumeChange,
  onToggleMute,
}: VolumeControlProps) {
  const cls = useClassNames();
  const { messages } = useUI();
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragVolume, setDragVolume] = useState<number | null>(null);

  const dragging = dragVolume !== null;
  const volume = clamp(dragVolume ?? view.volume, 0, 1);
  const percent = Math.round(volume * 100);
  const valueText = format(messages.volumeValue, { percent });

  /** Applies a level, lifting the mute and skipping a no-op write. */
  const commit = useCallback(
    (next: number): void => {
      const value = clamp(next, 0, 1);
      if (value !== view.volume) onVolumeChange(value);
      if (view.muted) onToggleMute();
    },
    [onToggleMute, onVolumeChange, view.muted, view.volume],
  );

  const volumeAt = useCallback((clientX: number): number => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    // Without capture the drag ends the moment the pointer leaves the thin bar.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragVolume(volumeAt(event.clientX));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return;
    setDragVolume(volumeAt(event.clientX));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return;
    const next = volumeAt(event.clientX);
    setDragVolume(null);
    commit(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = volumeStep > 0 ? volumeStep : 0.05;

    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = volume + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = volume - step;
        break;
      case 'PageUp':
        next = volume + step * PAGE_FACTOR;
        break;
      case 'PageDown':
        next = volume - step * PAGE_FACTOR;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = 1;
        break;
      default:
        break;
    }
    if (next === null) return;

    // The keys are the slider's own: the page must not scroll under them.
    event.preventDefault();
    setDragVolume(null);
    commit(next);
  };

  return (
    <div className={cls('volume')}>
      <button
        type="button"
        className={cls('volumeButton')}
        aria-label={view.label}
        aria-pressed={view.muted}
        onClick={onToggleMute}
      >
        {view.muted ? <MuteIcon /> : <VolumeIcon />}
      </button>

      <div
        ref={rootRef}
        className={cls('volumeSlider')}
        role="slider"
        tabIndex={0}
        aria-label={messages.volumeLabel}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={valueText}
        data-sn-dragging={dragging ? 'true' : undefined}
        style={{ '--sn-volume-percent': `${percent}%` } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDragVolume(null)}
        onLostPointerCapture={() => setDragVolume(null)}
        onKeyDown={onKeyDown}
      >
        <span className={cls('volumeThumb')} style={{ left: `${percent}%` }} />
      </div>
    </div>
  );
}
