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
