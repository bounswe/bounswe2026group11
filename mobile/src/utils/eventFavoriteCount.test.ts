import { EventSummary } from '@/models/event';
import { getFavoriteCountForDisplay } from './eventFavoriteCount';

function baseEvent(
  overrides: Partial<EventSummary> & Pick<EventSummary, 'is_favorited'>,
): EventSummary {
  return {
    id: 'e1',
    title: 'T',
    category_name: 'C',
    start_time: new Date().toISOString(),
    privacy_level: 'PUBLIC',
    approved_participant_count: 0,
    host_score: { final_score: null, hosted_event_rating_count: 0 },
    ...overrides,
  };
}

describe('getFavoriteCountForDisplay', () => {
  it('uses API favorite_count when present', () => {
    expect(
      getFavoriteCountForDisplay(
        baseEvent({ is_favorited: false, favorite_count: 7 }),
      ),
    ).toBe(7);
  });

  it('shows 0 when not favorited and no count', () => {
    expect(
      getFavoriteCountForDisplay(baseEvent({ is_favorited: false })),
    ).toBe(0);
  });

  it('shows at least 1 when favorited but count missing or zero (legacy discovery)', () => {
    expect(
      getFavoriteCountForDisplay(baseEvent({ is_favorited: true })),
    ).toBe(1);
    expect(
      getFavoriteCountForDisplay(
        baseEvent({ is_favorited: true, favorite_count: 0 }),
      ),
    ).toBe(1);
  });

  it('uses non-zero count when favorited', () => {
    expect(
      getFavoriteCountForDisplay(
        baseEvent({ is_favorited: true, favorite_count: 4 }),
      ),
    ).toBe(4);
  });
});
