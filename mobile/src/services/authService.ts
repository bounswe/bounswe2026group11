import { apiPost } from './api';
import {
  CheckAvailabilityRequest,
  CheckAvailabilityResponse,
  RequestOtpRequest,
  RequestOtpResponse,
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
