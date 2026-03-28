package event

import "context"

import "github.com/google/uuid"

// UseCase is the inbound application port for event flows.
type UseCase interface {
	CreateEvent(ctx context.Context, hostID uuid.UUID, input CreateEventInput) (*CreateEventResult, error)
	JoinEvent(ctx context.Context, userID, eventID uuid.UUID) (*JoinEventResult, error)
	RequestJoin(ctx context.Context, userID, eventID uuid.UUID, input RequestJoinInput) (*RequestJoinResult, error)
}
