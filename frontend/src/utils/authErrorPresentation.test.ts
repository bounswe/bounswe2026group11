import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '@/services/api';
import { setCurrentLocale } from '@/i18n';
import { getAuthApiErrorMessage, getAuthApiFieldErrors } from './authErrorPresentation';

describe('authErrorPresentation', () => {
  beforeEach(async () => {
    await setCurrentLocale('tr');
  });

  it('translates auth error codes for banner messages', () => {
    const error = new ApiError(401, {
      error: {
        code: 'invalid_credentials',
        message: 'Invalid username or password.',
      },
    });

    expect(getAuthApiErrorMessage(error)).toBe('Kullanıcı adı veya şifre hatalı.');
  });

  it('translates backend validation details into field errors', () => {
    const error = new ApiError(400, {
      error: {
        code: 'validation_error',
        message: 'The request body contains invalid fields.',
        details: {
          username: 'must be between 3 and 32 characters',
          password: 'must be between 8 and 128 characters',
        },
      },
    });

    expect(getAuthApiFieldErrors(error)).toEqual({
      username: 'Kullanıcı adı 3 ile 32 karakter arasında olmalı.',
      password: 'Şifre 8 ile 128 karakter arasında olmalı.',
    });
  });
});
