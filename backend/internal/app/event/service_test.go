package event

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// fakeEventRepo is an in-memory implementation of domain.EventRepository.
type fakeEventRepo struct {
	err error
}

func (r *fakeEventRepo) CreateEvent(_ context.Context, params domain.CreateEventParams) (*domain.Event, error) {
	if r.err != nil {
		return nil, r.err
	}
	locationType := params.LocationType
	now := time.Now().UTC()
	return &domain.Event{
		ID:           uuid.New(),
		HostID:       params.HostID,
		Title:        params.Title,
		PrivacyLevel: params.PrivacyLevel,
		Status:       domain.EventStatusActive,
		StartTime:    params.StartTime,
		EndTime:      params.EndTime,
		LocationType: &locationType,
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

func newTestEventService() (*Service, *fakeEventRepo) {
	repo := &fakeEventRepo{}
	return NewService(repo), repo
}

func validInput() CreateEventInput {
	start := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	lat := 41.0082
	lon := 28.9784
	categoryID := 3
	return CreateEventInput{
		Title:        "Test Event",
		Description:  stringPtr("A test description"),
		CategoryID:   &categoryID,
		PrivacyLevel: string(domain.PrivacyPublic),
		LocationType: string(domain.LocationPoint),
		Lat:          &lat,
		Lon:          &lon,
		StartTime:    start,
	}
}

func assertValidationDetail(t *testing.T, err error, field string) {
	t.Helper()
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T: %v", err, err)
	}
	if appErr.Code != domain.ErrorCodeValidation {
		t.Fatalf("expected error code %q, got %q", domain.ErrorCodeValidation, appErr.Code)
	}
	if appErr.Details[field] == "" {
		t.Fatalf("expected validation detail for field %q, details: %v", field, appErr.Details)
	}
}

func TestCreateEventSuccessReturnsID(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()

	// when
	result, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	if err != nil {
		t.Fatalf("CreateEvent() error = %v", err)
	}
	if result.ID == "" {
		t.Fatal("expected non-empty event ID")
	}
	if result.Status != string(domain.EventStatusActive) {
		t.Fatalf("expected status %q, got %q", domain.EventStatusActive, result.Status)
	}
}

func TestCreateEventWithEndTime(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	end := time.Now().UTC().Add(2 * time.Hour).Format(time.RFC3339)
	input.EndTime = &end

	// when
	result, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	if err != nil {
		t.Fatalf("CreateEvent() error = %v", err)
	}
	if result.EndTime == nil {
		t.Fatal("expected non-nil end_time")
	}
}

func TestCreateEventValidationEmptyTitle(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.Title = ""

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "title")
}

func TestCreateEventValidationInvalidPrivacyLevel(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.PrivacyLevel = "secret"

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "privacy_level")
}

func TestCreateEventValidationInvalidLocationType(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.LocationType = "spaceship"
	input.Lat = nil
	input.Lon = nil

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "location_type")
}

func TestCreateEventValidationInvalidStartTime(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.StartTime = "not-a-date"

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "start_time")
}

func TestCreateEventValidationEndTimeBeforeStartTime(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	end := time.Now().UTC().Add(-time.Hour).Format(time.RFC3339)
	input.EndTime = &end

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "end_time")
}

func TestCreateEventValidationEndTimeEqualToStartTime(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	now := time.Now().UTC().Add(time.Hour).Format(time.RFC3339)
	input := validInput()
	input.StartTime = now
	input.EndTime = &now

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "end_time")
}

func TestCreateEventValidationTooManyTags(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.Tags = []string{"a", "b", "c", "d", "e", "f"}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "tags")
}

func TestCreateEventValidationEmptyTag(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.Tags = []string{"valid", ""}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "tags")
}

func TestCreateEventValidationTagTooLong(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.Tags = []string{"this-tag-is-way-too-long-to-be-valid"}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "tags")
}

func TestCreateEventValidationInvalidGender(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	gender := "unknown"
	input.PreferredGender = &gender

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "preferred_gender")
}

func TestCreateEventValidationNegativeCapacity(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	cap := -1
	input.Capacity = &cap

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "capacity")
}

func TestCreateEventValidationZeroCapacity(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	cap := 0
	input.Capacity = &cap

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "capacity")
}

func TestCreateEventValidationInvalidMinimumAge(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	age := 200
	input.MinimumAge = &age

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "minimum_age")
}

func TestCreateEventValidationConstraintMissingType(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.Constraints = []ConstraintInput{{Type: "", Info: "some info"}}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "constraints[0].type")
}

func TestCreateEventValidationConstraintMissingInfo(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.Constraints = []ConstraintInput{{Type: "equipment", Info: ""}}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "constraints[0].info")
}

func TestCreateEventValidationMissingDescription(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.Description = nil

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "description")
}

func TestCreateEventValidationMissingCategoryID(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.CategoryID = nil

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "category_id")
}

func TestCreateEventValidationPointRequiresCoordinates(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.Lat = nil
	input.Lon = nil

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "lat")
	assertValidationDetail(t, err, "lon")
}

func TestCreateEventValidationRouteRequiresRoutePoints(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.LocationType = string(domain.LocationRoute)
	input.Lat = nil
	input.Lon = nil
	input.RoutePoints = nil

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "route_points")
}

func TestCreateEventValidationRoutePointMissingLatitude(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.LocationType = string(domain.LocationRoute)
	input.Lat = nil
	input.Lon = nil
	input.RoutePoints = []RoutePointInput{
		{Lat: nil, Lon: floatPtr(29.0)},
		{Lat: floatPtr(41.1), Lon: floatPtr(29.1)},
	}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "route_points[0].lat")
}

func TestCreateEventValidationTooManyConstraints(t *testing.T) {
	// given
	svc, _ := newTestEventService()
	input := validInput()
	input.Constraints = []ConstraintInput{
		{Type: "a", Info: "1"},
		{Type: "b", Info: "2"},
		{Type: "c", Info: "3"},
		{Type: "d", Info: "4"},
		{Type: "e", Info: "5"},
		{Type: "f", Info: "6"},
	}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "constraints")
}

func TestCreateEventRepoErrorPropagates(t *testing.T) {
	// given
	svc, repo := newTestEventService()
	repo.err = errors.New("database down")
	input := validInput()

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	if err == nil {
		t.Fatal("expected error from repo, got nil")
	}
}

func stringPtr(v string) *string { return &v }

func floatPtr(v float64) *float64 { return &v }
