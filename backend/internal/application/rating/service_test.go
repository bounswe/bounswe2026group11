package rating

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type fakeRatingRepo struct {
	eventContext               *EventRatingContext
	participantContext         *ParticipantRatingContext
	eventContextErr            error
	participantContextErr      error
	eventRating                *domain.EventRating
	participantRating          *domain.ParticipantRating
	eventDeleteResult          bool
	participantDeleteResult    bool
	participantAggregate       *ScoreAggregate
	hostedAggregate            *ScoreAggregate
	lastEventUpsert            UpsertEventRatingParams
	lastParticipantUpsert      UpsertParticipantRatingParams
	lastUserScore              UpsertUserScoreParams
	upsertEventCallCount       int
	upsertParticipantCallCount int
	deleteEventCallCount       int
	deleteParticipantCallCount int
	withTxCallCount            int
}

func (r *fakeRatingRepo) WithTx(_ context.Context, fn func(repo Repository) error) error {
	r.withTxCallCount++
	return fn(r)
}

func (r *fakeRatingRepo) GetEventRatingContext(_ context.Context, _, _ uuid.UUID) (*EventRatingContext, error) {
	if r.eventContextErr != nil {
		return nil, r.eventContextErr
	}
	return r.eventContext, nil
}

func (r *fakeRatingRepo) UpsertEventRating(_ context.Context, params UpsertEventRatingParams) (*domain.EventRating, error) {
	r.upsertEventCallCount++
	r.lastEventUpsert = params
	if r.eventRating != nil {
		return r.eventRating, nil
	}

	now := time.Now().UTC()
	return &domain.EventRating{
		ID:                uuid.New(),
		EventID:           params.EventID,
		ParticipantUserID: params.ParticipantUserID,
		Rating:            params.Rating,
		Message:           params.Message,
		CreatedAt:         now,
		UpdatedAt:         now,
	}, nil
}

func (r *fakeRatingRepo) DeleteEventRating(_ context.Context, _, _ uuid.UUID) (bool, error) {
	r.deleteEventCallCount++
	return r.eventDeleteResult, nil
}

func (r *fakeRatingRepo) GetParticipantRatingContext(_ context.Context, _, _, _ uuid.UUID) (*ParticipantRatingContext, error) {
	if r.participantContextErr != nil {
		return nil, r.participantContextErr
	}
	return r.participantContext, nil
}

func (r *fakeRatingRepo) UpsertParticipantRating(_ context.Context, params UpsertParticipantRatingParams) (*domain.ParticipantRating, error) {
	r.upsertParticipantCallCount++
	r.lastParticipantUpsert = params
	if r.participantRating != nil {
		return r.participantRating, nil
	}

	now := time.Now().UTC()
	return &domain.ParticipantRating{
		ID:                uuid.New(),
		EventID:           params.EventID,
		HostUserID:        params.HostUserID,
		ParticipantUserID: params.ParticipantUserID,
		Rating:            params.Rating,
		Message:           params.Message,
		CreatedAt:         now,
		UpdatedAt:         now,
	}, nil
}

func (r *fakeRatingRepo) DeleteParticipantRating(_ context.Context, _, _, _ uuid.UUID) (bool, error) {
	r.deleteParticipantCallCount++
	return r.participantDeleteResult, nil
}

func (r *fakeRatingRepo) CalculateParticipantAggregate(_ context.Context, _ uuid.UUID) (*ScoreAggregate, error) {
	if r.participantAggregate != nil {
		return r.participantAggregate, nil
	}
	return &ScoreAggregate{}, nil
}

func (r *fakeRatingRepo) CalculateHostedEventAggregate(_ context.Context, _ uuid.UUID) (*ScoreAggregate, error) {
	if r.hostedAggregate != nil {
		return r.hostedAggregate, nil
	}
	return &ScoreAggregate{}, nil
}

func (r *fakeRatingRepo) UpsertUserScore(_ context.Context, params UpsertUserScoreParams) error {
	r.lastUserScore = params
	return nil
}

func TestUpsertEventRatingNormalizesBlankMessageAndRefreshesHostScore(t *testing.T) {
	// given
	hostUserID := uuid.New()
	participantUserID := uuid.New()
	eventID := uuid.New()
	now := time.Date(2026, time.March, 29, 10, 0, 0, 0, time.UTC)
	repo := &fakeRatingRepo{
		eventContext: &EventRatingContext{
			EventID:               eventID,
			HostUserID:            hostUserID,
			Status:                domain.EventStatusActive,
			StartTime:             now.Add(-2 * time.Hour),
			EndTime:               timePtr(now.Add(-time.Hour)),
			IsApprovedParticipant: true,
		},
		hostedAggregate: &ScoreAggregate{
			Average: floatPtr(4.5),
			Count:   2,
		},
	}
	service := NewService(repo, Settings{GlobalPrior: 4.0, BayesianM: 5})
	service.now = func() time.Time { return now }

	// when
	result, err := service.UpsertEventRating(context.Background(), participantUserID, eventID, UpsertRatingInput{
		Rating:  5,
		Message: stringPtr("   "),
	})

	// then
	if err != nil {
		t.Fatalf("UpsertEventRating() error = %v", err)
	}
	if repo.lastEventUpsert.Message != nil {
		t.Fatalf("expected normalized message to be nil, got %v", repo.lastEventUpsert.Message)
	}
	if result.Message != nil {
		t.Fatalf("expected response message to be nil, got %v", result.Message)
	}
	if repo.lastUserScore.UserID != hostUserID {
		t.Fatalf("expected user_score refresh for host %s, got %s", hostUserID, repo.lastUserScore.UserID)
	}
	expected := (4.5*2 + 4.0*5) / 7.0
	if repo.lastUserScore.FinalScore == nil || math.Abs(*repo.lastUserScore.FinalScore-expected) > 0.00001 {
		t.Fatalf("expected final score %.5f, got %v", expected, repo.lastUserScore.FinalScore)
	}
}

func TestUpsertEventRatingRejectsInvalidInput(t *testing.T) {
	// given
	repo := &fakeRatingRepo{}
	service := NewService(repo, Settings{GlobalPrior: 4.0, BayesianM: 5})

	// when
	_, err := service.UpsertEventRating(context.Background(), uuid.New(), uuid.New(), UpsertRatingInput{
		Rating:  6,
		Message: stringPtr("short"),
	})

	// then
	_ = requireAppErrorCode(t, err, domain.ErrorCodeValidation)
	if repo.withTxCallCount != 0 {
		t.Fatalf("expected repository transaction not to start, got %d", repo.withTxCallCount)
	}
}

func TestUpsertEventRatingRejectsCanceledEvent(t *testing.T) {
	// given
	now := time.Date(2026, time.March, 29, 10, 0, 0, 0, time.UTC)
	repo := &fakeRatingRepo{
		eventContext: &EventRatingContext{
			EventID:               uuid.New(),
			HostUserID:            uuid.New(),
			Status:                domain.EventStatusCanceled,
			StartTime:             now.Add(-2 * time.Hour),
			EndTime:               timePtr(now.Add(-time.Hour)),
			IsApprovedParticipant: true,
		},
	}
	service := NewService(repo, Settings{GlobalPrior: 4.0, BayesianM: 5})
	service.now = func() time.Time { return now }

	// when
	_, err := service.UpsertEventRating(context.Background(), uuid.New(), uuid.New(), UpsertRatingInput{Rating: 4})

	// then
	_ = requireAppErrorCode(t, err, domain.ErrorCodeRatingNotAllowed)
	if repo.upsertEventCallCount != 0 {
		t.Fatalf("expected no upsert call, got %d", repo.upsertEventCallCount)
	}
}

func TestUpsertEventRatingRejectsHostSelfBeforeApprovedParticipantCheck(t *testing.T) {
	// given
	hostUserID := uuid.New()
	now := time.Date(2026, time.March, 29, 10, 0, 0, 0, time.UTC)
	repo := &fakeRatingRepo{
		eventContext: &EventRatingContext{
			EventID:               uuid.New(),
			HostUserID:            hostUserID,
			Status:                domain.EventStatusActive,
			StartTime:             now.Add(-2 * time.Hour),
			EndTime:               timePtr(now.Add(-time.Hour)),
			IsRequestingHost:      true,
			IsApprovedParticipant: false,
		},
	}
	service := NewService(repo, Settings{GlobalPrior: 4.0, BayesianM: 5})
	service.now = func() time.Time { return now }

	// when
	_, err := service.UpsertEventRating(context.Background(), hostUserID, uuid.New(), UpsertRatingInput{Rating: 4})

	// then
	appErr := requireAppErrorCode(t, err, domain.ErrorCodeHostCannotRateSelf)
	if appErr.Message != "The event host cannot rate their own event." {
		t.Fatalf("expected host self-rating message, got %q", appErr.Message)
	}
	if repo.upsertEventCallCount != 0 {
		t.Fatalf("expected no upsert call, got %d", repo.upsertEventCallCount)
	}
}

func TestUpsertParticipantRatingRejectsHostSelf(t *testing.T) {
	// given
	hostUserID := uuid.New()
	now := time.Date(2026, time.March, 29, 10, 0, 0, 0, time.UTC)
	repo := &fakeRatingRepo{
		participantContext: &ParticipantRatingContext{
			EventID:               uuid.New(),
			HostUserID:            hostUserID,
			ParticipantUserID:     hostUserID,
			Status:                domain.EventStatusActive,
			StartTime:             now.Add(-2 * time.Hour),
			EndTime:               timePtr(now.Add(-time.Hour)),
			IsRequestingHost:      true,
			IsApprovedParticipant: true,
		},
	}
	service := NewService(repo, Settings{GlobalPrior: 4.0, BayesianM: 5})
	service.now = func() time.Time { return now }

	// when
	_, err := service.UpsertParticipantRating(context.Background(), hostUserID, uuid.New(), hostUserID, UpsertRatingInput{Rating: 4})

	// then
	_ = requireAppErrorCode(t, err, domain.ErrorCodeHostCannotRateSelf)
}

func TestUpsertParticipantRatingRefreshesWeightedFinalScore(t *testing.T) {
	// given
	hostUserID := uuid.New()
	participantUserID := uuid.New()
	eventID := uuid.New()
	now := time.Date(2026, time.March, 29, 10, 0, 0, 0, time.UTC)
	repo := &fakeRatingRepo{
		participantContext: &ParticipantRatingContext{
			EventID:               eventID,
			HostUserID:            hostUserID,
			ParticipantUserID:     participantUserID,
			Status:                domain.EventStatusActive,
			StartTime:             now.Add(-2 * time.Hour),
			EndTime:               timePtr(now.Add(-time.Hour)),
			IsRequestingHost:      true,
			IsApprovedParticipant: true,
		},
		participantAggregate: &ScoreAggregate{
			Average: floatPtr(3.0),
			Count:   2,
		},
		hostedAggregate: &ScoreAggregate{
			Average: floatPtr(4.0),
			Count:   10,
		},
	}
	service := NewService(repo, Settings{GlobalPrior: 4.0, BayesianM: 5})
	service.now = func() time.Time { return now }

	// when
	_, err := service.UpsertParticipantRating(context.Background(), hostUserID, eventID, participantUserID, UpsertRatingInput{
		Rating:  4,
		Message: stringPtr("Shows up on time."),
	})

	// then
	if err != nil {
		t.Fatalf("UpsertParticipantRating() error = %v", err)
	}
	expectedParticipant := (3.0*2 + 4.0*5) / 7.0
	expectedHosted := (4.0*10 + 4.0*5) / 15.0
	expectedFinal := 0.6*expectedHosted + 0.4*expectedParticipant
	if repo.lastUserScore.UserID != participantUserID {
		t.Fatalf("expected score refresh for participant %s, got %s", participantUserID, repo.lastUserScore.UserID)
	}
	if repo.lastUserScore.FinalScore == nil || math.Abs(*repo.lastUserScore.FinalScore-expectedFinal) > 0.00001 {
		t.Fatalf("expected final score %.5f, got %v", expectedFinal, repo.lastUserScore.FinalScore)
	}
}

func TestDeleteEventRatingReturnsNotFoundWhenRecordMissing(t *testing.T) {
	// given
	now := time.Date(2026, time.March, 29, 10, 0, 0, 0, time.UTC)
	repo := &fakeRatingRepo{
		eventContext: &EventRatingContext{
			EventID:               uuid.New(),
			HostUserID:            uuid.New(),
			Status:                domain.EventStatusActive,
			StartTime:             now.Add(-2 * time.Hour),
			EndTime:               timePtr(now.Add(-time.Hour)),
			IsApprovedParticipant: true,
		},
		eventDeleteResult: false,
	}
	service := NewService(repo, Settings{GlobalPrior: 4.0, BayesianM: 5})
	service.now = func() time.Time { return now }

	// when
	err := service.DeleteEventRating(context.Background(), uuid.New(), uuid.New())

	// then
	_ = requireAppErrorCode(t, err, domain.ErrorCodeEventRatingNotFound)
}

func TestDeleteParticipantRatingUsesStartTimeWhenEndTimeIsNil(t *testing.T) {
	// given
	now := time.Date(2026, time.March, 29, 10, 0, 0, 0, time.UTC)
	hostUserID := uuid.New()
	participantUserID := uuid.New()
	repo := &fakeRatingRepo{
		participantContext: &ParticipantRatingContext{
			EventID:               uuid.New(),
			HostUserID:            hostUserID,
			ParticipantUserID:     participantUserID,
			Status:                domain.EventStatusActive,
			StartTime:             now.Add(-8 * 24 * time.Hour),
			EndTime:               nil,
			IsRequestingHost:      true,
			IsApprovedParticipant: true,
		},
	}
	service := NewService(repo, Settings{GlobalPrior: 4.0, BayesianM: 5})
	service.now = func() time.Time { return now }

	// when
	err := service.DeleteParticipantRating(context.Background(), hostUserID, uuid.New(), participantUserID)

	// then
	_ = requireAppErrorCode(t, err, domain.ErrorCodeRatingWindowClosed)
}

func requireAppErrorCode(t *testing.T, err error, code string) *domain.AppError {
	t.Helper()

	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T: %v", err, err)
	}
	if appErr.Code != code {
		t.Fatalf("expected error code %q, got %q", code, appErr.Code)
	}

	return appErr
}

func stringPtr(value string) *string { return &value }

func floatPtr(value float64) *float64 { return &value }

func timePtr(value time.Time) *time.Time { return &value }
