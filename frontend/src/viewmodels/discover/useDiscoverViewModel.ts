import { useState, useCallback, useEffect, useRef } from 'react';
import { discoverEvents, listCategories, searchLocation } from '@/services/eventService';
import { profileService } from '@/services/profileService';
import type { FavoriteLocation } from '@/models/profile';
import type {
  DiscoverEventItem,
  DiscoverEventsParams,
  DiscoverSortBy,
  CategoryItem,
  LocationSuggestion,
} from '@/models/event';
import { ApiError } from '@/services/api';
import { formatEventLocation } from '@/utils/eventLocation';

// Fallback when browser geolocation is unavailable and profile has no default (Beşiktaş, Istanbul)
const DEFAULT_LAT = 41.0422;
const DEFAULT_LON = 29.0083;
const DEFAULT_MAP_LABEL = 'Beşiktaş, Istanbul';
const DEFAULT_RADIUS = 50000;
const PAGE_SIZE = 20;
/** Safari/WebKit often ignores page-load geolocation; hard-cap wait so we can show a user-gesture fallback. */
const GEO_AUTO_ATTEMPT_MAX_MS = 4000;
const LOCATION_PROMPT_DISMISS_KEY = 'sem_discover_location_prompt_dismissed';

function buildBrowserLocationSuggestion(pos: GeolocationPosition): LocationSuggestion {
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;
  return {
    display_name: `${lat.toFixed(4)}, ${lon.toFixed(4)} (your location)`,
    lat: String(lat),
    lon: String(lon),
  };
}

function getBrowserLocationErrorMessage(error?: GeolocationPositionError): string {
  if (!error) {
    return 'Could not access your location. Please try again.';
  }

  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission was denied. Please allow location access in Safari site settings.';
    case error.POSITION_UNAVAILABLE:
      return 'Your current location could not be determined right now.';
    case error.TIMEOUT:
      return 'Location request timed out. Please try again.';
    default:
      return error.message || 'Could not access your location. Please try again.';
  }
}

export type PrivacyFilter = 'ALL' | 'PUBLIC' | 'PROTECTED';

export interface DiscoverFilters {
  q: string;
  categoryId: number | null;
  sortBy: DiscoverSortBy;
  radiusMeters: number;
  privacy: PrivacyFilter;
  startFrom: string;
  startTo: string;
}

const INITIAL_FILTERS: DiscoverFilters = {
  q: '',
  categoryId: null,
  sortBy: 'START_TIME',
  radiusMeters: DEFAULT_RADIUS,
  privacy: 'ALL',
  startFrom: '',
  startTo: '',
};

export const RADIUS_OPTIONS = [
  { label: '1 km', value: 1000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '25 km', value: 25000 },
  { label: '50 km', value: 50000 },
];

function profileToSelectedLocation(profile: {
  default_location_address?: string | null;
  default_location_lat?: number | null;
  default_location_lon?: number | null;
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

function favoriteToSuggestion(f: FavoriteLocation): LocationSuggestion {
  return {
    display_name: f.address,
    lat: String(f.lat),
    lon: String(f.lon),
  };
}

function locationShortLabel(selected: LocationSuggestion | null): string {
  if (!selected) {
    return DEFAULT_MAP_LABEL;
  }
  if (selected.display_name.endsWith('(your location)')) {
    return 'Near you';
  }
  return formatEventLocation(selected.display_name);
}

function isDiscoverLocationFilterActive(
  selected: LocationSuggestion | null,
  defaultProfile: LocationSuggestion | null,
): boolean {
  if (!selected) return false;
  if (selected.display_name.endsWith('(your location)')) return false;
  if (defaultProfile && locationsMatch(selected, defaultProfile)) return false;
  return true;
}

export function useDiscoverViewModel(token: string | null) {
  const [events, setEvents] = useState<DiscoverEventItem[]>([]);
  const [filters, setFilters] = useState<DiscoverFilters>(INITIAL_FILTERS);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState('');
  const [defaultProfileLocation, setDefaultProfileLocation] = useState<LocationSuggestion | null>(null);
  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);
  const [hasBrowserLocation, setHasBrowserLocation] = useState(false);
  const [browserLocationError, setBrowserLocationError] = useState<string | null>(null);
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem(LOCATION_PROMPT_DISMISS_KEY) === '1',
  );
  const [browserLocationRequestPending, setBrowserLocationRequestPending] = useState(false);
  const browserLocation = useRef<LocationSuggestion | null>(null);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<LocationSuggestion | null>(null);
  const [modalLocationQuery, setModalLocationQuery] = useState('');
  const [modalLocationResults, setModalLocationResults] = useState<LocationSuggestion[]>([]);
  const [modalLocationSearching, setModalLocationSearching] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const modalLocationTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    listCategories()
      .then((res) => setCategories(res.items))
      .catch(() => {});
  }, []);

  // Attempt geolocation on load (Chrome/Firefox may prompt). Safari often requires a tap — see requestBrowserLocation.
  useEffect(() => {
    let cancelled = false;
    setLocationReady(false);
    setHasBrowserLocation(false);
    setBrowserLocationError(null);

    const geolocationSuggestion = (): Promise<LocationSuggestion | null> =>
      new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(null);
          return;
        }
        let settled = false;
        const finish = (v: LocationSuggestion | null) => {
          if (settled) return;
          settled = true;
          resolve(v);
        };
        const hardTimeout = window.setTimeout(() => finish(null), GEO_AUTO_ATTEMPT_MAX_MS);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            window.clearTimeout(hardTimeout);
            finish(buildBrowserLocationSuggestion(pos));
          },
          () => {
            window.clearTimeout(hardTimeout);
            finish(null);
          },
          { timeout: 10000, maximumAge: 0, enableHighAccuracy: false },
        );
      });

    const run = async () => {
      const geoPromise = geolocationSuggestion();

      let profileLoc: LocationSuggestion | null = null;

      if (token) {
        try {
          const [profile, favorites] = await Promise.all([
            profileService.getMyProfile(token),
            profileService.getFavoriteLocations(token).catch(() => [] as FavoriteLocation[]),
          ]);
          if (cancelled) return;
          profileLoc = profileToSelectedLocation(profile);
          setDefaultProfileLocation(profileLoc);
          setFavoriteLocations(favorites);
        } catch {
          if (!cancelled) {
            setDefaultProfileLocation(null);
            setFavoriteLocations([]);
          }
        }
      }

      const browserSuggestion = await geoPromise;
      if (cancelled) return;

      if (browserSuggestion) {
        browserLocation.current = browserSuggestion;
        setHasBrowserLocation(true);
        setSelectedLocation(browserSuggestion);
      } else {
        setSelectedLocation(profileLoc);
      }
      setLocationReady(true);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const requestBrowserLocation = useCallback(() => {
    if (browserLocationRequestPending) return;
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setBrowserLocationError('Browser location requires HTTPS or localhost.');
      return;
    }
    if (!navigator.geolocation) {
      setBrowserLocationError('This browser does not support location access.');
      return;
    }
    setBrowserLocationError(null);
    setBrowserLocationRequestPending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const suggestion = buildBrowserLocationSuggestion(pos);
        browserLocation.current = suggestion;
        setHasBrowserLocation(true);
        setSelectedLocation(suggestion);
        setLocationPromptDismissed(true);
        setBrowserLocationRequestPending(false);
      },
      (error) => {
        setBrowserLocationError(getBrowserLocationErrorMessage(error));
        setBrowserLocationRequestPending(false);
      },
      { timeout: 20000, maximumAge: 0, enableHighAccuracy: false },
    );
  }, [browserLocationRequestPending]);

  const dismissBrowserLocationPrompt = useCallback(() => {
    try {
      window.sessionStorage.setItem(LOCATION_PROMPT_DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setLocationPromptDismissed(true);
  }, []);

  const showBrowserLocationPrompt =
    locationReady &&
    !hasBrowserLocation &&
    typeof navigator !== 'undefined' &&
    !!navigator.geolocation &&
    !locationPromptDismissed;

  const buildParams = useCallback(
    (cursor?: string): DiscoverEventsParams => {
      const lat = selectedLocation ? Number(selectedLocation.lat) : DEFAULT_LAT;
      const lon = selectedLocation ? Number(selectedLocation.lon) : DEFAULT_LON;
      const params: DiscoverEventsParams = {
        lat,
        lon,
        radius_meters: filters.radiusMeters,
        limit: PAGE_SIZE,
        sort_by: filters.sortBy,
      };
      if (debouncedQ.trim()) params.q = debouncedQ.trim();
      if (filters.categoryId) params.category_ids = String(filters.categoryId);
      if (filters.privacy !== 'ALL') params.privacy_levels = filters.privacy;
      if (filters.startFrom) params.start_from = new Date(filters.startFrom).toISOString();
      if (filters.startTo) params.start_to = new Date(filters.startTo).toISOString();
      if (cursor) params.cursor = cursor;
      return params;
    },
    [
      selectedLocation,
      filters.sortBy,
      filters.categoryId,
      filters.radiusMeters,
      filters.privacy,
      filters.startFrom,
      filters.startTo,
      debouncedQ,
    ],
  );

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await discoverEvents(buildParams(), token);
      setEvents(res.items);
      setNextCursor(res.page_info.next_cursor);
      setHasNext(res.page_info.has_next);
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details
          ? ` (${Object.entries(err.details)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')})`
          : '';
        setError(err.message + details);
      } else {
        setError('Failed to load events. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, buildParams]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
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

  useEffect(() => {
    if (locationReady) {
      void fetchEvents();
    }
  }, [locationReady, token, fetchEvents]);

  const updateSearch = useCallback((q: string) => {
    setFilters((prev) => ({ ...prev, q }));
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedQ(q);
    }, 400);
  }, []);

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

  const openLocationModal = useCallback(() => {
    setPendingLocation(selectedLocation);
    setModalLocationQuery(
      locationsMatch(selectedLocation, defaultProfileLocation)
        ? ''
        : selectedLocation?.display_name ?? '',
    );
    setModalLocationResults([]);
    setModalLocationSearching(false);
    setIsLocationModalOpen(true);
  }, [defaultProfileLocation, selectedLocation]);

  const handleLocationButtonClick = useCallback(() => {
    if (!hasBrowserLocation && typeof navigator !== 'undefined' && !!navigator.geolocation) {
      requestBrowserLocation();
      return;
    }
    openLocationModal();
  }, [hasBrowserLocation, openLocationModal, requestBrowserLocation]);

  const closeLocationModal = useCallback(() => {
    setPendingLocation(null);
    setModalLocationQuery('');
    setModalLocationResults([]);
    setModalLocationSearching(false);
    setIsLocationModalOpen(false);
  }, []);

  const updateModalLocationQuery = useCallback((value: string) => {
    setModalLocationQuery(value);

    if (modalLocationTimeout.current) {
      clearTimeout(modalLocationTimeout.current);
    }

    if (value.trim().length === 0) {
      setPendingLocation(null);
      setModalLocationResults([]);
      setModalLocationSearching(false);
      return;
    }

    if (value.trim().length < 2) {
      setPendingLocation(null);
      setModalLocationResults([]);
      setModalLocationSearching(false);
      return;
    }

    modalLocationTimeout.current = setTimeout(async () => {
      setModalLocationSearching(true);
      try {
        const results = await searchLocation(value);
        setModalLocationResults(results);
      } catch {
        setModalLocationResults([]);
      } finally {
        setModalLocationSearching(false);
      }
    }, 300);
  }, []);

  const selectModalSuggestion = useCallback((suggestion: LocationSuggestion) => {
    setPendingLocation(suggestion);
    setModalLocationQuery(suggestion.display_name);
    setModalLocationResults([]);
  }, []);

  const selectFavoriteInModal = useCallback((f: FavoriteLocation) => {
    setPendingLocation(favoriteToSuggestion(f));
    setModalLocationQuery('');
    setModalLocationResults([]);
  }, []);

  const selectDefaultProfileInModal = useCallback(() => {
    if (!defaultProfileLocation) return;
    setPendingLocation(defaultProfileLocation);
    setModalLocationQuery('');
    setModalLocationResults([]);
  }, [defaultProfileLocation]);

  const applyModalLocation = useCallback(() => {
    setSelectedLocation(pendingLocation ?? defaultProfileLocation ?? null);
    setModalLocationQuery('');
    setModalLocationResults([]);
    setIsLocationModalOpen(false);
  }, [defaultProfileLocation, pendingLocation]);

  const resetModalLocationDraft = useCallback(() => {
    setPendingLocation(defaultProfileLocation);
    setModalLocationQuery('');
    setModalLocationResults([]);
    setModalLocationSearching(false);
  }, [defaultProfileLocation]);

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setDebouncedQ('');
    setSelectedLocation(defaultProfileLocation ?? browserLocation.current ?? null);
    setModalLocationQuery('');
    setModalLocationResults([]);
  }, [defaultProfileLocation]);

  const locationShortLabelText = locationShortLabel(selectedLocation);
  const hasCustomLocationFilter = isDiscoverLocationFilterActive(
    selectedLocation,
    defaultProfileLocation,
  );

  return {
    events,
    filters,
    categories,
    isLoading,
    isLoadingMore,
    error,
    hasNext,
    locationShortLabel: locationShortLabelText,
    defaultProfileLocation,
    favoriteLocations,
    isLocationModalOpen,
    pendingLocation,
    modalLocationQuery,
    modalLocationResults,
    modalLocationSearching,
    openLocationModal,
    handleLocationButtonClick,
    closeLocationModal,
    updateModalLocationQuery,
    selectModalSuggestion,
    selectFavoriteInModal,
    selectDefaultProfileInModal,
    applyModalLocation,
    resetModalLocationDraft,
    hasCustomLocationFilter,
    updateSearch,
    updateFilter,
    updateCategory,
    updateSort,
    clearFilters,
    loadMore,
    refresh: fetchEvents,
    showBrowserLocationPrompt,
    requestBrowserLocation,
    dismissBrowserLocationPrompt,
    browserLocationRequestPending,
    browserLocationError,
  };
}
