import { useTranslation } from 'react-i18next';
import { useLocale } from '@/contexts/LocaleContext';
import type { Locale } from '@/i18n';
import '@/styles/language-switcher.css';

interface LanguageSwitcherProps {
  className?: string;
}

const OPTIONS: Array<{ value: Locale; labelKey: string; shortLabel: string }> = [
  { value: 'en', labelKey: 'profile.language_en', shortLabel: 'EN' },
  { value: 'tr', labelKey: 'profile.language_tr', shortLabel: 'TR' },
];

export default function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={`language-switcher ${className}`.trim()}
      role="group"
      aria-label={t('profile.language_label')}
    >
      {OPTIONS.map((option) => {
        const active = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`language-switcher-btn ${active ? 'active' : ''}`}
            onClick={() => void setLocale(option.value)}
            aria-pressed={active}
            title={t(option.labelKey)}
          >
            <span aria-hidden>{option.shortLabel}</span>
            <span className="language-switcher-sr">{t(option.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
