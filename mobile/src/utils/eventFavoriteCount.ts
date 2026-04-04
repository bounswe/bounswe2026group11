import { EventSummary } from '@/models/event';

export function getFavoriteCountForDisplay(event: EventSummary): number {
  const n = event.favorite_count ?? 0;
  if (event.is_favorited && n === 0) {
    return 1;
  }
  return n;
}
