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
const mockGetTicketQrTokenStream = jest.mocked(ticketService.getTicketQrTokenStream);
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
  expires_at: '2026-05-10T16:00:10Z',
  version: 7,
};

describe('useTicketViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetEventDetail.mockResolvedValue({ image_url: null } as never);
    mockGetTicketQrTokenStream.mockImplementation(async function* () {});
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: ExpoLocation.PermissionStatus.DENIED,
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

  it('re-fetches ticket access on refresh and reveals qr when eligibility has changed', async () => {
    mockGetMyTicket
      .mockResolvedValueOnce({
        ...baseTicket,
        qr_access: {
          ...baseTicket.qr_access,
          eligible_now: false,
          reason: 'EVENT_NOT_ACTIVE',
        },
      })
      .mockResolvedValueOnce(baseTicket);
    mockGetTicketQrTokenOnce.mockResolvedValue(qrTokenFixture);

    const { result } = renderHook(() => useTicketViewModel('ticket-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.qrMessage).toBe('The event is not currently accepting ticket access.');

    await act(async () => {
      await result.current.refreshQr();
    });

    expect(mockGetMyTicket).toHaveBeenCalledTimes(2);
    expect(mockGetTicketQrTokenOnce).toHaveBeenCalledWith(
      'ticket-1',
      { lat: 41.0369, lon: 28.985 },
      'mock-token',
    );
    expect(result.current.qrToken).toEqual(qrTokenFixture);
    expect(result.current.qrMessage).toBeNull();
  });
});
