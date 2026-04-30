//go:build integration

package tests_integration

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	pushadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/firebasepush"
	jwtadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/jwt"
	postgresrepo "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/postgres"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/admin_handler"
	adminapp "github.com/bounswe/bounswe2026group11/backend/internal/application/admin"
	notificationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/notification"
	ticketapp "github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/tests_integration/common"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

func TestAdminUsersEndpointAuthorizationAndFiltering(t *testing.T) {
	t.Parallel()

	// given
	pool := common.RequirePool(t)
	authRepo := postgresrepo.NewAuthRepository(pool)
	adminRepo := postgresrepo.NewAdminRepository(pool)
	app, issuer := adminIntegrationApp(adminapp.NewService(adminRepo))

	adminUser := common.GivenUser(t, authRepo, common.WithUserUsername("admin_"+uuid.NewString()[:8]))
	regularUser := common.GivenUser(t, authRepo, common.WithUserUsername("regular_"+uuid.NewString()[:8]))
	promoteUser(t, adminUser.ID)
	adminUser.Role = domain.UserRoleAdmin
	regularUser.Role = domain.UserRoleUser

	adminToken := issueAccessToken(t, issuer, *adminUser)
	regularToken := issueAccessToken(t, issuer, *regularUser)

	// when
	anonymousResp := performAdminRequest(t, app, "/admin/users", "")
	nonAdminResp := performAdminRequest(t, app, "/admin/users", regularToken)
	adminResp := performAdminRequest(t, app, "/admin/users?role=USER&q="+regularUser.Username+"&limit=1&offset=0", adminToken)
	defer func() { _ = anonymousResp.Body.Close() }()
	defer func() { _ = nonAdminResp.Body.Close() }()
	defer func() { _ = adminResp.Body.Close() }()

	// then
	if anonymousResp.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected anonymous request to return 401, got %d", anonymousResp.StatusCode)
	}
	if nonAdminResp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected non-admin request to return 403, got %d", nonAdminResp.StatusCode)
	}
	if adminResp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected admin request to return 200, got %d", adminResp.StatusCode)
	}

	var body struct {
		Items      []adminapp.AdminUserItem `json:"items"`
		Limit      int                      `json:"limit"`
		Offset     int                      `json:"offset"`
		TotalCount int                      `json:"total_count"`
		HasNext    bool                     `json:"has_next"`
	}
	if err := json.NewDecoder(adminResp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body.Limit != 1 || body.Offset != 0 {
		t.Fatalf("unexpected pagination metadata: limit=%d offset=%d", body.Limit, body.Offset)
	}
	if body.TotalCount != 1 || len(body.Items) != 1 {
		t.Fatalf("expected one filtered user, got total=%d items=%d", body.TotalCount, len(body.Items))
	}
	if body.Items[0].ID != regularUser.ID || body.Items[0].Role != string(domain.UserRoleUser) {
		t.Fatalf("unexpected filtered user item: %#v", body.Items[0])
	}
}

func TestAdminEventsParticipationsAndTicketsFiltering(t *testing.T) {
	t.Parallel()

	// given
	pool := common.RequirePool(t)
	authRepo := postgresrepo.NewAuthRepository(pool)
	eventHarness := common.NewEventHarness(t)
	adminRepo := postgresrepo.NewAdminRepository(pool)
	app, issuer := adminIntegrationApp(adminapp.NewService(adminRepo))

	adminUser := common.GivenUser(t, authRepo, common.WithUserUsername("admin_"+uuid.NewString()[:8]))
	host := common.GivenUser(t, authRepo, common.WithUserUsername("host_"+uuid.NewString()[:8]))
	participant := common.GivenUser(t, authRepo, common.WithUserUsername("participant_"+uuid.NewString()[:8]))
	promoteUser(t, adminUser.ID)
	adminUser.Role = domain.UserRoleAdmin

	eventRef := common.GivenProtectedEvent(t, eventHarness.Service, host.ID)
	participationID := createParticipationAndTicket(t, eventRef.ID, participant.ID)
	adminToken := issueAccessToken(t, issuer, *adminUser)

	// when
	eventsResp := performAdminRequest(t, app, "/admin/events?host_id="+host.ID.String()+"&privacy_level=PROTECTED&status=ACTIVE&limit=5", adminToken)
	participationsResp := performAdminRequest(t, app, "/admin/participations?event_id="+eventRef.ID.String()+"&user_id="+participant.ID.String()+"&status=APPROVED", adminToken)
	ticketsResp := performAdminRequest(t, app, "/admin/tickets?event_id="+eventRef.ID.String()+"&user_id="+participant.ID.String()+"&participation_id="+participationID.String()+"&status=ACTIVE", adminToken)
	defer func() { _ = eventsResp.Body.Close() }()
	defer func() { _ = participationsResp.Body.Close() }()
	defer func() { _ = ticketsResp.Body.Close() }()

	// then
	assertAdminListHasOne(t, eventsResp, "events")
	assertAdminListHasOne(t, participationsResp, "participations")
	assertAdminListHasOne(t, ticketsResp, "tickets")
}

func TestAdminCreateNotificationMutation(t *testing.T) {
	t.Parallel()

	// given
	pool := common.RequirePool(t)
	authRepo := postgresrepo.NewAuthRepository(pool)
	service := newAdminMutationService(t)
	app, issuer := adminIntegrationApp(service)

	adminUser := common.GivenUser(t, authRepo, common.WithUserUsername("admin_notify_"+uuid.NewString()[:8]))
	targetUser := common.GivenUser(t, authRepo, common.WithUserUsername("target_notify_"+uuid.NewString()[:8]))
	promoteUser(t, adminUser.ID)
	adminUser.Role = domain.UserRoleAdmin
	adminToken := issueAccessToken(t, issuer, *adminUser)
	payload := `{"user_ids":["` + targetUser.ID.String() + `"],"delivery_mode":"IN_APP","title":"Backoffice update","body":"Check your inbox","idempotency_key":"admin-it-` + uuid.NewString() + `"}`

	// when
	resp := performAdminJSONRequest(t, app, fiber.MethodPost, "/admin/notifications", adminToken, payload)
	defer func() { _ = resp.Body.Close() }()

	// then
	if resp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected admin notification request to return 201, got %d", resp.StatusCode)
	}
	var body adminapp.SendCustomNotificationResult
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if body.TargetUserCount != 1 || body.CreatedCount != 1 {
		t.Fatalf("unexpected notification result: %#v", body)
	}
}

func TestAdminCreateAndCancelParticipationMutationCreatesAndCancelsTicket(t *testing.T) {
	t.Parallel()

	// given
	pool := common.RequirePool(t)
	authRepo := postgresrepo.NewAuthRepository(pool)
	eventHarness := common.NewEventHarness(t)
	service := newAdminMutationService(t)
	app, issuer := adminIntegrationApp(service)

	adminUser := common.GivenUser(t, authRepo, common.WithUserUsername("admin_part_"+uuid.NewString()[:8]))
	host := common.GivenUser(t, authRepo, common.WithUserUsername("host_part_"+uuid.NewString()[:8]))
	participant := common.GivenUser(t, authRepo, common.WithUserUsername("manual_part_"+uuid.NewString()[:8]))
	promoteUser(t, adminUser.ID)
	adminUser.Role = domain.UserRoleAdmin
	adminToken := issueAccessToken(t, issuer, *adminUser)
	eventRef := common.GivenProtectedEvent(t, eventHarness.Service, host.ID)
	createPayload := `{"event_id":"` + eventRef.ID.String() + `","user_id":"` + participant.ID.String() + `"}`

	// when
	createResp := performAdminJSONRequest(t, app, fiber.MethodPost, "/admin/participations", adminToken, createPayload)
	defer func() { _ = createResp.Body.Close() }()

	// then
	if createResp.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected participation create to return 201, got %d", createResp.StatusCode)
	}
	var createBody adminapp.CreateManualParticipationResult
	if err := json.NewDecoder(createResp.Body).Decode(&createBody); err != nil {
		t.Fatalf("Decode(create) error = %v", err)
	}
	if createBody.TicketID == nil || createBody.TicketStatus == nil || *createBody.TicketStatus != domain.TicketStatusActive {
		t.Fatalf("expected active ticket for protected event, got %#v", createBody)
	}

	duplicateResp := performAdminJSONRequest(t, app, fiber.MethodPost, "/admin/participations", adminToken, createPayload)
	defer func() { _ = duplicateResp.Body.Close() }()
	if duplicateResp.StatusCode != fiber.StatusConflict {
		t.Fatalf("expected duplicate participation to return 409, got %d", duplicateResp.StatusCode)
	}

	cancelResp := performAdminJSONRequest(t, app, fiber.MethodPost, "/admin/participations/"+createBody.ParticipationID.String()+"/cancel", adminToken, `{}`)
	defer func() { _ = cancelResp.Body.Close() }()
	if cancelResp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected participation cancel to return 200, got %d", cancelResp.StatusCode)
	}

	var ticketStatus string
	if err := pool.QueryRow(context.Background(), `SELECT status FROM ticket WHERE participation_id = $1`, createBody.ParticipationID).Scan(&ticketStatus); err != nil {
		t.Fatalf("query ticket status error = %v", err)
	}
	if ticketStatus != string(domain.TicketStatusCanceled) {
		t.Fatalf("expected ticket to be canceled, got %q", ticketStatus)
	}

	cancelAgainResp := performAdminJSONRequest(t, app, fiber.MethodPost, "/admin/participations/"+createBody.ParticipationID.String()+"/cancel", adminToken, `{}`)
	defer func() { _ = cancelAgainResp.Body.Close() }()
	if cancelAgainResp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected idempotent cancel to return 200, got %d", cancelAgainResp.StatusCode)
	}
	var cancelAgainBody adminapp.CancelParticipationResult
	if err := json.NewDecoder(cancelAgainResp.Body).Decode(&cancelAgainBody); err != nil {
		t.Fatalf("Decode(cancel again) error = %v", err)
	}
	if !cancelAgainBody.AlreadyCanceled {
		t.Fatalf("expected already_canceled=true, got %#v", cancelAgainBody)
	}
}

func adminIntegrationApp(service adminapp.UseCase) (*fiber.App, jwtadapter.Issuer) {
	secret := []byte("admin-integration-secret")
	issuer := jwtadapter.Issuer{Secret: secret, TTL: 15 * time.Minute}
	verifier := jwtadapter.Verifier{Secret: secret}

	app := fiber.New()
	admin_handler.RegisterRoutes(app, admin_handler.NewHandler(service), httpapi.RequireAdmin(verifier))
	return app, issuer
}

func issueAccessToken(t *testing.T, issuer jwtadapter.Issuer, user domain.User) string {
	t.Helper()
	token, _, err := issuer.IssueAccessToken(user, time.Now().UTC())
	if err != nil {
		t.Fatalf("IssueAccessToken() error = %v", err)
	}
	return token
}

func performAdminRequest(t *testing.T, app *fiber.App, path, token string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(fiber.MethodGet, path, nil)
	if token != "" {
		req.Header.Set(fiber.HeaderAuthorization, "Bearer "+token)
	}
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test(%s) error = %v", path, err)
	}
	return resp
}

func performAdminJSONRequest(t *testing.T, app *fiber.App, method, path, token, payload string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewBufferString(payload))
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	if token != "" {
		req.Header.Set(fiber.HeaderAuthorization, "Bearer "+token)
	}
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test(%s %s) error = %v", method, path, err)
	}
	return resp
}

func newAdminMutationService(t *testing.T) adminapp.UseCase {
	t.Helper()
	pool := common.RequirePool(t)
	unitOfWork := postgresrepo.NewUnitOfWork(pool)
	ticketService := ticketapp.NewService(
		postgresrepo.NewTicketRepository(pool),
		unitOfWork,
		jwtadapter.TicketTokenManager{Secret: []byte("admin-integration-secret")},
		ticketapp.Settings{QRTokenTTL: 10 * time.Second, ProximityMeters: 200},
	)
	notificationService := notificationapp.NewService(postgresrepo.NewNotificationRepository(pool), pushadapter.MockSender{}, unitOfWork)
	return adminapp.NewService(
		postgresrepo.NewAdminRepository(pool),
		adminapp.WithMutationDependencies(notificationService, ticketService, unitOfWork),
	)
}

func promoteUser(t *testing.T, userID uuid.UUID) {
	t.Helper()
	_, err := common.RequirePool(t).Exec(context.Background(), `UPDATE app_user SET role = 'ADMIN' WHERE id = $1`, userID)
	if err != nil {
		t.Fatalf("promote user error = %v", err)
	}
}

func createParticipationAndTicket(t *testing.T, eventID, userID uuid.UUID) uuid.UUID {
	t.Helper()
	pool := common.RequirePool(t)
	var participationID uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO participation (event_id, user_id, status)
		VALUES ($1, $2, 'APPROVED')
		RETURNING id
	`, eventID, userID).Scan(&participationID)
	if err != nil {
		t.Fatalf("insert participation error = %v", err)
	}
	_, err = pool.Exec(context.Background(), `
		INSERT INTO ticket (participation_id, status, expires_at)
		VALUES ($1, 'ACTIVE', NOW() + INTERVAL '1 day')
	`, participationID)
	if err != nil {
		t.Fatalf("insert ticket error = %v", err)
	}
	return participationID
}

func assertAdminListHasOne(t *testing.T, resp *http.Response, label string) {
	t.Helper()
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected %s request to return 200, got %d", label, resp.StatusCode)
	}
	var body struct {
		Items      []json.RawMessage `json:"items"`
		TotalCount int               `json:"total_count"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode(%s) error = %v", label, err)
	}
	if body.TotalCount != 1 || len(body.Items) != 1 {
		t.Fatalf("expected one %s item, got total=%d items=%d", label, body.TotalCount, len(body.Items))
	}
}
