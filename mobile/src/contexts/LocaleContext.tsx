import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import i18n, { isSupportedLocale, resolveLocale, type Locale } from '@/i18n';

const LOCALE_STORAGE_KEY = 'preferred_locale';

interface LocaleContextValue {
  locale: Locale;
  isHydrating: boolean;
  setLocale: (next: Locale) => Promise<void>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Singleton mirror of the active locale so non-React code (e.g. the api layer)
 * can read it for the Accept-Language header without a provider.
 */
let currentLocale: Locale = 'en';

export function getCurrentLocale(): Locale {
  return currentLocale;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [isHydrating, setIsHydrating] = useState(true);

  // Load persisted locale on mount, falling back to device locale.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
        const initial = isSupportedLocale(stored)
          ? stored
          : resolveLocale(Localization.getLocales()[0]?.languageTag);
        if (cancelled) return;
        currentLocale = initial;
        await i18n.changeLanguage(initial);
        setLocaleState(initial);
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    currentLocale = next;
    await i18n.changeLanguage(next);
    setLocaleState(next);
    try {
      await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, next);
    } catch {
      // Persistence is best-effort; the in-memory locale is already updated.
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, isHydrating, setLocale }),
    [locale, isHydrating, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return ctx;
}
