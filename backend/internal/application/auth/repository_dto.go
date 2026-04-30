package auth

import (
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// CreateUserParams carries the fields required to insert a new user row.
type CreateUserParams struct {
	Username        string
	Email           string
	PhoneNumber     *string
	Gender          *string
	BirthDate       *time.Time
	PasswordHash    string
	EmailVerifiedAt time.Time
	Status          domain.UserStatus
}

// UpsertOTPChallengeParams carries the fields needed to insert or update an
// unconsumed OTP challenge for the same (destination, purpose) pair.
type UpsertOTPChallengeParams struct {
	UserID      *uuid.UUID
	Channel     string
	Destination string
	Purpose     string
	CodeHash    string
	ExpiresAt   time.Time
	UpdatedAt   time.Time
}

// CreateRefreshTokenParams carries the fields required to persist a new refresh token.
type CreateRefreshTokenParams struct {
	UserID     uuid.UUID
	FamilyID   uuid.UUID
	TokenHash  string
	CreatedAt  time.Time
	ExpiresAt  time.Time
	DeviceInfo *string
}
