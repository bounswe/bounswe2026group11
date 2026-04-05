import { getAutoCompletionDaysLeft } from './eventDate';

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe('getAutoCompletionDaysLeft', () => {
  it('returns null for ACTIVE events', () => {
    expect(getAutoCompletionDaysLeft('ACTIVE', daysAgo(55))).toBeNull();
  });

  it('returns null for COMPLETED events', () => {
    expect(getAutoCompletionDaysLeft('COMPLETED', daysAgo(55))).toBeNull();
  });

  it('returns null for CANCELED events', () => {
    expect(getAutoCompletionDaysLeft('CANCELED', daysAgo(55))).toBeNull();
  });

  it('returns null for IN_PROGRESS events that have an end_time', () => {
    const endTime = new Date(Date.now() + 86400000).toISOString();
    expect(getAutoCompletionDaysLeft('IN_PROGRESS', daysAgo(55), endTime)).toBeNull();
  });

  it('returns null when event started less than 53 days ago', () => {
    expect(getAutoCompletionDaysLeft('IN_PROGRESS', daysAgo(52))).toBeNull();
  });

  it('returns null when event started 60 or more days ago', () => {
    expect(getAutoCompletionDaysLeft('IN_PROGRESS', daysAgo(60))).toBeNull();
    expect(getAutoCompletionDaysLeft('IN_PROGRESS', daysAgo(65))).toBeNull();
  });

  it('returns 7 when event started exactly 53 days ago', () => {
    expect(getAutoCompletionDaysLeft('IN_PROGRESS', daysAgo(53))).toBe(7);
  });

  it('returns 1 when event started exactly 59 days ago', () => {
    expect(getAutoCompletionDaysLeft('IN_PROGRESS', daysAgo(59))).toBe(1);
  });

  it('returns correct days left for day 55', () => {
    expect(getAutoCompletionDaysLeft('IN_PROGRESS', daysAgo(55))).toBe(5);
  });

  it('treats null end_time the same as undefined', () => {
    expect(getAutoCompletionDaysLeft('IN_PROGRESS', daysAgo(55), null)).toBe(5);
  });

  it('accepts a custom now parameter', () => {
    const startTime = '2026-01-01T00:00:00Z';
    const now = new Date('2026-02-24T00:00:00Z'); // 54 days later
    expect(getAutoCompletionDaysLeft('IN_PROGRESS', startTime, null, now)).toBe(6);
  });
});
