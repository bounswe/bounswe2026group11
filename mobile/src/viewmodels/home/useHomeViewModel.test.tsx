/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import * as eventService from '@/services/eventService';
import type {
  ListCategoriesResponse,
  PaginatedEventsResponse,
} from '@/models/event';
import { useHomeViewModel } from './useHomeViewModel';

jest.mock('@/services/eventService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    refreshToken: 'mock-refresh-token',
    setSession: jest.fn(),
    clearAuth: jest.fn(),
  }),
}));

const mockListEvents = jest.mocked(eventService.listEvents);
const mockListCategories = jest.mocked(eventService.listCategories);

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
      capacity: 150,
      favorite_count: 72,
      rating: 4.7,
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
      capacity: 60,
      favorite_count: 35,
      rating: 4.9,
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
      capacity: 80,
      favorite_count: 22,
      rating: 4.6,
    },
  ],
  page_info: {
    next_cursor: null,
    has_next: false,
  },
};

describe('useHomeViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListCategories.mockResolvedValue(categoriesFixture);
    mockListEvents.mockResolvedValue(page1Fixture);
  });

  it('loads initial categories and events on mount', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockListCategories).toHaveBeenCalledTimes(1);
    expect(mockListEvents).toHaveBeenCalledWith(
      {
        lat: 41.0082,
        lon: 28.9784,
        radius_meters: 50000,
        q: undefined,
        category_ids: undefined,
        limit: 2,
        cursor: undefined,
      },
      'mock-token',
    );

    expect(result.current.categories).toEqual(categoriesFixture.items);
    expect(result.current.events).toEqual(page1Fixture.items);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.hasMore).toBe(true);
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
      {
        lat: 41.0082,
        lon: 28.9784,
        radius_meters: 50000,
        q: undefined,
        category_ids: undefined,
        limit: 2,
        cursor: undefined,
      },
      'mock-token',
    );

    expect(result.current.events).toHaveLength(1);
    expect(result.current.totalCount).toBe(1);
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
        lat: 41.0082,
        lon: 28.9784,
        radius_meters: 50000,
        q: undefined,
        category_ids: undefined,
        limit: 2,
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
  it('sends selected category id as category_ids when category changes', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockListEvents.mockClear();

    await act(async () => {
      result.current.selectCategory(2);
    });

    await waitFor(() => {
      expect(mockListEvents).toHaveBeenCalled();
    });

    expect(mockListEvents).toHaveBeenLastCalledWith(
      {
        lat: 41.0082,
        lon: 28.9784,
        radius_meters: 50000,
        q: undefined,
        category_ids: [2],
        limit: 2,
        cursor: undefined,
      },
      'mock-token',
    );
  });

  it('sends search text as q when search changes', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockListEvents.mockClear();

    await act(async () => {
      result.current.updateSearchText('coffee');
    });

    await waitFor(() => {
      expect(mockListEvents).toHaveBeenCalled();
    });

    expect(mockListEvents).toHaveBeenLastCalledWith(
      {
        lat: 41.0082,
        lon: 28.9784,
        radius_meters: 50000,
        q: 'coffee',
        category_ids: undefined,
        limit: 2,
        cursor: undefined,
      },
      'mock-token',
    );
  });
});