# Спецификация Soundline

> Черновик. Согласованные решения зафиксированы ниже; полная версия — к выпуску
> (Iteration 16 в [`roadmap.md`](../roadmap.md)).

## 1. Цель и границы

Soundline — переиспользуемая библиотека современного аудиоплеера с framework-free
ядром и обвязкой для React. Проектируется по практикам проекта booking (Slotline):
общий контроллер, чистый reducer, производная модель, инъекция побочных эффектов,
темизация через CSS-переменные, доступность по умолчанию.

Библиотека отвечает за:

- Воспроизведение одного трека и плейлиста/очереди.
- Состояние плеера: play/pause, позиция, громкость, mute, скорость, loop, shuffle.
- Навигацию по очереди (next/previous), выбор трека.
- Формирование снимка состояния и производной модели для отображения.
- Доступность, клавиатуру и адаптивное отображение.

Приложение отвечает за:

- Источник треков и метаданные (через адаптер).
- Реализацию движка воспроизведения (по умолчанию — обёртка над `HTMLAudioElement`).
- Аналитику, персистентность, интеграции (Media Session включает библиотека по флагу).

В первую версию **не входят**: waveform, эквалайзер/визуализация FFT, drag-n-drop
переупорядочивание очереди, избранное, поиск, интеграция со стриминг-сервисом,
скачивание, синхронизированные тексты.

## 2. Архитектура

### 2.1 Пакеты

```
@nickkupriyanov/soundline-core          доменная модель, reducer, derive, контроллер,
                                        движок и адаптер как контракты, i18n, классы
@nickkupriyanov/soundline-core/dom      framework-free DOM-утилиты (focus, size, media, height)
@nickkupriyanov/soundline-core/styles.css  общий stylesheet
@nickkupriyanov/soundline-react         обвязка React: провайдер, готовый виджет, части
@nickkupriyanov/soundline-react/motion  spring-анимации (опциональный peer `motion`)
@nickkupriyanov/soundline-react/styles.css общий stylesheet (копия core)
```

### 2.2 Контроллер

`createPlayerController(options)` — framework-free и свободен от политики ввода-вывода.
Три правила:

- **Ничего не происходит при создании.** Ни запроса, ни подписки, ни таймера. Обвязка
  вызывает `start()` и `stop()`; оба идемпотентны.
- **Управляемость фиксируется при создании.** Переданное значение — предложение:
  контроллер уведомляет приложение и ждёт возврата. Собственное значение применяется
  сразу и тоже уведомляет.
- **Побочные эффекты инъектируются.** Воспроизведение — через `PlaybackEngine`,
  данные — через `TrackSourceAdapter`.

Публичный интерфейс: `getSnapshot()`, `getEngineRef()`, `subscribe(listener)`,
`updateConfig()`, `updateInputs()`, `updateAdapter()`, `updateEngine()`, `start()`,
`stop()`, `actions`.

Actions: `play`, `pause`, `toggle`, `seek(seconds)`, `seekBy(delta)`, `next`, `previous`,
`selectTrack(id)`, `enqueue`, `removeFromQueue`, `reorderQueue`, `clearQueue`, `setVolume`,
`toggleMute`, `setLoop`, `setShuffle`, `setRate`, `retry`, `reset`.

### 2.3 Снимок и производная модель

```ts
interface PlayerSnapshot {
  revision: number;
  state: Readonly<PlayerState>;
  view: Readonly<PlayerView>;
}
```

`derivePlayerView(state, config, engineRef)` — чистая функция, кешируется контроллером по
ключу ревизий. Снимок не содержит функций, DOM-элементов и объектов фреймворков; действия
находятся отдельно в `controller.actions`.

### 2.4 Управляемые и неуправляемые значения

| Значение        | Управляемое свойство | Начальное значение | Событие           |
| --------------- | -------------------- | ------------------ | ----------------- |
| Воспроизведение | `playing`            | `defaultPlaying`   | `onPlayingChange` |
| Громкость       | `volume`             | `defaultVolume`    | `onVolumeChange`  |
| Mute            | `muted`              | `defaultMuted`     | `onMutedChange`   |
| Режим повтора   | `loop`               | `defaultLoop`      | `onLoopChange`    |
| Перемешивание   | `shuffle`            | `defaultShuffle`   | `onShuffleChange` |
| Скорость        | `rate`               | `defaultRate`      | `onRateChange`    |
| Текущий трек    | `currentTrackId`     | `defaultTrackId`   | `onTrackChange`   |
| Очередь         | `queue`              | `defaultQueue`     | `onQueueChange`   |

Позиция воспроизведения (`currentTime`) управляемой не является: это телеметрия движка,
она попадает в `view`, а наружу отдаётся троттлинг-событием `onProgress`.

Правила: режим фиксируется при создании; внешнее обновление не вызывает обратного
события; `null` означает отсутствие выбора; диагностика смены режима — предупреждение в
development и сохранение исходного режима в production.

### 2.5 Движок

```ts
interface PlaybackEngine {
  load(src: string, options?: { autoplay?: boolean }): void;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setRate(rate: number): void;
  getState(): EngineState;
  subscribe(listener: () => void): () => void;
}
```

`createMediaEngine()` оборачивает `HTMLAudioElement`, создаётся лениво и не обращается к
`window`/`document` при импорте. `createMockEngine()` детерминирован и используется в
тестах, Storybook и playground.

### 2.6 Адаптер

```ts
interface TrackSourceAdapter<TData = unknown> {
  getTracks(query: TrackQuery): Promise<Track<TData>[]>;
  resolveSource?(track: Track<TData>, options: { signal: AbortSignal }): Promise<ResolvedSource>;
}
```

`createStaticAdapter(tracks)` для простого массива, `createMockAdapter()` для демо и тестов.
Смена `context.key` означает другой плейлист: загрузки отменяются, очередь и выбор очищаются.

### 2.7 Анимации

Виджет рисуется через `AnimationKit` — три примитива, которые обвязка заменяет целиком:

```ts
interface AnimationKit {
  StepHost(props): ReactNode; // шаг контента (обложка), ключ — текущий трек
  Item(props): ReactNode; // строка группы: сам `<li>` с tab-порядком и `ref`
  Height(props): ReactNode; // контейнер, следующий за высотой содержимого
}
```

Кит рисует те же классы-хуки (`sn-step-host`/`sn-step`, `sn-stagger-item`,
`sn-height`/`sn-height-inner`), поэтому разметка, доступность и стили не зависят от
выбранного кита; CSS-слой читает и `data-sn-*`-хуки (`data-sn-playing`,
`data-sn-animating`, `data-sn-motion`) — они часть контракта. `Item` обязан быть
элементом строки и прокидывать `ref`: по нему список двигает фокус.

- `cssAnimations` (по умолчанию) — только CSS, ноль рантайма: кроссфейд обложки со
  стороной перехода, стаггер строк очереди по `--sn-index`, высота карточки,
  «дышащие» полосы эквалайзера у играющего трека и блик заливки прогресса. Замер
  высоты — `observeAnimatedHeight` из core.
- `motionAnimations` — тот же кит на `motion` (`AnimatePresence`, springs, `whileTap`);
  живёт только в подпути `/motion`, главный вход `motion` не импортирует, а `motion`
  остаётся опциональным peer.
- `prefers-reduced-motion: reduce` схлопывает анимации: CSS — правилом в `base.css`,
  JS-кит — через `useReducedMotion`, высота — вообще без замера и клиппинга.

### 2.8 SSR и гидратация

Правило одно: **разметка серверного прохода — это разметка, которую клиент гидрирует**.
Оно держится на трёх вещах:

- **Детерминированный первый рендер.** `resolvePlayerConfig` не знает про браузер:
  фолбэки — константы `FALLBACK_LOCALE` (`en`), `FALLBACK_THEME` (`dark`),
  `FALLBACK_LAYOUT` (`card`). Первый рендер (и серверный, и первый клиентский) всегда
  использует их, поэтому обе стороны совпадают. Реальная локаль (`navigator.language`)
  читается обвязкой **в эффекте** после маунта и приходит обычным обновлением, а не
  вторым вариантом разметки. Тема не детектируется вовсе: плеер тёмный, пока приложение
  не попросит светлую. Приложение, передавшее `locale`/`theme`, получает одинаковый
  ответ на обеих сторонах без всякой работы.

- **Движок только на клиенте.** `createMediaEngine()` не обращается к `window`/`document`
  ни при импорте, ни при создании: `<audio>` строится по первому `load()`. Серверный проход
  не вызывает `start()`, значит за весь рендер на сервере не создаётся ни одного элемента
  и ни одного запроса. Движок, который приложение передало пропом, также не трогается до
  маунта.

- **Сериализуемая телеметрия.** `controller.getEngineRef()` — плоский объект из скаляров
  (`status`, `src`, `currentTime`, `duration`, `buffered`, `volume`, `muted`, `rate`,
  `error`): его можно отдать в HTML и вернуть пропом `initialEngineRef`. Тогда первый
  снимок клиента — тот же, что нарисовал сервер, и гидратации не о чем расходиться, пока
  настоящий движок не сообщит своё. Начиная с `start()` телеметрией владеет движок, и
  `initialEngineRef` больше не применяется.

Проверка — `packages/react/src/ssr.test.tsx`: `renderToString` → `hydrateRoot` с
`onRecoverableError`, тихий `console.error` и сохранённый узел серверной разметки, плюс
негативный контроль (расхождение обязано быть замечено). Сериализуемость ссылки
зафиксирована в `controller.test.ts`.

## 3. Ошибки

```ts
type PlaybackErrorCode =
  | 'TRACK_NOT_FOUND'
  | 'SOURCE_UNAVAILABLE'
  | 'NOT_SUPPORTED'
  | 'DECODE_FAILED'
  | 'NETWORK_FAILURE'
  | 'ADAPTER_CONTRACT_VIOLATION'
  | 'UNKNOWN';
```

`PlaybackError` — экспортируемый runtime-класс; `isPlaybackError()` проверяет структурно
(не `instanceof`), чтобы несколько копий пакета не понижали реальную ошибку до `UNKNOWN`.
`onError(error, { phase: 'tracks' | 'source' | 'playback' })` вызывается для ожидаемых
отказов; отменённая библиотекой загрузка ошибкой не считается.

## 4. Тексты интерфейса

Новые строки появляются одновременно в core, английском и русском словарях. Обвязки не
вводят собственных текстов для общих состояний. Подстановка — единый типизированный
механизм `{name}`; произвольный HTML из словарей не рендерится.

## 5. Публичный API React

| Экспорт                                       | Назначение                                |
| --------------------------------------------- | ----------------------------------------- |
| `Player`                                      | готовый виджет                            |
| `PlayerProvider`                              | владеет одним контроллером, даёт контекст |
| `PlayerView`                                  | готовое представление внутри провайдера   |
| `usePlayerFlow`                               | headless-оболочка `{ snapshot, actions }` |
| `usePlayerContext`                            | доступ к потоку                           |
| `createPlayer`                                | привязка кастомного animation kit         |
| `animations`, `AnimationKit`, `cssAnimations` | CSS-кит по умолчанию                      |
| `/motion`, `motionAnimations`                 | spring-кит, зависимость необязательна     |
| `components`                                  | заменяемые части интерфейса               |

SSR: первый рендер детерминирован (фолбэки core), `locale`/`theme` читаются только после
маунта; телеметрию серверного прохода передают пропом `initialEngineRef` (обычно это
`controller.getEngineRef()`), после `start()` ею владеет движок.

## 6. Доступность

- SeekBar и Volume — `role="slider"` с `aria-valuemin/max/now` и `aria-valuetext`
  («1:23 из 4:05»); клавиатура: стрелки, `Home`, `End`, `PageUp`/`PageDown`, фокус остаётся
  на слайдере.
- Транспорт — кнопки с явными доступными именами; prev/next `disabled` по
  `canPrev`/`canNext`. Play/pause — одна кнопка, у которой меняется имя (`Play` ⇄ `Pause`)
  и **нет** `aria-pressed`: «Pause, нажато» — состояние, которое не нужно слышать.
  Toggle-кнопки (shuffle, repeat, mute) — `aria-pressed`; имя mute говорит, что сделает
  нажатие (`Mute` ⇄ `Unmute`).
- Очередь — простой список (`<ul>`) строк, в каждой две кнопки-соседа: выбор трека и
  удаление. Текущий трек помечен `aria-current` на кнопке выбора; по строкам идут
  стрелками (`Home`/`End` — к концам) через roving tabindex, кнопка удаления каждой строки
  остаётся отдельной точкой табуляции. `role="listbox"`/`option` не используется: у `option`
  включён `childrenPresentational`, поэтому фокусируемое содержимое внутри неё недопустимо —
  axe сообщает `nested-interactive` (WCAG 4.1.2).
- Анонсы — один вежливый live region (`role="status"`); в один момент времени одно
  сообщение по приоритету: ошибка → конец плейлиста → список ещё загружается → пустой
  список → трек (`Сейчас играет: {title}` / `Пауза: {title}`). Пауза проговаривается в
  регионе: смена имени не получившей фокус кнопки не озвучивается.
- Фокус — при монтировании ничего не фокусируется; `autoFocus` — опция, а не поведение по
  умолчанию. Если изменение уносит сфокусированный элемент (удаление строки очереди, смена
  состояния `ready → error/empty`), фокус возвращается внутрь карточки, а не падает в
  `<body>`; фокус вне виджета не перехватывается.
- Автоматическая проверка — axe (`jest-axe`) по каждому состоянию виджета в
  `packages/react/src/a11y.test.tsx`; контрастность проверяется браузерным прогоном
  (в jsdom стили не применяются).
- `prefers-reduced-motion` глушит анимации.
- `pauseWhenHidden` (по умолчанию `false`) ставит на паузу, когда документ становится
  скрытым; обратно не возобновляет — это решение приложения, а не плеера.
- Media Session API подключается по флагу `mediaSession`: `true` включает с шагом перемотки
  по умолчанию (10 с), `{ skipSeconds }` — со своим. Плеер публикует метаданные
  (`title/artist/album/artwork`), состояние (`playing`/`paused`/`none`) и позицию, а
  `play/pause/nexttrack/previoustrack/seekbackward/seekforward/seekto` направляет в обычные
  действия контроллера. Где API нет или отдельное действие не поддержано — тихий откат.

## 7. Версионирование

До `1.0.0`: исправление — `patch`, новая возможность — `minor`, несовместимое изменение —
`minor` с миграцией и отметкой breaking change. Внутренний рефакторинг — `patch`.
Изменение общего CSS — релиз каждого биндинга, в чей tarball этот CSS копируется.
Изменение только CI, инструментов или playground библиотек не бампает.
