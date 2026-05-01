/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import * as eventService from '@/services/eventService';
import type { MyEventsResponse, MyEventSummary } from '@/models/event';
import { useMyEventsViewModel } from './useMyEventsViewModel';
import { useAuth } from '@/contexts/AuthContext';

jest.mock('@/services/eventService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockListMyEvents = jest.mocked(eventService.listMyEvents);
const mockUseAuth = jest.mocked(useAuth);

function makeEvent(
  id: string,
  status: MyEventSummary['status'],
  relation: MyEventSummary['relation'],
  startTime: string,
): MyEventSummary {
  return {
    id,
    title: `Event ${id}`,
    image_url: null,
    start_time: startTime,
    end_time: null,
    location_address: 'Kadikoy, Istanbul, Turkey',
    approved_participant_count: 12,
    status,
    relation,
    privacy_level: 'PUBLIC',
    badges: relation === 'HOSTING' ? [{ type: 'HOST', label: 'Host' }] : [],
  };
}

const myEventsResponse: MyEventsResponse = {
  hosted_events: [
    makeEvent('host-active', 'ACTIVE', 'HOSTING', '2026-04-08T08:00:00+03:00'),
    makeEvent(
      'host-completed',
      'COMPLETED',
      'HOSTING',
      '2026-03-24T19:00:00+03:00',
    ),
  ],
  attended_events: [
    makeEvent(
      'attend-active',
      'ACTIVE',
      'ATTENDING',
      '2026-04-09T20:00:00+03:00',
    ),
    makeEvent(
      'attend-canceled',
      'CANCELED',
      'ATTENDING',
      '2026-04-12T21:00:00+03:00',
    ),
  ],
};

describe('useMyEventsViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: 'mock-token',
      refreshToken: 'mock-refresh-token',
      user: null,
      setSession: jest.fn(),
      clearAuth: jest.fn(),
    });
    mockListMyEvents.mockResolvedValue(myEventsResponse);
  });

  it('loads my events on mount and defaults to active events', async () => {
    const { result } = renderHook(() => useMyEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListMyEvents).toHaveBeenCalledWith('mock-token');
    expect(result.current.visibleEvents.map((event) => event.id)).toEqual([
      'host-active',
      'attend-active',
    ]);
    expect(result.current.hostedCount).toBe(2);
    expect(result.current.attendedCount).toBe(2);
    expect(result.current.statusTabs).toEqual([
      { value: 'ACTIVE', label: 'Active', count: 2 },
      { value: 'IN_PROGRESS', label: 'In Progress', count: 0 },
      { value: 'COMPLETED', label: 'Completed', count: 1 },
      { value: 'CANCELED', label: 'Canceled', count: 1 },
    ]);
  });

  it('filters events when the selected status changes', async () => {
    const { result } = renderHook(() => useMyEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setActiveStatus('COMPLETED');
    });

    expect(result.current.visibleEvents.map((event) => event.id)).toEqual([
      'host-completed',
    ]);
    expect(result.current.emptyTitle).toBe('No completed events yet');
  });

  it('shows an auth-specific error when the user is logged out', async () => {
    mockUseAuth.mockReturnValue({
      token: null,
      refreshToken: null,
      user: null,
      setSession: jest.fn(),
      clearAuth: jest.fn(),
    });

    const { result } = renderHook(() => useMyEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListMyEvents).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toBe('You must be logged in to manage your events.');
    expect(result.current.canRetry).toBe(false);
  });

  it('surfaces a retryable error when loading fails', async () => {
    mockListMyEvents.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useMyEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.errorMessage).toBe('Failed to load your events. Please try again.');
    expect(result.current.canRetry).toBe(true);
    expect(result.current.visibleEvents).toEqual([]);
  });
});
