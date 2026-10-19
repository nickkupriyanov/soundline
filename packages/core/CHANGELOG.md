# @nickkupriyanov/soundline-core

## 0.2.0

### Minor Changes

- 06f263e: Accessibility hardening, and the queue structure it required.

  - **The queue is a plain list of rows, each holding two sibling buttons** — one
    selects the track, one removes it — instead of a `listbox` of `option`s with the
    remove button nested inside. A focusable control inside an option is invalid
    (axe `nested-interactive`, WCAG 4.1.2: `option` has `childrenPresentational`),
    so the selected row is now marked with `aria-current` on the button that selects
    it, and the roving tab index, the arrow keys and `Home`/`End` are unchanged.
    Migration: the new class slot `trackSelect` (`sn-track-select`) carries the
    button that selects a track, `.sn-track-item` is the row itself (the layout of
    the two buttons) and no longer carries the padding, the pointer cursor or the
    `[aria-selected='true']` state — style `.sn-track-item-active` and
    `.sn-track-select` instead.
  - New copy key `pausedTrackLabel` (`'Paused: {title}'` / `'Пауза: {title}'`). The
    live region announces a pause in words, because the name swap of an unfocused
    play button is never spoken.
  - A track list that could not be fetched is no longer swallowed:
    `derivePlayerView(...).error` carries the list failure as it carries a failed
    source, `loading` is false and `actions.canRetry` is true for it (the controller
    re-fetches the list). Migration: a widget that used to show an empty card with a
    forever-"loading" announcement now shows the error state; the copy is the
    generic one for now.

- e4ad2ee: Animation layer for the widget: a new authored stylesheet
  `src/styles/animations.css` (step host, staggering queue rows, animated height,
  the playing row's equalizer, the sweep across the filled playhead), the two new
  class slots `eq` and `trackLine` in `SN_CLASS`, and the `--sn-card-gap` token the
  card and the height container share.

  The animation layer reads three DOM hooks a binding must write — `data-sn-playing`
  on the root, `data-sn-animating` and `data-sn-motion` on the height container.
  Everything in it is optional: without the stylesheet the widget behaves exactly
  the same, and `prefers-reduced-motion: reduce` collapses all of it.

- 86c52bf: The release contract, plus three rough edges that had been left for it.

  - **Documentation and licence.** `docs/specification.md` is now the final contract
    (domain model, configuration table, the public API of core and of `/dom`, the copy
    keys, the class slots, the tokens, the DOM hooks and what proves each invariant)
    rather than a draft, and the package ships the MIT `LICENSE` its `files` array
    promised.
  - **`queueHeader` is gone.** The slot has had no markup since the queue's header moved
    to the `header` slot, and its `.sn-queue-header` rules styled nothing. Migration: a
    `classNames={{ queueHeader: '…' }}` entry has no slot to land in any more — the queue's
    header is `header` (`sn-header`).
  - **A track list that could not be fetched has its own copy.** New message key
    `queueError` ("The playlist could not be loaded."), and `derivePlayerView(...)` now
    exposes the failure in words as `errorMessage`, chosen by what failed: `error.phase ===
'tracks'` is the list, `error.code === 'NOT_SUPPORTED'` is the format, anything else is
    the generic string. `unsupportedLabel` was declared and translated but nothing ever
    rendered it; the error state and the live region use it now. Migration: a dictionary
    passed as a whole — `messages={{ … }}` with every key of `SoundlineMessages` — needs
    `queueError`; `errorMessage` is additive, and a binding that used to render
    `messages.genericError` for every failure should render `view.errorMessage` instead.
  - **A row removed through the queue leaves with a transition.** The stylesheet gains the
    exit of `.sn-track-item[data-sn-exiting='true']` (a fade and a collapse), the token
    `--sn-row-max-height` it collapses from, and the `data-sn-exiting` DOM hook a binding
    writes on a row it is holding mounted. The duration is the local variable
    `--sn-exit-duration`, written inline by the binding so that the transition and the
    timer that unmounts the row share one number. A kit that animates itself keeps its own
    movement: the rule skips rows marked `data-sn-motion='true'`.

### Patch Changes

- 86c52bf: Fixes from the review of the release candidate.

  - **`updateEngine()` stops the backend it replaces.** The old engine was detached but
    never paused, so it kept playing underneath the new one while `stop()` only reached
    the new engine. The swap now pauses the previous backend (after detaching, so the
    pause is not mirrored as a state change) and aborts a source resolution that was in
    flight for it, so the new engine gets a clean load.
  - **A restart during a source load loads the source again.** `stop()` aborted the
    resolution but left the load token claimed, so the next `start()` believed the source
    was already in the engine: the player reported `playing: true` over an idle backend.
    A load that never reached the engine now invalidates its token; a source that did
    land is kept, so a restart still resumes instead of reloading and losing the playhead.
  - **Captions meet WCAG AA in both themes.** `--sn-text-subtle` in the dark theme and
    `--sn-text-muted`/`--sn-text-subtle` in the light one were between 2.0:1 and 3.8:1 on
    the card, the queue panel and a playing row's tinted background, where 4.5:1 is
    required for 12–12.5px text. `styles.test.ts` now measures those tokens against every
    surface they land on.
  - **The seek handle is no longer clipped.** The track had `overflow: hidden`, which sliced
    the 14px handle drawn on the 6px bar; the bar keeps its radius and the fill still clips
    its own sweep.
  - **The button reset no longer overrides component colours.** `.sn-root button` outranked
    `.sn-play-button`, so `color: inherit` replaced the contrast token on Play and the muted
    token on Repeat. The reset now sits at zero specificity (`:where()`), and the browser
    check compares the painted colours with the tokens.
  - **Retry is readable in both themes.** `--sn-danger-contrast` is dark ink (`#141419`) on
    the light dark-theme danger fill (≈6.32:1) and white on `#e0243f` in the light theme
    (≈4.67:1). `styles.test.ts` measures the button and the resting, hover, selected and
    playing queue-row states against their real backgrounds.
  - **Composition tokens and slots.** `--sn-artwork-size` (72px, 88px from a 340px card,
    64px compact), `--sn-volume-width` (208px) and the `progress`, `controls`, `volumeValue`
    and `trackDuration` slots expose the new grouping and the duration column without a
    structural break for existing `classNames` users.
  - **The queue is styled as part of the card.** The panel fill, frame, rounding and inset are
    gone; the header aligns with the row titles, the count is plain muted text, the hover and
    selected rows use the raised control surface, the playing row's tint is 60% of its former
    strength, and the remove button is visible on devices without hover.
  - **A stalled source is a loading state, not a dead end.** `createMediaEngine()` now listens
    to `playing` as well as `play`, so a source that reports `waiting` and then resumes leaves
    the loading block instead of keeping the widget on it while the audio runs. A pause during
    the stall reaches the element (the controller reconciles the engine while `loading` too),
    while a source whose metadata is still arriving is already paused and keeps its status.
  - **The empty slider track is its own token.** `--sn-track` paints the unfilled part of the
    seek and volume bars in both themes; the light theme used `--sn-control`, one step away
    from the card, and the bar disappeared at 0%. `styles.test.ts` measures the track against
    the surface and the buffered part against the track.
  - **The queue has a readable bottom edge.** `--sn-queue-fade` is both the list's bottom pad
    and the height of its mask, so a row cut by `--sn-queue-max-height` fades as "more below"
    and the last row clears the fade at the end of the scroll.
  - **One text column and one right edge in the queue.** The artist is indented by the
    equalizer slot so both lines of a row start together, the heading follows the same line,
    and the right inset (10px padding + 8px gap + 26px removal column) puts the track count on
    the durations' edge.
  - **The visible volume pair is centred.** The mute button (32px) and the slider (124px) are
    the only things in the row's flow, so they sit at the card's centre instead of being pushed
    left by a hidden percentage column; the readout is an absolutely positioned hint beside the
    slider. On coarse pointers the seek and volume bars get an invisible 44px/40px hit area
    without changing the layout.
