import { describe, expect, it } from 'vitest';
import { isSupportedLocale, resolveLocale } from './index';

describe('isSupportedLocale', () => {
  it('accepts en and tr', () => {
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('tr')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isSupportedLocale('fr')).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
  });
});

describe('resolveLocale', () => {
  it('maps tr-TR to tr', () => {
    expect(resolveLocale('tr-TR')).toBe('tr');
  });

  it('maps en-US to en', () => {
    expect(resolveLocale('en-US')).toBe('en');
  });

  it('falls back to en for unsupported tags', () => {
    expect(resolveLocale('fr-FR')).toBe('en');
    expect(resolveLocale('')).toBe('en');
    expect(resolveLocale(null)).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });
});
