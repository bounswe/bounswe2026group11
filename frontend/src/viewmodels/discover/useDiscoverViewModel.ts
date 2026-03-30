import { useState, useCallback, useEffect, useRef } from 'react';
import { discoverEvents, listCategories, searchLocation } from '@/services/eventService';
import type {
  DiscoverEventItem,
  DiscoverEventsParams,
  DiscoverSortBy,
  CategoryItem,
  LocationSuggestion,
} from '@/models/event';
import { ApiError } from '@/services/api';

// Default: Istanbul center
const DEFAULT_LAT = 41.0082;
const DEFAULT_LON = 28.9784;
const DEFAULT_RADIUS = 50000;
const PAGE_SIZE = 20;

export type PrivacyFilter = 'ALL' | 'PUBLIC' | 'PROTECTED';

export interface DiscoverFilters {
  q: string;
  categoryId: number | null;
  sortBy: DiscoverSortBy;
  radiusMeters: number;
  privacy: PrivacyFilter;
  startFrom: string;
  startTo: string;
  tagNames: string;
}

const INITIAL_FILTERS: DiscoverFilters = {
  q: '',
  categoryId: null,
  sortBy: 'START_TIME',
  radiusMeters: DEFAULT_RADIUS,
  privacy: 'ALL',
  startFrom: '',
  startTo: '',
  tagNames: '',
};

export const RADIUS_OPTIONS = [
  { label: '1 km', value: 1000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
  { label: '50 km', value: 50000 },
];

export function useDiscoverViewModel(token: string | null) {
  const [events, setEvents] = useState<DiscoverEventItem[]>([]);
  const [filters, setFilters] = useState<DiscoverFilters>(INITIAL_FILTERS);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number }>({
    lat: DEFAULT_LAT,
    lon: DEFAULT_LON,
  });
  const [locationReady, setLocationReady] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationLabel, setLocationLabel] = useState('Istanbul, Turkey (default)');
  const [locationResults, setLocationResults] = useState<LocationSuggestion[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const locationTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const browserLocation = useRef<{ lat: number; lon: number }>({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
  const defaultLabel = useRef('Istanbul, Turkey (default)');

  // Request user geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setUserLocation(loc);
          browserLocation.current = loc;
          const label = `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)} (your location)`;
          setLocationLabel(label);
          defaultLabel.current = label;
          setLocationReady(true);
        },
        () => {
          setLocationReady(true);
        },
        { timeout: 5000 },
      );
    } else {
      setLocationReady(true);
    }
  }, []);

  // Load categories on mount
  useEffect(() => {
    listCategories()
      .then((res) => setCategories(res.items))
      .catch(() => {});
  }, []);

  const buildParams = useCallback(
    (cursor?: string): DiscoverEventsParams => {
      const params: DiscoverEventsParams = {
        lat: userLocation.lat,
        lon: userLocation.lon,
        radius_meters: filters.radiusMeters,
        limit: PAGE_SIZE,
        sort_by: filters.sortBy,
      };
      if (debouncedQ.trim()) params.q = debouncedQ.trim();
      if (filters.categoryId) params.category_ids = String(filters.categoryId);
      if (filters.privacy !== 'ALL') params.privacy_levels = filters.privacy;
      if (filters.startFrom) params.start_from = new Date(filters.startFrom).toISOString();
      if (filters.startTo) params.start_to = new Date(filters.startTo).toISOString();
      if (filters.tagNames.trim()) params.tag_names = filters.tagNames.trim();
      if (cursor) params.cursor = cursor;
      return params;
    },
    [userLocation, filters.sortBy, filters.categoryId, filters.radiusMeters, filters.privacy, filters.startFrom, filters.startTo, filters.tagNames, debouncedQ],
  );

  const fetchEvents = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await discoverEvents(buildParams(), token);
      setEvents(res.items);
      setNextCursor(res.page_info.next_cursor);
      setHasNext(res.page_info.has_next);
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details ? ` (${Object.entries(err.details).map(([k, v]) => `${k}: ${v}`).join(', ')})` : '';
        setError(err.message + details);
      } else {
        setError('Failed to load events. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, buildParams]);

  const loadMore = useCallback(async () => {
    if (!token || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await discoverEvents(buildParams(nextCursor), token);
      setEvents((prev) => [...prev, ...res.items]);
      setNextCursor(res.page_info.next_cursor);
      setHasNext(res.page_info.has_next);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [token, nextCursor, isLoadingMore, buildParams]);

  // Fetch when location is ready and token is present
  useEffect(() => {
    if (locationReady && token) {
      fetchEvents();
    }
  }, [locationReady, token, fetchEvents]);

  const updateSearch = useCallback(
    (q: string) => {
      setFilters((prev) => ({ ...prev, q }));
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        setDebouncedQ(q);
      }, 400);
    },
    [],
  );

  const updateFilter = useCallback(
    <K extends keyof DiscoverFilters>(key: K, value: DiscoverFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateCategory = useCallback((categoryId: number | null) => {
    setFilters((prev) => ({
      ...prev,
      categoryId: prev.categoryId === categoryId ? null : categoryId,
    }));
  }, []);

  const updateSort = useCallback((sortBy: DiscoverSortBy) => {
    setFilters((prev) => ({ ...prev, sortBy }));
  }, []);

  const handleLocationSearch = useCallback((query: string) => {
    setLocationQuery(query);
    setLocationResults([]);
    if (locationTimeout.current) clearTimeout(locationTimeout.current);
    if (query.trim().length < 3) return;
    locationTimeout.current = setTimeout(async () => {
      setLocationSearching(true);
      try {
        const results = await searchLocation(query);
        setLocationResults(results);
      } catch {
        setLocationResults([]);
      } finally {
        setLocationSearching(false);
      }
    }, 400);
  }, []);

  const selectLocation = useCallback((suggestion: LocationSuggestion) => {
    setUserLocation({ lat: parseFloat(suggestion.lat), lon: parseFloat(suggestion.lon) });
    setLocationLabel(suggestion.display_name);
    setLocationQuery('');
    setLocationResults([]);
  }, []);

  const useMyLocation = useCallback(() => {
    setUserLocation(browserLocation.current);
    setLocationLabel(defaultLabel.current);
    setLocationQuery('');
    setLocationResults([]);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setDebouncedQ('');
    setUserLocation(browserLocation.current);
    setLocationLabel(defaultLabel.current);
    setLocationQuery('');
    setLocationResults([]);
  }, []);

  return {
    events,
    filters,
    categories,
    isLoading,
    isLoadingMore,
    error,
    hasNext,
    locationQuery,
    locationLabel,
    locationResults,
    locationSearching,
    updateSearch,
    updateFilter,
    updateCategory,
    updateSort,
    handleLocationSearch,
    selectLocation,
    useMyLocation,
    clearFilters,
    loadMore,
    refresh: fetchEvents,
  };
}
