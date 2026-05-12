/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { EventDetail } from '@/models/event';
import { ApiError } from '@/services/api';
import * as eventService from '@/services/eventService';
import * as ticketService from '@/services/ticketService';
import { useAuth } from '@/contexts/AuthContext';
import { useTicketScanViewModel } from './useTicketScanViewModel';

jest.mock('@/services/eventService');
jest.mock('@/services/ticketService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockGetEventDetail = jest.mocked(eventService.getEventDetail);
const mockScanTicket = jest.mocked(ticketService.scanTicket);
const mockUseAuth = jest.mocked(useAuth);

function makeEvent(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: 'event-1',
    title: 'Ticketed Meetup',
    description: 'Bring your ticket.',
    image_url: null,
    privacy_level: 'PROTECTED',
    status: 'ACTIVE',
    start_time: '2030-05-12T18:00:00+03:00',
    end_time: '2030-05-12T20:00:00+03:00',
    capacity: 30,
    minimum_age: null,
    preferred_gender: null,
    approved_participant_count: 12,
    pending_participant_count: 0,
    favorite_count: 4,
    created_at: '2030-04-01T12:00:00+03:00',
    updated_at: '2030-04-02T12:00:00+03:00',
    category: { id: 2, name: 'Social' },
    host: {
      id: 'host-1',
      username: 'hostuser',
      display_name: 'Host User',
      avatar_url: null,
    },
    host_score: {
      final_score: 4.8,
      hosted_event_rating_count: 9,
    },
    location: {
      type: 'POINT',
      address: 'Kadikoy, Istanbul',
      point: { lat: 40.99, lon: 29.03 },
      route_points: [],
    },
    tags: [],
    constraints: [],
    rating_window: {
      opens_at: '2030-05-12T20:00:00+03:00',
      closes_at: '2030-05-19T20:00:00+03:00',
      is_active: false,
    },
    viewer_event_rating: null,
    viewer_context: {
      is_host: true,
      is_favorited: false,
      participation_status: 'JOINED',
    },
    host_context: null,
    ...overrides,
  };
}

describe('useTicketScanViewModel', () => {
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

  it('loads the event and exposes host scan access', async () => {
    const event = makeEvent();
    mockGetEventDetail.mockResolvedValue(event);

    const { result } = renderHook(() => useTicketScanViewModel('event-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetEventDetail).toHaveBeenCalledWith('event-1', 'mock-token');
    expect(result.current.event).toEqual(event);
    expect(result.current.isHost).toBe(true);
    expect(result.current.errorMessage).toBeNull();
  });

  it('shows a login error without calling the event endpoint when auth is missing', async () => {
    mockUseAuth.mockReturnValue({
      token: null,
      refreshToken: null,
      user: null,
      setSession: jest.fn(),
      clearAuth: jest.fn(),
    });

    const { result } = renderHook(() => useTicketScanViewModel('event-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetEventDetail).not.toHaveBeenCalled();
    expect(result.current.event).toBeNull();
    expect(result.current.errorMessage).toBe('You must be logged in to scan tickets.');
  });

  it('trims and submits a QR token successfully', async () => {
    mockGetEventDetail.mockResolvedValue(makeEvent());
    mockScanTicket.mockResolvedValue({
      result: 'ACCEPTED',
      ticket_id: 'ticket-1',
      participation_id: 'participation-1',
      user_id: 'user-1',
      ticket_status: 'USED',
    });

    const { result } = renderHook(() => useTicketScanViewModel('event-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.submitToken('  qr-token  ');
    });

    expect(mockScanTicket).toHaveBeenCalledWith('event-1', 'qr-token', 'mock-token');
    expect(result.current.qrToken).toBe('qr-token');
    expect(result.current.scanResult?.result).toBe('ACCEPTED');
    expect(result.current.errorMessage).toBeNull();
  });

  it('validates empty QR input before submitting', async () => {
    mockGetEventDetail.mockResolvedValue(makeEvent());

    const { result } = renderHook(() => useTicketScanViewModel('event-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.submitToken('   ');
    });

    expect(mockScanTicket).not.toHaveBeenCalled();
    expect(result.current.errorMessage).toBe('Enter a QR token before validating the ticket.');
  });

  it('surfaces API scan failures and clears them with clearResult', async () => {
    mockGetEventDetail.mockResolvedValue(makeEvent());
    mockScanTicket.mockRejectedValue(
      new ApiError(400, {
        error: {
          code: 'invalid_token',
          message: 'This QR token is invalid.',
        },
      }),
    );

    const { result } = renderHook(() => useTicketScanViewModel('event-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.submitToken('bad-token');
    });

    expect(result.current.scanResult).toBeNull();
    expect(result.current.errorMessage).toBe('This QR token is invalid.');

    act(() => {
      result.current.clearResult();
    });

    expect(result.current.qrToken).toBe('');
    expect(result.current.errorMessage).toBeNull();
  });
});
