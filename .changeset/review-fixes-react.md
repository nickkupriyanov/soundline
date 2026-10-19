---
'@nickkupriyanov/soundline-react': patch
---

Fixes from the review of the release candidate.

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
