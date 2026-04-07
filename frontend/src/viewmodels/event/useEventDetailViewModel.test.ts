// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventDetailResponse } from '@/models/event';
import { useEventDetailViewModel } from './useEventDetailViewModel';

const mockGetEventDetail = vi.fn();
const mockGetEventHostContextSummary = vi.fn();
const mockAddFavorite = vi.fn();
const mockRemoveFavorite = vi.fn();
const mockRequestJoinEvent = vi.fn();

vi.mock('@/services/eventService', () => ({
  getEventDetail: (...args: unknown[]) => mockGetEventDetail(...args),
  getEventHostContextSummary: (...args: unknown[]) => mockGetEventHostContextSummary(...args),
  getEventImageUploadUrl: vi.fn(),
  confirmEventImageUpload: vi.fn(),
  joinEvent: vi.fn(),
  requestJoinEvent: (...args: unknown[]) => mockRequestJoinEvent(...args),
  listEventApprovedParticipants: vi.fn(),
  listEventPendingJoinRequests: vi.fn(),
  listEventInvitations: vi.fn(),
  approveJoinRequest: vi.fn(),
  rejectJoinRequest: vi.fn(),
  cancelEvent: vi.fn(),
  addFavorite: (...args: unknown[]) => mockAddFavorite(...args),
  removeFavorite: (...args: unknown[]) => mockRemoveFavorite(...args),
  upsertEventRating: vi.fn(),
  upsertParticipantRating: vi.fn(),
}));

vi.mock('@/utils/imageResize', () => ({
  prepareAvatarBlobs: vi.fn(),
}));

function makeEvent(overrides: Partial<EventDetailResponse> = {}): EventDetailResponse {
  return {
    id: 'event-1',
    title: 'Sunset Walk',
    description: 'A relaxed walk by the coast.',
    image_url: null,
    privacy_level: 'PUBLIC',
    status: 'COMPLETED',
    start_time: '2026-04-01T17:00:00Z',
    end_time: '2026-04-01T19:00:00Z',
    capacity: 20,
    minimum_age: null,
    preferred_gender: null,
    approved_participant_count: 8,
    pending_participant_count: 0,
    favorite_count: 3,
    created_at: '2026-03-20T10:00:00Z',
    updated_at: '2026-04-02T10:00:00Z',
    category: { id: 1, name: 'Outdoors' },
    host: {
      id: 'host-1',
      username: 'hostuser',
      display_name: 'Host User',
      avatar_url: null,
    },
    host_score: {
      final_score: 4.7,
      hosted_event_rating_count: 12,
    },
    location: {
      type: 'POINT',
      address: 'Moda Coast',
      point: { lat: 40.98, lon: 29.03 },
      route_points: [],
    },
    tags: ['walk'],
    constraints: [],
    rating_window: {
      opens_at: '2026-04-01T19:00:00Z',
      closes_at: '2026-04-08T19:00:00Z',
      is_active: true,
    },
    viewer_event_rating: null,
    viewer_context: {
      is_host: false,
      is_favorited: false,
      participation_status: 'JOINED',
    },
    ...overrides,
  };
}

describe('useEventDetailViewModel favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEventHostContextSummary.mockResolvedValue({
      approved_participant_count: 0,
      pending_join_request_count: 0,
      invitation_count: 0,
    });
    mockAddFavorite.mockResolvedValue(undefined);
    mockRemoveFavorite.mockResolvedValue(undefined);
    mockRequestJoinEvent.mockResolvedValue({
      join_request_id: 'join-request-1',
      event_id: 'event-1',
      status: 'PENDING',
      created_at: '2026-04-02T10:00:00Z',
    });
  });

  it('adds favorite locally without refetching event detail', async () => {
    mockGetEventDetail.mockResolvedValue(makeEvent());

    const { result } = renderHook(() => useEventDetailViewModel('event-1', 'token'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.handleFavoriteToggle();
    });

    expect(mockAddFavorite).toHaveBeenCalledWith('event-1', 'token');
    expect(mockGetEventDetail).toHaveBeenCalledTimes(1);
    expect(result.current.event?.viewer_context.is_favorited).toBe(true);
    expect(result.current.event?.favorite_count).toBe(4);
  });

  it('removes favorite locally without refetching event detail', async () => {
    mockGetEventDetail.mockResolvedValue(
      makeEvent({
        favorite_count: 4,
        viewer_context: {
          is_host: false,
          is_favorited: true,
          participation_status: 'JOINED',
        },
      }),
    );

    const { result } = renderHook(() => useEventDetailViewModel('event-1', 'token'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.handleFavoriteToggle();
    });

    expect(mockRemoveFavorite).toHaveBeenCalledWith('event-1', 'token');
    expect(mockGetEventDetail).toHaveBeenCalledTimes(1);
    expect(result.current.event?.viewer_context.is_favorited).toBe(false);
    expect(result.current.event?.favorite_count).toBe(3);
  });

  it('rolls back the local favorite state when the request fails', async () => {
    mockGetEventDetail.mockResolvedValue(makeEvent());
    mockAddFavorite.mockRejectedValue(new Error('request failed'));

    const { result } = renderHook(() => useEventDetailViewModel('event-1', 'token'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.handleFavoriteToggle();
    });

    expect(mockGetEventDetail).toHaveBeenCalledTimes(1);
    expect(result.current.event?.viewer_context.is_favorited).toBe(false);
    expect(result.current.event?.favorite_count).toBe(3);
  });

  it('marks the viewer as pending immediately after a successful join request', async () => {
    mockGetEventDetail
      .mockResolvedValueOnce(
        makeEvent({
          privacy_level: 'PROTECTED',
          status: 'ACTIVE',
          viewer_context: {
            is_host: false,
            is_favorited: false,
            participation_status: 'NONE',
          },
        }),
      )
      .mockRejectedValueOnce(new Error('stale detail fetch'));

    const { result } = renderHook(() => useEventDetailViewModel('event-1', 'token'));

    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await result.current.handleRequestJoin();
    });

    expect(mockRequestJoinEvent).toHaveBeenCalledWith('event-1', 'token', undefined);
    expect(result.current.event?.viewer_context.participation_status).toBe('PENDING');
    expect(result.current.joinError).toBeNull();
  });
});
