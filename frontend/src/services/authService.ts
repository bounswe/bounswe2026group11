import { apiPost } from './api';
import {
  CheckAvailabilityRequest,
  CheckAvailabilityResponse,
  LoginRequest,
  RequestOtpRequest,
  RequestOtpResponse,
  VerifyRegistrationRequest,
  AuthSessionResponse,
  LogoutRequest,
  ForgotPasswordRequestOtpRequest,
  ForgotPasswordVerifyOtpRequest,
  ForgotPasswordVerifyOtpResponse,
  ForgotPasswordResetPasswordRequest
} from '@/models/auth';

export function checkRegistrationAvailability(
  data: CheckAvailabilityRequest,
): Promise<CheckAvailabilityResponse> {
  return apiPost<CheckAvailabilityResponse>(
    '/auth/register/check-availability',
    data,
  );
}

export function requestRegistrationOtp(
  data: RequestOtpRequest,
): Promise<RequestOtpResponse> {
  return apiPost<RequestOtpResponse>(
    '/auth/register/email/request-otp',
    data,
  );
}

export function verifyRegistration(
  data: VerifyRegistrationRequest,
): Promise<AuthSessionResponse> {
  return apiPost<AuthSessionResponse>('/auth/register/email/verify', data);
}

export function login(data: LoginRequest): Promise<AuthSessionResponse> {
  return apiPost<AuthSessionResponse>('/auth/login', data);
}

export function logout(data: LogoutRequest): Promise<void> {
  return apiPost<void>('/auth/logout', data);
}

export function requestPasswordResetOtp(
  data: ForgotPasswordRequestOtpRequest,
): Promise<void> {
  return apiPost<void>('/auth/forgot-password/request-otp', data);
}

export function verifyPasswordResetOtp(
  data: ForgotPasswordVerifyOtpRequest,
): Promise<ForgotPasswordVerifyOtpResponse> {
  return apiPost<ForgotPasswordVerifyOtpResponse>('/auth/forgot-password/verify-otp', data);
}

export function resetPassword(
  data: ForgotPasswordResetPasswordRequest,
): Promise<void> {
  return apiPost<void>('/auth/forgot-password/reset-password', data);
}
