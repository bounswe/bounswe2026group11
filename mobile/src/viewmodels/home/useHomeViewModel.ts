import { useCallback, useEffect, useMemo, useState } from 'react';
import { EVENT_CATEGORIES, EventCategory, EventSummary } from '@/models/event';
import { listEvents } from '@/services/eventService';

const PAGE_SIZE = 4;

export interface HomeViewModel {
  locationLabel: string;
  notificationCount: number;
  categories: readonly EventCategory[];
  selectedCategory: EventCategory;
  searchText: string;
  events: EventSummary[];
  totalCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  apiError: string | null;
  hasMore: boolean;
  updateSearchText: (value: string) => void;
  selectCategory: (category: EventCategory) => void;
  loadMoreEvents: () => Promise<void>;
  refreshEvents: () => Promise<void>;
}

export function useHomeViewModel(): HomeViewModel {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<EventCategory>('All');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (targetPage: number, mode: 'initial' | 'refresh' | 'loadMore') => {
      try {
        if (mode === 'initial') setIsLoading(true);
        if (mode === 'refresh') setIsRefreshing(true);
        if (mode === 'loadMore') setIsLoadingMore(true);

        setApiError(null);

        const response = await listEvents({
          page: targetPage,
          limit: PAGE_SIZE,
          search: searchText,
          category: selectedCategory,
        });

        setTotalCount(response.totalCount);
        setHasMore(response.hasMore);
        setPage(targetPage);

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
    [searchText, selectedCategory],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadPage(1, 'initial');
    }, 250);

    return () => clearTimeout(timeout);
  }, [loadPage]);

  const updateSearchText = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  const selectCategory = useCallback((category: EventCategory) => {
    setSelectedCategory(category);
  }, []);

  const loadMoreEvents = useCallback(async () => {
    if (isLoading || isLoadingMore || isRefreshing || !hasMore) return;
    await loadPage(page + 1, 'loadMore');
  }, [hasMore, isLoading, isLoadingMore, isRefreshing, loadPage, page]);

  const refreshEvents = useCallback(async () => {
    await loadPage(1, 'refresh');
  }, [loadPage]);

  const categories = useMemo(() => EVENT_CATEGORIES, []);

  return {
    locationLabel: 'New York City',
    notificationCount: 2,
    categories,
    selectedCategory,
    searchText,
    events,
    totalCount,
    isLoading,
    isLoadingMore,
    isRefreshing,
    apiError,
    hasMore,
    updateSearchText,
    selectCategory,
    loadMoreEvents,
    refreshEvents,
  };
}