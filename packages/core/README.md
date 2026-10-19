# @nickkupriyanov/soundline-core

The framework-free half of [Soundline](../../README.md): the player reducer, the derived
view model, the controller, the playback engine and track source contracts, the copy and
the stable class names. A binding renders it; this package decides what happens.

- **No React, no DOM.** No module touches `window` or `document` at import time, so the
  core is safe to import on a server.
- **Nothing happens when a controller is created.** Requests, engine subscriptions and
  timers start in `start()` and are released in `stop()`; both are idempotent.
- **Side effects are injected.** Playback goes through a `PlaybackEngine`, tracks through
  a `TrackSourceAdapter` — both replaceable, both faked in the tests.

## Entry points

| Entry point                                 | What it carries                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `@nickkupriyanov/soundline-core`            | the whole model: controller, reducer, `derivePlayerView`, contracts, copy, class names |
| `@nickkupriyanov/soundline-core/dom`        | framework-free DOM helpers: focus, size, media queries, height, visibility             |
| `@nickkupriyanov/soundline-core/styles.css` | the stylesheet: tokens, base layer, component layer, animations                        |

## Install

```bash
pnpm add @nickkupriyanov/soundline-core
```

Install it on its own to build another binding, or to drive the flow without rendering the
React widget. The React package depends on this one, so an application that uses
`@nickkupriyanov/soundline-react` normally never installs it by hand.

## Minimal use

```ts
import {
  createMockAdapter,
  createPlayerController,
  createStaticAdapter,
} from '@nickkupriyanov/soundline-core';

const controller = createPlayerController({
  adapter: createStaticAdapter([{ id: 'a', title: 'Alpha', src: '/audio/a.mp3' }]),
  onProgress: (seconds) => console.log(seconds),
});

const unsubscribe = controller.subscribe(() => {
  const { view } = controller.getSnapshot();
  console.log(view.nowPlaying?.title ?? '—', view.live.message);
});

controller.start(); // fetches the list and loads the first track
controller.actions.toggle();
controller.actions.seek(30);

controller.stop();
unsubscribe();
```

`createMockAdapter` and `createMockEngine` replace the network and the audio element with
deterministic fakes, which is how this package's own tests run the whole flow without
React or a browser.

## Documentation

The contract — the domain model, the controller, the engine and adapter interfaces, the
error codes, the copy keys, the class slots, the tokens and the DOM hooks — is in
[`docs/specification.md`](../../docs/specification.md). The widget built on top of this
package is documented in the [repository README](../../README.md).

## License

MIT © Nick Kupriyanov — see [LICENSE](./LICENSE).
