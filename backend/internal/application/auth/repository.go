package auth

import (
	"context"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Repository is the application-layer persistence port for auth flows.
type Repository interface {
	WithTx(ctx context.Context, fn func(repo Repository) error) error
	GetUserByEmail(ctx context.Context, email string) (*domain.User, error)
	GetUserByUsername(ctx context.Context, username string) (*domain.User, error)
	GetUserByID(ctx context.Context, userID uuid.UUID) (*domain.User, error)
	CreateUser(ctx context.Context, params CreateUserParams) (*domain.User, error)
	UpdatePassword(ctx context.Context, userID uuid.UUID, passwordHash string, updatedAt time.Time) error
	CreateProfile(ctx context.Context, userID uuid.UUID) error
	UpdateLastLogin(ctx context.Context, userID uuid.UUID, lastLogin time.Time) error
	GetActiveOTPChallenge(ctx context.Context, destination, purpose string) (*domain.OTPChallenge, error)
	UpsertOTPChallenge(ctx context.Context, params UpsertOTPChallengeParams) (*domain.OTPChallenge, error)
	IncrementOTPChallengeAttempts(ctx context.Context, challengeID uuid.UUID, updatedAt time.Time) (*domain.OTPChallenge, error)
	ConsumeOTPChallenge(ctx context.Context, challengeID uuid.UUID, consumedAt time.Time) error
	CreateRefreshToken(ctx context.Context, params CreateRefreshTokenParams) (*domain.RefreshToken, error)
	GetRefreshTokenByHash(ctx context.Context, tokenHash string) (*domain.RefreshToken, error)
	GetRefreshTokenFamilyCreatedAt(ctx context.Context, familyID uuid.UUID) (time.Time, error)
	RevokeRefreshToken(ctx context.Context, tokenID uuid.UUID, revokedAt time.Time) error
	SetRefreshTokenReplacement(ctx context.Context, tokenID, replacedByID uuid.UUID, updatedAt time.Time) error
	RevokeRefreshTokenFamily(ctx context.Context, familyID uuid.UUID, revokedAt time.Time) error
}
