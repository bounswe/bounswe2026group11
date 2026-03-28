package domain

import (
	"time"

	"github.com/google/uuid"
)

// OTP delivery channel and purpose constants used to key challenges in the DB.
const (
	OTPChannelEmail              = "email"
	OTPPurposeRegistration       = "registration"
	OTPPurposePasswordReset      = "password_reset"
	OTPPurposePasswordResetGrant = "password_reset_grant"
)

// OTPChallenge represents a one-time-password verification attempt. A challenge
// is keyed by (destination, purpose) and tracks the hashed code, its expiry,
// and the number of failed verification attempts.
type OTPChallenge struct {
	ID           uuid.UUID
	UserID       *uuid.UUID // nil until the challenge is linked to a registered user
	Channel      string
	Destination  string
	Purpose      string
	CodeHash     string
	ExpiresAt    time.Time
	ConsumedAt   *time.Time // set once the code is successfully verified
	AttemptCount int
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
