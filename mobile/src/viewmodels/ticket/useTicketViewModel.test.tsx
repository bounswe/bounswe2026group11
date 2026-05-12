/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import * as ExpoLocation from 'expo-location';
import * as eventService from '@/services/eventService';
import * as ticketService from '@/services/ticketService';
import type { TicketDetailResponse, TicketQrToken } from '@/models/ticket';
import { useTicketViewModel } from './useTicketViewModel';

jest.mock('@/services/eventService');
jest.mock('@/services/ticketService');
jest.mock('expo-location', () => ({
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
  },
  Accuracy: {
    High: 'high',
    Balanced: 'balanced',
  },
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    refreshToken: 'mock-refresh-token',
    user: null,
    setSession: jest.fn(),
    clearAuth: jest.fn(),
  }),
}));

const mockGetMyTicket = jest.mocked(ticketService.getMyTicket);
const mockGetTicketQrTokenOnce = jest.mocked(ticketService.getTicketQrTokenOnce);
const mockGetEventDetail = jest.mocked(eventService.getEventDetail);
const mockLocation = jest.mocked(ExpoLocation);

const baseTicket: TicketDetailResponse = {
  ticket: {
    id: 'ticket-1',
    status: 'ACTIVE',
    expires_at: '2026-05-10T19:00:00Z',
    created_at: '2026-05-09T15:00:00Z',
    updated_at: '2026-05-09T15:00:00Z',
  },
  participation: {
    id: 'participation-1',
    status: 'APPROVED',
  },
  event: {
    id: 'event-1',
    title: 'Protected Walk',
    status: 'ACTIVE',
    privacy_level: 'PROTECTED',
    start_time: '2026-05-10T16:00:00Z',
    end_time: '2026-05-10T18:00:00Z',
    location_type: 'POINT',
    address: 'Beyoglu, Istanbul',
  },
  location: {
    type: 'POINT',
    address: 'Beyoglu, Istanbul',
    anchor_lat: 41.0369,
    anchor_lon: 28.985,
  },
  qr_access: {
    requires_location_permission: true,
    requires_proximity: true,
    proximity_meters: 200,
    eligible_now: true,
    reason: null,
  },
};

const qrTokenFixture: TicketQrToken = {
  token: 'live-qr-token',
  expires_at: new Date(Date.now() + 10000).toISOString(),
  version: 7,
};

describe('useTicketViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockGetEventDetail.mockResolvedValue({ image_url: null } as never);
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: ExpoLocation.PermissionStatus.GRANTED,
    } as never);
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: ExpoLocation.PermissionStatus.GRANTED,
    } as never);
    mockLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: 41.0369,
        longitude: 28.985,
      },
    } as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the backend qr access reason immediately when ticket access is not yet eligible', async () => {
    mockGetMyTicket.mockResolvedValue({
      ...baseTicket,
      qr_access: {
        ...baseTicket.qr_access,
        eligible_now: false,
        reason: 'EVENT_NOT_ACTIVE',
      },
    });

    const { result } = renderHook(() => useTicketViewModel('ticket-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.qrMessage).toBe('The event is not currently accepting ticket access.');
  });

  it('fetches qr token automatically via polling when ticket is active', async () => {
    mockGetMyTicket.mockResolvedValue(baseTicket);
    mockGetTicketQrTokenOnce.mockResolvedValue(qrTokenFixture);

    const { result } = renderHook(() => useTicketViewModel('ticket-1'));

    await waitFor(() => expect(result.current.qrToken).toEqual(qrTokenFixture));
    expect(mockGetTicketQrTokenOnce).toHaveBeenCalledWith(
      'ticket-1',
      { lat: 41.0369, lon: 28.985 },
      'mock-token'
    );
  });

  it('polls for a new token after 10 seconds', async () => {
    mockGetMyTicket.mockResolvedValue(baseTicket);
    mockGetTicketQrTokenOnce.mockResolvedValue(qrTokenFixture);

    renderHook(() => useTicketViewModel('ticket-1'));

    await waitFor(() => expect(mockGetTicketQrTokenOnce).toHaveBeenCalledTimes(1));

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    await waitFor(() => expect(mockGetTicketQrTokenOnce).toHaveBeenCalledTimes(2));
  });

  it('checks ticket status every 2 seconds while the live ticket is open', async () => {
    const usedTicket: TicketDetailResponse = {
      ...baseTicket,
      ticket: {
        ...baseTicket.ticket,
        status: 'USED',
        used_at: '2026-05-10T16:15:00Z',
      },
    };
    mockGetMyTicket
      .mockResolvedValueOnce(baseTicket)
      .mockResolvedValueOnce(baseTicket)
      .mockResolvedValueOnce(usedTicket);
    mockGetTicketQrTokenOnce.mockResolvedValue(qrTokenFixture);

    const { result } = renderHook(() => useTicketViewModel('ticket-1'));

    await waitFor(() => expect(result.current.qrToken).toEqual(qrTokenFixture));

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => expect(result.current.ticket?.ticket.status).toBe('USED'));
    expect(mockGetMyTicket).toHaveBeenCalledTimes(3);
    expect(result.current.qrToken).toBeNull();
  });

  it('handles refresh by resetting state and re-fetching', async () => {
    mockGetMyTicket.mockImplementation(() => Promise.resolve({ ...baseTicket }));
    mockGetTicketQrTokenOnce.mockResolvedValue(qrTokenFixture);

    const { result } = renderHook(() => useTicketViewModel('ticket-1'));

    await waitFor(() => expect(result.current.qrToken).toEqual(qrTokenFixture));

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetMyTicket).toHaveBeenCalledTimes(4);
    await waitFor(() => expect(mockGetTicketQrTokenOnce).toHaveBeenCalledTimes(2));
  });
});
