package notification_handler

import (
	"bytes"
	"context"
	"encoding/json"
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

func TestListNotificationsParsesPagination(t *testing.T) {
	// given
	service := &stubNotificationService{}
	app := newNotificationTestApp(service, authedNotificationVerifier())
	req := httptest.NewRequest(fiber.MethodGet, "/me/notifications?limit=10&cursor=test-cursor", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

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
	if service.listCallCount != 1 {
		t.Fatalf("expected list to be called once, got %d", service.listCallCount)
	}
	if service.lastListInput.Limit == nil || *service.lastListInput.Limit != 10 {
		t.Fatalf("expected limit 10, got %+v", service.lastListInput.Limit)
	}
	if service.lastListInput.Cursor == nil || *service.lastListInput.Cursor != "test-cursor" {
		t.Fatalf("expected cursor to be forwarded, got %+v", service.lastListInput.Cursor)
	}
}

func TestGetUnreadNotificationCountReturnsCount(t *testing.T) {
	// given
	service := &stubNotificationService{unreadCount: 3}
	app := newNotificationTestApp(service, authedNotificationVerifier())
	req := httptest.NewRequest(fiber.MethodGet, "/me/notifications/unread-count", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

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
	var body unreadCountResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode response error = %v", err)
	}
	if body.UnreadCount != 3 {
		t.Fatalf("expected unread count 3, got %d", body.UnreadCount)
	}
}

func TestMarkNotificationReadRejectsInvalidNotificationID(t *testing.T) {
	// given
	service := &stubNotificationService{}
	app := newNotificationTestApp(service, authedNotificationVerifier())
	req := httptest.NewRequest(fiber.MethodPatch, "/me/notifications/not-a-uuid/read", nil)
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
	if service.markReadCallCount != 0 {
		t.Fatalf("expected mark read not to be called, got %d", service.markReadCallCount)
	}
}

type stubNotificationService struct {
	registerCallCount    int
	unregisterCallCount  int
	listCallCount        int
	markReadCallCount    int
	unreadCount          int
	lastRegisterInput    notificationapp.RegisterDeviceInput
	lastListInput        notificationapp.ListNotificationsInput
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

func (s *stubNotificationService) ListNotifications(_ context.Context, input notificationapp.ListNotificationsInput) (*notificationapp.ListNotificationsResult, error) {
	s.listCallCount++
	s.lastListInput = input
	return &notificationapp.ListNotificationsResult{
		Items: []domain.Notification{
			{
				ID:             uuid.New(),
				ReceiverUserID: input.UserID,
				Title:          "Event update",
				Body:           "A new update is available.",
				Data:           map[string]string{},
				CreatedAt:      time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC),
			},
		},
		PageInfo: notificationapp.NotificationPageInfo{HasNext: false},
	}, nil
}

func (s *stubNotificationService) CountUnreadNotifications(_ context.Context, _ uuid.UUID) (*notificationapp.UnreadCountResult, error) {
	return &notificationapp.UnreadCountResult{UnreadCount: s.unreadCount}, nil
}

func (s *stubNotificationService) MarkNotificationRead(_ context.Context, _, _ uuid.UUID) error {
	s.markReadCallCount++
	return nil
}

func (s *stubNotificationService) MarkAllNotificationsRead(_ context.Context, _ uuid.UUID) (*notificationapp.MarkAllReadResult, error) {
	return &notificationapp.MarkAllReadResult{UpdatedCount: 1}, nil
}

func (s *stubNotificationService) DeleteNotification(_ context.Context, _, _ uuid.UUID) error {
	return nil
}

func (s *stubNotificationService) DeleteAllNotifications(_ context.Context, _ uuid.UUID) error {
	return nil
}

func (s *stubNotificationService) DeleteExpiredNotifications(_ context.Context) (int, error) {
	return 0, nil
}

func (s *stubNotificationService) SendNotificationToUsers(_ context.Context, _ notificationapp.SendNotificationInput) (*notificationapp.SendNotificationResult, error) {
	return &notificationapp.SendNotificationResult{}, nil
}

func (s *stubNotificationService) SendCustomNotificationToUsers(_ context.Context, _ notificationapp.SendCustomNotificationInput) (*notificationapp.SendNotificationResult, error) {
	return &notificationapp.SendNotificationResult{}, nil
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
