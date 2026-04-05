import { useCallback, useEffect, useRef,useState } from 'react';
import {
  EventCategory,
  EventSummary,
  HomeFilterPrivacyLevel,
  HomeFiltersDraft,
  LocationSuggestion,
} from '@/models/event';
import { listCategories, listEvents, searchLocation } from '@/services/eventService';
import { getMyProfile } from '@/services/profileService';
import { formatEventLocation } from '@/utils/eventLocation';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 2;

const DEFAULT_LOCATION = {
  lat: 41.0082,
  lon: 28.9784,
};
const DEFAULT_LOCATION_LABEL = 'Istanbul';

const DEFAULT_FILTERS: HomeFiltersDraft = {
  categoryIds: [],
  privacyLevels: [],
  startDate: '',
  endDate: '',
  radiusKm: 10,
};

function profileToSelectedLocation(profile: {
  default_location_address: string | null;
  default_location_lat: number | null;
  default_location_lon: number | null;
}): LocationSuggestion | null {
  if (
    !profile.default_location_address ||
    profile.default_location_lat == null ||
    profile.default_location_lon == null
  ) {
    return null;
  }

  return {
    display_name: profile.default_location_address,
    lat: String(profile.default_location_lat),
    lon: String(profile.default_location_lon),
  };
}

function locationsMatch(
  left: LocationSuggestion | null,
  right: LocationSuggestion | null,
): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;

  return left.lat === right.lat && left.lon === right.lon;
}

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

function validateFilterDatesLive(filters: HomeFiltersDraft): string | null {
  const { startDate, endDate } = filters;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validateSingle = (
    value: string,
    label: 'From' | 'To',
  ): string | null => {
    if (!value) return null;

    const digits = value.replace(/\D/g, '');

    if (digits.length >= 2) {
      const day = Number(digits.slice(0, 2));
      if (day < 1 || day > 31) {
        return `${label} date day must be between 01 and 31.`;
      }
    }

    if (digits.length >= 4) {
      const month = Number(digits.slice(2, 4));
      if (month < 1 || month > 12) {
        return `${label} date month must be between 01 and 12.`;
      }
    }

    // User is still typing the year; only partial day/month checks above should run
    if (value.length < 10) return null;

    const parsed = parseStrictDate(value);
    if (!parsed) {
      return `${label} date must be a valid date.`;
    }

    if (parsed < today) {
      return `${label} date must be today or later.`;
    }

    return null;
  };

  const startError = validateSingle(startDate, 'From');
  if (startError) return startError;

  const endError = validateSingle(endDate, 'To');
  if (endError) return endError;

  if (startDate.length === 10 && endDate.length === 10) {
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
  locationQuery: string;
  locationSuggestions: LocationSuggestion[];
  isSearchingLocation: boolean;
  isLocationModalOpen: boolean;
  pendingLocation: LocationSuggestion | null;
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
  silentRefresh: () => Promise<void>;
  openLocationModal: () => void;
  closeLocationModal: () => void;
  updateLocationQuery: (value: string) => void;
  selectLocationSuggestion: (suggestion: LocationSuggestion) => void;
  applySelectedLocation: () => void;
  resetLocationDraft: () => void;
}

export function useHomeViewModel(): HomeViewModel {
  const { token } = useAuth();

  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [searchText, setSearchText] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [defaultProfileLocation, setDefaultProfileLocation] = useState<LocationSuggestion | null>(null);
  const [pendingLocation, setPendingLocation] = useState<LocationSuggestion | null>(null);

  const locationSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [isProfileLocationReady, setIsProfileLocationReady] = useState(false);

  const loadProfileLocation = useCallback(async () => {
    if (!token) {
      setSelectedLocation(null);
      setIsProfileLocationReady(true);
      return;
    }

    try {
      const profile = await getMyProfile(token);
      const profileLocation = profileToSelectedLocation(profile);
      setDefaultProfileLocation(profileLocation);
      setSelectedLocation(profileLocation);
    } catch {
      setDefaultProfileLocation(null);
      setSelectedLocation(null);
    } finally {
      setIsProfileLocationReady(true);
    }
  }, [token]);

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
            lat: selectedLocation ? Number(selectedLocation.lat) : DEFAULT_LOCATION.lat,
            lon: selectedLocation ? Number(selectedLocation.lon) : DEFAULT_LOCATION.lon,
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
    [token, appliedSearchText, selectedCategoryId, appliedFilters, selectedLocation]
  );

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    setIsProfileLocationReady(false);
    void loadProfileLocation();
  }, [loadProfileLocation]);

  useEffect(() => {
    if (!isProfileLocationReady) return;

    const timeout = setTimeout(() => {
      void loadEvents('initial');
    }, 300);

    return () => clearTimeout(timeout);
  }, [isProfileLocationReady, loadEvents]);

  const updateSearchText = useCallback((value: string) => {
    setSearchText(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = value.trim();

    // Clear search immediately when input is emptied
    if (trimmed.length === 0) {
      setAppliedSearchText('');
      return;
    }

    // Only auto-search with at least 2 characters
    if (trimmed.length < 2) return;

    searchTimeoutRef.current = setTimeout(() => {
      setAppliedSearchText(trimmed);
    }, 300);
  }, []);

  const submitSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    setAppliedSearchText(searchText.trim());
  }, [searchText]);

  const selectCategory = useCallback((categoryId: number | null) => {
    setSelectedCategoryId(categoryId);
  }, []);

  const openLocationModal = useCallback(() => {
    setPendingLocation(selectedLocation);
    setLocationQuery(
      locationsMatch(selectedLocation, defaultProfileLocation)
        ? ''
        : selectedLocation?.display_name ?? '',
    );
    setLocationSuggestions([]);
    setIsSearchingLocation(false);
    setIsLocationModalOpen(true);
  }, [defaultProfileLocation, selectedLocation]);

  const closeLocationModal = useCallback(() => {
    setPendingLocation(null);
    setLocationQuery('');
    setLocationSuggestions([]);
    setIsSearchingLocation(false);
    setIsLocationModalOpen(false);
  }, []);

  const updateLocationQuery = useCallback((value: string) => {
    setLocationQuery(value);

    if (locationSearchTimeoutRef.current) {
      clearTimeout(locationSearchTimeoutRef.current);
    }

    if (value.trim().length === 0) {
      setPendingLocation(null);
      setLocationSuggestions([]);
      setIsSearchingLocation(false);
      return;
    }

    if (value.trim().length < 2) {
      setPendingLocation(null);
      setLocationSuggestions([]);
      setIsSearchingLocation(false);
      return;
    }

    locationSearchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const results = await searchLocation(value);
        setLocationSuggestions(results);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 300);
  }, []);

  const selectLocationSuggestion = useCallback((suggestion: LocationSuggestion) => {
    setPendingLocation(suggestion);
    setLocationQuery(suggestion.display_name);
    setLocationSuggestions([]);
  }, []);

  const applySelectedLocation = useCallback(() => {
    setSelectedLocation(pendingLocation ?? defaultProfileLocation ?? null);
    setLocationSuggestions([]);
    setLocationQuery('');
    setIsLocationModalOpen(false);
  }, [defaultProfileLocation, pendingLocation]);

  const resetLocationDraft = useCallback(() => {
    setPendingLocation(defaultProfileLocation);
    setLocationQuery('');
    setLocationSuggestions([]);
    setIsSearchingLocation(false);
  }, [defaultProfileLocation]);

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
    setFilterError(null);
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

      const nextDraft = {
        ...prev,
        privacyLevels: exists ? [] : [privacy],
      };

      setFilterError(validateFilterDatesLive(nextDraft));
      return nextDraft;
    });
  }, []);

  const updateDraftStartDate = useCallback((value: string) => {
    setFilterDraft((prev) => {
      const nextDraft = {
        ...prev,
        startDate: value,
      };

      setFilterError(validateFilterDatesLive(nextDraft));
      return nextDraft;
    });
  }, []);

  const updateDraftEndDate = useCallback((value: string) => {
    setFilterDraft((prev) => {
      const nextDraft = {
        ...prev,
        endDate: value,
      };

      setFilterError(validateFilterDatesLive(nextDraft));
      return nextDraft;
    });
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

  const silentRefresh = useCallback(async () => {
    if (!token) return;

    try {
      const profile = await getMyProfile(token);
      const profileLocation = profileToSelectedLocation(profile);
      setDefaultProfileLocation(profileLocation);
      setSelectedLocation(profileLocation);

      const combinedCategoryIds =
        selectedCategoryId != null
          ? Array.from(
              new Set([selectedCategoryId, ...appliedFilters.categoryIds]),
            )
          : appliedFilters.categoryIds;

      const response = await listEvents(
        {
          lat: profileLocation ? Number(profileLocation.lat) : DEFAULT_LOCATION.lat,
          lon: profileLocation ? Number(profileLocation.lon) : DEFAULT_LOCATION.lon,
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
        },
        token,
      );

      setHasMore(response.page_info.has_next);
      setNextCursor(response.page_info.next_cursor);
      setEvents(response.items);
    } catch {
      // Silent — don't overwrite existing data on failure
    }
  }, [token, appliedSearchText, selectedCategoryId, appliedFilters]);

    return {
    locationLabel: selectedLocation
      ? formatEventLocation(selectedLocation.display_name)
      : DEFAULT_LOCATION_LABEL,
    locationQuery,
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
    locationSuggestions,
    isSearchingLocation,
    isLocationModalOpen,
    pendingLocation,
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
    openLocationModal,
    closeLocationModal,
    updateLocationQuery,
    selectLocationSuggestion,
    applySelectedLocation,
    resetLocationDraft,
    loadMoreEvents,
    refreshEvents,
    silentRefresh,
  };
}
