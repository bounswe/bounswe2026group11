package domain

import (
	"time"

	"github.com/google/uuid"
)

// Profile holds the user's extended profile data stored in the profile table.
type Profile struct {
	ID          uuid.UUID
	UserID      uuid.UUID
	DisplayName *string
	Bio         *string
	AvatarURL   *string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// EventSummary is a lightweight event projection used in profile responses.
type EventSummary struct {
	ID                       uuid.UUID
	Title                    string
	StartTime                time.Time
	EndTime                  time.Time
	Status                   string
	Category                 *string
	ImageURL                 *string
	ApprovedParticipantCount int
	LocationAddress          *string
}

// UserProfile is the combined projection of app_user and profile returned by
// the my-profile endpoint.
type UserProfile struct {
	// app_user fields
	ID                     uuid.UUID
	Username               string
	Email                  string
	PhoneNumber            *string
	Gender                 *string
	BirthDate              *time.Time
	EmailVerified          bool
	Status                 string
	DefaultLocationAddress *string
	DefaultLocationLat     *float64
	DefaultLocationLon     *float64
	// profile fields
	DisplayName *string
	Bio         *string
	AvatarURL   *string
}
