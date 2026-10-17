---
'@nickkupriyanov/soundline-react': minor
---

Accessibility hardening.

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
