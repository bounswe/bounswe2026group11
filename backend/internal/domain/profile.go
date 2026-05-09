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

// PublicUserProfile is the public-safe profile projection returned when one
// user views another user's profile.
type PublicUserProfile struct {
	UserID                 uuid.UUID
	Username               string
	DisplayName            *string
	AvatarURL              *string
	Bio                    *string
	FinalScore             *float64
	HostRatingCount        int
	ParticipantRatingCount int
}

// ProfileEquipment is one user-owned equipment entry shown on public profiles.
type ProfileEquipment struct {
	ID          uuid.UUID
	UserID      uuid.UUID
	Name        string
	Description *string
	ImageURL    *string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// ProfileShowcaseImage is one user-owned showcase image entry.
type ProfileShowcaseImage struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	ImageURL  string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// EventSummary is a lightweight event projection used in profile responses.
type EventSummary struct {
	ID                       uuid.UUID
	Title                    string
	StartTime                time.Time
	EndTime                  time.Time
	Status                   string
	PrivacyLevel             string
	Category                 *string
	ImageURL                 *string
	ApprovedParticipantCount int
	LocationAddress          *string
}

// HostScore holds the cached rating summary for a user acting as an event host.
type HostScore struct {
	Score       *float64
	RatingCount int
}

// ParticipantScore holds the cached rating summary for a user acting as a participant.
type ParticipantScore struct {
	Score       *float64
	RatingCount int
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
	Locale                 string
	DefaultLocationAddress *string
	DefaultLocationLat     *float64
	DefaultLocationLon     *float64
	// profile fields
	DisplayName *string
	Bio         *string
	AvatarURL   *string
	// score fields
	FinalScore       *float64
	HostScore        HostScore
	ParticipantScore ParticipantScore
}
