/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import * as profileService from '@/services/profileService';
import * as invitationService from '@/services/invitationService';
import { ApiError } from '@/services/api';
import type {
  ProfileEventSummary,
  UserProfile,
} from '@/models/profile';
import { useProfileViewModel } from './useProfileViewModel';

jest.mock('@/services/profileService');
jest.mock('@/services/invitationService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '@/contexts/AuthContext';

const mockGetMyProfile = jest.mocked(profileService.getMyProfile);
const mockGetMyHostedEvents = jest.mocked(profileService.getMyHostedEvents);
const mockGetMyUpcomingEvents = jest.mocked(profileService.getMyUpcomingEvents);
const mockGetMyCompletedEvents = jest.mocked(profileService.getMyCompletedEvents);
const mockGetMyCanceledEvents = jest.mocked(profileService.getMyCanceledEvents);
const mockGetMyEquipment = jest.mocked(profileService.getMyEquipment);
const mockGetMyBadges = jest.mocked(profileService.getMyBadges);
const mockGetBadgeCatalog = jest.mocked(profileService.getBadgeCatalog);
const mockGetShowcaseImageUploadUrl = jest.mocked(profileService.getShowcaseImageUploadUrl);
const mockConfirmShowcaseImageUpload = jest.mocked(profileService.confirmShowcaseImageUpload);
const mockDeleteShowcaseImage = jest.mocked(profileService.deleteShowcaseImage);
const mockListMyInvitations = jest.mocked(invitationService.listMyInvitations);
const mockAcceptInvitation = jest.mocked(invitationService.acceptInvitation);
const mockDeclineInvitation = jest.mocked(invitationService.declineInvitation);
const mockUseAuth = jest.mocked(useAuth);

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function renderProfileViewModel() {
  const rendered = renderHook(() => useProfileViewModel());
  await act(async () => {
    await Promise.resolve();
  });
  return rendered;
}

const attendedUpcomingFixture: ProfileEventSummary = {
  id: 'attended-event-1',
  title: 'Board Game Night',
  image_url: 'https://example.com/events/attended.jpg',
  start_time: '2026-04-15T18:30:00Z',
  end_time: '2026-04-15T21:00:00Z',
  status: 'IN_PROGRESS',
  category: 'Social',
};

const attendedCompletedFixture: ProfileEventSummary = {
  id: 'attended-event-2',
  title: 'Museum Walk',
  image_url: 'https://example.com/events/completed.jpg',
  start_time: '2026-03-20T10:00:00Z',
  end_time: '2026-03-20T12:00:00Z',
  status: 'COMPLETED',
  category: 'Culture',
};

const attendedCanceledFixture: ProfileEventSummary = {
  id: 'attended-event-3',
  title: 'Open Air Cinema',
  image_url: 'https://example.com/events/canceled.jpg',
  start_time: '2026-03-18T19:00:00Z',
  end_time: '2026-03-18T22:00:00Z',
  status: 'CANCELED',
  category: 'Entertainment',
};

const hostedEventFixture: ProfileEventSummary = {
  id: 'hosted-event-1',
  title: 'Sunrise Hike',
  image_url: 'https://example.com/events/hosted.jpg',
  start_time: '2026-04-12T08:00:00Z',
  end_time: '2026-04-12T10:00:00Z',
  status: 'IN_PROGRESS',
  category: 'Outdoors',
};

const profileFixture: UserProfile = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  username: 'john_doe',
  email: 'john@example.com',
  phone_number: '+905551112233',
  gender: 'MALE',
  birth_date: '1998-05-14',
  email_verified: true,
  status: 'active',
  default_location_address: 'İstanbul, Turkey',
  default_location_lat: 41.0082,
  default_location_lon: 28.9784,
  display_name: 'John Doe',
  bio: 'Software developer based in Istanbul.',
  avatar_url: 'https://example.com/avatars/john.jpg',
  final_score: 4.2,
  host_score: {
    score: 4.7,
    rating_count: 12,
  },
  participant_score: {
    score: 3.8,
    rating_count: 9,
  },
  equipment: [],
  showcase_images: [],
  badges: [],
  locale: 'en',
};

const invitationFixture = {
  invitation_id: 'inv-1',
  status: 'PENDING' as const,
  event: {
    id: 'event-1',
    title: 'Private Picnic',
    start_time: '2026-05-10T10:00:00Z',
    image_url: null,
  },
  host: {
    username: 'host_user',
    display_name: 'Host User',
    profile_image_url: null,
  },
  message: 'Join us!',
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-01T10:00:00Z',
};

const invitationsResponse = {
  pending: [invitationFixture],
  past: {
    items: [],
    page_info: { next_cursor: null, has_next: false },
  },
};

describe('useProfileViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: 'test-token',
      refreshToken: 'refresh',
      user: null,
      setSession: jest.fn(),
      clearAuth: jest.fn(),
    } as any);
    mockGetMyProfile.mockResolvedValue(profileFixture);
    mockGetMyHostedEvents.mockResolvedValue({
      events: [{ ...hostedEventFixture, privacy_level: 'PUBLIC' }],
    });
    mockGetMyUpcomingEvents.mockResolvedValue({
      events: [{ ...attendedUpcomingFixture, privacy_level: 'PROTECTED' }],
    });
    mockGetMyCompletedEvents.mockResolvedValue({
      events: [{ ...attendedCompletedFixture, privacy_level: 'PUBLIC' }],
    });
    mockGetMyCanceledEvents.mockResolvedValue({
      events: [{ ...attendedCanceledFixture, privacy_level: 'PUBLIC' }],
    });
    mockGetMyEquipment.mockResolvedValue({
      items: [{ id: 'eq-1', name: 'Tent', description: '2-person', image_url: null }],
    });
    mockGetMyBadges.mockResolvedValue({
      items: [
        { 
          id: 'badge-1', 
          name: 'Super Host', 
          slug: 'SUPER_HOST', 
          earned: true, 
          earned_at: '2026-02-01T12:00:00Z',
          description: 'Excellent hosting',
          category: 'HOSTING',
          icon_url: null
        }
      ]
    });
    mockGetBadgeCatalog.mockResolvedValue({
      items: [
        { 
          id: 'badge-1', 
          name: 'Super Host', 
          slug: 'SUPER_HOST', 
          earned: false, 
          earned_at: null,
          description: 'Excellent hosting',
          category: 'HOSTING',
          icon_url: null,
          progress_hint: 'Earned by participating in one event'
        }
      ]
    });
    mockListMyInvitations.mockResolvedValue(invitationsResponse as any);
    mockAcceptInvitation.mockResolvedValue({} as any);
    mockDeclineInvitation.mockResolvedValue({} as any);
  });

  it('starts in loading state', () => {
    const deferredProfile = createDeferred<UserProfile>();
    const deferredHosted = createDeferred<{ events: ProfileEventSummary[] }>();
    const deferredUpcoming = createDeferred<{ events: ProfileEventSummary[] }>();
    const deferredCompleted = createDeferred<{ events: ProfileEventSummary[] }>();
    const deferredCanceled = createDeferred<{ events: ProfileEventSummary[] }>();
    mockGetMyProfile.mockReturnValue(deferredProfile.promise);
    mockGetMyHostedEvents.mockReturnValue(deferredHosted.promise);
    mockGetMyUpcomingEvents.mockReturnValue(deferredUpcoming.promise);
    mockGetMyCompletedEvents.mockReturnValue(deferredCompleted.promise);
    mockGetMyCanceledEvents.mockReturnValue(deferredCanceled.promise);

    const { result } = renderHook(() => useProfileViewModel());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.profile).toBeNull();
    expect(result.current.apiError).toBeNull();
  });

  it('fetches and exposes profile data on mount', async () => {
    const { result } = await renderProfileViewModel();

    expect(mockGetMyProfile).toHaveBeenCalledWith('test-token');
    expect(mockGetMyHostedEvents).toHaveBeenCalledWith('test-token');
    expect(mockGetMyUpcomingEvents).toHaveBeenCalledWith('test-token');
    expect(mockGetMyCompletedEvents).toHaveBeenCalledWith('test-token');
    expect(mockGetMyCanceledEvents).toHaveBeenCalledWith('test-token');
    expect(mockListMyInvitations).toHaveBeenCalledWith('test-token');
    expect(result.current.profile).toEqual(profileFixture);
    expect(result.current.equipment).toHaveLength(1);
    expect(result.current.invitations).toEqual([invitationFixture]);
    expect(result.current.invitationCount).toBe(1);
    expect(result.current.badges).toHaveLength(1);
    expect(result.current.apiError).toBeNull();
  });

  it('derives primaryName from display_name when set', async () => {
    const { result } = await renderProfileViewModel();

    expect(result.current.primaryName).toBe('John Doe');
    expect(result.current.secondaryName).toBe('john_doe');
    expect(result.current.avatarInitial).toBe('J');
    expect(result.current.overallRatingLabel).toBe('4.2');
    expect(result.current.hostRatingLabel).toBe('4.7');
    expect(result.current.participantRatingLabel).toBe('3.8');
  });

  it('derives primaryName from username when display_name is null', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...profileFixture,
      display_name: null,
      final_score: null,
      host_score: null,
    });

    const { result } = await renderProfileViewModel();

    expect(result.current.primaryName).toBe('john_doe');
    expect(result.current.secondaryName).toBeNull();
    expect(result.current.avatarInitial).toBe('J');
  });

  it('exposes hosted and attended event lists', async () => {
    const { result } = await renderProfileViewModel();

    expect(result.current.hostedEvents).toEqual([
      {
        id: 'hosted-event-1',
        title: 'Sunrise Hike',
        start_time: '2026-04-12T08:00:00Z',
        end_time: '2026-04-12T10:00:00Z',
        image_url: 'https://example.com/events/hosted.jpg',
        category_label: 'Outdoors',
        status: 'IN_PROGRESS',
        privacy_level: 'PUBLIC',
      },
    ]);
    expect(result.current.attendedEvents).toEqual([
      {
        id: 'attended-event-1',
        title: 'Board Game Night',
        start_time: '2026-04-15T18:30:00Z',
        end_time: '2026-04-15T21:00:00Z',
        image_url: 'https://example.com/events/attended.jpg',
        category_label: 'Social',
        status: 'IN_PROGRESS',
        privacy_level: 'PROTECTED',
      },
      {
        id: 'attended-event-2',
        title: 'Museum Walk',
        start_time: '2026-03-20T10:00:00Z',
        end_time: '2026-03-20T12:00:00Z',
        image_url: 'https://example.com/events/completed.jpg',
        category_label: 'Culture',
        status: 'COMPLETED',
        privacy_level: 'PUBLIC',
      },
      {
        id: 'attended-event-3',
        title: 'Open Air Cinema',
        start_time: '2026-03-18T19:00:00Z',
        end_time: '2026-03-18T22:00:00Z',
        image_url: 'https://example.com/events/canceled.jpg',
        category_label: 'Entertainment',
        status: 'CANCELED',
        privacy_level: 'PUBLIC',
      },
    ]);
    expect(result.current.hostedCount).toBe(1);
    expect(result.current.attendedCount).toBe(3);
  });

  it('falls back to New when final_score is missing', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...profileFixture,
      final_score: null,
    });

    const { result } = await renderProfileViewModel();

    expect(result.current.overallRatingLabel).toBe('New');
    expect(result.current.hostRatingLabel).toBe('4.7');
    expect(result.current.participantRatingLabel).toBe('3.8');
  });

  it('deduplicates attended events returned by multiple endpoints', async () => {
    mockGetMyUpcomingEvents.mockResolvedValue({ events: [attendedUpcomingFixture] });
    mockGetMyCompletedEvents.mockResolvedValue({
      events: [attendedUpcomingFixture, attendedCompletedFixture],
    });

    const { result } = await renderProfileViewModel();

    expect(result.current.attendedEvents.map((event) => event.id)).toEqual([
      'attended-event-1',
      'attended-event-2',
      'attended-event-3',
    ]);
  });

  it('excludes hosted events from the attended tab', async () => {
    mockGetMyUpcomingEvents.mockResolvedValue({
      events: [
        hostedEventFixture,
        attendedUpcomingFixture,
      ],
    });

    const { result } = await renderProfileViewModel();

    expect(result.current.hostedEvents.map((event) => event.id)).toEqual([
      'hosted-event-1',
    ]);
    expect(result.current.attendedEvents.map((event) => event.id)).toEqual([
      'attended-event-1',
      'attended-event-2',
      'attended-event-3',
    ]);
  });

  it('filters ACTIVE events out of the hosted and attended tabs', async () => {
    mockGetMyHostedEvents.mockResolvedValue({
      events: [
        { ...hostedEventFixture, status: 'ACTIVE' },
        { ...hostedEventFixture, id: 'hosted-event-2', status: 'CANCELED' },
      ],
    });
    mockGetMyUpcomingEvents.mockResolvedValue({
      events: [
        { ...attendedUpcomingFixture, id: 'attended-event-active', status: 'ACTIVE' },
        attendedUpcomingFixture,
      ],
    });

    const { result } = await renderProfileViewModel();

    expect(result.current.hostedEvents.map((event) => event.status)).toEqual([
      'CANCELED',
    ]);
    expect(result.current.attendedEvents.map((event) => event.status)).toEqual([
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELED',
    ]);
  });

  it('treats zero-value backend end times as missing', async () => {
    mockGetMyHostedEvents.mockResolvedValue({
      events: [
        {
          ...hostedEventFixture,
          id: 'hosted-event-3',
          end_time: '0001-01-01T00:00:00Z',
        },
      ],
    });

    const { result } = await renderProfileViewModel();

    expect(result.current.hostedEvents[0]?.end_time).toBeNull();
  });

  it('sets apiError on API failure', async () => {
    mockGetMyProfile.mockRejectedValue(
      new ApiError(500, {
        error: {
          code: 'internal_error',
          message: 'Something went wrong.',
        },
      }),
    );

    const { result } = await renderProfileViewModel();

    expect(result.current.apiError).toBe('Something went wrong.');
    expect(result.current.profile).toBeNull();
  });

  it('sets generic error on unexpected failure', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('Network failure'));

    const { result } = await renderProfileViewModel();

    expect(result.current.apiError).toBe(
      'Failed to load profile. Please try again.',
    );
  });

  it('sets error when token is null', async () => {
    mockUseAuth.mockReturnValue({
      token: null,
      refreshToken: null,
      user: null,
      setSession: jest.fn(),
      clearAuth: jest.fn(),
    } as any);

    const { result } = await renderProfileViewModel();

    expect(result.current.apiError).toBe(
      'You must be logged in to view your profile.',
    );
    expect(result.current.profile).toBeNull();
    expect(mockGetMyProfile).not.toHaveBeenCalled();
    expect(mockGetMyHostedEvents).not.toHaveBeenCalled();
    expect(mockGetMyUpcomingEvents).not.toHaveBeenCalled();
    expect(mockGetMyCompletedEvents).not.toHaveBeenCalled();
    expect(mockGetMyCanceledEvents).not.toHaveBeenCalled();
    expect(mockListMyInvitations).not.toHaveBeenCalled();
  });

  it('can refresh profile data', async () => {
    const { result } = await renderProfileViewModel();

    const updatedProfile = {
      ...profileFixture,
      display_name: 'Jane Doe',
    };
    mockGetMyProfile.mockResolvedValue(updatedProfile);
    mockGetMyHostedEvents.mockResolvedValue({ events: [hostedEventFixture] });
    mockGetMyUpcomingEvents.mockResolvedValue({ events: [attendedUpcomingFixture] });
    mockGetMyCompletedEvents.mockResolvedValue({ events: [attendedCompletedFixture] });
    mockGetMyCanceledEvents.mockResolvedValue({ events: [attendedCanceledFixture] });

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetMyProfile).toHaveBeenCalledTimes(2);
    expect(result.current.profile?.display_name).toBe('Jane Doe');
    expect(result.current.primaryName).toBe('Jane Doe');
  });

  it('keeps profile usable when invitations fail to load', async () => {
    mockListMyInvitations.mockRejectedValueOnce(
      new ApiError(500, {
        error: {
          code: 'internal_error',
          message: 'Invitations unavailable.',
        },
      }),
    );

    const { result } = await renderProfileViewModel();

    expect(result.current.profile).toEqual(profileFixture);
    expect(result.current.invitations).toEqual([]);
    expect(result.current.invitationError).toBe('Invitations unavailable.');
    expect(result.current.apiError).toBeNull();
  });

  it('handles accepting an invitation from profile', async () => {
    mockListMyInvitations
      .mockResolvedValueOnce(invitationsResponse as any)
      .mockResolvedValueOnce({
        pending: [],
        past: { items: [], page_info: { next_cursor: null, has_next: false } },
      } as any);

    const { result } = await renderProfileViewModel();

    await act(async () => {
      await result.current.handleAcceptInvitation('inv-1');
    });

    expect(mockAcceptInvitation).toHaveBeenCalledWith('inv-1', 'test-token');
    expect(result.current.invitations).toEqual([]);
    expect(mockGetMyProfile).toHaveBeenCalledTimes(2);
  });

  it('handles declining an invitation from profile', async () => {
    const { result } = await renderProfileViewModel();

    await act(async () => {
      await result.current.handleDeclineInvitation('inv-1');
    });

    expect(mockDeclineInvitation).toHaveBeenCalledWith('inv-1', 'test-token');
    expect(result.current.invitations).toEqual([]);
  });

  it('handles equipment addition', async () => {
    const { result } = await renderProfileViewModel();
    const mockCreate = jest.mocked(profileService.createEquipment);
    mockCreate.mockResolvedValue({ id: 'eq-2', name: 'Boots', description: 'Hiking boots', image_url: null });

    await act(async () => {
      await result.current.addEquipment('Boots', 'Hiking boots');
    });

    expect(mockCreate).toHaveBeenCalledWith({ name: 'Boots', description: 'Hiking boots' }, 'test-token');
    expect(mockGetMyEquipment).toHaveBeenCalledTimes(2);
  });

  it('handles equipment editing', async () => {
    const { result } = await renderProfileViewModel();
    const mockUpdate = jest.mocked(profileService.updateEquipment);
    mockUpdate.mockResolvedValue({ id: 'eq-1', name: 'Tent Updated', description: '3-person', image_url: null });

    await act(async () => {
      await result.current.editEquipment('eq-1', 'Tent Updated', '3-person');
    });

    expect(mockUpdate).toHaveBeenCalledWith('eq-1', { name: 'Tent Updated', description: '3-person' }, 'test-token');
    expect(mockGetMyEquipment).toHaveBeenCalledTimes(2);
  });

  it('handles equipment deletion', async () => {
    const { result } = await renderProfileViewModel();
    const mockDelete = jest.mocked(profileService.deleteEquipment);
    mockDelete.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.removeEquipment('eq-1');
    });

    expect(mockDelete).toHaveBeenCalledWith('eq-1', 'test-token');
    expect(mockGetMyEquipment).toHaveBeenCalledTimes(2);
  });

  it('handles showcase image deletion', async () => {
    const { result } = await renderProfileViewModel();
    mockDeleteShowcaseImage.mockResolvedValue(undefined);

    await act(async () => {
      await result.current.removeShowcaseImage('img-1');
    });

    expect(mockDeleteShowcaseImage).toHaveBeenCalledWith('img-1', 'test-token');
    // It should refresh profile which currently loads showcase images
    expect(mockGetMyProfile).toHaveBeenCalledTimes(2);
  });
});
