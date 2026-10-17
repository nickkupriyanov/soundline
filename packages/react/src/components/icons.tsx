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

/** The two crossing arrows of the shuffle toggle. */
export function ShuffleIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <Icon {...props}>
      <path
        d="M3 7h4l10 10h3M3 17h4l10-10h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 4 20.5 7 17.5 10M17.5 14 20.5 17 17.5 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/** The loop both repeat modes draw; the "track" mode adds a `1` on top. */
function repeatLoop() {
  return (
    <>
      <path
        d="M6 7h12M18 7v4a5 5 0 0 1-5 5H6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 4l3 3-3 3M9 13l-3 3 3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

/** The loop that repeats the playlist. */
export function RepeatIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return <Icon {...props}>{repeatLoop()}</Icon>;
}

/** The same loop with a `1` inside: the repeat button in its "track" mode. */
export function RepeatOneIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <Icon {...props}>
      {repeatLoop()}
      <path
        d="M12 15.2V8.6l-1.7 1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/** The placeholder drawn when a track has no artwork. */
export function NoteIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <Icon {...props}>
      <path
        d="M9.5 18V7.6l9.5-2V16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="18" r="2.6" fill="currentColor" />
      <circle cx="16.5" cy="16" r="2.6" fill="currentColor" />
    </Icon>
  );
}
