import i18n from '@/i18n';
import type { BadgeCategory, BadgeItem } from '@/models/profile';

function badgeKey(slug: string): string {
  return slug.trim().toUpperCase();
}

function translateOrFallback(key: string, fallback: string): string {
  const translated = i18n.t(key);
  return translated === key ? fallback : translated;
}

export function getBadgeName(badge: Pick<BadgeItem, 'slug' | 'name'>): string {
  return translateOrFallback(
    `publicProfile.badges.catalog.${badgeKey(badge.slug)}.name`,
    badge.name,
  );
}

export function getBadgeDescription(
  badge: Pick<BadgeItem, 'slug' | 'description'>,
): string {
  return translateOrFallback(
    `publicProfile.badges.catalog.${badgeKey(badge.slug)}.description`,
    badge.description,
  );
}

export function getBadgeProgressHint(
  badge: Pick<BadgeItem, 'slug' | 'progress_hint'>,
): string | null {
  if (!badge.progress_hint) return null;
  return translateOrFallback(
    `publicProfile.badges.catalog.${badgeKey(badge.slug)}.progressHint`,
    badge.progress_hint,
  );
}

export function getBadgeCategoryLabel(category?: BadgeCategory | string | null): string {
  if (!category) return i18n.t('publicProfile.badges.achievement');

  const key = `publicProfile.badges.categories.${String(category).toUpperCase()}`;
  return translateOrFallback(key, String(category));
}
