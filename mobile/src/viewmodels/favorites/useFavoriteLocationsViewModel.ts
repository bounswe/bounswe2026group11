import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FavoriteLocation } from '@/models/favorite';
import { LocationSuggestion } from '@/models/event';
import { ApiError } from '@/services/api';
import { searchLocation } from '@/services/eventService';
import {
  createFavoriteLocation,
  deleteFavoriteLocation,
  listFavoriteLocations,
} from '@/services/favoriteService';

const MAX_FAVORITE_LOCATIONS = 3;
const FAVORITE_LOCATIONS_LIMIT_MESSAGE =
  `You can save up to ${MAX_FAVORITE_LOCATIONS} favorite locations.`;

export interface FavoriteLocationsViewModel {
  locations: FavoriteLocation[];
  isLoading: boolean;
  isRefreshing: boolean;
  apiError: string | null;
  isAddModalOpen: boolean;
  addName: string;
  addLocationQuery: string;
  addSuggestions: LocationSuggestion[];
  isSearchingSuggestions: boolean;
  selectedSuggestion: LocationSuggestion | null;
  addError: string | null;
  isSubmittingAdd: boolean;
  removingLocationId: string | null;
  canAddMore: boolean;

  refresh: () => Promise<void>;
  openAddModal: () => void;
  closeAddModal: () => void;
  setAddName: (value: string) => void;
  setAddLocationQuery: (value: string) => void;
  selectSuggestion: (suggestion: LocationSuggestion) => void;
  submitAdd: () => Promise<void>;
  removeLocation: (id: string) => Promise<void>;
}

function sortFavoriteLocations(locations: FavoriteLocation[]): FavoriteLocation[] {
  return [...locations].sort((left, right) => {
    const nameComparison = left.name.localeCompare(
      right.name,
      undefined,
      { sensitivity: 'base' },
    );

    if (nameComparison !== 0) {
      return nameComparison;
    }

    return left.id.localeCompare(right.id);
  });
}

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'You must be logged in to view favorite locations.';
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Failed to load favorite locations. Please try again.';
}

function getCreateErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'favorite_location_limit_exceeded') {
    return FAVORITE_LOCATIONS_LIMIT_MESSAGE;
  }

  if (error instanceof ApiError && error.status === 401) {
    return 'You must be logged in to save favorite locations.';
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Failed to save favorite location. Please try again.';
}

function getDeleteErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return 'You must be logged in to manage favorite locations.';
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Failed to remove favorite location. Please try again.';
}

export function useFavoriteLocationsViewModel(): FavoriteLocationsViewModel {
  const { token } = useAuth();

  const [locations, setLocations] = useState<FavoriteLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addLocationQuery, setAddLocationQuery] = useState('');
  const [addSuggestions, setAddSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<LocationSuggestion | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [removingLocationId, setRemovingLocationId] = useState<string | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingSearch = useCallback(() => {
    if (!searchTimeoutRef.current) return;

    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = null;
  }, []);

  const resetAddForm = useCallback(() => {
    setAddName('');
    setAddLocationQuery('');
    setAddSuggestions([]);
    setSelectedSuggestion(null);
    setAddError(null);
    setIsSearchingSuggestions(false);
    clearPendingSearch();
  }, [clearPendingSearch]);

  const canAddMore = Boolean(token) && locations.length < MAX_FAVORITE_LOCATIONS;

  const syncLocations = useCallback(async () => {
    if (!token) {
      setLocations([]);
      return;
    }

    const response = await listFavoriteLocations(token);
    setLocations(sortFavoriteLocations(response.items));
  }, [token]);

  const fetchLocations = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!token) {
        setLocations([]);
        setApiError('You must be logged in to view favorite locations.');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (mode === 'initial') setIsLoading(true);
      if (mode === 'refresh') setIsRefreshing(true);

      setApiError(null);

      try {
        const response = await listFavoriteLocations(token);
        setLocations(sortFavoriteLocations(response.items));
      } catch (error) {
        if (mode === 'initial') {
          setLocations([]);
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
    void fetchLocations('initial');
  }, [fetchLocations]);

  useEffect(() => () => {
    clearPendingSearch();
  }, [clearPendingSearch]);

  const openAddModal = useCallback(() => {
    if (!token || !canAddMore) return;

    resetAddForm();
    setIsAddModalOpen(true);
  }, [canAddMore, resetAddForm, token]);

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    resetAddForm();
  }, [resetAddForm]);

  const handleSetAddName = useCallback((value: string) => {
    setAddName(value);
    setAddError(null);
  }, []);

  const handleSetAddLocationQuery = useCallback((value: string) => {
    setAddLocationQuery(value);
    setSelectedSuggestion(null);
    setAddError(null);

    clearPendingSearch();

    if (value.trim().length < 2) {
      setAddSuggestions([]);
      setIsSearchingSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const results = await searchLocation(value);
        setAddSuggestions(results);
      } catch {
        setAddSuggestions([]);
        setAddError('Failed to search locations. Please try again.');
      } finally {
        setIsSearchingSuggestions(false);
        searchTimeoutRef.current = null;
      }
    }, 300);
  }, [clearPendingSearch]);

  const selectSuggestion = useCallback((suggestion: LocationSuggestion) => {
    setSelectedSuggestion(suggestion);
    setAddLocationQuery(suggestion.display_name);
    setAddSuggestions([]);
    setAddError(null);
  }, []);

  const submitAdd = useCallback(async () => {
    if (isSubmittingAdd) return;

    const trimmedName = addName.trim();

    if (!trimmedName) {
      setAddError('Please enter a name for this location.');
      return;
    }

    if (!selectedSuggestion) {
      setAddError('Please search and select a location.');
      return;
    }

    if (!token) {
      setAddError('You must be logged in to save favorite locations.');
      return;
    }

    if (locations.length >= MAX_FAVORITE_LOCATIONS) {
      setAddError(FAVORITE_LOCATIONS_LIMIT_MESSAGE);
      return;
    }

    setIsSubmittingAdd(true);
    setAddError(null);

    try {
      const createdLocation = await createFavoriteLocation(
        {
          name: trimmedName,
          address: selectedSuggestion.display_name,
          lat: Number(selectedSuggestion.lat),
          lon: Number(selectedSuggestion.lon),
        },
        token,
      );

      setLocations((prev) =>
        sortFavoriteLocations([...prev, createdLocation]),
      );
      setApiError(null);
      setIsAddModalOpen(false);
      resetAddForm();
    } catch (error) {
      if (
        error instanceof ApiError
        && error.code === 'favorite_location_limit_exceeded'
      ) {
        try {
          await syncLocations();
        } catch {
          // Keep the user-visible mutation error; syncing is a best-effort fallback.
        }
      }

      setAddError(getCreateErrorMessage(error));
    } finally {
      setIsSubmittingAdd(false);
    }
  }, [
    addName,
    isSubmittingAdd,
    locations.length,
    resetAddForm,
    selectedSuggestion,
    syncLocations,
    token,
  ]);

  const removeLocation = useCallback(async (id: string) => {
    if (!token) {
      setApiError('You must be logged in to manage favorite locations.');
      return;
    }

    if (removingLocationId) return;

    setRemovingLocationId(id);
    setApiError(null);

    try {
      await deleteFavoriteLocation(id, token);
      setLocations((prev) => prev.filter((loc) => loc.id !== id));
    } catch (error) {
      if (
        error instanceof ApiError
        && error.code === 'favorite_location_not_found'
      ) {
        try {
          await syncLocations();
        } catch {
          // Preserve the primary mutation error if the follow-up sync also fails.
        }
      }

      setApiError(getDeleteErrorMessage(error));
    } finally {
      setRemovingLocationId((current) => (current === id ? null : current));
    }
  }, [removingLocationId, syncLocations, token]);

  const refresh = useCallback(async () => {
    await fetchLocations('refresh');
  }, [fetchLocations]);

  return {
    locations,
    isLoading,
    isRefreshing,
    apiError,
    isAddModalOpen,
    addName,
    addLocationQuery,
    addSuggestions,
    isSearchingSuggestions,
    selectedSuggestion,
    addError,
    isSubmittingAdd,
    removingLocationId,
    canAddMore,
    refresh,
    openAddModal,
    closeAddModal,
    setAddName: handleSetAddName,
    setAddLocationQuery: handleSetAddLocationQuery,
    selectSuggestion,
    submitAdd,
    removeLocation,
  };
}
