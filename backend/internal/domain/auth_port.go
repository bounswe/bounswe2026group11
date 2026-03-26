package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// AuthRepository is the primary port for auth-related persistence operations.
// Adapters (e.g. Postgres) implement this interface.
type AuthRepository interface {
	WithTx(ctx context.Context, fn func(repo AuthRepository) error) error
	GetUserByEmail(ctx context.Context, email string) (*User, error)
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	GetUserByID(ctx context.Context, userID uuid.UUID) (*User, error)
	CreateUser(ctx context.Context, params CreateUserParams) (*User, error)
	UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string, updatedAt time.Time) error
	CreateProfile(ctx context.Context, userID uuid.UUID) error
	UpdateLastLogin(ctx context.Context, userID uuid.UUID, lastLogin time.Time) error
	GetActiveOTPChallenge(ctx context.Context, destination, purpose string) (*OTPChallenge, error)
	UpsertOTPChallenge(ctx context.Context, params UpsertOTPChallengeParams) (*OTPChallenge, error)
	IncrementOTPChallengeAttempts(ctx context.Context, challengeID uuid.UUID, updatedAt time.Time) (*OTPChallenge, error)
	ConsumeOTPChallenge(ctx context.Context, challengeID uuid.UUID, consumedAt time.Time) error
	CreateRefreshToken(ctx context.Context, params CreateRefreshTokenParams) (*RefreshToken, error)
	GetRefreshTokenByHash(ctx context.Context, tokenHash string) (*RefreshToken, error)
	GetRefreshTokenFamilyCreatedAt(ctx context.Context, familyID uuid.UUID) (time.Time, error)
	RevokeRefreshToken(ctx context.Context, tokenID uuid.UUID, revokedAt time.Time) error
	SetRefreshTokenReplacement(ctx context.Context, tokenID, replacedByID uuid.UUID, updatedAt time.Time) error
	RevokeRefreshTokenFamily(ctx context.Context, familyID uuid.UUID, revokedAt time.Time) error
}

// PasswordHasher hashes and compares passwords or OTP codes.
type PasswordHasher interface {
	Hash(value string) (string, error)
	Compare(hash, value string) error
}

// RateLimiter controls request frequency per key.
type RateLimiter interface {
	Allow(key string, now time.Time) (allowed bool, retryAfter time.Duration)
}
