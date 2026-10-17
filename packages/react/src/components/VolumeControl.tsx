import { useClassNames } from '../context';
import type { VolumePartProps } from '../parts';
import { MuteIcon, VolumeIcon } from './icons';

/**
 * The volume control: a mute button and a slider, both wired by the library.
 *
 * `buttonProps` already carries the `Mute`/`Unmute` name and the `aria-pressed`
 * state, and `sliderProps` carries the drag, the keys and the `slider`
 * contract, so this part only draws the icon and the thumb.
 *
 * Muting never loses the level — `volume` and `muted` are separate values in
 * core — so unmuting restores it, and moving the slider is itself a request to
 * hear something, which lifts the mute.
 */
export function VolumeControl({
  view,
  percent,
  slotProps,
  buttonProps,
  sliderProps,
}: VolumePartProps) {
  const cls = useClassNames();

  return (
    <div {...slotProps}>
      <button {...buttonProps}>{view.muted ? <MuteIcon /> : <VolumeIcon />}</button>

      <div {...sliderProps}>
        <span className={cls('volumeThumb')} style={{ left: `${percent}%` }} />
      </div>
    </div>
  );
}
