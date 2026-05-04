package badge

import (
	"context"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

const (
	// minTopRatedRatingCount is the minimum number of host ratings required
	// before the TOP_RATED badge becomes eligible. Mirrors the acceptance
	// criteria of issue #435.
	minTopRatedRatingCount = 5
	// topRatedThreshold is the minimum host score required for TOP_RATED.
	topRatedThreshold = 4.5
)

// Service owns badge-specific application behavior.
type Service struct {
	repo Repository
}

var _ UseCase = (*Service)(nil)

// NewService constructs a badge service backed by its repository port.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// ListMyBadges returns the badges earned by the authenticated user.
func (s *Service) ListMyBadges(ctx context.Context, userID uuid.UUID) (*ListUserBadgesResult, error) {
	return s.listUserBadges(ctx, userID)
}

// ListUserBadges returns the badges earned by the given public profile owner.
func (s *Service) ListUserBadges(ctx context.Context, userID uuid.UUID) (*ListUserBadgesResult, error) {
	return s.listUserBadges(ctx, userID)
}

func (s *Service) listUserBadges(ctx context.Context, userID uuid.UUID) (*ListUserBadgesResult, error) {
	earned, err := s.repo.ListUserBadges(ctx, userID)
	if err != nil {
		return nil, err
	}
	items := make([]EarnedBadgeItem, len(earned))
	for i, ub := range earned {
		items[i] = EarnedBadgeItem{
			BadgeItem: toBadgeItem(ub.Definition),
			EarnedAt:  ub.EarnedAt.Format(time.RFC3339),
		}
	}
	return &ListUserBadgesResult{Items: items}, nil
}

// ListBadges returns the full catalog with the viewer's earned status overlay.
func (s *Service) ListBadges(ctx context.Context, userID uuid.UUID) (*ListBadgesResult, error) {
	all, err := s.repo.ListAllBadges(ctx)
	if err != nil {
		return nil, err
	}
	earned, err := s.repo.ListUserBadges(ctx, userID)
	if err != nil {
		return nil, err
	}
	earnedAt := make(map[domain.BadgeSlug]time.Time, len(earned))
	for _, ub := range earned {
		earnedAt[ub.Slug] = ub.EarnedAt
	}
	items := make([]CatalogBadgeItem, len(all))
	for i, b := range all {
		entry := CatalogBadgeItem{BadgeItem: toBadgeItem(b)}
		if t, ok := earnedAt[b.Slug]; ok {
			entry.Earned = true
			formatted := t.Format(time.RFC3339)
			entry.EarnedAt = &formatted
		}
		items[i] = entry
	}
	return &ListBadgesResult{Items: items}, nil
}

func toBadgeItem(b domain.Badge) BadgeItem {
	return BadgeItem{
		Slug:        b.Slug.String(),
		Name:        b.Name,
		Description: b.Description,
		IconURL:     b.IconURL,
		Category:    b.Category.String(),
	}
}

// EvaluateParticipationBadges awards FIRST_STEPS / REGULAR / VETERAN / EXPLORER
// based on the participant-side metrics. AwardBadge is idempotent so this
// method is safe to call from any participation transition.
func (s *Service) EvaluateParticipationBadges(ctx context.Context, userID uuid.UUID) error {
	stats, err := s.repo.ParticipationStats(ctx, userID)
	if err != nil {
		return err
	}
	if stats.CompletedEventCount >= 1 {
		if _, err := s.repo.AwardBadge(ctx, userID, domain.BadgeSlugFirstSteps); err != nil {
			return err
		}
	}
	if stats.CompletedEventCount >= 5 {
		if _, err := s.repo.AwardBadge(ctx, userID, domain.BadgeSlugRegular); err != nil {
			return err
		}
	}
	if stats.CompletedEventCount >= 20 {
		if _, err := s.repo.AwardBadge(ctx, userID, domain.BadgeSlugVeteran); err != nil {
			return err
		}
	}
	if stats.DistinctCategoriesCount >= 3 {
		if _, err := s.repo.AwardBadge(ctx, userID, domain.BadgeSlugExplorer); err != nil {
			return err
		}
	}
	return nil
}

// EvaluateHostBadges awards HOST_DEBUT / SUPER_HOST / TOP_RATED for the host.
// Should be called after a host completes a new event or receives a new rating.
func (s *Service) EvaluateHostBadges(ctx context.Context, hostID uuid.UUID) error {
	stats, err := s.repo.HostStats(ctx, hostID)
	if err != nil {
		return err
	}
	if stats.CompletedHostedEventCount >= 1 {
		if _, err := s.repo.AwardBadge(ctx, hostID, domain.BadgeSlugHostDebut); err != nil {
			return err
		}
	}
	if stats.CompletedHostedEventCount >= 10 {
		if _, err := s.repo.AwardBadge(ctx, hostID, domain.BadgeSlugSuperHost); err != nil {
			return err
		}
	}
	if stats.HostRatingCount >= minTopRatedRatingCount && stats.HostScore != nil && *stats.HostScore >= topRatedThreshold {
		if _, err := s.repo.AwardBadge(ctx, hostID, domain.BadgeSlugTopRated); err != nil {
			return err
		}
	}
	return nil
}

// EvaluateFavoriteLocationBadges awards FAVORITE_FINDER once the user has saved
// at least 3 favorite locations.
func (s *Service) EvaluateFavoriteLocationBadges(ctx context.Context, userID uuid.UUID) error {
	count, err := s.repo.FavoriteLocationCount(ctx, userID)
	if err != nil {
		return err
	}
	if count >= 3 {
		if _, err := s.repo.AwardBadge(ctx, userID, domain.BadgeSlugFavoriteFinder); err != nil {
			return err
		}
	}
	return nil
}
