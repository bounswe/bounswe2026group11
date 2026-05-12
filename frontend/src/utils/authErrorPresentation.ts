import i18n from '@/i18n';
import { ApiError } from '@/services/api';

const AUTH_ERROR_TRANSLATION_KEYS: Record<string, string> = {
  invalid_credentials: 'errors.invalid_credentials',
  invalid_otp: 'errors.invalid_verification_code',
  otp_attempts_exceeded: 'errors.otp_attempts_exceeded',
  invalid_password_reset_token: 'errors.invalid_password_reset_token',
  email_already_exists: 'errors.email_in_use',
  username_already_exists: 'errors.username_in_use',
  phone_number_already_exists: 'errors.phone_in_use',
  rate_limited: 'errors.rate_limited',
  network_error: 'errors.unexpected',
};

function translateAuthValidationDetail(field: string, detail: string): string | null {
  switch (field) {
    case 'email':
      return detail === 'must be a valid email address' ? i18n.t('validation.email_invalid') : null;
    case 'username':
      if (detail === 'must be between 3 and 32 characters') return i18n.t('validation.username_between');
      if (detail === 'must be 3-32 characters using letters, numbers, or underscores') {
        return i18n.t('validation.username_backend_rule');
      }
      return null;
    case 'password':
    case 'new_password':
      return detail === 'must be between 8 and 128 characters'
        ? i18n.t('validation.password_between')
        : null;
    case 'otp':
      return detail === 'must be a 6-digit code' ? i18n.t('validation.otp_six_digits') : null;
    case 'phone_number':
      return detail === 'must be at most 32 characters' ? i18n.t('validation.phone_too_long') : null;
    case 'gender':
      return detail === 'must be one of: MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY'
        ? i18n.t('validation.gender_invalid')
        : null;
    case 'birth_date':
      return detail === 'must be in YYYY-MM-DD format' ? i18n.t('validation.birth_date_format') : null;
    case 'reset_token':
      return detail === 'must be between 32 and 512 characters'
        ? i18n.t('errors.invalid_password_reset_token')
        : null;
    default:
      return null;
  }
}

export function getAuthApiFieldErrors(error: ApiError): Record<string, string> {
  if (!error.details) return {};

  return Object.fromEntries(
    Object.entries(error.details)
      .map(([field, detail]) => [field, translateAuthValidationDetail(field, detail)] as const)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
  );
}

export function getAuthApiErrorMessage(error: ApiError): string {
  const translationKey = AUTH_ERROR_TRANSLATION_KEYS[error.code];
  if (translationKey) return i18n.t(translationKey);

  const firstFieldError = Object.values(getAuthApiFieldErrors(error))[0];
  if (firstFieldError) return firstFieldError;

  return error.message || i18n.t('errors.unexpected');
}
