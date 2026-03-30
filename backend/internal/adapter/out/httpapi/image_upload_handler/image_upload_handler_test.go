package image_upload_handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type stubImageUploadService struct {
	createProfileResult *imageupload.CreateUploadResult
	createEventResult   *imageupload.CreateUploadResult
	createProfileErr    error
	createEventErr      error
	confirmProfileErr   error
	confirmEventErr     error
	lastEventID         uuid.UUID
	lastConfirmInput    imageupload.ConfirmUploadInput
	lastConfirmEventID  uuid.UUID
}

func (s *stubImageUploadService) CreateProfileAvatarUpload(_ context.Context, _ uuid.UUID) (*imageupload.CreateUploadResult, error) {
	if s.createProfileErr != nil {
		return nil, s.createProfileErr
	}
	if s.createProfileResult != nil {
		return s.createProfileResult, nil
	}
	return defaultUploadResult(), nil
}

func (s *stubImageUploadService) ConfirmProfileAvatarUpload(_ context.Context, _ uuid.UUID, input imageupload.ConfirmUploadInput) error {
	s.lastConfirmInput = input
	return s.confirmProfileErr
}

func (s *stubImageUploadService) CreateEventImageUpload(_ context.Context, _ uuid.UUID, eventID uuid.UUID) (*imageupload.CreateUploadResult, error) {
	s.lastEventID = eventID
	if s.createEventErr != nil {
		return nil, s.createEventErr
	}
	if s.createEventResult != nil {
		return s.createEventResult, nil
	}
	return defaultUploadResult(), nil
}

func (s *stubImageUploadService) ConfirmEventImageUpload(_ context.Context, _ uuid.UUID, eventID uuid.UUID, input imageupload.ConfirmUploadInput) error {
	s.lastConfirmEventID = eventID
	s.lastConfirmInput = input
	return s.confirmEventErr
}

type fakeVerifier struct {
	claims *domain.AuthClaims
	err    error
}

func (f *fakeVerifier) VerifyAccessToken(_ string) (*domain.AuthClaims, error) {
	return f.claims, f.err
}

func newTestApp(service imageupload.UseCase, verifier domain.TokenVerifier) *fiber.App {
	app := fiber.New()
	RegisterRoutes(app, NewHandler(service), httpapi.RequireAuth(verifier))
	return app
}

func authedVerifier() *fakeVerifier {
	return &fakeVerifier{
		claims: &domain.AuthClaims{
			UserID:   uuid.New(),
			Username: "uploader",
			Email:    "uploader@example.com",
		},
	}
}

func defaultUploadResult() *imageupload.CreateUploadResult {
	return &imageupload.CreateUploadResult{
		BaseURL:      "https://sem-bucket.fra1.cdn.digitaloceanspaces.com/profiles/u/avatar/v1-upload",
		Version:      1,
		ConfirmToken: "confirm-token",
		Uploads: []imageupload.PresignedUpload{
			{
				Variant: "ORIGINAL",
				Method:  fiber.MethodPut,
				URL:     "https://sem-bucket.fra1.digitaloceanspaces.com/original",
				Headers: map[string]string{
					"Content-Type":  "image/jpeg",
					"Cache-Control": "public, max-age=604800, immutable",
					"x-amz-acl":     "public-read",
				},
			},
			{
				Variant: "SMALL",
				Method:  fiber.MethodPut,
				URL:     "https://sem-bucket.fra1.digitaloceanspaces.com/small",
				Headers: map[string]string{
					"Content-Type":  "image/jpeg",
					"Cache-Control": "public, max-age=604800, immutable",
					"x-amz-acl":     "public-read",
				},
			},
		},
	}
}

func TestCreateProfileAvatarUploadReturnsSignedInstructions(t *testing.T) {
	svc := &stubImageUploadService{}
	app := newTestApp(svc, authedVerifier())

	req := httptest.NewRequest(fiber.MethodPost, "/me/avatar/upload-url", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}

	var body imageupload.CreateUploadResult
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body.BaseURL == "" || body.ConfirmToken == "" || len(body.Uploads) != 2 {
		t.Fatalf("unexpected response body: %+v", body)
	}
	for _, upload := range body.Uploads {
		if got := upload.Headers["x-amz-acl"]; got != "public-read" {
			t.Fatalf("expected x-amz-acl public-read for %s, got %q", upload.Variant, got)
		}
	}
}

func TestCreateProfileAvatarUploadWithoutAuthReturns401(t *testing.T) {
	app := newTestApp(&stubImageUploadService{}, authedVerifier())

	req := httptest.NewRequest(fiber.MethodPost, "/me/avatar/upload-url", nil)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", fiber.StatusUnauthorized, resp.StatusCode)
	}
}

func TestConfirmProfileAvatarUploadInvalidTokenReturns400(t *testing.T) {
	svc := &stubImageUploadService{
		confirmProfileErr: domain.BadRequestError(
			domain.ErrorCodeImageUploadTokenInvalid,
			"The confirm token is invalid or expired.",
		),
	}
	app := newTestApp(svc, authedVerifier())

	req := httptest.NewRequest(
		fiber.MethodPost,
		"/me/avatar/confirm",
		bytes.NewBufferString(`{"confirm_token":"expired"}`),
	)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", fiber.StatusBadRequest, resp.StatusCode)
	}
}

func TestCreateEventImageUploadForbiddenReturns403(t *testing.T) {
	svc := &stubImageUploadService{
		createEventErr: domain.ForbiddenError(
			domain.ErrorCodeImageUploadNotAllowed,
			"Only the event host can upload the event image.",
		),
	}
	app := newTestApp(svc, authedVerifier())
	eventID := uuid.New()

	req := httptest.NewRequest(fiber.MethodPost, "/events/"+eventID.String()+"/image/upload-url", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected status %d, got %d", fiber.StatusForbidden, resp.StatusCode)
	}
}

func TestCreateEventImageUploadNotFoundReturns404(t *testing.T) {
	svc := &stubImageUploadService{
		createEventErr: domain.NotFoundError(
			domain.ErrorCodeEventNotFound,
			"The requested event does not exist.",
		),
	}
	app := newTestApp(svc, authedVerifier())
	eventID := uuid.New()

	req := httptest.NewRequest(fiber.MethodPost, "/events/"+eventID.String()+"/image/upload-url", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("expected status %d, got %d", fiber.StatusNotFound, resp.StatusCode)
	}
}

func TestConfirmEventImageUploadParsesRequest(t *testing.T) {
	svc := &stubImageUploadService{}
	app := newTestApp(svc, authedVerifier())
	eventID := uuid.New()

	req := httptest.NewRequest(
		fiber.MethodPost,
		"/events/"+eventID.String()+"/image/confirm",
		bytes.NewBufferString(`{"confirm_token":"confirm-token"}`),
	)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != fiber.StatusNoContent {
		t.Fatalf("expected status %d, got %d", fiber.StatusNoContent, resp.StatusCode)
	}
	if svc.lastConfirmEventID != eventID {
		t.Fatalf("expected confirm event id %s, got %s", eventID, svc.lastConfirmEventID)
	}
	if svc.lastConfirmInput.ConfirmToken != "confirm-token" {
		t.Fatalf("expected confirm token to be parsed, got %+v", svc.lastConfirmInput)
	}
}
