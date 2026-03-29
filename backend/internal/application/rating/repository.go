package rating

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Repository is the application-layer persistence port for rating flows.
type Repository interface {
	WithTx(ctx context.Context, fn func(repo Repository) error) error
	GetEventRatingContext(ctx context.Context, eventID, participantUserID uuid.UUID) (*EventRatingContext, error)
	UpsertEventRating(ctx context.Context, params UpsertEventRatingParams) (*domain.EventRating, error)
	DeleteEventRating(ctx context.Context, eventID, participantUserID uuid.UUID) (bool, error)
	GetParticipantRatingContext(ctx context.Context, eventID, hostUserID, participantUserID uuid.UUID) (*ParticipantRatingContext, error)
	UpsertParticipantRating(ctx context.Context, params UpsertParticipantRatingParams) (*domain.ParticipantRating, error)
	DeleteParticipantRating(ctx context.Context, eventID, hostUserID, participantUserID uuid.UUID) (bool, error)
	CalculateParticipantAggregate(ctx context.Context, userID uuid.UUID) (*ScoreAggregate, error)
	CalculateHostedEventAggregate(ctx context.Context, userID uuid.UUID) (*ScoreAggregate, error)
	UpsertUserScore(ctx context.Context, params UpsertUserScoreParams) error
}
