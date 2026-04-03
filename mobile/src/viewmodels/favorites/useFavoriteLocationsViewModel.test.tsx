/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import * as eventService from '@/services/eventService';
import { useFavoriteLocationsViewModel } from './useFavoriteLocationsViewModel';

jest.mock('@/services/eventService');

const mockSearchLocation = jest.mocked(eventService.searchLocation);

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

describe('useFavoriteLocationsViewModel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSearchLocation.mockResolvedValue([suggestionKadikoy, suggestionBesiktas]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens and closes add modal', () => {
    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    expect(result.current.isAddModalOpen).toBe(false);

    act(() => {
      result.current.openAddModal();
    });

    expect(result.current.isAddModalOpen).toBe(true);

    act(() => {
      result.current.closeAddModal();
    });

    expect(result.current.isAddModalOpen).toBe(false);
  });

  it('searches suggestions with debounce', async () => {
    const { result } = renderHook(() => useFavoriteLocationsViewModel());

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

  it('adds a location and keeps list alphabetically sorted', async () => {
    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    act(() => {
      result.current.openAddModal();
    });
    act(() => {
      result.current.setAddName('Work');
    });
    act(() => {
      result.current.selectSuggestion(suggestionKadikoy);
    });
    act(() => {
      result.current.submitAdd();
    });

    act(() => {
      result.current.openAddModal();
    });
    act(() => {
      result.current.setAddName('Home');
    });
    act(() => {
      result.current.selectSuggestion(suggestionBesiktas);
    });
    act(() => {
      result.current.submitAdd();
    });

    expect(result.current.locations.map((l) => l.name)).toEqual(['Home', 'Work']);
    expect(result.current.locations[0].lat).toBeCloseTo(41.0422);
    expect(result.current.locations[0].lon).toBeCloseTo(29.0083);
  });

  it('blocks submit with validation errors', () => {
    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    act(() => {
      result.current.openAddModal();
    });
    act(() => {
      result.current.submitAdd();
    });

    expect(result.current.addError).toBe('Please enter a name for this location.');

    act(() => {
      result.current.setAddName('Home');
    });
    act(() => {
      result.current.submitAdd();
    });

    expect(result.current.addError).toBe('Please search and select a location.');
  });

  it('enforces max 3 locations and disables further adding', () => {
    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    const add = (name: string, suggestion: typeof suggestionKadikoy) => {
      act(() => {
        result.current.openAddModal();
      });
      act(() => {
        result.current.setAddName(name);
      });
      act(() => {
        result.current.selectSuggestion(suggestion);
      });
      act(() => {
        result.current.submitAdd();
      });
    };

    add('Home', suggestionKadikoy);
    add('Work', suggestionBesiktas);
    add('Gym', suggestionKadikoy);

    expect(result.current.locations).toHaveLength(3);
    expect(result.current.canAddMore).toBe(false);

    act(() => {
      result.current.openAddModal();
    });

    expect(result.current.isAddModalOpen).toBe(false);
  });

  it('removes a location', () => {
    const { result } = renderHook(() => useFavoriteLocationsViewModel());

    act(() => {
      result.current.openAddModal();
    });
    act(() => {
      result.current.setAddName('Home');
    });
    act(() => {
      result.current.selectSuggestion(suggestionKadikoy);
    });
    act(() => {
      result.current.submitAdd();
    });

    const id = result.current.locations[0].id;

    act(() => {
      result.current.removeLocation(id);
    });

    expect(result.current.locations).toHaveLength(0);
    expect(result.current.canAddMore).toBe(true);
  });
});
