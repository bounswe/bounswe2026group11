package postgres

import (
	"context"
	"fmt"

	badgeapp "github.com/bounswe/bounswe2026group11/backend/internal/application/badge"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// BadgeRepository is the Postgres-backed implementation of badge.Repository.
type BadgeRepository struct {
	pool *pgxpool.Pool
	db   execer
}

// NewBadgeRepository returns a repository that executes queries against the given connection pool.
func NewBadgeRepository(pool *pgxpool.Pool) *BadgeRepository {
	return &BadgeRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

// ListAllBadges returns the full badge catalog ordered by sort_order.
func (r *BadgeRepository) ListAllBadges(ctx context.Context) ([]domain.Badge, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, slug, name, description, icon_url, category, sort_order
		FROM badge
		ORDER BY sort_order ASC, id ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list badges: %w", err)
	}
	defer rows.Close()

	var badges []domain.Badge
	for rows.Next() {
		b, err := scanBadge(rows)
		if err != nil {
			return nil, err
		}
		badges = append(badges, b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate badges: %w", err)
	}
	if badges == nil {
		badges = []domain.Badge{}
	}
	return badges, nil
}

// ListUserBadges returns the badges earned by the given user joined against the catalog.
func (r *BadgeRepository) ListUserBadges(ctx context.Context, userID uuid.UUID) ([]domain.UserBadge, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			ub.user_id,
			ub.badge_id,
			ub.earned_at,
			b.id,
			b.slug,
			b.name,
			b.description,
			b.icon_url,
			b.category,
			b.sort_order
		FROM user_badge ub
		JOIN badge b ON b.id = ub.badge_id
		WHERE ub.user_id = $1
		ORDER BY ub.earned_at DESC, b.sort_order ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list user badges: %w", err)
	}
	defer rows.Close()

	var earned []domain.UserBadge
	for rows.Next() {
		var (
			ub       domain.UserBadge
			def      domain.Badge
			iconURL  pgtype.Text
			slug     string
			category string
		)
		if err := rows.Scan(
			&ub.UserID, &ub.BadgeID, &ub.EarnedAt,
			&def.ID, &slug, &def.Name, &def.Description, &iconURL, &category, &def.SortOrder,
		); err != nil {
			return nil, fmt.Errorf("scan user badge: %w", err)
		}
		def.Slug = domain.BadgeSlug(slug)
		def.Category = domain.BadgeCategory(category)
		def.IconURL = textPtr(iconURL)
		ub.Slug = def.Slug
		ub.Definition = def
		earned = append(earned, ub)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate user badges: %w", err)
	}
	if earned == nil {
		earned = []domain.UserBadge{}
	}
	return earned, nil
}

// AwardBadge inserts a (user_id, badge_id) row using ON CONFLICT DO NOTHING so
// repeated evaluation calls never raise duplicate-key errors. Returns true
// when a new badge row was actually written for the user.
func (r *BadgeRepository) AwardBadge(ctx context.Context, userID uuid.UUID, slug domain.BadgeSlug) (bool, error) {
	tag, err := r.db.Exec(ctx, `
		INSERT INTO user_badge (user_id, badge_id)
		SELECT $1, b.id
		FROM badge b
		WHERE b.slug = $2
		ON CONFLICT (user_id, badge_id) DO NOTHING
	`, userID, string(slug))
	if err != nil {
		return false, fmt.Errorf("award badge: %w", err)
	}
	return tag.RowsAffected() == 1, nil
}

// ParticipationStats returns the participant-side metrics required by the
// participation badge rules.
func (r *BadgeRepository) ParticipationStats(ctx context.Context, userID uuid.UUID) (badgeapp.ParticipationStatsRecord, error) {
	var record badgeapp.ParticipationStatsRecord
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) AS completed_event_count,
			COUNT(DISTINCT e.category_id) FILTER (WHERE e.category_id IS NOT NULL) AS distinct_categories
		FROM participation p
		JOIN event e ON e.id = p.event_id
		WHERE p.user_id = $1
		  AND p.status = $2
		  AND e.status = $3
	`, userID, domain.ParticipationStatusApproved, domain.EventStatusCompleted).Scan(
		&record.CompletedEventCount,
		&record.DistinctCategoriesCount,
	)
	if err != nil {
		return record, fmt.Errorf("participation stats: %w", err)
	}
	return record, nil
}

// HostStats returns the host-side metrics required by the hosting badge rules.
func (r *BadgeRepository) HostStats(ctx context.Context, hostID uuid.UUID) (badgeapp.HostStatsRecord, error) {
	var (
		record    badgeapp.HostStatsRecord
		hostScore pgtype.Float8
	)
	err := r.db.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM event e WHERE e.host_id = $1 AND e.status = $2) AS completed_hosted_count,
			us.hosted_event_score,
			COALESCE(us.hosted_event_rating_count, 0) AS hosted_event_rating_count
		FROM app_user u
		LEFT JOIN user_score us ON us.user_id = u.id
		WHERE u.id = $1
	`, hostID, domain.EventStatusCompleted).Scan(
		&record.CompletedHostedEventCount,
		&hostScore,
		&record.HostRatingCount,
	)
	if err != nil {
		return record, fmt.Errorf("host stats: %w", err)
	}
	if hostScore.Valid {
		record.HostScore = &hostScore.Float64
	}
	return record, nil
}

// FavoriteLocationCount returns the total number of favorite locations saved
// by the given user.
func (r *BadgeRepository) FavoriteLocationCount(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM favorite_location WHERE user_id = $1
	`, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("favorite location count: %w", err)
	}
	return count, nil
}

func scanBadge(rows interface {
	Scan(...any) error
}) (domain.Badge, error) {
	var (
		b        domain.Badge
		iconURL  pgtype.Text
		slug     string
		category string
	)
	if err := rows.Scan(&b.ID, &slug, &b.Name, &b.Description, &iconURL, &category, &b.SortOrder); err != nil {
		return domain.Badge{}, fmt.Errorf("scan badge: %w", err)
	}
	b.Slug = domain.BadgeSlug(slug)
	b.Category = domain.BadgeCategory(category)
	b.IconURL = textPtr(iconURL)
	return b, nil
}

var _ badgeapp.Repository = (*BadgeRepository)(nil)
