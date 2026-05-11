// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDiscoverViewModel } from './useDiscoverViewModel';

const mockDiscoverEvents = vi.fn();
const mockListCategories = vi.fn();

vi.mock('@/services/eventService', () => ({
  discoverEvents: (...args: unknown[]) => mockDiscoverEvents(...args),
  listCategories: (...args: unknown[]) => mockListCategories(...args),
  searchLocation: vi.fn(),
}));

vi.mock('@/services/profileService', () => ({
  profileService: {
    getMyProfile: vi.fn(),
    getFavoriteLocations: vi.fn(),
  },
}));

describe('useDiscoverViewModel persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockListCategories.mockResolvedValue({ items: [] });
    mockDiscoverEvents.mockResolvedValue({
      items: [],
      page_info: {
        next_cursor: null,
        has_next: false,
      },
    });
  });

  it('restores selected location and active query context from the current session', async () => {
    window.sessionStorage.setItem(
      'sem_discover_state',
      JSON.stringify({
        filters: {
          q: 'jazz',
          categoryIds: [3, 4],
          sortBy: 'DISTANCE',
          radiusMeters: 10000,
          minimumAge: 18,
          privacy: 'PROTECTED',
          startFrom: '2026-05-10',
          startTo: '',
          childFriendly: true,
          familyOriented: true,
        },
        debouncedQ: 'jazz',
        selectedLocation: {
          display_name: 'Kadikoy, Istanbul',
          lat: '40.9919',
          lon: '29.0278',
        },
      }),
    );

    const { result } = renderHook(() => useDiscoverViewModel(null));

    await waitFor(() => expect(mockDiscoverEvents).toHaveBeenCalled());

    expect(result.current.filters.q).toBe('jazz');
    expect(result.current.filters.categoryIds).toEqual([3, 4]);
    expect(result.current.filters.sortBy).toBe('DISTANCE');
    expect(result.current.filters.radiusMeters).toBe(10000);
    expect(result.current.filters.minimumAge).toBe(18);
    expect(result.current.filters.privacy).toBe('PROTECTED');
    expect(result.current.filters.childFriendly).toBe(true);
    expect(result.current.filters.familyOriented).toBe(true);
    expect(result.current.mapCenter).toEqual({ lat: 40.9919, lon: 29.0278 });
    expect(mockDiscoverEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: 40.9919,
        lon: 29.0278,
        q: 'jazz',
        category_ids: '3,4',
        sort_by: 'DISTANCE',
        radius_meters: 10000,
        minimum_age: 18,
        privacy_levels: 'PROTECTED',
        start_from: new Date('2026-05-10').toISOString(),
        child_friendly: true,
        family_oriented: true,
      }),
      null,
    );
  });

  it('refetches discover results with the selected minimum age filter', async () => {
    const { result } = renderHook(() => useDiscoverViewModel(null));

    await waitFor(() => expect(mockDiscoverEvents).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.updateFilter('minimumAge', 21);
    });

    await waitFor(() =>
      expect(mockDiscoverEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          minimum_age: 21,
        }),
        null,
      ),
    );
  });
});
