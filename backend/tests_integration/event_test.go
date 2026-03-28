//go:build integration

package tests_integration

import (
	"context"
	"errors"
	"testing"
	"time"

	eventapp "github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/tests_integration/common"
	"github.com/google/uuid"
)

func TestCreateEventSuccessPath(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	user := common.GivenUser(t, harness.AuthRepo)

	startTime := time.Now().UTC().Add(24 * time.Hour)
	endTime := time.Now().UTC().Add(26 * time.Hour)
	categoryID := common.GivenEventCategory(t)
	lat := 41.0855
	lon := 29.0444

	input := eventapp.CreateEventInput{
		Title:        "Integration Test Event",
		Description:  common.StringPtr("A test event description"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Address:      common.StringPtr("Bebek, Istanbul"),
		Lat:          &lat,
		Lon:          &lon,
		StartTime:    startTime,
		EndTime:      &endTime,
		PrivacyLevel: domain.PrivacyPublic,
		Capacity:     common.IntPtr(100),
		Tags:         []string{"hiking", "outdoor"},
		Constraints: []eventapp.ConstraintInput{
			{Type: "equipment", Info: "Bring hiking boots"},
		},
	}

	// when
	result, err := harness.Service.CreateEvent(context.Background(), user.ID, input)

	// then
	if err != nil {
		t.Fatalf("CreateEvent() error = %v", err)
	}
	if result.ID == "" {
		t.Fatal("expected non-empty event ID")
	}
	if result.Title != input.Title {
		t.Fatalf("expected title %q, got %q", input.Title, result.Title)
	}
	if result.PrivacyLevel != string(domain.PrivacyPublic) {
		t.Fatalf("expected privacy_level %q, got %q", domain.PrivacyPublic, result.PrivacyLevel)
	}
	if result.Status != string(domain.EventStatusActive) {
		t.Fatalf("expected status %q, got %q", domain.EventStatusActive, result.Status)
	}
	if result.EndTime == nil {
		t.Fatal("expected non-nil end_time")
	}
}

func TestCreateEventWithoutEndTime(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	user := common.GivenUser(t, harness.AuthRepo)

	startTime := time.Now().UTC().Add(24 * time.Hour)
	categoryID := common.GivenEventCategory(t)
	lat := 41.0
	lon := 29.0

	result, err := harness.Service.CreateEvent(context.Background(), user.ID, eventapp.CreateEventInput{
		Title:        "Open-ended Event",
		Description:  common.StringPtr("No end time"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          &lat,
		Lon:          &lon,
		StartTime:    startTime,
		EndTime:      nil,
		PrivacyLevel: domain.PrivacyPublic,
	})

	if err != nil {
		t.Fatalf("CreateEvent() error = %v", err)
	}
	if result.EndTime != nil {
		t.Fatalf("expected nil end_time, got %v", result.EndTime)
	}
}

func TestCreateEventValidationEmptyTitle(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	user := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)

	_, err := harness.Service.CreateEvent(context.Background(), user.ID, eventapp.CreateEventInput{
		Title:        "",
		Description:  common.StringPtr("Missing title"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          common.Float64Ptr(0),
		Lon:          common.Float64Ptr(0),
		StartTime:    time.Now().UTC().Add(time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})

	common.RequireAppErrorCode(t, err, domain.ErrorCodeValidation)

	var appErr *domain.AppError
	errors.As(err, &appErr)
	if appErr.Details["title"] == "" {
		t.Fatal("expected validation detail for 'title'")
	}
}

func TestCreateEventValidationTooManyTags(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	user := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)

	_, err := harness.Service.CreateEvent(context.Background(), user.ID, eventapp.CreateEventInput{
		Title:        "Too Many Tags",
		Description:  common.StringPtr("Tag overflow"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          common.Float64Ptr(0),
		Lon:          common.Float64Ptr(0),
		StartTime:    time.Now().UTC().Add(time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
		Tags:         []string{"a", "b", "c", "d", "e", "f"},
	})

	common.RequireAppErrorCode(t, err, domain.ErrorCodeValidation)

	var appErr *domain.AppError
	errors.As(err, &appErr)
	if appErr.Details["tags"] == "" {
		t.Fatal("expected validation detail for 'tags'")
	}
}

func TestCreateEventValidationInvalidPrivacyLevel(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	user := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)

	_, err := harness.Service.CreateEvent(context.Background(), user.ID, eventapp.CreateEventInput{
		Title:        "Bad Privacy",
		Description:  common.StringPtr("Bad privacy"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          common.Float64Ptr(0),
		Lon:          common.Float64Ptr(0),
		StartTime:    time.Now().UTC().Add(time.Hour),
		PrivacyLevel: domain.EventPrivacyLevel("secret"),
	})

	common.RequireAppErrorCode(t, err, domain.ErrorCodeValidation)
}

func TestCreateEventValidationEndTimeBeforeStartTime(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	user := common.GivenUser(t, harness.AuthRepo)

	startTime := time.Now().UTC().Add(2 * time.Hour)
	endTime := time.Now().UTC().Add(time.Hour)
	categoryID := common.GivenEventCategory(t)

	_, err := harness.Service.CreateEvent(context.Background(), user.ID, eventapp.CreateEventInput{
		Title:        "Bad Time",
		Description:  common.StringPtr("Bad time"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          common.Float64Ptr(0),
		Lon:          common.Float64Ptr(0),
		StartTime:    startTime,
		EndTime:      &endTime,
		PrivacyLevel: domain.PrivacyPublic,
	})

	common.RequireAppErrorCode(t, err, domain.ErrorCodeValidation)

	var appErr *domain.AppError
	errors.As(err, &appErr)
	if appErr.Details["end_time"] == "" {
		t.Fatal("expected validation detail for 'end_time'")
	}
}

func TestCreateEventRejectsDuplicateTitleForSameHost(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	user := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	startTime := time.Now().UTC().Add(24 * time.Hour)
	lat := 41.0
	lon := 29.0

	input := eventapp.CreateEventInput{
		Title:        "Host Unique Event",
		Description:  common.StringPtr("First copy"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          &lat,
		Lon:          &lon,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
	}

	_, err := harness.Service.CreateEvent(context.Background(), user.ID, input)
	if err != nil {
		t.Fatalf("CreateEvent() first call error = %v", err)
	}

	// when
	_, err = harness.Service.CreateEvent(context.Background(), user.ID, input)

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeEventTitleExists)
}

func TestCreateEventAllowsSameTitleForDifferentHosts(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	firstUser := common.GivenUser(t, harness.AuthRepo)
	secondUser := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	startTime := time.Now().UTC().Add(24 * time.Hour)
	lat := 41.0
	lon := 29.0

	input := eventapp.CreateEventInput{
		Title:        "Shared Title Across Hosts",
		Description:  common.StringPtr("Allowed for another host"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          &lat,
		Lon:          &lon,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
	}

	_, err := harness.Service.CreateEvent(context.Background(), firstUser.ID, input)
	if err != nil {
		t.Fatalf("CreateEvent() first host error = %v", err)
	}

	// when
	result, err := harness.Service.CreateEvent(context.Background(), secondUser.ID, input)

	// then
	if err != nil {
		t.Fatalf("CreateEvent() second host error = %v", err)
	}
	if result.ID == "" {
		t.Fatal("expected non-empty event ID")
	}
}

func TestCreateRouteEventSuccessPath(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	user := common.GivenUser(t, harness.AuthRepo)

	startTime := time.Now().UTC().Add(24 * time.Hour)
	categoryID := common.GivenEventCategory(t)

	input := eventapp.CreateEventInput{
		Title:        "Bosporus Ride",
		Description:  common.StringPtr("Route-based cycling event"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationRoute,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyProtected,
		RoutePoints: []eventapp.RoutePointInput{
			{Lat: common.Float64Ptr(41.0400), Lon: common.Float64Ptr(29.0000)},
			{Lat: common.Float64Ptr(41.0500), Lon: common.Float64Ptr(29.0200)},
			{Lat: common.Float64Ptr(41.0600), Lon: common.Float64Ptr(29.0400)},
		},
	}

	// when
	result, err := harness.Service.CreateEvent(context.Background(), user.ID, input)

	// then
	if err != nil {
		t.Fatalf("CreateEvent() error = %v", err)
	}
	if result.ID == "" {
		t.Fatal("expected non-empty event ID")
	}
	if result.PrivacyLevel != string(domain.PrivacyProtected) {
		t.Fatalf("expected privacy_level %q, got %q", domain.PrivacyProtected, result.PrivacyLevel)
	}
}

// ---------------------------------------------------------
// JoinEvent tests
// ---------------------------------------------------------

func TestJoinEventSuccessPath(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	joiner := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenPublicEvent(t, harness.Service, host.ID)

	// when
	result, err := harness.Service.JoinEvent(context.Background(), joiner.ID, event.ID)

	// then
	if err != nil {
		t.Fatalf("JoinEvent() error = %v", err)
	}
	if result.ParticipationID == "" {
		t.Fatal("expected non-empty participation_id")
	}
	if result.Status != domain.ParticipationStatusApproved {
		t.Fatalf("expected status %q, got %q", domain.ParticipationStatusApproved, result.Status)
	}
	if result.EventID != event.ID.String() {
		t.Fatalf("expected event_id %q, got %q", event.ID, result.EventID)
	}
}

func TestJoinEventRejectsDuplicate(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	joiner := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenPublicEvent(t, harness.Service, host.ID)

	_, err := harness.Service.JoinEvent(context.Background(), joiner.ID, event.ID)
	if err != nil {
		t.Fatalf("JoinEvent() first call error = %v", err)
	}

	// when - second join attempt
	_, err = harness.Service.JoinEvent(context.Background(), joiner.ID, event.ID)

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeAlreadyParticipating)
}

func TestJoinEventRejectsHostJoiningOwnEvent(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenPublicEvent(t, harness.Service, host.ID)

	// when
	_, err := harness.Service.JoinEvent(context.Background(), host.ID, event.ID)

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeHostCannotJoin)
}

func TestJoinEventRejectsProtectedEvent(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	joiner := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenProtectedEvent(t, harness.Service, host.ID)

	// when
	_, err := harness.Service.JoinEvent(context.Background(), joiner.ID, event.ID)

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeEventJoinNotAllowed)
}

func TestJoinEventRejectsNonExistentEvent(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	joiner := common.GivenUser(t, harness.AuthRepo)

	_, err := harness.Service.JoinEvent(context.Background(), joiner.ID, uuid.New())

	common.RequireAppErrorCode(t, err, domain.ErrorCodeEventNotFound)
}

// ---------------------------------------------------------
// RequestJoin tests
// ---------------------------------------------------------

func TestRequestJoinSuccessPath(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	requester := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenProtectedEvent(t, harness.Service, host.ID)
	message := "I have joined similar events before."

	// when
	result, err := harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{
		Message: &message,
	})

	// then
	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}
	if result.JoinRequestID == "" {
		t.Fatal("expected non-empty join_request_id")
	}
	if result.Status != domain.ParticipationStatusPending {
		t.Fatalf("expected status %q, got %q", domain.ParticipationStatusPending, result.Status)
	}
	if result.EventID != event.ID.String() {
		t.Fatalf("expected event_id %q, got %q", event.ID, result.EventID)
	}

	var storedMessage *string
	err = common.RequirePool(t).QueryRow(
		context.Background(),
		`SELECT message FROM join_request WHERE id = $1`,
		result.JoinRequestID,
	).Scan(&storedMessage)
	if err != nil {
		t.Fatalf("select join_request message error = %v", err)
	}
	if storedMessage == nil || *storedMessage != message {
		t.Fatalf("expected stored message %q, got %v", message, storedMessage)
	}
}

func TestRequestJoinRejectsDuplicate(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	requester := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenProtectedEvent(t, harness.Service, host.ID)

	_, err := harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{})
	if err != nil {
		t.Fatalf("RequestJoin() first call error = %v", err)
	}

	// when - second request attempt
	_, err = harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{})

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeAlreadyRequested)
}

func TestRequestJoinRejectsHostRequestingOwnEvent(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenProtectedEvent(t, harness.Service, host.ID)

	// when
	_, err := harness.Service.RequestJoin(context.Background(), host.ID, event.ID, eventapp.RequestJoinInput{})

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeHostCannotJoin)
}

func TestRequestJoinRejectsPublicEvent(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	requester := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenPublicEvent(t, harness.Service, host.ID)

	// when
	_, err := harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{})

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeEventJoinNotAllowed)
}

func TestRequestJoinRejectsNonExistentEvent(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	requester := common.GivenUser(t, harness.AuthRepo)

	_, err := harness.Service.RequestJoin(context.Background(), requester.ID, uuid.New(), eventapp.RequestJoinInput{})

	common.RequireAppErrorCode(t, err, domain.ErrorCodeEventNotFound)
}
