/** Matches OpenAPI `CheckAvailabilityResponse` enum values. */
export type AvailabilityStatus = 'AVAILABLE' | 'TAKEN';

export interface CheckAvailabilityRequest {
  username: string;
  email: string;
}

export interface CheckAvailabilityResponse {
  username: AvailabilityStatus;
  email: AvailabilityStatus;
}

export interface RequestOtpRequest {
  email: string;
}

export interface RequestOtpResponse {
  status: 'accepted';
  message: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface VerifyRegistrationRequest {
  email: string;
  otp: string;
  username: string;
  password: string;
  phone_number?: string | null;
  gender?: string | null;
  birth_date?: string | null;
}

export interface UserSummary {
  id: string;
  username: string;
  email: string;
  phone_number: string | null;
  email_verified: boolean;
  status: string;
}

export interface AuthSessionResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in_seconds: number;
  user: UserSummary;
}

export interface ErrorBody {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface ErrorResponse {
  error: ErrorBody;
}
