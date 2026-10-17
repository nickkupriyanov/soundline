---
'@nickkupriyanov/soundline-core': minor
---

Animation layer for the widget: a new authored stylesheet
`src/styles/animations.css` (step host, staggering queue rows, animated height,
the playing row's equalizer, the sweep across the filled playhead), the two new
class slots `eq` and `trackLine` in `SN_CLASS`, and the `--sn-card-gap` token the
card and the height container share.

The animation layer reads three DOM hooks a binding must write — `data-sn-playing`
on the root, `data-sn-animating` and `data-sn-motion` on the height container.
Everything in it is optional: without the stylesheet the widget behaves exactly
the same, and `prefers-reduced-motion: reduce` collapses all of it.
