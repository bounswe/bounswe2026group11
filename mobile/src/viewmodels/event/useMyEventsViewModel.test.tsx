/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import * as eventService from '@/services/eventService';
import * as ticketService from '@/services/ticketService';
import type { MyEventsResponse, MyEventSummary } from '@/models/event';
import { useMyEventsViewModel } from './useMyEventsViewModel';
import { useAuth } from '@/contexts/AuthContext';

jest.mock('@/services/eventService');
jest.mock('@/services/ticketService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockListMyEvents = jest.mocked(eventService.listMyEvents);
const mockListMyTickets = jest.mocked(ticketService.listMyTickets);
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

const myTicketsResponse = {
  items: [
    {
      ticket_id: 'ticket-1',
      status: 'USED',
      expires_at: '2026-04-09T23:59:59+03:00',
      event: {
        id: 'attend-active',
        title: 'Event attend-active',
        status: 'ACTIVE',
        privacy_level: 'PROTECTED',
        start_time: '2026-04-09T20:00:00+03:00',
        end_time: null,
        location_type: 'POINT',
        address: 'Kadikoy, Istanbul',
      },
      participation: {
        id: 'participation-1',
        status: 'APPROVED',
      },
    },
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
    mockListMyTickets.mockResolvedValue(myTicketsResponse as any);
  });

  it('loads my events on mount and decorates attended ticket data', async () => {
    const { result } = renderHook(() => useMyEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListMyEvents).toHaveBeenCalledWith('mock-token');
    expect(mockListMyTickets).toHaveBeenCalledWith('mock-token');
    
    expect(result.current.statusTabs.map((tab) => tab.value)).toEqual([
      'ACTIVE',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELED',
    ]);
    expect(result.current.attendedEvents[0].ticket_id).toBe('ticket-1');
    expect(result.current.attendedEvents[0].ticket_status).toBe('USED');
    expect(result.current.attendedEvents[0].badges).toEqual([{ type: 'TICKET', label: 'Ticket' }]);
  });

  it('filters events when the selected status changes', async () => {
    const { result } = renderHook(() => useMyEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setActiveStatus('COMPLETED');
    });

    expect(result.current.activeStatus).toBe('COMPLETED');
    expect(result.current.visibleEvents.map((event) => event.id)).toEqual([
      'host-completed',
    ]);
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
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { result } = renderHook(() => useMyEventsViewModel());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.errorMessage).toBe('network');
      expect(result.current.canRetry).toBe(true);
      expect(result.current.visibleEvents).toEqual([]);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

});
