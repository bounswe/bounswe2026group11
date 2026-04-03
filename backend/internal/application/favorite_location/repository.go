package favorite_location

import (
	"context"
	"errors"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// ErrFavoriteLocationLimitExceeded is returned when a user already has the
// maximum number of favorite locations allowed by the product.
var ErrFavoriteLocationLimitExceeded = errors.New("favorite location limit exceeded")

// Repository is the application-layer persistence port for favorite locations.
type Repository interface {
	ListByUserID(ctx context.Context, userID uuid.UUID) ([]domain.FavoriteLocation, error)
	Create(ctx context.Context, params CreateFavoriteLocationParams) (*domain.FavoriteLocation, error)
	GetByIDForUser(ctx context.Context, userID, favoriteLocationID uuid.UUID) (*domain.FavoriteLocation, error)
	Update(ctx context.Context, params UpdateFavoriteLocationParams) (*domain.FavoriteLocation, error)
	Delete(ctx context.Context, userID, favoriteLocationID uuid.UUID) error
}
