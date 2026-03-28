package auth

import (
	"context"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

// PasswordHasher hashes and compares passwords or OTP codes.
type PasswordHasher interface {
	Hash(value string) (string, error)
	Compare(hash, value string) error
}

// RateLimiter controls request frequency per key.
type RateLimiter interface {
	Allow(key string, now time.Time) (allowed bool, retryAfter time.Duration)
}

// TokenIssuer creates short-lived access tokens (e.g. JWTs) for authenticated users.
type TokenIssuer interface {
	IssueAccessToken(user domain.User, issuedAt time.Time) (token string, expiresInSeconds int64, err error)
}

// RefreshTokenManager generates cryptographically random refresh tokens and
// produces deterministic hashes for storage and lookup.
type RefreshTokenManager interface {
	NewToken() (plain string, hash string, err error)
	HashToken(token string) string
}

// OTPCodeGenerator produces a new random OTP code string (e.g. a 6-digit number).
type OTPCodeGenerator interface {
	NewCode() string
}

// OTPMailer delivers OTP codes to the user via an external channel (e.g. email).
type OTPMailer interface {
	SendRegistrationOTP(ctx context.Context, email, code string) error
	SendPasswordResetOTP(ctx context.Context, email, code string) error
}
