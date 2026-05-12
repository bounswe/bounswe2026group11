import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import tr from './locales/tr.json';

export const SUPPORTED_LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALE_STORAGE_KEY = 'sem_locale';

let currentLocale: Locale = 'en';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  const candidate = window.localStorage;
  if (
    candidate
    && typeof candidate.getItem === 'function'
    && typeof candidate.setItem === 'function'
  ) {
    return candidate;
  }
  return null;
}

export function isSupportedLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'tr';
}

export function resolveLocale(deviceTag: string | null | undefined): Locale {
  if (!deviceTag) return 'en';
  const lower = deviceTag.toLowerCase();
  if (lower.startsWith('tr')) return 'tr';
  return 'en';
}

export function detectInitialLocale(): Locale {
  const storage = getStorage();
  if (storage) {
    const storedLocale = storage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(storedLocale)) {
      return storedLocale;
    }
  }

  if (typeof navigator !== 'undefined') {
    return resolveLocale(navigator.language);
  }

  return 'en';
}

export function getCurrentLocale(): Locale {
  return currentLocale;
}

export async function setCurrentLocale(locale: Locale): Promise<void> {
  currentLocale = locale;
  getStorage()?.setItem(LOCALE_STORAGE_KEY, locale);
  await i18n.changeLanguage(locale);
}

currentLocale = detectInitialLocale();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tr: { translation: tr },
  },
  lng: currentLocale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
});

export default i18n;
