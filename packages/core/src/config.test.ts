import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEEK_STEP,
  DEFAULT_SKIP_SECONDS,
  DEFAULT_VOLUME_STEP,
  FALLBACK_LAYOUT,
  FALLBACK_LOCALE,
  FALLBACK_THEME,
  isSoundlineLayout,
  isSoundlineTheme,
  resolveMediaSession,
  resolvePlayerConfig,
} from './config';
import { defaultMessages } from './i18n';

describe('resolvePlayerConfig', () => {
  it('fills every field with a deterministic fallback', () => {
    const config = resolvePlayerConfig();

    expect(config.locale).toBe(FALLBACK_LOCALE);
    expect(config.theme).toBe(FALLBACK_THEME);
    expect(config.layout).toBe(FALLBACK_LAYOUT);
    expect(config.messages).toBe(defaultMessages.en);
    expect(config.seekStep).toBe(DEFAULT_SEEK_STEP);
    expect(config.volumeStep).toBe(DEFAULT_VOLUME_STEP);
    expect(config.showQueue).toBe(true);
    expect(config.pauseWhenHidden).toBe(false);
    expect(config.mediaSession).toEqual({ enabled: false, skipSeconds: DEFAULT_SKIP_SECONDS });
    expect(config.context).toEqual({ key: 'default' });
  });

  it('resolves copy from the locale', () => {
    const config = resolvePlayerConfig({ locale: 'ru-RU' });
    expect(config.messages.playLabel).toBe(defaultMessages.ru.playLabel);
  });

  it('lets an explicit message override the dictionary', () => {
    const config = resolvePlayerConfig({ locale: 'en', messages: { playLabel: 'Start' } });
    expect(config.messages.playLabel).toBe('Start');
    expect(config.messages.pauseLabel).toBe(defaultMessages.en.pauseLabel);
  });

  it('ignores an unknown theme or layout', () => {
    const config = resolvePlayerConfig({
      theme: 'neon' as never,
      layout: 'tall' as never,
    });
    expect(config.theme).toBe(FALLBACK_THEME);
    expect(config.layout).toBe(FALLBACK_LAYOUT);
  });

  it('accepts a known theme and layout', () => {
    const config = resolvePlayerConfig({ theme: 'light', layout: 'compact' });
    expect(config.theme).toBe('light');
    expect(config.layout).toBe('compact');
  });

  it('keeps a positive step and rejects everything else', () => {
    expect(resolvePlayerConfig({ seekStep: 10 }).seekStep).toBe(10);
    expect(resolvePlayerConfig({ seekStep: 0 }).seekStep).toBe(DEFAULT_SEEK_STEP);
    expect(resolvePlayerConfig({ seekStep: -1 }).seekStep).toBe(DEFAULT_SEEK_STEP);
    expect(resolvePlayerConfig({ seekStep: Number.NaN }).seekStep).toBe(DEFAULT_SEEK_STEP);
    expect(resolvePlayerConfig({ volumeStep: 0.2 }).volumeStep).toBe(0.2);
  });

  it('honours explicit booleans', () => {
    const config = resolvePlayerConfig({ showQueue: false, pauseWhenHidden: true });
    expect(config.showQueue).toBe(false);
    expect(config.pauseWhenHidden).toBe(true);
  });

  it('carries the playlist context through', () => {
    const config = resolvePlayerConfig({ context: { key: 'album-7', data: { token: 'x' } } });
    expect(config.context).toEqual({ key: 'album-7', data: { token: 'x' } });
  });

  it('is deterministic: the same input resolves the same way twice', () => {
    const input = { locale: 'ru', seekStep: 7 } as const;
    expect(resolvePlayerConfig(input)).toEqual(resolvePlayerConfig(input));
  });
});

describe('resolveMediaSession', () => {
  it('is off by default', () => {
    expect(resolveMediaSession(undefined)).toEqual({
      enabled: false,
      skipSeconds: DEFAULT_SKIP_SECONDS,
    });
    expect(resolveMediaSession(false)).toEqual({
      enabled: false,
      skipSeconds: DEFAULT_SKIP_SECONDS,
    });
  });

  it('turns on with the default step for `true`', () => {
    expect(resolveMediaSession(true)).toEqual({
      enabled: true,
      skipSeconds: DEFAULT_SKIP_SECONDS,
    });
  });

  it('turns on and overrides the step for an object', () => {
    expect(resolveMediaSession({ skipSeconds: 30 })).toEqual({ enabled: true, skipSeconds: 30 });
    expect(resolveMediaSession({})).toEqual({ enabled: true, skipSeconds: DEFAULT_SKIP_SECONDS });
    expect(resolveMediaSession({ skipSeconds: -5 })).toEqual({
      enabled: true,
      skipSeconds: DEFAULT_SKIP_SECONDS,
    });
  });
});

describe('theme and layout guards', () => {
  it('narrows only shipped values', () => {
    expect(isSoundlineTheme('dark')).toBe(true);
    expect(isSoundlineTheme('light')).toBe(true);
    expect(isSoundlineTheme('neon')).toBe(false);
    expect(isSoundlineTheme(undefined)).toBe(false);

    expect(isSoundlineLayout('card')).toBe(true);
    expect(isSoundlineLayout('compact')).toBe(true);
    expect(isSoundlineLayout('tall')).toBe(false);
  });
});
