package favorite_location

import (
	"context"

	"github.com/google/uuid"
)

// UseCase is the inbound application port for favorite-location flows.
type UseCase interface {
	ListMyFavoriteLocations(ctx context.Context, userID uuid.UUID) (*ListFavoriteLocationsResult, error)
	CreateMyFavoriteLocation(ctx context.Context, input CreateFavoriteLocationInput) (*FavoriteLocationResult, error)
	UpdateMyFavoriteLocation(ctx context.Context, input UpdateFavoriteLocationInput) (*FavoriteLocationResult, error)
	DeleteMyFavoriteLocation(ctx context.Context, userID, favoriteLocationID uuid.UUID) error
}
