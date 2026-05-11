import i18n from '@/i18n';

export interface EventCategoryPresentation {
  label: string;
  emoji: string;
  color: string;
  tintColor: string;
  textColor: string;
}

interface EventCategoryPresentationConfig {
  emoji: string;
  lightColor: string;
  darkColor: string;
}

const CATEGORY_PRESENTATION_BY_NAME: Record<string, EventCategoryPresentationConfig> = {
  sports: { emoji: '🏃', lightColor: '#2563EB', darkColor: '#60A5FA' },
  music: { emoji: '🎵', lightColor: '#DB2777', darkColor: '#F472B6' },
  education: { emoji: '🎓', lightColor: '#7C3AED', darkColor: '#A78BFA' },
  technology: { emoji: '💻', lightColor: '#0891B2', darkColor: '#22D3EE' },
  art: { emoji: '🎨', lightColor: '#EA580C', darkColor: '#FB923C' },
  fooddrink: { emoji: '🍽️', lightColor: '#C2410C', darkColor: '#FDBA74' },
  outdoors: { emoji: '🌲', lightColor: '#059669', darkColor: '#34D399' },
  fitness: { emoji: '💪', lightColor: '#DC2626', darkColor: '#F87171' },
  networking: { emoji: '🤝', lightColor: '#4F46E5', darkColor: '#818CF8' },
  gaming: { emoji: '🎮', lightColor: '#9333EA', darkColor: '#C084FC' },
  charity: { emoji: '💛', lightColor: '#B45309', darkColor: '#FBBF24' },
  photography: { emoji: '📷', lightColor: '#0284C7', darkColor: '#38BDF8' },
  travel: { emoji: '✈️', lightColor: '#0D9488', darkColor: '#2DD4BF' },
  workshops: { emoji: '🛠️', lightColor: '#475569', darkColor: '#CBD5E1' },
  conferences: { emoji: '🎤', lightColor: '#4338CA', darkColor: '#A5B4FC' },
  moviescinema: { emoji: '🎬', lightColor: '#B91C1C', darkColor: '#FCA5A5' },
  theatre: { emoji: '🎭', lightColor: '#C026D3', darkColor: '#E879F9' },
  booksliterature: { emoji: '📚', lightColor: '#D97706', darkColor: '#FCD34D' },
  wellness: { emoji: '🧘', lightColor: '#65A30D', darkColor: '#A3E635' },
  volunteering: { emoji: '🙌', lightColor: '#BE123C', darkColor: '#FB7185' },
  social: { emoji: '🤗', lightColor: '#0D9488', darkColor: '#5EEAD4' },
  culture: { emoji: '🏛️', lightColor: '#7C2D12', darkColor: '#FDBA74' },
  entertainment: { emoji: '🎉', lightColor: '#C026D3', darkColor: '#E879F9' },
};

const FALLBACK_CATEGORY_PRESENTATIONS: EventCategoryPresentationConfig[] = [
  { emoji: '📍', lightColor: '#2563EB', darkColor: '#60A5FA' },
  { emoji: '✨', lightColor: '#7C3AED', darkColor: '#A78BFA' },
  { emoji: '📌', lightColor: '#0D9488', darkColor: '#2DD4BF' },
  { emoji: '🎟️', lightColor: '#B45309', darkColor: '#FBBF24' },
];

function normalizeCategoryName(name: string): string {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const aliases: Record<string, string> = {
    doga: 'outdoors',
  };
  return aliases[normalized] ?? normalized;
}

function hashString(value: string): number {
  return value.split('').reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 0);
}

function getReadableTextColor(backgroundColor: string): string {
  const normalized = backgroundColor.replace('#', '');
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? '#0F172A' : '#FFFFFF';
}

export function getEventCategoryPresentation(
  categoryName: string,
  isDark: boolean,
): EventCategoryPresentation {
  const rawLabel = categoryName.trim() || 'Event';
  // Look up the translated category name; if not in catalog, fall back to the raw label.
  const translationKey = `events.categories.${rawLabel}`;
  const translated = i18n.t(translationKey);
  const label = translated === translationKey ? rawLabel : translated;
  const normalizedName = normalizeCategoryName(rawLabel);
  const config =
    CATEGORY_PRESENTATION_BY_NAME[normalizedName] ??
    FALLBACK_CATEGORY_PRESENTATIONS[
      hashString(normalizedName) % FALLBACK_CATEGORY_PRESENTATIONS.length
    ];
  const color = isDark ? config.darkColor : config.lightColor;

  return {
    label,
    emoji: config.emoji,
    color,
    tintColor: `${color}${isDark ? '30' : '18'}`,
    textColor: getReadableTextColor(color),
  };
}
