import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import tr from './locales/tr.json';

export const SUPPORTED_LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'tr';
}

/**
 * Picks the best supported locale for a device language tag, falling back to
 * English. e.g. "tr-TR" -> "tr", "en-US" -> "en", "fr-FR" -> "en".
 */
export function resolveLocale(deviceTag: string | null | undefined): Locale {
  if (!deviceTag) return 'en';
  const lower = deviceTag.toLowerCase();
  if (lower.startsWith('tr')) return 'tr';
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tr: { translation: tr },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
  // We keep our own mutable locale via LocaleContext; i18next is just the engine.
  react: { useSuspense: false },
});

export default i18n;
