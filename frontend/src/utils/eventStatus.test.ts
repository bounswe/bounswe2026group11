import { describe, expect, it } from 'vitest';
import { getEventLifecyclePresentation, getEventStatusPresentation } from './eventStatus';

describe('getEventLifecyclePresentation', () => {
  it('maps ACTIVE to UPCOMING', () => {
    expect(getEventLifecyclePresentation('ACTIVE')).toEqual({
      label: 'UPCOMING',
      variant: 'upcoming',
    });
  });

  it('maps IN_PROGRESS', () => {
    expect(getEventLifecyclePresentation('IN_PROGRESS')).toEqual({
      label: 'IN PROGRESS',
      variant: 'in_progress',
    });
  });

  it('returns null for other statuses', () => {
    expect(getEventLifecyclePresentation('COMPLETED')).toBeNull();
  });
});

describe('getEventStatusPresentation', () => {
  it('formats IN_PROGRESS into a user-facing label', () => {
    expect(getEventStatusPresentation('IN_PROGRESS')).toEqual({
      label: 'In Progress',
      tone: 'active',
    });
  });

  it('formats unknown uppercase enum-like values into title case', () => {
    expect(getEventStatusPresentation('WAITING_REVIEW')).toEqual({
      label: 'Waiting Review',
      tone: 'completed',
    });
  });
});
