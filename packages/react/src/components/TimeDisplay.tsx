import type { ProgressView } from '@nickkupriyanov/soundline-core';
import { useClassNames } from '../context';

/** Everything the time readout shows. */
export interface TimeDisplayProps {
  /** The playhead, with both labels already formatted. */
  progress: ProgressView;
}

/**
 * `1:23  4:05` — the elapsed time and the total, side by side.
 *
 * The readout is a plain text pair, not a live region: the announcement of the
 * playhead belongs to the seek bar's `aria-valuetext`, and repeating it here
 * would have a screen reader speak every tick twice.
 */
export function TimeDisplay({ progress }: TimeDisplayProps) {
  const cls = useClassNames();

  return (
    <div className={cls('timeDisplay')}>
      <span className={cls('currentTime')}>{progress.positionLabel}</span>
      <span className={cls('totalTime')}>{progress.durationLabel}</span>
    </div>
  );
}
