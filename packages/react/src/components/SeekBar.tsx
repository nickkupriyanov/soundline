import { useClassNames } from '../context';
import type { SeekBarPartProps } from '../parts';

/**
 * The playhead, drawn on top of a slider the library wired.
 *
 * `slotProps` is the whole behaviour: the drag, the keys and the `slider`
 * accessibility contract. This part is only the picture — the buffered span, the
 * fill and the thumb — and every position comes from `percent`, which follows a
 * drag while the playhead itself waits for the release.
 */
export function SeekBar({ progress, percent, slotProps }: SeekBarPartProps) {
  const cls = useClassNames();

  return (
    <div {...slotProps}>
      <div className={cls('seekTrack')}>
        <div className={cls('seekBuffered')} style={{ width: `${progress.bufferedPercent}%` }} />
        <div className={cls('seekFill')} style={{ width: `${percent}%` }} />
        <div className={cls('seekThumb')} style={{ left: `${percent}%` }} />
      </div>
    </div>
  );
}
