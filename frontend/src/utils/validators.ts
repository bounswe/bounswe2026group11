import i18n from '@/i18n';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[A-Za-z0-9_]+$/;
const OTP_REGEX = /^[0-9]{6}$/;
const PHONE_REGEX = /^\+?[0-9\s\-()]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return i18n.t('validation.email_required');
  if (!EMAIL_REGEX.test(email)) return i18n.t('validation.email_invalid');
  if (email.length > 320) return i18n.t('validation.email_too_long');
  return null;
}

export function validateOtp(otp: string): string | null {
  if (!otp.trim()) return i18n.t('validation.otp_required');
  if (!OTP_REGEX.test(otp)) return i18n.t('validation.otp_six_digits');
  return null;
}

export function validateUsername(username: string): string | null {
  if (!username.trim()) return i18n.t('validation.username_required');
  if (username.length < 3) return i18n.t('validation.username_min');
  if (username.length > 32) return i18n.t('validation.username_max');
  if (!USERNAME_REGEX.test(username))
    return i18n.t('validation.username_invalid');
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return i18n.t('validation.password_required');
  if (password.length < 8) return i18n.t('validation.password_min');
  if (password.length > 128) return i18n.t('validation.password_too_long');
  return null;
}

export function validatePhoneNumber(phone: string): string | null {
  if (!phone.trim()) return null;
  if (phone.length > 32) return i18n.t('validation.phone_too_long');
  if (!PHONE_REGEX.test(phone)) return i18n.t('validation.phone_invalid');
  return null;
}

export function validateBirthDate(date: string): string | null {
  if (!date.trim()) return null;
  if (!DATE_REGEX.test(date)) return i18n.t('validation.birth_date_format');
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return i18n.t('validation.birth_date_invalid');
  if (parsed > new Date()) return i18n.t('validation.birth_date_future');
  return null;
}
