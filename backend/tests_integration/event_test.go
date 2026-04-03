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

func TestCreateEventPersistsInternalHostParticipationWithoutChangingVisibleCounts(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("internal_host"))
	startTime := time.Now().UTC().Add(24 * time.Hour)
	categoryID := common.GivenEventCategory(t)
	lat := 41.11
	lon := 29.11

	// when
	result, err := harness.Service.CreateEvent(context.Background(), host.ID, eventapp.CreateEventInput{
		Title:        "Internal Host Participation Event",
		Description:  common.StringPtr("host should get an internal membership row"),
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

	var participationStatus string
	if err := common.RequirePool(t).QueryRow(
		context.Background(),
		`SELECT status
		 FROM participation
		 WHERE event_id = $1
		   AND user_id = $2`,
		eventID,
		host.ID,
	).Scan(&participationStatus); err != nil {
		t.Fatalf("load host participation error = %v", err)
	}

	detail, err := harness.Service.GetEventDetail(context.Background(), host.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}

	// then
	if participationStatus != string(domain.ParticipationStatusApproved) {
		t.Fatalf("expected host participation status %q, got %q", domain.ParticipationStatusApproved, participationStatus)
	}
	if detail.ApprovedParticipantCount != 0 {
		t.Fatalf("expected visible approved_participant_count 0, got %d", detail.ApprovedParticipantCount)
	}
	if detail.ViewerContext.ParticipationStatus != string(domain.EventDetailParticipationStatusNone) {
		t.Fatalf("expected host participation_status %q, got %q", domain.EventDetailParticipationStatusNone, detail.ViewerContext.ParticipationStatus)
	}
	if detail.HostContext == nil {
		t.Fatal("expected host_context for host viewer")
	}
	if len(detail.HostContext.ApprovedParticipants) != 0 {
		t.Fatalf("expected host_context approved participants to exclude host, got %d entries", len(detail.HostContext.ApprovedParticipants))
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

func TestDiscoverEventsReturnsOnlyNearbyActivePublicAndProtectedEvents(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	viewer := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	originLat := 39.9208
	originLon := 32.8541
	baseStart := time.Now().UTC().Add(24 * time.Hour)

	nearPublic := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Near Public",
		Description:  "close by",
		CategoryID:   categoryID,
		Lat:          39.9212,
		Lon:          32.8548,
		StartTime:    baseStart,
		PrivacyLevel: domain.PrivacyPublic,
	})
	nearProtected := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Near Protected",
		Description:  "also close by",
		CategoryID:   categoryID,
		Lat:          39.9240,
		Lon:          32.8580,
		StartTime:    baseStart.Add(time.Hour),
		PrivacyLevel: domain.PrivacyProtected,
	})
	_ = createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Far Public",
		Description:  "too far away",
		CategoryID:   categoryID,
		Lat:          40.0400,
		Lon:          32.9800,
		StartTime:    baseStart.Add(2 * time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	_ = createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Near Private",
		Description:  "should stay hidden",
		CategoryID:   categoryID,
		Lat:          39.9215,
		Lon:          32.8552,
		StartTime:    baseStart.Add(3 * time.Hour),
		PrivacyLevel: domain.PrivacyPrivate,
	})
	inactiveID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Near Inactive",
		Description:  "should be excluded",
		CategoryID:   categoryID,
		Lat:          39.9220,
		Lon:          32.8558,
		StartTime:    baseStart.Add(4 * time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	updateEventStatus(t, inactiveID, "ARCHIVED")

	// when
	result, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat: &originLat,
		Lon: &originLon,
	})

	// then
	if err != nil {
		t.Fatalf("DiscoverEvents() error = %v", err)
	}
	assertDiscoverEventIDsInOrder(t, result.Items, nearPublic, nearProtected)
}

func TestDiscoverEventsIncludesRouteWhenAnyRoutePointFallsWithinRadius(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	viewer := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	originLat := 35.1856
	originLon := 33.3823
	startTime := time.Now().UTC().Add(24 * time.Hour)

	routeID := createRouteDiscoveryEvent(t, harness, routeDiscoveryEventSeed{
		HostID:       host.ID,
		Title:        "Route Event",
		Description:  "passes near the viewer",
		CategoryID:   categoryID,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyProtected,
		RoutePoints: []eventapp.RoutePointInput{
			{Lat: common.Float64Ptr(35.3000), Lon: common.Float64Ptr(33.5000)},
			{Lat: common.Float64Ptr(35.1860), Lon: common.Float64Ptr(33.3830)},
			{Lat: common.Float64Ptr(35.1700), Lon: common.Float64Ptr(33.3600)},
		},
	})

	// when
	result, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat: &originLat,
		Lon: &originLon,
	})

	// then
	if err != nil {
		t.Fatalf("DiscoverEvents() error = %v", err)
	}
	assertDiscoverEventIDsInOrder(t, result.Items, routeID)
}

func TestDiscoverEventsSortsRouteByFirstPointWhenUsingDistance(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	viewer := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	originLat := 34.6793
	originLon := 33.0413
	startTime := time.Now().UTC().Add(24 * time.Hour)
	sortBy := domain.EventDiscoverySortDistance

	pointID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Point Event",
		Description:  "nearby point",
		CategoryID:   categoryID,
		Lat:          34.6850,
		Lon:          33.0450,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
	})
	routeID := createRouteDiscoveryEvent(t, harness, routeDiscoveryEventSeed{
		HostID:       host.ID,
		Title:        "Route Event",
		Description:  "first point is farther away",
		CategoryID:   categoryID,
		StartTime:    startTime.Add(time.Hour),
		PrivacyLevel: domain.PrivacyProtected,
		RoutePoints: []eventapp.RoutePointInput{
			{Lat: common.Float64Ptr(34.7000), Lon: common.Float64Ptr(33.0700)},
			{Lat: common.Float64Ptr(34.6795), Lon: common.Float64Ptr(33.0415)},
			{Lat: common.Float64Ptr(34.6780), Lon: common.Float64Ptr(33.0400)},
		},
	})

	// when
	result, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat:    &originLat,
		Lon:    &originLon,
		SortBy: &sortBy,
	})

	// then
	if err != nil {
		t.Fatalf("DiscoverEvents() error = %v", err)
	}
	assertDiscoverEventIDsInOrder(t, result.Items, pointID, routeID)
}

func TestDiscoverEventsSearchMatchesTitleDescriptionAndTags(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	viewer := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	originLat := 38.4237
	originLon := 27.1428
	startTime := time.Now().UTC().Add(24 * time.Hour)

	titleID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Istanbul Run",
		Description:  "group cardio",
		CategoryID:   categoryID,
		Lat:          38.4242,
		Lon:          27.1432,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
	})
	descriptionID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Board Game Night",
		Description:  "casual tabletop session",
		CategoryID:   categoryID,
		Lat:          38.4248,
		Lon:          27.1438,
		StartTime:    startTime.Add(time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	tagID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Morning Stretch",
		Description:  "easy pace",
		CategoryID:   categoryID,
		Lat:          38.4254,
		Lon:          27.1444,
		StartTime:    startTime.Add(2 * time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
		Tags:         []string{"yoga"},
	})

	// when
	titleQuery := "ist"
	titleResult, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat:   &originLat,
		Lon:   &originLon,
		Query: &titleQuery,
	})
	if err != nil {
		t.Fatalf("DiscoverEvents() title query error = %v", err)
	}

	descriptionQuery := "tabl"
	descriptionResult, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat:   &originLat,
		Lon:   &originLon,
		Query: &descriptionQuery,
	})
	if err != nil {
		t.Fatalf("DiscoverEvents() description query error = %v", err)
	}

	tagQuery := "yog"
	tagResult, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat:   &originLat,
		Lon:   &originLon,
		Query: &tagQuery,
	})

	// then
	if err != nil {
		t.Fatalf("DiscoverEvents() tag query error = %v", err)
	}
	assertDiscoverEventIDsInOrder(t, titleResult.Items, titleID)
	assertDiscoverEventIDsInOrder(t, descriptionResult.Items, descriptionID)
	assertDiscoverEventIDsInOrder(t, tagResult.Items, tagID)
}

func TestDiscoverEventsAppliesPrivacyLevelFilter(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	viewer := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	originLat := 35.8989
	originLon := 14.5146
	startTime := time.Now().UTC().Add(24 * time.Hour)

	publicID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Public Event",
		Description:  "visible to everyone",
		CategoryID:   categoryID,
		Lat:          35.8992,
		Lon:          14.5150,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
	})
	_ = createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Protected Event",
		Description:  "needs approval",
		CategoryID:   categoryID,
		Lat:          35.8994,
		Lon:          14.5152,
		StartTime:    startTime.Add(time.Hour),
		PrivacyLevel: domain.PrivacyProtected,
	})

	// when
	result, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat:           &originLat,
		Lon:           &originLon,
		PrivacyLevels: []domain.EventPrivacyLevel{domain.PrivacyPublic},
	})

	// then
	if err != nil {
		t.Fatalf("DiscoverEvents() error = %v", err)
	}
	assertDiscoverEventIDsInOrder(t, result.Items, publicID)
}

func TestDiscoverEventsAppliesSearchAndFiltersTogether(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	viewer := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo)
	originLat := 36.8969
	originLon := 30.7133
	targetCategoryID := common.GivenEventCategory(t)
	otherCategoryID := common.GivenEventCategory(t)
	startTime := time.Now().UTC().Add(48 * time.Hour)
	startFrom := startTime.Add(-time.Hour)
	startTo := startTime.Add(time.Hour)
	query := "trail"

	matchID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Trail Coffee Meetup",
		Description:  "best trail stories",
		CategoryID:   targetCategoryID,
		Lat:          36.8975,
		Lon:          30.7140,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
		Tags:         []string{"outdoor", "coffee"},
	})
	insertFavoriteEvent(t, viewer.ID, matchID)

	otherCategoryEventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Trail Category Mismatch",
		Description:  "same text, wrong category",
		CategoryID:   otherCategoryID,
		Lat:          36.8977,
		Lon:          30.7142,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
		Tags:         []string{"outdoor"},
	})
	insertFavoriteEvent(t, viewer.ID, otherCategoryEventID)

	_ = createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Trail Tag Mismatch",
		Description:  "same text, wrong tag",
		CategoryID:   targetCategoryID,
		Lat:          36.8979,
		Lon:          30.7144,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
		Tags:         []string{"indoor"},
	})
	_ = createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Trail Not Favorite",
		Description:  "same text, not favorited",
		CategoryID:   targetCategoryID,
		Lat:          36.8981,
		Lon:          30.7146,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
		Tags:         []string{"outdoor"},
	})
	_ = createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Trail Date Mismatch",
		Description:  "same text, wrong date",
		CategoryID:   targetCategoryID,
		Lat:          36.8983,
		Lon:          30.7148,
		StartTime:    startTime.Add(24 * time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
		Tags:         []string{"outdoor"},
	})

	// when
	result, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat:           &originLat,
		Lon:           &originLon,
		Query:         &query,
		CategoryIDs:   []int{targetCategoryID},
		StartFrom:     &startFrom,
		StartTo:       &startTo,
		TagNames:      []string{"outdoor"},
		OnlyFavorited: true,
	})

	// then
	if err != nil {
		t.Fatalf("DiscoverEvents() error = %v", err)
	}
	assertDiscoverEventIDsInOrder(t, result.Items, matchID)
}

func TestDiscoverEventsSortsByDistance(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	viewer := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	originLat := 37.0000
	originLon := 35.3213
	startTime := time.Now().UTC().Add(24 * time.Hour)
	sortBy := domain.EventDiscoverySortDistance

	nearest := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Nearest",
		Description:  "closest",
		CategoryID:   categoryID,
		Lat:          37.0004,
		Lon:          35.3217,
		StartTime:    startTime.Add(2 * time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	middle := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Middle",
		Description:  "middle distance",
		CategoryID:   categoryID,
		Lat:          37.0120,
		Lon:          35.3290,
		StartTime:    startTime.Add(time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	farthest := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Farthest",
		Description:  "still within radius",
		CategoryID:   categoryID,
		Lat:          37.0350,
		Lon:          35.3450,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
	})

	// when
	result, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat:    &originLat,
		Lon:    &originLon,
		SortBy: &sortBy,
	})

	// then
	if err != nil {
		t.Fatalf("DiscoverEvents() error = %v", err)
	}
	assertDiscoverEventIDsInOrder(t, result.Items, nearest, middle, farthest)
}

func TestDiscoverEventsReflectsFavoriteStateForCurrentUser(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	viewer := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	originLat := 40.7667
	originLon := 29.9167
	startTime := time.Now().UTC().Add(24 * time.Hour)

	favoritedID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Favorited Event",
		Description:  "saved by viewer",
		CategoryID:   categoryID,
		Lat:          40.7672,
		Lon:          29.9172,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
	})
	plainID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Plain Event",
		Description:  "not saved",
		CategoryID:   categoryID,
		Lat:          40.7680,
		Lon:          29.9180,
		StartTime:    startTime.Add(time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	insertFavoriteEvent(t, viewer.ID, favoritedID)

	// when
	result, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat: &originLat,
		Lon: &originLon,
	})

	// then
	if err != nil {
		t.Fatalf("DiscoverEvents() error = %v", err)
	}
	if len(result.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(result.Items))
	}

	favoriteState := make(map[string]bool, len(result.Items))
	for _, item := range result.Items {
		favoriteState[item.ID] = item.IsFavorited
	}
	if !favoriteState[favoritedID.String()] {
		t.Fatalf("expected event %s to be favorited", favoritedID)
	}
	if favoriteState[plainID.String()] {
		t.Fatalf("expected event %s to not be favorited", plainID)
	}
}

func TestDiscoverEventsCursorPaginationIsStableAndNonOverlapping(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	viewer := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	originLat := 41.2867
	originLon := 36.3300
	limit := 2
	now := time.Now().UTC()

	first := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "First Page Item",
		Description:  "first",
		CategoryID:   categoryID,
		Lat:          41.2872,
		Lon:          36.3305,
		StartTime:    now.Add(24 * time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	second := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Second Page Item",
		Description:  "second",
		CategoryID:   categoryID,
		Lat:          41.2874,
		Lon:          36.3307,
		StartTime:    now.Add(25 * time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	third := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Third Page Item",
		Description:  "third",
		CategoryID:   categoryID,
		Lat:          41.2876,
		Lon:          36.3309,
		StartTime:    now.Add(26 * time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})

	// when
	firstPage, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat:   &originLat,
		Lon:   &originLon,
		Limit: &limit,
	})
	if err != nil {
		t.Fatalf("DiscoverEvents() first page error = %v", err)
	}
	if firstPage.PageInfo.NextCursor == nil {
		t.Fatal("expected first page to return next_cursor")
	}

	secondPage, err := harness.Service.DiscoverEvents(context.Background(), viewer.ID, eventapp.DiscoverEventsInput{
		Lat:    &originLat,
		Lon:    &originLon,
		Limit:  &limit,
		Cursor: firstPage.PageInfo.NextCursor,
	})

	// then
	if err != nil {
		t.Fatalf("DiscoverEvents() second page error = %v", err)
	}
	assertDiscoverEventIDsInOrder(t, firstPage.Items, first, second)
	assertDiscoverEventIDsInOrder(t, secondPage.Items, third)
	if secondPage.PageInfo.HasNext {
		t.Fatal("expected second page to be terminal")
	}
}

// ---------------------------------------------------------
// GetEventDetail tests
// ---------------------------------------------------------

func TestGetEventDetailReadsPublicEventForAuthenticatedUser(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	viewer := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("public_host"))
	categoryID := common.GivenEventCategory(t)
	startTime := time.Now().UTC().Add(24 * time.Hour)
	eventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Detailed Public Event",
		Description:  "full event detail",
		CategoryID:   categoryID,
		Lat:          41.0082,
		Lon:          28.9784,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
		Tags:         []string{"music", "outdoor"},
	})
	insertFavoriteEvent(t, viewer.ID, eventID)
	insertEventConstraint(t, eventID, "dress_code", "Wear something comfortable")

	// when
	result, err := harness.Service.GetEventDetail(context.Background(), viewer.ID, eventID)

	// then
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}
	if result.ID != eventID.String() {
		t.Fatalf("expected event id %s, got %s", eventID, result.ID)
	}
	if result.Title != "Detailed Public Event" {
		t.Fatalf("expected title %q, got %q", "Detailed Public Event", result.Title)
	}
	if result.Category == nil || result.Category.ID != categoryID {
		t.Fatalf("expected category id %d, got %#v", categoryID, result.Category)
	}
	if result.Host.Username != "public_host" {
		t.Fatalf("expected host username %q, got %q", "public_host", result.Host.Username)
	}
	if result.Location.Type != string(domain.LocationPoint) {
		t.Fatalf("expected location type %q, got %q", domain.LocationPoint, result.Location.Type)
	}
	if result.Location.Point == nil {
		t.Fatal("expected point location")
	}
	if !result.ViewerContext.IsFavorited {
		t.Fatal("expected viewer to see is_favorited=true")
	}
	if result.ViewerContext.ParticipationStatus != string(domain.EventDetailParticipationStatusNone) {
		t.Fatalf("expected participation_status %q, got %q", domain.EventDetailParticipationStatusNone, result.ViewerContext.ParticipationStatus)
	}
	if result.HostContext != nil {
		t.Fatal("expected non-host response to omit host_context")
	}
	if len(result.Tags) != 2 {
		t.Fatalf("expected 2 tags, got %d", len(result.Tags))
	}
	if len(result.Constraints) != 1 {
		t.Fatalf("expected 1 constraint, got %d", len(result.Constraints))
	}
}

func TestGetEventDetailReadsProtectedEventForAnyAuthenticatedUser(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	viewer := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo)
	eventID := common.GivenProtectedEvent(t, harness.Service, host.ID).ID

	// when
	result, err := harness.Service.GetEventDetail(context.Background(), viewer.ID, eventID)

	// then
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}
	if result.ID != eventID.String() {
		t.Fatalf("expected event id %s, got %s", eventID, result.ID)
	}
}

func TestGetEventDetailReadsPrivateEventForHost(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	eventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Private Host Event",
		Description:  "host can read",
		CategoryID:   common.GivenEventCategory(t),
		Lat:          40.0,
		Lon:          29.0,
		StartTime:    time.Now().UTC().Add(24 * time.Hour),
		PrivacyLevel: domain.PrivacyPrivate,
	})

	// when
	result, err := harness.Service.GetEventDetail(context.Background(), host.ID, eventID)

	// then
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}
	if !result.ViewerContext.IsHost {
		t.Fatal("expected host viewer_context.is_host to be true")
	}
	if result.HostContext == nil {
		t.Fatal("expected host_context for host")
	}
}

func TestGetEventDetailReadsPrivateEventForApprovedParticipant(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	eventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Private Approved Event",
		Description:  "participant can read",
		CategoryID:   common.GivenEventCategory(t),
		Lat:          41.1,
		Lon:          29.1,
		StartTime:    time.Now().UTC().Add(24 * time.Hour),
		PrivacyLevel: domain.PrivacyPrivate,
	})
	insertParticipation(t, eventID, participant.ID, domain.ParticipationStatusApproved)

	// when
	result, err := harness.Service.GetEventDetail(context.Background(), participant.ID, eventID)

	// then
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}
	if result.ViewerContext.ParticipationStatus != string(domain.EventDetailParticipationStatusJoined) {
		t.Fatalf("expected participation_status %q, got %q", domain.EventDetailParticipationStatusJoined, result.ViewerContext.ParticipationStatus)
	}
}

func TestGetEventDetailReadsPrivateEventForAcceptedInvitee(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	invitee := common.GivenUser(t, harness.AuthRepo)
	eventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Private Invitation Event",
		Description:  "invitee can read",
		CategoryID:   common.GivenEventCategory(t),
		Lat:          41.2,
		Lon:          29.2,
		StartTime:    time.Now().UTC().Add(24 * time.Hour),
		PrivacyLevel: domain.PrivacyPrivate,
	})
	insertInvitation(t, eventID, host.ID, invitee.ID, domain.InvitationStatusAccepted, common.StringPtr("Join us"), nil)

	// when
	result, err := harness.Service.GetEventDetail(context.Background(), invitee.ID, eventID)

	// then
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}
	if result.ViewerContext.ParticipationStatus != string(domain.EventDetailParticipationStatusInvited) {
		t.Fatalf("expected participation_status %q, got %q", domain.EventDetailParticipationStatusInvited, result.ViewerContext.ParticipationStatus)
	}
}

func TestGetEventDetailRejectsPrivateEventForUnrelatedUser(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	viewer := common.GivenUser(t, harness.AuthRepo)
	eventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Private Hidden Event",
		Description:  "should not leak",
		CategoryID:   common.GivenEventCategory(t),
		Lat:          41.3,
		Lon:          29.3,
		StartTime:    time.Now().UTC().Add(24 * time.Hour),
		PrivacyLevel: domain.PrivacyPrivate,
	})

	// when
	_, err := harness.Service.GetEventDetail(context.Background(), viewer.ID, eventID)

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeEventNotFound)
}

func TestGetEventDetailReportsViewerParticipationStatuses(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	joinedUser := common.GivenUser(t, harness.AuthRepo)
	pendingUser := common.GivenUser(t, harness.AuthRepo)
	invitedUser := common.GivenUser(t, harness.AuthRepo)
	noneUser := common.GivenUser(t, harness.AuthRepo)
	eventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Status Event",
		Description:  "viewer statuses",
		CategoryID:   common.GivenEventCategory(t),
		Lat:          41.4,
		Lon:          29.4,
		StartTime:    time.Now().UTC().Add(24 * time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	insertParticipation(t, eventID, joinedUser.ID, domain.ParticipationStatusApproved)
	insertPendingJoinRequest(t, eventID, pendingUser.ID, host.ID, common.StringPtr("please accept"))
	insertInvitation(t, eventID, host.ID, invitedUser.ID, domain.InvitationStatusPending, nil, nil)

	// when
	joinedDetail, err := harness.Service.GetEventDetail(context.Background(), joinedUser.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() joined error = %v", err)
	}
	pendingDetail, err := harness.Service.GetEventDetail(context.Background(), pendingUser.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() pending error = %v", err)
	}
	invitedDetail, err := harness.Service.GetEventDetail(context.Background(), invitedUser.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() invited error = %v", err)
	}
	noneDetail, err := harness.Service.GetEventDetail(context.Background(), noneUser.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() none error = %v", err)
	}

	// then
	if joinedDetail.ViewerContext.ParticipationStatus != string(domain.EventDetailParticipationStatusJoined) {
		t.Fatalf("expected joined status %q, got %q", domain.EventDetailParticipationStatusJoined, joinedDetail.ViewerContext.ParticipationStatus)
	}
	if pendingDetail.ViewerContext.ParticipationStatus != string(domain.EventDetailParticipationStatusPending) {
		t.Fatalf("expected pending status %q, got %q", domain.EventDetailParticipationStatusPending, pendingDetail.ViewerContext.ParticipationStatus)
	}
	if invitedDetail.ViewerContext.ParticipationStatus != string(domain.EventDetailParticipationStatusInvited) {
		t.Fatalf("expected invited status %q, got %q", domain.EventDetailParticipationStatusInvited, invitedDetail.ViewerContext.ParticipationStatus)
	}
	if noneDetail.ViewerContext.ParticipationStatus != string(domain.EventDetailParticipationStatusNone) {
		t.Fatalf("expected none status %q, got %q", domain.EventDetailParticipationStatusNone, noneDetail.ViewerContext.ParticipationStatus)
	}
}

func TestGetEventDetailReturnsCanceledAndCompletedStatuses(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	viewer := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	startTime := time.Now().UTC().Add(24 * time.Hour)
	canceledID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Canceled Event",
		Description:  "still readable",
		CategoryID:   categoryID,
		Lat:          41.5,
		Lon:          29.5,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyPublic,
	})
	completedID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Completed Event",
		Description:  "still readable",
		CategoryID:   categoryID,
		Lat:          41.6,
		Lon:          29.6,
		StartTime:    startTime.Add(time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	updateEventStatus(t, canceledID, string(domain.EventStatusCanceled))
	updateEventStatus(t, completedID, string(domain.EventStatusCompleted))

	// when
	canceledDetail, err := harness.Service.GetEventDetail(context.Background(), viewer.ID, canceledID)
	if err != nil {
		t.Fatalf("GetEventDetail() canceled error = %v", err)
	}
	completedDetail, err := harness.Service.GetEventDetail(context.Background(), viewer.ID, completedID)
	if err != nil {
		t.Fatalf("GetEventDetail() completed error = %v", err)
	}

	// then
	if canceledDetail.Status != string(domain.EventStatusCanceled) {
		t.Fatalf("expected canceled status %q, got %q", domain.EventStatusCanceled, canceledDetail.Status)
	}
	if completedDetail.Status != string(domain.EventStatusCompleted) {
		t.Fatalf("expected completed status %q, got %q", domain.EventStatusCompleted, completedDetail.Status)
	}
}

func TestGetEventDetailReturnsRoutePoints(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	viewer := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo)
	eventID := createRouteDiscoveryEvent(t, harness, routeDiscoveryEventSeed{
		HostID:       host.ID,
		Title:        "Route Detail Event",
		Description:  "route detail",
		CategoryID:   common.GivenEventCategory(t),
		StartTime:    time.Now().UTC().Add(24 * time.Hour),
		PrivacyLevel: domain.PrivacyProtected,
		RoutePoints: []eventapp.RoutePointInput{
			{Lat: common.Float64Ptr(41.0001), Lon: common.Float64Ptr(29.0001)},
			{Lat: common.Float64Ptr(41.0002), Lon: common.Float64Ptr(29.0002)},
			{Lat: common.Float64Ptr(41.0003), Lon: common.Float64Ptr(29.0003)},
		},
	})

	// when
	result, err := harness.Service.GetEventDetail(context.Background(), viewer.ID, eventID)

	// then
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}
	if result.Location.Type != string(domain.LocationRoute) {
		t.Fatalf("expected location type %q, got %q", domain.LocationRoute, result.Location.Type)
	}
	if len(result.Location.RoutePoints) != 3 {
		t.Fatalf("expected 3 route points, got %d", len(result.Location.RoutePoints))
	}
}

func TestGetEventDetailReturnsHostOnlyManagementLists(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("detail_host"))
	participant := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("approved_user"))
	requester := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("pending_user"))
	invitee := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("invited_user"))
	nonHostViewer := common.GivenUser(t, harness.AuthRepo)
	eventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Managed Event",
		Description:  "host details",
		CategoryID:   common.GivenEventCategory(t),
		Lat:          41.7,
		Lon:          29.7,
		StartTime:    time.Now().UTC().Add(24 * time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})
	insertParticipation(t, eventID, participant.ID, domain.ParticipationStatusApproved)
	insertPendingJoinRequest(t, eventID, requester.ID, host.ID, common.StringPtr("I would like to join"))
	insertInvitation(t, eventID, host.ID, invitee.ID, domain.InvitationStatusPending, common.StringPtr("Come with us"), nil)
	insertUserScore(t, participant.ID, nil, 2, nil, 3, float64Ptr(4.4))
	insertUserScore(t, requester.ID, nil, 1, nil, 1, float64Ptr(3.8))
	insertUserScore(t, invitee.ID, nil, 0, nil, 6, float64Ptr(4.1))

	// when
	hostResult, err := harness.Service.GetEventDetail(context.Background(), host.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() host error = %v", err)
	}
	nonHostResult, err := harness.Service.GetEventDetail(context.Background(), nonHostViewer.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() non-host error = %v", err)
	}

	// then
	if hostResult.HostContext == nil {
		t.Fatal("expected host_context for host viewer")
	}
	if len(hostResult.HostContext.ApprovedParticipants) != 1 {
		t.Fatalf("expected 1 approved participant, got %d", len(hostResult.HostContext.ApprovedParticipants))
	}
	if len(hostResult.HostContext.PendingJoinRequests) != 1 {
		t.Fatalf("expected 1 pending join request, got %d", len(hostResult.HostContext.PendingJoinRequests))
	}
	if len(hostResult.HostContext.Invitations) != 1 {
		t.Fatalf("expected 1 invitation, got %d", len(hostResult.HostContext.Invitations))
	}
	if hostResult.HostContext.ApprovedParticipants[0].User.Username != "approved_user" {
		t.Fatalf("expected approved participant username %q, got %q", "approved_user", hostResult.HostContext.ApprovedParticipants[0].User.Username)
	}
	if hostResult.HostContext.ApprovedParticipants[0].User.FinalScore == nil || *hostResult.HostContext.ApprovedParticipants[0].User.FinalScore != 4.4 {
		t.Fatalf("expected approved participant final_score 4.4, got %v", hostResult.HostContext.ApprovedParticipants[0].User.FinalScore)
	}
	if hostResult.HostContext.ApprovedParticipants[0].User.RatingCount != 5 {
		t.Fatalf("expected approved participant rating_count 5, got %d", hostResult.HostContext.ApprovedParticipants[0].User.RatingCount)
	}
	if hostResult.HostContext.PendingJoinRequests[0].User.Username != "pending_user" {
		t.Fatalf("expected pending join request username %q, got %q", "pending_user", hostResult.HostContext.PendingJoinRequests[0].User.Username)
	}
	if hostResult.HostContext.PendingJoinRequests[0].User.FinalScore == nil || *hostResult.HostContext.PendingJoinRequests[0].User.FinalScore != 3.8 {
		t.Fatalf("expected pending user final_score 3.8, got %v", hostResult.HostContext.PendingJoinRequests[0].User.FinalScore)
	}
	if hostResult.HostContext.PendingJoinRequests[0].User.RatingCount != 2 {
		t.Fatalf("expected pending user rating_count 2, got %d", hostResult.HostContext.PendingJoinRequests[0].User.RatingCount)
	}
	if hostResult.HostContext.Invitations[0].User.Username != "invited_user" {
		t.Fatalf("expected invitation username %q, got %q", "invited_user", hostResult.HostContext.Invitations[0].User.Username)
	}
	if hostResult.HostContext.Invitations[0].User.FinalScore == nil || *hostResult.HostContext.Invitations[0].User.FinalScore != 4.1 {
		t.Fatalf("expected invited user final_score 4.1, got %v", hostResult.HostContext.Invitations[0].User.FinalScore)
	}
	if hostResult.HostContext.Invitations[0].User.RatingCount != 6 {
		t.Fatalf("expected invited user rating_count 6, got %d", hostResult.HostContext.Invitations[0].User.RatingCount)
	}
	if nonHostResult.HostContext != nil {
		t.Fatal("expected non-host response to omit host_context")
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

func TestLeaveEventSuccessPathBeforeStart(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	if _, err := harness.Service.JoinEvent(context.Background(), participant.ID, ref.ID); err != nil {
		t.Fatalf("JoinEvent() error = %v", err)
	}

	result, err := harness.Service.LeaveEvent(context.Background(), participant.ID, ref.ID)
	if err != nil {
		t.Fatalf("LeaveEvent() error = %v", err)
	}

	if result.ParticipationID == "" {
		t.Fatal("expected non-empty participation_id")
	}
	if result.Status != domain.ParticipationStatusLeaved {
		t.Fatalf("expected status %q, got %q", domain.ParticipationStatusLeaved, result.Status)
	}

	var storedStatus string
	if err := common.RequirePool(t).QueryRow(
		context.Background(),
		`SELECT status FROM participation WHERE event_id = $1 AND user_id = $2`,
		ref.ID,
		participant.ID,
	).Scan(&storedStatus); err != nil {
		t.Fatalf("load participation status error = %v", err)
	}
	if storedStatus != string(domain.ParticipationStatusLeaved) {
		t.Fatalf("expected stored participation status %q, got %q", domain.ParticipationStatusLeaved, storedStatus)
	}

	detail, err := harness.Service.GetEventDetail(context.Background(), participant.ID, ref.ID)
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}
	if detail.ViewerContext.ParticipationStatus != string(domain.EventDetailParticipationStatusLeaved) {
		t.Fatalf("expected participation_status %q, got %q", domain.EventDetailParticipationStatusLeaved, detail.ViewerContext.ParticipationStatus)
	}

	upcomingEvents, err := harness.ProfileService.GetMyUpcomingEvents(context.Background(), participant.ID)
	if err != nil {
		t.Fatalf("GetMyUpcomingEvents() error = %v", err)
	}
	for _, e := range upcomingEvents {
		if e.ID == ref.ID.String() {
			t.Fatalf("left event %s should not appear in upcoming events", ref.ID)
		}
	}
}

func TestLeaveEventRejectsHost(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	_, err := harness.Service.LeaveEvent(context.Background(), host.ID, ref.ID)

	common.RequireAppErrorCode(t, err, domain.ErrorCodeHostCannotLeave)
}

func TestLeaveEventRejectsPendingJoinRequester(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	requester := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenProtectedEvent(t, harness.Service, host.ID)

	if _, err := harness.Service.RequestJoin(context.Background(), requester.ID, ref.ID, eventapp.RequestJoinInput{}); err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}

	_, err := harness.Service.LeaveEvent(context.Background(), requester.ID, ref.ID)

	common.RequireAppErrorCode(t, err, domain.ErrorCodeEventLeaveNotAllowed)
}

func TestLeaveEventRejectsEndedEvent(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	eventID := common.GivenExpiredEvent(t, host.ID)
	insertParticipation(t, eventID, participant.ID, domain.ParticipationStatusApproved)

	_, err := harness.Service.LeaveEvent(context.Background(), participant.ID, eventID)

	common.RequireAppErrorCode(t, err, domain.ErrorCodeEventNotLeaveable)
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
	if result.Status != string(domain.JoinRequestStatusPending) {
		t.Fatalf("expected status %q, got %q", domain.JoinRequestStatusPending, result.Status)
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

// ---------------------------------------------------------
// Host join-request moderation tests
// ---------------------------------------------------------

func TestApproveJoinRequestSuccessPath(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("host_user"))
	requester := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("requester_user"))
	event := common.GivenProtectedEvent(t, harness.Service, host.ID)

	createdRequest, err := harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{})
	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}

	joinRequestID, err := uuid.Parse(createdRequest.JoinRequestID)
	if err != nil {
		t.Fatalf("uuid.Parse() join_request_id error = %v", err)
	}

	// when
	result, err := harness.Service.ApproveJoinRequest(context.Background(), host.ID, event.ID, joinRequestID)

	// then
	if err != nil {
		t.Fatalf("ApproveJoinRequest() error = %v", err)
	}
	if result.JoinRequestStatus != string(domain.JoinRequestStatusApproved) {
		t.Fatalf("expected join request status %q, got %q", domain.JoinRequestStatusApproved, result.JoinRequestStatus)
	}
	if result.ParticipationStatus != domain.ParticipationStatusApproved {
		t.Fatalf("expected participation status %q, got %q", domain.ParticipationStatusApproved, result.ParticipationStatus)
	}

	var (
		storedStatus     string
		hasParticipation bool
	)
	err = common.RequirePool(t).QueryRow(
		context.Background(),
		`SELECT status, participation_id IS NOT NULL FROM join_request WHERE id = $1`,
		joinRequestID,
	).Scan(&storedStatus, &hasParticipation)
	if err != nil {
		t.Fatalf("select join_request approval state error = %v", err)
	}
	if storedStatus != string(domain.JoinRequestStatusApproved) {
		t.Fatalf("expected stored join request status %q, got %q", domain.JoinRequestStatusApproved, storedStatus)
	}
	if !hasParticipation {
		t.Fatal("expected approved join request to reference a participation row")
	}

	hostDetail, err := harness.Service.GetEventDetail(context.Background(), host.ID, event.ID)
	if err != nil {
		t.Fatalf("GetEventDetail() host error = %v", err)
	}
	if len(hostDetail.HostContext.PendingJoinRequests) != 0 {
		t.Fatalf("expected no pending join requests after approval, got %d", len(hostDetail.HostContext.PendingJoinRequests))
	}
	if len(hostDetail.HostContext.ApprovedParticipants) != 1 {
		t.Fatalf("expected 1 approved participant after approval, got %d", len(hostDetail.HostContext.ApprovedParticipants))
	}
	if hostDetail.HostContext.ApprovedParticipants[0].User.Username != "requester_user" {
		t.Fatalf("expected approved participant username %q, got %q", "requester_user", hostDetail.HostContext.ApprovedParticipants[0].User.Username)
	}

	requesterDetail, err := harness.Service.GetEventDetail(context.Background(), requester.ID, event.ID)
	if err != nil {
		t.Fatalf("GetEventDetail() requester error = %v", err)
	}
	if requesterDetail.ViewerContext.ParticipationStatus != string(domain.EventDetailParticipationStatusJoined) {
		t.Fatalf("expected requester participation_status %q, got %q", domain.EventDetailParticipationStatusJoined, requesterDetail.ViewerContext.ParticipationStatus)
	}
}

func TestRejectJoinRequestSuccessPath(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	requester := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenProtectedEvent(t, harness.Service, host.ID)

	createdRequest, err := harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{})
	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}

	joinRequestID, err := uuid.Parse(createdRequest.JoinRequestID)
	if err != nil {
		t.Fatalf("uuid.Parse() join_request_id error = %v", err)
	}

	// when
	result, err := harness.Service.RejectJoinRequest(context.Background(), host.ID, event.ID, joinRequestID)

	// then
	if err != nil {
		t.Fatalf("RejectJoinRequest() error = %v", err)
	}
	if result.Status != string(domain.JoinRequestStatusRejected) {
		t.Fatalf("expected join request status %q, got %q", domain.JoinRequestStatusRejected, result.Status)
	}
	if !result.CooldownEndsAt.After(result.UpdatedAt) {
		t.Fatalf("expected cooldown_ends_at %v to be after updated_at %v", result.CooldownEndsAt, result.UpdatedAt)
	}

	var (
		storedStatus string
		count        int
	)
	err = common.RequirePool(t).QueryRow(
		context.Background(),
		`SELECT status FROM join_request WHERE id = $1`,
		joinRequestID,
	).Scan(&storedStatus)
	if err != nil {
		t.Fatalf("select join_request rejection state error = %v", err)
	}
	if storedStatus != string(domain.JoinRequestStatusRejected) {
		t.Fatalf("expected stored join request status %q, got %q", domain.JoinRequestStatusRejected, storedStatus)
	}

	err = common.RequirePool(t).QueryRow(
		context.Background(),
		`SELECT COUNT(*) FROM participation WHERE event_id = $1 AND user_id = $2`,
		event.ID,
		requester.ID,
	).Scan(&count)
	if err != nil {
		t.Fatalf("count participation rows error = %v", err)
	}
	if count != 0 {
		t.Fatalf("expected no participation row after rejection, got %d", count)
	}

	hostDetail, err := harness.Service.GetEventDetail(context.Background(), host.ID, event.ID)
	if err != nil {
		t.Fatalf("GetEventDetail() host error = %v", err)
	}
	if len(hostDetail.HostContext.PendingJoinRequests) != 0 {
		t.Fatalf("expected no pending join requests after rejection, got %d", len(hostDetail.HostContext.PendingJoinRequests))
	}

	requesterDetail, err := harness.Service.GetEventDetail(context.Background(), requester.ID, event.ID)
	if err != nil {
		t.Fatalf("GetEventDetail() requester error = %v", err)
	}
	if requesterDetail.ViewerContext.ParticipationStatus != string(domain.EventDetailParticipationStatusNone) {
		t.Fatalf("expected requester participation_status %q, got %q", domain.EventDetailParticipationStatusNone, requesterDetail.ViewerContext.ParticipationStatus)
	}
}

func TestApproveJoinRequestRejectsNonHost(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	requester := common.GivenUser(t, harness.AuthRepo)
	nonHost := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenProtectedEvent(t, harness.Service, host.ID)

	createdRequest, err := harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{})
	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}

	joinRequestID, err := uuid.Parse(createdRequest.JoinRequestID)
	if err != nil {
		t.Fatalf("uuid.Parse() join_request_id error = %v", err)
	}

	// when
	_, err = harness.Service.ApproveJoinRequest(context.Background(), nonHost.ID, event.ID, joinRequestID)

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeJoinRequestModerationNotAllowed)
}

func TestRejectJoinRequestRejectsNonHost(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	requester := common.GivenUser(t, harness.AuthRepo)
	nonHost := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenProtectedEvent(t, harness.Service, host.ID)

	createdRequest, err := harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{})
	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}

	joinRequestID, err := uuid.Parse(createdRequest.JoinRequestID)
	if err != nil {
		t.Fatalf("uuid.Parse() join_request_id error = %v", err)
	}

	// when
	_, err = harness.Service.RejectJoinRequest(context.Background(), nonHost.ID, event.ID, joinRequestID)

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeJoinRequestModerationNotAllowed)
}

func TestApproveJoinRequestRejectsResolvedRequest(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	requester := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenProtectedEvent(t, harness.Service, host.ID)

	createdRequest, err := harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{})
	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}

	joinRequestID, err := uuid.Parse(createdRequest.JoinRequestID)
	if err != nil {
		t.Fatalf("uuid.Parse() join_request_id error = %v", err)
	}

	_, err = harness.Service.ApproveJoinRequest(context.Background(), host.ID, event.ID, joinRequestID)
	if err != nil {
		t.Fatalf("ApproveJoinRequest() first call error = %v", err)
	}

	// when
	_, err = harness.Service.ApproveJoinRequest(context.Background(), host.ID, event.ID, joinRequestID)

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeJoinRequestStateInvalid)
}

func TestRejectJoinRequestRejectsResolvedRequest(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	requester := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenProtectedEvent(t, harness.Service, host.ID)

	createdRequest, err := harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{})
	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}

	joinRequestID, err := uuid.Parse(createdRequest.JoinRequestID)
	if err != nil {
		t.Fatalf("uuid.Parse() join_request_id error = %v", err)
	}

	_, err = harness.Service.RejectJoinRequest(context.Background(), host.ID, event.ID, joinRequestID)
	if err != nil {
		t.Fatalf("RejectJoinRequest() first call error = %v", err)
	}

	// when
	_, err = harness.Service.RejectJoinRequest(context.Background(), host.ID, event.ID, joinRequestID)

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeJoinRequestStateInvalid)
}

func TestApproveJoinRequestRejectsWhenCapacityIsFull(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	approvedUser := common.GivenUser(t, harness.AuthRepo)
	requester := common.GivenUser(t, harness.AuthRepo)
	eventID := createProtectedEventWithCapacity(t, harness, host.ID, 1)

	insertParticipation(t, eventID, approvedUser.ID, domain.ParticipationStatusApproved)
	joinRequestID := insertPendingJoinRequest(t, eventID, requester.ID, host.ID, nil)

	// when
	_, err := harness.Service.ApproveJoinRequest(context.Background(), host.ID, eventID, joinRequestID)

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeCapacityExceeded)
}

func TestRequestJoinRejectsDuringCooldownWindow(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	requester := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenProtectedEvent(t, harness.Service, host.ID)

	createdRequest, err := harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{})
	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}

	joinRequestID, err := uuid.Parse(createdRequest.JoinRequestID)
	if err != nil {
		t.Fatalf("uuid.Parse() join_request_id error = %v", err)
	}

	_, err = harness.Service.RejectJoinRequest(context.Background(), host.ID, event.ID, joinRequestID)
	if err != nil {
		t.Fatalf("RejectJoinRequest() error = %v", err)
	}

	// when
	_, err = harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{})

	// then
	common.RequireAppErrorCode(t, err, domain.ErrorCodeJoinRequestCooldownActive)
}

func TestRequestJoinReactivatesRejectedRequestAfterCooldown(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	requester := common.GivenUser(t, harness.AuthRepo)
	event := common.GivenProtectedEvent(t, harness.Service, host.ID)
	initialMessage := "Initial request"
	retryMessage := "Retry after cooldown"

	createdRequest, err := harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{
		Message: &initialMessage,
	})
	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}

	joinRequestID, err := uuid.Parse(createdRequest.JoinRequestID)
	if err != nil {
		t.Fatalf("uuid.Parse() join_request_id error = %v", err)
	}

	_, err = harness.Service.RejectJoinRequest(context.Background(), host.ID, event.ID, joinRequestID)
	if err != nil {
		t.Fatalf("RejectJoinRequest() error = %v", err)
	}

	setJoinRequestUpdatedAt(t, joinRequestID, time.Now().UTC().Add(-4*24*time.Hour))

	// when
	result, err := harness.Service.RequestJoin(context.Background(), requester.ID, event.ID, eventapp.RequestJoinInput{
		Message: &retryMessage,
	})

	// then
	if err != nil {
		t.Fatalf("RequestJoin() retry error = %v", err)
	}
	if result.JoinRequestID != joinRequestID.String() {
		t.Fatalf("expected reactivated join request id %q, got %q", joinRequestID, result.JoinRequestID)
	}
	if result.Status != string(domain.JoinRequestStatusPending) {
		t.Fatalf("expected reactivated status %q, got %q", domain.JoinRequestStatusPending, result.Status)
	}

	var (
		storedStatus       string
		storedMessage      *string
		hasNoParticipation bool
		createdAt          time.Time
		updatedAt          time.Time
	)
	err = common.RequirePool(t).QueryRow(
		context.Background(),
		`SELECT status, message, participation_id IS NULL, created_at, updated_at
		 FROM join_request
		 WHERE id = $1`,
		joinRequestID,
	).Scan(&storedStatus, &storedMessage, &hasNoParticipation, &createdAt, &updatedAt)
	if err != nil {
		t.Fatalf("select reactivated join_request error = %v", err)
	}
	if storedStatus != string(domain.JoinRequestStatusPending) {
		t.Fatalf("expected stored status %q, got %q", domain.JoinRequestStatusPending, storedStatus)
	}
	if storedMessage == nil || *storedMessage != retryMessage {
		t.Fatalf("expected stored retry message %q, got %v", retryMessage, storedMessage)
	}
	if !hasNoParticipation {
		t.Fatal("expected reactivated join request participation_id to be nil")
	}
	if time.Since(createdAt) > time.Minute || time.Since(updatedAt) > time.Minute {
		t.Fatalf("expected created_at and updated_at to be reset near now, got created_at=%v updated_at=%v", createdAt, updatedAt)
	}
}

type discoveryEventSeed struct {
	HostID       uuid.UUID
	Title        string
	Description  string
	CategoryID   int
	Lat          float64
	Lon          float64
	StartTime    time.Time
	PrivacyLevel domain.EventPrivacyLevel
	Tags         []string
}

type routeDiscoveryEventSeed struct {
	HostID       uuid.UUID
	Title        string
	Description  string
	CategoryID   int
	StartTime    time.Time
	PrivacyLevel domain.EventPrivacyLevel
	RoutePoints  []eventapp.RoutePointInput
}

func createDiscoveryEvent(t *testing.T, harness *common.EventHarness, seed discoveryEventSeed) uuid.UUID {
	t.Helper()

	result, err := harness.Service.CreateEvent(context.Background(), seed.HostID, eventapp.CreateEventInput{
		Title:        seed.Title,
		Description:  common.StringPtr(seed.Description),
		CategoryID:   &seed.CategoryID,
		LocationType: domain.LocationPoint,
		Lat:          &seed.Lat,
		Lon:          &seed.Lon,
		StartTime:    seed.StartTime,
		PrivacyLevel: seed.PrivacyLevel,
		Tags:         seed.Tags,
	})
	if err != nil {
		t.Fatalf("CreateEvent() discovery seed error = %v", err)
	}

	eventID, err := uuid.Parse(result.ID)
	if err != nil {
		t.Fatalf("uuid.Parse() error = %v", err)
	}

	return eventID
}

func createRouteDiscoveryEvent(t *testing.T, harness *common.EventHarness, seed routeDiscoveryEventSeed) uuid.UUID {
	t.Helper()

	result, err := harness.Service.CreateEvent(context.Background(), seed.HostID, eventapp.CreateEventInput{
		Title:        seed.Title,
		Description:  common.StringPtr(seed.Description),
		CategoryID:   &seed.CategoryID,
		LocationType: domain.LocationRoute,
		StartTime:    seed.StartTime,
		PrivacyLevel: seed.PrivacyLevel,
		RoutePoints:  seed.RoutePoints,
	})
	if err != nil {
		t.Fatalf("CreateEvent() route discovery seed error = %v", err)
	}

	eventID, err := uuid.Parse(result.ID)
	if err != nil {
		t.Fatalf("uuid.Parse() error = %v", err)
	}

	return eventID
}

func updateEventStatus(t *testing.T, eventID uuid.UUID, status string) {
	t.Helper()

	commandTag, err := common.RequirePool(t).Exec(
		context.Background(),
		`UPDATE event SET status = $2 WHERE id = $1`,
		eventID,
		status,
	)
	if err != nil {
		t.Fatalf("update event status error = %v", err)
	}
	if commandTag.RowsAffected() != 1 {
		t.Fatalf("expected 1 updated row, got %d", commandTag.RowsAffected())
	}
}

func insertFavoriteEvent(t *testing.T, userID, eventID uuid.UUID) {
	t.Helper()

	if _, err := common.RequirePool(t).Exec(
		context.Background(),
		`INSERT INTO favorite_event (user_id, event_id) VALUES ($1, $2)`,
		userID,
		eventID,
	); err != nil {
		t.Fatalf("insert favorite_event error = %v", err)
	}
}

func insertEventConstraint(t *testing.T, eventID uuid.UUID, constraintType, info string) {
	t.Helper()

	if _, err := common.RequirePool(t).Exec(
		context.Background(),
		`INSERT INTO event_constraint (event_id, constraint_type, constraint_info) VALUES ($1, $2, $3)`,
		eventID,
		constraintType,
		info,
	); err != nil {
		t.Fatalf("insert event_constraint error = %v", err)
	}
}

func insertParticipation(t *testing.T, eventID, userID uuid.UUID, status domain.ParticipationStatus) uuid.UUID {
	t.Helper()

	var participationID uuid.UUID
	err := common.RequirePool(t).QueryRow(
		context.Background(),
		`INSERT INTO participation (event_id, user_id, status) VALUES ($1, $2, $3) RETURNING id`,
		eventID,
		userID,
		status,
	).Scan(&participationID)
	if err != nil {
		t.Fatalf("insert participation error = %v", err)
	}

	return participationID
}

func insertParticipationWithTimes(
	t *testing.T,
	eventID, userID uuid.UUID,
	status domain.ParticipationStatus,
	createdAt, updatedAt time.Time,
) uuid.UUID {
	t.Helper()

	var participationID uuid.UUID
	err := common.RequirePool(t).QueryRow(
		context.Background(),
		`INSERT INTO participation (event_id, user_id, status, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id`,
		eventID,
		userID,
		status,
		createdAt,
		updatedAt,
	).Scan(&participationID)
	if err != nil {
		t.Fatalf("insert timed participation error = %v", err)
	}

	return participationID
}

func loadEventStartTime(t *testing.T, eventID uuid.UUID) time.Time {
	t.Helper()

	var startTime time.Time
	if err := common.RequirePool(t).QueryRow(
		context.Background(),
		`SELECT start_time FROM event WHERE id = $1`,
		eventID,
	).Scan(&startTime); err != nil {
		t.Fatalf("load event start_time error = %v", err)
	}

	return startTime
}

func insertUserScore(
	t *testing.T,
	userID uuid.UUID,
	participantScore *float64,
	participantRatingCount int,
	hostedEventScore *float64,
	hostedEventRatingCount int,
	finalScore *float64,
) {
	t.Helper()

	if _, err := common.RequirePool(t).Exec(
		context.Background(),
		`INSERT INTO user_score (
			user_id,
			participant_score,
			participant_rating_count,
			hosted_event_score,
			hosted_event_rating_count,
			final_score
		) VALUES ($1, $2, $3, $4, $5, $6)`,
		userID,
		participantScore,
		participantRatingCount,
		hostedEventScore,
		hostedEventRatingCount,
		finalScore,
	); err != nil {
		t.Fatalf("insert user_score error = %v", err)
	}
}

func insertPendingJoinRequest(t *testing.T, eventID, userID, hostUserID uuid.UUID, message *string) uuid.UUID {
	t.Helper()

	var joinRequestID uuid.UUID
	err := common.RequirePool(t).QueryRow(
		context.Background(),
		`INSERT INTO join_request (event_id, user_id, host_user_id, status, message) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		eventID,
		userID,
		hostUserID,
		domain.JoinRequestStatusPending,
		message,
	).Scan(&joinRequestID)
	if err != nil {
		t.Fatalf("insert join_request error = %v", err)
	}

	return joinRequestID
}

func setJoinRequestUpdatedAt(t *testing.T, joinRequestID uuid.UUID, updatedAt time.Time) {
	t.Helper()

	if _, err := common.RequirePool(t).Exec(
		context.Background(),
		`UPDATE join_request SET updated_at = $2 WHERE id = $1`,
		joinRequestID,
		updatedAt,
	); err != nil {
		t.Fatalf("update join_request updated_at error = %v", err)
	}
}

func createProtectedEventWithCapacity(t *testing.T, harness *common.EventHarness, hostID uuid.UUID, capacity int) uuid.UUID {
	t.Helper()

	startTime := time.Now().UTC().Add(24 * time.Hour)
	categoryID := common.GivenEventCategory(t)
	lat := 41.01
	lon := 29.01

	result, err := harness.Service.CreateEvent(context.Background(), hostID, eventapp.CreateEventInput{
		Title:        "Capacity constrained event",
		Description:  common.StringPtr("Protected event with capacity"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          &lat,
		Lon:          &lon,
		StartTime:    startTime,
		PrivacyLevel: domain.PrivacyProtected,
		Capacity:     &capacity,
	})
	if err != nil {
		t.Fatalf("CreateEvent() error = %v", err)
	}

	eventID, err := uuid.Parse(result.ID)
	if err != nil {
		t.Fatalf("uuid.Parse() event id error = %v", err)
	}

	return eventID
}

func insertInvitation(
	t *testing.T,
	eventID, hostID, invitedUserID uuid.UUID,
	status domain.InvitationStatus,
	message *string,
	expiresAt *time.Time,
) uuid.UUID {
	t.Helper()

	var invitationID uuid.UUID
	err := common.RequirePool(t).QueryRow(
		context.Background(),
		`INSERT INTO invitation (event_id, host_id, invited_user_id, status, message, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		eventID,
		hostID,
		invitedUserID,
		string(status),
		message,
		expiresAt,
	).Scan(&invitationID)
	if err != nil {
		t.Fatalf("insert invitation error = %v", err)
	}

	return invitationID
}

func float64Ptr(value float64) *float64 {
	return &value
}

func assertDiscoverEventIDsInOrder(t *testing.T, items []eventapp.DiscoverableEventItem, want ...uuid.UUID) {
	t.Helper()

	if len(items) != len(want) {
		t.Fatalf("expected %d items, got %d", len(want), len(items))
	}

	for i, expectedID := range want {
		if items[i].ID != expectedID.String() {
			t.Fatalf("expected item %d to be %s, got %s", i, expectedID, items[i].ID)
		}
	}
}

func TestTransitionEventStatuses_ExpiredToCompleted(t *testing.T) {
	t.Parallel()

	// given — an ACTIVE event whose end_time is in the past
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	expiredEventID := common.GivenExpiredEvent(t, host.ID)

	// when
	err := harness.EventRepo.TransitionEventStatuses(context.Background())

	// then
	if err != nil {
		t.Fatalf("TransitionEventStatuses() error = %v", err)
	}

	event, err := harness.EventRepo.GetEventByID(context.Background(), expiredEventID)
	if err != nil {
		t.Fatalf("GetEventByID() error = %v", err)
	}
	if event.Status != domain.EventStatusCompleted {
		t.Fatalf("expected status %q, got %q", domain.EventStatusCompleted, event.Status)
	}
}

func TestTransitionEventStatuses_StartedToInProgress(t *testing.T) {
	t.Parallel()

	// given — an ACTIVE event whose start_time has passed but end_time is in the future
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	startedEventID := common.GivenStartedEvent(t, host.ID)

	// when
	err := harness.EventRepo.TransitionEventStatuses(context.Background())

	// then
	if err != nil {
		t.Fatalf("TransitionEventStatuses() error = %v", err)
	}

	event, err := harness.EventRepo.GetEventByID(context.Background(), startedEventID)
	if err != nil {
		t.Fatalf("GetEventByID() error = %v", err)
	}
	if event.Status != domain.EventStatusInProgress {
		t.Fatalf("expected status %q, got %q", domain.EventStatusInProgress, event.Status)
	}
}

func TestCancelEventSuccessPath(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	// when
	err := harness.Service.CancelEvent(context.Background(), host.ID, ref.ID)

	// then
	if err != nil {
		t.Fatalf("CancelEvent() error = %v", err)
	}

	event, err := harness.EventRepo.GetEventByID(context.Background(), ref.ID)
	if err != nil {
		t.Fatalf("GetEventByID() error = %v", err)
	}
	if event.Status != domain.EventStatusCanceled {
		t.Fatalf("expected status %q, got %q", domain.EventStatusCanceled, event.Status)
	}
}

func TestCancelEventForbiddenForNonHost(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	other := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	// when
	err := harness.Service.CancelEvent(context.Background(), other.ID, ref.ID)

	// then
	if err == nil {
		t.Fatal("expected forbidden error, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Status != 403 {
		t.Fatalf("expected 403 AppError, got %v", err)
	}
}

func TestCancelEventReturnsConflictForNonActiveEvent(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	// cancel once
	if err := harness.Service.CancelEvent(context.Background(), host.ID, ref.ID); err != nil {
		t.Fatalf("first CancelEvent() error = %v", err)
	}

	// when: cancel again
	err := harness.Service.CancelEvent(context.Background(), host.ID, ref.ID)

	// then
	if err == nil {
		t.Fatal("expected conflict error, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Status != 409 {
		t.Fatalf("expected 409 AppError, got %v", err)
	}
}

func TestCompleteEventSuccessPath(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	if err := harness.Service.CompleteEvent(context.Background(), host.ID, ref.ID); err != nil {
		t.Fatalf("CompleteEvent() error = %v", err)
	}

	event, err := harness.EventRepo.GetEventByID(context.Background(), ref.ID)
	if err != nil {
		t.Fatalf("GetEventByID() error = %v", err)
	}
	if event.Status != domain.EventStatusCompleted {
		t.Fatalf("expected status %q, got %q", domain.EventStatusCompleted, event.Status)
	}
}

func TestCompleteEventSuccessOpenEnded(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	categoryID := common.GivenEventCategory(t)
	start := time.Now().UTC().Add(24 * time.Hour)
	result, err := harness.Service.CreateEvent(context.Background(), host.ID, eventapp.CreateEventInput{
		Title:        "open_ended_complete_" + uuid.NewString()[:8],
		Description:  common.StringPtr("no end time"),
		CategoryID:   &categoryID,
		LocationType: domain.LocationPoint,
		Lat:          common.Float64Ptr(41.0),
		Lon:          common.Float64Ptr(29.0),
		StartTime:    start,
		PrivacyLevel: domain.PrivacyPublic,
	})
	if err != nil {
		t.Fatalf("CreateEvent() error = %v", err)
	}
	eventID, err := uuid.Parse(result.ID)
	if err != nil {
		t.Fatalf("uuid.Parse() error = %v", err)
	}
	if result.EndTime != nil {
		t.Fatal("expected nil end_time for open-ended fixture")
	}

	if err := harness.Service.CompleteEvent(context.Background(), host.ID, eventID); err != nil {
		t.Fatalf("CompleteEvent() error = %v", err)
	}

	event, err := harness.EventRepo.GetEventByID(context.Background(), eventID)
	if err != nil {
		t.Fatalf("GetEventByID() error = %v", err)
	}
	if event.Status != domain.EventStatusCompleted {
		t.Fatalf("expected status %q, got %q", domain.EventStatusCompleted, event.Status)
	}
}

func TestCompleteEventForbiddenForNonHost(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	other := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	err := harness.Service.CompleteEvent(context.Background(), other.ID, ref.ID)
	if err == nil {
		t.Fatal("expected forbidden error, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Status != 403 {
		t.Fatalf("expected 403 AppError, got %v", err)
	}
}

func TestCompleteEventReturnsConflictForCanceledOrCompleted(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	if err := harness.Service.CancelEvent(context.Background(), host.ID, ref.ID); err != nil {
		t.Fatalf("CancelEvent() error = %v", err)
	}
	err := harness.Service.CompleteEvent(context.Background(), host.ID, ref.ID)
	if err == nil {
		t.Fatal("expected conflict error, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Status != 409 {
		t.Fatalf("expected 409 AppError, got %v", err)
	}

	ref2 := common.GivenPublicEvent(t, harness.Service, host.ID)
	if err := harness.Service.CompleteEvent(context.Background(), host.ID, ref2.ID); err != nil {
		t.Fatalf("first CompleteEvent() error = %v", err)
	}
	err = harness.Service.CompleteEvent(context.Background(), host.ID, ref2.ID)
	if err == nil {
		t.Fatal("expected second complete to fail")
	}
	if !errors.As(err, &appErr) || appErr.Status != 409 {
		t.Fatalf("expected 409 AppError on second complete, got %v", err)
	}
}

func TestCancelEventAppearsInParticipantProfile(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	if _, err := harness.Service.JoinEvent(context.Background(), participant.ID, ref.ID); err != nil {
		t.Fatalf("JoinEvent() error = %v", err)
	}

	// when
	if err := harness.Service.CancelEvent(context.Background(), host.ID, ref.ID); err != nil {
		t.Fatalf("CancelEvent() error = %v", err)
	}

	// then — canceled event must appear in the participant's canceled events list
	canceledEvents, err := harness.ProfileService.GetMyCanceledEvents(context.Background(), participant.ID)
	if err != nil {
		t.Fatalf("GetMyCanceledEvents() error = %v", err)
	}

	var found bool
	for _, e := range canceledEvents {
		if e.ID == ref.ID.String() {
			found = true
			if e.Status != string(domain.EventStatusCanceled) {
				t.Fatalf("expected event status %q, got %q", domain.EventStatusCanceled, e.Status)
			}
			break
		}
	}
	if !found {
		t.Fatalf("canceled event %s not found in participant's canceled_events", ref.ID)
	}
}

func TestJoinEventRejectsCanceledEvent(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	joiner := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	if err := harness.Service.CancelEvent(context.Background(), host.ID, ref.ID); err != nil {
		t.Fatalf("CancelEvent() error = %v", err)
	}

	_, err := harness.Service.JoinEvent(context.Background(), joiner.ID, ref.ID)

	if err == nil {
		t.Fatal("expected error joining canceled event, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.ErrorCodeEventNotJoinable {
		t.Fatalf("expected %q, got %v", domain.ErrorCodeEventNotJoinable, err)
	}
}

func TestRequestJoinRejectsCanceledEvent(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	requester := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenProtectedEvent(t, harness.Service, host.ID)

	if err := harness.Service.CancelEvent(context.Background(), host.ID, ref.ID); err != nil {
		t.Fatalf("CancelEvent() error = %v", err)
	}

	_, err := harness.Service.RequestJoin(context.Background(), requester.ID, ref.ID, eventapp.RequestJoinInput{})

	if err == nil {
		t.Fatal("expected error requesting join on canceled event, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.ErrorCodeEventNotJoinable {
		t.Fatalf("expected %q, got %v", domain.ErrorCodeEventNotJoinable, err)
	}
}

func TestGetEventDetailShowsCanceledParticipationStatus(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	if _, err := harness.Service.JoinEvent(context.Background(), participant.ID, ref.ID); err != nil {
		t.Fatalf("JoinEvent() error = %v", err)
	}
	if err := harness.Service.CancelEvent(context.Background(), host.ID, ref.ID); err != nil {
		t.Fatalf("CancelEvent() error = %v", err)
	}

	detail, err := harness.Service.GetEventDetail(context.Background(), participant.ID, ref.ID)
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}

	if detail.ViewerContext.ParticipationStatus != string(domain.EventDetailParticipationStatusCanceled) {
		t.Fatalf("expected participation_status %q, got %q",
			domain.EventDetailParticipationStatusCanceled, detail.ViewerContext.ParticipationStatus)
	}
	if detail.Status != string(domain.EventStatusCanceled) {
		t.Fatalf("expected event status %q, got %q", domain.EventStatusCanceled, detail.Status)
	}
}

func TestCancelEventAppearsInHostProfile(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	if err := harness.Service.CancelEvent(context.Background(), host.ID, ref.ID); err != nil {
		t.Fatalf("CancelEvent() error = %v", err)
	}

	canceledEvents, err := harness.ProfileService.GetMyCanceledEvents(context.Background(), host.ID)
	if err != nil {
		t.Fatalf("GetMyCanceledEvents() error = %v", err)
	}

	var found bool
	for _, e := range canceledEvents {
		if e.ID == ref.ID.String() {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("canceled event %s not found in host's canceled_events", ref.ID)
	}
}

func TestGetMyHostedEventsReturnsCreatedEvents(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	other := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)
	_ = common.GivenPublicEvent(t, harness.Service, other.ID) // another host's event

	events, err := harness.ProfileService.GetMyHostedEvents(context.Background(), host.ID)
	if err != nil {
		t.Fatalf("GetMyHostedEvents() error = %v", err)
	}

	var found bool
	for _, e := range events {
		if e.ID == ref.ID.String() {
			found = true
		}
		// must not include other host's events
		if e.ID != ref.ID.String() {
			t.Fatalf("unexpected event %s in hosted events", e.ID)
		}
	}
	if !found {
		t.Fatalf("event %s not found in hosted events", ref.ID)
	}
}

func TestGetMyUpcomingEventsReturnsApprovedActiveEvents(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	if _, err := harness.Service.JoinEvent(context.Background(), participant.ID, ref.ID); err != nil {
		t.Fatalf("JoinEvent() error = %v", err)
	}

	events, err := harness.ProfileService.GetMyUpcomingEvents(context.Background(), participant.ID)
	if err != nil {
		t.Fatalf("GetMyUpcomingEvents() error = %v", err)
	}

	var found bool
	for _, e := range events {
		if e.ID == ref.ID.String() {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("event %s not found in upcoming events", ref.ID)
	}
}

func TestGetMyUpcomingEventsExcludesCanceledEvent(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	if _, err := harness.Service.JoinEvent(context.Background(), participant.ID, ref.ID); err != nil {
		t.Fatalf("JoinEvent() error = %v", err)
	}
	if err := harness.Service.CancelEvent(context.Background(), host.ID, ref.ID); err != nil {
		t.Fatalf("CancelEvent() error = %v", err)
	}

	events, err := harness.ProfileService.GetMyUpcomingEvents(context.Background(), participant.ID)
	if err != nil {
		t.Fatalf("GetMyUpcomingEvents() error = %v", err)
	}

	for _, e := range events {
		if e.ID == ref.ID.String() {
			t.Fatalf("canceled event %s should not appear in upcoming events", ref.ID)
		}
	}
}

func TestGetMyCompletedEventsIncludesLeavedParticipationAfterStart(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	eventID := common.GivenStartedEvent(t, host.ID)

	if _, err := harness.Service.JoinEvent(context.Background(), participant.ID, eventID); err != nil {
		t.Fatalf("JoinEvent() error = %v", err)
	}
	if _, err := harness.Service.LeaveEvent(context.Background(), participant.ID, eventID); err != nil {
		t.Fatalf("LeaveEvent() error = %v", err)
	}
	updateEventStatus(t, eventID, string(domain.EventStatusCompleted))

	events, err := harness.ProfileService.GetMyCompletedEvents(context.Background(), participant.ID)
	if err != nil {
		t.Fatalf("GetMyCompletedEvents() error = %v", err)
	}

	var found bool
	for _, e := range events {
		if e.ID == eventID.String() {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("completed event %s not found for participant who left after start", eventID)
	}
}

func TestGetMyCompletedEventsExcludesLeavedParticipationBeforeStart(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo)
	participant := common.GivenUser(t, harness.AuthRepo)
	eventID := common.GivenExpiredEvent(t, host.ID)
	updateEventStatus(t, eventID, string(domain.EventStatusCompleted))

	startTime := loadEventStartTime(t, eventID)
	insertParticipationWithTimes(
		t,
		eventID,
		participant.ID,
		domain.ParticipationStatusLeaved,
		startTime.Add(-2*time.Hour),
		startTime.Add(-30*time.Minute),
	)

	events, err := harness.ProfileService.GetMyCompletedEvents(context.Background(), participant.ID)
	if err != nil {
		t.Fatalf("GetMyCompletedEvents() error = %v", err)
	}

	for _, e := range events {
		if e.ID == eventID.String() {
			t.Fatalf("completed event %s should be excluded after leaving before start", eventID)
		}
	}
}

func TestAddAndRemoveFavorite(t *testing.T) {
	t.Parallel()

	harness := common.NewEventHarness(t)
	user := common.GivenUser(t, harness.AuthRepo)
	host := common.GivenUser(t, harness.AuthRepo)
	ref := common.GivenPublicEvent(t, harness.Service, host.ID)

	// when: add favorite
	err := harness.EventRepo.AddFavorite(context.Background(), user.ID, ref.ID)
	if err != nil {
		t.Fatalf("AddFavorite() error = %v", err)
	}

	// then: appears in favorites list
	favs, err := harness.EventRepo.ListFavoriteEvents(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("ListFavoriteEvents() error = %v", err)
	}
	if len(favs) != 1 || favs[0].ID != ref.ID {
		t.Fatalf("expected 1 favorite with ID %s, got %d items", ref.ID, len(favs))
	}

	// when: add again (idempotent)
	err = harness.EventRepo.AddFavorite(context.Background(), user.ID, ref.ID)
	if err != nil {
		t.Fatalf("AddFavorite() duplicate error = %v", err)
	}

	// when: remove favorite
	err = harness.EventRepo.RemoveFavorite(context.Background(), user.ID, ref.ID)
	if err != nil {
		t.Fatalf("RemoveFavorite() error = %v", err)
	}

	// then: no longer in favorites
	favs, err = harness.EventRepo.ListFavoriteEvents(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("ListFavoriteEvents() after remove error = %v", err)
	}
	if len(favs) != 0 {
		t.Fatalf("expected 0 favorites after remove, got %d", len(favs))
	}
}
