package event

import (
	"context"
	"errors"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// ErrEventNotCancelable is returned by Repository.CancelEvent when the event is not in ACTIVE status.
var ErrEventNotCancelable = errors.New("event is not cancelable")

// Repository is the application-layer persistence port for event flows.
type Repository interface {
	CreateEvent(ctx context.Context, params CreateEventParams) (*domain.Event, error)
	ListDiscoverableEvents(ctx context.Context, userID uuid.UUID, params DiscoverEventsParams) ([]DiscoverableEventRecord, error)
	GetEventDetail(ctx context.Context, userID, eventID uuid.UUID) (*EventDetailRecord, error)
	GetEventByID(ctx context.Context, eventID uuid.UUID) (*domain.Event, error)
	TransitionEventStatuses(ctx context.Context) error
	CancelEvent(ctx context.Context, eventID uuid.UUID) error
	AddFavorite(ctx context.Context, userID, eventID uuid.UUID) error
	RemoveFavorite(ctx context.Context, userID, eventID uuid.UUID) error
	ListFavoriteEvents(ctx context.Context, userID uuid.UUID) ([]FavoriteEventRecord, error)
}
