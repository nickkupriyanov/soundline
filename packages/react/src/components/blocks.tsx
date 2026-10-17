import { useClassNames } from '../context';
import type { EmptyPartProps, ErrorPartProps, LoadingPartProps } from '../parts';

/**
 * The small default parts.
 *
 * They read the class-name overrides from the UI context — a library default is
 * allowed to — while a part an application supplies receives everything through
 * its props and needs no context at all.
 */

export function LoadingBlock({ label }: LoadingPartProps) {
  const cls = useClassNames();

  return (
    <div className={cls('loading')}>
      <span>{label}</span>
    </div>
  );
}

export function EmptyBlock({ label }: EmptyPartProps) {
  const cls = useClassNames();

  return (
    <div className={cls('empty')}>
      <span>{label}</span>
    </div>
  );
}

export function ErrorBlock({ title, message, retryLabel, onRetry }: ErrorPartProps) {
  const cls = useClassNames();

  return (
    <div className={cls('error')}>
      <span className={cls('title')}>{title}</span>
      <span>{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
