import { useState, useEffect, useCallback, useRef } from 'react';
import { profileService } from '@/services/profileService';
import { searchLocation } from '@/services/eventService';
import type { FavoriteLocation } from '@/models/profile';
import type { LocationSuggestion } from '@/models/event';
import { ApiError } from '@/services/api';

const MAX_LOCATIONS = 3;
const SEARCH_DEBOUNCE_MS = 300;

export function useFavoriteLocationsViewModel(token: string | null) {
  const [locations, setLocations] = useState<FavoriteLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addQuery, setAddQuery] = useState('');
  const [addSuggestions, setAddSuggestions] = useState<LocationSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<LocationSuggestion | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canAddMore = locations.length < MAX_LOCATIONS;

  const fetchLocations = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await profileService.getFavoriteLocations(token);
      setLocations(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load favorite locations.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Debounced location search
  const handleSearchChange = useCallback((query: string) => {
    setAddQuery(query);
    setSelectedSuggestion(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (query.trim().length < 2) {
      setAddSuggestions([]);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchLocation(query);
        setAddSuggestions(results);
      } catch {
        setAddSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const selectSuggestion = useCallback((suggestion: LocationSuggestion) => {
    setSelectedSuggestion(suggestion);
    setAddQuery(suggestion.display_name);
    setAddSuggestions([]);
  }, []);

  const openAddModal = useCallback(() => {
    setAddName('');
    setAddQuery('');
    setAddSuggestions([]);
    setSelectedSuggestion(null);
    setAddError(null);
    setShowAddModal(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setShowAddModal(false);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  const handleAdd = useCallback(async () => {
    if (!token || !selectedSuggestion || !addName.trim()) return;
    setIsSubmitting(true);
    setAddError(null);
    try {
      await profileService.createFavoriteLocation({
        name: addName.trim(),
        address: selectedSuggestion.display_name,
        lat: parseFloat(selectedSuggestion.lat),
        lon: parseFloat(selectedSuggestion.lon),
      }, token);
      await fetchLocations();
      closeAddModal();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'favorite_location_limit_exceeded') {
          setAddError('You can save up to 3 favorite locations.');
        } else {
          setAddError(err.message);
        }
      } else {
        setAddError('Failed to save location. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [token, selectedSuggestion, addName, fetchLocations, closeAddModal]);

  const handleRemove = useCallback(async (id: string) => {
    if (!token) return;
    setRemovingId(id);
    try {
      await profileService.deleteFavoriteLocation(id, token);
      setLocations((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove location.');
    } finally {
      setRemovingId(null);
    }
  }, [token]);

  return {
    locations,
    isLoading,
    error,
    canAddMore,
    maxLocations: MAX_LOCATIONS,
    showAddModal,
    addName,
    setAddName,
    addQuery,
    handleSearchChange,
    addSuggestions,
    selectedSuggestion,
    selectSuggestion,
    isSearching,
    isSubmitting,
    addError,
    removingId,
    openAddModal,
    closeAddModal,
    handleAdd,
    handleRemove,
    retry: fetchLocations,
  };
}
