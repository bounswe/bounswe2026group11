import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/services/api';

import { AuthProvider, useAuth } from './AuthContext';

const getMyProfileMock = vi.fn();

vi.mock('@/services/profileService', () => ({
  profileService: {
    getMyProfile: (...args: unknown[]) => getMyProfileMock(...args),
  },
}));

describe('AuthContext', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getMyProfileMock.mockReset();
  });

  it('clears a stale session when the current user profile is not found', async () => {
    window.localStorage.setItem('sem_access_token', 'header.payload.signature');
    window.localStorage.setItem('sem_refresh_token', 'refresh-token');
    window.localStorage.setItem('sem_username', 'stale-user');
    window.localStorage.setItem('sem_role', 'USER');

    getMyProfileMock.mockRejectedValue(
      new ApiError(404, {
        error: {
          code: 'not_found',
          message: 'not found',
        },
      }),
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.token).toBeNull();
    });

    expect(window.localStorage.getItem('sem_access_token')).toBeNull();
    expect(window.localStorage.getItem('sem_refresh_token')).toBeNull();
    expect(window.localStorage.getItem('sem_username')).toBeNull();
  });
});
