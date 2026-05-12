import { useTranslation } from 'react-i18next';

interface RatingWithCountProps {
  score: number | null | undefined;
  count?: number | null;
  className?: string;
  suffix?: string;
}

function normalizeCount(count: number | null | undefined): number | null {
  return typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : null;
}

export function formatRatingWithCountText({
  score,
  count,
  suffix,
}: RatingWithCountProps): string {
  const normalizedCount = normalizeCount(count);

  if (score == null || !Number.isFinite(score)) {
    return '';
  }

  const countText = normalizedCount == null ? '' : ` (${normalizedCount})`;
  const suffixText = suffix ? ` ${suffix}` : '';
  return `★ ${score.toFixed(1)}${countText}${suffixText}`;
}

export function RatingWithCount(props: RatingWithCountProps) {
  const { t } = useTranslation();
  const text = formatRatingWithCountText(props);
  if (!text) return null;

  const ariaDetail = text.replace(/★\s*/u, '').trim();

  return (
    <span
      className={`rating-with-count ${props.className ?? ''}`.trim()}
      aria-label={t('rating.aria_label', { detail: ariaDetail })}
    >
      {text}
    </span>
  );
}
