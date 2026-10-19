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

### Iteration 3 — Движок и адаптер · ✅ готово

**Цель:** два заменяемых контракта + фейки.

Задачи:

- [x] `engine.ts`: интерфейс `PlaybackEngine` (`load`, `play`, `pause`, `seek`, `setVolume`,
      `setMuted`, `setRate`, `getState`, `subscribe`); `createMediaEngine()` — обёртка над
      `HTMLAudioElement`, создаётся **лениво** (никаких обращений к `window`/`document` при
      импорте), события `loadedmetadata/timeupdate/durationchange/progress/ended/error`.
      Добавлены также `LoadOptions`, `createEngineState`, `MediaEngineOptions.createElement`
      (точка инъекции элемента) и `codeForMediaError`.
- [x] `adapter.ts`: `TrackQuery`, `ResolvedSource`, `TrackSourceAdapter` (`getTracks`,
      опционально `resolveSource`), `createStaticAdapter(tracks)`, `SortableAdapter` не нужен
      (см. v1 scope).
- [x] `mock.ts`: `createMockEngine({ duration, latency, failures, now, tickMs })` и
      `createMockAdapter({ tracks, latency, failure, sourceFailures })`; детерминированы,
      зависят только от переданных параметров и инъектируемого времени.
- [x] `errors.ts`: `createAbortError()` — единая отмена (без `DOMException`), которую
      `isAbortError()` распознаёт и в браузере, и на сервере.
- [x] Тесты: `engine.test.ts` (контракт на фейке + ленивое создание/отсутствие DOM),
      `adapter.test.ts`, `mock.test.ts` (детерминизм, инъекция ошибок
      `TRACK_NOT_FOUND`/`SOURCE_UNAVAILABLE`/`NOT_SUPPORTED`/`NETWORK_FAILURE`, latency, abort)
      (+ `errors.test.ts` по конвенции «парный тест каждому модулю»).

**Готово, когда:** core умеет «играть» трек через `createMockEngine` в тестах. → выполнено.

---

### Iteration 4 — Контроллер · ✅ готово

**Цель:** сердце библиотеки.

Задачи:

- [x] `controller.ts`: `createPlayerController(options)` с `getSnapshot`, `getEngineRef`,
      `subscribe`, `updateConfig`, `updateInputs`, `updateAdapter`, `updateEngine`, `start`,
      `stop`, `actions`.
- [x] Actions: `play`, `pause`, `toggle`, `seek(seconds)`, `seekBy(delta)`, `next`, `previous`,
      `selectTrack(id)`, `enqueue`, `removeFromQueue`, `reorderQueue`, `clearQueue`, `setVolume`,
      `toggleMute`, `setLoop`, `setShuffle`, `setRate`, `retry`, `reset`.
- [x] Правила: нереентрантность `play` до готовности; защита от устаревших `getTracks` через
      `AbortController`; смена `context.key` сбрасывает очередь и отменяет запросы; смена
      `currentTrackId` перезагружает движок; `ended` учитывает loop one/all; shuffle сохраняет
      явно выбранный трек первым.
- [x] Controlled/uncontrolled: `volume`, `muted`, `loop`, `shuffle`, `rate`, `playing`,
      `currentTrackId`, `queue` — режим фиксируется при создании; dev-предупреждение о смене
      режима, в production — сохранение исходного.
- [x] Обработчики: `onProgress(seconds, {duration})` (троттлинг), `onTrackChange`, `onPlay`,
      `onPause`, `onEnded`, `onError(error, {phase})`, `onVolumeChange`, `onMutedChange`,
      `onLoopChange`, `onShuffleChange`, `onRateChange`, `onQueueChange`, `onPlayingChange`.
- [x] Тесты: `controller.test.ts` на fake-engine + fake-таймере (автопереход по `ended`, loop,
      shuffle, границы, повторная загрузка того же трека, отмена устаревших ответов,
      controlled-циклы, `start/stop` идемпотентны, ничего при создании).

Минимально необходимое сверх списка (отмечено в отчёте): переход редьюсера `setQueue` (нужен
для controlled `queue`); опции контроллера `initialEngineRef`, `now`, `progressIntervalMs`,
`random`; `onMutedChange` рядом с `onVolumeChange`.

**Готово, когда:** все сценарии плеера проверены в core без React и без реального аудио. → выполнено.

---

### Iteration 5 — DOM-подпуть и стили · ✅ готово

**Цель:** утилиты для фокуса/размеров и полный слой токенов.

Задачи:

- [x] `dom/*`: перенос `focus.ts`, `media.ts`, `size.ts`, `height.ts`, `visibility.ts`,
      `index.ts` + тесты и `import.test.ts` (импорт не трогает `window`).
- [x] `styles/tokens.css`: Shape, Type, Motion, Surfaces, Text, Lines, Feedback, Accent,
      плюс плеерные токены (`--sn-width`, `--sn-artwork-radius`, `--sn-seek-height`,
      `--sn-seek-fill`, `--sn-queue-max-height`), dark + `[data-sn-theme='light']`.
- [x] `styles/base.css`: reset-скоуп, `:focus-visible`, visually-hidden, reduced-motion.
- [x] `styles/soundline.css`: карточка, now playing, транспорт, seek (трек/заливка/ручка),
      volume, очередь/элемент трека, состояния loading/empty/error, `data-sn-layout`.
- [x] `scripts/postbuild.mjs` собирает `index.css` в `soundline.css` и копирует в оба тарбола.
- [x] Тест: `styles.test.ts` — все токены, упомянутые в README, существуют в `tokens.css`.

Минимально необходимое сверх списка (отмечено в отчёте): `observeVisibilityChange`
сообщает оба направления и появился `isDocumentHidden()` (нужно `pauseWhenHidden` в 6/12);
токен `--sn-width-compact` для компоновки `compact`; `@types/node` + `types: [..., "node"]`
в core ради чтения файлов в `styles.test.ts`; короткий раздел Theming в README, чтобы
проверка токенов была не пустой; CSS-хук `data-sn-dragging` для перетаскивания seek.

**Готово, когда:** CSS собирается, токены задокументированы, тема переключается атрибутом. → выполнено.

---

### Iteration 6 — Каркас React-обвязки · ✅ готово

**Цель:** контекст, хук и скелет `PlayerView`, играющий mock-трек.

Задачи:

- [x] `types.ts`: `SoundlineProps` (adapter, engine, mode/layout, controlled-пары, `seekStep`,
      `volumeStep`, `showQueue`, `pauseWhenHidden`, `mediaSession`, `locale`, `messages`,
      `theme`, `className`, `classNames`, `components`, `animations`, `autoFocus`, колбэки),
      `AnimationKit`, `StepHost/Item/Height`-эквиваленты.
- [x] `context.tsx`: `FlowContext` (`{ snapshot, actions }`), `UIContext`, `usePlayerContext`,
      `useUI`, `useComponents`, `useClassNames`, `useAnimations`.
- [x] `usePlayerFlow.ts`: `useBrowserDefaults` (locale/theme после маунта), `usePlayerController`
      (создание один раз, `updateAdapter/updateConfig/updateInputs` в эффекте, `start/stop`,
      `observeVisibilityChange` → `pauseWhenHidden`), `usePlayerFlow`, `usePlayerUI`.
- [x] `Player.tsx`: `PlayerProvider`, `createPlayer(animations)`, `Player` (по умолчанию CSS-кит).
- [x] `PlayerView.tsx`: карточка, `data-sn-theme/layout`, region с `aria-label`, live region,
      focus management при смене трека.
- [x] `blocks.tsx`, `icons.tsx`, `Progress.tsx` (минимальные заглушки для рендера).
- [x] Тест: `Player.test.tsx` — рендер, play/pause через mock-engine, смена трека.

Уточнения против списка (отмечено в отчёте): «mode/layout» из плана читается как один
`layout` — доменная модель Soundline не знает `mode`. `useBrowserDefaults` определяет
**только локаль** (`navigator.language`), тема остаётся `dark` по умолчанию — согласовано с
`FALLBACK_THEME` и детерминированным SSR.

Минимально необходимое сверх списка (отмечено в отчёте): `public.ts` (общая поверхность для
будущего `/motion`), минимальный `animations/css.tsx` (кит `cssAnimations` для
`createPlayer`; полные анимации — итерация 10), минимальный `parts.tsx`
(`SoundlineComponents` + `DEFAULT_COMPONENTS`; полная карта — итерация 9), `components/Progress.tsx`
как презентационная заглушка seek-слайдера (интерактивный `SeekBar` — итерация 7), правило
`.sn-error button` в `soundline.css` ради кнопки retry.

**Готово, когда:** `<Player adapter={createMockAdapter()} />` играет и переключает mock-треки.
→ выполнено.

---

### Iteration 7 — Транспорт, NowPlaying, SeekBar · ✅ готово

**Цель:** основной UI плеера.

Задачи:

- [x] `NowPlaying.tsx`: обложка (aspect-ratio, fallback), название, исполнитель/альбом, активная
      строка.
- [x] `Transport.tsx`: play/pause (`aria-pressed`, state-зависимая подпись), prev/next
      (disabled по `canPrev/canNext`), shuffle и repeat (циклические `off → all → one`, `aria-pressed`).
- [x] `SeekBar.tsx`: `role="slider"`, `aria-valuemin/max/now`, `aria-valuetext`
      («1:23 из 4:05»), pointer drag + keyboard (`←/→` = `seekStep`, `Home/End`, `PageUp/Down`
      = ±10 × `seekStep`), буферизованный слой, `:focus-visible`.
- [x] `TimeDisplay.tsx`: текущее/полное время из view.
- [x] Оптимизация: локальное «тянущееся» значение во время drag, коммит в `seek()` на отпускание;
      обновления `onProgress` не дёргают перерисовку лишний раз.
- [x] Тесты: `controls.test.tsx` — клавиатура слайдера, drag, доступные имена, циклический loop.

Уточнения против списка (отмечено в отчёте): у play/pause только сменная подпись (`Play` ⇄
`Pause`) без `aria-pressed` — менять и доступное имя, и pressed-состояние избыточно, скринридер
читал бы «Pause, pressed»; `aria-pressed` остался у shuffle/repeat, как и просит задача.
`Progress.tsx` из Iteration 6 (презентационная заглушка) заменён интерактивным `SeekBar` и удалён.
Новые части рендерятся в `PlayerView` напрямую: карта `SoundlineComponents` — Iteration 9.
Минимально необходимое сверх списка: `↑/↓` двигают playhead наравне с `←/→` (паритет с APG),
`aria-orientation`, `aria-disabled` + `tabIndex={-1}` у недоступного слайдера, иконки
`Shuffle`/`Repeat`/`RepeatOne`/`Note` и сброс «сломанной» обложки по `key` трека.

**Готово, когда:** плеер полностью управляем мышью и клавиатурой на одном треке. → выполнено.

---

### Iteration 8 — Volume и очередь · ✅ готово

**Цель:** громкость и плейлист.

Задачи:

- [x] `VolumeControl.tsx`: mute-кнопка + слайдер `role="slider"`, `aria-valuetext` в процентах,
      `volumeStep`, сохранение прежней громкости при unmute.
- [x] `Queue.tsx` + `TrackItem.tsx`: `role="listbox"`, `option` с `aria-selected`, roving
      tabindex (стрелки/`Home/End`), клик/Enter/Space → `selectTrack`, кнопка удаления,
      индикатор активного/играющего трека, прокрутка при `--sn-queue-max-height`.
- [x] Порядок и shuffle: отображаемый порядок = фактический порядок воспроизведения;
      `next/prev` согласованы с отображением.
- [x] Тесты: `queue.test.tsx` — клавиатурная навигация, выбор, удаление, активный элемент,
      пустая очередь (`Empty`).

Минимально необходимое сверх списка (отмечено в отчёте): `volume.test.tsx` (объём тестов
обвязки для громкости); снятие mute движением слайдера; `PageUp/PageDown` как ±10 шагов
(`volumeStep`); `RemoveIcon`/`VolumeIcon`/`MuteIcon`; пилюля счётчика в `queueHeader`;
локальная переменная `--sn-volume-percent` (inline) и двухстопный градиент заливки трека
громкости; правка селекторов в `controls.test.tsx` (те же заголовки теперь и в очереди).

**Готово, когда:** плейлист управляется мышью и клавиатурой, состояние согласовано с движком.
→ выполнено.

---

### Iteration 9 — Точки расширения и классы · ✅ готово

**Цель:** заменяемость частей как в booking.

Задачи:

- [x] `parts.tsx`: `SoundlineComponents` (`Header`, `Artwork`, `Transport`, `SeekBar`, `Volume`,
      `NowPlaying`, `Queue`, `TrackItem`, `Empty`, `Error`, `Loading`), props с подготовленными
      атрибутами (аналог `slotProps`), `DEFAULT_COMPONENTS`, экспорт дефолтов.
- [x] `useComponents` мержит дефолты; `classNames` работает независимо от `components`.
- [x] Документировать контракт полной замены (`Transport`/`SeekBar` получают обработчики и
      a11y-атрибуты, которые нужно навесить на свой элемент).
- [x] Тесты: `parts.test.tsx` — замена каждой части, комбинирование с `classNames`, изоляция
      нескольких плееров на странице.

**Готово, когда:** любую часть можно заменить без переписывания виджета. → выполнено.

Уточнения против списка (отмечено в отчёте): `Header` — шапка очереди (согласовано): строка
названия и счётчика над listbox'ом, часть рендерит её слотом `header` (`sn-header` — пара правил
в CSS, которая до этой итерации была без разметки), счётчик — слотом `queueCount`. Слот
`queueHeader`/`.sn-queue-header` после переноса шапки виджетом не используется: core в этой
итерации не трогали, это кандидат на уборку в Iteration 16. `TimeDisplay` частью не делаем — его
нет в списке итерации; полностью заменённый `SeekBar` получает `progress` с готовыми метками и
может нарисовать время сам.

Минимально необходимое сверх списка (отмечено в отчёте): `hooks/useSlider.ts` — общая механика
слайдеров (drag с коммитом на отпускание, клавиши, `role="slider"` и `aria-*`), поэтому `SeekBar`
и `VolumeControl` стали презентационными частями, а состояние перетаскивания живёт в `PlayerView`;
`components/QueueList.tsx` — listbox библиотеки, который отдаётся части `Queue` как `children`
(roving tabindex и фокус нельзя переписать руками); `components/Header.tsx` и
`components/Artwork.tsx`; реэкспорт `nextLoopMode`, чтобы замена транспорта не переписывала цикл
`off → all → one`; три бандла props у `Volume` (`slotProps` контейнера, `buttonProps`, `sliderProps`).

Найдено, вне объёма итерации (в отчёт): сбой `getTracks` не попадает во `view.error`
(`state.queueError` не выводится в `derive`), поэтому при недоступном списке треков виджет
показывает пустую карточку вместо части `Error`; `Error` достижим только на сбое источника.

---

### Iteration 10 — Анимации · ✅ готово

**Цель:** мягкие анимации по умолчанию, без рантайма.

Задачи:

- [x] `animations/css.tsx`: `StepHost`-эквивалент (смена трека: кроссфейд обложки),
      `Item` (стаггер появления очереди, `--sn-index`), `Height` (плавная высота),
      «дышащие» полосы эквалайзера у играющего трека, ripple заливки прогресса.
- [x] `animations/motion.tsx` + `motion.ts`: тот же кит на Motion (`AnimatePresence`,
      springs, `whileTap`); `motion` остаётся optional peer, главный вход его не импортирует.
- [x] Все анимации уважают `prefers-reduced-motion` (схлопывание к ~0 ms).
- [x] Тесты: `a11y.test.tsx` включает проверку reduced-motion пути.

Уточнения против списка (отмечено в отчёте): `Item` — это сам элемент строки (`<li>`), а не
`<button>`: строки очереди лежат в `role="listbox"`, и кнопка на месте опции сломала бы и
семантику, и HTML-структуру списка. Тип `ItemProps` переведён на `ComponentPropsWithRef<'li'>`
(до 1.0 — `minor` с миграцией), кит обязан прокидывать `ref`: по нему список двигает фокус.
`NowPlaying` больше не ремоунтится по `key` — иначе Motion не может отыграть exit; по ключу
трека теперь ремоунтятся `StepHost` и `Artwork`, а сброс «сломанной обложки» остался за
`Artwork`. CSS анимаций вынесен отдельным авторским файлом
`packages/core/src/styles/animations.css` (четвёртым в сборке), как согласовано.

Минимально необходимое сверх списка (отмечено в отчёте): слоты `eq` (полосы эквалайзера) и
`trackLine` (строка «полосы + название»; обёртка нужна, чтобы индикатор не сдвигал текст у
остальных строк); токен `--sn-card-gap` — общий ритм карточки и внутреннего слоя `Height`;
хуки DOM `data-sn-playing` на `.sn-root` (по нему включается блик и гасится стаггер) и
`data-sn-animating`/`data-sn-motion` у `Height`; внутренние хуки `hooks/useMediaQuery.ts` и
`hooks/useAnimatedHeight.ts` (обёртка над `observeAnimatedHeight`, длительность перехода —
inline, чтобы момент снятия клиппинга не расходился с CSS); сторона перехода считается в
`PlayerView` из `view.queue.items` без правки публичного API core; `motion.ts` теперь
собирает `Player` на `motionAnimations`.

Найдено, вне объёма итерации (в отчёт): CSS-кит анимирует только появление строк — удаление
трека из очереди происходит без перехода (у Motion это делает `AnimatePresence`); вынести в
Iteration 16/позже.

**Готово, когда:** `/motion` работает, основной вход остаётся без `motion` в бандле.

---

### Iteration 11 — Доступность: харденинг · ✅ готово

**Цель:** подтверждённая доступность всех сценариев.

Задачи:

- [x] Аудит ролей/имён/состояний всех интерактивных элементов; `aria-pressed` у toggle-кнопок.
- [x] Live region: анонс смены трека, play/pause, окончания очереди.
- [x] Фокус: при смене трека фокус не улетает в `<body>`; `autoFocus` опционален;
      видимый `:focus-visible`.
- [x] Клавиатура: полный проход Tab; слайдеры и listbox — стрелками без утечки фокуса.
- [x] `axe`-прогон на наборе состояний; тесты `a11y.test.tsx` и `regressions.test.tsx`.

Уточнения против списка (отмечено в отчёте): аудит нашёл реальное нарушение — кнопка удаления
внутри опции listbox (`nested-interactive`, WCAG 4.1.2: у роли `option` включён
`childrenPresentational`). Очередь перестроена на простой список (`<ul>`) со **двумя
кнопками-соседями** в строке: выбор трека (roving tabindex, стрелки/`Home`/`End`, `Enter`/
`Space` — родные для кнопки) и удаление; `aria-selected` заменён на `aria-current` на кнопке
выбора. Контракт части `TrackItem` стал `slotProps` (строка `<li>`, `ref` — по нему видно,
уносит ли удаление фокус) + `selectProps` (кнопка выбора, её `ref` — точка фокуса списка) +
`removeProps`; до 1.0 — `minor` с миграцией. Добавлен слот класса `trackSelect`
(`sn-track-select`) и правило для него. Play/pause остался сменой доступного имени без
`aria-pressed` (формулировка в спеке была неверна — § 6 переписан). Клавиатурный проход
задокументирован таблицей в README (раздел Accessibility).

Минимально необходимое сверх списка (отмечено в отчёте): ключ словаря `pausedTrackLabel`
(«Пауза: {title}») — пауза анонсируется в live region, потому что смена имени не
сфокусированной кнопки не озвучивается; `derivePlayerView` теперь поднимает отказ списка
треков в `view.error` (`state.queueError`), а не оставляет вечное «Загружаем треки…» с пустым
списком, `actions.canRetry` для отказавшего списка включён — контроллер умеет перезагрузить
список (найдено в Iteration 9). Автопрогон axe — `jest-axe` плюс собственный хелпер
`src/test/a11y.ts` (без патча матчеров vitest); матрица из 11 состояний виджета.

Найдено, вне объёма итерации (в отчёт): тексты для отказавшего списка переиспользуют
`genericError` («Не удалось загрузить трек…») — отдельная строка для отказа списка
(кандидат в Iteration 16); контрастность в jsdom не проверяется (стилей нет) — остаётся
браузерному прогону Iteration 15; удаление строки очереди CSS-кит не анимирует (Iteration 10).

**Готово, когда:** нет нарушений axe в ключевых состояниях, клавиатурный проход задокументирован.

---

### Iteration 12 — Media Session и пауза при скрытой вкладке · ✅ готово

**Цель:** «современное» ощущение и корректность поведения.

Задачи:

- [x] Интеграция Media Session API: метаданные (`title/artist/album/artwork`) и хендлеры
      `play/pause/nexttrack/previoustrack/seekbackward/seekforward/seekto`;
      `mediaSession?: boolean | { skipSeconds?: number }`, по умолчанию выключено.
- [x] `pauseWhenHidden` (по умолчанию `false`): пауза на `visibilitychange`.
- [x] Всё за пределами core: только в React-обвязке, через `observeVisibilityChange`.
- [x] Тесты: `mediaSession.test.tsx` (мок `navigator.mediaSession`), visibility.

Уточнения против списка (отмечено в отчёте): интеграция живёт в `usePlayerController`
(внутренний хук `hooks/useMediaSession.ts`), поэтому её получают и `<Player>`, и headless
`usePlayerFlow`; публичный контракт — это пропсы `mediaSession`/`pauseWhenHidden`, сам хук
не экспортируется. `pauseWhenHidden` был подключён ещё в Iteration 6 — в этой итерации он
покрыт тестами и не менялся. `setPositionState` обновляется на переходах состояния (progress-
тики в подписчиков не попадают): браузер сам досчитывает позицию между ними по
`playbackRate`. Каждый `setActionHandler` обёрнут в `try/catch` — браузер без поддержки
отдельного действия бросает `NotSupportedError`, остальные хендлеры остаются.

**Готово, когда:** метаданные и хендлеры работают, при отсутствии API — тихий откат.
→ выполнено (`mediaSession.test.tsx`, `visibility.test.tsx`; changeset `minor` для
`soundline-react`, core не менялся).

---

### Iteration 13 — SSR и гидратация · ✅ готово

**Цель:** серверный рендер без рассинхрона.

Задачи:

- [x] `useBrowserDefaults`: детерминированные фолбэки на первом рендере, реальная локаль
      после маунта; первый серверный проход не трогает DOM (в т.ч. через движок по
      умолчанию).
- [x] Сериализуемый `getEngineRef()` + `initialEngineRef` в props для точного совпадения
      разметки; JSDoc контракта в core и в `SoundlineProps`.
- [x] Тесты: `ssr.test.tsx` — `renderToString` → `hydrateRoot` без recoverable-ошибок и
      предупреждений, сохранённый узел серверной разметки, работоспособность после
      гидратации, смена локали после маунта, `initialEngineRef`, негативный контроль
      (расхождение обязано быть замечено); в `controller.test.ts` — сериализуемость
      ссылки и отсутствие непередаваемых полей.
- [x] Документация: §2.8 «SSR и гидратация» в `docs/specification.md` (+ запись в §5) и
      раздел «Server rendering» в `README.md`.

**Готово, когда:** SSR-тест зелёный, консоль без hydration-предупреждений. → выполнено.

Уточнения против списка (отмечено в отчёте): «реальные locale/theme после маунта» —
реальной становится **только локаль**; тема остаётся `dark` до явного `theme` (решение
Iteration 6, `FALLBACK_THEME`), иначе системная светлая тема перекрашивала бы плеер,
который приложение просило держать тёмным. Хук назван `useBrowserDefaults` и живёт в
обвязке (внутренний, не экспортируется). «`engine` не создаётся на сервере» читаем как
«серверный проход не создаёт ни одного DOM-элемента»: `createMediaEngine()` по-прежнему
конструируется в `createPlayerController` (это фабрика без побочных эффектов), а `<audio>`
строится только по первому `load()` — это и зафиксировано тестом. Core не менялся
(только JSDoc), changeset `minor` — у `soundline-react`. Про серверную телеметрию: при
пустом плейлисте серверный проход рисует состояние `loading` (слайдеров ещё нет), поэтому
сценарий «разметка из телеметрии» требует известного серверу плейлиста
(`queue`/`defaultQueue`) — это отражено в тестах и README.

---

### Iteration 14 — Storybook, playground, галерея · ✅ готово

**Цель:** витрина и ручная проверка состояний.

Задачи:

- [x] `.storybook/` + истории: состояния плеера (idle/loading/playing/paused/ended/error/empty),
      темы, локали `en/ru`, компоновка, кастомные части, headless.
- [x] `apps/playground/` (Vite): контролы темы/локали/компоновки, mock-адаптер и mock-движок.
- [x] `gallery.html`: галерея состояний с явными `data-*` для браузерных проверок.
- [x] `tools/screenshot.mjs` для снимков README (`docs/images/`).

**Готово, когда:** `pnpm dev`, `pnpm storybook` и галерея открываются и покрывают все состояния.
→ выполнено (`pnpm build-storybook` и `pnpm --filter soundline-playground build` зелёные,
снимки сняты через `tools/screenshot.mjs`).

Уточнения против списка (отмечено в отчёте): состояния выставлены не «декорацией», а через
публичные `actions` мок-движка — общий `PlaybackDriver` в демо-данных доводит плеер до
`playing`/`paused`/`ended`. «Ended» — это последний трек, доведённый до конца: с
`loop: off` завершение любого другого трека просто переходит к следующему, поэтому до конца
плейлиста доигрывает последний. «Source refused» требует трека без `src`: контроллер
предпочитает `track.src` и не спрашивает адаптер, если источник уже есть (`resolveSourceFor`),
поэтому демо-плейлист для этого кейса оставляет `src` первого трека адаптеру. Storybook
собирается против исходников (`viteFinal` алиасит core на `src`, как в vitest) — `pnpm
storybook` работает без предварительного `pnpm build`.

Минимально необходимое сверх списка (отмечено в отчёте): Storybook `^10.6.1` (docs + a11y,
`react-vite`) в devDeps `soundline-react`; `.storybook/preview.css` с подложкой под тему;
демо-фикстуры и драйвер (`stories/demo.tsx`, `apps/playground/src/demo.tsx`); README-раздел
«Development» дополнен командами `storybook`/`preview`/`screenshot` и структурой `apps`/`tools`;
коммитируемые снимки `docs/images/player-{dark,light}.png` для README. Changeset не нужен:
меняются только devDeps, тулинг и private playground, публикуемые пакеты не затрагиваются.

---

### Iteration 15 — Браузерные проверки, CI, установка из tarball · ✅ готово

**Цель:** доказательство, что пакет работает вне монорепы.

Задачи:

- [x] `tools/check-layout.mjs` + `check-container.mjs`: контейнеры 280/320/400/800 px,
      отсутствие горизонтального переполнения, `:focus-visible`, reduced motion, прокрутка
      очереди при `--sn-queue-max-height`.
- [x] `tools/install-check/{react-18,react-19}` + `verify-install.mjs`: установка из tarball в
      чистые приложения, production build, SSR/гидратация в реальном браузере.
- [x] `ci.yml`: общая job (core+react, tarballs) → независимые consumer jobs (react-18,
      react-19) с своими кэшами; cache keys включают шаблон, Node, lockfile.
- [x] Проверка экспортных точек, зависимости на core и опциональности `motion`.

**Готово, когда:** `pnpm verify:install` и CI зелёные на обоих легах. → выполнено
(`check:layout`, `check:container`, `check:hydration` и `verify:install` зелёные локально;
`verify-install.mjs` прогоняет оба лега из tarball).

Минимально необходимое сверх списка (отмечено в отчёте): задокументирован контракт проверок;
`tools/screenshot.mjs` получил `--media <feature>:<value>` (эмуляция `prefers-reduced-motion`
до загрузки документа — иначе reduced-motion путь не наблюдается в реальном браузере) и
`inWidget` в focus-трейле теперь через `closest('.sn-root')`, а не «первый по документу»
(на галерее девять плееров, и драйвер одного из них возвращает фокус на карточку);
`tools/check-hydration.mjs` и npm-скрипт `check:hydration` (леги `react-*` несут браузерную
гидратацию prerender-страницы); `tools/install-check/README.md`; второй прогон
`check-container` в браузере с эмуляцией reduced motion; раздел README «Development»
дополнен командами проверок. Changeset не нужен: меняются только инструменты и CI.

Разложение списка по инструментам (отмечено в отчёте): `check-layout` отвечает за
инварианты ширины (карточка = ширине корня, один размер на компоновку, сужение под
родителя, отсутствие переполнения по состояниям галереи); `check-container` — за адаптацию
по ширинам 280/320/400/800 px, прокрутку очереди под `--sn-queue-max-height`,
`:focus-visible` по реальным нажатиям Tab и схлопывание анимаций при reduced motion.
Изменение публикуемых пакетов не требовалось — правок в `packages/` нет.

---

### Iteration 16 — Документация, changeset, релиз · ✅ готово

**Цель:** пакет готов к публикации.

Задачи:

- [x] `docs/specification.md`: перенести финальный контракт (модель, контроллер, движок,
      адаптер, ошибки, accessibility, SSR, версионирование, вне scope).
- [x] `README.md`: badges, install, quick start, wiring a real backend, props-таблица,
      exposed classes, theming, animations, accessibility, SSR, mock engine/adapter,
      development, scope and known limits.
- [x] README внутри `packages/core` и `packages/react`.
- [x] Первый changeset (`minor` для обоих до 1.0.0), `.changeset/pre.json` при необходимости.
- [x] `LICENSE` (MIT) в корне и пакетах.

**Готово, когда:** version PR формируется, документация описывает публичный API без пробелов.
→ выполнено: `changeset status` даёт `minor` обоим пакетам, а `.github/workflows/release.yml`
(`changesets/action`) собирает из записей version PR. Спека получила §8–§11: доменную модель и
состояние, таблицу конфигурации, экспорты core и `/dom`, свойства React-обвязки, ключи строк,
слоты классов, токены, `data-sn-*` и карту «что чем доказано»; README — badges, quick start,
подключение реального бэкенда, props-таблицу, таблицу классов, mock-движок и раздел ограничений.
`pre.json` не нужен: предрелизных версий нет.

Три уборки, отложенные прошлыми итерациями (согласованы в начале итерации):

- слот `queueHeader` удалён из `SnClassSlot`, `SN_CLASS` и `soundline.css` — разметки у него не
  было с Iteration 9; замена — `header`/`sn-header` (в changeset отмечено как несовместимое);
- у отказавшего списка треков своя строка: ключ `queueError` и `PlayerView.errorMessage`
  (выбор по `error.phase === 'tracks'`), поэтому ни блок ошибки, ни live-регион больше не
  обвиняют трек, который никто не пытался играть;
- удаление строки очереди анимируется: `QueueList` держит удалённую через список строку на время
  выхода (`useExitingRows`), помечает её `data-sn-exiting`/`aria-hidden`, выводит её кнопки из
  tab-порядка, а CSS-слой (`@keyframes sn-row-out`, токен `--sn-row-max-height`, локальная
  `--sn-exit-duration`) её растворяет и схлопывает. При reduced motion строка исчезает сразу;
  смена плейлиста, shuffle и подмена очереди приложением остаются мгновенными.

Отмечено в отчёте: четвёртая уборка сверх списка — объявленный, переведённый, но никогда не
рендерившийся ключ `unsupportedLabel` теперь действительно показывается (`errorMessage`
выбирает `queueError` для списка, `unsupportedLabel` для `NOT_SUPPORTED`, иначе
`genericError`); публикующая половина workflow требует секрета `NPM_TOKEN` (схема релиза
переработана при подготовке к публикации — см. раздел «Публикация: GitHub, Pages, npm»);
`verify:install`
теперь проверяет, что tarball действительно везёт `README.md` и `LICENSE` из своего `files`;
исправлены утверждения, что контрастность проверяется браузерным прогоном (её не проверяет
ничто — перенесено в известные ограничения спеки и README); тест возврата фокуса в
`regressions.test.tsx` больше не соревнуется с mock-часами.

---

### Правки по ревью после Iteration 16 · ✅ готово

Ревью релиз-кандидата нашло 10 проблем (3 высокого приоритета, 5 среднего, 2 небольшие);
все исправлены. Коммит не делался — стоп на ревью.

- [x] **P1 · публикация.** `release.yml` передавал в `publish` shell-условие `if`, а
      `changesets/action` запускает вход как исполняемую команду: `@actions/exec` делит
      строку на argv и спавнит первое слово, поэтому `if` искали в `PATH` и публикация
      падала. При подготовке к публикации (раздел «Публикация: GitHub, Pages, npm») схема
      заменена на проверенную в Slotline: `changesets/action@v2`, отдельный шаг проверки
      `NODE_AUTH_TOKEN` с понятной диагностикой, provenance, git-теги и GitHub releases.
- [x] **P1 · замена движка.** `updateEngine()` отписывался от старого движка, но не
      останавливал его: оба оставались `playing`, а `stop()` доставал только новый.
      Замена теперь отцепляет старый движок, ставит его на паузу и отменяет разрешение
      источника, начатое для него.
- [x] **P2 · перезапуск во время загрузки.** `stop()` отменял загрузку источника, но
      оставлял её токен занятым, поэтому следующий `start()` считал источник уже
      загруженным и не повторял загрузку — `playing: true` над idle-движком. Незавершённая
      загрузка теперь инвалидирует токен, а дошедший до движка источник сохраняется:
      обычный перезапуск по-прежнему продолжает с текущей позиции.
- [x] **P2 · подсветка строки.** Очередь передавала в `className` ключи слотов
      (`trackItemActive`, `trackItemPlaying`), а стили ждут `sn-track-item-active` и
      `sn-track-item-playing`; состояние теперь разрешается через `SN_CLASS`, и текущая
      с играющей строки снова выделяются.
- [x] **P2 · контраст подписей.** В светлой теме исполнитель и альбом давали 2.22:1 и
      2.02:1, в тёмной `--sn-text-subtle` — 3.56:1 на панели очереди. `--sn-text-subtle`
      (тёмная) и `--sn-text-muted`/`--sn-text-subtle` (светлая) подняты до ≥4.5:1 на всех
      поверхностях, включая подсветку играющей строки; `styles.test.ts` измеряет это
      расчётом WCAG, спека больше не утверждает, что контраст не проверяется.
- [x] **P2 · фокус.** Программная смена трека переносила фокус с `<body>` на карточку даже
      при `autoFocus=false` — вместе со скроллом страницы. Карточка теперь запоминает, был
      ли фокус внутри неё, и возвращает только фокус, потерянный при замене содержимого
      (`preventScroll`); фокус, которого у неё не было, не перехватывается.
- [x] **P2 · мобильный playground.** При 390 px страница достигала 466 px: длинное имя
      пакета в заголовке (flex-item с автоматическим `min-width`) и обёртка акцента без
      `min-width: 0` не давали карточке сузиться. Заголовок и обёртка сжимаются, на узких
      экранах меньше отступы; 390 px и 320 px в compact дают `scrollWidth === innerWidth`,
      карточка — внутри панели.
- [x] **P3 · отметка удаления.** Отметка `markLeaving` не истекала: после отказа
      приложения удалить строку она оставалась и более позднее независимое обновление
      очереди проигрывало анимацию удаления для давнего клика. Отметка живёт только до
      подтверждающего изменения списка и истекает через окно выхода; отказ снимает её
      сразу.
- [x] **P3 · ползунок перемотки.** Дорожка `overflow: hidden` обрезала круг 14×14 на
      дорожке 6 px, особенно на концах шкалы. Дорожка больше не клипует (заливка и
      буфер сохраняют свой радиус, блик играющей заливки клипуется ею же);
      `check:container` проверяет, что между ползунком и корнем нет клипующего предка.

#### Второй блок правок: фокус Retry, композиция и очередь · ✅ готово

Повторное ревью итерации 16 нашло ещё один дефект фокуса и несобранную композицию
плеера. Блок выполнен в рабочем дереве; коммит не делался — стоп на ревью.

- [x] **P1 · фокус Retry.** Клавиатурный Retry теперь сначала переводит фокус на
      сохраняющуюся карточку (`preventScroll`), затем вызывает `actions.retry()`.
      Ошибка → загрузка → новая ошибка/готовность больше не оставляют фокус на `<body>`:
      после повторной ошибки `Tab` попадает на новую кнопку, после восстановления — на
      первый элемент управления. Программный `retry()` и действия приложения фокус не
      перемещают; уход к внешнему элементу во время загрузки не перехватывается.
      Проверены оба сценария — отказ списка (трека ещё нет) и отказ источника.
- [x] **Композиция.** Введены внутренние группы `progress` (дорожка + время) и `controls`
      (транспорт + громкость); ритм 12/4/8 px задан группами, а не отрицательными
      отступами. Ширины 380/300, Play 48×48 и кнопки 36×36 сохранены.
- [x] **Громкость.** Компактная центрированная строка `кнопка · слайдер · процент`:
      максимум 208 px, боковые колонки 32 px, промежутки 8 px. Трек вписан на 7 px с
      каждой стороны, `useSlider` получил `trackInset`, поэтому бегунок и преобразование
      координат совпадают; 0–100 %, mute и запомненный уровень проверены.
- [x] **Repeat и каскад.** Самодельные иконки заменены локальными Tabler `repeat` и
      `repeat-once` (20 px, штрих 2, без runtime-зависимости); атрибуция и MIT-лицензия
      едут в `THIRD-PARTY-LICENSES.md` React-пакета. Reset кнопок ослаблен до `:where()`,
      поэтому токены цвета Play и приглушённого Repeat действительно применяются.
- [x] **Очередь и длительности.** Панель стала прозрачной частью карточки; заголовок
      выровнен по тексту строк, счётчик — обычный приглушённый текст. Строка показывает
      `durationLabel` адаптера в стабильной колонке внутри кнопки выбора, удаление осталось
      соседним элементом, место под эквалайзер зарезервировано во всех строках, заливка
      играющей строки ослаблена до 60 %. Удаление показывается при наведении и фокусе и
      всегда видно на touch (`@media (hover: none)`), а не постоянно на desktop.
- [x] **Обложка и Retry.** Обложка 72 px в узкой карточке, 88 px при контейнере от 340 px,
      64 px в compact. Добавлен `--sn-danger-contrast`; Retry даёт ≈6.32:1 в тёмной теме и
      ≈4.67:1 в светлой, тест контраста расширен на кнопку и состояния строк.
- [x] **Контракты и примеры.** Слоты `progress`, `controls`, `volumeValue`, `trackDuration`
      и токены `--sn-volume-width`, `--sn-artwork-size`, `--sn-danger-contrast`
      задокументированы; JSDoc, таблицы README/спеки, Storybook (длинные названия,
      неизвестная длительность, 0/1/100 %, три режима Repeat, Retry с восстановлением) и
      снимки обновлены; changesets обоих пакетов дополнены.
- [x] **Проверки.** `pnpm typecheck`, `pnpm test`, `pnpm build`, playground, Storybook,
      `check:layout`/`check:container`/`check:hydration` и `verify:install` на react-18 и
      react-19 зелёные. Браузер подтвердил фокус карточки и отсутствие прокрутки при Retry,
      повторную ошибку с новой кнопкой, ширины 280/320/400/800 (обложка 72/72/88/88,
      compact 64), мобильные 320/390 без горизонтальной прокрутки, громкость 208 px с
      колонками 32/32 и бегунком 7…121 px, цвета Play/Repeat, сохранение геометрии строки
      при старте воспроизведения и reduced motion. Снимки до/после — в `.screenshots/`.

#### Третий блок правок: буферизация, сетка и светлая тема · ✅ готово

Повторное ревью рабочего дерева (`.verify/review/REPORT.md`) нашло восемь дефектов и две
рекомендации; все закрыты в рабочем дереве. Проверка 19 октября нашла ещё два случая —
фокус после ухода на обычный текст и центрирование строки громкости; оба закрыты здесь же.
Коммит не делался — стоп на ревью.

- [x] **P1 · буферизация.** `createMediaEngine()` слушает `playing`, а не только `play`:
      после `waiting` возобновление возвращает статус `playing`, и виджет больше не
      остаётся на блоке загрузки при играющем звуке. `pause()` во время `loading`
      останавливает ожидающее воспроизведение, а источник, чьи метаданные ещё грузятся,
      не переводится в `paused` (элемент уже на паузе — пауза идемпотентна). Controller
      вызывает `engine.pause()` и для статуса `loading`; покрыто тестами движка и
      контроллера, включая поздний `playing` после паузы.
- [x] **P2 · фокус после удаления последнего трека.** `focusout` при размонтировании
      сфокусированной строки приходит без `relatedTarget` — так же, как уход на пустую
      часть страницы. Карточка запоминает последний элемент внутри себя и возвращает
      фокус, если этот элемент отсоединён; уход к живому элементу страницы не
      перехватывается. `focusout` на обычный текст приходит без `focusin` и без
      `relatedTarget`: microtask проверяет, остался ли узел в документе, поэтому уход на
      текст забывает ссылку, а последующая отложенная ошибка не забирает фокус. Тесты
      покрывают удаление последней строки, уход на текст и внешний контрол; в Chrome
      проверены оба сценария.
- [x] **P2 · classNames состояний.** `trackItemActive` и `trackItemPlaying` разрешаются
      через `cls` (как остальные слоты), поэтому пользовательские классы состояний
      попадают в DOM рядом с библиотечными. Тест проверяет переопределения обоих состояний.
- [x] **P2 · светлая тема.** Добавлен `--sn-track` — незаполненная часть seek и volume,
      отдельная от `--sn-control` (в светлой теме control совпадает с поверхностью
      карточки). `styles.test.ts` измеряет контраст дорожки к карточке и буфера к дорожке
      в обеих темах; `styles.test.ts` также проверяет, что обе шкалы читают `--sn-track`.
- [x] **P2 · accent в playground.** Пресет задаёт только оттенок и контраст иконки, а
      остальные токены выводятся CSS-правилом на самом `.sn-root` (специфичность выше его
      собственных объявлений) через `color-mix` с текстом текущей темы. Работает в обеих
      темах: `emerald` даёт зелёный Play и тёмную краску на светлой карточке, `default`
      не переопределяет встроенную палитру.
- [x] **P2 · мобильная галерея.** `figure` получила `min-width: 0` и `max-width: 100%`,
      отступы галереи — `clamp(16px, 4vw, 32px)`. На 320 px карточки 288 px,
      `scrollWidth === innerWidth`; `check:container` измеряет это в Chrome.
- [x] **P2 · сетка плейлиста.** Название и исполнитель начинаются на одной вертикали
      (исполнитель сдвинут на слот эквалайзера 14 + 6 px), заголовок Playlist — на той же
      линии, счётчик заканчивается на правом краю длительностей (общий правый отступ 44 px:
      10 padding + 8 gap + 26 удаление). `check:container` проверяет оба края по реальным
      текстовым прямоугольникам.
- [x] **P3 · нижняя строка очереди.** `--sn-queue-fade` задаёт одновременно нижний отступ
      списка и высоту маски-затухания: обрезанная строка читается как продолжение, а в
      конце прокрутки под затуханием остаётся только отступ. `check:container` проверяет
      маску, отступ и полностью видимую последнюю строку в конце прокрутки.
- [x] **Мелочи.** На coarse pointer seek получает невидимую зону попадания 44 px, volume —
      40 px (вверх только до 8 px зазора, чтобы не перекрывать транспорт), компоновка не
      меняется. Процент громкости стал подсказкой: виден при перетаскивании и фокусе в
      строке, подсказка абсолютная и вне потока, поэтому видимая пара «mute + ползунок»
      центрируется; числа в `aria-valuenow`/`aria-valuetext` остаются всегда.
- [x] **Проверки.** `pnpm typecheck`, `pnpm test` (306 core + 149 React), `pnpm build`,
      `check:layout`, `check:container` (включая 320 px галереи, 280 px громкости, сетку,
      затухание и подсказку), probes буферизации, удаления последней строки, отложенной
      ошибки и фокуса в Chrome; changeset обоих пакетов
      дополнен, снимки README (`docs/images/player-{dark,light}.png`) пересняты из
      Storybook на итоговом CSS.

---

### Публикация: GitHub, Pages, npm · ✅ подготовлено

**Цель:** репозиторий на GitHub, демо и Storybook на Pages, пакеты в npm — по схеме Slotline.

Задачи:

- [x] `.github/workflows/pages.yml`: playground в корне проектной страницы, Storybook в
      `/storybook/`, `.nojekyll`, деплой через `upload-pages-artifact`/`deploy-pages`.
- [x] `apps/playground/vite.config.ts`: `base` из `PAGES_BASE` — Pages отдаёт проект из
      `/soundline/`, локально остаётся `/`.
- [x] `.github/workflows/release.yml` по схеме Slotline: `changesets/action@v2`, отдельный шаг
      проверки `NODE_AUTH_TOKEN` с читаемой диагностикой, `NPM_CONFIG_PROVENANCE`, git-теги и
      GitHub releases. `tools/publish.mjs` и скрипт `release:publish` удалены.
- [x] README: бейджи npm / demo / Storybook, ссылки под заголовком, раздел про релиз и Pages.

Остаётся снаружи репозитория (нужны права владельца и токен npm):

- [ ] создать `github.com/nickkupriyanov/soundline` и запушить `main`;
- [ ] добавить секрет `NPM_TOKEN` (granular, read-and-write, 2FA bypass);
- [ ] включить Pages: Settings → Pages → Source: GitHub Actions;
- [ ] смёржить version PR (0.1.0 → 0.2.0) — он публикует оба пакета, ставит теги
      и открывает GitHub releases.

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

### Точечная правка после Iteration 16 — симметрия громкости · ✅ готово

- [x] Центр дорожки громкости выровнен под Play; боковые слоты иконки и процентов — по 34 px.
- [x] Обновлены проверки центрирования и скриншоты README в обеих темах.
- [x] `pnpm typecheck`, `pnpm test` (306 core + 149 React), `pnpm build` и `check:container` зелёные.
