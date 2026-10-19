import { useClassNames } from '../context';
import { VOLUME_TRACK_INSET } from '../hooks/useSlider';
import type { VolumePartProps } from '../parts';
import { MuteIcon, VolumeIcon } from './icons';

/** Where the thumb's centre sits on the inset track, as a CSS `left`. */
function thumbLeft(percent: number): string {
  const level = Math.min(Math.max(percent, 0), 100) / 100;
  // The track spans `inset … width - inset`, while a percentage is measured
  // against the whole box. At 0% the centre is the inset, at 100% it is the
  // right edge minus the inset; the correction is linear in between.
  const offset = VOLUME_TRACK_INSET * (1 - level * 2);
  return `calc(${percent}% + ${offset.toFixed(3)}px)`;
}

/**
 * The volume control: the mute button, a short slider and the level in percent.
 *
 * `buttonProps` already carries the `Mute`/`Unmute` name and the `aria-pressed`
 * state, and `sliderProps` carries the drag, the keys and the `slider`
 * contract, so this part only draws the icon, the thumb and the readout.
 *
 * The readout is a plain `<span>`, never a tab stop: the slider already exposes
 * the same number as its `aria-valuetext`. It follows the value a drag is
 * heading for (`percent`), so it moves with the thumb before the level is
 * committed; while muted it keeps showing the remembered level, because muting
 * is not a level of zero.
 *
 * It lives inside the slider and is positioned outside the flow as a hint beside
 * it, so the visible pair — mute button and bar — stays centred whether the
 * number is shown or not.
 *
 * The track is inset by {@link VOLUME_TRACK_INSET} on both sides so the 14px
 * thumb fits at 0% and 100%. The fill, the thumb and the pointer maths all use
 * that same inset — see `useSlider`'s `trackInset`.
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
  const level = Math.round(percent);

  return (
    <div {...slotProps}>
      <button {...buttonProps}>{view.muted ? <MuteIcon /> : <VolumeIcon />}</button>

      <div {...sliderProps}>
        <span className={cls('volumeThumb')} style={{ left: thumbLeft(level) }} />
        <span className={cls('volumeValue')} aria-hidden="true">
          {level}%
        </span>
      </div>
    </div>
  );
}
