/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import * as eventService from '@/services/eventService';
import * as ticketService from '@/services/ticketService';
import { useAuth } from '@/contexts/AuthContext';
import { useEventActionsViewModel } from './useEventActionsViewModel';

jest.mock('@/services/eventService');
jest.mock('@/services/ticketService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockGetEventDetail = jest.mocked(eventService.getEventDetail);
const mockListMyTickets = jest.mocked(ticketService.listMyTickets);
const mockUseAuth = jest.mocked(useAuth);

const baseEventDetail = {
  id: 'event-1',
  title: 'Sample Event',
  description: 'Description',
  image_url: null,
  privacy_level: 'PUBLIC' as const,
  status: 'ACTIVE',
  start_time: '2030-01-01T10:00:00+03:00',
  end_time: null,
  capacity: 20,
  minimum_age: null,
  preferred_gender: null,
  approved_participant_count: 5,
  pending_participant_count: 0,
  favorite_count: 0,
  created_at: '2030-01-01T09:00:00+03:00',
  updated_at: '2030-01-01T09:00:00+03:00',
  category: { id: 1, name: 'Social' },
  host: {
    id: 'host-1',
    username: 'hostuser',
    display_name: 'Host User',
    avatar_url: null,
  },
  host_score: {
    final_score: 4.5,
    hosted_event_rating_count: 10,
  },
  location: {
    type: 'POINT' as const,
    address: 'Kadikoy, Istanbul',
    point: { lat: 40.99, lon: 29.03 },
    route_points: [],
  },
  tags: [],
  constraints: [],
  rating_window: {
    opens_at: '2030-01-01T20:00:00+03:00',
    closes_at: '2030-01-08T20:00:00+03:00',
    is_active: false,
  },
  viewer_event_rating: null,
  viewer_context: {
    is_host: false,
    is_favorited: false,
    participation_status: 'JOINED',
  },
  host_context: null,
};

describe('useEventActionsViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: 'mock-token',
      refreshToken: 'mock-refresh-token',
      user: null,
      setSession: jest.fn(),
      clearAuth: jest.fn(),
    });
  });

  it('retries ticket lookup for joined public events and eventually exposes View Ticket', async () => {
    mockGetEventDetail.mockResolvedValue(baseEventDetail as any);
    mockListMyTickets
      .mockResolvedValueOnce({ items: [] } as any)
      .mockResolvedValueOnce({ items: [] } as any)
      .mockResolvedValueOnce({
        items: [
          {
            ticket_id: 'ticket-1',
            status: 'ACTIVE',
            expires_at: '2030-01-01T12:00:00+03:00',
            event: {
              id: 'event-1',
              title: 'Sample Event',
              status: 'ACTIVE',
              privacy_level: 'PUBLIC',
              start_time: '2030-01-01T10:00:00+03:00',
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
      } as any);

    const { result } = renderHook(() => useEventActionsViewModel('event-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false), {
      timeout: 3000,
    });

    expect(mockListMyTickets).toHaveBeenCalledTimes(3);
    expect(result.current.canOpenTicket).toBe(true);
    expect(result.current.primaryActionLabel).toBe('View Ticket');
    expect(result.current.ticket?.ticket_id).toBe('ticket-1');
  });

  it('does not apply the new retry loop to protected events', async () => {
    mockGetEventDetail.mockResolvedValue({
      ...baseEventDetail,
      privacy_level: 'PROTECTED',
    } as any);
    mockListMyTickets.mockResolvedValue({ items: [] } as any);

    const { result } = renderHook(() => useEventActionsViewModel('event-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListMyTickets).toHaveBeenCalledTimes(1);
    expect(result.current.canOpenTicket).toBe(false);
  });
});
