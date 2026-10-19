import { useClassNames } from '../context';
import type { HeaderPartProps } from '../parts';

/**
 * The header row of the queue: the list's name and how many tracks it holds.
 *
 * Both strings are the derived ones, so the row speaks the active locale without
 * formatting anything itself. The layout is the `sn-header` slot the stylesheet
 * already dresses: the heading lines up with the row titles, and the count is
 * plain muted text pushed to the end rather than a second chip.
 */
export function Header({ label, countLabel, slotProps }: HeaderPartProps) {
  const cls = useClassNames();

  return (
    <div {...slotProps}>
      <span>{label}</span>
      <span className={cls('queueCount')}>{countLabel}</span>
    </div>
  );
}
