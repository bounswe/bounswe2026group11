import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  detectInitialLocale,
  getCurrentLocale,
  setCurrentLocale,
  type Locale,
} from '@/i18n';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getCurrentLocale());

  useEffect(() => {
    const initialLocale = detectInitialLocale();
    if (initialLocale !== locale) {
      setLocaleState(initialLocale);
      void setCurrentLocale(initialLocale);
    }
  }, [locale]);

  const handleSetLocale = useCallback(async (nextLocale: Locale) => {
    await setCurrentLocale(nextLocale);
    setLocaleState(nextLocale);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale === 'tr' ? 'tr' : 'en';
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale: handleSetLocale,
    }),
    [handleSetLocale, locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used within LocaleProvider');
  return value;
}
