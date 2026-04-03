import { useCallback, useEffect, useState } from 'react';
import { EventSummary } from '@/models/event';
import { listEvents } from '@/services/eventService';
import { removeFavorite } from '@/services/favoriteService';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_LOCATION = {
  lat: 41.0082,
  lon: 28.9784,
};

const PAGE_SIZE = 20;

export interface FavoriteEventsViewModel {
  events: EventSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  apiError: string | null;
  handleRemoveFavorite: (eventId: string) => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useFavoriteEventsViewModel(): FavoriteEventsViewModel {
  const { token } = useAuth();

  const [events, setEvents] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchEvents = useCallback(
    async (mode: 'initial' | 'refresh' | 'loadMore') => {
      if (!token) {
        setEvents([]);
        setApiError('You must be logged in to view favorites.');
        setIsLoading(false);
        return;
      }

      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);
      if (mode === 'loadMore') setIsLoadingMore(true);

      if (mode !== 'loadMore') {
        setNextCursor(null);
        setHasMore(false);
      }

      setApiError(null);

      try {
        const response = await listEvents(
          {
            lat: DEFAULT_LOCATION.lat,
            lon: DEFAULT_LOCATION.lon,
            only_favorited: true,
            limit: PAGE_SIZE,
            cursor: mode === 'loadMore' ? nextCursor ?? undefined : undefined,
          },
          token,
        );

        setHasMore(response.page_info.has_next);
        setNextCursor(response.page_info.next_cursor);

        if (mode === 'loadMore') {
          setEvents((prev) => [...prev, ...response.items]);
        } else {
          setEvents(response.items);
        }
      } catch {
        setApiError('Failed to load favorite events. Please try again.');
      } finally {
        if (mode === 'initial') setIsLoading(false);
        if (mode === 'refresh') setIsRefreshing(false);
        if (mode === 'loadMore') setIsLoadingMore(false);
      }
    },
    [token, nextCursor],
  );

  useEffect(() => {
    void fetchEvents('initial');
  }, [token]);

  const refresh = useCallback(async () => {
    await fetchEvents('refresh');
  }, [fetchEvents]);

  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || isRefreshing || !hasMore || !nextCursor) {
      return;
    }
    await fetchEvents('loadMore');
  }, [isLoading, isLoadingMore, isRefreshing, hasMore, nextCursor, fetchEvents]);

  const handleRemoveFavorite = useCallback(
    async (eventId: string) => {
      if (!token) return;

      try {
        await removeFavorite(eventId, token);
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
      } catch {
        setApiError('Failed to remove favorite. Please try again.');
      }
    },
    [token],
  );

  return {
    events,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    apiError,
    handleRemoveFavorite,
    refresh,
    loadMore,
  };
}
