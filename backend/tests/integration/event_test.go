//go:build integration

package integration

import (
	"context"
	"errors"
	"testing"
	"time"

	eventapp "github.com/bounswe/bounswe2026group11/backend/internal/app/event"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/tests/integration/common"
)

func TestCreateEventSuccessPath(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	user := common.GivenUser(t, harness.AuthRepo)

	startTime := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
	endTime := time.Now().UTC().Add(26 * time.Hour).Format(time.RFC3339)
	categoryID := common.GivenEventCategory(t)
	lat := 41.0855
	lon := 29.0444

	input := eventapp.CreateEventInput{
		Title:        "Integration Test Event",
		Description:  common.StringPtr("A test event description"),
		CategoryID:   &categoryID,
		LocationType: string(domain.LocationPoint),
		Address:      common.StringPtr("Bebek, Istanbul"),
		Lat:          &lat,
		Lon:          &lon,
		StartTime:    startTime,
		EndTime:      &endTime,
		PrivacyLevel: string(domain.PrivacyPublic),
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

	startTime := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
	categoryID := common.GivenEventCategory(t)
	lat := 41.0
	lon := 29.0

	result, err := harness.Service.CreateEvent(context.Background(), user.ID, eventapp.CreateEventInput{
		Title:        "Open-ended Event",
		Description:  common.StringPtr("No end time"),
		CategoryID:   &categoryID,
		LocationType: string(domain.LocationPoint),
		Lat:          &lat,
		Lon:          &lon,
		StartTime:    startTime,
		EndTime:      nil,
		PrivacyLevel: string(domain.PrivacyPublic),
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
		LocationType: string(domain.LocationPoint),
		Lat:          common.Float64Ptr(0),
		Lon:          common.Float64Ptr(0),
		StartTime:    time.Now().UTC().Add(time.Hour).Format(time.RFC3339),
		PrivacyLevel: string(domain.PrivacyPublic),
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
		LocationType: string(domain.LocationPoint),
		Lat:          common.Float64Ptr(0),
		Lon:          common.Float64Ptr(0),
		StartTime:    time.Now().UTC().Add(time.Hour).Format(time.RFC3339),
		PrivacyLevel: string(domain.PrivacyPublic),
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
		LocationType: string(domain.LocationPoint),
		Lat:          common.Float64Ptr(0),
		Lon:          common.Float64Ptr(0),
		StartTime:    time.Now().UTC().Add(time.Hour).Format(time.RFC3339),
		PrivacyLevel: "secret",
	})

	common.RequireAppErrorCode(t, err, domain.ErrorCodeValidation)
}

func TestCreateEventValidationEndTimeBeforeStartTime(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	user := common.GivenUser(t, harness.AuthRepo)

	startTime := time.Now().UTC().Add(2 * time.Hour).Format(time.RFC3339)
	endTime := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	categoryID := common.GivenEventCategory(t)

	_, err := harness.Service.CreateEvent(context.Background(), user.ID, eventapp.CreateEventInput{
		Title:        "Bad Time",
		Description:  common.StringPtr("Bad time"),
		CategoryID:   &categoryID,
		LocationType: string(domain.LocationPoint),
		Lat:          common.Float64Ptr(0),
		Lon:          common.Float64Ptr(0),
		StartTime:    startTime,
		EndTime:      &endTime,
		PrivacyLevel: string(domain.PrivacyPublic),
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
	startTime := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
	lat := 41.0
	lon := 29.0

	input := eventapp.CreateEventInput{
		Title:        "Host Unique Event",
		Description:  common.StringPtr("First copy"),
		CategoryID:   &categoryID,
		LocationType: string(domain.LocationPoint),
		Lat:          &lat,
		Lon:          &lon,
		StartTime:    startTime,
		PrivacyLevel: string(domain.PrivacyPublic),
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
	startTime := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
	lat := 41.0
	lon := 29.0

	input := eventapp.CreateEventInput{
		Title:        "Shared Title Across Hosts",
		Description:  common.StringPtr("Allowed for another host"),
		CategoryID:   &categoryID,
		LocationType: string(domain.LocationPoint),
		Lat:          &lat,
		Lon:          &lon,
		StartTime:    startTime,
		PrivacyLevel: string(domain.PrivacyPublic),
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

	startTime := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
	categoryID := common.GivenEventCategory(t)

	input := eventapp.CreateEventInput{
		Title:        "Bosporus Ride",
		Description:  common.StringPtr("Route-based cycling event"),
		CategoryID:   &categoryID,
		LocationType: string(domain.LocationRoute),
		StartTime:    startTime,
		PrivacyLevel: string(domain.PrivacyProtected),
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
