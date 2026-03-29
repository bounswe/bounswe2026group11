/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import * as eventService from '@/services/eventService';
import { ApiError } from '@/services/api';
import type {
  EventDetail,
  JoinEventResponse,
  RequestJoinResponse,
} from '@/models/event';
import { useEventDetailViewModel } from './useEventDetailViewModel';

jest.mock('@/services/eventService');
const mockUser = {
  id: 'user-uuid-001',
  username: 'testuser',
  email: 'test@example.com',
  phone_number: null,
  email_verified: true,
  status: 'active',
  gender: null as string | null | undefined,
  birth_date: null as string | null | undefined,
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    refreshToken: 'mock-refresh-token',
    user: mockUser,
    setSession: jest.fn(),
    clearAuth: jest.fn(),
  }),
}));

const mockGetEventDetail = jest.mocked(eventService.getEventDetail);
const mockJoinEvent = jest.mocked(eventService.joinEvent);
const mockRequestJoinEvent = jest.mocked(eventService.requestJoinEvent);

const mockErrorBody = { error: { code: 'server_error', message: 'Unexpected error' } };

const publicEventFixture: EventDetail = {
  id: 'event-uuid-001',
  title: 'Istanbul Trail Run',
  description: 'A 10 km trail run through Belgrad Forest.',
  image_url: 'https://example.com/trail.jpg',
  privacy_level: 'PUBLIC',
  status: 'ACTIVE',
  start_time: '2026-05-01T08:00:00+03:00',
  end_time: '2026-05-01T12:00:00+03:00',
  capacity: 25,
  minimum_age: 18,
  preferred_gender: null,
  approved_participant_count: 12,
  pending_participant_count: 0,
  favorite_count: 8,
  created_at: '2026-03-26T11:00:00+03:00',
  updated_at: '2026-03-27T09:30:00+03:00',
  category: { id: 7, name: 'Outdoors' },
  host: {
    id: 'host-uuid-001',
    username: 'host_user',
    display_name: 'Host User',
    avatar_url: 'https://example.com/avatar.png',
  },
  host_score: { final_score: 4.18, hosted_event_rating_count: 9 },
  location: {
    type: 'POINT',
    address: 'Belgrad Forest, Istanbul',
    point: { lat: 41.1722, lon: 28.9744 },
  },
  tags: ['trail', 'running'],
  constraints: [{ type: 'equipment', info: 'Trail running shoes required' }],
  rating_window: {
    opens_at: '2026-05-01T12:00:00+03:00',
    closes_at: '2026-05-08T12:00:00+03:00',
    is_active: false,
  },
  viewer_event_rating: null,
  viewer_context: {
    is_host: false,
    is_favorited: true,
    participation_status: 'NONE',
  },
};

const protectedEventFixture: EventDetail = {
  ...publicEventFixture,
  id: 'event-uuid-002',
  privacy_level: 'PROTECTED',
  viewer_context: {
    is_host: false,
    is_favorited: false,
    participation_status: 'NONE',
  },
};

const fullEventFixture: EventDetail = {
  ...publicEventFixture,
  approved_participant_count: 25,
  capacity: 25,
};

const joinResponseFixture: JoinEventResponse = {
  participation_id: 'part-uuid-001',
  event_id: 'event-uuid-001',
  status: 'APPROVED',
  created_at: '2026-03-26T11:00:00+03:00',
};

const requestJoinResponseFixture: RequestJoinResponse = {
  join_request_id: 'req-uuid-001',
  event_id: 'event-uuid-002',
  status: 'PENDING',
  created_at: '2026-03-26T12:00:00+03:00',
};

describe('useEventDetailViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEventDetail.mockResolvedValue(publicEventFixture);
    mockJoinEvent.mockResolvedValue(joinResponseFixture);
    mockRequestJoinEvent.mockResolvedValue(requestJoinResponseFixture);
  });

  // ─── Initial loading state ───
  describe('initial state', () => {
    it('starts in loading state with no event data', () => {
      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.event).toBeNull();
      expect(result.current.apiError).toBeNull();
      expect(result.current.actionError).toBeNull();
      expect(result.current.showJoinRequestModal).toBe(false);
      expect(result.current.joinRequestMessage).toBe('');
    });
  });

  // ─── Fetching event detail ───
  describe('fetching event', () => {
    it('loads event detail on mount and sets viewer context', async () => {
      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockGetEventDetail).toHaveBeenCalledWith('event-uuid-001', 'mock-token');
      expect(result.current.event).toEqual(publicEventFixture);
      expect(result.current.isFavorited).toBe(true);
      expect(result.current.participationStatus).toBe('NONE');
      expect(result.current.apiError).toBeNull();
    });

    it('sets apiError when fetch fails', async () => {
      mockGetEventDetail.mockRejectedValueOnce(new Error('network error'));

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.event).toBeNull();
      expect(result.current.apiError).toBe(
        'Failed to load event details. Please try again.',
      );
    });

    it('retry re-fetches the event', async () => {
      mockGetEventDetail
        .mockRejectedValueOnce(new Error('first failure'))
        .mockResolvedValueOnce(publicEventFixture);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.apiError).not.toBeNull();

      await act(async () => {
        result.current.retry();
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.event).toEqual(publicEventFixture);
      expect(result.current.apiError).toBeNull();
    });
  });

  // ─── Quota full detection ───
  describe('isQuotaFull', () => {
    it('is false when approved count is below capacity', async () => {
      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isQuotaFull).toBe(false);
    });

    it('is true when approved count meets capacity', async () => {
      mockGetEventDetail.mockResolvedValueOnce(fullEventFixture);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isQuotaFull).toBe(true);
    });

    it('is false when capacity is null (unlimited)', async () => {
      const unlimitedEvent: EventDetail = { ...publicEventFixture, capacity: null };
      mockGetEventDetail.mockResolvedValueOnce(unlimitedEvent);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isQuotaFull).toBe(false);
    });
  });

  // ─── Favorite toggle ───
  describe('handleToggleFavorite', () => {
    it('toggles isFavorited from true to false', async () => {
      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isFavorited).toBe(true);

      act(() => {
        result.current.handleToggleFavorite();
      });

      expect(result.current.isFavorited).toBe(false);
    });

    it('toggles isFavorited back on second call', async () => {
      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => { result.current.handleToggleFavorite(); });
      act(() => { result.current.handleToggleFavorite(); });

      expect(result.current.isFavorited).toBe(true);
    });

    it('initialises isFavorited from viewer_context', async () => {
      mockGetEventDetail.mockResolvedValueOnce(protectedEventFixture);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-002'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isFavorited).toBe(false);
    });
  });

  // ─── Direct join (PUBLIC event) ───
  describe('handleJoin', () => {
    it('calls joinEvent, refreshes event detail, and reflects JOINED status', async () => {
      const joinedEvent: EventDetail = {
        ...publicEventFixture,
        approved_participant_count: 13,
        viewer_context: {
          ...publicEventFixture.viewer_context,
          participation_status: 'JOINED',
        },
      };
      mockGetEventDetail
        .mockResolvedValueOnce(publicEventFixture)
        .mockResolvedValueOnce(joinedEvent);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.handleJoin();
      });

      expect(mockJoinEvent).toHaveBeenCalledWith('event-uuid-001', 'mock-token');
      expect(mockGetEventDetail).toHaveBeenCalledTimes(2);
      expect(result.current.participationStatus).toBe('JOINED');
      expect(result.current.actionState).toBe('success_joined');
      expect(result.current.event?.approved_participant_count).toBe(13);
      expect(result.current.actionError).toBeNull();
    });

    it('does not show full loading screen during post-join refresh', async () => {
      const joinedEvent: EventDetail = {
        ...publicEventFixture,
        viewer_context: { ...publicEventFixture.viewer_context, participation_status: 'JOINED' },
      };
      mockGetEventDetail
        .mockResolvedValueOnce(publicEventFixture)
        .mockResolvedValueOnce(joinedEvent);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const loadingDuringJoin: boolean[] = [];

      await act(async () => {
        const joinPromise = result.current.handleJoin();
        loadingDuringJoin.push(result.current.isLoading);
        await joinPromise;
      });

      expect(loadingDuringJoin.every((v) => v === false)).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    it('sets actionError when joinEvent returns an ApiError', async () => {
      mockJoinEvent.mockRejectedValueOnce(
        new ApiError(409, {
          error: { code: 'already_participating', message: 'You are already participating.' },
        }),
      );

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.handleJoin();
      });

      expect(result.current.participationStatus).toBe('NONE');
      expect(result.current.actionState).toBe('idle');
      expect(result.current.actionError).toBe('You are already participating.');
    });

    it('sets generic actionError on unknown join failure', async () => {
      mockJoinEvent.mockRejectedValueOnce(new ApiError(500, mockErrorBody));

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.handleJoin();
      });

      expect(result.current.actionError).toBe('Unexpected error');
    });
  });

  // ─── Join request (PROTECTED event) ───
  describe('join request modal', () => {
    it('opens and closes the modal', async () => {
      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-002'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.showJoinRequestModal).toBe(false);

      act(() => { result.current.openJoinRequestModal(); });
      expect(result.current.showJoinRequestModal).toBe(true);

      act(() => { result.current.closeJoinRequestModal(); });
      expect(result.current.showJoinRequestModal).toBe(false);
    });

    it('clears message and error when closing the modal', async () => {
      mockGetEventDetail.mockResolvedValueOnce(protectedEventFixture);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-002'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.openJoinRequestModal();
        result.current.setJoinRequestMessage('I want to join!');
      });

      expect(result.current.joinRequestMessage).toBe('I want to join!');

      act(() => { result.current.closeJoinRequestModal(); });

      expect(result.current.joinRequestMessage).toBe('');
    });

    it('updates joinRequestMessage', async () => {
      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-002'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.setJoinRequestMessage('I have attended similar events.');
      });

      expect(result.current.joinRequestMessage).toBe('I have attended similar events.');
    });
  });

  // ─── handleRequestJoin ───
  describe('handleRequestJoin', () => {
    it('calls requestJoinEvent with the message and updates status to PENDING', async () => {
      mockGetEventDetail.mockResolvedValueOnce(protectedEventFixture);
      mockRequestJoinEvent.mockResolvedValueOnce(requestJoinResponseFixture);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-002'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.openJoinRequestModal();
        result.current.setJoinRequestMessage('I have experience with similar events.');
      });

      await act(async () => {
        await result.current.handleRequestJoin();
      });

      expect(mockRequestJoinEvent).toHaveBeenCalledWith(
        'event-uuid-002',
        { message: 'I have experience with similar events.' },
        'mock-token',
      );
      expect(result.current.participationStatus).toBe('PENDING');
      expect(result.current.actionState).toBe('success_requested');
      expect(result.current.showJoinRequestModal).toBe(false);
      expect(result.current.joinRequestMessage).toBe('');
      expect(result.current.actionError).toBeNull();
    });

    it('sends null message when the input is blank', async () => {
      mockGetEventDetail.mockResolvedValueOnce(protectedEventFixture);
      mockRequestJoinEvent.mockResolvedValueOnce(requestJoinResponseFixture);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-002'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.handleRequestJoin();
      });

      expect(mockRequestJoinEvent).toHaveBeenCalledWith(
        'event-uuid-002',
        { message: null },
        'mock-token',
      );
    });

    it('trims whitespace-only message and sends null', async () => {
      mockGetEventDetail.mockResolvedValueOnce(protectedEventFixture);
      mockRequestJoinEvent.mockResolvedValueOnce(requestJoinResponseFixture);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-002'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.setJoinRequestMessage('   ');
      });

      await act(async () => {
        await result.current.handleRequestJoin();
      });

      expect(mockRequestJoinEvent).toHaveBeenCalledWith(
        'event-uuid-002',
        { message: null },
        'mock-token',
      );
    });

    it('sets actionError and keeps modal open when request fails', async () => {
      mockGetEventDetail.mockResolvedValueOnce(protectedEventFixture);
      mockRequestJoinEvent.mockRejectedValueOnce(
        new ApiError(409, {
          error: { code: 'already_requested', message: 'You already have a pending join request.' },
        }),
      );

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-002'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => { result.current.openJoinRequestModal(); });

      await act(async () => {
        await result.current.handleRequestJoin();
      });

      expect(result.current.participationStatus).toBe('NONE');
      expect(result.current.actionState).toBe('idle');
      expect(result.current.actionError).toBe('You already have a pending join request.');
      expect(result.current.showJoinRequestModal).toBe(true);
    });
  });

  // ─── Participation constraint enforcement ───
  describe('constraintViolation', () => {
    it('is null when the event has no constraints', async () => {
      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.constraintViolation).toBeNull();
    });

    it('is null when user gender is unknown (null) even if event has preferred_gender', async () => {
      mockUser.gender = null;
      const genderedEvent: EventDetail = {
        ...publicEventFixture,
        preferred_gender: 'MALE',
      };
      mockGetEventDetail.mockResolvedValueOnce(genderedEvent);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.constraintViolation).toBeNull();
    });

    it('is null when user gender matches preferred_gender (case-insensitive)', async () => {
      mockUser.gender = 'male';
      const genderedEvent: EventDetail = {
        ...publicEventFixture,
        preferred_gender: 'MALE',
      };
      mockGetEventDetail.mockResolvedValueOnce(genderedEvent);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.constraintViolation).toBeNull();
      mockUser.gender = null;
    });

    it('is non-null when user gender does not match preferred_gender', async () => {
      mockUser.gender = 'female';
      const genderedEvent: EventDetail = {
        ...publicEventFixture,
        preferred_gender: 'MALE',
      };
      mockGetEventDetail.mockResolvedValueOnce(genderedEvent);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.constraintViolation).toContain('Male participants only');
      mockUser.gender = null;
    });

    it('is null when user birth_date is unknown even if event has minimum_age', async () => {
      mockUser.birth_date = null;
      const agedEvent: EventDetail = { ...publicEventFixture, minimum_age: 21 };
      mockGetEventDetail.mockResolvedValueOnce(agedEvent);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.constraintViolation).toBeNull();
    });

    it('is non-null when user is under the minimum age', async () => {
      const youngBirthDate = new Date();
      youngBirthDate.setFullYear(youngBirthDate.getFullYear() - 16);
      mockUser.birth_date = youngBirthDate.toISOString().split('T')[0];

      const agedEvent: EventDetail = { ...publicEventFixture, minimum_age: 18 };
      mockGetEventDetail.mockResolvedValueOnce(agedEvent);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.constraintViolation).toContain('18+');
      mockUser.birth_date = null;
    });

    it('is null when user meets the minimum age', async () => {
      const adultBirthDate = new Date();
      adultBirthDate.setFullYear(adultBirthDate.getFullYear() - 20);
      mockUser.birth_date = adultBirthDate.toISOString().split('T')[0];

      const agedEvent: EventDetail = { ...publicEventFixture, minimum_age: 18 };
      mockGetEventDetail.mockResolvedValueOnce(agedEvent);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.constraintViolation).toBeNull();
      mockUser.birth_date = null;
    });

    it('combines both gender and age violations into one message', async () => {
      mockUser.gender = 'female';
      const youngBirthDate = new Date();
      youngBirthDate.setFullYear(youngBirthDate.getFullYear() - 15);
      mockUser.birth_date = youngBirthDate.toISOString().split('T')[0];

      const restrictedEvent: EventDetail = {
        ...publicEventFixture,
        preferred_gender: 'MALE',
        minimum_age: 18,
      };
      mockGetEventDetail.mockResolvedValueOnce(restrictedEvent);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.constraintViolation).toContain('Male participants only');
      expect(result.current.constraintViolation).toContain('18+');
      mockUser.gender = null;
      mockUser.birth_date = null;
    });
  });
});
