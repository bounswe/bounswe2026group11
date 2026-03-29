import { useCallback, useEffect, useState } from 'react';
import { EventCategory, EventSummary } from '@/models/event';
import { listCategories, listEvents } from '@/services/eventService';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 2;

const DEFAULT_LOCATION = {
  lat: 41.0082,
  lon: 28.9784,
};

export interface HomeViewModel {
  locationLabel: string;
  notificationCount: number;
  categories: readonly EventCategory[];
  selectedCategoryId: number | null;
  searchText: string;
  events: EventSummary[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  apiError: string | null;
  hasMore: boolean;
  updateSearchText: (value: string) => void;
  submitSearch: () => void;
  selectCategory: (categoryId: number | null) => void;
  loadMoreEvents: () => Promise<void>;
  refreshEvents: () => Promise<void>;
}

export function useHomeViewModel(): HomeViewModel {
  const { token } = useAuth();

  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [searchText, setSearchText] = useState('');
  const [appliedSearchText, setAppliedSearchText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const response = await listCategories();
      setCategories(response.items);
    } catch {
      setApiError('Failed to load categories. Please try again.');
    }
  }, []);

  const loadEvents = useCallback(
    async (mode: 'initial' | 'refresh' | 'loadMore') => {
      if (!token) {
        setEvents([]);
        setHasMore(false);
        setNextCursor(null);
        setApiError('You must be logged in to view events.');
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
        return;
      }

      try {
        if (mode === 'initial') setIsLoading(true);
        if (mode === 'refresh') setIsRefreshing(true);
        if (mode === 'loadMore') setIsLoadingMore(true);

        if (mode !== 'loadMore') {
          setNextCursor(null);
          setHasMore(false);
        }

        setApiError(null);

        const response = await listEvents(
          {
            lat: DEFAULT_LOCATION.lat,
            lon: DEFAULT_LOCATION.lon,
            radius_meters: 50000,
            q: appliedSearchText || undefined,
            category_ids:
              selectedCategoryId != null ? [selectedCategoryId] : undefined,
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
        setApiError('Failed to load events. Please try again.');
      } finally {
        if (mode === 'initial') setIsLoading(false);
        if (mode === 'refresh') setIsRefreshing(false);
        if (mode === 'loadMore') setIsLoadingMore(false);
      }
    },
    [token, nextCursor, appliedSearchText, selectedCategoryId],
  );

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadEvents('initial');
    }, 300);

    return () => clearTimeout(timeout);
  }, [token, appliedSearchText, selectedCategoryId]);

  const updateSearchText = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  const submitSearch = useCallback(() => {
    setAppliedSearchText(searchText.trim());
  }, [searchText]);

  const selectCategory = useCallback((categoryId: number | null) => {
    setSelectedCategoryId(categoryId);
  }, []);

  const loadMoreEvents = useCallback(async () => {
    if (isLoading || isLoadingMore || isRefreshing || !hasMore || !nextCursor) {
      return;
    }

    await loadEvents('loadMore');
  }, [hasMore, isLoading, isLoadingMore, isRefreshing, loadEvents, nextCursor]);

  const refreshEvents = useCallback(async () => {
    await loadEvents('refresh');
  }, [loadEvents]);

  return {
    locationLabel: 'Istanbul',
    notificationCount: 2,
    categories,
    selectedCategoryId,
    searchText,
    events,
    isLoading,
    isLoadingMore,
    isRefreshing,
    apiError,
    hasMore,
    updateSearchText,
    submitSearch,
    selectCategory,
    loadMoreEvents,
    refreshEvents,
  };
}