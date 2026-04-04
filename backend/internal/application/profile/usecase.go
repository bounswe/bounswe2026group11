package profile

import (
	"context"

	"github.com/google/uuid"
)

// UseCase is the inbound application port for profile flows.
type UseCase interface {
	GetMyProfile(ctx context.Context, userID uuid.UUID) (*GetProfileResult, error)
	UpdateMyProfile(ctx context.Context, input UpdateProfileInput) error
	GetMyHostedEvents(ctx context.Context, userID uuid.UUID) ([]EventSummary, error)
	GetMyUpcomingEvents(ctx context.Context, userID uuid.UUID) ([]EventSummary, error)
	GetMyCompletedEvents(ctx context.Context, userID uuid.UUID) ([]EventSummary, error)
	GetMyCanceledEvents(ctx context.Context, userID uuid.UUID) ([]EventSummary, error)
}
