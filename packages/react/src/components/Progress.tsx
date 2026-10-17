import type { ProgressView } from '@nickkupriyanov/soundline-core';
import { useClassNames } from '../context';

/**
 * The visual playhead.
 *
 * A presentational stub for now: it paints track, buffer, fill and thumb from
 * the derived percentages and is hidden from assistive technology. The
 * interactive slider — `role="slider"`, keyboard, drag, `aria-valuetext` —
 * arrives with `SeekBar` in Iteration 7.
 */
export function Progress({ progress }: { progress: ProgressView }) {
  const cls = useClassNames();

  return (
    <div className={cls('seek')} aria-hidden="true">
      <div className={cls('seekTrack')}>
        <div className={cls('seekBuffered')} style={{ width: `${progress.bufferedPercent}%` }} />
        <div className={cls('seekFill')} style={{ width: `${progress.percent}%` }} />
        <div className={cls('seekThumb')} style={{ left: `${progress.percent}%` }} />
      </div>
    </div>
  );
}
