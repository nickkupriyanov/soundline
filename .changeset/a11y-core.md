---
'@nickkupriyanov/soundline-core': minor
---

Accessibility hardening, and the queue structure it required.

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
