---
'@nickkupriyanov/soundline-react': minor
---

Animation kits.

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
