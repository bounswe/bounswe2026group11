/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { ApiError } from '@/services/api';
import * as eventService from '@/services/eventService';
import * as favoriteService from '@/services/favoriteService';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoriteLocationsViewModel } from './useFavoriteLocationsViewModel';

jest.mock('@/services/eventService');
jest.mock('@/services/favoriteService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockSearchLocation = jest.mocked(eventService.searchLocation);
const mockListFavoriteLocations = jest.mocked(favoriteService.listFavoriteLocations);
const mockCreateFavoriteLocation = jest.mocked(favoriteService.createFavoriteLocation);
const mockDeleteFavoriteLocation = jest.mocked(favoriteService.deleteFavoriteLocation);
const mockUseAuth = jest.mocked(useAuth);

const suggestionKadikoy = {
  display_name: 'Kadikoy, Istanbul, Turkiye',
  lat: '40.9909',
  lon: '29.0293',
};

const suggestionBesiktas = {
  display_name: 'Besiktas, Istanbul, Turkiye',
  lat: '41.0422',
  lon: '29.0083',
};

function makeLocation(id: string, name: string) {
  return {
    id,
    name,
    address: `${name} address`,
    lat: 41 + Number(id) / 100,
    lon: 29 + Number(id) / 100,
  };
}

describe('useFavoriteLocationsViewModel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      token: 'mock-token',
      refreshToken: 'mock-refresh-token',
      user: null,
      setSession: jest.fn(),
      clearAuth: jest.fn(),
    });

    mockSearchLocation.mockResolvedValue([suggestionKadikoy, suggestionBesiktas]);
    mockListFavoriteLocations.mockResolvedValue({
      items: [makeLocation('2', 'Work'), makeLocation('1', 'Home')],
    });
    mockCreateFavoriteLocation.mockResolvedValue(makeLocation('3', 'Gym'));
    mockDeleteFavoriteLocation.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads favorite locations on mount and keeps them sorted alphabetically', async () => {
    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListFavoriteLocations).toHaveBeenCalledWith('mock-token');
    expect(result.current.locations.map((location) => location.name)).toEqual([
      'Home',
      'Work',
    ]);
    expect(result.current.canAddMore).toBe(true);
  });

  it('opens and closes the add modal when the user can still add more locations', async () => {
    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openAddModal();
    });

    expect(result.current.isAddModalOpen).toBe(true);

    act(() => {
      result.current.closeAddModal();
    });

    expect(result.current.isAddModalOpen).toBe(false);
  });

  it('searches address suggestions with debounce', async () => {
    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setAddLocationQuery('Kadikoy');
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockSearchLocation).toHaveBeenCalledWith('Kadikoy');
    });

    expect(result.current.addSuggestions).toHaveLength(2);
  });

  it('creates a favorite location through the API and keeps the list sorted', async () => {
    mockListFavoriteLocations.mockResolvedValueOnce({
      items: [makeLocation('2', 'Work')],
    });
    mockCreateFavoriteLocation.mockResolvedValueOnce(makeLocation('1', 'Home'));

    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openAddModal();
      result.current.setAddName('Home');
      result.current.selectSuggestion(suggestionBesiktas);
    });

    await act(async () => {
      await result.current.submitAdd();
    });

    expect(mockCreateFavoriteLocation).toHaveBeenCalledWith(
      {
        name: 'Home',
        address: suggestionBesiktas.display_name,
        lat: 41.0422,
        lon: 29.0083,
      },
      'mock-token',
    );
    expect(result.current.locations.map((location) => location.name)).toEqual([
      'Home',
      'Work',
    ]);
    expect(result.current.isAddModalOpen).toBe(false);
    expect(result.current.addError).toBeNull();
  });

  it('blocks submit with validation errors before calling the API', async () => {
    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openAddModal();
    });

    await act(async () => {
      await result.current.submitAdd();
    });

    expect(result.current.addError).toBe('Please enter a name for this location.');
    expect(mockCreateFavoriteLocation).not.toHaveBeenCalled();

    act(() => {
      result.current.setAddName('Home');
    });

    await act(async () => {
      await result.current.submitAdd();
    });

    expect(result.current.addError).toBe('Please search and select a location.');
    expect(mockCreateFavoriteLocation).not.toHaveBeenCalled();
  });

  it('enforces the max 3 rule based on the backend response', async () => {
    mockListFavoriteLocations.mockResolvedValueOnce({
      items: [
        makeLocation('1', 'Home'),
        makeLocation('2', 'Work'),
        makeLocation('3', 'Gym'),
      ],
    });

    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.locations).toHaveLength(3);
    expect(result.current.canAddMore).toBe(false);

    act(() => {
      result.current.openAddModal();
    });

    expect(result.current.isAddModalOpen).toBe(false);
  });

  it('syncs with the backend when create returns the favorite-location limit error', async () => {
    mockListFavoriteLocations
      .mockResolvedValueOnce({
        items: [makeLocation('1', 'Home'), makeLocation('2', 'Work')],
      })
      .mockResolvedValueOnce({
        items: [
          makeLocation('1', 'Home'),
          makeLocation('3', 'Library'),
          makeLocation('2', 'Work'),
        ],
      });
    mockCreateFavoriteLocation.mockRejectedValueOnce(
      new ApiError(409, {
        error: {
          code: 'favorite_location_limit_exceeded',
          message: 'Users can save at most 3 favorite locations.',
        },
      }),
    );

    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.openAddModal();
      result.current.setAddName('Gym');
      result.current.selectSuggestion(suggestionKadikoy);
    });

    await act(async () => {
      await result.current.submitAdd();
    });

    expect(result.current.addError).toBe('You can save up to 3 favorite locations.');
    expect(result.current.locations.map((location) => location.name)).toEqual([
      'Home',
      'Library',
      'Work',
    ]);
    expect(result.current.canAddMore).toBe(false);
  });

  it('removes a location through the API', async () => {
    mockListFavoriteLocations.mockResolvedValueOnce({
      items: [makeLocation('1', 'Home')],
    });

    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.removeLocation('1');
    });

    expect(mockDeleteFavoriteLocation).toHaveBeenCalledWith('1', 'mock-token');
    expect(result.current.locations).toHaveLength(0);
    expect(result.current.canAddMore).toBe(true);
  });

  it('sets apiError when loading favorite locations fails', async () => {
    mockListFavoriteLocations.mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.apiError).toBe(
      'Failed to load favorite locations. Please try again.',
    );
    expect(result.current.locations).toEqual([]);
  });

  it('shows a logged-out error without calling the backend', async () => {
    mockUseAuth.mockReturnValue({
      token: null,
      refreshToken: null,
      user: null,
      setSession: jest.fn(),
      clearAuth: jest.fn(),
    });

    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockListFavoriteLocations).not.toHaveBeenCalled();
    expect(result.current.apiError).toBe(
      'You must be logged in to view favorite locations.',
    );
    expect(result.current.canAddMore).toBe(false);
  });
});
