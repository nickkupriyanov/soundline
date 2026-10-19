import type { ComponentPropsWithoutRef } from 'react';

/**
 * The icons the widget draws: transport, volume and the queue's remove button.
 * Every icon is decorative (`aria-hidden`) and takes its colour from
 * `currentColor`; the accessible name always comes from the control's label.
 *
 * The two repeat icons are the Tabler outline icons (MIT), copied in as local
 * SVG so the package takes no runtime dependency. See
 * `THIRD-PARTY-LICENSES.md` for the attribution and the licence text.
 */

/** Tabler draws its outline icons on a 24-unit grid with 2-unit strokes. */
const TABLER = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

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

/**
 * Tabler's `repeat`: a loop that repeats the playlist. The 20px box and 2-unit
 * strokes match `ShuffleIcon` and the other transport glyphs.
 */
export function RepeatIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <Icon {...props}>
      <path d="M4 12v-3a3 3 0 0 1 3-3h13m-3-3 3 3-3 3" {...TABLER} />
      <path d="M20 12v3a3 3 0 0 1-3 3H4m3 3-3-3 3-3" {...TABLER} />
    </Icon>
  );
}

/** Tabler's `repeat-once`: the same loop with the `1` inside it. */
export function RepeatOneIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <Icon {...props}>
      <path d="M4 12v-3a3 3 0 0 1 3-3h13m-3-3 3 3-3 3" {...TABLER} />
      <path d="M20 12v3a3 3 0 0 1-3 3H4m3 3-3-3 3-3" {...TABLER} />
      <path d="m11 11 1-1v4" {...TABLER} />
    </Icon>
  );
}

/** The speaker with two waves: the volume button while sound is on. */
export function VolumeIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <Icon {...props}>
      <path d="M4 9h3l4-3.5v13L7 15H4z" fill="currentColor" />
      <path
        d="M14.5 9.5a3.5 3.5 0 0 1 0 5M17 7a7 7 0 0 1 0 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/** The same speaker with a cross: the volume button while muted. */
export function MuteIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <Icon {...props}>
      <path d="M4 9h3l4-3.5v13L7 15H4z" fill="currentColor" />
      <path
        d="M15 9.5l5 5M20 9.5l-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/** The cross that removes a track from the queue. */
export function RemoveIcon(props: ComponentPropsWithoutRef<'svg'>) {
  return (
    <Icon width={16} height={16} {...props}>
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
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
