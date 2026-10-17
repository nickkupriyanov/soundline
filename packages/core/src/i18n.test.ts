import { describe, expect, it } from 'vitest';
import { defaultMessages, format, resolveMessageLocale, resolveMessages } from './i18n';
import type { SoundlineMessages } from './types';

describe('defaultMessages', () => {
  it('ships an English and a Russian dictionary', () => {
    expect(Object.keys(defaultMessages).sort()).toEqual(['en', 'ru']);
  });

  it('keeps both locales complete and in sync', () => {
    const enKeys = Object.keys(defaultMessages.en).sort();
    const ruKeys = Object.keys(defaultMessages.ru).sort();

    expect(ruKeys).toEqual(enKeys);
  });

  it('has no empty string in either locale', () => {
    for (const [locale, messages] of Object.entries(defaultMessages)) {
      for (const [key, value] of Object.entries(messages)) {
        expect(value, `${locale}.${key}`).toBeTypeOf('string');
        expect(value.length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('resolveMessageLocale', () => {
  it('maps ru variants to Russian', () => {
    expect(resolveMessageLocale('ru')).toBe('ru');
    expect(resolveMessageLocale('ru-RU')).toBe('ru');
    expect(resolveMessageLocale('RU')).toBe('ru');
  });

  it('falls back to English for anything else', () => {
    expect(resolveMessageLocale('en-US')).toBe('en');
    expect(resolveMessageLocale('de')).toBe('en');
    expect(resolveMessageLocale(undefined)).toBe('en');
    expect(resolveMessageLocale('')).toBe('en');
  });
});

describe('resolveMessages', () => {
  it('returns the shipped dictionary untouched without overrides', () => {
    expect(resolveMessages('ru')).toBe(defaultMessages.ru);
    expect(resolveMessages(undefined)).toBe(defaultMessages.en);
  });

  it('lets an override win over the default', () => {
    const messages = resolveMessages('en', { playLabel: 'Start' });
    expect(messages.playLabel).toBe('Start');
    expect(messages.pauseLabel).toBe(defaultMessages.en.pauseLabel);
  });

  it('ignores an undefined override', () => {
    const messages = resolveMessages('en', { playLabel: undefined });
    expect(messages.playLabel).toBe(defaultMessages.en.playLabel);
  });

  it('never mutates the shipped dictionary', () => {
    resolveMessages('en', { playLabel: 'Start' });
    expect(defaultMessages.en.playLabel).toBe('Play');
  });

  it('accepts a full dictionary type as overrides', () => {
    const overrides: Partial<SoundlineMessages> = { retryLabel: 'Again' };
    expect(resolveMessages('ru', overrides).retryLabel).toBe('Again');
  });
});

describe('format', () => {
  it('substitutes every placeholder', () => {
    expect(format('{position} of {duration}', { position: '1:23', duration: '4:05' })).toBe(
      '1:23 of 4:05',
    );
  });

  it('stringifies numbers', () => {
    expect(format('{count} tracks', { count: 3 })).toBe('3 tracks');
  });

  it('leaves an unknown placeholder in place', () => {
    expect(format('{position} of {duration}', { position: '1:23' })).toBe('1:23 of {duration}');
  });

  it('formats the built-in seek value', () => {
    expect(format(defaultMessages.ru.seekValue, { position: '1:23', duration: '4:05' })).toBe(
      '1:23 из 4:05',
    );
  });
});
