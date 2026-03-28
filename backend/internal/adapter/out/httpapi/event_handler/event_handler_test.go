package event_handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type stubEventService struct {
	result               *event.CreateEventResult
	discoverResult       *event.DiscoverEventsResult
	detailResult         *event.GetEventDetailResult
	err                  error
	callCount            int
	discoverCallCount    int
	detailCallCount      int
	requestJoinCallCount int
	lastInput            event.CreateEventInput
	lastDiscoverInput    event.DiscoverEventsInput
	lastDetailEventID    uuid.UUID
	lastRequestJoinInput event.RequestJoinInput
}

func (s *stubEventService) CreateEvent(_ context.Context, _ uuid.UUID, input event.CreateEventInput) (*event.CreateEventResult, error) {
	s.callCount++
	s.lastInput = input
	if s.err != nil {
		return nil, s.err
	}
	if s.result != nil {
		return s.result, nil
	}
	now := time.Now().UTC()
	return &event.CreateEventResult{
		ID:           uuid.New().String(),
		Title:        "Test Event",
		PrivacyLevel: string(domain.PrivacyPublic),
		Status:       string(domain.EventStatusActive),
		StartTime:    now.Add(time.Hour),
		CreatedAt:    now,
	}, nil
}

func (s *stubEventService) DiscoverEvents(_ context.Context, _ uuid.UUID, input event.DiscoverEventsInput) (*event.DiscoverEventsResult, error) {
	s.discoverCallCount++
	s.lastDiscoverInput = input
	if s.err != nil {
		return nil, s.err
	}
	if s.discoverResult != nil {
		return s.discoverResult, nil
	}
	return &event.DiscoverEventsResult{
		Items: []event.DiscoverableEventItem{},
		PageInfo: event.DiscoverEventsPageInfo{
			HasNext: false,
		},
	}, nil
}

func (s *stubEventService) GetEventDetail(_ context.Context, _, eventID uuid.UUID) (*event.GetEventDetailResult, error) {
	s.detailCallCount++
	s.lastDetailEventID = eventID
	if s.err != nil {
		return nil, s.err
	}
	if s.detailResult != nil {
		return s.detailResult, nil
	}
	return &event.GetEventDetailResult{
		ID:           eventID.String(),
		Title:        "Detailed Event",
		PrivacyLevel: string(domain.PrivacyPublic),
		Status:       string(domain.EventStatusActive),
		StartTime:    time.Now().UTC(),
		Host: event.EventDetailPerson{
			ID:       uuid.NewString(),
			Username: "host_user",
		},
		Location: event.EventDetailLocation{
			Type: string(domain.LocationPoint),
			Point: &event.EventDetailPoint{
				Lat: 41,
				Lon: 29,
			},
		},
		Tags:        []string{},
		Constraints: []event.EventDetailConstraint{},
		ViewerContext: event.EventDetailViewerContext{
			IsHost:              false,
			IsFavorited:         false,
			ParticipationStatus: string(domain.EventDetailParticipationStatusNone),
		},
	}, nil
}

func (s *stubEventService) JoinEvent(_ context.Context, _, eventID uuid.UUID) (*event.JoinEventResult, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &event.JoinEventResult{
		ParticipationID: uuid.New().String(),
		EventID:         eventID.String(),
		Status:          domain.ParticipationStatusApproved,
		CreatedAt:       time.Now().UTC(),
	}, nil
}

func (s *stubEventService) RequestJoin(_ context.Context, _, eventID uuid.UUID, input event.RequestJoinInput) (*event.RequestJoinResult, error) {
	s.requestJoinCallCount++
	s.lastRequestJoinInput = input
	if s.err != nil {
		return nil, s.err
	}
	return &event.RequestJoinResult{
		JoinRequestID: uuid.New().String(),
		EventID:       eventID.String(),
		Status:        domain.ParticipationStatusPending,
		CreatedAt:     time.Now().UTC(),
	}, nil
}

// fakeVerifier implements domain.TokenVerifier for tests in this package.
type fakeVerifier struct {
	claims *domain.AuthClaims
	err    error
}

func (f *fakeVerifier) VerifyAccessToken(_ string) (*domain.AuthClaims, error) {
	return f.claims, f.err
}

func newEventTestApp(service event.UseCase, verifier domain.TokenVerifier) *fiber.App {
	app := fiber.New()
	handler := NewEventHandler(service)
	RegisterEventRoutes(app, handler, httpapi.RequireAuth(verifier))
	return app
}

func validEventBody() string {
	start := time.Date(2030, time.January, 1, 20, 0, 0, 0, time.FixedZone("UTC+3", 3*60*60)).Format(time.RFC3339)
	return `{"title":"Test Event","description":"A test description","category_id":3,"privacy_level":"PUBLIC","location_type":"POINT","start_time":"` + start + `","lat":41.0,"lon":29.0}`
}

func authedVerifier() *fakeVerifier {
	return &fakeVerifier{
		claims: &domain.AuthClaims{
			UserID:   uuid.New(),
			Username: "testuser",
			Email:    "test@example.com",
		},
	}
}

func TestDiscoverEventsParsesQueryParamsBeforeCallingService(t *testing.T) {
	// given
	svc := &stubEventService{}
	app := newEventTestApp(svc, authedVerifier())
	startFrom := url.QueryEscape("2030-01-01T10:00:00+03:00")
	startTo := url.QueryEscape("2030-01-02T10:00:00+03:00")

	req := httptest.NewRequest(
		fiber.MethodGet,
		"/events/?lat=41.01&lon=29.02&radius_meters=9000&q=trail&privacy_levels=PUBLIC,PROTECTED&category_ids=1,3&tag_names=hiking,outdoor&start_from="+startFrom+"&start_to="+startTo+"&only_favorited=true&sort_by=DISTANCE&limit=15&cursor=test-cursor",
		nil,
	)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}
	if svc.discoverCallCount != 1 {
		t.Fatalf("expected discover service to be called once, got %d", svc.discoverCallCount)
	}
	if svc.lastDiscoverInput.Lat == nil || *svc.lastDiscoverInput.Lat != 41.01 {
		t.Fatalf("expected parsed lat 41.01, got %v", svc.lastDiscoverInput.Lat)
	}
	if svc.lastDiscoverInput.Lon == nil || *svc.lastDiscoverInput.Lon != 29.02 {
		t.Fatalf("expected parsed lon 29.02, got %v", svc.lastDiscoverInput.Lon)
	}
	if svc.lastDiscoverInput.RadiusMeters == nil || *svc.lastDiscoverInput.RadiusMeters != 9000 {
		t.Fatalf("expected parsed radius 9000, got %v", svc.lastDiscoverInput.RadiusMeters)
	}
	if svc.lastDiscoverInput.Query == nil || *svc.lastDiscoverInput.Query != "trail" {
		t.Fatalf("expected parsed q %q, got %v", "trail", svc.lastDiscoverInput.Query)
	}
	if len(svc.lastDiscoverInput.PrivacyLevels) != 2 ||
		svc.lastDiscoverInput.PrivacyLevels[0] != domain.PrivacyPublic ||
		svc.lastDiscoverInput.PrivacyLevels[1] != domain.PrivacyProtected {
		t.Fatalf("expected parsed privacy_levels [PUBLIC PROTECTED], got %v", svc.lastDiscoverInput.PrivacyLevels)
	}
	if len(svc.lastDiscoverInput.CategoryIDs) != 2 || svc.lastDiscoverInput.CategoryIDs[0] != 1 || svc.lastDiscoverInput.CategoryIDs[1] != 3 {
		t.Fatalf("expected parsed category_ids [1 3], got %v", svc.lastDiscoverInput.CategoryIDs)
	}
	if len(svc.lastDiscoverInput.TagNames) != 2 || svc.lastDiscoverInput.TagNames[0] != "hiking" || svc.lastDiscoverInput.TagNames[1] != "outdoor" {
		t.Fatalf("expected parsed tag_names [hiking outdoor], got %v", svc.lastDiscoverInput.TagNames)
	}
	if svc.lastDiscoverInput.StartFrom == nil || svc.lastDiscoverInput.StartTo == nil {
		t.Fatal("expected parsed start_from and start_to")
	}
	if !svc.lastDiscoverInput.OnlyFavorited {
		t.Fatal("expected only_favorited to be true")
	}
	if svc.lastDiscoverInput.SortBy == nil || *svc.lastDiscoverInput.SortBy != domain.EventDiscoverySortDistance {
		t.Fatalf("expected parsed sort_by %q, got %v", domain.EventDiscoverySortDistance, svc.lastDiscoverInput.SortBy)
	}
	if svc.lastDiscoverInput.Limit == nil || *svc.lastDiscoverInput.Limit != 15 {
		t.Fatalf("expected parsed limit 15, got %v", svc.lastDiscoverInput.Limit)
	}
	if svc.lastDiscoverInput.Cursor == nil || *svc.lastDiscoverInput.Cursor != "test-cursor" {
		t.Fatalf("expected parsed cursor %q, got %v", "test-cursor", svc.lastDiscoverInput.Cursor)
	}
}

func TestDiscoverEventsInvalidLatitudeReturns400(t *testing.T) {
	// given
	svc := &stubEventService{}
	app := newEventTestApp(svc, authedVerifier())

	req := httptest.NewRequest(fiber.MethodGet, "/events/?lat=not-a-number&lon=29.02", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
	if svc.discoverCallCount != 0 {
		t.Fatalf("expected discover service not to be called, got %d", svc.discoverCallCount)
	}
}

func TestDiscoverEventsInvalidSortReturns400(t *testing.T) {
	// given
	svc := &stubEventService{}
	app := newEventTestApp(svc, authedVerifier())

	req := httptest.NewRequest(fiber.MethodGet, "/events/?lat=41.01&lon=29.02&sort_by=POPULAR", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
	if svc.discoverCallCount != 0 {
		t.Fatalf("expected discover service not to be called, got %d", svc.discoverCallCount)
	}
}

func TestDiscoverEventsIgnoresEmptyOptionalListParams(t *testing.T) {
	// given
	svc := &stubEventService{}
	app := newEventTestApp(svc, authedVerifier())

	req := httptest.NewRequest(
		fiber.MethodGet,
		"/events/?lat=41.01&lon=29.02&privacy_levels=&category_ids=&tag_names=",
		nil,
	)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}
	if svc.discoverCallCount != 1 {
		t.Fatalf("expected discover service to be called once, got %d", svc.discoverCallCount)
	}
	if len(svc.lastDiscoverInput.PrivacyLevels) != 0 {
		t.Fatalf("expected empty privacy_levels, got %v", svc.lastDiscoverInput.PrivacyLevels)
	}
	if len(svc.lastDiscoverInput.CategoryIDs) != 0 {
		t.Fatalf("expected empty category_ids, got %v", svc.lastDiscoverInput.CategoryIDs)
	}
	if len(svc.lastDiscoverInput.TagNames) != 0 {
		t.Fatalf("expected empty tag_names, got %v", svc.lastDiscoverInput.TagNames)
	}
}

func TestGetEventDetailReturns200(t *testing.T) {
	// given
	svc := &stubEventService{}
	app := newEventTestApp(svc, authedVerifier())
	eventID := uuid.New()

	req := httptest.NewRequest(fiber.MethodGet, "/events/"+eventID.String(), nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}
	if svc.detailCallCount != 1 {
		t.Fatalf("expected detail service to be called once, got %d", svc.detailCallCount)
	}
	if svc.lastDetailEventID != eventID {
		t.Fatalf("expected detail service to receive event %s, got %s", eventID, svc.lastDetailEventID)
	}

	var body event.GetEventDetailResult
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body.ID != eventID.String() {
		t.Fatalf("expected response id %s, got %s", eventID, body.ID)
	}
}

func TestGetEventDetailInvalidIDReturns400(t *testing.T) {
	// given
	svc := &stubEventService{}
	app := newEventTestApp(svc, authedVerifier())

	req := httptest.NewRequest(fiber.MethodGet, "/events/not-a-uuid", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
	if svc.detailCallCount != 0 {
		t.Fatalf("expected detail service not to be called, got %d", svc.detailCallCount)
	}
}

func TestGetEventDetailWithoutAuthReturns401(t *testing.T) {
	// given
	app := newEventTestApp(&stubEventService{}, &fakeVerifier{err: fiber.ErrUnauthorized})
	eventID := uuid.New()

	req := httptest.NewRequest(fiber.MethodGet, "/events/"+eventID.String(), nil)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", fiber.StatusUnauthorized, resp.StatusCode)
	}
}

func TestCreateEventReturns201(t *testing.T) {
	// given
	svc := &stubEventService{}
	app := newEventTestApp(svc, authedVerifier())

	req := httptest.NewRequest(fiber.MethodPost, "/events/", bytes.NewBufferString(validEventBody()))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected status %d, got %d", fiber.StatusCreated, resp.StatusCode)
	}

	var body event.CreateEventResult
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body.ID == "" {
		t.Fatal("expected non-empty event ID in response")
	}
	if svc.callCount != 1 {
		t.Fatalf("expected service to be called once, got %d", svc.callCount)
	}
}

func TestCreateEventWithoutAuthReturns401(t *testing.T) {
	// given
	app := newEventTestApp(&stubEventService{}, &fakeVerifier{err: fiber.ErrUnauthorized})

	req := httptest.NewRequest(fiber.MethodPost, "/events/", bytes.NewBufferString(validEventBody()))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	// no Authorization header

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", fiber.StatusUnauthorized, resp.StatusCode)
	}
}

func TestCreateEventValidationErrorReturns400(t *testing.T) {
	// given
	svc := &stubEventService{
		err: domain.ValidationError(map[string]string{"description": "description is required"}),
	}
	app := newEventTestApp(svc, authedVerifier())

	req := httptest.NewRequest(fiber.MethodPost, "/events/", bytes.NewBufferString(`{"title":"Test Event","category_id":3,"privacy_level":"PUBLIC","location_type":"POINT","start_time":"2030-01-01T00:00:00+03:00","lat":41.0,"lon":29.0}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}

	var body struct {
		Error struct {
			Code    string            `json:"code"`
			Details map[string]string `json:"details"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body.Error.Code != domain.ErrorCodeValidation {
		t.Fatalf("expected error code %q, got %q", domain.ErrorCodeValidation, body.Error.Code)
	}
	if body.Error.Details["description"] == "" {
		t.Fatalf("expected validation details, got %v", body.Error.Details)
	}
}

func TestCreateEventInvalidJSONReturns400(t *testing.T) {
	// given
	app := newEventTestApp(&stubEventService{}, authedVerifier())

	req := httptest.NewRequest(fiber.MethodPost, "/events/", bytes.NewBufferString(`not json`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

func TestCreateEventParsesTypedFieldsBeforeCallingService(t *testing.T) {
	// given
	svc := &stubEventService{}
	app := newEventTestApp(svc, authedVerifier())
	end := "2030-01-01T21:00:00+03:00"
	body := `{"title":"Typed Event","description":"A test description","category_id":3,"privacy_level":"PUBLIC","location_type":"POINT","start_time":"2030-01-01T20:00:00+03:00","end_time":"` + end + `","preferred_gender":"OTHER","lat":41.0,"lon":29.0}`

	req := httptest.NewRequest(fiber.MethodPost, "/events/", bytes.NewBufferString(body))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected status %d, got %d", fiber.StatusCreated, resp.StatusCode)
	}
	if svc.lastInput.PrivacyLevel != domain.PrivacyPublic {
		t.Fatalf("expected privacy level %q, got %q", domain.PrivacyPublic, svc.lastInput.PrivacyLevel)
	}
	if svc.lastInput.LocationType != domain.LocationPoint {
		t.Fatalf("expected location type %q, got %q", domain.LocationPoint, svc.lastInput.LocationType)
	}
	if svc.lastInput.StartTime.IsZero() {
		t.Fatal("expected parsed start time")
	}
	if svc.lastInput.EndTime == nil {
		t.Fatal("expected parsed end time")
	}
	if svc.lastInput.PreferredGender == nil || *svc.lastInput.PreferredGender != domain.GenderOther {
		t.Fatalf("expected preferred gender %q, got %v", domain.GenderOther, svc.lastInput.PreferredGender)
	}
}

func TestCreateEventInvalidStartTimeReturns400(t *testing.T) {
	// given
	svc := &stubEventService{}
	app := newEventTestApp(svc, authedVerifier())

	req := httptest.NewRequest(fiber.MethodPost, "/events/", bytes.NewBufferString(`{"title":"Test Event","description":"A test description","category_id":3,"privacy_level":"PUBLIC","location_type":"POINT","start_time":"not-a-date","lat":41.0,"lon":29.0}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
	if svc.callCount != 0 {
		t.Fatalf("expected service not to be called, got %d calls", svc.callCount)
	}
}

func TestJoinEventInvalidIDReturns400(t *testing.T) {
	// given
	app := newEventTestApp(&stubEventService{}, authedVerifier())

	req := httptest.NewRequest(fiber.MethodPost, "/events/not-a-uuid/join", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

func TestRequestJoinInvalidIDReturns400(t *testing.T) {
	// given
	app := newEventTestApp(&stubEventService{}, authedVerifier())

	req := httptest.NewRequest(fiber.MethodPost, "/events/not-a-uuid/join-request", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

func TestRequestJoinParsesMessageBeforeCallingService(t *testing.T) {
	// given
	svc := &stubEventService{}
	app := newEventTestApp(svc, authedVerifier())
	eventID := uuid.New()
	message := "I can bring equipment if needed."

	req := httptest.NewRequest(fiber.MethodPost, "/events/"+eventID.String()+"/join-request", bytes.NewBufferString(`{"message":"`+message+`"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected status %d, got %d", fiber.StatusCreated, resp.StatusCode)
	}
	if svc.requestJoinCallCount != 1 {
		t.Fatalf("expected request join service to be called once, got %d", svc.requestJoinCallCount)
	}
	if svc.lastRequestJoinInput.Message == nil || *svc.lastRequestJoinInput.Message != message {
		t.Fatalf("expected parsed message %q, got %v", message, svc.lastRequestJoinInput.Message)
	}
}
