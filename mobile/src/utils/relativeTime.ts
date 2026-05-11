import type { TFunction } from 'i18next';

export function formatRelativeTime(value: string, t: TFunction, locale: string): string {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const diff = Math.max(0, Date.now() - date.getTime());
    const minuteMs = 60 * 1000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;

    if (diff < minuteMs) return t('common.relativeTime.justNow');

    const minutes = Math.floor(diff / minuteMs);
    if (minutes < 60) return t('common.relativeTime.minute', { count: minutes });

    const hours = Math.floor(diff / hourMs);
    if (hours < 24) return t('common.relativeTime.hour', { count: hours });

    const days = Math.floor(diff / dayMs);
    if (days < 30) return t('common.relativeTime.day', { count: days });

    return date.toLocaleDateString(locale || 'en', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
