import { useCallback, useRef, useState } from 'react';
import { FavoriteLocation } from '@/models/favorite';
import { LocationSuggestion } from '@/models/event';
import { searchLocation } from '@/services/eventService';

const MAX_FAVORITE_LOCATIONS = 3;

export interface FavoriteLocationsViewModel {
  locations: FavoriteLocation[];
  isAddModalOpen: boolean;
  addName: string;
  addLocationQuery: string;
  addSuggestions: LocationSuggestion[];
  isSearchingSuggestions: boolean;
  selectedSuggestion: LocationSuggestion | null;
  addError: string | null;
  canAddMore: boolean;

  openAddModal: () => void;
  closeAddModal: () => void;
  setAddName: (value: string) => void;
  setAddLocationQuery: (value: string) => void;
  selectSuggestion: (suggestion: LocationSuggestion) => void;
  submitAdd: () => void;
  removeLocation: (id: string) => void;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useFavoriteLocationsViewModel(): FavoriteLocationsViewModel {
  // TODO: replace with API-backed storage when backend endpoints are available
  const [locations, setLocations] = useState<FavoriteLocation[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addLocationQuery, setAddLocationQuery] = useState('');
  const [addSuggestions, setAddSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<LocationSuggestion | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canAddMore = locations.length < MAX_FAVORITE_LOCATIONS;

  const openAddModal = useCallback(() => {
    if (!canAddMore) return;
    setAddName('');
    setAddLocationQuery('');
    setAddSuggestions([]);
    setSelectedSuggestion(null);
    setAddError(null);
    setIsAddModalOpen(true);
  }, [canAddMore]);

  const closeAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setAddName('');
    setAddLocationQuery('');
    setAddSuggestions([]);
    setSelectedSuggestion(null);
    setAddError(null);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  }, []);

  const handleSetAddLocationQuery = useCallback((value: string) => {
    setAddLocationQuery(value);
    setSelectedSuggestion(null);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

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
      } finally {
        setIsSearchingSuggestions(false);
      }
    }, 300);
  }, []);

  const selectSuggestion = useCallback((suggestion: LocationSuggestion) => {
    setSelectedSuggestion(suggestion);
    setAddLocationQuery(suggestion.display_name);
    setAddSuggestions([]);
  }, []);

  const submitAdd = useCallback(() => {
    const trimmedName = addName.trim();

    if (!trimmedName) {
      setAddError('Please enter a name for this location.');
      return;
    }

    if (!selectedSuggestion) {
      setAddError('Please search and select a location.');
      return;
    }

    if (locations.length >= MAX_FAVORITE_LOCATIONS) {
      setAddError(`You can save up to ${MAX_FAVORITE_LOCATIONS} favorite locations.`);
      return;
    }

    const newLocation: FavoriteLocation = {
      id: generateId(),
      name: trimmedName,
      address: selectedSuggestion.display_name,
      lat: Number(selectedSuggestion.lat),
      lon: Number(selectedSuggestion.lon),
    };

    setLocations((prev) =>
      [...prev, newLocation].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setIsAddModalOpen(false);
    setAddName('');
    setAddLocationQuery('');
    setAddSuggestions([]);
    setSelectedSuggestion(null);
    setAddError(null);
  }, [addName, selectedSuggestion, locations.length]);

  const removeLocation = useCallback((id: string) => {
    setLocations((prev) => prev.filter((loc) => loc.id !== id));
  }, []);

  return {
    locations,
    isAddModalOpen,
    addName,
    addLocationQuery,
    addSuggestions,
    isSearchingSuggestions,
    selectedSuggestion,
    addError,
    canAddMore,
    openAddModal,
    closeAddModal,
    setAddName,
    setAddLocationQuery: handleSetAddLocationQuery,
    selectSuggestion,
    submitAdd,
    removeLocation,
  };
}
