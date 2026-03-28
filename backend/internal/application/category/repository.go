package category

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

// Repository is the application-layer persistence port for category flows.
type Repository interface {
	ListCategories(ctx context.Context) ([]domain.EventCategory, error)
}
