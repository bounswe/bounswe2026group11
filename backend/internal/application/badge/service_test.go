package badge

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type fakeRepo struct {
	all              []domain.Badge
	earnedByUser     map[uuid.UUID][]domain.UserBadge
	participation    map[uuid.UUID]ParticipationStatsRecord
	host             map[uuid.UUID]HostStatsRecord
	favoriteCounts   map[uuid.UUID]int
	awarded          map[uuid.UUID][]domain.BadgeSlug
	awardErr         error
	listAllErr       error
	listUserErr      error
	participationErr error
	hostErr          error
	favoriteCountErr error
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		earnedByUser:   map[uuid.UUID][]domain.UserBadge{},
		participation:  map[uuid.UUID]ParticipationStatsRecord{},
		host:           map[uuid.UUID]HostStatsRecord{},
		favoriteCounts: map[uuid.UUID]int{},
		awarded:        map[uuid.UUID][]domain.BadgeSlug{},
	}
}

func (r *fakeRepo) ListAllBadges(ctx context.Context) ([]domain.Badge, error) {
	if r.listAllErr != nil {
		return nil, r.listAllErr
	}
	return r.all, nil
}

func (r *fakeRepo) ListUserBadges(ctx context.Context, userID uuid.UUID) ([]domain.UserBadge, error) {
	if r.listUserErr != nil {
		return nil, r.listUserErr
	}
	return r.earnedByUser[userID], nil
}

func (r *fakeRepo) AwardBadge(ctx context.Context, userID uuid.UUID, slug domain.BadgeSlug) (bool, error) {
	if r.awardErr != nil {
		return false, r.awardErr
	}
	for _, existing := range r.awarded[userID] {
		if existing == slug {
			return false, nil
		}
	}
	r.awarded[userID] = append(r.awarded[userID], slug)
	return true, nil
}

func (r *fakeRepo) ParticipationStats(ctx context.Context, userID uuid.UUID) (ParticipationStatsRecord, error) {
	if r.participationErr != nil {
		return ParticipationStatsRecord{}, r.participationErr
	}
	return r.participation[userID], nil
}

func (r *fakeRepo) HostStats(ctx context.Context, hostID uuid.UUID) (HostStatsRecord, error) {
	if r.hostErr != nil {
		return HostStatsRecord{}, r.hostErr
	}
	return r.host[hostID], nil
}

func (r *fakeRepo) FavoriteLocationCount(ctx context.Context, userID uuid.UUID) (int, error) {
	if r.favoriteCountErr != nil {
		return 0, r.favoriteCountErr
	}
	return r.favoriteCounts[userID], nil
}

func sampleCatalog() []domain.Badge {
	return []domain.Badge{
		{ID: 1, Slug: domain.BadgeSlugFirstSteps, Name: "First Steps", Description: "First completed event.", Category: domain.BadgeCategoryParticipation, SortOrder: 1},
		{ID: 2, Slug: domain.BadgeSlugRegular, Name: "Regular Attendee", Description: "Five completed events.", Category: domain.BadgeCategoryParticipation, SortOrder: 2},
		{ID: 3, Slug: domain.BadgeSlugFavoriteFinder, Name: "Favorite Finder", Description: "Saved three favorite locations.", Category: domain.BadgeCategorySocial, SortOrder: 3},
	}
}

func TestServiceListMyBadgesEmpty(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	result, err := svc.ListMyBadges(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Items) != 0 {
		t.Fatalf("expected zero items, got %d", len(result.Items))
	}
}

func TestServiceListMyBadgesProjectsRowsToWire(t *testing.T) {
	repo := newFakeRepo()
	userID := uuid.New()
	earnedAt := time.Date(2026, 5, 1, 10, 0, 0, 0, time.UTC)
	repo.earnedByUser[userID] = []domain.UserBadge{{
		UserID:   userID,
		BadgeID:  1,
		Slug:     domain.BadgeSlugFirstSteps,
		EarnedAt: earnedAt,
		Definition: domain.Badge{
			ID: 1, Slug: domain.BadgeSlugFirstSteps,
			Name: "First Steps", Description: "First completed event.",
			Category: domain.BadgeCategoryParticipation, SortOrder: 1,
		},
	}}
	svc := NewService(repo)

	result, err := svc.ListMyBadges(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(result.Items))
	}
	got := result.Items[0]
	if got.Slug != string(domain.BadgeSlugFirstSteps) {
		t.Errorf("slug = %q, want %q", got.Slug, domain.BadgeSlugFirstSteps)
	}
	if got.Category != string(domain.BadgeCategoryParticipation) {
		t.Errorf("category = %q, want %q", got.Category, domain.BadgeCategoryParticipation)
	}
	if got.EarnedAt != earnedAt.Format(time.RFC3339) {
		t.Errorf("earned_at = %q, want %q", got.EarnedAt, earnedAt.Format(time.RFC3339))
	}
}

func TestServiceListBadgesMergesEarnedStatus(t *testing.T) {
	repo := newFakeRepo()
	repo.all = sampleCatalog()
	userID := uuid.New()
	earnedAt := time.Date(2026, 5, 1, 10, 0, 0, 0, time.UTC)
	repo.earnedByUser[userID] = []domain.UserBadge{{
		Slug: domain.BadgeSlugFirstSteps, EarnedAt: earnedAt,
		Definition: repo.all[0],
	}}
	svc := NewService(repo)

	result, err := svc.ListBadges(context.Background(), userID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Items) != 3 {
		t.Fatalf("expected 3 catalog entries, got %d", len(result.Items))
	}

	first := result.Items[0]
	if first.Slug != string(domain.BadgeSlugFirstSteps) || !first.Earned {
		t.Errorf("first badge = %+v; want earned FIRST_STEPS", first)
	}
	if first.EarnedAt == nil || *first.EarnedAt != earnedAt.Format(time.RFC3339) {
		t.Errorf("first.earned_at = %v, want %q", first.EarnedAt, earnedAt.Format(time.RFC3339))
	}
	for _, item := range result.Items[1:] {
		if item.Earned {
			t.Errorf("badge %s should be unearned", item.Slug)
		}
		if item.EarnedAt != nil {
			t.Errorf("badge %s should have nil earned_at, got %v", item.Slug, item.EarnedAt)
		}
	}
}

func TestEvaluateParticipationBadgesAwardsTieredBadges(t *testing.T) {
	repo := newFakeRepo()
	userID := uuid.New()
	repo.participation[userID] = ParticipationStatsRecord{
		CompletedEventCount:     5,
		DistinctCategoriesCount: 3,
	}
	svc := NewService(repo)

	if err := svc.EvaluateParticipationBadges(context.Background(), userID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := repo.awarded[userID]
	want := []domain.BadgeSlug{
		domain.BadgeSlugFirstSteps,
		domain.BadgeSlugRegular,
		domain.BadgeSlugExplorer,
	}
	if !sameSet(got, want) {
		t.Errorf("awarded slugs = %v, want %v", got, want)
	}
}

func TestEvaluateParticipationBadgesBelowThreshold(t *testing.T) {
	repo := newFakeRepo()
	userID := uuid.New()
	repo.participation[userID] = ParticipationStatsRecord{
		CompletedEventCount:     0,
		DistinctCategoriesCount: 1,
	}
	svc := NewService(repo)

	if err := svc.EvaluateParticipationBadges(context.Background(), userID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.awarded[userID]) != 0 {
		t.Errorf("expected no awards, got %v", repo.awarded[userID])
	}
}

func TestEvaluateParticipationBadgesIdempotent(t *testing.T) {
	repo := newFakeRepo()
	userID := uuid.New()
	repo.participation[userID] = ParticipationStatsRecord{
		CompletedEventCount:     20,
		DistinctCategoriesCount: 4,
	}
	svc := NewService(repo)

	for i := 0; i < 3; i++ {
		if err := svc.EvaluateParticipationBadges(context.Background(), userID); err != nil {
			t.Fatalf("unexpected error on iteration %d: %v", i, err)
		}
	}
	got := repo.awarded[userID]
	want := []domain.BadgeSlug{
		domain.BadgeSlugFirstSteps,
		domain.BadgeSlugRegular,
		domain.BadgeSlugVeteran,
		domain.BadgeSlugExplorer,
	}
	if !sameSet(got, want) {
		t.Errorf("awarded slugs = %v, want %v", got, want)
	}
}

func TestEvaluateHostBadgesRequiresMinRatingsForTopRated(t *testing.T) {
	repo := newFakeRepo()
	hostID := uuid.New()
	score := 4.9
	repo.host[hostID] = HostStatsRecord{
		CompletedHostedEventCount: 10,
		HostScore:                 &score,
		HostRatingCount:           4, // below minTopRatedRatingCount (5)
	}
	svc := NewService(repo)

	if err := svc.EvaluateHostBadges(context.Background(), hostID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := repo.awarded[hostID]
	want := []domain.BadgeSlug{
		domain.BadgeSlugHostDebut,
		domain.BadgeSlugSuperHost,
	}
	if !sameSet(got, want) {
		t.Errorf("awarded slugs = %v, want %v", got, want)
	}
}

func TestEvaluateHostBadgesAwardsTopRated(t *testing.T) {
	repo := newFakeRepo()
	hostID := uuid.New()
	score := 4.6
	repo.host[hostID] = HostStatsRecord{
		CompletedHostedEventCount: 10,
		HostScore:                 &score,
		HostRatingCount:           5,
	}
	svc := NewService(repo)

	if err := svc.EvaluateHostBadges(context.Background(), hostID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := repo.awarded[hostID]
	want := []domain.BadgeSlug{
		domain.BadgeSlugHostDebut,
		domain.BadgeSlugSuperHost,
		domain.BadgeSlugTopRated,
	}
	if !sameSet(got, want) {
		t.Errorf("awarded slugs = %v, want %v", got, want)
	}
}

func TestEvaluateHostBadgesScoreBelowThreshold(t *testing.T) {
	repo := newFakeRepo()
	hostID := uuid.New()
	score := 4.4
	repo.host[hostID] = HostStatsRecord{
		CompletedHostedEventCount: 1,
		HostScore:                 &score,
		HostRatingCount:           10,
	}
	svc := NewService(repo)

	if err := svc.EvaluateHostBadges(context.Background(), hostID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := repo.awarded[hostID]
	want := []domain.BadgeSlug{domain.BadgeSlugHostDebut}
	if !sameSet(got, want) {
		t.Errorf("awarded slugs = %v, want %v", got, want)
	}
}

func TestEvaluateFavoriteLocationBadgesAwardsAtThree(t *testing.T) {
	repo := newFakeRepo()
	userID := uuid.New()
	repo.favoriteCounts[userID] = 3
	svc := NewService(repo)

	if err := svc.EvaluateFavoriteLocationBadges(context.Background(), userID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := repo.awarded[userID]
	want := []domain.BadgeSlug{domain.BadgeSlugFavoriteFinder}
	if !sameSet(got, want) {
		t.Errorf("awarded slugs = %v, want %v", got, want)
	}
}

func TestEvaluateFavoriteLocationBadgesBelowThreshold(t *testing.T) {
	repo := newFakeRepo()
	userID := uuid.New()
	repo.favoriteCounts[userID] = 2
	svc := NewService(repo)

	if err := svc.EvaluateFavoriteLocationBadges(context.Background(), userID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.awarded[userID]) != 0 {
		t.Errorf("expected no awards, got %v", repo.awarded[userID])
	}
}

func TestEvaluateParticipationBadgesPropagatesRepoError(t *testing.T) {
	repo := newFakeRepo()
	repo.participationErr = errors.New("boom")
	svc := NewService(repo)

	err := svc.EvaluateParticipationBadges(context.Background(), uuid.New())
	if err == nil || err.Error() != "boom" {
		t.Errorf("err = %v, want boom", err)
	}
}

func sameSet(got, want []domain.BadgeSlug) bool {
	if len(got) != len(want) {
		return false
	}
	gotMap := make(map[domain.BadgeSlug]struct{}, len(got))
	for _, slug := range got {
		gotMap[slug] = struct{}{}
	}
	for _, slug := range want {
		if _, ok := gotMap[slug]; !ok {
			return false
		}
	}
	return true
}
