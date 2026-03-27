/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import * as eventService from '@/services/eventService';
import type { PaginatedEventsResponse } from '@/models/event';
import { useHomeViewModel } from './useHomeViewModel';

jest.mock('@/services/eventService');

const mockListEvents = jest.mocked(eventService.listEvents);

const page1Fixture: PaginatedEventsResponse = {
  items: [
    {
      id: '1',
      title: 'Summer Night Jazz Concert',
      category: 'Music',
      visibility: 'public',
      locationName: 'Brooklyn Bridge Park',
      startTime: '2026-03-29T20:30:00+03:00',
      endTime: '2026-03-29T23:00:00+03:00',
      attendeeCount: 96,
      capacity: 150,
      favoriteCount: 72,
      rating: 4.7,
      imageAccent: '#8B5CF6',
    },
    {
      id: '2',
      title: 'AI for Product Managers Workshop',
      category: 'Technology',
      visibility: 'protected',
      locationName: 'SoHo Tech Hub',
      startTime: '2026-03-30T18:00:00+03:00',
      endTime: '2026-03-30T20:00:00+03:00',
      attendeeCount: 41,
      capacity: 60,
      favoriteCount: 35,
      rating: 4.9,
      imageAccent: '#2563EB',
    },
  ],
  page: 1,
  limit: 4,
  hasMore: true,
  totalCount: 6,
};

const page2Fixture: PaginatedEventsResponse = {
  items: [
    {
      id: '3',
      title: 'Creative Writing Bootcamp',
      category: 'Education',
      visibility: 'public',
      locationName: 'NY Public Library',
      startTime: '2026-03-31T13:00:00+03:00',
      endTime: '2026-03-31T15:30:00+03:00',
      attendeeCount: 58,
      capacity: 80,
      favoriteCount: 22,
      rating: 4.6,
      imageAccent: '#14B8A6',
    },
  ],
  page: 2,
  limit: 4,
  hasMore: false,
  totalCount: 6,
};

describe('useHomeViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListEvents.mockResolvedValue(page1Fixture);
  });

  it('loads initial events on mount', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockListEvents).toHaveBeenCalledWith({
      page: 1,
      limit: 4,
      search: '',
      category: 'All',
    });
    expect(result.current.events).toEqual(page1Fixture.items);
    expect(result.current.totalCount).toBe(6);
    expect(result.current.hasMore).toBe(true);
  });

  it('updates search text', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await act(async () => {
      result.current.updateSearchText('music');
    });

    expect(result.current.searchText).toBe('music');
  });

  it('updates selected category', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await act(async () => {
      result.current.selectCategory('Music');
    });

    expect(result.current.selectedCategory).toBe('Music');
  });

  it('refreshes events from page 1', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockListEvents.mockResolvedValueOnce({
      ...page1Fixture,
      items: [page1Fixture.items[0]],
      totalCount: 1,
      hasMore: false,
    });

    await act(async () => {
      await result.current.refreshEvents();
    });

    expect(mockListEvents).toHaveBeenLastCalledWith({
      page: 1,
      limit: 4,
      search: '',
      category: 'All',
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.totalCount).toBe(1);
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

    expect(mockListEvents).toHaveBeenLastCalledWith({
      page: 2,
      limit: 4,
      search: '',
      category: 'All',
    });
    expect(result.current.events).toHaveLength(3);
    expect(result.current.events[2].id).toBe('3');
    expect(result.current.hasMore).toBe(false);
  });

  it('sets apiError when loading fails', async () => {
    mockListEvents.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.apiError).toBe('Failed to load events. Please try again.');
  });
});