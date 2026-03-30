package profile

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Repository is the application-layer persistence port for profile flows.
type Repository interface {
	GetProfile(ctx context.Context, userID uuid.UUID) (*domain.UserProfile, error)
	UpdateProfile(ctx context.Context, params UpdateProfileParams) error
}
