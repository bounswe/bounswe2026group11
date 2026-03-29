const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[A-Za-z0-9_]+$/;
const OTP_REGEX = /^[0-9]{6}$/;
const PHONE_REGEX = /^\+?[0-9\s\-()]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required.';
  if (!EMAIL_REGEX.test(email)) return 'Enter a valid email address.';
  if (email.length > 320) return 'Email is too long.';
  return null;
}

export function validateOtp(otp: string): string | null {
  if (!otp.trim()) return 'Verification code is required.';
  if (!OTP_REGEX.test(otp)) return 'Code must be exactly 6 digits.';
  return null;
}

export function validateUsername(username: string): string | null {
  if (!username.trim()) return 'Username is required.';
  if (username.length < 3) return 'Username must be at least 3 characters.';
  if (username.length > 32) return 'Username must be at most 32 characters.';
  if (!USERNAME_REGEX.test(username))
    return 'Only letters, numbers, and underscores are allowed.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password is too long.';
  return null;
}

export function validatePhoneNumber(phone: string): string | null {
  if (!phone.trim()) return null;
  if (phone.length > 32) return 'Phone number is too long.';
  if (!PHONE_REGEX.test(phone)) return 'Enter a valid phone number.';
  return null;
}

export function validateBirthDate(date: string): string | null {
  if (!date.trim()) return null;
  if (!DATE_REGEX.test(date)) return 'Use format YYYY-MM-DD.';
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return 'Enter a valid date.';
  if (parsed > new Date()) return 'Birth date cannot be in the future.';
  return null;
}
