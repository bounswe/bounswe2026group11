/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import * as eventService from '@/services/eventService';
import * as favoriteService from '@/services/favoriteService';
import { ApiError } from '@/services/api';
import type {
  EventDetail,
  JoinEventResponse,
  LeaveEventResponse,
  RequestJoinResponse,
} from '@/models/event';
import type { UserSummary } from '@/models/auth';
import {
  resolveConstraintViolation,
  useEventDetailViewModel,
} from './useEventDetailViewModel';

jest.mock('@/services/eventService');
jest.mock('@/services/favoriteService');

const mockUser: UserSummary = {
  id: 'user-uuid-001',
  username: 'testuser',
  email: 'test@example.com',
  phone_number: null,
  email_verified: true,
  status: 'active',
  gender: null,
  birth_date: null,
};

function resetMockSessionUser() {
  mockUser.gender = null;
  mockUser.birth_date = null;
}

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
const mockLeaveEvent = jest.mocked(eventService.leaveEvent);
const mockRequestJoinEvent = jest.mocked(eventService.requestJoinEvent);
const mockGetEventHostContextSummary = jest.mocked(eventService.getEventHostContextSummary);
const mockListEventApprovedParticipants = jest.mocked(eventService.listEventApprovedParticipants);
const mockListEventPendingJoinRequests = jest.mocked(eventService.listEventPendingJoinRequests);
const mockApproveJoinRequest = jest.mocked(eventService.approveJoinRequest);
const mockRejectJoinRequest = jest.mocked(eventService.rejectJoinRequest);
const mockCancelEvent = jest.mocked(eventService.cancelEvent);
const mockAddFavorite = jest.mocked(favoriteService.addFavorite);
const mockRemoveFavorite = jest.mocked(favoriteService.removeFavorite);

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

const hostedEventFixture: EventDetail = {
  ...publicEventFixture,
  id: 'event-uuid-003',
  viewer_context: {
    is_host: true,
    is_favorited: false,
    participation_status: 'NONE',
  },
  host_context: {
    approved_participants: [
      {
        participation_id: 'p-1',
        user: { id: 'u1', username: 'p1', display_name: null, avatar_url: null, rating_count: 5 },
        status: 'APPROVED',
        created_at: '2026-03-26T11:00:00+03:00',
        updated_at: '2026-03-26T11:00:00+03:00',
      },
    ],
    pending_join_requests: [
      {
        join_request_id: 'req-1',
        user: { id: 'u2', username: 'p2', display_name: null, avatar_url: null, rating_count: 2 },
        message: 'Let me in',
        status: 'PENDING',
        created_at: '2026-03-26T12:00:00+03:00',
        updated_at: '2026-03-26T12:00:00+03:00',
      },
    ],
    invitations: [],
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

const leaveEventResponseFixture: LeaveEventResponse = {
  participation_id: 'part-uuid-001',
  event_id: 'event-uuid-001',
  status: 'LEAVED',
  updated_at: '2026-03-28T10:00:00+03:00',
};

const joinedEventFixture: EventDetail = {
  ...publicEventFixture,
  viewer_context: {
    ...publicEventFixture.viewer_context,
    participation_status: 'JOINED',
  },
};

const joinedInProgressEventFixture: EventDetail = {
  ...publicEventFixture,
  status: 'IN_PROGRESS',
  start_time: '2026-03-25T08:00:00+03:00',
  end_time: '2099-12-31T23:59:59+03:00',
  viewer_context: {
    ...publicEventFixture.viewer_context,
    participation_status: 'JOINED',
  },
};

describe('resolveConstraintViolation', () => {
  it('returns null when event has no gender or age constraints', () => {
    expect(
      resolveConstraintViolation(
        { ...publicEventFixture, preferred_gender: null, minimum_age: null },
        'anything',
        '2000-01-01',
      ),
    ).toBeNull();
  });

  it('returns null when preferred_gender is set but user gender is missing', () => {
    expect(
      resolveConstraintViolation(
        { ...publicEventFixture, preferred_gender: 'MALE' },
        null,
        null,
      ),
    ).toBeNull();
  });

  it('returns null when preferred_gender is set but user gender is blank or whitespace', () => {
    expect(
      resolveConstraintViolation({ ...publicEventFixture, preferred_gender: 'MALE' }, '', null),
    ).toBeNull();
    expect(
      resolveConstraintViolation({ ...publicEventFixture, preferred_gender: 'MALE' }, '   ', null),
    ).toBeNull();
  });

  it('returns null when user matches (lowercase or API uppercase wire format)', () => {
    expect(
      resolveConstraintViolation({ ...publicEventFixture, preferred_gender: 'MALE' }, 'male', null),
    ).toBeNull();
    expect(
      resolveConstraintViolation({ ...publicEventFixture, preferred_gender: 'MALE' }, 'MALE', null),
    ).toBeNull();
    expect(
      resolveConstraintViolation({ ...publicEventFixture, preferred_gender: 'FEMALE' }, 'female', null),
    ).toBeNull();
    expect(
      resolveConstraintViolation({ ...publicEventFixture, preferred_gender: 'OTHER' }, 'OTHER', null),
    ).toBeNull();
  });

  it('returns a message when user gender does not match preferred_gender', () => {
    const msg = resolveConstraintViolation(
      { ...publicEventFixture, preferred_gender: 'MALE' },
      'female',
      null,
    );
    expect(msg).toContain('Male participants only');
  });

  it('returns null when minimum_age is set but birth_date is missing or blank', () => {
    expect(
      resolveConstraintViolation({ ...publicEventFixture, minimum_age: 21 }, 'male', null),
    ).toBeNull();
    expect(
      resolveConstraintViolation({ ...publicEventFixture, minimum_age: 21 }, 'male', ''),
    ).toBeNull();
    expect(
      resolveConstraintViolation({ ...publicEventFixture, minimum_age: 21 }, 'male', '  '),
    ).toBeNull();
  });

  it('returns a message when user is under minimum_age', () => {
    const young = new Date();
    young.setFullYear(young.getFullYear() - 10);
    const birth = young.toISOString().split('T')[0];
    const msg = resolveConstraintViolation(
      { ...publicEventFixture, minimum_age: 18 },
      null,
      birth,
    );
    expect(msg).toContain('18+');
  });

  it('joins gender and age messages with · when both fail', () => {
    const young = new Date();
    young.setFullYear(young.getFullYear() - 10);
    const birth = young.toISOString().split('T')[0];
    const msg = resolveConstraintViolation(
      { ...publicEventFixture, preferred_gender: 'MALE', minimum_age: 18 },
      'female',
      birth,
    );
    expect(msg).toContain(' · ');
    expect(msg).toContain('Male participants only');
    expect(msg).toContain('18+');
  });
});

describe('useEventDetailViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSessionUser();
    mockGetEventDetail.mockResolvedValue(publicEventFixture);
    mockJoinEvent.mockResolvedValue(joinResponseFixture);
    mockLeaveEvent.mockResolvedValue(leaveEventResponseFixture);
    mockRequestJoinEvent.mockResolvedValue(requestJoinResponseFixture);
    mockGetEventHostContextSummary.mockResolvedValue({
      approved_participant_count: 1,
      pending_join_request_count: 1,
      invitation_count: 0,
    });
    mockListEventApprovedParticipants.mockResolvedValue({
      items: hostedEventFixture.host_context?.approved_participants ?? [],
      page_info: { next_cursor: null, has_next: false },
    });
    mockListEventPendingJoinRequests.mockResolvedValue({
      items: hostedEventFixture.host_context?.pending_join_requests ?? [],
      page_info: { next_cursor: null, has_next: false },
    });
    mockApproveJoinRequest.mockResolvedValue(undefined);
    mockRejectJoinRequest.mockResolvedValue(undefined);
    mockCancelEvent.mockResolvedValue(undefined);
    mockAddFavorite.mockResolvedValue(undefined);
    mockRemoveFavorite.mockResolvedValue(undefined);
  });

  // ─── Initial loading state ───
  describe('initial state', () => {
    it('starts in loading state with no event data', () => {
      mockGetEventDetail.mockReturnValueOnce(new Promise(() => {}));

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
    it('calls removeFavorite and decrements count when currently favorited', async () => {
      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isFavorited).toBe(true);
      expect(result.current.event?.favorite_count).toBe(8);

      await act(async () => {
        await result.current.handleToggleFavorite();
      });

      expect(mockRemoveFavorite).toHaveBeenCalledWith('event-uuid-001', 'mock-token');
      expect(result.current.isFavorited).toBe(false);
      expect(result.current.event?.favorite_count).toBe(7);
    });

    it('calls addFavorite and increments count when currently not favorited', async () => {
      mockGetEventDetail.mockResolvedValueOnce(protectedEventFixture);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-002'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isFavorited).toBe(false);

      await act(async () => {
        await result.current.handleToggleFavorite();
      });

      expect(mockAddFavorite).toHaveBeenCalledWith('event-uuid-002', 'mock-token');
      expect(result.current.isFavorited).toBe(true);
      expect(result.current.event?.favorite_count).toBe(9);
    });

    it('rolls back optimistic favorite change when API fails', async () => {
      mockRemoveFavorite.mockRejectedValueOnce(new Error('network'));

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.handleToggleFavorite();
      });

      expect(result.current.isFavorited).toBe(true);
      expect(result.current.event?.favorite_count).toBe(8);
      expect(result.current.actionError).toBe('Failed to update favorite. Please try again.');
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
    });

    it('is null when session UserSummary.gender is uppercase MALE (API wire format)', async () => {
      mockUser.gender = 'MALE';
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

    it('is null when session UserSummary.birth_date is set and user meets minimum age', async () => {
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
    });
  });

  // ─── Host Actions ───
  describe('Host actions', () => {
    it('handleApproveRequest calls api and refreshes event detail', async () => {
      mockGetEventDetail
        .mockResolvedValueOnce(hostedEventFixture) // initial load
        .mockResolvedValueOnce(hostedEventFixture); // refresh after approve
        
      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-003'),
      );
      
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      await act(async () => {
        await result.current.handleApproveRequest('req-1');
      });
      
      expect(mockApproveJoinRequest).toHaveBeenCalledWith('event-uuid-003', 'req-1', 'mock-token');
      expect(mockGetEventDetail).toHaveBeenCalledTimes(2);
    });

    it('handleRejectRequest calls api and refreshes event detail', async () => {
      mockGetEventDetail
        .mockResolvedValueOnce(hostedEventFixture) 
        .mockResolvedValueOnce(hostedEventFixture); 
        
      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-003'),
      );
      
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      await act(async () => {
        await result.current.handleRejectRequest('req-1');
      });
      
      expect(mockRejectJoinRequest).toHaveBeenCalledWith('event-uuid-003', 'req-1', 'mock-token');
      expect(mockGetEventDetail).toHaveBeenCalledTimes(2);
    });

    it('handleCancelEvent calls api and refreshes event detail', async () => {
      mockGetEventDetail
        .mockResolvedValueOnce(hostedEventFixture) 
        .mockResolvedValueOnce({ ...hostedEventFixture, status: 'CANCELED', approved_participant_count: 0 }); 
        
      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-003'),
      );
      
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      
      await act(async () => {
        await result.current.handleCancelEvent();
      });
      
      expect(mockCancelEvent).toHaveBeenCalledWith('event-uuid-003', 'mock-token');
      expect(mockGetEventDetail).toHaveBeenCalledTimes(2); 
      expect(result.current.event?.status).toBe('CANCELED');
      expect(result.current.event?.approved_participant_count).toBe(0);
    });

    it('handleCancelEvent sets global actionError if it fails', async () => {
      mockGetEventDetail.mockResolvedValueOnce(hostedEventFixture);
      mockCancelEvent.mockRejectedValueOnce(new Error('Cancel failed'));

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-003'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.handleCancelEvent();
      });

      expect(result.current.actionError).toBe('Cancel failed');
      expect(result.current.event?.status).toBe('ACTIVE');
    });
  });

  // ─── canLeave ───
  describe('canLeave', () => {
    it('is true when user is a joined participant on an active event', async () => {
      mockGetEventDetail.mockResolvedValueOnce(joinedEventFixture);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.canLeave).toBe(true);
    });

    it('is true when user is a joined participant on an in-progress event with future end_time', async () => {
      mockGetEventDetail.mockResolvedValueOnce(joinedInProgressEventFixture);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.canLeave).toBe(true);
    });

    it('is false when the user is the host', async () => {
      mockGetEventDetail.mockResolvedValueOnce(hostedEventFixture);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-003'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.canLeave).toBe(false);
    });

    it('is false when user is not a participant', async () => {
      mockGetEventDetail.mockResolvedValueOnce(publicEventFixture);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.participationStatus).toBe('NONE');
      expect(result.current.canLeave).toBe(false);
    });

    it('is false when event is canceled', async () => {
      const canceledJoined: EventDetail = {
        ...joinedEventFixture,
        status: 'CANCELED',
      };
      mockGetEventDetail.mockResolvedValueOnce(canceledJoined);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.canLeave).toBe(false);
    });

    it('is false when event is completed', async () => {
      const completedJoined: EventDetail = {
        ...joinedEventFixture,
        status: 'COMPLETED',
      };
      mockGetEventDetail.mockResolvedValueOnce(completedJoined);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.canLeave).toBe(false);
    });

    it('is false when event end_time has passed', async () => {
      const pastEndJoined: EventDetail = {
        ...joinedEventFixture,
        start_time: '2020-01-01T08:00:00+03:00',
        end_time: '2020-01-01T12:00:00+03:00',
      };
      mockGetEventDetail.mockResolvedValueOnce(pastEndJoined);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.canLeave).toBe(false);
    });
  });

  // ─── handleLeaveEvent ───
  describe('handleLeaveEvent', () => {
    it('calls leaveEvent API, refreshes detail, and sets success_left for post-start leave', async () => {
      // Post-start event: start_time in the past, end_time in the future
      const postStartJoined: EventDetail = {
        ...joinedEventFixture,
        status: 'IN_PROGRESS',
        start_time: '2020-01-01T08:00:00+03:00',
        end_time: '2099-12-31T23:59:59+03:00',
      };
      const leavedEvent: EventDetail = {
        ...postStartJoined,
        viewer_context: {
          ...postStartJoined.viewer_context,
          participation_status: 'LEAVED',
        },
      };
      mockGetEventDetail
        .mockResolvedValueOnce(postStartJoined)
        .mockResolvedValueOnce(leavedEvent);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.handleLeaveEvent();
      });

      expect(mockLeaveEvent).toHaveBeenCalledWith('event-uuid-001', 'mock-token');
      expect(mockGetEventDetail).toHaveBeenCalledTimes(2);
      expect(result.current.participationStatus).toBe('LEAVED');
      expect(result.current.actionState).toBe('success_left');
      expect(result.current.actionError).toBeNull();
    });

    it('sets actionState to idle for pre-start leave (backend allows rejoin)', async () => {
      // Pre-start event: start_time in the future
      const noneAfterLeave: EventDetail = {
        ...publicEventFixture,
        viewer_context: {
          ...publicEventFixture.viewer_context,
          participation_status: 'NONE',
        },
      };
      mockGetEventDetail
        .mockResolvedValueOnce(joinedEventFixture)
        .mockResolvedValueOnce(noneAfterLeave);

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.participationStatus).toBe('JOINED');

      await act(async () => {
        await result.current.handleLeaveEvent();
      });

      expect(mockLeaveEvent).toHaveBeenCalledWith('event-uuid-001', 'mock-token');
      // Backend resets status to NONE for pre-start leave
      expect(result.current.participationStatus).toBe('NONE');
      expect(result.current.actionState).toBe('idle');
    });

    it('sets actionError with API message when leave fails', async () => {
      mockGetEventDetail.mockResolvedValueOnce(joinedEventFixture);
      mockLeaveEvent.mockRejectedValueOnce(
        new ApiError(409, {
          error: { code: 'event_not_leaveable', message: 'This event can no longer be left.' },
        }),
      );

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.handleLeaveEvent();
      });

      expect(result.current.actionState).toBe('idle');
      expect(result.current.actionError).toBe('This event can no longer be left.');
      expect(result.current.participationStatus).toBe('JOINED');
    });

    it('sets generic actionError on unknown leave failure', async () => {
      mockGetEventDetail.mockResolvedValueOnce(joinedEventFixture);
      mockLeaveEvent.mockRejectedValueOnce('something unexpected');

      const { result } = renderHook(() =>
        useEventDetailViewModel('event-uuid-001'),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.handleLeaveEvent();
      });

      expect(result.current.actionError).toBe('Failed to leave the event. Please try again.');
    });
  });
});
