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

![The Soundline player in the dark theme](docs/images/player-dark.png)

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

![The same player in the light theme](docs/images/player-light.png)

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

## Media Session and background playback

The browser's own controls — the lock screen, the notification shade, the keyboard's media
keys — are claimed only when asked for, through `mediaSession`:

```tsx
<Player adapter={adapter} mediaSession={{ skipSeconds: 15 }} />
```

The widget then publishes the current track (`title`, `artist`, `album`, `artwork`) and the
`playing`/`paused` state, and routes `play`, `pause`, `nexttrack`, `previoustrack`,
`seekbackward`, `seekforward` and `seekto` back to its actions. `skipSeconds` (default `10`)
is the step the skip buttons use, unless the browser hands one of its own. Where the API is
missing — the server, older browsers — or a single action is unsupported, the widget carries
on silently.

`pauseWhenHidden` stops playback when the document becomes hidden. It is off by default, and
nothing resumes on its own when the tab comes back: that stays the application's call.

## Server rendering

The widget's first render never reads the browser, so the markup a server pass produces is
the markup the client hydrates:

- `locale` is a prop, or the visitor's language **after** mounting — the first render uses
  `en` on both sides, and `lang` then switches to the real tag. `theme` is `dark` unless you
  pass it: it is never detected, because a system light theme must not repaint a player the
  application asked to keep dark.
- A server pass fetches nothing and builds no `<audio>`: the controller starts only after
  mounting, and the default engine creates its element on first use.

The playhead is the one value a server pass cannot derive — the engine that owns it lives on
the client. State it explicitly when the first paint should show it, and hand the same object
to the client:

```tsx
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';

const props = {
  adapter,
  // What lets the pass render the transport and the playhead, not the loading state.
  defaultQueue: tracks,
  locale: 'en',
  theme: 'dark',
  // Core's `EngineState`; a controller's `getEngineRef()` returns one.
  initialEngineRef: engineRef,
};

// server
res.send(`<div id="root">${renderToString(<Player {...props} />)}</div>`);

// client
hydrateRoot(document.getElementById('root')!, <Player {...props} />);
```

`initialEngineRef` seeds the first paint only: from `start()` on, the engine owns the
telemetry. `pnpm test` keeps all of this honest — `ssr.test.tsx` renders and hydrates the
widget and fails the build on any recoverable hydration error or console warning.

## Development

```bash
pnpm install
pnpm dev              # the React playground (Vite) — controls for theme, locale, layout, state
pnpm preview          # the built playground
pnpm storybook        # the component stories
pnpm build-storybook  # a static Storybook
pnpm test             # vitest
pnpm typecheck        # every package
pnpm build            # core, then the React binding
pnpm screenshot       # Chrome screenshot of a URL into docs/images (see tools/screenshot.mjs)
```

Browser-level checks and packaging verification run against the built playground and
the packed tarballs:

```bash
pnpm build && pnpm --filter @nickkupriyanov/soundline-playground build
pnpm --filter @nickkupriyanov/soundline-playground preview   # serve on :4173
pnpm check:layout     # the card's width in every gallery state (real Chrome)
pnpm check:container  # 280/320/400/800 px, queue scroll, focus, reduced motion
pnpm verify:install   # build + pack core and React, install them in clean React 18/19 apps,
                      # production build, SSR + hydration (Node and a real browser)
pnpm verify:install:leg react-18   # one consumer leg
```

```
packages/core              framework-free core (@nickkupriyanov/soundline-core)
  src/styles               tokens.css → base.css → soundline.css (concatenated at build time)
packages/react             the React binding (@nickkupriyanov/soundline-react)
  src/stories              the Storybook stories (widget, states, extensions, headless)
apps/playground            Vite playground + the state gallery (/gallery.html)
tools                      screenshot.mjs (Chrome DevTools Protocol, no extra dependency),
                           check-layout.mjs / check-container.mjs / check-hydration.mjs
                           (real-browser checks) and verify-install.mjs + install-check/
                           (tarball packaging in clean consumer apps)
```

The playground and its gallery run against the sources, so the dev server hot-reloads the
library itself. The gallery at `/gallery.html?theme=light` renders every state the widget
can be in — idle, playing, paused, ended, loading, empty, and both failures — each marked
with `data-sn-case`/`data-sn-state`/`data-sn-layout` for the browser checks.

`verify-install.mjs` is the packaging proof: it builds and `pnpm pack`s both packages,
asserts the packed export maps, the React dependency on core (a real version, never
`workspace:`) and `motion` staying an optional peer, then installs them into React 18 and
React 19 scratch apps in `.verify/` (each with its own npm cache), type-checks them,
builds them for production, hydrates the widget in Node and, finally, hydrates the
prerendered page in a real browser. CI runs the same script — a job that packs the
libraries once, then one independent job per leg.

## License

MIT © Nick Kupriyanov
