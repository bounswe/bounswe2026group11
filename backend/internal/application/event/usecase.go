package event

import "context"

import "github.com/google/uuid"

// UseCase is the inbound application port for event flows.
type UseCase interface {
	CreateEvent(ctx context.Context, hostID uuid.UUID, input CreateEventInput) (*CreateEventResult, error)
	DiscoverEvents(ctx context.Context, userID uuid.UUID, input DiscoverEventsInput) (*DiscoverEventsResult, error)
	GetEventDetail(ctx context.Context, userID, eventID uuid.UUID) (*GetEventDetailResult, error)
	JoinEvent(ctx context.Context, userID, eventID uuid.UUID) (*JoinEventResult, error)
	LeaveEvent(ctx context.Context, userID, eventID uuid.UUID) (*LeaveEventResult, error)
	RequestJoin(ctx context.Context, userID, eventID uuid.UUID, input RequestJoinInput) (*RequestJoinResult, error)
	ApproveJoinRequest(ctx context.Context, hostUserID, eventID, joinRequestID uuid.UUID) (*ApproveJoinRequestResult, error)
	RejectJoinRequest(ctx context.Context, hostUserID, eventID, joinRequestID uuid.UUID) (*RejectJoinRequestResult, error)
	CancelEvent(ctx context.Context, userID, eventID uuid.UUID) error
	CompleteEvent(ctx context.Context, userID, eventID uuid.UUID) error
	AddFavorite(ctx context.Context, userID, eventID uuid.UUID) error
	RemoveFavorite(ctx context.Context, userID, eventID uuid.UUID) error
	ListFavoriteEvents(ctx context.Context, userID uuid.UUID) (*FavoriteEventsResult, error)
}
