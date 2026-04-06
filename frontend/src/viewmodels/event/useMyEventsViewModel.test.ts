// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMyEventsViewModel } from './useMyEventsViewModel';

vi.mock('@/services/profileService', () => ({
  profileService: {
    getHostedEvents: vi.fn().mockResolvedValue([]),
    getUpcomingEvents: vi.fn().mockResolvedValue([]),
    getCompletedEvents: vi.fn().mockResolvedValue([]),
    getCanceledEvents: vi.fn().mockResolvedValue([]),
  },
}));

import { profileService } from '@/services/profileService';

const mockService = profileService as unknown as {
  getHostedEvents: ReturnType<typeof vi.fn>;
  getUpcomingEvents: ReturnType<typeof vi.fn>;
  getCompletedEvents: ReturnType<typeof vi.fn>;
  getCanceledEvents: ReturnType<typeof vi.fn>;
};

function makeEvent(id: string, status: string) {
  return { id, title: `Event ${id}`, start_time: '2026-04-05T10:00:00Z', status };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockService.getHostedEvents.mockResolvedValue([]);
  mockService.getCompletedEvents.mockResolvedValue([]);
  mockService.getCanceledEvents.mockResolvedValue([]);
});

describe('useMyEventsViewModel', () => {
  it('splits upcoming response into upcoming (ACTIVE) and active (IN_PROGRESS)', async () => {
    mockService.getUpcomingEvents.mockResolvedValue([
      makeEvent('1', 'ACTIVE'),
      makeEvent('2', 'IN_PROGRESS'),
      makeEvent('3', 'ACTIVE'),
    ]);

    const { result } = renderHook(() => useMyEventsViewModel('token'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.upcoming).toHaveLength(2);
    expect(result.current.upcoming.every((e) => e.status === 'ACTIVE')).toBe(true);

    expect(result.current.active).toHaveLength(1);
    expect(result.current.active[0].id).toBe('2');
  });

  it('returns empty active list when no IN_PROGRESS events', async () => {
    mockService.getUpcomingEvents.mockResolvedValue([
      makeEvent('1', 'ACTIVE'),
    ]);

    const { result } = renderHook(() => useMyEventsViewModel('token'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.active).toHaveLength(0);
    expect(result.current.upcoming).toHaveLength(1);
  });

  it('defaults to active tab', async () => {
    mockService.getUpcomingEvents.mockResolvedValue([]);

    const { result } = renderHook(() => useMyEventsViewModel('token'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeTab).toBe('active');
  });
});
