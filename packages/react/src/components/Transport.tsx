import { LOOP_MODES, type LoopMode } from '@nickkupriyanov/soundline-core';
import { useClassNames } from '../context';
import type { TransportPartProps } from '../parts';
import {
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
} from './icons';

/**
 * The repeat button walks this cycle: off → all → one → off.
 *
 * The order comes from core's `LOOP_MODES`, so the widget cannot disagree with
 * the value the player accepts. A replacement of the transport receives
 * `onLoop(mode)` and should use this helper rather than re-deriving the cycle.
 */
export function nextLoopMode(mode: LoopMode): LoopMode {
  const position = LOOP_MODES.indexOf(mode);
  return LOOP_MODES[(position + 1) % LOOP_MODES.length] ?? 'off';
}

/**
 * The transport row: shuffle, previous, play/pause, next, repeat.
 *
 * Every button carries its own accessible name, and its state where it has one:
 * `aria-pressed` on the two toggles. The play button does *not* use
 * `aria-pressed` — its name already changes with the state, which is the
 * accessible pattern for a play/pause control — so it reads "Play" or "Pause",
 * never "Pause, pressed".
 *
 * Whether a control can do anything right now is decided in core and arrives as
 * `canPlay`/`canNext`/`canPrev`; the widget only mirrors it into `disabled`.
 */
export function Transport({
  transport,
  slotProps,
  onToggle,
  onNext,
  onPrevious,
  onShuffle,
  onLoop,
}: TransportPartProps) {
  const cls = useClassNames();

  return (
    <div {...slotProps}>
      <button
        type="button"
        className={cls('shuffleButton')}
        aria-pressed={transport.shuffle.active}
        aria-label={transport.shuffle.label}
        disabled={!transport.canPlay}
        onClick={() => onShuffle(!transport.shuffle.active)}
      >
        <ShuffleIcon />
      </button>

      <button
        type="button"
        className={cls('previousButton')}
        aria-label={transport.previousLabel}
        disabled={!transport.canPrev}
        onClick={onPrevious}
      >
        <PreviousIcon />
      </button>

      <button
        type="button"
        className={cls('playButton')}
        aria-label={transport.playLabel}
        disabled={!transport.canPlay}
        onClick={onToggle}
      >
        {transport.action === 'pause' ? <PauseIcon /> : <PlayIcon />}
      </button>

      <button
        type="button"
        className={cls('nextButton')}
        aria-label={transport.nextLabel}
        disabled={!transport.canNext}
        onClick={onNext}
      >
        <NextIcon />
      </button>

      <button
        type="button"
        className={cls('repeatButton')}
        aria-pressed={transport.loop.mode !== 'off'}
        aria-label={transport.loop.label}
        disabled={!transport.canPlay}
        onClick={() => onLoop(nextLoopMode(transport.loop.mode))}
      >
        {transport.loop.mode === 'one' ? <RepeatOneIcon /> : <RepeatIcon />}
      </button>
    </div>
  );
}
