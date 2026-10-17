/**
 * Built-in copy.
 *
 * Two locales ship in the box (`en`, `ru`); any other language tag still works —
 * the copy falls back to English, or to whatever the application passes through
 * `messages`.
 *
 * `format()` is the single substitution mechanism: dictionaries hold plain text
 * with `{placeholder}` markers and no markup, and the binding renders the result
 * as text, so a dictionary can never inject HTML. Locale *detection* is not here
 * on purpose: it reads the browser and therefore belongs to a binding, which
 * applies it after mounting.
 */
import type { SoundlineLocale, SoundlineMessages } from './types';

const en: SoundlineMessages = {
  playerLabel: 'Audio player',
  playLabel: 'Play',
  pauseLabel: 'Pause',
  previousLabel: 'Previous track',
  nextLabel: 'Next track',
  seekLabel: 'Playback position',
  seekValue: '{position} of {duration}',
  volumeLabel: 'Volume',
  volumeValue: '{percent}%',
  muteLabel: 'Mute',
  unmuteLabel: 'Unmute',
  shuffleLabel: 'Shuffle',
  repeatOffLabel: 'Repeat off',
  repeatAllLabel: 'Repeat playlist',
  repeatOneLabel: 'Repeat track',
  rateLabel: 'Playback speed',
  rateValue: '{rate}×',
  queueLabel: 'Playlist',
  queueCount: '{count} tracks',
  trackLabel: '{index}. {title}',
  removeTrackLabel: 'Remove {title}',
  currentTrackLabel: 'Now playing: {title}',
  pausedTrackLabel: 'Paused: {title}',
  loadingLabel: 'Loading tracks…',
  emptyLabel: 'There are no tracks in this playlist',
  errorLabel: 'Playback error',
  genericError: 'The track could not be loaded. Please try again.',
  retryLabel: 'Try again',
  endedLabel: 'End of playlist',
  unsupportedLabel: 'This audio format is not supported by the browser',
};

const ru: SoundlineMessages = {
  playerLabel: 'Аудиоплеер',
  playLabel: 'Воспроизвести',
  pauseLabel: 'Пауза',
  previousLabel: 'Предыдущий трек',
  nextLabel: 'Следующий трек',
  seekLabel: 'Позиция воспроизведения',
  seekValue: '{position} из {duration}',
  volumeLabel: 'Громкость',
  volumeValue: '{percent}%',
  muteLabel: 'Выключить звук',
  unmuteLabel: 'Включить звук',
  shuffleLabel: 'Перемешать',
  repeatOffLabel: 'Повтор выключен',
  repeatAllLabel: 'Повтор плейлиста',
  repeatOneLabel: 'Повтор трека',
  rateLabel: 'Скорость воспроизведения',
  rateValue: '{rate}×',
  queueLabel: 'Плейлист',
  queueCount: 'Треков: {count}',
  trackLabel: '{index}. {title}',
  removeTrackLabel: 'Удалить {title}',
  currentTrackLabel: 'Сейчас играет: {title}',
  pausedTrackLabel: 'Пауза: {title}',
  loadingLabel: 'Загружаем треки…',
  emptyLabel: 'В этом плейлисте нет треков',
  errorLabel: 'Ошибка воспроизведения',
  genericError: 'Не удалось загрузить трек. Попробуйте ещё раз.',
  retryLabel: 'Повторить',
  endedLabel: 'Плейлист закончился',
  unsupportedLabel: 'Браузер не поддерживает этот формат',
};

const locales: Record<SoundlineLocale, SoundlineMessages> = { en, ru };

/** The dictionaries as shipped, keyed by built-in locale. */
export const defaultMessages: Record<SoundlineLocale, SoundlineMessages> = locales;

/** Locale tag for the copy layer: `ru*` → Russian, everything else → English. */
export function resolveMessageLocale(locale: string | undefined): SoundlineLocale {
  return locale && locale.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

/**
 * Merges locale defaults with consumer overrides.
 * An `undefined` value in `overrides` never wins over a default.
 */
export function resolveMessages(
  locale: string | undefined,
  overrides?: Partial<SoundlineMessages>,
): SoundlineMessages {
  const base = locales[resolveMessageLocale(locale)];
  if (!overrides) return base;

  const merged: SoundlineMessages = { ...base };
  for (const key of Object.keys(overrides) as (keyof SoundlineMessages)[]) {
    const value = overrides[key];
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

/**
 * `format('{position} of {duration}', { position, duration })`.
 *
 * Unknown placeholders are left as they are, so a missing value shows up in
 * development instead of silently rendering `undefined`.
 */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
