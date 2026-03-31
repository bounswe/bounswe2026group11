package event

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Repository is the application-layer persistence port for event flows.
type Repository interface {
	CreateEvent(ctx context.Context, params CreateEventParams) (*domain.Event, error)
	ListDiscoverableEvents(ctx context.Context, userID uuid.UUID, params DiscoverEventsParams) ([]DiscoverableEventRecord, error)
	GetEventDetail(ctx context.Context, userID, eventID uuid.UUID) (*EventDetailRecord, error)
	GetEventByID(ctx context.Context, eventID uuid.UUID) (*domain.Event, error)
	ExpireActiveEvents(ctx context.Context) error
}
