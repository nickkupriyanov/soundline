import { useClassNames } from '../context';
import type { HeaderPartProps } from '../parts';

/**
 * The header row of the queue: the list's name and how many tracks it holds.
 *
 * Both strings are the derived ones, so the row speaks the active locale without
 * formatting anything itself. The layout is the `sn-header` slot the stylesheet
 * already dresses — the count pill pushes itself to the end of the row.
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
