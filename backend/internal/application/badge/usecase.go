package badge

import (
	"context"

	"github.com/google/uuid"
)

// UseCase is the inbound application port for badge flows.
type UseCase interface {
	// ListMyBadges returns the badges earned by the authenticated user.
	ListMyBadges(ctx context.Context, userID uuid.UUID) (*ListUserBadgesResult, error)
	// ListUserBadges returns badges earned by the given public profile owner.
	ListUserBadges(ctx context.Context, userID uuid.UUID) (*ListUserBadgesResult, error)
	// ListBadges returns the full badge catalog with earned status for the
	// authenticated user. earnedAt is omitted for badges the viewer has not
	// earned yet.
	ListBadges(ctx context.Context, userID uuid.UUID) (*ListBadgesResult, error)

	// EvaluateParticipationBadges runs idempotent badge evaluation after a
	// participation status change for the given user.
	EvaluateParticipationBadges(ctx context.Context, userID uuid.UUID) error
	// EvaluateHostBadges runs idempotent badge evaluation after a rating is
	// submitted against the given host or after a host completes a new event.
	EvaluateHostBadges(ctx context.Context, hostID uuid.UUID) error
	// EvaluateFavoriteLocationBadges runs idempotent badge evaluation after a
	// favorite-location is saved by the given user.
	EvaluateFavoriteLocationBadges(ctx context.Context, userID uuid.UUID) error
}
