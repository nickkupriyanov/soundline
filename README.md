# Soundline

A modern, accessible audio player for React — **single track and playlist** — in one
drop-in component.

- 🌘 **Dark theme by default**, light theme included, both driven by plain CSS variables.
- 🧩 **Bring your own tracks** — one small `adapter` interface for the track source
  and one `engine` interface for playback. No vendor lock-in, no iframe.
- 🫧 **Soft animations out of the box** (pure CSS, zero runtime) with an optional
  [Motion](https://motion.dev) entry point for spring transitions.
- 🌍 **Locales done properly** — `en`/`ru` copy shipped, any tag works, `messages`
  overrides any single string.
- ♿ **Accessible by default** — the seek bar and volume are real ARIA sliders with full
  keyboard control, the queue is a listbox with roving tabindex, track changes are
  announced through a live region, and reduced motion is honoured.
- 📦 **Tiny**, with no third-party runtime dependencies.

> Status: under construction. The public API, docs and examples land with the first
> release; the roadmap is in [`roadmap.md`](./roadmap.md).

---

## Install

```bash
pnpm add @nickkupriyanov/soundline-react
```

`react` and `react-dom` (`^18.2 || ^19`) are peer dependencies. `motion` is optional
and only needed for the `/motion` entry point.

The flow, the helpers, the copy, the class names and the stylesheet live in
**`@nickkupriyanov/soundline-core`** — the framework-free half of Soundline, published
separately so another binding can reuse it. The React package depends on it, so you
normally never install it by hand.

## Development

```bash
pnpm install
pnpm dev         # React playground
pnpm test        # vitest
pnpm typecheck   # all packages
pnpm build       # core, then the React binding
```

```

packages/core       framework-free core (@nickkupriyanov/soundline-core)
  src/styles        tokens.css → base.css → soundline.css (concatenated at build time)
packages/react      the React binding (@nickkupriyanov/soundline-react)

```

## License

MIT © Nick Kupriyanov
