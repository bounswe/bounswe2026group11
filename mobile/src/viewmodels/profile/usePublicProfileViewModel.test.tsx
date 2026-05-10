/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import * as profileService from '@/services/profileService';
import { ApiError } from '@/services/api';
import { PublicProfile, BadgeItem } from '@/models/profile';
import { usePublicProfileViewModel } from './usePublicProfileViewModel';

jest.mock('@/services/profileService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '@/contexts/AuthContext';

const mockGetPublicProfile = jest.mocked(profileService.getPublicProfile);
const mockGetBadgeCatalog = jest.mocked(profileService.getBadgeCatalog);
const mockGetUserBadges = jest.mocked(profileService.getUserBadges);
const mockUseAuth = jest.mocked(useAuth);

const publicProfileFixture: PublicProfile = {
  user_id: 'user-123',
  username: 'jane_doe',
  display_name: 'Jane Doe',
  avatar_url: 'https://example.com/avatar.jpg',
  bio: 'Hiking enthusiast',
  final_score: 4.5,
  host_rating_count: 10,
  participant_rating_count: 15,
  equipment: [
    { id: 'eq-1', name: 'Backpack', description: '60L', image_url: null }
  ],
  showcase_images: [
    { id: 'img-1', image_url: 'https://example.com/showcase1.jpg' }
  ]
};

describe('usePublicProfileViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: 'test-token',
    } as any);
    mockGetPublicProfile.mockResolvedValue(publicProfileFixture);
    mockGetBadgeCatalog.mockResolvedValue({ items: [] });
    mockGetUserBadges.mockResolvedValue({ items: [] });
  });

  it('fetches and exposes public profile data on mount', async () => {
    const { result } = renderHook(() => usePublicProfileViewModel('user-123'));

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await Promise.resolve(); // Wait for useEffect
    });

    expect(mockGetPublicProfile).toHaveBeenCalledWith('user-123', 'test-token');
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.profile).toEqual(publicProfileFixture);
    expect(result.current.primaryName).toBe('Jane Doe');
    expect(result.current.secondaryName).toBe('jane_doe');
    expect(result.current.overallRatingLabel).toBe('4.5');
  });

  it('handles API errors gracefully', async () => {
    mockGetPublicProfile.mockRejectedValue(new ApiError(404, { 
      error: { code: 'not_found', message: 'User not found' } 
    }));

    const { result } = renderHook(() => usePublicProfileViewModel('unknown'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('User not found');
    expect(result.current.profile).toBeNull();
  });

  it('can refresh data', async () => {
    const { result } = renderHook(() => usePublicProfileViewModel('user-123'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockGetPublicProfile).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetPublicProfile).toHaveBeenCalledTimes(2);
  });

  it('derives avatar initial correctly', async () => {
    mockGetPublicProfile.mockResolvedValue({
      ...publicProfileFixture,
      display_name: null,
      username: 'awesome_user'
    });

    const { result } = renderHook(() => usePublicProfileViewModel('user-123'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.primaryName).toBe('awesome_user');
    expect(result.current.avatarInitial).toBe('A');
  });
});
