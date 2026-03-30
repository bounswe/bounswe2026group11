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

export interface ForgotPasswordRequestResponse {
  status: 'ok';
  message: string;
}

export interface VerifyPasswordResetRequest {
  email: string;
  otp: string;
}

export interface PasswordResetGrantResponse {
  status: 'ok';
  reset_token: string;
  expires_in_seconds: number;
}

export interface ResetPasswordRequest {
  email: string;
  reset_token: string;
  new_password: string;
}

export interface PasswordResetSuccessResponse {
  status: 'ok';
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
  /** Wire values include `MALE`, `FEMALE`, `OTHER`, `PREFER_NOT_TO_SAY` when returned by the API. */
  gender?: string | null;
  /** ISO date `YYYY-MM-DD` when returned by the API. */
  birth_date?: string | null;
}

export interface AuthSessionResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in_seconds: number;
  user: UserSummary;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface ErrorBody {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface ErrorResponse {
  error: ErrorBody;
}
