# @nickkupriyanov/soundline-react

## 0.2.0

### Minor Changes

- 06f263e: Accessibility hardening.

  - Every queue row is reachable and removable by keyboard: the row is a `<li>` of
    two sibling buttons, the current track is marked with `aria-current` and the
    arrow keys still walk the list. Migration: the `TrackItem` part now takes
    `slotProps` (the `<li>`, with the `ref` the library uses to tell whether a
    removal takes the focus with it), `selectProps` (the button that selects the
    track: name, `aria-current`, tab order, click, arrows and the `ref` the list
    moves focus through) and `removeProps` (the remove button). A part that dropped
    the selecting button loses the keyboard walk as well as the selection.
  - Focus is re-homed inside the card when a state change removes whatever held it —
    a deleted queue row, the playhead of a track that failed — and a focus outside
    the widget is never stolen. `autoFocus` stays opt-in.
  - `a11y.test.tsx` now covers the announcements, the roles, names and states, the
    full Tab walk and an axe pass over eleven widget states; `regressions.test.tsx`
    pins the focus and announcement bugs that were fixed.

- e4ad2ee: Animation kits.

  - `cssAnimations` is now a real kit: the artwork crossfades in the direction the
    queue moved, queue rows stagger by their position, the card follows its
    content's height, the playing row breathes and the filled playhead sweeps.
  - New entry point `@nickkupriyanov/soundline-react/motion` binds the same widget
    to [Motion](https://motion.dev) (`AnimatePresence`, springs, `whileTap`). The
    main entry point never imports it and `motion` stays an optional peer.
  - `AnimationKit.Item` is now the row element itself — an `<li>` that must forward
    its `ref` — instead of a `<button>`: the queue's rows are listbox options, so a
    button could not carry `role="option"` and the list's structure.
    Migration: a custom kit's `Item` renders an `<li>` and spreads its props onto
    it (`ItemProps extends ComponentPropsWithRef<'li'>`).
  - `<Player animations={kit} />` and `createPlayer(kit)` are unchanged in shape and
    now take the kit everywhere the widget animates.

- 86c52bf: The release contract, and the two behavioural gaps it closes.

  - **A removed queue row animates out instead of vanishing.** `QueueList` holds a row that
    was removed through the list for the length of its exit — `useExitingRows`, keyed by the
    removal having been asked for in the list — keeps it in the place it left, marks it
    `data-sn-exiting` and `aria-hidden`, takes both of its buttons out of the tab order and
    drops its handlers, then unmounts it. Under `prefers-reduced-motion: reduce` nothing is
    held at all, and a queue the application replaced, a shuffle or a `context` switch stay
    instant. `TrackItemPartProps.slotProps` documents the two attributes a replacement must
    keep.
  - **The error state says what failed.** It renders `view.errorMessage` rather than
    `messages.genericError`, so a playlist that could not be fetched no longer blames a
    track, and a format the browser refuses says that instead. No public signature changed.
  - **Documentation and licence.** The package README is a real README and the tarball ships
    the MIT `LICENSE`. `verify:install` now asserts that both are in the packed tarball.

- bab1c69: Media Session integration and hidden-tab pause.

  - `mediaSession` (prop) now actually does something: the widget claims
    `navigator.mediaSession`, publishing the current track as `MediaMetadata`
    (`title`/`artist`/`album`/`artwork`), the `playing`/`paused`/`none` state and the
    position, and binding `play`, `pause`, `nexttrack`, `previoustrack`,
    `seekbackward`, `seekforward` and `seekto` to the controller's actions.
    `mediaSession: true` uses the default 10-second skip distance;
    `mediaSession={{ skipSeconds }}` overrides it; anything else leaves the session
    unclaimed. Where the API — or an individual action — is missing, the widget
    falls back silently.
  - `pauseWhenHidden` (default `false`) pauses playback when the document becomes
    hidden. Nothing resumes on its own when the tab comes back.
  - The binding lives in `usePlayerController`, so both `<Player>` and the headless
    `usePlayerFlow` get it. No public signature changed.

- d62ee45: Server rendering and hydration, as a documented and tested guarantee.

  - The first render is deterministic on both sides: `locale` is a prop or the visitor's
    language read **after** mounting, and the theme is `dark` unless the application passes
    one — it is never detected. `lang` on the root now switches to the real tag as an
    ordinary update instead of being part of the first paint.
  - A server pass fetches nothing and builds no `<audio>`: the controller starts after
    mounting and the default engine creates its element on first use.
  - `initialEngineRef` is documented as the telemetry of the pass that produced the markup
    (core's `EngineState`, plain scalars only — `controller.getEngineRef()` returns one). It
    seeds the first paint only; from `start()` on the engine owns the telemetry.
  - `ssr.test.tsx` renders the widget with `renderToString`, hydrates it with `hydrateRoot`
    and fails on any recoverable hydration error, console warning or replaced server node —
    plus a negative control that proves the mismatch would be caught. No public signature
    changed; `useBrowserLocale` became the internal `useBrowserDefaults`.

### Patch Changes

- 86c52bf: Fixes from the review of the release candidate.

  - **The current and playing rows are highlighted again.** `QueueList` passed the bare
    slot keys (`trackItemActive`, `trackItemPlaying`) as class names, but the stylesheet
    paints `sn-track-item-active` and `sn-track-item-playing`; the state classes now go
    through the same slot lookup as every other class, so a consumer's
    `classNames.trackItemActive`/`trackItemPlaying` lands in the DOM beside the library class.
  - **A programmatic track change no longer takes the focus.** Returning the focus to the
    card is meant for a focused control that unmounted with a state swap, not for a page
    where nothing is focused: a track chosen by the application while focus was on
    `<body>` used to pull it — and the scroll position — into the widget. The card now
    tracks whether the focus was inside it and takes back only a focus the swap itself
    lost, with `preventScroll`. The same tracking remembers the element that held the focus:
    deleting the last queue row unmounts it, and the browser reports that as `focusout` with
    no related target — the card takes the focus back because the element is detached, while
    a visitor who moved to a live element of the page keeps theirs. Plain text and empty page
    areas fire no `focusin` at all: a microtask checks whether the node is still connected, so
    a delayed error cannot pull the focus back into a player the visitor already left.
  - **A refused removal no longer replays later.** A mark left by a remove click the
    application declined stayed armed, so an unrelated queue update that dropped the same
    row animated it as if that click had just happened. A mark is now answered only by the
    removal it asked for and expires with the exit window otherwise.
  - **A keyboard retry keeps the focus in the player.** Pressing Retry moves the focus to the
    surviving card (`preventScroll`) before `actions.retry()` runs, so the error → loading →
    error/ready swaps never drop it on `<body>`: the next `Tab` reaches the new Retry button
    after another failure and the first control after a recovery. Programmatic retries and
    application-side actions do not move the focus, and a visitor who leaves during the load
    keeps the focus outside.
  - **The volume row is compact and the track is inset.** The default volume is now
    `mute · slider · percentage`: the visible pair is a 32px mute button, an 8px gap and a
    124px slider, centred in the card. The percentage is a hint rather than a column — an
    absolutely positioned readout beside the slider, outside the flow: it appears while the
    slider is dragged or the row has the focus, does not move the pair, is not a tab stop, and
    keeps the remembered level while muted. `useSlider` gained the internal
    `trackInset` so the pointer maps onto the visible track; the thumb fits at 0% and 100%
    instead of hanging over the ends.
  - **The repeat icons are the Tabler pair.** The hand-drawn loop is replaced with
    `repeat`/`repeat-once` at the same 20px box and 2-unit strokes as Shuffle, and the
    single-track mode keeps its readable `1`. Attribution and the MIT licence ship in
    `THIRD-PARTY-LICENSES.md`, with no runtime dependency.
  - **The queue rows show the adapter duration.** `item.durationLabel` is drawn in a stable
    column inside the selecting button, the remove button stays a sibling, and the equalizer
    slot is reserved on every row. No extra request is made for a duration.

- Updated dependencies [06f263e]
- Updated dependencies [e4ad2ee]
- Updated dependencies [86c52bf]
- Updated dependencies [86c52bf]
  - @nickkupriyanov/soundline-core@0.2.0
