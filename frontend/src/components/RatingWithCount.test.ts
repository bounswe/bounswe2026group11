import { describe, expect, it } from 'vitest';
import { formatRatingWithCountText } from './RatingWithCount';

describe('formatRatingWithCountText', () => {
  it('shows the score with a defensive rating count when available', () => {
    expect(formatRatingWithCountText({ score: 4.73, count: 12 })).toBe('★ 4.7 (12)');
  });

  it('keeps the score visible when the backend has not rolled out count yet', () => {
    expect(formatRatingWithCountText({ score: 4.73 })).toBe('★ 4.7');
  });

  it('renders nothing for unrated items', () => {
    expect(formatRatingWithCountText({ score: null, count: 0 })).toBe('');
  });
});
