# @nickkupriyanov/soundline-react

The React binding of [Soundline](../../README.md): a themable, accessible audio player —
single track and playlist — with CSS-variable theming, dark theme by default, soft
animations and a bring-your-own track source.

- **One component.** `<Player adapter={…} />` is a complete player: artwork, transport,
  seek bar, volume, queue, states and announcements.
- **Controlled or uncontrolled.** Every value has a `value`/`defaultValue` pair, so the
  application can own as much or as little as it wants.
- **Replaceable parts.** `classNames` restyles it, `components` swaps any section of it,
  `animations` swaps the whole motion layer.
- **Accessible by default** — ARIA sliders, a keyboard-walkable queue, a polite live
  region, focus that never falls to `<body>`, and reduced motion honoured.

## Install

```bash
pnpm add @nickkupriyanov/soundline-react
```

`react` and `react-dom` (`^18.2 || ^19`) are peer dependencies. `motion` is optional and
only needed for the `/motion` entry point.

## Quick start

```tsx
import { Player, createStaticAdapter } from '@nickkupriyanov/soundline-react';
import '@nickkupriyanov/soundline-react/styles.css';

const tracks = [
  { id: 'alpha', title: 'Alpha', artist: 'One', src: '/audio/alpha.mp3' },
  { id: 'beta', title: 'Beta', artist: 'Two', src: '/audio/beta.mp3' },
];

export function App() {
  return <Player adapter={createStaticAdapter(tracks)} />;
}
```

The stylesheet import is required: the component ships classes, not inline styles.

## Entry points

| Entry point                                  | What it carries                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `@nickkupriyanov/soundline-react`            | `Player`, the provider, the hooks, the replaceable parts, `cssAnimations` |
| `@nickkupriyanov/soundline-react/motion`     | the same surface, bound to the Motion animation kit                       |
| `@nickkupriyanov/soundline-react/styles.css` | the stylesheet (a copy of core's, so one import is enough)                |

## Documentation

[`../../README.md`](../../README.md) is the user guide: the quick start, wiring a real
backend, the full props table, every exposed class, theming, animations, accessibility,
Media Session, server rendering, the mock engine and the known limits.
[`docs/specification.md`](../../docs/specification.md) is the contract. The
framework-free half lives in
[`@nickkupriyanov/soundline-core`](../core/README.md).

## Development

```bash
pnpm --filter @nickkupriyanov/soundline-react storybook   # the stories
pnpm --filter @nickkupriyanov/soundline-react test        # vitest
pnpm --filter @nickkupriyanov/soundline-react build       # tsup, then the stylesheet
```

## License

MIT © Nick Kupriyanov — see [LICENSE](./LICENSE). The repeat icons are from
[Tabler Icons](https://github.com/tabler/tabler-icons) under MIT; the attribution and
licence text ship in [THIRD-PARTY-LICENSES.md](./THIRD-PARTY-LICENSES.md).
