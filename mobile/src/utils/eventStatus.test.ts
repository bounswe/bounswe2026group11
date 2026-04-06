import {
  formatEventStatusLabel,
  getEventStatusBadgeColors,
  shouldShowProfileEvent,
} from './eventStatus';

describe('eventStatus', () => {
  it('formats known and unknown backend statuses for display', () => {
    expect(formatEventStatusLabel('IN_PROGRESS')).toBe('In Progress');
    expect(formatEventStatusLabel('CANCELED')).toBe('Canceled');
    expect(formatEventStatusLabel('WAITING_REVIEW')).toBe('Waiting Review');
    expect(formatEventStatusLabel('')).toBe('Unknown');
  });

  it('returns distinct colors for supported statuses with a safe fallback', () => {
    expect(getEventStatusBadgeColors('IN_PROGRESS')).toEqual({
      backgroundColor: '#DBEAFE',
      textColor: '#1D4ED8',
    });
    expect(getEventStatusBadgeColors('COMPLETED')).toEqual({
      backgroundColor: '#E2E8F0',
      textColor: '#334155',
    });
    expect(getEventStatusBadgeColors('CANCELED')).toEqual({
      backgroundColor: '#FEE2E2',
      textColor: '#B91C1C',
    });
    expect(getEventStatusBadgeColors('WAITING_REVIEW')).toEqual({
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      textColor: '#111827',
    });
  });

  it('hides only ACTIVE events from profile lists', () => {
    expect(shouldShowProfileEvent('ACTIVE')).toBe(false);
    expect(shouldShowProfileEvent('IN_PROGRESS')).toBe(true);
    expect(shouldShowProfileEvent('WAITING_REVIEW')).toBe(true);
  });
});
