import type { ComponentPropsWithoutRef } from 'react';

/**
 * The icons the transport draws. They exist now so Iteration 7 has its seats;
 * every icon is decorative (`aria-hidden`) and takes its colour from
 * `currentColor`.
 */

function Icon({ children, ...props }: ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  );
}

export function PlayIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <Icon {...props}>
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </Icon>
  );
}

export function PauseIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <Icon {...props}>
      <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" />
    </Icon>
  );
}

export function PreviousIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <Icon {...props}>
      <path d="M7 5h2v14H7zM19 5.5v13L9.5 12z" fill="currentColor" />
    </Icon>
  );
}

export function NextIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <Icon {...props}>
      <path d="M15 5h2v14h-2zM5 5.5v13L14.5 12z" fill="currentColor" />
    </Icon>
  );
}
