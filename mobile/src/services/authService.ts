import { apiPost } from './api';
import {
  CheckAvailabilityRequest,
  CheckAvailabilityResponse,
  LoginRequest,
  RequestOtpRequest,
  RequestOtpResponse,
  ForgotPasswordRequestResponse,
  VerifyPasswordResetRequest,
  PasswordResetGrantResponse,
  ResetPasswordRequest,
  PasswordResetSuccessResponse,
  VerifyRegistrationRequest,
  AuthSessionResponse,
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

export function requestPasswordResetOtp(
  data: RequestOtpRequest,
): Promise<ForgotPasswordRequestResponse> {
  return apiPost<ForgotPasswordRequestResponse>(
    '/auth/forgot-password/request-otp',
    data,
  );
}

export function verifyPasswordResetOtp(
  data: VerifyPasswordResetRequest,
): Promise<PasswordResetGrantResponse> {
  return apiPost<PasswordResetGrantResponse>(
    '/auth/forgot-password/verify-otp',
    data,
  );
}

export function resetPassword(
  data: ResetPasswordRequest,
): Promise<PasswordResetSuccessResponse> {
  return apiPost<PasswordResetSuccessResponse>(
    '/auth/forgot-password/reset-password',
    data,
  );
}
