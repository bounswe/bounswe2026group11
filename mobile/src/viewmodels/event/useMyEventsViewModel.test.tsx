/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import * as eventService from '@/services/eventService';
import * as invitationService from '@/services/invitationService';
import type { MyEventsResponse, MyEventSummary } from '@/models/event';
import { useMyEventsViewModel } from './useMyEventsViewModel';
import { useAuth } from '@/contexts/AuthContext';

jest.mock('@/services/eventService');
jest.mock('@/services/invitationService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockListMyEvents = jest.mocked(eventService.listMyEvents);
const mockListMyInvitations = jest.mocked(invitationService.listMyInvitations);
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

const myInvitationsResponse = {
  items: [
    {
      invitation_id: 'inv-1',
      status: 'PENDING',
      event: { id: 'event-1', title: 'Private Event 1', start_time: '2026-05-10T10:00:00Z' },
      host: { username: 'host1', display_name: 'Host One' },
      message: 'Join us!',
    },
  ],
  total: 1,
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
    mockListMyInvitations.mockResolvedValue(myInvitationsResponse as any);
  });

  it('loads my events and invitations on mount', async () => {
    const { result } = renderHook(() => useMyEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListMyEvents).toHaveBeenCalledWith('mock-token');
    expect(mockListMyInvitations).toHaveBeenCalledWith('mock-token');
    
    expect(result.current.invitations.length).toBe(1);
    expect(result.current.statusTabs.find(t => t.value === 'INVITATIONS')?.count).toBe(1);
  });

  it('filters events when the selected status changes, including INVITATIONS', async () => {
    const { result } = renderHook(() => useMyEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setActiveStatus('INVITATIONS');
    });

    expect(result.current.activeStatus).toBe('INVITATIONS');
    expect(result.current.emptyTitle).toBe('No invitations yet');
  });

  it('handles accepting an invitation', async () => {
    const mockAccept = jest.mocked(invitationService.acceptInvitation);
    mockAccept.mockResolvedValue({} as any);
    
    // First call returns 1, second (after reload) returns 0
    mockListMyInvitations
      .mockResolvedValueOnce(myInvitationsResponse as any)
      .mockResolvedValueOnce({ items: [], total: 0 } as any);

    const { result } = renderHook(() => useMyEventsViewModel());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleAccept('inv-1');
    });

    expect(mockAccept).toHaveBeenCalledWith('inv-1', 'mock-token');
    // After reload, it should be 0
    await waitFor(() => expect(result.current.invitations.length).toBe(0));
    await waitFor(() => expect(mockListMyEvents).toHaveBeenCalledTimes(2));
  });

  it('handles declining an invitation', async () => {
    const mockDecline = jest.mocked(invitationService.declineInvitation);
    mockDecline.mockResolvedValue({} as any);

    const { result } = renderHook(() => useMyEventsViewModel());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleDecline('inv-1');
    });

    expect(mockDecline).toHaveBeenCalledWith('inv-1', 'mock-token');
    expect(result.current.invitations.length).toBe(0);
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
