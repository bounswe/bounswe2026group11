// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authService from '@/services/authService';
import type { AuthSessionResponse } from '@/models/auth';
import { useRegisterViewModel } from './useRegisterViewModel';

vi.mock('@/services/authService');

const mockCheck = vi.mocked(authService.checkRegistrationAvailability);
const mockRequestOtp = vi.mocked(authService.requestRegistrationOtp);
const mockVerify = vi.mocked(authService.verifyRegistration);

const validDetails = {
  email: 'new@example.com',
  username: 'newuser',
  password: 'Password1x',
  phone_number: '',
  gender: 'FEMALE' as const,
  birth_date: '1998-05-14',
};

const sessionFixture: AuthSessionResponse = {
  access_token: 'access',
  refresh_token: 'refresh',
  token_type: 'Bearer',
  expires_in_seconds: 900,
  user: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    username: 'newuser',
    email: 'new@example.com',
    phone_number: null,
    email_verified: true,
    status: 'active',
    role: 'USER',
  },
};

async function fillDetailsForm(vm: ReturnType<typeof useRegisterViewModel>) {
  await act(async () => {
    vm.updateField('email', validDetails.email);
    vm.updateField('username', validDetails.username);
    vm.updateField('password', validDetails.password);
    vm.updateField('phone_number', validDetails.phone_number);
    vm.updateField('gender', validDetails.gender);
    vm.updateField('birth_date', validDetails.birth_date);
  });
}

describe('useRegisterViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheck.mockResolvedValue({
      username: 'AVAILABLE',
      email: 'AVAILABLE',
    });
    mockRequestOtp.mockResolvedValue({
      status: 'accepted',
      message: 'ok',
    });
    mockVerify.mockResolvedValue(sessionFixture);
  });

  it('requires gender and birth date before requesting OTP', async () => {
    const { result } = renderHook(() => useRegisterViewModel());

    await act(async () => {
      result.current.updateField('email', validDetails.email);
      result.current.updateField('username', validDetails.username);
      result.current.updateField('password', validDetails.password);
      await result.current.handleSubmitDetails();
    });

    expect(mockCheck).not.toHaveBeenCalled();
    expect(mockRequestOtp).not.toHaveBeenCalled();
    expect(result.current.errors.gender).toBe('Gender is required.');
    expect(result.current.errors.birth_date).toBe('Birth date is required.');
  });

  it('sends required gender and birth date when OTP verify succeeds', async () => {
    const { result } = renderHook(() => useRegisterViewModel());

    await fillDetailsForm(result.current);
    await act(async () => {
      await result.current.handleSubmitDetails();
    });
    await act(async () => {
      result.current.updateField('otp', '123456');
    });

    await act(async () => {
      await result.current.handleVerifyOtp();
    });

    expect(mockVerify).toHaveBeenCalledWith({
      email: validDetails.email,
      otp: '123456',
      username: validDetails.username,
      password: validDetails.password,
      phone_number: null,
      gender: validDetails.gender,
      birth_date: validDetails.birth_date,
    });
  });
});
