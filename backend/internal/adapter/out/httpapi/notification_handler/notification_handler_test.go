package notification_handler

import (
	"bytes"
	"context"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	notificationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/notification"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func TestRegisterPushDeviceForwardsParsedBody(t *testing.T) {
	// given
	service := &stubNotificationService{}
	app := newNotificationTestApp(service, authedNotificationVerifier())
	installationID := uuid.New()
	req := httptest.NewRequest(fiber.MethodPut, "/me/push-devices/"+installationID.String(), bytes.NewBufferString(`{"fcm_token":"token-1","platform":"IOS","device_info":"iPhone"}`))
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}
	if service.registerCallCount != 1 {
		t.Fatalf("expected register to be called once, got %d", service.registerCallCount)
	}
	if service.lastRegisterInput.InstallationID != installationID || service.lastRegisterInput.FCMToken != "token-1" {
		t.Fatalf("unexpected register input %#v", service.lastRegisterInput)
	}
}

func TestRegisterPushDeviceRejectsInvalidInstallationID(t *testing.T) {
	// given
	service := &stubNotificationService{}
	app := newNotificationTestApp(service, authedNotificationVerifier())
	req := httptest.NewRequest(fiber.MethodPut, "/me/push-devices/not-a-uuid", bytes.NewBufferString(`{"fcm_token":"token-1","platform":"IOS"}`))
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

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
	if service.registerCallCount != 0 {
		t.Fatalf("expected register not to be called, got %d", service.registerCallCount)
	}
}

func TestUnregisterPushDeviceRequiresAuthentication(t *testing.T) {
	// given
	service := &stubNotificationService{}
	app := newNotificationTestApp(service, authedNotificationVerifier())
	req := httptest.NewRequest(fiber.MethodDelete, "/me/push-devices/"+uuid.NewString(), nil)

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
	if service.unregisterCallCount != 0 {
		t.Fatalf("expected unregister not to be called, got %d", service.unregisterCallCount)
	}
}

type stubNotificationService struct {
	registerCallCount    int
	unregisterCallCount  int
	lastRegisterInput    notificationapp.RegisterDeviceInput
	lastUnregisterUserID uuid.UUID
	lastUnregisterID     uuid.UUID
}

func (s *stubNotificationService) RegisterDevice(_ context.Context, input notificationapp.RegisterDeviceInput) (*notificationapp.RegisterDeviceResult, error) {
	s.registerCallCount++
	s.lastRegisterInput = input
	return &notificationapp.RegisterDeviceResult{
		InstallationID:    input.InstallationID.String(),
		Platform:          domain.PushDevicePlatformIOS,
		ActiveDeviceCount: 1,
		UpdatedAt:         time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC),
	}, nil
}

func (s *stubNotificationService) UnregisterDevice(_ context.Context, userID, installationID uuid.UUID) error {
	s.unregisterCallCount++
	s.lastUnregisterUserID = userID
	s.lastUnregisterID = installationID
	return nil
}

func (s *stubNotificationService) SendPushToUsers(_ context.Context, _ notificationapp.SendPushInput) (*notificationapp.SendPushResult, error) {
	return &notificationapp.SendPushResult{}, nil
}

type fakeNotificationVerifier struct {
	claims *domain.AuthClaims
	err    error
}

func (f *fakeNotificationVerifier) VerifyAccessToken(_ string) (*domain.AuthClaims, error) {
	return f.claims, f.err
}

func newNotificationTestApp(service notificationapp.UseCase, verifier domain.TokenVerifier) *fiber.App {
	app := fiber.New()
	RegisterRoutes(app, NewHandler(service), httpapi.RequireAuth(verifier))
	return app
}

func authedNotificationVerifier() *fakeNotificationVerifier {
	return &fakeNotificationVerifier{
		claims: &domain.AuthClaims{
			UserID:   uuid.New(),
			Username: "testuser",
			Email:    "test@example.com",
		},
	}
}
