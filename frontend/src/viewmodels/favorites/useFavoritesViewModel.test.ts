// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFavoritesViewModel } from './useFavoritesViewModel';

vi.mock('@/services/eventService', () => ({
  getFavoriteEvents: vi.fn(),
}));

import { getFavoriteEvents } from '@/services/eventService';
const mockGetFavorites = getFavoriteEvents as ReturnType<typeof vi.fn>;

function makeItem(id: string) {
  return {
    id,
    title: `Event ${id}`,
    category: 'Sports',
    image_url: null,
    status: 'ACTIVE',
    start_time: '2026-04-10T10:00:00Z',
    end_time: null,
    favorited_at: '2026-04-05T10:00:00Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useFavoritesViewModel', () => {
  it('returns favorited events', async () => {
    mockGetFavorites.mockResolvedValue([makeItem('1'), makeItem('2')]);

    const { result } = renderHook(() => useFavoritesViewModel('token'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('returns empty list when no favorites', async () => {
    mockGetFavorites.mockResolvedValue([]);

    const { result } = renderHook(() => useFavoritesViewModel('token'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items).toHaveLength(0);
  });

  it('sets error on failure', async () => {
    mockGetFavorites.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFavoritesViewModel('token'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.items).toHaveLength(0);
  });
});
