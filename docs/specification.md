# Спецификация Soundline

> Контракт версии 0.1.0: всё описанное ниже действует в текущем коде. Имена и
> сигнатуры в таблицах взяты из публичного API пакетов. История решений и план —
> в [`roadmap.md`](../roadmap.md).

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

### 1.1 Известные ограничения

- **Контрастность измеряется для подписей, Retry и состояний строк, остальной палитры — нет.**
  Тест токенов (`packages/core/src/styles/styles.test.ts`) считает контраст
  `--sn-text-muted`/`--sn-text-subtle` против всех поверхностей, кнопки Retry
  (`--sn-danger-contrast` на `--sn-danger`) и текста строк очереди в состояниях
  «обычное», hover, выбранное и играющее, и требует 4.5:1 в обеих темах. Остальная
  палитра, а также пользовательская тема автоматически не измеряются: в jsdom нет
  стилей, а браузерные проверки смотрят геометрию, цвета ключевых кнопок, фокус и
  reduced motion. Смена остальных цветов требует ручного прогона axe в браузере.
- **Удаление строки очереди анимирует CSS-слой.** Motion-кит помечает свои строки
  `data-sn-motion='true'` и оставляет движение за собой — выхода у него пока нет.
- Схлопывание покидающей строки идёт от `--sn-row-max-height` (3.5rem): строка выше
  этого значения всё равно растворяется, но схлопывается от верхней границы.
- Отказ списка треков и отказ источника имеют разные тексты, но общий заголовок
  `errorLabel` («Ошибка воспроизведения»).
- Один плеер — один атомарный выбор (`PlayerSelection`); мультивыбора и групповых
  операций нет.
- `clearQueue`, смена `context.key` и подмена очереди приложением не анимируются:
  переход есть только у удаления, попрошенного через список.

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

`createMediaEngine()` слушает и `play`, и `playing`: после `waiting` возобновление
приходит только вторым событием, и без него статус оставался `loading` при играющем
звуке. `pause()` может прийти и при статусе `loading` (задача контроллера — остановить
воспроизведение, которое ждёт буфера); реализация, которой нечего останавливать, обязана
ничего не менять. Обратное тоже верно: источник, чьи метаданные ещё грузятся, не
переводится в `paused`.

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

Текст отказа выбирается один раз, в core (`view.errorMessage`), и попадает и в блок ошибки,
и в live-регион: отказ списка — `queueError`, `NOT_SUPPORTED` — `unsupportedLabel`, всё
остальное — `genericError`.

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
- Процент громкости — подсказка, а не постоянная колонка: он появляется при
  перетаскивании слайдера и при фокусе внутри строки громкости, не сдвигая соседей
  (вне потока, у него нет зарезервированной колонки), и не является отдельной точкой
  табуляции. Числовые
  `aria-valuenow`/`aria-valuetext` есть всегда. На coarse pointer у seek и volume есть
  невидимая зона попадания выше видимой дорожки (44 и 40px) без изменения компоновки.
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
  `<body>`; фокус вне виджета не перехватывается. Уход на обычный текст или пустую область
  страницы приходит тем же `focusout` без `relatedTarget`, что и удаление узла; поэтому
  ссылка на ушедший узел сбрасывается в microtask, если он ещё в документе: последующая
  отложенная ошибка не забирает фокус в плеер. Клавиатурный Retry сначала переводит
  фокус на сохраняющуюся карточку (`preventScroll`), затем запускает `retry()`: следующий
  `Tab` попадает на новую кнопку после повторной ошибки или на первый элемент управления
  после восстановления. Программный `retry()` и действия приложения вне виджета фокус не
  перемещают.
- Автоматическая проверка — axe (`jest-axe`) по каждому состоянию виджета в
  `packages/react/src/a11y.test.tsx`; контрастность подписей, Retry и состояний строк —
  тестом токенов в `packages/core/src/styles/styles.test.ts` (axe в jsdom стилей не видит).
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

Релиз идёт через version PR: изменения описываются файлами в `.changeset/`, workflow
`release.yml` собирает из них PR с новыми версиями и CHANGELOG, а публикация
происходит при merge этого PR.

## 8. Доменная модель и состояние

### 8.1 Трек, плейлист, выбор

```ts
interface Track<TData = unknown> {
  id: string; // идентичность: выбор, очередь и ключи элементов
  title: string;
  artist?: string;
  album?: string;
  artwork?: string;
  src?: string; // отсутствует, если адаптер резолвит источник лениво
  duration?: number; // секунды, если адаптер уже знает
  data?: TData; // типизированные данные, которых виджет не знает
}

interface PlaylistContext<TData = unknown> {
  key: string; // смена ключа — другой плейлист
  data?: TData;
}

interface PlayerSelection {
  trackId: string | null; // null — «ничего не выбрано», а не «пустая очередь»
}
```

Смена `title` не меняет трек: идентичность держится на `id`, всё остальное — данные
отображения. Смена `context.key` отменяет незавершённые загрузки и очищает очередь и
выбор.

### 8.2 Телеметрия движка

`EngineStatus`: `idle | loading | ready | playing | paused | ended | error`.

`EngineState` — плоский объект из скаляров: `status`, `src`, `currentTime`, `duration`,
`buffered`, `volume`, `muted`, `rate`, `error` (код, не исключение). Скалярность —
условие сериализуемости `getEngineRef()` (см. 2.8); `createEngineState(overrides)`
собирает такой объект с детерминированными фолбэками.

### 8.3 Состояние плеера

`PlayerState` — то, чем владеет редьюсер:

| Поле                                            | Смысл                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `contextKey`                                    | плейлист, которому принадлежит очередь                                         |
| `queue`, `currentTrackId`, `index`              | очередь в порядке воспроизведения, выбор и его позиция (`-1` — выбора нет)     |
| `queueToken`, `queueStatus`, `queueError`       | ревизия запроса списка и его исход                                             |
| `playing`, `pendingPlay`                        | намерение играть (не зеркало движка) и «играть попросили, движок не готов»     |
| `started`                                       | контроллер запущен (`start`/`stop`)                                            |
| `status`, `currentTime`, `duration`, `buffered` | зеркало телеметрии движка                                                      |
| `error`                                         | отказ воспроизведения, помеченный фазой (`PlayerError`)                        |
| `volume`, `muted`, `rate`                       | громкость, mute, скорость                                                      |
| `loop`, `shuffle`, `order`                      | режимы и сохранённый до перемешивания порядок (`null`, когда shuffle выключен) |
| `loadToken`                                     | ревизия загрузки источника: устаревшие события движка отбрасываются            |

`playerReducer(state, action)` и `createPlayerState(options)` — чистые: без часов, без
DOM и без движка. `PlayerAction` — закрытый список переходов.

### 8.4 Конфигурация

`resolvePlayerConfig(input)` превращает частичный вход в полный `PlayerConfig`. Все
фолбэки — константы, никаких обращений к браузеру.

| Вход              | Значение по умолчанию      | Комментарий                                              |
| ----------------- | -------------------------- | -------------------------------------------------------- |
| `locale`          | `FALLBACK_LOCALE` `en`     | любая метка; словарь выбирается по префиксу (`ru*` → ru) |
| `messages`        | словарь локали             | частичные переопределения строк                          |
| `theme`           | `FALLBACK_THEME` `dark`    | неизвестное значение откатывается к фолбэку              |
| `layout`          | `FALLBACK_LAYOUT` `card`   | `card` — полная карточка, `compact` — без очереди        |
| `seekStep`        | `DEFAULT_SEEK_STEP` 5      | секунды на шаг клавиатуры                                |
| `volumeStep`      | `DEFAULT_VOLUME_STEP` 0.05 | шаг громкости, `0..1`                                    |
| `showQueue`       | `true`                     | рисует ли стандартный виджет очередь                     |
| `pauseWhenHidden` | `false`                    | пауза на `visibilitychange`                              |
| `mediaSession`    | `false`                    | `true` или `{ skipSeconds }` (`DEFAULT_SKIP_SECONDS` 10) |
| `context`         | неявный один плейлист      | `PlaylistContext`                                        |

`MIN_RATE` / `MAX_RATE` (0.25 / 4) и `DEFAULT_RATE` (1) ограничивают скорость.

### 8.5 Контроллер: опции и события

`createPlayerController(options)` принимает `adapter` (обязателен), `engine`, `config`,
`inputs` (controlled/uncontrolled пары из 2.4), `handlers`, `initialEngineRef`, а также
инъекции для детерминизма: `now()` (часы для троттлинга) и `random()` (перемешивание),
`progressIntervalMs` (`DEFAULT_PROGRESS_INTERVAL` 250 мс).

События делятся на два рода. `onTrackChange`, `onPlayingChange`, `onVolumeChange`,
`onMutedChange`, `onLoopChange`, `onShuffleChange`, `onRateChange`, `onQueueChange` сообщают
то, о чём приложение просило: каждое несёт `{ contextKey, reason }`, где `reason` — `user`
(нажатие) или `automatic` (движок пошёл сам). `onProgress(seconds, { duration, trackId })`
троттлится и досылает последнее значение на паузе и после seek. `onPlay`, `onPause` и
`onEnded` сообщают то, что сделал движок, а `onError(error, { phase })` — что именно
отказало (список, источник или воспроизведение). Обновление, пришедшее из приложения,
обратного события не вызывает.

## 9. Публичный API

### 9.1 `@nickkupriyanov/soundline-core`

| Экспорт                                                                                                                                                                                                     | Что это                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `createPlayerController`, `PlayerController`, `PlayerControllerOptions/Actions/Inputs/Handlers`                                                                                                             | контроллер (2.2)          |
| `PlayerSnapshot`, `PlayerChangeMetadata`, `PlayerChangeReason`, `PlayerProgressMetadata`, `PlayerErrorContext`                                                                                              | поверхность обмена        |
| `derivePlayerView`, `createPlayerViewMemo`, `PlayerView` и части (`NowPlayingView`, `ProgressView`, `TransportView`, `VolumeView`, `QueueView`, `QueueItemView`, `PlayerSettingsView`, `PlayerActionsView`) | производная модель (2.3)  |
| `createPlayerState`, `playerReducer`, `PlayerState`, `PlayerAction`, `PlayerError`, `QueueStatus`, `createShuffledOrder`                                                                                    | состояние и переходы      |
| `resolvePlayerConfig`, `PlayerConfigInput`, `PlayerConfig`, `MediaSessionConfig`, `resolveMediaSession`, `isSoundlineTheme`, `isSoundlineLayout`                                                            | конфигурация (8.4)        |
| `FALLBACK_LOCALE/THEME/LAYOUT`, `DEFAULT_SEEK_STEP`, `DEFAULT_VOLUME_STEP`, `DEFAULT_RATE`, `MIN_RATE`, `MAX_RATE`, `DEFAULT_SKIP_SECONDS`, `DEFAULT_PROGRESS_INTERVAL`, `LOOP_MODES`                       | константы                 |
| `PlaybackEngine`, `LoadOptions`, `createEngineState`, `createMediaEngine`, `MediaEngineOptions`, `codeForMediaError`                                                                                        | движок (2.5)              |
| `TrackSourceAdapter`, `TrackQuery`, `ResolvedSource`, `createStaticAdapter`                                                                                                                                 | адаптер (2.6)             |
| `createMockEngine`, `MockEngineOptions`, `createMockAdapter`, `MockAdapterOptions`, `DEFAULT_MOCK_DURATION`, `DEFAULT_MOCK_TICK`                                                                            | фейки для тестов и демо   |
| `PlaybackError`, `PLAYBACK_ERROR_CODES`, `isPlaybackError`, `isPlaybackErrorCode`, `toPlaybackError`, `isAbortError`, `createAbortError`                                                                    | ошибки (3)                |
| `defaultMessages`, `resolveMessages`, `resolveMessageLocale`, `format`, `SoundlineMessages`, `SoundlineLocale`                                                                                              | тексты (10.1)             |
| `Track`, `PlaylistContext`, `PlayerSelection`, `EngineState`, `EngineStatus`, `LoopMode`, `SoundlineTheme`, `SoundlineLayout`, `PlaybackErrorCode`, `PlaybackErrorPhase`                                    | типы                      |
| `SN_CLASS`, `SnClassSlot`, `cx`, `ClassValue`, `createId`, `clamp`, `formatDuration`, `parseDuration`                                                                                                       | классы и мелкие помощники |
| `DEFAULT_PLAYLIST_CONTEXT`, `DEFAULT_CONTEXT_KEY`, `contextKeyOf`                                                                                                                                           | контекст плейлиста        |

### 9.2 `@nickkupriyanov/soundline-core/dom`

| Экспорт                                                                                                | Что это                                           |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `focusableWithin`, `trapFocus`                                                                         | обход фокусируемых элементов и удержание фокуса   |
| `REDUCED_MOTION_QUERY`, `DARK_SCHEME_QUERY`, `canMatchMedia`, `matchesMediaQuery`, `observeMediaQuery` | медиазапросы                                      |
| `measureSize`, `measureHeight`, `observeSize`                                                          | размеры элемента                                  |
| `observeAnimatedHeight`                                                                                | замер высоты для анимации (`AnimatedHeightState`) |
| `isDocumentHidden`, `observeVisibilityChange`                                                          | видимость документа                               |

Подпуть не обращается к `window` при импорте: браузер читается только внутри функций,
поэтому импорт безопасен на сервере.

### 9.3 `@nickkupriyanov/soundline-react`: свойства

| Свойство                                                                                                                                                                                                        | По умолчанию         | Что делает                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------- |
| `adapter`                                                                                                                                                                                                       | —                    | источник треков (обязателен)             |
| `engine`                                                                                                                                                                                                        | ленивый media-движок | бэкенд воспроизведения                   |
| `initialEngineRef`                                                                                                                                                                                              | —                    | телеметрия серверного прохода (2.8)      |
| `layout`, `theme`, `locale`, `messages`                                                                                                                                                                         | см. 8.4              | оформление и тексты                      |
| `seekStep`, `volumeStep`, `showQueue`, `pauseWhenHidden`, `mediaSession`                                                                                                                                        | см. 8.4              | поведение                                |
| `queue`/`defaultQueue`, `currentTrackId`/`defaultTrackId`, `playing`/`defaultPlaying`, `volume`/`defaultVolume`, `muted`/`defaultMuted`, `loop`/`defaultLoop`, `shuffle`/`defaultShuffle`, `rate`/`defaultRate` | —                    | управляемые и начальные значения (2.4)   |
| `on*Change`, `onProgress`, `onPlay`, `onPause`, `onEnded`, `onError`                                                                                                                                            | —                    | события (8.5)                            |
| `className`, `classNames`, `components`, `animations`                                                                                                                                                           | —                    | классы, замена частей, кит анимаций      |
| `autoFocus`                                                                                                                                                                                                     | `false`              | перевод фокуса в виджет при монтировании |

`Player`, `PlayerProvider`, `PlayerView`, `createPlayer`, `usePlayerFlow`,
`usePlayerController`, `usePlayerUI`, `usePlayerContext`, `useUI`, `useComponents`,
`useClassNames`, `useAnimations`, `cssAnimations`, `nextLoopMode`,
`DEFAULT_COMPONENTS` и `Default*`-части — см. §5; контракт частей описан в их
`*PartProps` (JSDoc в пакете) и в таблице класса-слотов 10.2.

### 9.4 `@nickkupriyanov/soundline-react/motion`

Тот же виджет, привязанный к `motionAnimations`. `motion` — опциональный peer:
главный вход его не импортирует.

## 10. Тексты, классы, токены и DOM-хуки

### 10.1 Строки

Ключи `SoundlineMessages` (условия — когда строка видна):

| Ключ                                                                    | Когда                                                                |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `playerLabel`                                                           | доступное имя региона                                                |
| `playLabel` / `pauseLabel`                                              | имя единственной кнопки play/pause                                   |
| `previousLabel` / `nextLabel`                                           | имена кнопок перехода                                                |
| `seekLabel` / `seekValue`                                               | имя слайдера позиции и его `aria-valuetext`                          |
| `volumeLabel` / `volumeValue`                                           | имя слайдера громкости и его `aria-valuetext`                        |
| `muteLabel` / `unmuteLabel`                                             | имя переключателя звука: что произойдёт при нажатии                  |
| `shuffleLabel` / `repeatOffLabel` / `repeatAllLabel` / `repeatOneLabel` | переключатели режима                                                 |
| `rateLabel` / `rateValue`                                               | имя и текст управления скоростью                                     |
| `queueLabel` / `queueCount`                                             | имя списка и счётчик треков                                          |
| `trackLabel` / `removeTrackLabel`                                       | имя строки (`{index}. {title}`) и кнопки удаления (`Remove {title}`) |
| `currentTrackLabel` / `pausedTrackLabel`                                | объявления «играет» и «пауза»                                        |
| `loadingLabel` / `emptyLabel`                                           | объявления загрузки и пустого списка                                 |
| `errorLabel` / `genericError` / `queueError` / `retryLabel`             | ошибки: заголовок, отказ трека, отказ списка, кнопка повтора         |
| `endedLabel` / `unsupportedLabel`                                       | конец плейлиста и неподдерживаемый формат                            |

### 10.2 Классы

`SN_CLASS` — единственный источник базовых классов; `SnClassSlot` — список слотов
для `classNames`. Таблица «слот → класс → что это» — в README, раздел «Classes».
Потребительские классы добавляются рядом с базовыми, никогда вместо них; слот —
точка расширения, а не структура DOM.

Помощник `cx(...)` собирает условные классы (принимает строки, объекты и массивы).

### 10.3 Токены

Все цвета, размеры и тайминги — CSS-переменные `--sn-*` в `tokens.css`; светлая тема —
тот же набор под `[data-sn-theme='light']`. Именованные токены плеера: `--sn-width`,
`--sn-width-compact`, `--sn-artwork-radius`, `--sn-artwork-size`, `--sn-seek-height`,
`--sn-seek-fill`, `--sn-track`, `--sn-queue-max-height`, `--sn-queue-fade`,
`--sn-row-max-height`, `--sn-card-gap`,
`--sn-volume-width`, `--sn-danger-contrast`. `--sn-artwork-size` равен 72px, растёт до
88px в полной карточке при контейнере от 340px и остаётся 64px в compact;
`--sn-volume-width` ограничивает строку громкости 208px: в потоке только пара «кнопка mute
32px + промежуток 8px + ползунок 124px», и она центрируется; процент — абсолютная
подсказка справа, вне потока; `--sn-track` — незаполненная часть шкал seek и
volume, отдельная от `--sn-control`, потому что в светлой теме control совпадает с
поверхностью карточки; `--sn-queue-fade` — высота нижнего затухания очереди и
одновременно её нижний отступ (в конце прокрутки под затуханием остаётся только отступ,
а не последняя строка); `--sn-danger-contrast` — цвет текста на
danger-заливке. Локальные переменные слоя
(`--sn-index`, `--sn-step-shift`, `--sn-exit-duration`, `--sn-volume-percent`,
`--sn-width-current`) пишутся слоем или биндингом и не являются токенами: тест
`styles.test.ts` следит, что всё остальное взято из токенов.

### 10.4 DOM-хуки

| Атрибут                               | Где               | Зачем                                       |
| ------------------------------------- | ----------------- | ------------------------------------------- |
| `data-sn-theme`, `data-sn-layout`     | корень            | тема и компоновка для CSS                   |
| `data-sn-state`                       | корень            | состояние карточки (браузерные проверки)    |
| `data-sn-playing`                     | корень            | включает эквалайзер и блик заливки          |
| `data-sn-dragging`                    | слайдеры          | состояние перетаскивания                    |
| `data-sn-idle`                        | эквалайзер строки | место зарезервировано, но столбики скрыты   |
| `data-sn-track-id`                    | строка очереди    | адрес строки для проверок                   |
| `data-sn-exiting`                     | строка очереди    | строка уходит: анимация выхода (10.2, 10.3) |
| `data-sn-animating`, `data-sn-motion` | контейнер высоты  | фаза замера и «движением владеет кит»       |

## 11. Что чем доказано

| Инвариант                                            | Чем проверяется                                                |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| Модель и переходы без движка                         | `reducer.test.ts`, `derive.test.ts`, `config.test.ts` (core)   |
| Контракт движка и адаптера на фейках                 | `engine.test.ts`, `adapter.test.ts`, `mock.test.ts` (core)     |
| Сценарии плеера без React и реального аудио          | `controller.test.ts` (core, фейковый движок и часы)            |
| Импорт core не трогает DOM                           | `dom/import.test.ts` (core)                                    |
| Стили: токены, слоты, порядок файлов                 | `styles.test.ts` (core)                                        |
| Поведение и доступность обвязки                      | `Player`, `controls`, `queue`, `volume`, `parts` (react)       |
| Роли, имена, состояния и axe по состояниям виджета   | `a11y.test.tsx` (react)                                        |
| Возвраты фокуса и объявлений, найденные ранее        | `regressions.test.tsx` (react)                                 |
| SSR и гидратация без расхождений                     | `ssr.test.tsx` (react), `check:hydration` в браузере           |
| Media Session и пауза на скрытой вкладке             | `mediaSession.test.tsx`, `visibility` (react)                  |
| Геометрия, фокус, reduced motion в реальном браузере | `check:layout`, `check:container` (tools)                      |
| Пакет работает вне монорепы                          | `verify:install` (tools, установка из tarball в React 18 и 19) |
