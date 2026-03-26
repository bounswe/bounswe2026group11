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

/** Matches OpenAPI `ForgotPasswordRequestResponse`. */
export interface ForgotPasswordRequestResponse {
  status: 'ok';
  message: string;
}

/** Matches OpenAPI `VerifyPasswordResetRequest`. */
export interface VerifyPasswordResetRequest {
  email: string;
  otp: string;
}

/** Matches OpenAPI `PasswordResetGrantResponse`. */
export interface PasswordResetGrantResponse {
  status: 'ok';
  reset_token: string;
  expires_in_seconds: number;
}

/** Matches OpenAPI `ResetPasswordRequest`. */
export interface ResetPasswordRequest {
  email: string;
  reset_token: string;
  new_password: string;
}

/** Matches OpenAPI `PasswordResetSuccessResponse`. */
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
