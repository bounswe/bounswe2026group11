/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import * as eventService from '@/services/eventService';
import * as favoriteService from '@/services/favoriteService';
import type { EventSummary, PaginatedEventsResponse } from '@/models/event';
import { useFavoriteEventsViewModel } from './useFavoriteEventsViewModel';

jest.mock('@/services/eventService');
jest.mock('@/services/favoriteService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    refreshToken: 'mock-refresh-token',
    setSession: jest.fn(),
    clearAuth: jest.fn(),
  }),
}));

const mockListEvents = jest.mocked(eventService.listEvents);
const mockRemoveFavorite = jest.mocked(favoriteService.removeFavorite);

function makeEvent(id: string, isFavorited = true): EventSummary {
  return {
    id,
    title: `Event ${id}`,
    category_name: 'Outdoors',
    start_time: '2026-04-09T14:00:00+03:00',
    privacy_level: 'PUBLIC',
    approved_participant_count: 1,
    is_favorited: isFavorited,
    host_score: { final_score: null, hosted_event_rating_count: 0 },
    favorite_count: 3,
  };
}

const page1: PaginatedEventsResponse = {
  items: [makeEvent('e1'), makeEvent('e2')],
  page_info: {
    has_next: true,
    next_cursor: 'cursor-2',
  },
};

const page2: PaginatedEventsResponse = {
  items: [makeEvent('e3')],
  page_info: {
    has_next: false,
    next_cursor: null,
  },
};

describe('useFavoriteEventsViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListEvents.mockResolvedValue(page1);
    mockRemoveFavorite.mockResolvedValue(undefined);
  });

  it('loads favorite events on mount using only_favorited query', async () => {
    const { result } = renderHook(() => useFavoriteEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListEvents).toHaveBeenCalledWith(
      {
        lat: 41.0082,
        lon: 28.9784,
        only_favorited: true,
        limit: 20,
        cursor: undefined,
      },
      'mock-token',
    );
    expect(result.current.events).toEqual(page1.items);
    expect(result.current.hasMore).toBe(true);
  });

  it('refresh reloads first page', async () => {
    const { result } = renderHook(() => useFavoriteEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockListEvents.mockResolvedValueOnce({
      items: [makeEvent('e9')],
      page_info: { has_next: false, next_cursor: null },
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.events.map((e) => e.id)).toEqual(['e9']);
    expect(result.current.hasMore).toBe(false);
  });

  it('loadMore appends next page', async () => {
    const { result } = renderHook(() => useFavoriteEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockListEvents.mockResolvedValueOnce(page2);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockListEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-2' }),
      'mock-token',
    );
    expect(result.current.events.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(result.current.hasMore).toBe(false);
  });

  it('remove favorite calls API and removes item locally', async () => {
    const { result } = renderHook(() => useFavoriteEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleRemoveFavorite('e1');
    });

    expect(mockRemoveFavorite).toHaveBeenCalledWith('e1', 'mock-token');
    expect(result.current.events.map((e) => e.id)).toEqual(['e2']);
  });

  it('sets apiError when loading fails', async () => {
    mockListEvents.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useFavoriteEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.apiError).toBe('Failed to load favorite events. Please try again.');
  });
});
