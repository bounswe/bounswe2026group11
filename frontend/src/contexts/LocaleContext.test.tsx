import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';

import {
  LOCALE_STORAGE_KEY,
  getCurrentLocale,
  setCurrentLocale,
} from '@/i18n';

import { LocaleProvider, useLocale } from './LocaleContext';

describe('LocaleContext', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await setCurrentLocale('en');
  });

  it('defaults to english when nothing is stored', () => {
    const { result } = renderHook(() => useLocale(), {
      wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
    });

    expect(result.current.locale).toBe('en');
  });

  it('hydrates locale from localStorage', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'tr');

    const { result } = renderHook(() => useLocale(), {
      wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
    });

    await waitFor(() => {
      expect(result.current.locale).toBe('tr');
    });
  });

  it('persists locale changes to localStorage and i18n state', async () => {
    const { result } = renderHook(() => useLocale(), {
      wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
    });

    await act(async () => {
      await result.current.setLocale('tr');
    });

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('tr');
    expect(getCurrentLocale()).toBe('tr');
  });
});
