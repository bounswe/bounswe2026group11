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
	GetHostedEvents(ctx context.Context, userID uuid.UUID) ([]domain.EventSummary, error)
	GetUpcomingEvents(ctx context.Context, userID uuid.UUID) ([]domain.EventSummary, error)
	GetCompletedEvents(ctx context.Context, userID uuid.UUID) ([]domain.EventSummary, error)
	GetCanceledEvents(ctx context.Context, userID uuid.UUID) ([]domain.EventSummary, error)
	SearchUsers(ctx context.Context, query string, limit int) ([]UserSearchRecord, error)
	GetPasswordHash(ctx context.Context, userID uuid.UUID) (string, error)
	UpdatePasswordHash(ctx context.Context, userID uuid.UUID, newHash string) error
}
