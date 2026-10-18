---
'@nickkupriyanov/soundline-react': minor
---

Server rendering and hydration, as a documented and tested guarantee.

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
