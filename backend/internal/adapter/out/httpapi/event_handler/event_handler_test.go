package event_handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
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
	err                  error
	callCount            int
	requestJoinCallCount int
	lastInput            event.CreateEventInput
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
