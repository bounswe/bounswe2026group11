package auth

import (
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

// Config holds tuning parameters for the auth service such as token lifetimes,
// OTP validity windows, and attempt limits.
type Config struct {
	OTPTTL            time.Duration
	OTPMaxAttempts    int
	OTPResendCooldown time.Duration
	RefreshTokenTTL   time.Duration
	MaxSessionTTL     time.Duration
}

// RequestOTPInput carries the validated input for requesting an email OTP challenge.
type RequestOTPInput struct {
	Email string
}

// VerifyPasswordResetInput carries the email OTP submitted during forgot-password verification.
type VerifyPasswordResetInput struct {
	Email string
	OTP   string
}

// PasswordResetGrant is returned after a password-reset OTP is verified.
// The ResetToken must be presented on the password reset endpoint.
type PasswordResetGrant struct {
	ResetToken       string
	ExpiresInSeconds int64
}

// ResetPasswordInput carries the data required to finalize a forgot-password flow.
type ResetPasswordInput struct {
	Email       string
	ResetToken  string
	NewPassword string
}

// VerifyRegistrationInput carries all fields submitted when a user verifies
// their OTP and completes registration in a single step.
type VerifyRegistrationInput struct {
	Email       string
	OTP         string
	Username    string
	Password    string
	PhoneNumber *string
	Gender      *string
	BirthDate   *string
	DeviceInfo  *string
}

// LoginInput carries the credentials submitted on the login endpoint.
type LoginInput struct {
	Username   string
	Password   string
	DeviceInfo *string
}

// Session is the response payload returned after a successful authentication
// (registration, login, or token refresh). It contains both tokens and a
// summary of the authenticated user.
type Session struct {
	AccessToken      string
	RefreshToken     string
	TokenType        string
	ExpiresInSeconds int64
	User             domain.UserSummary
}

// CheckAvailabilityInput carries the username and email to check.
type CheckAvailabilityInput struct {
	Username  string
	Email     string
	ClientKey string
}

// CheckAvailabilityResult reports whether a username and email are available
// for registration. Each field is either "AVAILABLE" or "TAKEN".
type CheckAvailabilityResult struct {
	Username string // "AVAILABLE" or "TAKEN"
	Email    string // "AVAILABLE" or "TAKEN"
}
