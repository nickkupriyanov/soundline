---
'@nickkupriyanov/soundline-react': minor
---

The release contract, and the two behavioural gaps it closes.

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
