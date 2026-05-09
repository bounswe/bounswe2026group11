package profile

import "github.com/google/uuid"

// PasswordHasher is the profile package's local port for password hashing operations.
type PasswordHasher interface {
	Hash(value string) (string, error)
	Compare(hash, value string) error
}

// ChangePasswordInput carries the authenticated user's current and new password.
type ChangePasswordInput struct {
	UserID      uuid.UUID
	OldPassword string
	NewPassword string
}

// EventSummary is a lightweight event representation used in profile responses.
type EventSummary struct {
	ID                string  `json:"id"`
	Title             string  `json:"title"`
	StartTime         string  `json:"start_time"`
	EndTime           string  `json:"end_time"`
	Status            string  `json:"status"`
	PrivacyLevel      string  `json:"privacy_level"`
	Category          *string `json:"category"`
	ImageURL          *string `json:"image_url"`
	ParticipantsCount int     `json:"participants_count"`
	LocationAddress   *string `json:"location_address"`
}

// HostScore is the rating summary for the user acting as an event host.
type HostScore struct {
	Score       *float64 `json:"score"`
	RatingCount int      `json:"rating_count"`
}

// ParticipantScore is the rating summary for the user acting as a participant.
type ParticipantScore struct {
	Score       *float64 `json:"score"`
	RatingCount int      `json:"rating_count"`
}

// GetProfileResult is the output of the GetMyProfile use case.
type GetProfileResult struct {
	ID                     string            `json:"id"`
	Username               string            `json:"username"`
	Email                  string            `json:"email"`
	PhoneNumber            *string           `json:"phone_number"`
	Gender                 *string           `json:"gender"`
	BirthDate              *string           `json:"birth_date"`
	EmailVerified          bool              `json:"email_verified"`
	Status                 string            `json:"status"`
	Locale                 string            `json:"locale"`
	DefaultLocationAddress *string           `json:"default_location_address"`
	DefaultLocationLat     *float64          `json:"default_location_lat"`
	DefaultLocationLon     *float64          `json:"default_location_lon"`
	DisplayName            *string           `json:"display_name"`
	Bio                    *string           `json:"bio"`
	AvatarURL              *string           `json:"avatar_url"`
	FinalScore             *float64          `json:"final_score"`
	HostScore              *HostScore        `json:"host_score"`
	ParticipantScore       *ParticipantScore `json:"participant_score"`
}

// PublicProfileResult is the public-safe profile payload returned when one
// user views another user's profile.
type PublicProfileResult struct {
	UserID                 string              `json:"user_id"`
	Username               string              `json:"username"`
	DisplayName            *string             `json:"display_name"`
	AvatarURL              *string             `json:"avatar_url"`
	Bio                    *string             `json:"bio"`
	FinalScore             *float64            `json:"final_score"`
	HostRatingCount        int                 `json:"host_rating_count"`
	ParticipantRatingCount int                 `json:"participant_rating_count"`
	Equipment              []EquipmentItem     `json:"equipment"`
	ShowcaseImages         []ShowcaseImageItem `json:"showcase_images"`
}

// EquipmentItem is one user-owned equipment entry.
type EquipmentItem struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	ImageURL    *string `json:"image_url"`
}

// ShowcaseImageItem is one user-owned showcase image entry.
type ShowcaseImageItem struct {
	ID       string `json:"id"`
	ImageURL string `json:"image_url"`
}

// ListEquipmentResult wraps the authenticated user's equipment list.
type ListEquipmentResult struct {
	Items []EquipmentItem `json:"items"`
}

// UpdateProfileInput is the input to the UpdateMyProfile use case.
// All fields are optional (pointer = omitted means no change).
type UpdateProfileInput struct {
	UserID                 uuid.UUID
	PhoneNumber            *string
	Gender                 *string
	BirthDate              *string
	Locale                 *string
	DefaultLocationAddress *string
	DefaultLocationLat     *float64
	DefaultLocationLon     *float64
	DisplayName            *string
	Bio                    *string
	AvatarURL              *string
}

// CreateEquipmentInput is the input for creating one equipment item.
type CreateEquipmentInput struct {
	UserID      uuid.UUID
	Name        string
	Description *string
	ImageURL    *string
}

// CreateEquipmentParams is passed to the repository layer.
type CreateEquipmentParams struct {
	UserID      uuid.UUID
	Name        string
	Description *string
	ImageURL    *string
}

// UpdateEquipmentInput is the input for updating one equipment item.
type UpdateEquipmentInput struct {
	UserID      uuid.UUID
	EquipmentID uuid.UUID
	Name        *string
	Description *string
	ImageURL    *string
}

// UpdateEquipmentParams is passed to the repository layer.
type UpdateEquipmentParams struct {
	EquipmentID uuid.UUID
	Name        *string
	Description *string
	ImageURL    *string
}

// UpdateProfileParams is passed to the repository layer.
type UpdateProfileParams struct {
	UserID                 uuid.UUID
	PhoneNumber            *string
	Gender                 *string
	BirthDate              *string
	Locale                 *string
	DefaultLocationAddress *string
	DefaultLocationLat     *float64
	DefaultLocationLon     *float64
	DisplayName            *string
	Bio                    *string
	AvatarURL              *string
}

type UserSearchInput struct {
	Query string
}

type UserSearchResult struct {
	Items []UserSearchItem `json:"items"`
}

type UserSearchItem struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name"`
	AvatarURL   *string `json:"avatar_url"`
}

type UserSearchRecord struct {
	ID          uuid.UUID
	Username    string
	DisplayName *string
	AvatarURL   *string
}
