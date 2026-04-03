package favorite_location

import "github.com/google/uuid"

const (
	// MaxFavoriteLocations is the product-level limit enforced per user.
	MaxFavoriteLocations = 3

	maxFavoriteLocationNameLength    = 64
	maxFavoriteLocationAddressLength = 512
)

// FavoriteLocationResult is the API-facing representation of a favorite location.
type FavoriteLocationResult struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Address string  `json:"address"`
	Lat     float64 `json:"lat"`
	Lon     float64 `json:"lon"`
}

// ListFavoriteLocationsResult wraps the favorite-location collection response.
type ListFavoriteLocationsResult struct {
	Items []FavoriteLocationResult `json:"items"`
}

// CreateFavoriteLocationInput is the input to the create favorite-location use case.
type CreateFavoriteLocationInput struct {
	UserID  uuid.UUID
	Name    string
	Address string
	Lat     float64
	Lon     float64
}

// UpdateFavoriteLocationInput is the input to the update favorite-location use case.
type UpdateFavoriteLocationInput struct {
	UserID             uuid.UUID
	FavoriteLocationID uuid.UUID
	Name               *string
	Address            *string
	Lat                *float64
	Lon                *float64
}

// CreateFavoriteLocationParams is passed to the repository layer for inserts.
type CreateFavoriteLocationParams struct {
	UserID  uuid.UUID
	Name    string
	Address string
	Lat     float64
	Lon     float64
}

// UpdateFavoriteLocationParams is passed to the repository layer for updates.
type UpdateFavoriteLocationParams struct {
	UserID             uuid.UUID
	FavoriteLocationID uuid.UUID
	Name               string
	Address            string
	Lat                float64
	Lon                float64
}
