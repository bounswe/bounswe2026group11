import { useCallback, useEffect, useState } from 'react';
import {
  EventCategory,
  EventSummary,
  HomeFilterPrivacyLevel,
  HomeFiltersDraft,
} from '@/models/event';
import { listCategories, listEvents } from '@/services/eventService';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 2;

const DEFAULT_LOCATION = {
  lat: 41.0082,
  lon: 28.9784,
};

const DEFAULT_FILTERS: HomeFiltersDraft = {
  categoryIds: [],
  privacyLevels: [],
  startDate: '',
  endDate: '',
  radiusKm: 10,
};

function parseStrictDateToIso(
  value: string,
  boundary: 'start' | 'end',
): string | undefined {
  if (!value) return undefined;

  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return undefined;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  if (!day || !month || !year) return undefined;
  if (month < 1 || month > 12) return undefined;

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return undefined;

  const date = new Date(
    year,
    month - 1,
    day,
    boundary === 'start' ? 0 : 23,
    boundary === 'start' ? 0 : 59,
    boundary === 'start' ? 0 : 59,
    boundary === 'start' ? 0 : 999,
  );

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date.toISOString();
}

function parseStrictDate(value: string): Date | null {
  if (!value) return null;

  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  if (!day || !month || !year) return null;
  if (month < 1 || month > 12) return null;

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return null;

  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function validateFilterDates(filters: HomeFiltersDraft): string | null {
  const { startDate, endDate } = filters;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (startDate) {
    const parsedStart = parseStrictDate(startDate);
    if (!parsedStart) {
      return 'From date must be a valid date.';
    }
    if (parsedStart < today) {
      return 'From date must be today or later.';
    }
  }

  if (endDate) {
    const parsedEnd = parseStrictDate(endDate);
    if (!parsedEnd) {
      return 'To date must be a valid date.';
    }
    if (parsedEnd < today) {
      return 'To date must be today or later.';
    }
  }

  if (startDate && endDate) {
    const parsedStart = parseStrictDate(startDate);
    const parsedEnd = parseStrictDate(endDate);

    if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
      return 'To date must be the same as or later than From date.';
    }
  }

  return null;
}



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
  isFilterModalOpen: boolean;
  filterDraft: HomeFiltersDraft;
  filterError: string | null;
  updateSearchText: (value: string) => void;
  submitSearch: () => void;
  selectCategory: (categoryId: number | null) => void;
  openFilterModal: () => void;
  closeFilterModal: () => void;
  resetFilterDraft: () => void;
  applyFilterDraft: () => void;
  toggleDraftCategory: (categoryId: number) => void;
  toggleDraftPrivacy: (privacy: HomeFilterPrivacyLevel) => void;
  updateDraftStartDate: (value: string) => void;
  updateDraftEndDate: (value: string) => void;
  updateDraftRadiusKm: (value: number) => void;
  loadMoreEvents: () => Promise<void>;
  refreshEvents: () => Promise<void>;
}

export function useHomeViewModel(): HomeViewModel {
  const { token } = useAuth();

  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filterError, setFilterError] = useState<string | null>(null);
  const [appliedSearchText, setAppliedSearchText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );

  const [appliedFilters, setAppliedFilters] =
    useState<HomeFiltersDraft>(DEFAULT_FILTERS);
  const [filterDraft, setFilterDraft] =
    useState<HomeFiltersDraft>(DEFAULT_FILTERS);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

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
    async (
      mode: 'initial' | 'refresh' | 'loadMore',
      cursorOverride?: string | null,
    ) => {
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

        const combinedCategoryIds =
          selectedCategoryId != null
            ? Array.from(
                new Set([selectedCategoryId, ...appliedFilters.categoryIds]),
              )
            : appliedFilters.categoryIds;

        const response = await listEvents(
          {
            lat: DEFAULT_LOCATION.lat,
            lon: DEFAULT_LOCATION.lon,
            radius_meters: appliedFilters.radiusKm * 1000,
            q: appliedSearchText || undefined,
            category_ids:
              combinedCategoryIds.length > 0 ? combinedCategoryIds : undefined,
            privacy_levels:
              appliedFilters.privacyLevels.length > 0
                ? appliedFilters.privacyLevels
                : undefined,
            start_from: parseStrictDateToIso(appliedFilters.startDate, 'start'),
            start_to: parseStrictDateToIso(appliedFilters.endDate, 'end'),
            limit: PAGE_SIZE,
            cursor:
              mode === 'loadMore' ? cursorOverride ?? undefined : undefined,
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
    [token, appliedSearchText, selectedCategoryId, appliedFilters],
  );

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadEvents('initial');
    }, 300);

    return () => clearTimeout(timeout);
  }, [loadEvents]);

  const updateSearchText = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  const submitSearch = useCallback(() => {
    setAppliedSearchText(searchText.trim());
  }, [searchText]);

  const selectCategory = useCallback((categoryId: number | null) => {
    setSelectedCategoryId(categoryId);
  }, []);

  const openFilterModal = useCallback(() => {
    setFilterDraft(appliedFilters);
    setFilterError(null);
    setIsFilterModalOpen(true);
  }, [appliedFilters]);

  const closeFilterModal = useCallback(() => {
    setFilterDraft(appliedFilters);
    setFilterError(null);
    setIsFilterModalOpen(false);
  }, [appliedFilters]);

  const resetFilterDraft = useCallback(() => {
    setFilterDraft(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setFilterError(null);
    setIsFilterModalOpen(false);
  }, []);

  const applyFilterDraft = useCallback(() => {
    const validationError = validateFilterDates(filterDraft);

    if (validationError) {
      setFilterError(validationError);
      return;
    }

    setFilterError(null);
    setAppliedFilters(filterDraft);
    setIsFilterModalOpen(false);
  }, [filterDraft]);

  const toggleDraftCategory = useCallback((categoryId: number) => {
    setFilterDraft((prev) => {
      const exists = prev.categoryIds.includes(categoryId);

      return {
        ...prev,
        categoryIds: exists
          ? prev.categoryIds.filter((id) => id !== categoryId)
          : [...prev.categoryIds, categoryId],
      };
    });
  }, []);

  const toggleDraftPrivacy = useCallback((privacy: HomeFilterPrivacyLevel) => {
    setFilterDraft((prev) => {
      const exists = prev.privacyLevels.includes(privacy);

      return {
        ...prev,
        privacyLevels: exists
          ? prev.privacyLevels.filter((value) => value !== privacy)
          : [...prev.privacyLevels, privacy],
      };
    });
  }, []);

  const updateDraftStartDate = useCallback((value: string) => {
    setFilterDraft((prev) => ({
      ...prev,
      startDate: value,
    }));
    setFilterError(null);
  }, []);

  const updateDraftEndDate = useCallback((value: string) => {
    setFilterDraft((prev) => ({
      ...prev,
      endDate: value,
    }));
    setFilterError(null);
  }, []);

  const updateDraftRadiusKm = useCallback((value: number) => {
    setFilterDraft((prev) => ({
      ...prev,
      radiusKm: Math.round(value),
    }));
  }, []);

  const loadMoreEvents = useCallback(async () => {
    if (isLoading || isLoadingMore || isRefreshing || !hasMore || !nextCursor) {
      return;
    }

    await loadEvents('loadMore', nextCursor);
  }, [
    hasMore,
    isLoading,
    isLoadingMore,
    isRefreshing,
    loadEvents,
    nextCursor,
  ]);

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
    isFilterModalOpen,
    filterDraft,
    filterError,
    updateSearchText,
    submitSearch,
    selectCategory,
    openFilterModal,
    closeFilterModal,
    resetFilterDraft,
    applyFilterDraft,
    toggleDraftCategory,
    toggleDraftPrivacy,
    updateDraftStartDate,
    updateDraftEndDate,
    updateDraftRadiusKm,
    loadMoreEvents,
    refreshEvents,
  };
}