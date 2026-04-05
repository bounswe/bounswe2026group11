package profile

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// --- fakes ---

type fakeUnitOfWork struct{}

func (u *fakeUnitOfWork) RunInTx(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}

type fakeProfileRepo struct {
	profile       *domain.UserProfile
	profileErr    error
	hostedEvents  []domain.EventSummary
	upcomingEvents []domain.EventSummary
	completedEvents []domain.EventSummary
	canceledEvents  []domain.EventSummary
	eventsErr      error
}

func (r *fakeProfileRepo) GetProfile(_ context.Context, _ uuid.UUID) (*domain.UserProfile, error) {
	return r.profile, r.profileErr
}

func (r *fakeProfileRepo) UpdateProfile(_ context.Context, _ UpdateProfileParams) error {
	return nil
}

func (r *fakeProfileRepo) GetHostedEvents(_ context.Context, _ uuid.UUID) ([]domain.EventSummary, error) {
	return r.hostedEvents, r.eventsErr
}

func (r *fakeProfileRepo) GetUpcomingEvents(_ context.Context, _ uuid.UUID) ([]domain.EventSummary, error) {
	return r.upcomingEvents, r.eventsErr
}

func (r *fakeProfileRepo) GetCompletedEvents(_ context.Context, _ uuid.UUID) ([]domain.EventSummary, error) {
	return r.completedEvents, r.eventsErr
}

func (r *fakeProfileRepo) GetCanceledEvents(_ context.Context, _ uuid.UUID) ([]domain.EventSummary, error) {
	return r.canceledEvents, r.eventsErr
}

func newService(repo *fakeProfileRepo) *Service {
	return NewService(repo, &fakeUnitOfWork{})
}

// --- GetMyProfile tests ---

func TestGetMyProfileMapsHostScore(t *testing.T) {
	score := 4.5
	repo := &fakeProfileRepo{
		profile: &domain.UserProfile{
			ID:       uuid.New(),
			Username: "testuser",
			Email:    "test@example.com",
			Status:   domain.UserStatusActive,
			FinalScore: &score,
			HostScore: domain.HostScore{
				Score:       &score,
				RatingCount: 8,
			},
			ParticipantScore: domain.ParticipantScore{
				Score:       nil,
				RatingCount: 0,
			},
		},
	}

	result, err := newService(repo).GetMyProfile(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetMyProfile() error = %v", err)
	}

	if result.FinalScore == nil || *result.FinalScore != score {
		t.Fatalf("expected final_score=%v, got %v", score, result.FinalScore)
	}
	if result.HostScore == nil {
		t.Fatal("expected host_score to be present")
	}
	if result.HostScore.Score == nil || *result.HostScore.Score != score {
		t.Fatalf("expected host_score.score=%v, got %v", score, result.HostScore.Score)
	}
	if result.HostScore.RatingCount != 8 {
		t.Fatalf("expected host_score.rating_count=8, got %d", result.HostScore.RatingCount)
	}
}

func TestGetMyProfileMapsParticipantScore(t *testing.T) {
	participantScore := 3.9
	repo := &fakeProfileRepo{
		profile: &domain.UserProfile{
			ID:       uuid.New(),
			Username: "testuser",
			Email:    "test@example.com",
			Status:   domain.UserStatusActive,
			ParticipantScore: domain.ParticipantScore{
				Score:       &participantScore,
				RatingCount: 12,
			},
		},
	}

	result, err := newService(repo).GetMyProfile(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetMyProfile() error = %v", err)
	}

	if result.ParticipantScore == nil {
		t.Fatal("expected participant_score to be present")
	}
	if result.ParticipantScore.Score == nil || *result.ParticipantScore.Score != participantScore {
		t.Fatalf("expected participant_score.score=%v, got %v", participantScore, result.ParticipantScore.Score)
	}
	if result.ParticipantScore.RatingCount != 12 {
		t.Fatalf("expected participant_score.rating_count=12, got %d", result.ParticipantScore.RatingCount)
	}
}

func TestGetMyProfileNullScoresForNewUser(t *testing.T) {
	repo := &fakeProfileRepo{
		profile: &domain.UserProfile{
			ID:       uuid.New(),
			Username: "newuser",
			Email:    "new@example.com",
			Status:   domain.UserStatusActive,
			// zero-value HostScore and ParticipantScore (no row in user_score)
		},
	}

	result, err := newService(repo).GetMyProfile(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetMyProfile() error = %v", err)
	}

	if result.FinalScore != nil {
		t.Fatalf("expected final_score=nil for new user, got %v", result.FinalScore)
	}
	if result.HostScore == nil || result.HostScore.Score != nil {
		t.Fatalf("expected host_score.score=nil for new user")
	}
	if result.HostScore.RatingCount != 0 {
		t.Fatalf("expected host_score.rating_count=0, got %d", result.HostScore.RatingCount)
	}
	if result.ParticipantScore == nil || result.ParticipantScore.Score != nil {
		t.Fatalf("expected participant_score.score=nil for new user")
	}
	if result.ParticipantScore.RatingCount != 0 {
		t.Fatalf("expected participant_score.rating_count=0, got %d", result.ParticipantScore.RatingCount)
	}
}

func TestGetMyProfilePropagatesRepoError(t *testing.T) {
	repo := &fakeProfileRepo{profileErr: errors.New("db error")}

	_, err := newService(repo).GetMyProfile(context.Background(), uuid.New())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

// --- event summary privacy_level tests ---

func TestGetMyHostedEventsIncludesPrivacyLevel(t *testing.T) {
	now := time.Now().UTC()
	repo := &fakeProfileRepo{
		hostedEvents: []domain.EventSummary{
			{ID: uuid.New(), Title: "T", StartTime: now, Status: "ACTIVE", PrivacyLevel: "PUBLIC"},
			{ID: uuid.New(), Title: "T2", StartTime: now, Status: "ACTIVE", PrivacyLevel: "PROTECTED"},
		},
	}

	events, err := newService(repo).GetMyHostedEvents(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetMyHostedEvents() error = %v", err)
	}

	if events[0].PrivacyLevel != "PUBLIC" {
		t.Fatalf("expected PUBLIC, got %q", events[0].PrivacyLevel)
	}
	if events[1].PrivacyLevel != "PROTECTED" {
		t.Fatalf("expected PROTECTED, got %q", events[1].PrivacyLevel)
	}
}

func TestGetMyUpcomingEventsIncludesPrivacyLevel(t *testing.T) {
	now := time.Now().UTC()
	repo := &fakeProfileRepo{
		upcomingEvents: []domain.EventSummary{
			{ID: uuid.New(), Title: "T", StartTime: now, Status: "ACTIVE", PrivacyLevel: "PROTECTED"},
		},
	}

	events, err := newService(repo).GetMyUpcomingEvents(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetMyUpcomingEvents() error = %v", err)
	}

	if events[0].PrivacyLevel != "PROTECTED" {
		t.Fatalf("expected PROTECTED, got %q", events[0].PrivacyLevel)
	}
}

func TestGetMyCanceledEventsIncludesPrivacyLevel(t *testing.T) {
	now := time.Now().UTC()
	repo := &fakeProfileRepo{
		canceledEvents: []domain.EventSummary{
			{ID: uuid.New(), Title: "T", StartTime: now, Status: "CANCELED", PrivacyLevel: "PRIVATE"},
		},
	}

	events, err := newService(repo).GetMyCanceledEvents(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetMyCanceledEvents() error = %v", err)
	}

	if events[0].PrivacyLevel != "PRIVATE" {
		t.Fatalf("expected PRIVATE, got %q", events[0].PrivacyLevel)
	}
}
