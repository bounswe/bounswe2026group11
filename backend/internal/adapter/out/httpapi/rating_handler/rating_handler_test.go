package rating_handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	ratingapp "github.com/bounswe/bounswe2026group11/backend/internal/application/rating"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type stubRatingService struct {
	upsertEventResult            *ratingapp.RatingResult
	upsertParticipantResult      *ratingapp.RatingResult
	err                          error
	upsertEventCallCount         int
	deleteEventCallCount         int
	upsertParticipantCallCount   int
	deleteParticipantCallCount   int
	lastUpsertEventInput         ratingapp.UpsertRatingInput
	lastUpsertEventID            uuid.UUID
	lastDeleteEventID            uuid.UUID
	lastUpsertParticipantInput   ratingapp.UpsertRatingInput
	lastUpsertParticipantEventID uuid.UUID
	lastUpsertParticipantUserID  uuid.UUID
	lastDeleteParticipantEventID uuid.UUID
	lastDeleteParticipantUserID  uuid.UUID
}

func (s *stubRatingService) UpsertEventRating(_ context.Context, _ uuid.UUID, eventID uuid.UUID, input ratingapp.UpsertRatingInput) (*ratingapp.RatingResult, error) {
	s.upsertEventCallCount++
	s.lastUpsertEventID = eventID
	s.lastUpsertEventInput = input
	if s.err != nil {
		return nil, s.err
	}
	if s.upsertEventResult != nil {
		return s.upsertEventResult, nil
	}
	return &ratingapp.RatingResult{
		ID:        uuid.NewString(),
		Rating:    input.Rating,
		Message:   input.Message,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}, nil
}

func (s *stubRatingService) DeleteEventRating(_ context.Context, _, eventID uuid.UUID) error {
	s.deleteEventCallCount++
	s.lastDeleteEventID = eventID
	return s.err
}

func (s *stubRatingService) UpsertParticipantRating(_ context.Context, _, eventID, participantUserID uuid.UUID, input ratingapp.UpsertRatingInput) (*ratingapp.RatingResult, error) {
	s.upsertParticipantCallCount++
	s.lastUpsertParticipantEventID = eventID
	s.lastUpsertParticipantUserID = participantUserID
	s.lastUpsertParticipantInput = input
	if s.err != nil {
		return nil, s.err
	}
	if s.upsertParticipantResult != nil {
		return s.upsertParticipantResult, nil
	}
	return &ratingapp.RatingResult{
		ID:        uuid.NewString(),
		Rating:    input.Rating,
		Message:   input.Message,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}, nil
}

func (s *stubRatingService) DeleteParticipantRating(_ context.Context, _, eventID, participantUserID uuid.UUID) error {
	s.deleteParticipantCallCount++
	s.lastDeleteParticipantEventID = eventID
	s.lastDeleteParticipantUserID = participantUserID
	return s.err
}

type fakeVerifier struct {
	claims *domain.AuthClaims
	err    error
}

func (f *fakeVerifier) VerifyAccessToken(_ string) (*domain.AuthClaims, error) {
	return f.claims, f.err
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

func newRatingTestApp(service ratingapp.UseCase, verifier domain.TokenVerifier) *fiber.App {
	app := fiber.New()
	handler := NewRatingHandler(service)
	RegisterRatingRoutes(app, handler, httpapi.RequireAuth(verifier))
	return app
}

func TestUpsertEventRatingParsesBodyAndReturns200(t *testing.T) {
	// given
	svc := &stubRatingService{}
	app := newRatingTestApp(svc, authedVerifier())
	eventID := uuid.New()
	message := "Very well organized."

	req := httptest.NewRequest(fiber.MethodPut, "/events/"+eventID.String()+"/rating", bytes.NewBufferString(`{"rating":5,"message":"`+message+`"}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
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
	if svc.upsertEventCallCount != 1 {
		t.Fatalf("expected upsert event rating to be called once, got %d", svc.upsertEventCallCount)
	}
	if svc.lastUpsertEventID != eventID {
		t.Fatalf("expected event id %s, got %s", eventID, svc.lastUpsertEventID)
	}
	if svc.lastUpsertEventInput.Rating != 5 {
		t.Fatalf("expected rating 5, got %d", svc.lastUpsertEventInput.Rating)
	}
	if svc.lastUpsertEventInput.Message == nil || *svc.lastUpsertEventInput.Message != message {
		t.Fatalf("expected message %q, got %v", message, svc.lastUpsertEventInput.Message)
	}

	var body ratingapp.RatingResult
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body.Rating != 5 {
		t.Fatalf("expected response rating 5, got %d", body.Rating)
	}
}

func TestDeleteEventRatingReturns204(t *testing.T) {
	// given
	svc := &stubRatingService{}
	app := newRatingTestApp(svc, authedVerifier())
	eventID := uuid.New()

	req := httptest.NewRequest(fiber.MethodDelete, "/events/"+eventID.String()+"/rating", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("application.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
	}
	if svc.deleteEventCallCount != 1 {
		t.Fatalf("expected delete event rating to be called once, got %d", svc.deleteEventCallCount)
	}
	if svc.lastDeleteEventID != eventID {
		t.Fatalf("expected event id %s, got %s", eventID, svc.lastDeleteEventID)
	}
}

func TestUpsertParticipantRatingInvalidParticipantIDReturns400(t *testing.T) {
	// given
	app := newRatingTestApp(&stubRatingService{}, authedVerifier())
	eventID := uuid.New()

	req := httptest.NewRequest(fiber.MethodPut, "/events/"+eventID.String()+"/participants/not-a-uuid/rating", bytes.NewBufferString(`{"rating":4}`))
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

func TestUpsertEventRatingInvalidJSONReturns400(t *testing.T) {
	// given
	svc := &stubRatingService{}
	app := newRatingTestApp(svc, authedVerifier())
	eventID := uuid.New()

	req := httptest.NewRequest(fiber.MethodPut, "/events/"+eventID.String()+"/rating", bytes.NewBufferString(`not-json`))
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
	if svc.upsertEventCallCount != 0 {
		t.Fatalf("expected service not to be called, got %d", svc.upsertEventCallCount)
	}
}
