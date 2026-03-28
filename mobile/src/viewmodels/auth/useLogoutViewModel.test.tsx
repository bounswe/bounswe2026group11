/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import * as authService from '@/services/authService';
import { ApiError } from '@/services/api';
import { useLogoutViewModel } from './useLogoutViewModel';

jest.mock('@/services/authService');

const mockLogout = jest.mocked(authService.logout);

describe('useLogoutViewModel', () => {
  let onLoggedOut: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
    onLoggedOut = jest.fn();
  });

  // ─── Initial state ───
  it('starts with isLoggingOut false and no error', () => {
    const { result } = renderHook(() =>
      useLogoutViewModel('refresh-token', onLoggedOut),
    );
    expect(result.current.isLoggingOut).toBe(false);
    expect(result.current.logoutError).toBeNull();
  });

  // ─── No refresh token ───
  it('calls onLoggedOut immediately when refreshToken is null', async () => {
    const { result } = renderHook(() =>
      useLogoutViewModel(null, onLoggedOut),
    );

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(mockLogout).not.toHaveBeenCalled();
    expect(onLoggedOut).toHaveBeenCalledTimes(1);
    expect(result.current.isLoggingOut).toBe(false);
    expect(result.current.logoutError).toBeNull();
  });

  // ─── Successful logout ───
  it('calls logout API with refresh_token and invokes onLoggedOut on success', async () => {
    const { result } = renderHook(() =>
      useLogoutViewModel('my-refresh-token', onLoggedOut),
    );

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalledWith({
      refresh_token: 'my-refresh-token',
    });
    expect(onLoggedOut).toHaveBeenCalledTimes(1);
    expect(result.current.isLoggingOut).toBe(false);
    expect(result.current.logoutError).toBeNull();
  });

  // ─── 401 – token already invalid ───
  it('still calls onLoggedOut when server returns 401', async () => {
    mockLogout.mockRejectedValueOnce(
      new ApiError(401, {
        error: {
          code: 'invalid_token',
          message: 'Token has been revoked.',
        },
      }),
    );

    const { result } = renderHook(() =>
      useLogoutViewModel('expired-token', onLoggedOut),
    );

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(onLoggedOut).toHaveBeenCalledTimes(1);
    expect(result.current.logoutError).toBeNull();
    expect(result.current.isLoggingOut).toBe(false);
  });

  // ─── Other API error ───
  it('shows API error message and does not call onLoggedOut on non-401 API error', async () => {
    mockLogout.mockRejectedValueOnce(
      new ApiError(500, {
        error: {
          code: 'internal_error',
          message: 'Something went wrong on the server.',
        },
      }),
    );

    const { result } = renderHook(() =>
      useLogoutViewModel('valid-token', onLoggedOut),
    );

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(onLoggedOut).not.toHaveBeenCalled();
    expect(result.current.logoutError).toBe(
      'Something went wrong on the server.',
    );
    expect(result.current.isLoggingOut).toBe(false);
  });

  // ─── Network / unexpected error ───
  it('shows generic error message on network failure', async () => {
    mockLogout.mockRejectedValueOnce(new Error('Network request failed'));

    const { result } = renderHook(() =>
      useLogoutViewModel('valid-token', onLoggedOut),
    );

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(onLoggedOut).not.toHaveBeenCalled();
    expect(result.current.logoutError).toBe(
      'Could not reach the server. Please try again.',
    );
    expect(result.current.isLoggingOut).toBe(false);
  });

  // ─── Error cleared on retry ───
  it('clears previous error when handleLogout is called again', async () => {
    mockLogout.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() =>
      useLogoutViewModel('valid-token', onLoggedOut),
    );

    await act(async () => {
      await result.current.handleLogout();
    });
    expect(result.current.logoutError).toBeTruthy();

    mockLogout.mockResolvedValueOnce(undefined);
    await act(async () => {
      await result.current.handleLogout();
    });

    expect(result.current.logoutError).toBeNull();
    expect(onLoggedOut).toHaveBeenCalledTimes(1);
  });

  // ─── 403 error ───
  it('shows error and blocks logout on 403 forbidden', async () => {
    mockLogout.mockRejectedValueOnce(
      new ApiError(403, {
        error: {
          code: 'forbidden',
          message: 'You are not allowed to perform this action.',
        },
      }),
    );

    const { result } = renderHook(() =>
      useLogoutViewModel('valid-token', onLoggedOut),
    );

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(onLoggedOut).not.toHaveBeenCalled();
    expect(result.current.logoutError).toBe(
      'You are not allowed to perform this action.',
    );
  });
});
