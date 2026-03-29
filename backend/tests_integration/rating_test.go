//go:build integration

package tests_integration

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"

	eventapp "github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	ratingapp "github.com/bounswe/bounswe2026group11/backend/internal/application/rating"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/tests_integration/common"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func TestEventRatingUpdatesHostScoreAndEventReadModels(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("rated_host"))
	participant := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("rated_participant"))
	startTime := time.Now().UTC().Add(-2 * time.Hour)
	lat := 41.015
	lon := 29.02
	eventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Recently Finished Event",
		Description:  "still inside rating window",
		CategoryID:   common.GivenEventCategory(t),
		Lat:          lat,
		Lon:          lon,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
	})
	insertParticipation(t, eventID, participant.ID, domain.ParticipationStatusApproved)
	initialMessage := "Excellent hosting."
	updatedMessage := "Solid overall host."

	// when
	_, err := harness.RatingService.UpsertEventRating(context.Background(), participant.ID, eventID, ratingapp.UpsertRatingInput{
		Rating:  5,
		Message: &initialMessage,
	})
	if err != nil {
		t.Fatalf("UpsertEventRating() create error = %v", err)
	}

	detailAfterCreate, err := harness.Service.GetEventDetail(context.Background(), participant.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() after create error = %v", err)
	}

	discoveryAfterCreate, err := harness.Service.DiscoverEvents(context.Background(), participant.ID, eventapp.DiscoverEventsInput{
		Lat: &lat,
		Lon: &lon,
	})
	if err != nil {
		t.Fatalf("DiscoverEvents() after create error = %v", err)
	}

	_, err = harness.RatingService.UpsertEventRating(context.Background(), participant.ID, eventID, ratingapp.UpsertRatingInput{
		Rating:  3,
		Message: &updatedMessage,
	})
	if err != nil {
		t.Fatalf("UpsertEventRating() update error = %v", err)
	}

	detailAfterUpdate, err := harness.Service.GetEventDetail(context.Background(), participant.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() after update error = %v", err)
	}

	if err := harness.RatingService.DeleteEventRating(context.Background(), participant.ID, eventID); err != nil {
		t.Fatalf("DeleteEventRating() error = %v", err)
	}

	detailAfterDelete, err := harness.Service.GetEventDetail(context.Background(), participant.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() after delete error = %v", err)
	}

	// then
	expectedCreatedScore := (5.0*1 + 4.0*5) / 6.0
	if detailAfterCreate.ViewerEventRating == nil || detailAfterCreate.ViewerEventRating.Rating != 5 {
		t.Fatalf("expected viewer_event_rating after create, got %+v", detailAfterCreate.ViewerEventRating)
	}
	requireApproxFloat(t, detailAfterCreate.HostScore.FinalScore, expectedCreatedScore)
	if detailAfterCreate.HostScore.HostedEventRatingCount != 1 {
		t.Fatalf("expected host rating count 1 after create, got %d", detailAfterCreate.HostScore.HostedEventRatingCount)
	}
	if !detailAfterCreate.RatingWindow.IsActive {
		t.Fatal("expected rating window to be active")
	}

	discovered := findDiscoveredEvent(discoveryAfterCreate.Items, eventID)
	if discovered == nil {
		t.Fatalf("expected discovery result to contain event %s", eventID)
	}
	requireApproxFloat(t, discovered.HostScore.FinalScore, expectedCreatedScore)
	if discovered.HostScore.HostedEventRatingCount != 1 {
		t.Fatalf("expected discovery host rating count 1, got %d", discovered.HostScore.HostedEventRatingCount)
	}

	expectedUpdatedScore := (3.0*1 + 4.0*5) / 6.0
	if detailAfterUpdate.ViewerEventRating == nil || detailAfterUpdate.ViewerEventRating.Rating != 3 {
		t.Fatalf("expected viewer_event_rating after update, got %+v", detailAfterUpdate.ViewerEventRating)
	}
	requireApproxFloat(t, detailAfterUpdate.HostScore.FinalScore, expectedUpdatedScore)

	if detailAfterDelete.ViewerEventRating != nil {
		t.Fatalf("expected viewer_event_rating to be nil after delete, got %+v", detailAfterDelete.ViewerEventRating)
	}
	if detailAfterDelete.HostScore.FinalScore != nil {
		t.Fatalf("expected host final score nil after delete, got %v", detailAfterDelete.HostScore.FinalScore)
	}
	if detailAfterDelete.HostScore.HostedEventRatingCount != 0 {
		t.Fatalf("expected host rating count 0 after delete, got %d", detailAfterDelete.HostScore.HostedEventRatingCount)
	}
}

func TestHostCannotRateOwnEvent(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("self_rating_host"))
	eventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Host Self Rating Event",
		Description:  "host should be blocked with the dedicated error",
		CategoryID:   common.GivenEventCategory(t),
		Lat:          41.02,
		Lon:          29.03,
		StartTime:    time.Now().UTC().Add(-2 * time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})

	// when
	_, err := harness.RatingService.UpsertEventRating(context.Background(), host.ID, eventID, ratingapp.UpsertRatingInput{
		Rating:  5,
		Message: common.StringPtr("I hosted this perfectly."),
	})

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeHostCannotRateSelf)
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T: %v", err, err)
	}
	if appErr.Message != "The event host cannot rate their own event." {
		t.Fatalf("expected host self-rating message, got %q", appErr.Message)
	}
}

func TestParticipantRatingUpdatesParticipantScoreAndHostContext(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("participant_rating_host"))
	participant := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("participant_rating_target"))
	eventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Participant Rated Event",
		Description:  "host can rate approved users",
		CategoryID:   common.GivenEventCategory(t),
		Lat:          41.05,
		Lon:          29.05,
		StartTime:    time.Now().UTC().Add(-2 * time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	insertParticipation(t, eventID, participant.ID, domain.ParticipationStatusApproved)
	initialMessage := "Always communicative."
	updatedMessage := "Could improve punctuality."

	// when
	_, err := harness.RatingService.UpsertParticipantRating(context.Background(), host.ID, eventID, participant.ID, ratingapp.UpsertRatingInput{
		Rating:  5,
		Message: &initialMessage,
	})
	if err != nil {
		t.Fatalf("UpsertParticipantRating() create error = %v", err)
	}

	detailAfterCreate, err := harness.Service.GetEventDetail(context.Background(), host.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() after create error = %v", err)
	}
	scoreAfterCreate := queryUserScore(t, participant.ID)

	_, err = harness.RatingService.UpsertParticipantRating(context.Background(), host.ID, eventID, participant.ID, ratingapp.UpsertRatingInput{
		Rating:  2,
		Message: &updatedMessage,
	})
	if err != nil {
		t.Fatalf("UpsertParticipantRating() update error = %v", err)
	}

	detailAfterUpdate, err := harness.Service.GetEventDetail(context.Background(), host.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() after update error = %v", err)
	}
	scoreAfterUpdate := queryUserScore(t, participant.ID)

	if err := harness.RatingService.DeleteParticipantRating(context.Background(), host.ID, eventID, participant.ID); err != nil {
		t.Fatalf("DeleteParticipantRating() error = %v", err)
	}

	detailAfterDelete, err := harness.Service.GetEventDetail(context.Background(), host.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() after delete error = %v", err)
	}
	scoreAfterDelete := queryUserScore(t, participant.ID)

	// then
	requireParticipantHostRating(t, detailAfterCreate, participant.ID, 5)
	requireParticipantUserScoreSummary(t, detailAfterCreate, participant.ID, (5.0*1+4.0*5)/6.0, 1)
	if scoreAfterCreate.ParticipantRatingCount != 1 {
		t.Fatalf("expected participant rating count 1 after create, got %d", scoreAfterCreate.ParticipantRatingCount)
	}
	requireApproxFloat(t, scoreAfterCreate.ParticipantScore, 5.0)
	requireApproxFloat(t, scoreAfterCreate.FinalScore, (5.0*1+4.0*5)/6.0)

	requireParticipantHostRating(t, detailAfterUpdate, participant.ID, 2)
	requireParticipantUserScoreSummary(t, detailAfterUpdate, participant.ID, (2.0*1+4.0*5)/6.0, 1)
	requireApproxFloat(t, scoreAfterUpdate.ParticipantScore, 2.0)
	requireApproxFloat(t, scoreAfterUpdate.FinalScore, (2.0*1+4.0*5)/6.0)

	requireParticipantHostRatingNil(t, detailAfterDelete, participant.ID)
	requireParticipantUserScoreSummaryNil(t, detailAfterDelete, participant.ID)
	if scoreAfterDelete.ParticipantRatingCount != 0 {
		t.Fatalf("expected participant rating count 0 after delete, got %d", scoreAfterDelete.ParticipantRatingCount)
	}
	if scoreAfterDelete.ParticipantScore != nil {
		t.Fatalf("expected participant score nil after delete, got %v", scoreAfterDelete.ParticipantScore)
	}
	if scoreAfterDelete.FinalScore != nil {
		t.Fatalf("expected final score nil after delete, got %v", scoreAfterDelete.FinalScore)
	}
}

func queryUserScore(t *testing.T, userID uuid.UUID) *domain.UserScore {
	t.Helper()

	var (
		record           domain.UserScore
		participantScore pgtype.Float8
		hostedEventScore pgtype.Float8
		finalScore       pgtype.Float8
	)

	err := common.RequirePool(t).QueryRow(
		context.Background(),
		`SELECT user_id, participant_score, participant_rating_count, hosted_event_score, hosted_event_rating_count, final_score, created_at, updated_at
		 FROM user_score
		 WHERE user_id = $1`,
		userID,
	).Scan(
		&record.UserID,
		&participantScore,
		&record.ParticipantRatingCount,
		&hostedEventScore,
		&record.HostedEventRatingCount,
		&finalScore,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		t.Fatalf("query user_score error = %v", err)
	}

	if participantScore.Valid {
		record.ParticipantScore = &participantScore.Float64
	}
	if hostedEventScore.Valid {
		record.HostedEventScore = &hostedEventScore.Float64
	}
	if finalScore.Valid {
		record.FinalScore = &finalScore.Float64
	}

	return &record
}

func findDiscoveredEvent(items []eventapp.DiscoverableEventItem, eventID uuid.UUID) *eventapp.DiscoverableEventItem {
	for i := range items {
		if items[i].ID == eventID.String() {
			return &items[i]
		}
	}

	return nil
}

func requireParticipantUserScoreSummary(
	t *testing.T,
	detail *eventapp.GetEventDetailResult,
	participantUserID uuid.UUID,
	expectedFinalScore float64,
	expectedRatingCount int,
) {
	t.Helper()

	participant := requireApprovedParticipant(t, detail, participantUserID)
	requireApproxFloat(t, participant.User.FinalScore, expectedFinalScore)
	if participant.User.RatingCount != expectedRatingCount {
		t.Fatalf("expected participant rating_count %d, got %d", expectedRatingCount, participant.User.RatingCount)
	}
}

func requireParticipantUserScoreSummaryNil(t *testing.T, detail *eventapp.GetEventDetailResult, participantUserID uuid.UUID) {
	t.Helper()

	participant := requireApprovedParticipant(t, detail, participantUserID)
	if participant.User.FinalScore != nil {
		t.Fatalf("expected nil participant final_score, got %v", participant.User.FinalScore)
	}
	if participant.User.RatingCount != 0 {
		t.Fatalf("expected participant rating_count 0, got %d", participant.User.RatingCount)
	}
}

func requireParticipantHostRating(t *testing.T, detail *eventapp.GetEventDetailResult, participantUserID uuid.UUID, expectedRating int) {
	t.Helper()

	participant := requireApprovedParticipant(t, detail, participantUserID)
	if participant.HostRating == nil {
		t.Fatalf("expected host_rating for participant %s", participantUserID)
	}
	if participant.HostRating.Rating != expectedRating {
		t.Fatalf("expected host_rating %d, got %d", expectedRating, participant.HostRating.Rating)
	}
}

func requireParticipantHostRatingNil(t *testing.T, detail *eventapp.GetEventDetailResult, participantUserID uuid.UUID) {
	t.Helper()

	participant := requireApprovedParticipant(t, detail, participantUserID)
	if participant.HostRating != nil {
		t.Fatalf("expected nil host_rating for participant %s, got %+v", participantUserID, participant.HostRating)
	}
}

func requireApprovedParticipant(
	t *testing.T,
	detail *eventapp.GetEventDetailResult,
	participantUserID uuid.UUID,
) eventapp.EventDetailApprovedParticipant {
	t.Helper()

	if detail.HostContext == nil {
		t.Fatal("expected host_context")
	}

	for _, participant := range detail.HostContext.ApprovedParticipants {
		if participant.User.ID == participantUserID.String() {
			return participant
		}
	}

	t.Fatalf("expected participant %s in approved list", participantUserID)
	return eventapp.EventDetailApprovedParticipant{}
}

func requireApproxFloat(t *testing.T, actual *float64, expected float64) {
	t.Helper()

	if actual == nil {
		t.Fatalf("expected %.6f, got nil", expected)
	}
	if math.Abs(*actual-expected) > 0.00001 {
		t.Fatalf("expected %.6f, got %.6f", expected, *actual)
	}
}
