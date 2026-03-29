package rating

import (
	"context"

	"github.com/google/uuid"
)

// UseCase is the inbound application port for rating flows.
type UseCase interface {
	UpsertEventRating(ctx context.Context, participantUserID, eventID uuid.UUID, input UpsertRatingInput) (*RatingResult, error)
	DeleteEventRating(ctx context.Context, participantUserID, eventID uuid.UUID) error
	UpsertParticipantRating(ctx context.Context, hostUserID, eventID, participantUserID uuid.UUID, input UpsertRatingInput) (*RatingResult, error)
	DeleteParticipantRating(ctx context.Context, hostUserID, eventID, participantUserID uuid.UUID) error
}
