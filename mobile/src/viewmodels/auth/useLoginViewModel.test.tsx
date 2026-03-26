/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import * as authService from '@/services/authService';
import { ApiError } from '@/services/api';
import type { AuthSessionResponse } from '@/models/auth';
import {
  useLoginViewModel,
  type LoginViewModel,
} from './useLoginViewModel';

jest.mock('@/services/authService');

const mockLogin = jest.mocked(authService.login);

const validCredentials = {
  username: 'maplover',
  password: 'StrongPassword123',
};

async function fillForm(vm: LoginViewModel) {
  await act(async () => {
    vm.updateField('username', validCredentials.username);
    vm.updateField('password', validCredentials.password);
  });
}

const sessionFixture: AuthSessionResponse = {
  access_token: 'access',
  refresh_token: 'refresh',
  token_type: 'Bearer',
  expires_in_seconds: 900,
  user: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    username: 'maplover',
    email: 'user@example.com',
    phone_number: null,
    email_verified: true,
    status: 'active',
  },
};

describe('useLoginViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogin.mockResolvedValue(sessionFixture);
  });

  it('starts with empty form and no errors', () => {
    const { result } = renderHook(() => useLoginViewModel());
    expect(result.current.formData.username).toBe('');
    expect(result.current.formData.password).toBe('');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.apiError).toBeNull();
  });

  it('does not call API when validation fails', async () => {
    const { result } = renderHook(() => useLoginViewModel());

    await act(async () => {
      await result.current.handleLogin();
    });

    expect(mockLogin).not.toHaveBeenCalled();
    expect(result.current.errors.username).toBeTruthy();
    expect(result.current.errors.password).toBeTruthy();
  });

  it('clears field error and apiError when a field is updated', async () => {
    const { result } = renderHook(() => useLoginViewModel());

    await act(async () => {
      await result.current.handleLogin();
    });
    expect(result.current.errors.username).toBeTruthy();

    await act(async () => {
      result.current.updateField('username', 'a');
    });
    expect(result.current.errors.username).toBeNull();
  });

  it('returns session on successful login', async () => {
    const { result } = renderHook(() => useLoginViewModel());

    await fillForm(result.current);

    let session: AuthSessionResponse | null = null;
    await act(async () => {
      session = await result.current.handleLogin();
    });

    expect(mockLogin).toHaveBeenCalledWith({
      username: validCredentials.username,
      password: validCredentials.password,
    });
    expect(session).toEqual(sessionFixture);
    expect(result.current.apiError).toBeNull();
  });

  it('sets apiError on invalid credentials (401)', async () => {
    const { result } = renderHook(() => useLoginViewModel());

    mockLogin.mockRejectedValueOnce(
      new ApiError(401, {
        error: {
          code: 'invalid_credentials',
          message: 'Invalid username or password.',
        },
      }),
    );

    await fillForm(result.current);
    await act(async () => {
      await result.current.handleLogin();
    });

    expect(result.current.apiError).toBe('Invalid username or password.');
  });

  it('sets apiError on rate limit (429)', async () => {
    const { result } = renderHook(() => useLoginViewModel());

    mockLogin.mockRejectedValueOnce(
      new ApiError(429, {
        error: {
          code: 'rate_limited',
          message: 'Too many requests. Try again later.',
        },
      }),
    );

    await fillForm(result.current);
    await act(async () => {
      await result.current.handleLogin();
    });

    expect(result.current.apiError).toBe('Too many requests. Try again later.');
  });

  it('sets generic apiError on unexpected errors', async () => {
    const { result } = renderHook(() => useLoginViewModel());

    mockLogin.mockRejectedValueOnce(new Error('Network failure'));

    await fillForm(result.current);
    await act(async () => {
      await result.current.handleLogin();
    });

    expect(result.current.apiError).toBe(
      'An unexpected error occurred. Please try again.',
    );
  });

  it('returns null when login fails', async () => {
    const { result } = renderHook(() => useLoginViewModel());

    mockLogin.mockRejectedValueOnce(
      new ApiError(401, {
        error: {
          code: 'invalid_credentials',
          message: 'Invalid username or password.',
        },
      }),
    );

    await fillForm(result.current);

    let session: AuthSessionResponse | null = null;
    await act(async () => {
      session = await result.current.handleLogin();
    });

    expect(session).toBeNull();
  });
});
