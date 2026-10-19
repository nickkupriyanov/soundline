---
'@nickkupriyanov/soundline-core': minor
---

The release contract, plus three rough edges that had been left for it.

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
