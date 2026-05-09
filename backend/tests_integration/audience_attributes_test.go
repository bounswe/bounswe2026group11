//go:build integration

package tests_integration

import (
	"context"
	"testing"
	"time"

	eventapp "github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/tests_integration/common"
	"github.com/google/uuid"
)

func TestAudienceAttributes_CreateAndDetail(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	lat := 41.015
	lon := 29.020
	startTime := time.Now().UTC().Add(24 * time.Hour)

	result, err := harness.Service.CreateEvent(context.Background(), host.ID, eventapp.CreateEventInput{
		Title:         "Child Friendly Event",
		Description:   common.StringPtr("an event for all ages"),
		CategoryID:    &categoryID,
		LocationType:  domain.LocationPoint,
		Address:       common.StringPtr("Bebek, Istanbul"),
		Lat:           &lat,
		Lon:           &lon,
		StartTime:     startTime,
		PrivacyLevel:  domain.PrivacyPublic,
		ChildFriendly: true,
		FamilyOriented: false,
	})
	if err != nil {
		t.Fatalf("CreateEvent() error = %v", err)
	}

	eventID, err := uuid.Parse(result.ID)
	if err != nil {
		t.Fatalf("uuid.Parse() error = %v", err)
	}

	// when
	detail, err := harness.Service.GetEventDetail(context.Background(), host.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}

	// then
	if !detail.ChildFriendly {
		t.Fatalf("expected child_friendly == true, got false")
	}
	if detail.FamilyOriented {
		t.Fatalf("expected family_oriented == false, got true")
	}
}

func TestAudienceAttributes_FilterByChildFriendly(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	viewer := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	lat := 41.020
	lon := 29.021
	startTime := time.Now().UTC().Add(24 * time.Hour)

	cfResult, err := harness.Service.CreateEvent(context.Background(), host.ID, eventapp.CreateEventInput{
		Title:         "Child Friendly Festival",
		Description:   common.StringPtr("kids welcome"),
		CategoryID:    &categoryID,
		LocationType:  domain.LocationPoint,
		Lat:           &lat,
		Lon:           &lon,
		StartTime:     startTime,
		PrivacyLevel:  domain.PrivacyPublic,
		ChildFriendly: true,
	})
	if err != nil {
		t.Fatalf("CreateEvent() child-friendly error = %v", err)
	}

	_, err = harness.Service.CreateEvent(context.Background(), host.ID, eventapp.CreateEventInput{
		Title:        "Adults Only Meetup",
		Description:  common.StringPtr("no children"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          &lat,
		Lon:          &lon,
		StartTime:    startTime.Add(time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	if err != nil {
		t.Fatalf("CreateEvent() non-child-friendly error = %v", err)
	}

	// when
	discoverResult, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat:               &lat,
		Lon:               &lon,
		OnlyChildFriendly: true,
	})
	if err != nil {
		t.Fatalf("DiscoverEvents() error = %v", err)
	}

	// then
	for _, item := range discoverResult.Items {
		if !item.ChildFriendly {
			t.Fatalf("expected all discovered items to have child_friendly == true, got item %q with child_friendly == false", item.Title)
		}
	}

	foundCF := false
	foundNonCF := false
	for _, item := range discoverResult.Items {
		if item.ID == cfResult.ID {
			foundCF = true
		}
		if item.Title == "Adults Only Meetup" {
			foundNonCF = true
		}
	}
	if !foundCF {
		t.Fatalf("expected child-friendly event %q to appear in filtered results", cfResult.ID)
	}
	if foundNonCF {
		t.Fatalf("expected non-child-friendly event 'Adults Only Meetup' to be excluded from filtered results")
	}
}

func TestAudienceAttributes_FilterByFamilyOriented(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	viewer := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	lat := 41.025
	lon := 29.022
	startTime := time.Now().UTC().Add(24 * time.Hour)

	foResult, err := harness.Service.CreateEvent(context.Background(), host.ID, eventapp.CreateEventInput{
		Title:          "Family Picnic",
		Description:    common.StringPtr("bring the whole family"),
		CategoryID:     &categoryID,
		LocationType:   domain.LocationPoint,
		Lat:            &lat,
		Lon:            &lon,
		StartTime:      startTime,
		PrivacyLevel:   domain.PrivacyPublic,
		FamilyOriented: true,
	})
	if err != nil {
		t.Fatalf("CreateEvent() family-oriented error = %v", err)
	}

	_, err = harness.Service.CreateEvent(context.Background(), host.ID, eventapp.CreateEventInput{
		Title:        "Singles Mixer",
		Description:  common.StringPtr("for singles only"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          &lat,
		Lon:          &lon,
		StartTime:    startTime.Add(time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	if err != nil {
		t.Fatalf("CreateEvent() non-family-oriented error = %v", err)
	}

	// when
	discoverResult, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat:                &lat,
		Lon:                &lon,
		OnlyFamilyOriented: true,
	})
	if err != nil {
		t.Fatalf("DiscoverEvents() error = %v", err)
	}

	// then
	for _, item := range discoverResult.Items {
		if !item.FamilyOriented {
			t.Fatalf("expected all discovered items to have family_oriented == true, got item %q with family_oriented == false", item.Title)
		}
	}

	foundFO := false
	foundNonFO := false
	for _, item := range discoverResult.Items {
		if item.ID == foResult.ID {
			foundFO = true
		}
		if item.Title == "Singles Mixer" {
			foundNonFO = true
		}
	}
	if !foundFO {
		t.Fatalf("expected family-oriented event %q to appear in filtered results", foResult.ID)
	}
	if foundNonFO {
		t.Fatalf("expected non-family-oriented event 'Singles Mixer' to be excluded from filtered results")
	}
}

func TestAudienceAttributes_DefaultsFalse(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	lat := 41.030
	lon := 29.023
	startTime := time.Now().UTC().Add(24 * time.Hour)

	result, err := harness.Service.CreateEvent(context.Background(), host.ID, eventapp.CreateEventInput{
		Title:        "Plain Event",
		Description:  common.StringPtr("no audience attributes set"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          &lat,
		Lon:          &lon,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
	})
	if err != nil {
		t.Fatalf("CreateEvent() error = %v", err)
	}

	eventID, err := uuid.Parse(result.ID)
	if err != nil {
		t.Fatalf("uuid.Parse() error = %v", err)
	}

	// when
	detail, err := harness.Service.GetEventDetail(context.Background(), host.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}

	// then
	if detail.ChildFriendly {
		t.Fatalf("expected child_friendly to default to false, got true")
	}
	if detail.FamilyOriented {
		t.Fatalf("expected family_oriented to default to false, got true")
	}
}
