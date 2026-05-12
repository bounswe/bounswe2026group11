// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authService from '@/services/authService';
import { ApiError } from '@/services/api';
import { setCurrentLocale } from '@/i18n';
import { useLoginViewModel } from './useLoginViewModel';

vi.mock('@/services/authService');

const mockLogin = vi.mocked(authService.login);

describe('useLoginViewModel', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setCurrentLocale('tr');
  });

  it('localizes invalid credential errors from the backend', async () => {
    mockLogin.mockRejectedValue(
      new ApiError(401, {
        error: {
          code: 'invalid_credentials',
          message: 'Invalid username or password.',
        },
      }),
    );

    const { result } = renderHook(() => useLoginViewModel());

    await act(async () => {
      result.current.updateField('username', 'demo_user');
      result.current.updateField('password', 'Password1x');
    });

    await act(async () => {
      await result.current.handleLogin();
    });

    expect(result.current.apiError).toBe('Kullanıcı adı veya şifre hatalı.');
  });
});
