# Soundline — roadmap

Итеративный план разработки современного аудиоплеера `Soundline` — переиспользуемой
библиотеки в стиле и по инженерным практикам проекта `booking` (Slotline).

- **Пакеты:** `@nickkupriyanov/soundline-core` (framework-free), `@nickkupriyanov/soundline-react`.
- **Префиксы:** классы `sn-*`, токены `--sn-*`, атрибуты `data-sn-*`, слоты классов из `SnClassSlot`.
- **Тема:** тёмная по умолчанию, светлая опционально, акцент `#ff215a` (палитра booking).
- **Объём v1:** одиночный трек + плейлист/очередь; play/pause/seek/volume/loop/shuffle/rate;
  next/prev; выбор трека; Media Session (опционально); доступность by default.
- **Вне v1:** waveform, эквалайзер/визуализация FFT, drag-n-drop переупорядочивание,
  избранное, поиск, интеграция со стриминг-сервисом, скачивание, караоке/тексты.

---

## 0. Принципы (не нарушаем по ходу итераций)

1. **Core без React и без DOM.** Логика, состояние, reducer, производная модель, ошибки,
   i18n живут в core. React только рендерит снимок и подписывается через `useSyncExternalStore`.
2. **Ничего не происходит при создании контроллера.** Запросы, подписки на движок и таймеры
   стартуют в `start()` и снимаются в `stop()`; оба идемпотентны (Strict Mode безопасен).
3. **Побочные эффекты инъектируются.** Воспроизведение — через `PlaybackEngine` (аналог `clock`),
   данные — через `TrackSourceAdapter` (аналог `BookingAdapter`). Оба подменяемы на фейковые.
4. **Управляемые значения по единой модели** `value` / `defaultValue` / `on*Change`, режим
   фиксируется при создании, внешнее обновление не вызывает обратного события.
5. **Позиция воспроизведения не управляемая.** `currentTime` — телеметрия движка, попадает в
   `view`; наружу — троттлинг-событие `onProgress`. `playing` — управляемое.
6. **Тема — только CSS-переменные.** Никакого CSS-in-JS, Tailwind или рантайма стилей.
7. **Производная view — чистая функция** `derivePlayerView(state, config, engineRef)` с кешем
   по ревизиям; в ней нет `Date.now()` (после этапа 4).
8. **Доступность — часть определения готовности, а не полировка.**
9. **Каждая итерация заканчивается зелёными `typecheck`, `test`, `build`.**

### Соглашения

- Один публичный контракт на функцию/тип, JSDoc как в booking.
- Каждый модуль core имеет парный `*.test.ts` рядом.
- Никаких `any` в публичном API; `unknown` + структурные проверки там, где важна устойчивость
  к нескольким копиям пакета (как `isBookingError`).
- Импорт `soundline-core` не обращается к `window`/`document`; DOM — только через подпуть
  `soundline-core/dom` и только внутри функций.

---

## Целевая структура репозитория

```
soundline/
  package.json                 # workspace, scripts (build/test/typecheck/dev/storybook/…)
  pnpm-workspace.yaml
  tsconfig.base.json
  .prettierrc.json
  .changeset/config.json
  .github/workflows/ci.yml
  docs/specification.md
  README.md
  packages/
    core/                      # @nickkupriyanov/soundline-core
      src/
        types.ts               # доменная модель, движок, адаптер, ошибки, i18n, тема
        config.ts              # resolvePlayerConfig + Input/Overrides
        context.ts             # PlaylistContext + helpers
        ids.ts                 # генератор id
        errors.ts              # PlaybackError, isPlaybackError, toPlaybackError
        i18n.ts                # SoundlineMessages, en, ru, format()
        classNames.ts          # SnClassSlot, SN_CLASS, cx
        duration.ts            # formatDuration / parseDuration (без Date.now)
        reducer.ts             # createPlayerState, playerReducer (чистые)
        derive.ts              # derivePlayerView (чистый, кешируемый)
        engine.ts              # PlaybackEngine + createMediaEngine (ленивый)
        adapter.ts             # TrackSourceAdapter + createStaticAdapter
        mock.ts                # createMockEngine, createMockAdapter
        controller.ts          # createPlayerController
        index.ts               # реэкспорты
        dom/                   # soundline-core/dom (перенос из booking)
          focus.ts media.ts size.ts height.ts visibility.ts index.ts (+ тесты)
        styles/
          tokens.css base.css soundline.css index.css
      scripts/                 # postbuild: конкатенация CSS
      tsup.config.ts vitest.config.ts package.json tsconfig.json
    react/                     # @nickkupriyanov/soundline-react
      src/
        index.ts public.ts types.ts
        context.tsx            # PlayerFlowContext, UI context, useComponents/useClassNames
        usePlayerFlow.ts       # usePlayerController + usePlayerFlow + usePlayerUI
        Player.tsx             # PlayerProvider, createPlayer, Player
        parts.tsx              # карта extension-точек + дефолты
        components/
          PlayerView.tsx NowPlaying.tsx Transport.tsx SeekBar.tsx VolumeControl.tsx
          TimeDisplay.tsx Queue.tsx TrackItem.tsx blocks.tsx Progress.tsx icons.tsx
        hooks/                 # useResolvedTheme, useMediaQuery, useFocusTrap, useAnimatedHeight
        animations/            # css.tsx, motion.tsx
        motion.ts
        *.test.tsx
      .storybook/ scripts/ tsup.config.ts vitest.config.ts package.json
  apps/playground/             # Vite-площадка + gallery.html (галерея состояний)
  tools/                       # screenshot.mjs, check-layout.mjs, check-container.mjs,
                               # verify-install.mjs, install-check/{react-18,react-19}
```

---

## Итерации

Легенда статуса: `[ ]` не начато · `[~]` в работе · `[x]` готово.
Отмечать здесь по мере продвижения.

### Iteration 0 — Каркас монорепы · ✅ готово

**Цель:** пустая, но полностью рабочая монорепа с зелёными командами.

Задачи:

- [x] `package.json` (workspace-скрипты: `build`, `dev`, `test`, `typecheck`, `format`,
      `storybook`, `preview`, `screenshot`, `check:layout`, `verify:install`), `pnpm@9.8.0`,
      `engines.node`.
- [x] `pnpm-workspace.yaml`, `tsconfig.base.json`, `.prettierrc.json`, `.gitignore`.
- [x] Манифесты `packages/core` и `packages/react` со `exports` (`.` , `./dom`, `./styles.css`,
      `./motion`), `files: ["dist"]`, `sideEffects: ["**/*.css"]`.
- [x] `tsup.config.ts` в обоих пакетах + `scripts/postbuild.mjs` (копирование собранного CSS в
      тарболы обоих пакетов).
- [x] `vitest.config.ts` + `test/setup.ts` (jsdom, jest-dom matchers).
- [x] `.changeset/config.json` (без `linked`/`fixed`, `access: public`).
- [x] `.github/workflows/ci.yml` (скелет: install → typecheck → test → build).
- [x] `README.md` (черновик) и `docs/specification.md` (черновик, полная версия в Iteration 16).

**Готово, когда:** `pnpm install && pnpm typecheck && pnpm test && pnpm build` зелёные. → выполнено.

---

### Iteration 1 — Доменная модель core · ✅ готово

**Цель:** типы и словари, вся дальнейшая работа опирается на них.

Задачи:

- [x] `types.ts`: `Track<TData>`, `PlaylistContext<TData>`, `EngineState`, `EngineStatus`,
      `LoopMode`, `PlaybackErrorCode`, `SoundlineMessages`, `SnClassSlot`, `SoundlineTheme`,
      `SoundlineLayout`, `PlayerSelection` (атомарный выбор: `{ trackId: string | null }`).
      Добавлены также `SoundlineLocale`, `PlaybackErrorPhase`, `EngineState.error`.
- [x] `context.ts`: `DEFAULT_PLAYLIST_CONTEXT`, `contextKeyOf`.
- [x] `errors.ts`: `PlaybackError`, `PLAYBACK_ERROR_CODES`, `isPlaybackErrorCode`,
      `isPlaybackError`, `toPlaybackError` (структурно, не `instanceof`).
- [x] `i18n.ts`: словари `en`/`ru`, `defaultMessages`, `resolveMessages`, `format()` c `{name}`.
- [x] `classNames.ts`: `SnClassSlot`, `SN_CLASS`, `cx`, `ClassValue` (реэкспорт из `utils/cx`).
- [x] `ids.ts`: `createId(prefix?)`.
- [x] `duration.ts`: `formatDuration(seconds, {units})`, `parseDuration`, `clamp`.
- [x] Тесты: `errors.test.ts`, `i18n.test.ts`, `classNames.test.ts`, `duration.test.ts`, `ids.test.ts`
      (+ `context.test.ts` по конвенции «парный тест каждому модулю»).

**Готово, когда:** типы публичны через `index.ts`, тесты зелёные, нет зависимостей от React/DOM.

---

### Iteration 2 — Reducer и производная view · ✅ готово

**Цель:** чистая модель состояния и чистый `derivePlayerView`.

Задачи:

- [x] `reducer.ts`: `PlayerState` (queue, currentTrackId, index, playing, volume, muted, loop,
      shuffle, rate, status, currentTime, duration, buffered, error, interaction flags),
      `createPlayerState`, `playerReducer`, закрытый список `PlayerAction`.
- [x] `config.ts`: `PlayerConfigInput`/`PlayerConfig`/`resolvePlayerConfig`, детерминированные
      фолбэки (`locale`, `theme`, `layout`), `seekStep`, `volumeStep`, `showQueue`,
      `pauseWhenHidden`, `mediaSession`.
- [x] `derive.ts`: `PlayerView` — `nowPlaying` (форматированные подписи), `progress`
      (`position`, `duration`, `percent`, `bufferedPercent`, `valueText`), `transport`
      (canPlay/canNext/canPrev, labels), `volumeView`, `queue` (элементы с `isActive`, `index`,
      подписи), `shuffle`/`loop` режимы, `live.message`, `actions` (canSeek/canToggle).
- [x] Кеш: `derivePlayerView(state, config, engineRef)` мемоизируется в контроллере по ключу
      `revision|engineRevision|configRevision`; сам `derive` остаётся чистым.
- [x] Тесты: `reducer.test.ts` (все переходы, границы очереди, loop one/all, shuffle
      детерминирован), `derive.test.ts` (подписи, проценты, доступность действий, кеш).

**Готово, когда:** редьюсер и derive покрыты тестами без движка и адаптера. → выполнено
(+ `config.test.ts` по конвенции «парный тест каждому модулю»).

---

### Iteration 3 — Движок и адаптер

**Цель:** два заменяемых контракта + фейки.

Задачи:

- [ ] `engine.ts`: интерфейс `PlaybackEngine` (`load`, `play`, `pause`, `seek`, `setVolume`,
      `setMuted`, `setRate`, `getState`, `subscribe`); `createMediaEngine()` — обёртка над
      `HTMLAudioElement`, создаётся **лениво** (никаких обращений к `window`/`document` при
      импорте), события `loadedmetadata/timeupdate/durationchange/progress/ended/error`.
- [ ] `adapter.ts`: `TrackQuery`, `TrackSourceAdapter` (`getTracks`, опционально
      `resolveSource`), `createStaticAdapter(tracks)`, `SortableAdapter` не нужен (см. v1 scope).
- [ ] `mock.ts`: `createMockEngine({ duration, latency, failures, now })` и
      `createMockAdapter({ tracks, latency, failures })`; детерминированы, зависят только от
      переданных параметров.
- [ ] Тесты: `engine.test.ts` (контракт на фейке), `adapter.test.ts`, `mock.test.ts`
      (детерминизм, инъекция ошибок `TRACK_NOT_FOUND`/`SOURCE_UNAVAILABLE`/`NOT_SUPPORTED`).

**Готово, когда:** core умеет «играть» трек через `createMockEngine` в тестах.

---

### Iteration 4 — Контроллер

**Цель:** сердце библиотеки.

Задачи:

- [ ] `controller.ts`: `createPlayerController(options)` с `getSnapshot`, `getEngineRef`,
      `subscribe`, `updateConfig`, `updateInputs`, `updateAdapter`, `updateEngine`, `start`,
      `stop`, `actions`.
- [ ] Actions: `play`, `pause`, `toggle`, `seek(seconds)`, `seekBy(delta)`, `next`, `previous`,
      `selectTrack(id)`, `enqueue`, `removeFromQueue`, `reorderQueue`, `clearQueue`, `setVolume`,
      `toggleMute`, `setLoop`, `setShuffle`, `setRate`, `retry`, `reset`.
- [ ] Правила: нереентрантность `play` до готовности; защита от устаревших `getTracks` через
      `AbortController`; смена `context.key` сбрасывает очередь и отменяет запросы; смена
      `currentTrackId` перезагружает движок; `ended` учитывает loop one/all; shuffle сохраняет
      явно выбранный трек первым.
- [ ] Controlled/uncontrolled: `volume`, `muted`, `loop`, `shuffle`, `rate`, `playing`,
      `currentTrackId`, `queue` — режим фиксируется при создании; dev-предупреждение о смене
      режима, в production — сохранение исходного.
- [ ] Обработчики: `onProgress(seconds, {duration})` (троттлинг), `onTrackChange`, `onPlay`,
      `onPause`, `onEnded`, `onError(error, {phase})`, `onVolumeChange`, `onLoopChange`,
      `onShuffleChange`, `onRateChange`, `onQueueChange`, `onPlayingChange`.
- [ ] Тесты: `controller.test.ts` на fake-engine + fake-`requestAnimationFrame`/таймере
      (автопереход по `ended`, loop, shuffle, границы, повторная загрузка того же трека,
      отмена устаревших ответов, controlled-циклы, `start/stop` идемпотентны, ничего при
      создании).

**Готово, когда:** все сценарии плеера проверены в core без React и без реального аудио.

---

### Iteration 5 — DOM-подпуть и стили

**Цель:** утилиты для фокуса/размеров и полный слой токенов.

Задачи:

- [ ] `dom/*`: перенос `focus.ts`, `media.ts`, `size.ts`, `height.ts`, `visibility.ts`,
      `index.ts` + тесты и `import.test.ts` (импорт не трогает `window`).
- [ ] `styles/tokens.css`: Shape, Type, Motion, Surfaces, Text, Lines, Feedback, Accent,
      плюс плеерные токены (`--sn-width`, `--sn-artwork-radius`, `--sn-seek-height`,
      `--sn-seek-fill`, `--sn-queue-max-height`), dark + `[data-sn-theme='light']`.
- [ ] `styles/base.css`: reset-скоуп, `:focus-visible`, visually-hidden, reduced-motion.
- [ ] `styles/soundline.css`: карточка, now playing, транспорт, seek (трек/заливка/ручка),
      volume, очередь/элемент трека, состояния loading/empty/error, `data-sn-layout`.
- [ ] `scripts/postbuild.mjs` собирает `index.css` в `soundline.css` и копирует в оба тарбола.
- [ ] Тест: `styles.test.ts` — все токены, упомянутые в README, существуют в `tokens.css`.

**Готово, когда:** CSS собирается, токены задокументированы, тема переключается атрибутом.

---

### Iteration 6 — Каркас React-обвязки

**Цель:** контекст, хук и скелет `PlayerView`, играющий mock-трек.

Задачи:

- [ ] `types.ts`: `SoundlineProps` (adapter, engine, mode/layout, controlled-пары, `seekStep`,
      `volumeStep`, `showQueue`, `pauseWhenHidden`, `mediaSession`, `locale`, `messages`,
      `theme`, `className`, `classNames`, `components`, `animations`, `autoFocus`, колбэки),
      `AnimationKit`, `StepHost/Item/Height`-эквиваленты.
- [ ] `context.tsx`: `FlowContext` (`{ snapshot, actions }`), `UIContext`, `usePlayerContext`,
      `useUI`, `useComponents`, `useClassNames`, `useAnimations`.
- [ ] `usePlayerFlow.ts`: `useBrowserDefaults` (locale/theme после маунта), `usePlayerController`
      (создание один раз, `updateAdapter/updateConfig/updateInputs` в эффекте, `start/stop`,
      `observeVisibilityChange` → `pauseWhenHidden`), `usePlayerFlow`, `usePlayerUI`.
- [ ] `Player.tsx`: `PlayerProvider`, `createPlayer(animations)`, `Player` (по умолчанию CSS-кит).
- [ ] `PlayerView.tsx`: карточка, `data-sn-theme/layout`, region с `aria-label`, live region,
      focus management при смене трека.
- [ ] `blocks.tsx`, `icons.tsx`, `Progress.tsx` (минимальные заглушки для рендера).
- [ ] Тест: `Player.test.tsx` — рендер, play/pause через mock-engine, смена трека.

**Готово, когда:** `<Player adapter={createMockAdapter()} />` играет и переключает mock-треки.

---

### Iteration 7 — Транспорт, NowPlaying, SeekBar

**Цель:** основной UI плеера.

Задачи:

- [ ] `NowPlaying.tsx`: обложка (aspect-ratio, fallback), название, исполнитель/альбом, активная
      строка.
- [ ] `Transport.tsx`: play/pause (`aria-pressed`, state-зависимая подпись), prev/next
      (disabled по `canPrev/canNext`), shuffle и repeat (циклические `off → all → one`, `aria-pressed`).
- [ ] `SeekBar.tsx`: `role="slider"`, `aria-valuemin/max/now`, `aria-valuetext`
      («1:23 из 4:05»), pointer drag + keyboard (`←/→` = `seekStep`, `Home/End`, `PageUp/Down`
      = ±10 × `seekStep`), буферизованный слой, `:focus-visible`.
- [ ] `TimeDisplay.tsx`: текущее/полное время из view.
- [ ] Оптимизация: локальное «тянущееся» значение во время drag, коммит в `seek()` на отпускание;
      обновления `onProgress` не дёргают перерисовку лишний раз.
- [ ] Тесты: `controls.test.tsx` — клавиатура слайдера, drag, доступные имена, циклический loop.

**Готово, когда:** плеер полностью управляем мышью и клавиатурой на одном треке.

---

### Iteration 8 — Volume и очередь

**Цель:** громкость и плейлист.

Задачи:

- [ ] `VolumeControl.tsx`: mute-кнопка + слайдер `role="slider"`, `aria-valuetext` в процентах,
      `volumeStep`, сохранение прежней громкости при unmute.
- [ ] `Queue.tsx` + `TrackItem.tsx`: `role="listbox"`, `option` с `aria-selected`, roving
      tabindex (стрелки/`Home/End`), клик/Enter/Space → `selectTrack`, кнопка удаления,
      индикатор активного/играющего трека, прокрутка при `--sn-queue-max-height`.
- [ ] Порядок и shuffle: отображаемый порядок = фактический порядок воспроизведения;
      `next/prev` согласованы с отображением.
- [ ] Тесты: `queue.test.tsx` — клавиатурная навигация, выбор, удаление, активный элемент,
      пустая очередь (`Empty`).

**Готово, когда:** плейлист управляется мышью и клавиатурой, состояние согласовано с движком.

---

### Iteration 9 — Точки расширения и классы

**Цель:** заменяемость частей как в booking.

Задачи:

- [ ] `parts.tsx`: `SoundlineComponents` (`Header`, `Artwork`, `Transport`, `SeekBar`, `Volume`,
      `NowPlaying`, `Queue`, `TrackItem`, `Empty`, `Error`, `Loading`), props с подготовленными
      атрибутами (аналог `slotProps`), `DEFAULT_COMPONENTS`, экспорт дефолтов.
- [ ] `useComponents` мержит дефолты; `classNames` работает независимо от `components`.
- [ ] Документировать контракт полной замены (`Transport`/`SeekBar` получают обработчики и
      a11y-атрибуты, которые нужно навесить на свой элемент).
- [ ] Тесты: `parts.test.tsx` — замена каждой части, комбинирование с `classNames`, изоляция
      нескольких плееров на странице.

**Готово, когда:** любую часть можно заменить без переписывания виджета.

---

### Iteration 10 — Анимации

**Цель:** мягкие анимации по умолчанию, без рантайма.

Задачи:

- [ ] `animations/css.tsx`: `StepHost`-эквивалент (смена трека: кроссфейд обложки),
      `Item` (стаггер появления очереди, `--sn-index`), `Height` (плавная высота),
      «дышащие» полосы эквалайзера у играющего трека, ripple заливки прогресса.
- [ ] `animations/motion.tsx` + `motion.ts`: тот же кит на Motion (`AnimatePresence`,
      springs, `whileTap`); `motion` остаётся optional peer, главный вход его не импортирует.
- [ ] Все анимации уважают `prefers-reduced-motion` (схлопывание к ~0 ms).
- [ ] Тесты: `a11y.test.tsx` включает проверку reduced-motion пути.

**Готово, когда:** `/motion` работает, основной вход остаётся без `motion` в бандле.

---

### Iteration 11 — Доступность: харденинг

**Цель:** подтверждённая доступность всех сценариев.

Задачи:

- [ ] Аудит ролей/имён/состояний всех интерактивных элементов; `aria-pressed` у toggle-кнопок.
- [ ] Live region: анонс смены трека, play/pause, окончания очереди.
- [ ] Фокус: при смене трека фокус не улетает в `<body>`; `autoFocus` опционален;
      видимый `:focus-visible`.
- [ ] Клавиатура: полный проход Tab; слайдеры и listbox — стрелками без утечки фокуса.
- [ ] `axe`-прогон на наборе состояний; тесты `a11y.test.tsx` и `regressions.test.tsx`.

**Готово, когда:** нет нарушений axe в ключевых состояниях, клавиатурный проход задокументирован.

---

### Iteration 12 — Media Session и пауза при скрытой вкладке

**Цель:** «современное» ощущение и корректность поведения.

Задачи:

- [ ] Интеграция Media Session API: метаданные (`title/artist/album/artwork`) и хендлеры
      `play/pause/nexttrack/previoustrack/seekbackward/seekforward/seekto`;
      `mediaSession?: boolean | { skipSeconds?: number }`, по умолчанию выключено.
- [ ] `pauseWhenHidden` (по умолчанию `false`): пауза на `visibilitychange`.
- [ ] Всё за пределами core: только в React-обвязке, через `observeVisibilityChange`.
- [ ] Тесты: `mediaSession.test.tsx` (мок `navigator.mediaSession`), visibility.

**Готово, когда:** метаданные и хендлеры работают, при отсутствии API — тихий откат.

---

### Iteration 13 — SSR и гидратация

**Цель:** серверный рендер без рассинхрона.

Задачи:

- [ ] `useBrowserDefaults`: детерминированные фолбэки на первом рендере, реальные locale/theme
      после маунта; `engine` не создаётся на сервере.
- [ ] Сериализуемый `getEngineRef()` + `initialEngineRef` в props для точного совпадения разметки.
- [ ] Тесты: `ssr.test.tsx` — `renderToString` → сравнение разметки → `hydrateRoot` без
      предупреждений; проверка, что после гидратации плеер реагирует.

**Готово, когда:** SSR-тест зелёный, консоль без hydration-предупреждений.

---

### Iteration 14 — Storybook, playground, галерея

**Цель:** витрина и ручная проверка состояний.

Задачи:

- [ ] `.storybook/` + истории: состояния плеера (idle/loading/playing/paused/ended/error/empty),
      темы, локали `en/ru`, компоновка, кастомные части, headless.
- [ ] `apps/playground/` (Vite): контролы темы/локали/компоновки, mock-адаптер и mock-движок.
- [ ] `gallery.html`: галерея состояний с явными `data-*` для браузерных проверок.
- [ ] `tools/screenshot.mjs` для снимков README (`docs/images/`).

**Готово, когда:** `pnpm dev`, `pnpm storybook` и галерея открываются и покрывают все состояния.

---

### Iteration 15 — Браузерные проверки, CI, установка из tarball

**Цель:** доказательство, что пакет работает вне монорепы.

Задачи:

- [ ] `tools/check-layout.mjs` + `check-container.mjs`: контейнеры 280/320/400/800 px,
      отсутствие горизонтального переполнения, `:focus-visible`, reduced motion, прокрутка
      очереди при `--sn-queue-max-height`.
- [ ] `tools/install-check/{react-18,react-19}` + `verify-install.mjs`: установка из tarball в
      чистые приложения, production build, SSR/гидратация в реальном браузере.
- [ ] `ci.yml`: общая job (core+react, tarballs) → независимые consumer jobs (react-18,
      react-19) с своими кэшами; cache keys включают шаблон, Node, lockfile.
- [ ] Проверка экспортных точек, зависимости на core и опциональности `motion`.

**Готово, когда:** `pnpm verify:install` и CI зелёные на обоих легах.

---

### Iteration 16 — Документация, changeset, релиз

**Цель:** пакет готов к публикации.

Задачи:

- [ ] `docs/specification.md`: перенести финальный контракт (модель, контроллер, движок,
      адаптер, ошибки, accessibility, SSR, версионирование, вне scope).
- [ ] `README.md`: badges, install, quick start, wiring a real backend, props-таблица,
      exposed classes, theming, animations, accessibility, SSR, mock engine/adapter,
      development, scope and known limits.
- [ ] README внутри `packages/core` и `packages/react`.
- [ ] Первый changeset (`minor` для обоих до 1.0.0), `.changeset/pre.json` при необходимости.
- [ ] `LICENSE` (MIT) в корне и пакетах.

**Готово, когда:** version PR формируется, документация описывает публичный API без пробелов.

---

## Майлстоуны

| Майлстоун        | Итерации | Демонстрируемый результат                |
| ---------------- | -------- | ---------------------------------------- |
| **M1. Каркас**   | 0        | Пустые пакеты, зелёные команды           |
| **M2. Ядро**     | 1–4      | core играет и переключает треки в тестах |
| **M3. Виджет**   | 5–9      | Рабочий React-плеер с очередью и темами  |
| **M4. Качество** | 10–13    | Анимации, a11y, Media Session, SSR       |
| **M5. Релиз**    | 14–16    | Storybook, playground, CI, tarball, docs |

## Правила итерации (definition of done для каждой)

1. `pnpm typecheck && pnpm test && pnpm build` зелёные.
2. Новый публичный контракт задокументирован JSDoc и (для React) есть запускаемый пример.
3. Добавлены тесты core для логики и тесты обвязки для поведения/доступности.
4. Изменение публикуемого пакета сопровождается changeset.
5. Обновлён статус в этом roadmap (`[ ]` → `[x]`).

## Риски и как их снимаем

| Риск                                                         | Митингование                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Гонки движка и контроллера (seek при загрузке, late `ended`) | token/ревизия на каждую загрузку, игнор устаревших событий, тесты на фейковом движке |
| Расхождение `next/prev` и отображаемого порядка при shuffle  | порядок воспроизведения хранится в state, view производен от него                    |
| SSR-рассинхрон из-за locale/theme/движка                     | детерминированные фолбэки, движок только на клиенте, `initialEngineRef`              |
| Дрожание ширины/высоты между состояниями                     | фиксированные `--sn-*` размеры и `check:layout` в браузере                           |
| Разъезд core и React                                         | вся логика в core; в React — только жизненный цикл и рендер, parity-тесты            |
