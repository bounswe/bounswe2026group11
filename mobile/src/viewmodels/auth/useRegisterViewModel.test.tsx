/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import * as authService from '@/services/authService';
import { ApiError } from '@/services/api';
import type { AuthSessionResponse } from '@/models/auth';
import {
  useRegisterViewModel,
  type RegisterViewModel,
} from './useRegisterViewModel';

jest.mock('@/services/authService');

const mockCheck = jest.mocked(authService.checkRegistrationAvailability);
const mockRequestOtp = jest.mocked(authService.requestRegistrationOtp);
const mockVerify = jest.mocked(authService.verifyRegistration);

const validDetails = {
  email: 'new@example.com',
  username: 'newuser',
  password: 'Password1x',
  phone_number: '',
  birth_date: '',
};

async function fillDetailsForm(vm: RegisterViewModel) {
  await act(async () => {
    vm.updateField('email', validDetails.email);
    vm.updateField('username', validDetails.username);
    vm.updateField('password', validDetails.password);
    vm.updateField('phone_number', validDetails.phone_number);
    vm.updateField('birth_date', validDetails.birth_date);
  });
}

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
  },
};

describe('useRegisterViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('starts on details step with empty form', () => {
    const { result } = renderHook(() => useRegisterViewModel());
    expect(result.current.step).toBe('details');
    expect(result.current.formData.email).toBe('');
    expect(result.current.isLoading).toBe(false);
  });

  it('does not call API when validation fails on submit details', async () => {
    const { result } = renderHook(() => useRegisterViewModel());

    await act(async () => {
      await result.current.handleSubmitDetails();
    });

    expect(mockCheck).not.toHaveBeenCalled();
    expect(mockRequestOtp).not.toHaveBeenCalled();
    expect(result.current.step).toBe('details');
    expect(result.current.errors.email).toBeTruthy();
  });

  it('sets email and username errors when check-availability returns TAKEN', async () => {
    const { result } = renderHook(() => useRegisterViewModel());

    mockCheck.mockResolvedValueOnce({
      username: 'TAKEN',
      email: 'TAKEN',
    });

    await fillDetailsForm(result.current);
    await act(async () => {
      await result.current.handleSubmitDetails();
    });

    expect(mockCheck).toHaveBeenCalledWith({
      username: validDetails.username,
      email: validDetails.email,
    });
    expect(mockRequestOtp).not.toHaveBeenCalled();
    expect(result.current.step).toBe('details');
    expect(result.current.errors.email).toBe('This email is already in use.');
    expect(result.current.errors.username).toBe('This username is already in use.');
  });

  it('requests OTP and moves to otp step when availability is clear', async () => {
    const { result } = renderHook(() => useRegisterViewModel());

    await fillDetailsForm(result.current);
    await act(async () => {
      await result.current.handleSubmitDetails();
    });

    expect(mockRequestOtp).toHaveBeenCalledWith({ email: validDetails.email });
    expect(result.current.step).toBe('otp');
  });

  it('sets apiError when check-availability throws ApiError', async () => {
    const { result } = renderHook(() => useRegisterViewModel());

    mockCheck.mockRejectedValueOnce(
      new ApiError(429, {
        error: { code: 'rate_limited', message: 'Slow down.' },
      }),
    );

    await fillDetailsForm(result.current);
    await act(async () => {
      await result.current.handleSubmitDetails();
    });

    expect(result.current.apiError).toBe('Slow down.');
    expect(result.current.step).toBe('details');
  });

  it('returns session when OTP verify succeeds', async () => {
    const { result } = renderHook(() => useRegisterViewModel());

    await fillDetailsForm(result.current);
    await act(async () => {
      await result.current.handleSubmitDetails();
    });
    await act(async () => {
      result.current.updateField('otp', '123456');
    });

    let verifyResult: AuthSessionResponse | null = null;
    await act(async () => {
      verifyResult = await result.current.handleVerifyOtp();
    });

    expect(mockVerify).toHaveBeenCalledWith({
      email: validDetails.email,
      otp: '123456',
      username: validDetails.username,
      password: validDetails.password,
      phone_number: null,
      gender: null,
      birth_date: null,
    });
    expect(verifyResult).toEqual(sessionFixture);
  });

  it('maps invalid_otp ApiError to otp field and clears otp input', async () => {
    const { result } = renderHook(() => useRegisterViewModel());

    await fillDetailsForm(result.current);
    await act(async () => {
      await result.current.handleSubmitDetails();
    });
    await act(async () => {
      result.current.updateField('otp', '000000');
    });

    mockVerify.mockRejectedValueOnce(
      new ApiError(401, {
        error: {
          code: 'invalid_otp',
          message: 'The OTP is invalid or has expired.',
        },
      }),
    );

    await act(async () => {
      await result.current.handleVerifyOtp();
    });

    expect(result.current.formData.otp).toBe('');
    expect(result.current.errors.otp).toBe('The OTP is invalid or has expired.');
    expect(result.current.apiError).toBe('The OTP is invalid or has expired.');
  });

  it('goBack returns from otp to details', async () => {
    const { result } = renderHook(() => useRegisterViewModel());

    await fillDetailsForm(result.current);
    await act(async () => {
      await result.current.handleSubmitDetails();
    });
    expect(result.current.step).toBe('otp');

    await act(async () => {
      result.current.goBack();
    });
    expect(result.current.step).toBe('details');
  });
});
