package profile

import "github.com/google/uuid"

// GetProfileResult is the output of the GetMyProfile use case.
type GetProfileResult struct {
	ID                     string  `json:"id"`
	Username               string  `json:"username"`
	Email                  string  `json:"email"`
	PhoneNumber            *string `json:"phone_number"`
	Gender                 *string `json:"gender"`
	BirthDate              *string `json:"birth_date"`
	EmailVerified          bool    `json:"email_verified"`
	Status                 string  `json:"status"`
	DefaultLocationAddress *string `json:"default_location_address"`
	DefaultLocationLat     *float64 `json:"default_location_lat"`
	DefaultLocationLon     *float64 `json:"default_location_lon"`
	DisplayName            *string `json:"display_name"`
	Bio                    *string `json:"bio"`
	AvatarURL              *string `json:"avatar_url"`
}

// UpdateProfileInput is the input to the UpdateMyProfile use case.
// All fields are optional (pointer = omitted means no change).
type UpdateProfileInput struct {
	UserID                 uuid.UUID
	PhoneNumber            *string
	Gender                 *string
	BirthDate              *string
	DefaultLocationAddress *string
	DefaultLocationLat     *float64
	DefaultLocationLon     *float64
	DisplayName            *string
	Bio                    *string
	AvatarURL              *string
}

// UpdateProfileParams is passed to the repository layer.
type UpdateProfileParams struct {
	UserID                 uuid.UUID
	PhoneNumber            *string
	Gender                 *string
	BirthDate              *string
	DefaultLocationAddress *string
	DefaultLocationLat     *float64
	DefaultLocationLon     *float64
	DisplayName            *string
	Bio                    *string
	AvatarURL              *string
}
