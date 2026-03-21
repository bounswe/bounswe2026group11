package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// OTP delivery channel and purpose constants used to key challenges in the DB.
const (
	OTPChannelEmail        = "email"
	OTPPurposeRegistration = "registration"
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

// UpsertOTPChallengeParams carries the fields needed to insert or update an
// unconsumed OTP challenge for the same (destination, purpose) pair.
type UpsertOTPChallengeParams struct {
	Channel     string
	Destination string
	Purpose     string
	CodeHash    string
	ExpiresAt   time.Time
	UpdatedAt   time.Time
}

// OTPCodeGenerator produces a new random OTP code string (e.g. a 6-digit number).
type OTPCodeGenerator interface {
	NewCode() string
}

// OTPMailer delivers OTP codes to the user via an external channel (e.g. email).
type OTPMailer interface {
	SendRegistrationOTP(ctx context.Context, email, code string) error
}
