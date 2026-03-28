package event

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Repository is the application-layer persistence port for event flows.
type Repository interface {
	CreateEvent(ctx context.Context, params CreateEventParams) (*domain.Event, error)
	GetEventByID(ctx context.Context, eventID uuid.UUID) (*domain.Event, error)
}
