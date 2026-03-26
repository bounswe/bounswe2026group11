package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/app/event"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type stubEventService struct {
	result *event.CreateEventResult
	err    error
}

func (s *stubEventService) CreateEvent(_ context.Context, _ uuid.UUID, _ event.CreateEventInput) (*event.CreateEventResult, error) {
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

func newEventTestApp(service EventService, verifier domain.TokenVerifier) *fiber.App {
	app := fiber.New()
	handler := NewEventHandler(service)
	RegisterEventRoutes(app, handler, RequireAuth(verifier))
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
	app := newEventTestApp(&stubEventService{}, authedVerifier())

	req := httptest.NewRequest(fiber.MethodPost, "/events/", bytes.NewBufferString(validEventBody()))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
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
		t.Fatalf("app.Test() error = %v", err)
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
		t.Fatalf("app.Test() error = %v", err)
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
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}
