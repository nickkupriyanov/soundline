---
'@nickkupriyanov/soundline-react': minor
---

Media Session integration and hidden-tab pause.

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
