package domain

import (
	"time"

	"github.com/google/uuid"
)

// UserStatusActive is the default status assigned to newly registered users.
const UserStatusActive = "active"

// User is the core identity entity representing a registered account.
type User struct {
	ID              uuid.UUID
	Username        string
	Email           string
	PhoneNumber     *string
	Gender          *string
	BirthDate       *time.Time
	PasswordHash    string
	EmailVerifiedAt *time.Time
	LastLogin       *time.Time
	Status          string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// UserSummary is a safe-to-serialize projection of User that omits sensitive
// fields like PasswordHash. It is returned in authentication responses.
type UserSummary struct {
	ID            uuid.UUID `json:"id"`
	Username      string    `json:"username"`
	Email         string    `json:"email"`
	PhoneNumber   *string   `json:"phone_number"`
	EmailVerified bool      `json:"email_verified"`
	Status        string    `json:"status"`
}

// Summary converts a full User into a UserSummary, deriving EmailVerified from
// whether EmailVerifiedAt is set.
func (u User) Summary() UserSummary {
	return UserSummary{
		ID:            u.ID,
		Username:      u.Username,
		Email:         u.Email,
		PhoneNumber:   u.PhoneNumber,
		EmailVerified: u.EmailVerifiedAt != nil,
		Status:        u.Status,
	}
}
