/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, render } from '@testing-library/react';
import type { HomeViewModel } from '@/viewmodels/home/useHomeViewModel';
import HomeView from './HomeView';
import { useHomeViewModel } from '@/viewmodels/home/useHomeViewModel';
import { useUnreadNotificationCount } from '@/viewmodels/notifications/useUnreadNotificationCount';

let latestFocusEffect: (() => void) | null = null;

jest.mock('expo-router', () => {
  const ReactLocal = require('react');
  return {
    router: {
      push: jest.fn(),
    },
    useFocusEffect: (callback: () => void) => {
      latestFocusEffect = callback;
      ReactLocal.useEffect(callback, [callback]);
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement('div', null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');
  return {
    Feather: ({ name }: { name: string }) =>
      ReactLocal.createElement('span', { 'data-icon': name }),
  };
});

jest.mock('@/components/common/SemLogo', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'SemLogo' });
});

jest.mock('@/components/home/HomeHeader', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'HomeHeader' });
});

jest.mock('@/components/home/SearchSection', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'SearchSection' });
});

jest.mock('@/components/home/EmptyState', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'EmptyState' });
});

jest.mock('@/components/home/LoadingState', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'LoadingState' });
});

jest.mock('@/components/events/EventCard', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'EventCard' });
});

jest.mock('@/components/home/FiltersBottomSheet', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'FiltersBottomSheet' });
});

jest.mock('@/components/home/EventMapView', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'EventMapView' });
});

jest.mock('@/components/home/CategoryChips', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'CategoryChips' });
});

jest.mock('@/components/home/LocationPickerPanel', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'LocationPickerPanel' });
});

jest.mock('@/theme', () => ({
  useTheme: () => ({
    isDark: false,
    setThemePreference: jest.fn().mockResolvedValue(undefined),
    theme: {
      background: '#FFFFFF',
      text: '#111827',
      textSecondary: '#4B5563',
      textTertiary: '#6B7280',
      textOnPrimary: '#FFFFFF',
      placeholder: '#9CA3AF',
      primary: '#2563EB',
      surface: '#FFFFFF',
      surfaceAlt: '#F3F4F6',
      border: '#E5E7EB',
      errorBg: '#FEF2F2',
      errorText: '#B91C1C',
      overlay: 'rgba(0,0,0,0.4)',
    },
  }),
}));

jest.mock('@/viewmodels/home/useHomeViewModel', () => ({
  useHomeViewModel: jest.fn(),
}));

jest.mock('@/viewmodels/notifications/useUnreadNotificationCount', () => ({
  useUnreadNotificationCount: jest.fn(),
}));

const mockUseHomeViewModel = jest.mocked(useHomeViewModel);
const mockUseUnreadNotificationCount = jest.mocked(useUnreadNotificationCount);

function buildViewModel(overrides: Partial<HomeViewModel> = {}): HomeViewModel {
  return {
    locationLabel: 'Besiktas, Istanbul',
    locationQuery: '',
    locationSuggestions: [],
    isSearchingLocation: false,
    isLocationModalOpen: false,
    pendingLocation: null,
    defaultLocationOption: {
      title: 'Default location',
      subtitle: 'Besiktas, Istanbul',
      suggestion: null,
      isLoading: false,
    },
    favoriteLocationOptions: [],
    isLoadingFavoriteLocations: false,
    favoriteLocationsError: null,
    categories: [],
    selectedCategoryIds: [],
    searchText: '',
    events: [],
    isLoading: true,
    isLoadingMore: false,
    isRefreshing: false,
    apiError: null,
    hasMore: false,
    isFilterModalOpen: false,
    filterDraft: {
      categoryIds: [],
      privacyLevels: [],
      startDate: '',
      endDate: '',
      radiusKm: 10,
      sortBy: 'START_TIME',
      childFriendly: false,
      familyOriented: false,
    },
    filterError: null,
    viewMode: 'LIST',
    activeLocation: { lat: 41.0422, lon: 29.0083 },
    currentLocation: null,
    toggleViewMode: jest.fn(),
    searchMapArea: jest.fn(),
    updateSearchText: jest.fn(),
    submitSearch: jest.fn(),
    toggleCategory: jest.fn(),
    clearSelectedCategories: jest.fn(),
    openFilterModal: jest.fn(),
    closeFilterModal: jest.fn(),
    resetFilterDraft: jest.fn(),
    applyFilterDraft: jest.fn(),
    toggleDraftCategory: jest.fn(),
    toggleDraftPrivacy: jest.fn(),
    updateDraftStartDate: jest.fn(),
    updateDraftEndDate: jest.fn(),
    updateDraftRadiusKm: jest.fn(),
    updateDraftSortBy: jest.fn(),
    toggleDraftChildFriendly: jest.fn(),
    toggleDraftFamilyOriented: jest.fn(),
    loadMoreEvents: jest.fn().mockResolvedValue(undefined),
    refreshEvents: jest.fn().mockResolvedValue(undefined),
    silentRefresh: jest.fn().mockResolvedValue(undefined),
    openLocationModal: jest.fn(),
    closeLocationModal: jest.fn(),
    updateLocationQuery: jest.fn(),
    selectSavedLocationOption: jest.fn(),
    selectLocationSuggestion: jest.fn(),
    applySelectedLocation: jest.fn(),
    resetLocationDraft: jest.fn(),
    retryFavoriteLocations: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('HomeView', () => {
  beforeEach(() => {
    latestFocusEffect = null;
    jest.clearAllMocks();
  });

  it('silently refreshes events when Home regains focus after the initial mount', () => {
    const silentRefresh = jest.fn().mockResolvedValue(undefined);
    const refreshUnreadCount = jest.fn().mockResolvedValue(undefined);

    mockUseHomeViewModel.mockReturnValue(buildViewModel({ silentRefresh }));
    mockUseUnreadNotificationCount.mockReturnValue({
      unreadCount: 0,
      refresh: refreshUnreadCount,
    });

    render(<HomeView />);

    expect(refreshUnreadCount).toHaveBeenCalledTimes(1);
    expect(silentRefresh).not.toHaveBeenCalled();

    act(() => {
      latestFocusEffect?.();
    });

    expect(refreshUnreadCount).toHaveBeenCalledTimes(2);
    expect(silentRefresh).toHaveBeenCalledTimes(1);
  });
});
