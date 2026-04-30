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
	FamilyID     uuid.UUID // groups tokens from the same login session
	TokenHash    string    // SHA-256 hash of the plaintext token
	ExpiresAt    time.Time
	RevokedAt    *time.Time // set when the token is revoked (rotation or logout)
	ReplacedByID *uuid.UUID // points to the successor token after rotation
	DeviceInfo   *string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// AuthClaims holds the verified identity extracted from an access token.
type AuthClaims struct {
	UserID   uuid.UUID
	Username string
	Email    string
	Role     UserRole
}

// TokenVerifier parses and validates access tokens, returning the embedded claims.
type TokenVerifier interface {
	VerifyAccessToken(token string) (*AuthClaims, error)
}
