import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FavoriteEventItem } from '@/models/favorite';
import { ApiError } from '@/services/api';
import {
  listFavoriteEvents,
  removeFavorite,
} from '@/services/favoriteService';

export interface FavoriteEventsViewModel {
  events: FavoriteEventItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  apiError: string | null;
  handleRemoveFavorite: (eventId: string) => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'You must be logged in to view favorites.';
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Failed to load favorite events. Please try again.';
}

function getRemoveErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'You must be logged in to manage favorites.';
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Failed to remove favorite. Please try again.';
}

export function useFavoriteEventsViewModel(): FavoriteEventsViewModel {
  const { token } = useAuth();

  const [events, setEvents] = useState<FavoriteEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchEvents = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!token) {
        setEvents([]);
        setApiError('You must be logged in to view favorites.');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);

      setApiError(null);

      try {
        const response = await listFavoriteEvents(token);
        setEvents(response.items);
      } catch (error) {
        if (mode === 'initial') {
          setEvents([]);
        }

        setApiError(getLoadErrorMessage(error));
      } finally {
        if (mode === 'initial') setIsLoading(false);
        if (mode === 'refresh') setIsRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void fetchEvents('initial');
  }, [fetchEvents]);

  const refresh = useCallback(async () => {
    await fetchEvents('refresh');
  }, [fetchEvents]);

  const loadMore = useCallback(async () => {
    // The favorites endpoint currently returns the full list without cursor pagination.
  }, []);

  const handleRemoveFavorite = useCallback(
    async (eventId: string) => {
      if (!token) return;

      try {
        await removeFavorite(eventId, token);
        setEvents((prev) => prev.filter((event) => event.id !== eventId));
      } catch (error) {
        setApiError(getRemoveErrorMessage(error));
      }
    },
    [token],
  );

  return {
    events,
    isLoading,
    isRefreshing,
    isLoadingMore: false,
    hasMore: false,
    apiError,
    handleRemoveFavorite,
    refresh,
    loadMore,
  };
}
