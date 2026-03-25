import {
  validateEmail,
  validateOtp,
  validateUsername,
  validatePassword,
  validatePhoneNumber,
  validateBirthDate,
} from './validators';

describe('validateEmail', () => {
  it('returns null for a valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('rejects empty or whitespace-only', () => {
    expect(validateEmail('')).toBe('Email is required.');
    expect(validateEmail('   ')).toBe('Email is required.');
  });

  it('rejects invalid format', () => {
    expect(validateEmail('not-an-email')).toBe('Enter a valid email address.');
  });

  it('rejects when longer than 320 chars', () => {
    const local = 'a'.repeat(315);
    expect(validateEmail(`${local}@x.com`)).toBe('Email is too long.');
  });
});

describe('validateOtp', () => {
  it('returns null for six digits', () => {
    expect(validateOtp('123456')).toBeNull();
  });

  it('rejects empty', () => {
    expect(validateOtp('')).toBe('Verification code is required.');
  });

  it('rejects wrong length or non-digits', () => {
    expect(validateOtp('12345')).toBe('Code must be exactly 6 digits.');
    expect(validateOtp('1234567')).toBe('Code must be exactly 6 digits.');
    expect(validateOtp('12345a')).toBe('Code must be exactly 6 digits.');
  });
});

describe('validateUsername', () => {
  it('returns null for valid username', () => {
    expect(validateUsername('map_lover1')).toBeNull();
  });

  it('rejects empty', () => {
    expect(validateUsername('')).toBe('Username is required.');
  });

  it('rejects invalid length', () => {
    expect(validateUsername('ab')).toBe('Username must be at least 3 characters.');
    expect(validateUsername('a'.repeat(33))).toBe(
      'Username must be at most 32 characters.',
    );
  });

  it('rejects invalid characters', () => {
    expect(validateUsername('map-lover')).toBe(
      'Only letters, numbers, and underscores are allowed.',
    );
  });
});

describe('validatePassword', () => {
  it('returns null for valid length', () => {
    expect(validatePassword('Password1')).toBeNull();
  });

  it('rejects empty', () => {
    expect(validatePassword('')).toBe('Password is required.');
  });

  it('rejects too short or too long', () => {
    expect(validatePassword('short1')).toBe(
      'Password must be at least 8 characters.',
    );
    expect(validatePassword('a'.repeat(129))).toBe('Password is too long.');
  });
});

describe('validatePhoneNumber', () => {
  it('returns null when empty (optional)', () => {
    expect(validatePhoneNumber('')).toBeNull();
    expect(validatePhoneNumber('  ')).toBeNull();
  });

  it('returns null for plausible numbers', () => {
    expect(validatePhoneNumber('+905551112233')).toBeNull();
    expect(validatePhoneNumber('555-111-2233')).toBeNull();
  });

  it('rejects too long', () => {
    expect(validatePhoneNumber('1'.repeat(33))).toBe('Phone number is too long.');
  });

  it('rejects invalid characters', () => {
    expect(validatePhoneNumber('abc')).toBe('Enter a valid phone number.');
  });
});

describe('validateBirthDate', () => {
  it('returns null when empty (optional)', () => {
    expect(validateBirthDate('')).toBeNull();
  });

  it('returns null for valid past date', () => {
    expect(validateBirthDate('1998-05-14')).toBeNull();
  });

  it('rejects wrong format', () => {
    expect(validateBirthDate('14-05-1998')).toBe('Use format YYYY-MM-DD.');
  });

  it('rejects future dates', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const y = future.getFullYear();
    const m = String(future.getMonth() + 1).padStart(2, '0');
    const d = String(future.getDate()).padStart(2, '0');
    expect(validateBirthDate(`${y}-${m}-${d}`)).toBe(
      'Birth date cannot be in the future.',
    );
  });
});
