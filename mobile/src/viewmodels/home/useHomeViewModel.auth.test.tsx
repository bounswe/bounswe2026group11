/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import * as deviceLocationService from '@/services/deviceLocationService';
import * as eventService from '@/services/eventService';
import * as favoriteService from '@/services/favoriteService';
import * as profileService from '@/services/profileService';
import { __resetHomeLocationSelectionStoreForTests } from '@/services/homeLocationSelectionStore';
import { useHomeViewModel } from './useHomeViewModel';

jest.mock('@/services/deviceLocationService');
jest.mock('@/services/eventService');
jest.mock('@/services/favoriteService');
jest.mock('@/services/profileService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: null,
    refreshToken: null,
    setSession: jest.fn(),
    clearAuth: jest.fn(),
  }),
}));

const mockGetCurrentLocationSuggestion = jest.mocked(
  deviceLocationService.getCurrentLocationSuggestion,
);
const mockListEvents = jest.mocked(eventService.listEvents);
const mockListCategories = jest.mocked(eventService.listCategories);
const mockListFavoriteLocations = jest.mocked(favoriteService.listFavoriteLocations);
const mockGetMyProfile = jest.mocked(profileService.getMyProfile);

describe('useHomeViewModel auth behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetHomeLocationSelectionStoreForTests();
    mockListCategories.mockResolvedValue({
      items: [
        { id: 1, name: 'Sports' },
        { id: 2, name: 'Music' },
      ],
    });
    mockGetCurrentLocationSuggestion.mockResolvedValue(null);
    mockListFavoriteLocations.mockResolvedValue({ items: [] });
  });

  it('shows auth error and skips event loading when token is missing', async () => {
    const { result } = renderHook(() => useHomeViewModel());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.apiError).toBe(
      'You must be logged in to view events.',
    );
    expect(result.current.events).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(mockListEvents).not.toHaveBeenCalled();
    expect(mockGetMyProfile).not.toHaveBeenCalled();
  });
});
