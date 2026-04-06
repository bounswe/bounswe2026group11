/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@/services/api';
import * as favoriteService from '@/services/favoriteService';
import type { FavoriteEventItem, FavoriteEventsResponse } from '@/models/favorite';
import { useFavoriteEventsViewModel } from './useFavoriteEventsViewModel';

jest.mock('@/services/favoriteService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'mock-token',
    refreshToken: 'mock-refresh-token',
    setSession: jest.fn(),
    clearAuth: jest.fn(),
  }),
}));

const mockListFavoriteEvents = jest.mocked(favoriteService.listFavoriteEvents);
const mockRemoveFavorite = jest.mocked(favoriteService.removeFavorite);

function makeEvent(id: string): FavoriteEventItem {
  return {
    id,
    title: `Event ${id}`,
    category: 'Outdoors',
    image_url: `https://example.com/${id}.jpg`,
    status: 'CANCELED',
    start_time: '2026-04-09T14:00:00+03:00',
    end_time: '2026-04-09T16:00:00+03:00',
    favorited_at: '2026-04-06T10:00:00+03:00',
  };
}

const favoritesResponse: FavoriteEventsResponse = {
  items: [makeEvent('e1'), makeEvent('e2')],
};

describe('useFavoriteEventsViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListFavoriteEvents.mockResolvedValue(favoritesResponse);
    mockRemoveFavorite.mockResolvedValue(undefined);
  });

  it('loads favorite events on mount from the dedicated favorites endpoint', async () => {
    const { result } = renderHook(() => useFavoriteEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListFavoriteEvents).toHaveBeenCalledWith('mock-token');
    expect(result.current.events).toEqual(favoritesResponse.items);
    expect(result.current.hasMore).toBe(false);
  });

  it('refresh reloads the favorite events list from the favorites endpoint', async () => {
    const { result } = renderHook(() => useFavoriteEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockListFavoriteEvents.mockResolvedValueOnce({
      items: [makeEvent('e9')],
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockListFavoriteEvents).toHaveBeenCalledTimes(2);
    expect(result.current.events.map((event) => event.id)).toEqual(['e9']);
    expect(result.current.hasMore).toBe(false);
  });

  it('loadMore is a no-op because the favorites endpoint is not paginated', async () => {
    const { result } = renderHook(() => useFavoriteEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockListFavoriteEvents).toHaveBeenCalledTimes(1);
    expect(result.current.events.map((event) => event.id)).toEqual(['e1', 'e2']);
    expect(result.current.isLoadingMore).toBe(false);
  });

  it('remove favorite calls the API and removes the event locally', async () => {
    const { result } = renderHook(() => useFavoriteEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleRemoveFavorite('e1');
    });

    expect(mockRemoveFavorite).toHaveBeenCalledWith('e1', 'mock-token');
    expect(result.current.events.map((event) => event.id)).toEqual(['e2']);
  });

  it('surfaces a helpful apiError when loading fails', async () => {
    mockListFavoriteEvents.mockRejectedValueOnce(
      new ApiError(500, {
        error: {
          code: 'favorites_failed',
          message: 'Favorites are temporarily unavailable.',
        },
      }),
    );

    const { result } = renderHook(() => useFavoriteEventsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.apiError).toBe('Favorites are temporarily unavailable.');
  });
});
