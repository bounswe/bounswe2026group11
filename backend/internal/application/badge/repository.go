package badge

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Repository is the application-layer persistence port for badge flows.
type Repository interface {
	// ListAllBadges returns every badge definition in the catalog ordered by
	// the badge's stable sort order.
	ListAllBadges(ctx context.Context) ([]domain.Badge, error)
	// ListUserBadges returns the badges earned by the given user, joined
	// against their definition and ordered by earned_at descending.
	ListUserBadges(ctx context.Context, userID uuid.UUID) ([]domain.UserBadge, error)
	// AwardBadge inserts a (user_id, badge_id) row using a NOT EXISTS clause
	// so re-evaluation never raises a duplicate-key error. Returns true when
	// a new badge row was actually written for the user.
	AwardBadge(ctx context.Context, userID uuid.UUID, slug domain.BadgeSlug) (bool, error)

	// ParticipationStats returns the lightweight metrics required by the
	// participation badge rules: total completed events, distinct categories
	// across completed events, and total favorite-location count.
	ParticipationStats(ctx context.Context, userID uuid.UUID) (ParticipationStatsRecord, error)
	// HostStats returns the metrics required by the hosting badge rules.
	HostStats(ctx context.Context, hostID uuid.UUID) (HostStatsRecord, error)
	// FavoriteLocationCount returns the number of favorite locations saved
	// by the given user.
	FavoriteLocationCount(ctx context.Context, userID uuid.UUID) (int, error)
	// ListParticipationBadgeCandidateUserIDs returns the distinct users whose
	// existing completed participations may qualify them for participation
	// badges during retroactive backfill.
	ListParticipationBadgeCandidateUserIDs(ctx context.Context) ([]uuid.UUID, error)
	// ListHostBadgeCandidateUserIDs returns the distinct hosts whose completed
	// events may qualify them for hosting badges during retroactive backfill.
	ListHostBadgeCandidateUserIDs(ctx context.Context) ([]uuid.UUID, error)
	// ListFavoriteLocationBadgeCandidateUserIDs returns the distinct users who
	// have at least one saved favorite location and may qualify for social
	// badges during retroactive backfill.
	ListFavoriteLocationBadgeCandidateUserIDs(ctx context.Context) ([]uuid.UUID, error)
}
