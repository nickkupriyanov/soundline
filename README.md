# Soundline

A modern, accessible audio player for React — **single track and playlist** — in one
drop-in component.

- 🌘 **Dark theme by default**, light theme included, both driven by plain CSS variables.
- 🧩 **Bring your own tracks** — one small `adapter` interface for the track source
  and one `engine` interface for playback. No vendor lock-in, no iframe.
- 🫧 **Soft animations out of the box** (pure CSS, zero runtime) with an optional
  [Motion](https://motion.dev) entry point for spring transitions.
- 🌍 **Locales done properly** — `en`/`ru` copy shipped, any tag works, `messages`
  overrides any single string.
- ♿ **Accessible by default** — the seek bar and volume are real ARIA sliders with full
  keyboard control, every queue row is reachable and removable by keyboard, track changes
  and play/pause are announced through a live region, and reduced motion is honoured.
- 📦 **Tiny**, with no third-party runtime dependencies.

> Status: under construction. The public API, docs and examples land with the first
> release; the roadmap is in [`roadmap.md`](./roadmap.md).

---

## Install

```bash
pnpm add @nickkupriyanov/soundline-react
```

`react` and `react-dom` (`^18.2 || ^19`) are peer dependencies. `motion` is optional
and only needed for the `/motion` entry point.

The flow, the helpers, the copy, the class names and the stylesheet live in
**`@nickkupriyanov/soundline-core`** — the framework-free half of Soundline, published
separately so another binding can reuse it. The React package depends on it, so you
normally never install it by hand.

## Theming

The stylesheet is one file of plain CSS custom properties — no Tailwind, no CSS-in-JS,
no build step:

```css
.sn-root {
  --sn-width: 420px;
  --sn-accent: #7c5cff;
  --sn-surface: #101018;
}
```

The player tokens are `--sn-width`, `--sn-width-compact`, `--sn-artwork-radius`,
`--sn-seek-height`, `--sn-seek-fill`, `--sn-queue-max-height` and `--sn-card-gap`; the
palette is
`--sn-surface`/`--sn-panel`/`--sn-control`, `--sn-text`/`--sn-text-muted`,
`--sn-accent` and `--sn-border`. The light theme is the same set under
`[data-sn-theme='light']`, which the widget sets from the resolved theme.

## Animations

Animations are pure CSS and ship with the stylesheet — no runtime, no extra dependency.
The widget renders through an `AnimationKit`, so a whole animation layer is one prop:

| Primitive  | What it animates                                               |
| ---------- | -------------------------------------------------------------- |
| `StepHost` | the artwork on a track change: a crossfade in either direction |
| `Item`     | a queue row: the stagger of its position, the press feedback   |
| `Height`   | the card, following the height of the content it holds         |

```tsx
import { Player } from '@nickkupriyanov/soundline-react';

<Player adapter={adapter} />; // cssAnimations, the default kit
```

For spring animations use the `/motion` entry point. It needs
[Motion](https://motion.dev) as an **optional** peer; the main entry point never imports
it, so an application that does not opt in never ships it.

```tsx
import { Player } from '@nickkupriyanov/soundline-react/motion';
```

`prefers-reduced-motion: reduce` is honoured everywhere: the stylesheet collapses every
animation, the spring kit drops its durations, and the height is not even measured.
The playing row's equalizer and the sweep across the filled playhead stop with it.

## Accessibility

Every control is operable by keyboard, carries a role, a name and the states that belong
to it, and is covered by a test.

| Control         | How it is exposed                                                                           |
| --------------- | ------------------------------------------------------------------------------------------- |
| Play / Pause    | one button; the accessible name swaps (`Play` ⇄ `Pause`) and there is no `aria-pressed`     |
| Previous / Next | buttons, named `Previous track` / `Next track`, disabled when there is nowhere to go        |
| Shuffle         | a toggle (`aria-pressed`)                                                                   |
| Repeat          | a toggle walking `Repeat off` → `Repeat playlist` → `Repeat track`                          |
| Mute            | a toggle whose name says what pressing it does (`Mute` ⇄ `Unmute`)                          |
| Seek bar        | `role="slider"` with `aria-valuemin`/`max`/`now` and the position in words (`0:00 of 1:40`) |
| Volume          | the same slider contract, with the percentage in words                                      |
| Queue row       | two sibling buttons — one selects the track, one removes it — never one inside the other    |
| Playlist        | a labelled list; the current row carries `aria-current`, the rows are walked with arrows    |

Play/pause has no `aria-pressed` on purpose: "Pause, pressed" is a state nobody asked to
hear, and the button's name already says what it will do. The toggles that genuinely have
an on/off state do carry it.

**Announcements.** One polite live region (`role="status"`) speaks one thing at a time, in
order of how much it matters: an error, the end of the playlist, the list still arriving,
an empty list, and otherwise the track itself — `Now playing: {title}` while it plays and
`Paused: {title}` when it stops. The pause goes through the region because the name swap of
an unfocused button is never spoken.

**Focus.** Nothing is focused on mount. When a change removes whatever had the focus — the
row a visitor just deleted, the playhead of the track that failed — the focus is re-homed
inside the card instead of falling to `<body>`, and a focus outside the widget is never
stolen. `autoFocus` is opt-in.

**Keyboard.** `Tab` reaches every control in reading order and leaves the widget again;
arrows, `Home` and `End` move the seek bar, the volume and the queue rows without the focus
escaping.

Every string is a key in `messages` (`playerLabel`, `currentTrackLabel`, `pausedTrackLabel`,
`trackLabel`, `removeTrackLabel`, `loadingLabel`, `emptyLabel`, `genericError`,
`endedLabel`, …), so the whole accessible surface can be translated or overridden.

Automated checks run in `pnpm test`: an axe pass (`jest-axe`) over every state the widget can
be in — idle, playing, paused, ended, loading, empty, failures, both themes, compact — fails
the build on any violation. Contrast is checked in the browser pass instead, because
`jsdom` applies no stylesheet.

## Development

```bash
pnpm install
pnpm dev         # React playground
pnpm test        # vitest
pnpm typecheck   # all packages
pnpm build       # core, then the React binding
```

```

packages/core       framework-free core (@nickkupriyanov/soundline-core)
  src/styles        tokens.css → base.css → soundline.css (concatenated at build time)
packages/react      the React binding (@nickkupriyanov/soundline-react)

```

## License

MIT © Nick Kupriyanov
