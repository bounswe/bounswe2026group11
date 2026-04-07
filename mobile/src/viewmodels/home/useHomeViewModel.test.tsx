/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import * as deviceLocationService from '@/services/deviceLocationService';
import * as eventService from '@/services/eventService';
import * as favoriteService from '@/services/favoriteService';
import * as profileService from '@/services/profileService';
import type {
  ListCategoriesResponse,
  PaginatedEventsResponse,
} from '@/models/event';
import { __resetHomeLocationSelectionStoreForTests } from '@/services/homeLocationSelectionStore';
import { useHomeViewModel } from './useHomeViewModel';

jest.mock('@/services/deviceLocationService');
jest.mock('@/services/eventService');
jest.mock('@/services/favoriteService');
jest.mock('@/services/profileService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    refreshToken: 'mock-refresh-token',
    setSession: jest.fn(),
    clearAuth: jest.fn(),
  }),
}));

const mockGetCurrentLocationSuggestion = jest.mocked(
  deviceLocationService.getCurrentLocationSuggestion,
);
const mockListEvents = jest.mocked(eventService.listEvents);
const mockListCategories = jest.mocked(eventService.listCategories);
const mockSearchLocation = jest.mocked(eventService.searchLocation);
const mockListFavoriteLocations = jest.mocked(favoriteService.listFavoriteLocations);
const mockGetMyProfile = jest.mocked(profileService.getMyProfile);

const categoriesFixture: ListCategoriesResponse = {
  items: [
    { id: 1, name: 'Sports' },
    { id: 2, name: 'Music' },
    { id: 4, name: 'Technology' },
  ],
};

const page1Fixture: PaginatedEventsResponse = {
  items: [
    {
      id: '1',
      title: 'Summer Night Jazz Concert',
      category_name: 'Music',
      image_url: null,
      start_time: '2026-03-29T20:30:00+03:00',
      location_address: 'Brooklyn Bridge Park',
      privacy_level: 'PUBLIC',
      approved_participant_count: 96,
      is_favorited: true,
      host_score: {
        final_score: 4.7,
        hosted_event_rating_count: 12,
      },
      capacity: 150,
      favorite_count: 72,
    },
    {
      id: '2',
      title: 'AI for Product Managers Workshop',
      category_name: 'Technology',
      image_url: null,
      start_time: '2026-03-30T18:00:00+03:00',
      location_address: 'SoHo Tech Hub',
      privacy_level: 'PROTECTED',
      approved_participant_count: 41,
      is_favorited: false,
      host_score: {
        final_score: null,
        hosted_event_rating_count: 0,
      },
      capacity: 60,
      favorite_count: 35,
    },
  ],
  page_info: {
    next_cursor: 'cursor-2',
    has_next: true,
  },
};

const page2Fixture: PaginatedEventsResponse = {
  items: [
    {
      id: '3',
      title: 'Creative Writing Bootcamp',
      category_name: 'Education',
      image_url: null,
      start_time: '2026-03-31T13:00:00+03:00',
      location_address: 'NY Public Library',
      privacy_level: 'PUBLIC',
      approved_participant_count: 58,
      is_favorited: false,
      host_score: {
        final_score: 4.6,
        hosted_event_rating_count: 8,
      },
      capacity: 80,
      favorite_count: 22,
    },
  ],
  page_info: {
    next_cursor: null,
    has_next: false,
  },
};

const defaultFallbackListEventsQuery = {
  lat: 41.0422,
  lon: 29.0083,
  radius_meters: 10000,
  q: undefined,
  category_ids: undefined,
  privacy_levels: undefined,
  start_from: undefined,
  start_to: undefined,
  sort_by: 'START_TIME',
  limit: 2,
  cursor: undefined,
};

describe('useHomeViewModel', () => {
    beforeEach(() => {
    jest.clearAllMocks();
    __resetHomeLocationSelectionStoreForTests();
    mockListCategories.mockResolvedValue(categoriesFixture);
    mockListEvents.mockResolvedValue(page1Fixture);
    mockListFavoriteLocations.mockResolvedValue({
      items: [
        {
          id: 'favorite-2',
          name: 'Gym',
          address: 'Besiktas, Istanbul, Turkiye',
          lat: 41.0430,
          lon: 29.0095,
        },
        {
          id: 'favorite-1',
          name: 'Home',
          address: 'Kadikoy, Istanbul, Turkiye',
          lat: 40.9909,
          lon: 29.0293,
        },
      ],
    });
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      username: 'mock',
      email: 'mock@example.com',
      phone_number: null,
      gender: null,
      birth_date: null,
      email_verified: true,
      status: 'active',
      default_location_address: null,
      default_location_lat: null,
      default_location_lon: null,
      display_name: null,
      bio: null,
      avatar_url: null,
    });
    mockGetCurrentLocationSuggestion.mockResolvedValue(null);
    mockSearchLocation.mockResolvedValue([
      {
        display_name: 'Kadikoy, Istanbul, Turkiye',
        lat: '40.9909',
        lon: '29.0293',
      },
      {
        display_name: 'Besiktas, Istanbul, Turkiye',
        lat: '41.0430',
        lon: '29.0095',
      },
    ]);
  });

  it('loads initial categories and events on mount', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockListCategories).toHaveBeenCalledTimes(1);
    expect(mockListEvents).toHaveBeenCalledWith(
      defaultFallbackListEventsQuery,
      'mock-token',
    );

    expect(result.current.categories).toEqual(categoriesFixture.items);
    expect(result.current.events).toEqual(page1Fixture.items);
    expect(result.current.hasMore).toBe(true);
  });

  it('prefers the live location over the profile default when both are available', async () => {
    mockGetCurrentLocationSuggestion.mockResolvedValueOnce({
      display_name: 'Moda, Kadikoy, Istanbul, Turkiye',
      lat: '40.9869',
      lon: '29.0287',
    });
    mockGetMyProfile.mockResolvedValueOnce({
      id: 'user-1',
      username: 'mock',
      email: 'mock@example.com',
      phone_number: null,
      gender: null,
      birth_date: null,
      email_verified: true,
      status: 'active',
      default_location_address: 'Kadikoy, Istanbul, Turkiye',
      default_location_lat: 40.9909,
      default_location_lon: 29.0293,
      display_name: null,
      bio: null,
      avatar_url: null,
    });

    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.defaultLocationOption.subtitle).toBe(
      'Current location: Moda, Kadikoy, Istanbul, Turkiye',
    );
    expect(result.current.defaultLocationOption.isLoading).toBe(false);
    expect(mockListEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: 40.9869,
        lon: 29.0287,
      }),
      'mock-token',
    );
    expect(result.current.locationLabel).toBe('Moda, Kadikoy');
  });

  it('uses the profile default location when live location is unavailable', async () => {
    mockGetMyProfile.mockResolvedValueOnce({
      id: 'user-1',
      username: 'mock',
      email: 'mock@example.com',
      phone_number: null,
      gender: null,
      birth_date: null,
      email_verified: true,
      status: 'active',
      default_location_address: 'Kadikoy, Istanbul, Turkiye',
      default_location_lat: 40.9909,
      default_location_lon: 29.0293,
      display_name: null,
      bio: null,
      avatar_url: null,
    });

    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetCurrentLocationSuggestion).toHaveBeenCalledTimes(1);
    expect(result.current.defaultLocationOption.subtitle).toBe(
      'Kadikoy, Istanbul, Turkiye',
    );
    expect(result.current.defaultLocationOption.isLoading).toBe(false);
    expect(mockListEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: 40.9909,
        lon: 29.0293,
      }),
      'mock-token',
    );
    expect(result.current.locationLabel).toContain('Kadikoy');
  });

  it('keeps showing the resolved default location after silent refresh', async () => {
    const profileDefault = {
      id: 'user-1',
      username: 'mock',
      email: 'mock@example.com',
      phone_number: null,
      gender: null,
      birth_date: null,
      email_verified: true,
      status: 'active',
      default_location_address: 'Kadikoy, Istanbul, Turkiye',
      default_location_lat: 40.9909,
      default_location_lon: 29.0293,
      display_name: null,
      bio: null,
      avatar_url: null,
    };

    mockGetMyProfile
      .mockResolvedValueOnce(profileDefault)
      .mockResolvedValue(profileDefault);

    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.silentRefresh();
    });

    expect(result.current.defaultLocationOption.subtitle).toBe(
      'Kadikoy, Istanbul, Turkiye',
    );
    expect(result.current.defaultLocationOption.isLoading).toBe(false);
  });

  it('requests the live location when no profile default exists and uses it when available', async () => {
    mockGetCurrentLocationSuggestion.mockResolvedValueOnce({
      display_name: 'Moda, Kadikoy, Istanbul, Turkiye',
      lat: '40.9869',
      lon: '29.0287',
    });

    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetCurrentLocationSuggestion).toHaveBeenCalledTimes(1);
    expect(mockGetMyProfile).not.toHaveBeenCalled();
    expect(mockListEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: 40.9869,
        lon: 29.0287,
      }),
      'mock-token',
    );
    expect(result.current.locationLabel).toBe('Moda, Kadikoy');
    expect(result.current.defaultLocationOption.subtitle).toContain(
      'Current location:',
    );
  });

  it('loads favorite location options alphabetically and limits them to three items', async () => {
    mockListFavoriteLocations.mockResolvedValueOnce({
      items: [
        {
          id: 'favorite-3',
          name: 'Office',
          address: 'Levent, Istanbul, Turkiye',
          lat: 41.0827,
          lon: 29.0112,
        },
        {
          id: 'favorite-4',
          name: 'Airport',
          address: 'Arnavutkoy, Istanbul, Turkiye',
          lat: 41.2753,
          lon: 28.7519,
        },
        {
          id: 'favorite-2',
          name: 'Gym',
          address: 'Besiktas, Istanbul, Turkiye',
          lat: 41.0430,
          lon: 29.0095,
        },
        {
          id: 'favorite-1',
          name: 'Home',
          address: 'Kadikoy, Istanbul, Turkiye',
          lat: 40.9909,
          lon: 29.0293,
        },
      ],
    });

    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.isLoadingFavoriteLocations).toBe(false);
    });

    expect(result.current.favoriteLocationOptions.map((option) => option.title)).toEqual([
      'Airport',
      'Gym',
      'Home',
    ]);
  });

  it('updates search text', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await act(async () => {
      result.current.updateSearchText('music');
    });

    expect(result.current.searchText).toBe('music');
  });

  it('updates selected category id', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await act(async () => {
      result.current.selectCategory(2);
    });

    expect(result.current.selectedCategoryId).toBe(2);
  });

  it('refreshes events from the first page', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockListEvents.mockResolvedValueOnce({
      items: [page1Fixture.items[0]],
      page_info: {
        next_cursor: null,
        has_next: false,
      },
    });

    await act(async () => {
      await result.current.refreshEvents();
    });

    expect(mockListEvents).toHaveBeenLastCalledWith(
      defaultFallbackListEventsQuery,
      'mock-token',
    );

    expect(result.current.events).toHaveLength(1);
    expect(result.current.hasMore).toBe(false);
  });

  it('loads more events and appends them', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockListEvents.mockResolvedValueOnce(page2Fixture);

    await act(async () => {
      await result.current.loadMoreEvents();
    });

    expect(mockListEvents).toHaveBeenLastCalledWith(
      {
        ...defaultFallbackListEventsQuery,
        cursor: 'cursor-2',
      },
      'mock-token',
    );

    expect(result.current.events).toHaveLength(3);
    expect(result.current.events[2].id).toBe('3');
    expect(result.current.hasMore).toBe(false);
  });

  it('sets apiError when loading events fails', async () => {
    mockListEvents.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.apiError).toBe(
      'Failed to load events. Please try again.',
    );
  });

  it('sets apiError when loading categories fails', async () => {
    mockListCategories.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.apiError).toBe(
        'Failed to load categories. Please try again.',
      );
    });
  });
    describe('discovery filters', () => {
    it('opens and closes filter modal', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isFilterModalOpen).toBe(false);

      act(() => {
        result.current.openFilterModal();
      });

      expect(result.current.isFilterModalOpen).toBe(true);

      act(() => {
        result.current.closeFilterModal();
      });

      expect(result.current.isFilterModalOpen).toBe(false);
    });

    it('does not apply draft filters until apply is pressed', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockListEvents).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.openFilterModal();
      });

      act(() => {
        result.current.toggleDraftPrivacy('PROTECTED');
        result.current.updateDraftRadiusKm(25);
      });

      await waitFor(() => {
        expect(result.current.filterDraft.privacyLevels).toEqual(['PROTECTED']);
        expect(result.current.filterDraft.radiusKm).toBe(25);
      });

      expect(mockListEvents).toHaveBeenCalledTimes(1);
    });

    it('uses START_TIME as the default sort order', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.filterDraft.sortBy).toBe('START_TIME');
      expect(mockListEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          sort_by: 'START_TIME',
        }),
        'mock-token',
      );
    });

    it('applies DISTANCE sorting to the discovery request', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openFilterModal();
      });

      act(() => {
        result.current.updateDraftSortBy('DISTANCE');
      });

      expect(result.current.filterDraft.sortBy).toBe('DISTANCE');

      act(() => {
        result.current.applyFilterDraft();
      });

      await waitFor(() => {
        expect(mockListEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            sort_by: 'DISTANCE',
          }),
          'mock-token',
        );
      });
    });

    it('applies privacy and radius filters to discovery request', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openFilterModal();
      });

      act(() => {
        result.current.toggleDraftPrivacy('PROTECTED');
        result.current.updateDraftRadiusKm(25);
      });

      await waitFor(() => {
        expect(result.current.filterDraft.privacyLevels).toEqual(['PROTECTED']);
        expect(result.current.filterDraft.radiusKm).toBe(25);
      });

      act(() => {
        result.current.applyFilterDraft();
      });

      await waitFor(() => {
        expect(mockListEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            privacy_levels: ['PROTECTED'],
            radius_meters: 25000,
          }),
          'mock-token',
        );
      });
    });

    it('applies category filters from modal to discovery request', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openFilterModal();
      });

      act(() => {
        result.current.toggleDraftCategory(2);
      });

      await waitFor(() => {
        expect(result.current.filterDraft.categoryIds).toEqual([2]);
      });

      act(() => {
        result.current.applyFilterDraft();
      });

      await waitFor(() => {
        expect(mockListEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            category_ids: [2],
          }),
          'mock-token',
        );
      });
    });

    it('keeps selected chip category together with modal categories', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.selectCategory(1);
      });

      await waitFor(() => {
        expect(mockListEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            category_ids: [1],
          }),
          'mock-token',
        );
      });

      act(() => {
        result.current.openFilterModal();
      });

      act(() => {
        result.current.toggleDraftCategory(2);
      });

      await waitFor(() => {
        expect(result.current.filterDraft.categoryIds).toEqual([2]);
      });

      act(() => {
        result.current.applyFilterDraft();
      });

      await waitFor(() => {
        expect(mockListEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            category_ids: expect.arrayContaining([1, 2]),
          }),
          'mock-token',
        );
      });
    });

    it('applies valid date range filters', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openFilterModal();
      });

      act(() => {
        result.current.updateDraftStartDate('10.04.2099');
        result.current.updateDraftEndDate('20.04.2099');
      });

      await waitFor(() => {
        expect(result.current.filterDraft.startDate).toBe('10.04.2099');
        expect(result.current.filterDraft.endDate).toBe('20.04.2099');
      });

      act(() => {
        result.current.applyFilterDraft();
      });

      await waitFor(() => {
        expect(mockListEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            start_from: expect.any(String),
            start_to: expect.any(String),
          }),
          'mock-token',
        );
      });

      const lastArgs = mockListEvents.mock.calls.at(-1)?.[0];

      if (!lastArgs?.start_from || !lastArgs?.start_to) {
        throw new Error('Expected start_from and start_to to be defined');
      }

      expect(new Date(lastArgs.start_from).toISOString()).toBe(lastArgs.start_from);
      expect(new Date(lastArgs.start_to).toISOString()).toBe(lastArgs.start_to);
    });

    it('shows error for invalid from date and does not apply filters', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockListEvents.mock.calls.length;

      act(() => {
        result.current.openFilterModal();
      });

      act(() => {
        result.current.updateDraftStartDate('12.30.2026');
      });

      await waitFor(() => {
        expect(result.current.filterDraft.startDate).toBe('12.30.2026');
      });

      act(() => {
        result.current.applyFilterDraft();
      });

      await waitFor(() => {
        expect(result.current.filterError).toBe('From date must be a valid date.');
      });

      expect(mockListEvents.mock.calls.length).toBe(initialCallCount);
      expect(result.current.isFilterModalOpen).toBe(true);
    });

    it('shows error for invalid to date and does not apply filters', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockListEvents.mock.calls.length;

      act(() => {
        result.current.openFilterModal();
      });

      act(() => {
        result.current.updateDraftEndDate('31.02.2026');
      });

      await waitFor(() => {
        expect(result.current.filterDraft.endDate).toBe('31.02.2026');
      });

      act(() => {
        result.current.applyFilterDraft();
      });

      await waitFor(() => {
        expect(result.current.filterError).toBe('To date must be a valid date.');
      });

      expect(mockListEvents.mock.calls.length).toBe(initialCallCount);
      expect(result.current.isFilterModalOpen).toBe(true);
    });

    it('shows error when from date is in the past', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openFilterModal();
      });

      act(() => {
        result.current.updateDraftStartDate('01.01.2000');
      });

      await waitFor(() => {
        expect(result.current.filterDraft.startDate).toBe('01.01.2000');
      });

      act(() => {
        result.current.applyFilterDraft();
      });

      await waitFor(() => {
        expect(result.current.filterError).toBe('From date must be today or later.');
      });

      expect(result.current.isFilterModalOpen).toBe(true);
    });

    it('shows error when to date is earlier than from date', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openFilterModal();
      });

      act(() => {
        result.current.updateDraftStartDate('20.04.2099');
        result.current.updateDraftEndDate('10.04.2099');
      });

      await waitFor(() => {
        expect(result.current.filterDraft.startDate).toBe('20.04.2099');
        expect(result.current.filterDraft.endDate).toBe('10.04.2099');
      });

      act(() => {
        result.current.applyFilterDraft();
      });

      await waitFor(() => {
        expect(result.current.filterError).toBe(
          'To date must be the same as or later than From date.',
        );
      });

      expect(result.current.isFilterModalOpen).toBe(true);
    });

    it('resets draft filters and keeps modal open on reset', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openFilterModal();
      });

      act(() => {
        result.current.updateDraftSortBy('DISTANCE');
        result.current.toggleDraftPrivacy('PROTECTED');
        result.current.updateDraftStartDate('10.04.2099');
        result.current.updateDraftEndDate('20.04.2099');
        result.current.updateDraftRadiusKm(30);
      });

      await waitFor(() => {
        expect(result.current.filterDraft.sortBy).toBe('DISTANCE');
        expect(result.current.filterDraft.privacyLevels).toEqual(['PROTECTED']);
        expect(result.current.filterDraft.startDate).toBe('10.04.2099');
        expect(result.current.filterDraft.endDate).toBe('20.04.2099');
        expect(result.current.filterDraft.radiusKm).toBe(30);
      });

      const initialCallCount = mockListEvents.mock.calls.length;

      act(() => {
        result.current.resetFilterDraft();
      });

      expect(result.current.isFilterModalOpen).toBe(true);
      expect(result.current.filterDraft).toEqual({
        categoryIds: [],
        privacyLevels: [],
        startDate: '',
        endDate: '',
        radiusKm: 10,
        sortBy: 'START_TIME',
      });

      expect(mockListEvents.mock.calls.length).toBe(initialCallCount);
    });

    it('clears filter error after user updates a date field', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openFilterModal();
      });

      act(() => {
        result.current.updateDraftStartDate('12.30.2026');
      });

      await waitFor(() => {
        expect(result.current.filterDraft.startDate).toBe('12.30.2026');
      });

      act(() => {
        result.current.applyFilterDraft();
      });

      await waitFor(() => {
        expect(result.current.filterError).toBe('From date must be a valid date.');
      });

      act(() => {
        result.current.updateDraftStartDate('12.04.2099');
      });

      expect(result.current.filterError).toBeNull();
    });

    it('keeps the applied sort order during load more and silent refresh', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openFilterModal();
      });

      act(() => {
        result.current.updateDraftSortBy('DISTANCE');
      });

      act(() => {
        result.current.applyFilterDraft();
      });

      await waitFor(() => {
        expect(mockListEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            sort_by: 'DISTANCE',
          }),
          'mock-token',
        );
      });

      mockListEvents.mockResolvedValueOnce(page2Fixture);

      await act(async () => {
        await result.current.loadMoreEvents();
      });

      expect(mockListEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sort_by: 'DISTANCE',
          cursor: 'cursor-2',
        }),
        'mock-token',
      );

      mockListEvents.mockResolvedValueOnce(page1Fixture);

      await act(async () => {
        await result.current.silentRefresh();
      });

      expect(mockListEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sort_by: 'DISTANCE',
        }),
        'mock-token',
      );
    });
  });
    describe('location picker', () => {
    it('opens and closes location modal', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isLocationModalOpen).toBe(false);

      act(() => {
        result.current.openLocationModal();
      });

      expect(result.current.isLocationModalOpen).toBe(true);
      expect(result.current.locationQuery).toBe('');
      expect(result.current.pendingLocation).toBeNull();

      act(() => {
        result.current.closeLocationModal();
      });

      expect(result.current.isLocationModalOpen).toBe(false);
    });

    it('does not apply selected location immediately after choosing a suggestion', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCallCount = mockListEvents.mock.calls.length;

      act(() => {
        result.current.openLocationModal();
      });

      act(() => {
        result.current.selectLocationSuggestion({
          display_name: 'Kadikoy, Istanbul, Turkiye',
          lat: '40.9909',
          lon: '29.0293',
        });
      });

      expect(result.current.isLocationModalOpen).toBe(true);
      expect(result.current.pendingLocation?.display_name).toBe(
        'Kadikoy, Istanbul, Turkiye',
      );
      expect(mockListEvents.mock.calls.length).toBe(initialCallCount);
    });

    it('applies selected location only after choose location is pressed', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openLocationModal();
      });

      act(() => {
        result.current.selectLocationSuggestion({
          display_name: 'Kadikoy, Istanbul, Turkiye',
          lat: '40.9909',
          lon: '29.0293',
        });
      });

      act(() => {
        result.current.applySelectedLocation();
      });

      await waitFor(() => {
        expect(mockListEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            lat: 40.9909,
            lon: 29.0293,
          }),
          'mock-token',
        );
      });

      expect(result.current.isLocationModalOpen).toBe(false);
      expect(result.current.locationLabel).toBe('Kadikoy, Istanbul');
    });

    it('resets location draft and keeps location modal open', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.openLocationModal();
      });

      act(() => {
        result.current.selectLocationSuggestion({
          display_name: 'Kadikoy, Istanbul, Turkiye',
          lat: '40.9909',
          lon: '29.0293',
        });
      });

      act(() => {
        result.current.resetLocationDraft();
      });

      expect(result.current.isLocationModalOpen).toBe(true);
      expect(result.current.pendingLocation).toBeNull();
      expect(result.current.locationQuery).toBe('');
    });

    it('applies the hardcoded fallback location only after the user explicitly selects it', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetCurrentLocationSuggestion).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.openLocationModal();
      });

      act(() => {
        result.current.selectLocationSuggestion({
          display_name: 'Kadikoy, Istanbul, Turkiye',
          lat: '40.9909',
          lon: '29.0293',
        });
      });

      act(() => {
        result.current.applySelectedLocation();
      });

      await waitFor(() => {
        expect(result.current.locationLabel).toBe('Kadikoy, Istanbul');
      });

      act(() => {
        result.current.openLocationModal();
      });

      act(() => {
        result.current.selectSavedLocationOption(
          result.current.defaultLocationOption.suggestion!,
        );
      });

      act(() => {
        result.current.applySelectedLocation();
      });

      await waitFor(() => {
        expect(mockListEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            lat: 41.0422,
            lon: 29.0083,
          }),
          'mock-token',
        );
      });

      expect(result.current.isLocationModalOpen).toBe(false);
      expect(result.current.locationLabel).toBe('Beşiktaş, Istanbul');
    });

    it('applies a saved favorite location after it is selected', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.favoriteLocationOptions).toHaveLength(2);
      });

      act(() => {
        result.current.openLocationModal();
      });

      act(() => {
        result.current.selectSavedLocationOption(
          result.current.favoriteLocationOptions[0].suggestion,
        );
      });

      expect(result.current.pendingLocation?.display_name).toBe(
        'Besiktas, Istanbul, Turkiye',
      );

      act(() => {
        result.current.applySelectedLocation();
      });

      await waitFor(() => {
        expect(mockListEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            lat: 41.0430,
            lon: 29.0095,
          }),
          'mock-token',
        );
      });

      expect(result.current.locationLabel).toBe('Besiktas, Istanbul');
    });

    it('keeps the applied custom location after the hook remounts', async () => {
      const firstRender = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(firstRender.result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(firstRender.result.current.favoriteLocationOptions).toHaveLength(2);
      });

      act(() => {
        firstRender.result.current.openLocationModal();
      });

      act(() => {
        firstRender.result.current.selectSavedLocationOption(
          firstRender.result.current.favoriteLocationOptions[0].suggestion,
        );
      });

      act(() => {
        firstRender.result.current.applySelectedLocation();
      });

      await waitFor(() => {
        expect(firstRender.result.current.locationLabel).toBe('Besiktas, Istanbul');
      });

      firstRender.unmount();

      const secondRender = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(secondRender.result.current.isLoading).toBe(false);
      });

      expect(secondRender.result.current.locationLabel).toBe('Besiktas, Istanbul');
      expect(mockListEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          lat: 41.0430,
          lon: 29.0095,
        }),
        'mock-token',
      );
    });

    it('keeps the applied custom location during silent refresh', async () => {
      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.favoriteLocationOptions).toHaveLength(2);
      });

      act(() => {
        result.current.openLocationModal();
      });

      act(() => {
        result.current.selectSavedLocationOption(
          result.current.favoriteLocationOptions[0].suggestion,
        );
      });

      act(() => {
        result.current.applySelectedLocation();
      });

      await waitFor(() => {
        expect(result.current.locationLabel).toBe('Besiktas, Istanbul');
      });

      mockListEvents.mockResolvedValueOnce(page1Fixture);

      await act(async () => {
        await result.current.silentRefresh();
      });

      expect(result.current.locationLabel).toBe('Besiktas, Istanbul');
      expect(mockListEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          lat: 41.0430,
          lon: 29.0095,
        }),
        'mock-token',
      );
    });

    it('returns to the user profile default location after resetting a temporary location', async () => {
      mockGetMyProfile.mockResolvedValueOnce({
        id: 'user-1',
        username: 'mock',
        email: 'mock@example.com',
        phone_number: null,
        gender: null,
        birth_date: null,
        email_verified: true,
        status: 'active',
        default_location_address: 'Kadikoy, Istanbul, Turkiye',
        default_location_lat: 40.9909,
        default_location_lon: 29.0293,
        display_name: null,
        bio: null,
        avatar_url: null,
      });

      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.locationLabel).toBe('Kadikoy, Istanbul');

      act(() => {
        result.current.openLocationModal();
      });

      expect(result.current.locationQuery).toBe('');

      act(() => {
        result.current.selectLocationSuggestion({
          display_name: 'Besiktas, Istanbul, Turkiye',
          lat: '41.0430',
          lon: '29.0095',
        });
      });

      act(() => {
        result.current.applySelectedLocation();
      });

      await waitFor(() => {
        expect(result.current.locationLabel).toBe('Besiktas, Istanbul');
      });

      act(() => {
        result.current.openLocationModal();
      });

      expect(result.current.locationQuery).toBe('');
      expect(result.current.pendingLocation).toBeNull();

      act(() => {
        result.current.resetLocationDraft();
      });

      expect(result.current.pendingLocation).toBeNull();
      expect(result.current.locationQuery).toBe('');

      act(() => {
        result.current.selectSavedLocationOption(
          result.current.defaultLocationOption.suggestion!,
        );
      });

      act(() => {
        result.current.applySelectedLocation();
      });

      await waitFor(() => {
        expect(mockListEvents).toHaveBeenLastCalledWith(
          expect.objectContaining({
            lat: 40.9909,
            lon: 29.0293,
          }),
          'mock-token',
        );
      });

      expect(result.current.locationLabel).toBe('Kadikoy, Istanbul');
    });
  });

  describe('IN_PROGRESS event filtering', () => {
    it('excludes IN_PROGRESS events from the initial load', async () => {
      mockListEvents.mockResolvedValueOnce({
        items: [
          {
            id: 'active-1',
            title: 'Active Event',
            category_name: 'Sports',
            image_url: null,
            start_time: '2099-01-01T10:00:00+03:00',
            location_address: 'Stadium',
            privacy_level: 'PUBLIC',
            approved_participant_count: 10,
            is_favorited: false,
            host_score: { final_score: null, hosted_event_rating_count: 0 },
            status: 'ACTIVE',
          },
          {
            id: 'in-progress-1',
            title: 'In Progress Event',
            category_name: 'Sports',
            image_url: null,
            start_time: '2020-01-01T10:00:00+03:00',
            location_address: 'Park',
            privacy_level: 'PUBLIC',
            approved_participant_count: 5,
            is_favorited: false,
            host_score: { final_score: null, hosted_event_rating_count: 0 },
            status: 'IN_PROGRESS',
          },
        ],
        page_info: { next_cursor: null, has_next: false },
      });

      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.events).toHaveLength(1);
      expect(result.current.events[0].id).toBe('active-1');
    });

    it('excludes IN_PROGRESS events when loading more', async () => {
      mockListEvents
        .mockResolvedValueOnce(page1Fixture)
        .mockResolvedValueOnce({
          items: [
            {
              id: 'in-progress-2',
              title: 'In Progress Event 2',
              category_name: 'Music',
              image_url: null,
              start_time: '2020-06-01T12:00:00+03:00',
              location_address: 'Club',
              privacy_level: 'PUBLIC',
              approved_participant_count: 20,
              is_favorited: false,
              host_score: { final_score: null, hosted_event_rating_count: 0 },
              status: 'IN_PROGRESS',
            },
          ],
          page_info: { next_cursor: null, has_next: false },
        });

      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        result.current.loadMoreEvents();
      });

      await waitFor(() => {
        expect(result.current.isLoadingMore).toBe(false);
      });

      const ids = result.current.events.map((e) => e.id);
      expect(ids).not.toContain('in-progress-2');
    });

    it('keeps events without a status field', async () => {
      mockListEvents.mockResolvedValueOnce({
        items: [
          {
            id: 'no-status',
            title: 'Legacy Event',
            category_name: 'Art',
            image_url: null,
            start_time: '2099-05-01T14:00:00+03:00',
            location_address: 'Gallery',
            privacy_level: 'PUBLIC',
            approved_participant_count: 3,
            is_favorited: false,
            host_score: { final_score: null, hosted_event_rating_count: 0 },
          },
        ],
        page_info: { next_cursor: null, has_next: false },
      });

      const { result } = renderHook(() => useHomeViewModel());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.events).toHaveLength(1);
      expect(result.current.events[0].id).toBe('no-status');
    });
  });
});
