import { describe, expect, it } from 'vitest';

import {
  validateBirthDate,
  validateEmail,
  validateOtp,
  validatePhoneNumber,
  validateUsername,
} from './validators';

describe('validators', () => {
  it('accepts a valid email', () => {
    expect(validateEmail('demo@example.com')).toBeNull();
  });

  it('rejects an invalid otp', () => {
    expect(validateOtp('12345')).toBe('Code must be exactly 6 digits.');
  });

  it('rejects usernames with unsupported characters', () => {
    expect(validateUsername('demo-user')).toBe(
      'Only letters, numbers, and underscores are allowed.',
    );
  });

  it('allows blank phone numbers but rejects malformed input', () => {
    expect(validatePhoneNumber('')).toBeNull();
    expect(validatePhoneNumber('abc')).toBe('Enter a valid phone number.');
  });

  it('rejects future birth dates', () => {
    expect(validateBirthDate('2999-01-01')).toBe(
      'Birth date cannot be in the future.',
    );
  });
});
