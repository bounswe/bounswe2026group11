/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import * as eventService from '@/services/eventService';
import { useHomeViewModel } from './useHomeViewModel';

jest.mock('@/services/eventService');
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    token: null,
    refreshToken: null,
    setSession: jest.fn(),
    clearAuth: jest.fn(),
  }),
}));

const mockListEvents = jest.mocked(eventService.listEvents);
const mockListCategories = jest.mocked(eventService.listCategories);

describe('useHomeViewModel auth behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListCategories.mockResolvedValue({
      items: [
        { id: 1, name: 'Sports' },
        { id: 2, name: 'Music' },
      ],
    });
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
  });
});