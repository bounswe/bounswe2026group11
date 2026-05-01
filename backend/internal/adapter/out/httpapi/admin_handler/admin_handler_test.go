package admin_handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/admin"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type stubAdminService struct {
	lastUsers          admin.ListUsersInput
	lastEvents         admin.ListEventsInput
	lastParticipations admin.ListParticipationsInput
	lastTickets        admin.ListTicketsInput
	lastNotifications  admin.ListNotificationsInput
	lastNotification   admin.SendCustomNotificationInput
	lastCreate         admin.CreateManualParticipationInput
	lastCancel         admin.CancelParticipationInput
}

func (s *stubAdminService) ListUsers(_ context.Context, input admin.ListUsersInput) (*admin.ListUsersResult, error) {
	s.lastUsers = input
	return &admin.ListUsersResult{Items: []admin.AdminUserItem{}, PageMeta: admin.PageMeta{Limit: input.Limit, Offset: input.Offset}}, nil
}

func (s *stubAdminService) ListEvents(_ context.Context, input admin.ListEventsInput) (*admin.ListEventsResult, error) {
	s.lastEvents = input
	return &admin.ListEventsResult{Items: []admin.AdminEventItem{}, PageMeta: admin.PageMeta{Limit: input.Limit, Offset: input.Offset}}, nil
}

func (s *stubAdminService) ListParticipations(_ context.Context, input admin.ListParticipationsInput) (*admin.ListParticipationsResult, error) {
	s.lastParticipations = input
	return &admin.ListParticipationsResult{Items: []admin.AdminParticipationItem{}, PageMeta: admin.PageMeta{Limit: input.Limit, Offset: input.Offset}}, nil
}

func (s *stubAdminService) ListTickets(_ context.Context, input admin.ListTicketsInput) (*admin.ListTicketsResult, error) {
	s.lastTickets = input
	return &admin.ListTicketsResult{Items: []admin.AdminTicketItem{}, PageMeta: admin.PageMeta{Limit: input.Limit, Offset: input.Offset}}, nil
}

func (s *stubAdminService) ListNotifications(_ context.Context, input admin.ListNotificationsInput) (*admin.ListNotificationsResult, error) {
	s.lastNotifications = input
	return &admin.ListNotificationsResult{Items: []admin.AdminNotificationItem{}, PageMeta: admin.PageMeta{Limit: input.Limit, Offset: input.Offset}}, nil
}

func (s *stubAdminService) SendCustomNotification(_ context.Context, input admin.SendCustomNotificationInput) (*admin.SendCustomNotificationResult, error) {
	s.lastNotification = input
	return &admin.SendCustomNotificationResult{TargetUserCount: len(input.UserIDs), CreatedCount: len(input.UserIDs)}, nil
}

func (s *stubAdminService) CreateManualParticipation(_ context.Context, input admin.CreateManualParticipationInput) (*admin.CreateManualParticipationResult, error) {
	s.lastCreate = input
	return &admin.CreateManualParticipationResult{ParticipationID: uuid.New(), EventID: input.EventID, UserID: input.UserID, Status: input.Status}, nil
}

func (s *stubAdminService) CancelParticipation(_ context.Context, input admin.CancelParticipationInput) (*admin.CancelParticipationResult, error) {
	s.lastCancel = input
	return &admin.CancelParticipationResult{ParticipationID: input.ParticipationID, Status: domain.ParticipationStatusCanceled}, nil
}

func adminHandlerTestApp(service admin.UseCase) *fiber.App {
	app := fiber.New()
	RegisterRoutes(app, NewHandler(service), func(c *fiber.Ctx) error {
		c.Locals("user_claims", &domain.AuthClaims{UserID: uuid.New(), Role: domain.UserRoleAdmin})
		return c.Next()
	})
	return app
}

func TestListUsersValidatesPagination(t *testing.T) {
	// given
	app := adminHandlerTestApp(&stubAdminService{})
	req := httptest.NewRequest(fiber.MethodGet, "/admin/users?limit=101&offset=-1", nil)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
	var body struct {
		Error struct {
			Details map[string]string `json:"details"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body.Error.Details["limit"] == "" || body.Error.Details["offset"] == "" {
		t.Fatalf("expected limit and offset validation details, got %#v", body.Error.Details)
	}
}

func TestListUsersParsesFilters(t *testing.T) {
	// given
	service := &stubAdminService{}
	app := adminHandlerTestApp(service)
	from := time.Date(2026, 4, 1, 10, 0, 0, 0, time.UTC)
	req := httptest.NewRequest(fiber.MethodGet, "/admin/users?limit=25&offset=50&q=ali&status=active&role=ADMIN&created_from="+from.Format(time.RFC3339), nil)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if service.lastUsers.Limit != 25 || service.lastUsers.Offset != 50 {
		t.Fatalf("unexpected pagination: %#v", service.lastUsers.PageInput)
	}
	if service.lastUsers.Query == nil || *service.lastUsers.Query != "ali" {
		t.Fatalf("expected query ali, got %#v", service.lastUsers.Query)
	}
	if service.lastUsers.Status == nil || *service.lastUsers.Status != domain.UserStatusActive {
		t.Fatalf("expected active status, got %#v", service.lastUsers.Status)
	}
	if service.lastUsers.Role == nil || *service.lastUsers.Role != domain.UserRoleAdmin {
		t.Fatalf("expected admin role, got %#v", service.lastUsers.Role)
	}
	if service.lastUsers.CreatedFrom == nil || !service.lastUsers.CreatedFrom.Equal(from) {
		t.Fatalf("expected created_from %s, got %#v", from, service.lastUsers.CreatedFrom)
	}
}

func TestListEventsValidatesEnumFilters(t *testing.T) {
	// given
	app := adminHandlerTestApp(&stubAdminService{})
	req := httptest.NewRequest(fiber.MethodGet, "/admin/events?privacy_level=FRIENDS&status=DRAFT", nil)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestListTicketsParsesIDsAndStatus(t *testing.T) {
	// given
	service := &stubAdminService{}
	app := adminHandlerTestApp(service)
	eventID := uuid.New()
	userID := uuid.New()
	participationID := uuid.New()
	req := httptest.NewRequest(fiber.MethodGet, "/admin/tickets?event_id="+eventID.String()+"&user_id="+userID.String()+"&participation_id="+participationID.String()+"&status=ACTIVE", nil)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if service.lastTickets.EventID == nil || *service.lastTickets.EventID != eventID {
		t.Fatalf("expected event_id %s, got %#v", eventID, service.lastTickets.EventID)
	}
	if service.lastTickets.UserID == nil || *service.lastTickets.UserID != userID {
		t.Fatalf("expected user_id %s, got %#v", userID, service.lastTickets.UserID)
	}
	if service.lastTickets.ParticipationID == nil || *service.lastTickets.ParticipationID != participationID {
		t.Fatalf("expected participation_id %s, got %#v", participationID, service.lastTickets.ParticipationID)
	}
	if service.lastTickets.Status == nil || *service.lastTickets.Status != domain.TicketStatusActive {
		t.Fatalf("expected ACTIVE status, got %#v", service.lastTickets.Status)
	}
}

func TestCreateNotificationValidatesBody(t *testing.T) {
	// given
	app := adminHandlerTestApp(&stubAdminService{})
	req := httptest.NewRequest(fiber.MethodPost, "/admin/notifications", bytes.NewBufferString(`{"user_ids":[],"delivery_mode":"EMAIL","title":"","body":""}`))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
	var body struct {
		Error struct {
			Details map[string]string `json:"details"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	for _, field := range []string{"user_ids", "delivery_mode", "title", "body"} {
		if body.Error.Details[field] == "" {
			t.Fatalf("expected %s validation detail, got %#v", field, body.Error.Details)
		}
	}
}

func TestListNotificationsParsesFilters(t *testing.T) {
	// given
	service := &stubAdminService{}
	app := adminHandlerTestApp(service)
	userID := uuid.New()
	eventID := uuid.New()
	from := time.Date(2026, 5, 1, 10, 0, 0, 0, time.UTC)
	req := httptest.NewRequest(fiber.MethodGet, "/admin/notifications?limit=10&offset=20&q=ops&user_id="+userID.String()+"&event_id="+eventID.String()+"&type=ADMIN&is_read=false&created_from="+from.Format(time.RFC3339), nil)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if service.lastNotifications.Limit != 10 || service.lastNotifications.Offset != 20 {
		t.Fatalf("unexpected pagination: %#v", service.lastNotifications.PageInput)
	}
	if service.lastNotifications.Query == nil || *service.lastNotifications.Query != "ops" {
		t.Fatalf("expected query ops, got %#v", service.lastNotifications.Query)
	}
	if service.lastNotifications.UserID == nil || *service.lastNotifications.UserID != userID {
		t.Fatalf("expected user_id %s, got %#v", userID, service.lastNotifications.UserID)
	}
	if service.lastNotifications.EventID == nil || *service.lastNotifications.EventID != eventID {
		t.Fatalf("expected event_id %s, got %#v", eventID, service.lastNotifications.EventID)
	}
	if service.lastNotifications.Type == nil || *service.lastNotifications.Type != "ADMIN" {
		t.Fatalf("expected type ADMIN, got %#v", service.lastNotifications.Type)
	}
	if service.lastNotifications.IsRead == nil || *service.lastNotifications.IsRead {
		t.Fatalf("expected is_read false, got %#v", service.lastNotifications.IsRead)
	}
	if service.lastNotifications.CreatedFrom == nil || !service.lastNotifications.CreatedFrom.Equal(from) {
		t.Fatalf("expected created_from %s, got %#v", from, service.lastNotifications.CreatedFrom)
	}
}

func TestListNotificationsValidatesFilters(t *testing.T) {
	// given
	app := adminHandlerTestApp(&stubAdminService{})
	req := httptest.NewRequest(fiber.MethodGet, "/admin/notifications?user_id=nope&is_read=maybe", nil)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestCreateNotificationParsesInput(t *testing.T) {
	// given
	service := &stubAdminService{}
	app := adminHandlerTestApp(service)
	userID := uuid.New()
	eventID := uuid.New()
	payload := `{"user_ids":["` + userID.String() + `"],"delivery_mode":"BOTH","title":"Ops","body":"Update","type":"ADMIN","deep_link":"sem://events/1","event_id":"` + eventID.String() + `","data":{"k":"v"},"idempotency_key":"custom-key"}`
	req := httptest.NewRequest(fiber.MethodPost, "/admin/notifications", bytes.NewBufferString(payload))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
	if len(service.lastNotification.UserIDs) != 1 || service.lastNotification.UserIDs[0] != userID {
		t.Fatalf("unexpected user IDs: %#v", service.lastNotification.UserIDs)
	}
	if service.lastNotification.DeliveryMode != domain.NotificationDeliveryModeBoth {
		t.Fatalf("unexpected delivery mode %q", service.lastNotification.DeliveryMode)
	}
	if service.lastNotification.EventID == nil || *service.lastNotification.EventID != eventID {
		t.Fatalf("expected event id %s, got %#v", eventID, service.lastNotification.EventID)
	}
	if service.lastNotification.Data["k"] != "v" {
		t.Fatalf("expected data payload, got %#v", service.lastNotification.Data)
	}
}

func TestCreateParticipationDefaultsApproved(t *testing.T) {
	// given
	service := &stubAdminService{}
	app := adminHandlerTestApp(service)
	eventID := uuid.New()
	userID := uuid.New()
	payload := `{"event_id":"` + eventID.String() + `","user_id":"` + userID.String() + `"}`
	req := httptest.NewRequest(fiber.MethodPost, "/admin/participations", bytes.NewBufferString(payload))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}
	if service.lastCreate.EventID != eventID || service.lastCreate.UserID != userID {
		t.Fatalf("unexpected create input %#v", service.lastCreate)
	}
	if service.lastCreate.Status != domain.ParticipationStatusApproved {
		t.Fatalf("expected APPROVED default, got %q", service.lastCreate.Status)
	}
}

func TestCancelParticipationParsesID(t *testing.T) {
	// given
	service := &stubAdminService{}
	app := adminHandlerTestApp(service)
	participationID := uuid.New()
	req := httptest.NewRequest(fiber.MethodPost, "/admin/participations/"+participationID.String()+"/cancel", nil)

	// when
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if service.lastCancel.ParticipationID != participationID {
		t.Fatalf("expected participation id %s, got %s", participationID, service.lastCancel.ParticipationID)
	}
}
