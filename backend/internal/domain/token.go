package domain

import (
	"time"

	"github.com/google/uuid"
)

// RefreshToken represents a stored refresh token. Tokens belong to a FamilyID
// which groups all tokens from a single login session, enabling reuse detection
// by revoking the entire family when a used token is replayed.
type RefreshToken struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	FamilyID     uuid.UUID  // groups tokens from the same login session
	TokenHash    string     // SHA-256 hash of the plaintext token
	ExpiresAt    time.Time
	RevokedAt    *time.Time // set when the token is revoked (rotation or logout)
	ReplacedByID *uuid.UUID // points to the successor token after rotation
	DeviceInfo   *string
	CreatedAt    time.Time
	UpdatedAt    time.Time
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

// TokenIssuer creates short-lived access tokens (e.g. JWTs) for authenticated users.
type TokenIssuer interface {
	IssueAccessToken(user User, issuedAt time.Time) (token string, expiresInSeconds int64, err error)
}

// RefreshTokenManager generates cryptographically random refresh tokens and
// produces deterministic hashes for storage and lookup.
type RefreshTokenManager interface {
	NewToken() (plain string, hash string, err error)
	HashToken(token string) string
}
