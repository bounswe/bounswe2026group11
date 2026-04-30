//go:build integration

package tests_integration

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	jwtadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/jwt"
	postgresrepo "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/postgres"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/admin_handler"
	adminapp "github.com/bounswe/bounswe2026group11/backend/internal/application/admin"
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
