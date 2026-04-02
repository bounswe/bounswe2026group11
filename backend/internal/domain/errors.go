package domain

import (
	"errors"
	"fmt"
)

// HTTP status codes used by AppError to map domain errors to HTTP responses.
const (
	StatusBadRequest      = 400
	StatusUnauthorized    = 401
	StatusForbidden       = 403
	StatusNotFound        = 404
	StatusConflict        = 409
	StatusTooManyRequests = 429
	StatusInternalError   = 500
)

// Machine-readable error codes returned in the JSON "error.code" field.
// Clients can switch on these codes to decide how to handle each error.
const (
	ErrorCodeValidation        = "validation_error"
	ErrorCodeRateLimited       = "rate_limited"
	ErrorCodeInvalidOTP        = "invalid_otp"
	ErrorCodeOTPExhausted      = "otp_attempts_exceeded"
	ErrorCodeInvalidResetToken = "invalid_password_reset_token"
	ErrorCodeInvalidCreds      = "invalid_credentials" // #nosec G101 -- wire error code, not a secret
	ErrorCodeInvalidRefresh    = "invalid_refresh_token"
	ErrorCodeRefreshReused     = "refresh_token_reused"
	ErrorCodeEmailExists       = "email_already_exists"
	ErrorCodeUsernameExists    = "username_already_exists"
	ErrorCodePhoneExists       = "phone_number_already_exists"
	ErrorCodeEventTitleExists  = "event_title_already_exists"

	ErrorCodeEventNotFound                   = "event_not_found"
	ErrorCodeAlreadyParticipating            = "already_participating"
	ErrorCodeAlreadyRequested                = "already_requested"
	ErrorCodeEventJoinNotAllowed             = "event_join_not_allowed"
	ErrorCodeHostCannotJoin                  = "host_cannot_join"
	ErrorCodeCapacityExceeded                = "capacity_exceeded"
	ErrorCodeJoinRequestNotFound             = "join_request_not_found"
	ErrorCodeJoinRequestModerationNotAllowed = "join_request_moderation_not_allowed"
	ErrorCodeJoinRequestStateInvalid         = "join_request_state_invalid"
	ErrorCodeJoinRequestCooldownActive       = "join_request_cooldown_active"
	ErrorCodeEventCancelNotAllowed           = "event_cancel_not_allowed"
	ErrorCodeEventNotCancelable              = "event_not_cancelable"

	ErrorCodeImageUploadTokenInvalid         = "image_upload_token_invalid"
	ErrorCodeImageUploadNotAllowed           = "image_upload_not_allowed"
	ErrorCodeImageUploadIncomplete           = "image_upload_incomplete"
	ErrorCodeImageUploadVersionConflict      = "image_upload_version_conflict"
)

// ErrNotFound is a sentinel error returned when a queried entity does not exist.
var ErrNotFound = errors.New("not found")

// AppError is the structured error type used across the application. It carries
// an HTTP status code, a machine-readable code, a human-readable message, and
// optional per-field validation details.
type AppError struct {
	Code    string
	Message string
	Status  int
	Details map[string]string
}

func (e *AppError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// ValidationError creates a 400 Bad Request error with per-field detail messages.
func ValidationError(details map[string]string) *AppError {
	return &AppError{
		Code:    ErrorCodeValidation,
		Message: "The request body contains invalid fields. See error.details for field-specific messages.",
		Status:  StatusBadRequest,
		Details: details,
	}
}

// BadRequestError creates a 400 Bad Request error for invalid request states
// that are not field-validation failures.
func BadRequestError(code, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Status:  StatusBadRequest,
	}
}

// RateLimitedError creates a 429 Too Many Requests error.
func RateLimitedError(message string) *AppError {
	return &AppError{
		Code:    ErrorCodeRateLimited,
		Message: message,
		Status:  StatusTooManyRequests,
	}
}

// ConflictError creates a 409 Conflict error for unique-constraint violations
// (e.g. duplicate email, username, or phone number).
func ConflictError(code, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Status:  StatusConflict,
	}
}

// AuthError creates a 401 Unauthorized error for authentication failures
// (e.g. invalid credentials, expired OTP, revoked refresh token).
func AuthError(code, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Status:  StatusUnauthorized,
	}
}

// ForbiddenError creates a 403 Forbidden error for operations the caller is
// not permitted to perform (e.g. host attempting to join their own event).
func ForbiddenError(code, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Status:  StatusForbidden,
	}
}

// NotFoundError creates a 404 Not Found error for entities that do not exist.
func NotFoundError(code, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Status:  StatusNotFound,
	}
}
