/**
 * @jest-environment jsdom
 *
 * Focused tests for the viewMode toggle introduced in useHomeViewModel.
 * The broader integration behaviour (events fetching, filters, location) is
 * covered by other tests; these tests pin only the new list/map toggle.
 */
import { act, renderHook } from '@testing-library/react';

// ── module-level mocks required by useHomeViewModel ───────────────────────────

jest.mock('@/services/eventService', () => ({
  listCategories: jest.fn().mockResolvedValue({ items: [] }),
  listEvents: jest.fn().mockResolvedValue({
    items: [],
    page_info: { has_next: false, next_cursor: null },
  }),
  searchLocation: jest.fn().mockResolvedValue({ results: [] }),
}));

jest.mock('@/services/profileService', () => ({
  getMyProfile: jest.fn().mockResolvedValue({
    default_location_address: null,
    default_location_lat: null,
    default_location_lon: null,
  }),
}));

jest.mock('@/services/favoriteService', () => ({
  listFavoriteLocations: jest.fn().mockResolvedValue({ items: [] }),
}));

jest.mock('@/services/deviceLocationService', () => ({
  getCurrentLocationSuggestion: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/services/homeLocationSelectionStore', () => ({
  getHomeLocationSelection: jest.fn().mockReturnValue({ mode: 'DEFAULT', location: null }),
  setHomeLocationSelection: jest.fn(),
}));

jest.mock('@/utils/eventLocation', () => ({
  formatEventLocation: (v: string) => v,
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token', user: { id: 'user-1' } }),
}));

// ── tests ──────────────────────────────────────────────────────────────────────

import { useHomeViewModel } from './useHomeViewModel';

describe('useHomeViewModel – viewMode toggle', () => {
  it('starts in LIST mode', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.viewMode).toBe('LIST');
  });

  it('switches to MAP mode when toggleViewMode is called once', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.toggleViewMode();
    });

    expect(result.current.viewMode).toBe('MAP');
  });

  it('switches back to LIST mode when toggleViewMode is called a second time', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.toggleViewMode();
    });

    act(() => {
      result.current.toggleViewMode();
    });

    expect(result.current.viewMode).toBe('LIST');
  });

  it('exposes activeLocation as numeric lat/lon based on the resolved location', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await act(async () => {
      await Promise.resolve();
    });

    expect(typeof result.current.activeLocation.lat).toBe('number');
    expect(typeof result.current.activeLocation.lon).toBe('number');
  });
});
