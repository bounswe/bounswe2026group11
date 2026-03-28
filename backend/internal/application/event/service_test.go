package event

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/join_request"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// fakeEventRepo is an in-memory implementation of Repository.
type fakeEventRepo struct {
	err    error
	events map[uuid.UUID]*domain.Event
}

func (r *fakeEventRepo) CreateEvent(_ context.Context, params CreateEventParams) (*domain.Event, error) {
	if r.err != nil {
		return nil, r.err
	}
	now := time.Now().UTC()
	return &domain.Event{
		ID:           uuid.New(),
		HostID:       params.HostID,
		Title:        params.Title,
		PrivacyLevel: params.PrivacyLevel,
		Status:       domain.EventStatusActive,
		StartTime:    params.StartTime,
		EndTime:      params.EndTime,
		LocationType: new(params.LocationType),
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

func (r *fakeEventRepo) GetEventByID(_ context.Context, id uuid.UUID) (*domain.Event, error) {
	if e, ok := r.events[id]; ok {
		return e, nil
	}
	return nil, domain.ErrNotFound
}

// fakeParticipationService is an in-memory implementation of ParticipationService.
type fakeParticipationService struct {
	err         error
	callCount   int
	lastEventID uuid.UUID
	lastUserID  uuid.UUID
}

func (s *fakeParticipationService) CreateApprovedParticipation(_ context.Context, eventID, userID uuid.UUID) (*domain.Participation, error) {
	s.callCount++
	s.lastEventID = eventID
	s.lastUserID = userID

	if s.err != nil {
		return nil, s.err
	}
	now := time.Now().UTC()
	return &domain.Participation{
		ID:        uuid.New(),
		EventID:   eventID,
		UserID:    userID,
		Status:    domain.ParticipationStatusApproved,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

// fakeJoinRequestService is an in-memory implementation of JoinRequestService.
type fakeJoinRequestService struct {
	err            error
	callCount      int
	lastEventID    uuid.UUID
	lastUserID     uuid.UUID
	lastHostUserID uuid.UUID
	lastInput      join_request.CreatePendingJoinRequestInput
}

func (s *fakeJoinRequestService) CreatePendingJoinRequest(
	_ context.Context,
	eventID, userID, hostUserID uuid.UUID,
	input join_request.CreatePendingJoinRequestInput,
) (*domain.JoinRequest, error) {
	s.callCount++
	s.lastEventID = eventID
	s.lastUserID = userID
	s.lastHostUserID = hostUserID
	s.lastInput = input

	if s.err != nil {
		return nil, s.err
	}
	now := time.Now().UTC()
	return &domain.JoinRequest{
		ID:         uuid.New(),
		EventID:    eventID,
		UserID:     userID,
		HostUserID: hostUserID,
		Status:     domain.ParticipationStatusPending,
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}

func newTestEventService() (*Service, *fakeEventRepo, *fakeParticipationService, *fakeJoinRequestService) {
	eventRepo := &fakeEventRepo{}
	participationService := &fakeParticipationService{}
	joinRequestService := &fakeJoinRequestService{}
	return NewService(eventRepo, participationService, joinRequestService), eventRepo, participationService, joinRequestService
}

func validInput() CreateEventInput {
	start := time.Now().UTC().Add(time.Hour)
	return CreateEventInput{
		Title:        "Test Event",
		Description:  stringPtr("A test description"),
		CategoryID:   new(3),
		PrivacyLevel: domain.PrivacyPublic,
		LocationType: domain.LocationPoint,
		Lat:          new(41.0082),
		Lon:          new(28.9784),
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
	svc, _, _, _ := newTestEventService()
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
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.EndTime = new(time.Now().UTC().Add(2 * time.Hour))

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
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Title = ""

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "title")
}

func TestCreateEventValidationInvalidPrivacyLevel(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.PrivacyLevel = domain.EventPrivacyLevel("secret")

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "privacy_level")
}

func TestCreateEventValidationInvalidLocationType(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.LocationType = domain.EventLocationType("spaceship")
	input.Lat = nil
	input.Lon = nil

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "location_type")
}

func TestCreateEventValidationMissingStartTime(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.StartTime = time.Time{}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "start_time")
}

func TestCreateEventValidationEndTimeBeforeStartTime(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.EndTime = new(input.StartTime.Add(-time.Hour))

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "end_time")
}

func TestCreateEventValidationEndTimeEqualToStartTime(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	now := time.Now().UTC().Add(time.Hour)
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
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Tags = []string{"a", "b", "c", "d", "e", "f"}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "tags")
}

func TestCreateEventValidationEmptyTag(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Tags = []string{"valid", ""}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "tags")
}

func TestCreateEventValidationTagTooLong(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Tags = []string{"this-tag-is-way-too-long-to-be-valid"}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "tags")
}

func TestCreateEventValidationInvalidGender(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.PreferredGender = new(domain.EventParticipantGender("unknown"))

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "preferred_gender")
}

func TestCreateEventValidationNegativeCapacity(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Capacity = new(-1)

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "capacity")
}

func TestCreateEventValidationZeroCapacity(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Capacity = new(0)

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "capacity")
}

func TestCreateEventValidationInvalidMinimumAge(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.MinimumAge = new(200)

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "minimum_age")
}

func TestCreateEventValidationConstraintMissingType(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Constraints = []ConstraintInput{{Type: "", Info: "some info"}}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "constraints[0].type")
}

func TestCreateEventValidationConstraintMissingInfo(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Constraints = []ConstraintInput{{Type: "equipment", Info: ""}}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "constraints[0].info")
}

func TestCreateEventValidationMissingDescription(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Description = nil

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "description")
}

func TestCreateEventValidationMissingCategoryID(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.CategoryID = nil

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "category_id")
}

func TestCreateEventValidationPointRequiresCoordinates(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
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
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.LocationType = domain.LocationRoute
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
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.LocationType = domain.LocationRoute
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
	svc, _, _, _ := newTestEventService()
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
	svc, eventRepo, _, _ := newTestEventService()
	eventRepo.err = errors.New("database down")
	input := validInput()

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	if err == nil {
		t.Fatal("expected error from repo, got nil")
	}
}

// newTestEventServiceWithEvent wires a service with a pre-loaded event in the fake repo.
func newTestEventServiceWithEvent(e *domain.Event) (*Service, *fakeEventRepo, *fakeParticipationService, *fakeJoinRequestService) {
	eventRepo := &fakeEventRepo{events: map[uuid.UUID]*domain.Event{e.ID: e}}
	participationService := &fakeParticipationService{}
	joinRequestService := &fakeJoinRequestService{}
	return NewService(eventRepo, participationService, joinRequestService), eventRepo, participationService, joinRequestService
}

func publicEvent(hostID uuid.UUID) *domain.Event {
	return &domain.Event{
		ID:           uuid.New(),
		HostID:       hostID,
		PrivacyLevel: domain.PrivacyPublic,
		Status:       domain.EventStatusActive,
	}
}

func publicEventWithCapacity(hostID uuid.UUID, capacity, approvedCount int) *domain.Event {
	return &domain.Event{
		ID:                       uuid.New(),
		HostID:                   hostID,
		PrivacyLevel:             domain.PrivacyPublic,
		Status:                   domain.EventStatusActive,
		Capacity:                 &capacity,
		ApprovedParticipantCount: approvedCount,
	}
}

func protectedEvent(hostID uuid.UUID) *domain.Event {
	return &domain.Event{
		ID:           uuid.New(),
		HostID:       hostID,
		PrivacyLevel: domain.PrivacyProtected,
		Status:       domain.EventStatusActive,
	}
}

func TestJoinEventSuccessReturnsApproved(t *testing.T) {
	hostID := uuid.New()
	joinerID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, participationService, _ := newTestEventServiceWithEvent(ev)

	result, err := svc.JoinEvent(context.Background(), joinerID, ev.ID)

	if err != nil {
		t.Fatalf("JoinEvent() error = %v", err)
	}
	if result.Status != domain.ParticipationStatusApproved {
		t.Fatalf("expected status APPROVED, got %q", result.Status)
	}
	if participationService.callCount != 1 {
		t.Fatalf("expected participation service to be called once")
	}
	if participationService.lastEventID != ev.ID || participationService.lastUserID != joinerID {
		t.Fatalf("expected participation service to receive event %s and user %s", ev.ID, joinerID)
	}
}

func TestJoinEventRejectsNonExistentEvent(t *testing.T) {
	svc, _, _, _ := newTestEventService()

	_, err := svc.JoinEvent(context.Background(), uuid.New(), uuid.New())

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeEventNotFound {
		t.Fatalf("expected event_not_found, got %v", err)
	}
}

func TestJoinEventRejectsHost(t *testing.T) {
	hostID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	_, err := svc.JoinEvent(context.Background(), hostID, ev.ID)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeHostCannotJoin {
		t.Fatalf("expected host_cannot_join, got %v", err)
	}
}

func TestJoinEventRejectsProtectedEvent(t *testing.T) {
	hostID := uuid.New()
	ev := protectedEvent(hostID)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	_, err := svc.JoinEvent(context.Background(), uuid.New(), ev.ID)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeEventJoinNotAllowed {
		t.Fatalf("expected event_join_not_allowed, got %v", err)
	}
}

func TestJoinEventRejectsFullCapacity(t *testing.T) {
	hostID := uuid.New()
	ev := publicEventWithCapacity(hostID, 10, 10)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	_, err := svc.JoinEvent(context.Background(), uuid.New(), ev.ID)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeCapacityExceeded {
		t.Fatalf("expected capacity_exceeded, got %v", err)
	}
}

func TestJoinEventAllowsWhenUnderCapacity(t *testing.T) {
	hostID := uuid.New()
	ev := publicEventWithCapacity(hostID, 10, 9)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	result, err := svc.JoinEvent(context.Background(), uuid.New(), ev.ID)

	if err != nil {
		t.Fatalf("JoinEvent() error = %v", err)
	}
	if result.Status != domain.ParticipationStatusApproved {
		t.Fatalf("expected status APPROVED, got %q", result.Status)
	}
}

func TestRequestJoinSuccessReturnsPending(t *testing.T) {
	hostID := uuid.New()
	requesterID := uuid.New()
	ev := protectedEvent(hostID)
	svc, _, _, joinRequestService := newTestEventServiceWithEvent(ev)
	message := "I would like to attend."

	result, err := svc.RequestJoin(context.Background(), requesterID, ev.ID, RequestJoinInput{
		Message: &message,
	})

	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}
	if result.Status != domain.ParticipationStatusPending {
		t.Fatalf("expected status PENDING, got %q", result.Status)
	}
	if joinRequestService.callCount != 1 {
		t.Fatalf("expected join request service to be called once")
	}
	if joinRequestService.lastEventID != ev.ID || joinRequestService.lastUserID != requesterID || joinRequestService.lastHostUserID != hostID {
		t.Fatalf("expected join request service to receive event %s, user %s, and host %s", ev.ID, requesterID, hostID)
	}
	if joinRequestService.lastInput.Message == nil || *joinRequestService.lastInput.Message != message {
		t.Fatalf("expected join request service to receive message %q, got %v", message, joinRequestService.lastInput.Message)
	}
}

func TestRequestJoinRejectsHost(t *testing.T) {
	hostID := uuid.New()
	ev := protectedEvent(hostID)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	_, err := svc.RequestJoin(context.Background(), hostID, ev.ID, RequestJoinInput{})

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeHostCannotJoin {
		t.Fatalf("expected host_cannot_join, got %v", err)
	}
}

func TestRequestJoinRejectsPublicEvent(t *testing.T) {
	hostID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	_, err := svc.RequestJoin(context.Background(), uuid.New(), ev.ID, RequestJoinInput{})

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeEventJoinNotAllowed {
		t.Fatalf("expected event_join_not_allowed, got %v", err)
	}
}

func stringPtr(v string) *string { return &v }

func floatPtr(v float64) *float64 { return &v }
