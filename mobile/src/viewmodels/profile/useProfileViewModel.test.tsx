/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import * as profileService from '@/services/profileService';
import { ApiError } from '@/services/api';
import type {
  ProfileEventSummary,
  UserProfile,
} from '@/models/profile';
import { useProfileViewModel } from './useProfileViewModel';

jest.mock('@/services/profileService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '@/contexts/AuthContext';

const mockGetMyProfile = jest.mocked(profileService.getMyProfile);
const mockGetMyHostedEvents = jest.mocked(profileService.getMyHostedEvents);
const mockGetMyUpcomingEvents = jest.mocked(profileService.getMyUpcomingEvents);
const mockGetMyCompletedEvents = jest.mocked(profileService.getMyCompletedEvents);
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
  status: 'PUBLISHED',
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

const hostedEventFixture: ProfileEventSummary = {
  id: 'hosted-event-1',
  title: 'Sunrise Hike',
  image_url: 'https://example.com/events/hosted.jpg',
  start_time: '2026-04-12T08:00:00Z',
  end_time: '2026-04-12T10:00:00Z',
  status: 'PUBLISHED',
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
    mockGetMyHostedEvents.mockResolvedValue({ events: [hostedEventFixture] });
    mockGetMyUpcomingEvents.mockResolvedValue({ events: [attendedUpcomingFixture] });
    mockGetMyCompletedEvents.mockResolvedValue({ events: [attendedCompletedFixture] });
  });

  it('starts in loading state', () => {
    const deferredProfile = createDeferred<UserProfile>();
    const deferredHosted = createDeferred<{ events: ProfileEventSummary[] }>();
    const deferredUpcoming = createDeferred<{ events: ProfileEventSummary[] }>();
    const deferredCompleted = createDeferred<{ events: ProfileEventSummary[] }>();
    mockGetMyProfile.mockReturnValue(deferredProfile.promise);
    mockGetMyHostedEvents.mockReturnValue(deferredHosted.promise);
    mockGetMyUpcomingEvents.mockReturnValue(deferredUpcoming.promise);
    mockGetMyCompletedEvents.mockReturnValue(deferredCompleted.promise);

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
    expect(result.current.profile).toEqual(profileFixture);
    expect(result.current.apiError).toBeNull();
  });

  it('derives primaryName from display_name when set', async () => {
    const { result } = await renderProfileViewModel();

    expect(result.current.primaryName).toBe('John Doe');
    expect(result.current.secondaryName).toBe('john_doe');
    expect(result.current.avatarInitial).toBe('J');
  });

  it('derives primaryName from username when display_name is null', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...profileFixture,
      display_name: null,
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
      },
      {
        id: 'attended-event-2',
        title: 'Museum Walk',
        start_time: '2026-03-20T10:00:00Z',
        end_time: '2026-03-20T12:00:00Z',
        image_url: 'https://example.com/events/completed.jpg',
        category_label: 'Culture',
      },
    ]);
    expect(result.current.hostedCount).toBe(1);
    expect(result.current.attendedCount).toBe(2);
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

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetMyProfile).toHaveBeenCalledTimes(2);
    expect(result.current.profile?.display_name).toBe('Jane Doe');
    expect(result.current.primaryName).toBe('Jane Doe');
  });
});
