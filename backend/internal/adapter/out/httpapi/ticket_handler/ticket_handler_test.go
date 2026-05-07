package ticket_handler

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type fakeTicketService struct {
	scanInput      ticket.ScanTicketInput
	scanHostUserID uuid.UUID
	scanEventID    uuid.UUID
}

func (s *fakeTicketService) CreateTicketForParticipation(context.Context, *domain.Participation, domain.TicketStatus) (*domain.Ticket, error) {
	return nil, nil
}

func (s *fakeTicketService) CancelTicketForParticipation(context.Context, uuid.UUID) error {
	return nil
}

func (s *fakeTicketService) CancelTicketsForEvent(context.Context, uuid.UUID) error {
	return nil
}

func (s *fakeTicketService) ExpireTicketsForEvent(context.Context, uuid.UUID) error {
	return nil
}

func (s *fakeTicketService) ListMyTickets(context.Context, uuid.UUID) (*ticket.ListTicketsResult, error) {
	return &ticket.ListTicketsResult{Items: []ticket.TicketListItem{}}, nil
}

func (s *fakeTicketService) GetMyTicket(context.Context, uuid.UUID, uuid.UUID) (*ticket.TicketDetailResult, error) {
	now := time.Now().UTC()
	return &ticket.TicketDetailResult{
		Ticket: ticket.TicketInfo{ID: uuid.NewString(), Status: domain.TicketStatusActive, ExpiresAt: now.Add(time.Hour), CreatedAt: now, UpdatedAt: now},
	}, nil
}

func (s *fakeTicketService) IssueQRToken(context.Context, uuid.UUID, uuid.UUID, ticket.QRTokenInput) (*ticket.QRTokenResult, error) {
	return &ticket.QRTokenResult{Token: "signed-token", ExpiresAt: time.Now().UTC().Add(10 * time.Second), Version: 1}, nil
}

func (s *fakeTicketService) ScanTicket(_ context.Context, hostUserID, eventID uuid.UUID, input ticket.ScanTicketInput) (*ticket.ScanTicketResult, error) {
	s.scanInput = input
	s.scanHostUserID = hostUserID
	s.scanEventID = eventID
	status := domain.TicketStatusUsed
	return &ticket.ScanTicketResult{Result: ticket.ScanResultAccepted, TicketStatus: &status}, nil
}

type fakeVerifier struct {
	claims *domain.AuthClaims
}

func (v fakeVerifier) VerifyAccessToken(string) (*domain.AuthClaims, error) {
	return v.claims, nil
}

type failingWriter struct{}

func (f failingWriter) Write([]byte) (int, error) {
	return 0, errors.New("broken pipe")
}

func TestScanTicketRequiresMobileHeader(t *testing.T) {
	app := newTicketTestApp(&fakeTicketService{}, uuid.New())
	req := httptest.NewRequest(fiber.MethodPost, "/host/events/"+uuid.NewString()+"/ticket-scans", bytes.NewBufferString(`{"qr_token":"token"}`))
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}

	if resp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected status %d, got %d", fiber.StatusForbidden, resp.StatusCode)
	}
}

func TestScanTicketParsesBodyAndForwardsToService(t *testing.T) {
	userID := uuid.New()
	eventID := uuid.New()
	service := &fakeTicketService{}
	app := newTicketTestApp(service, userID)
	req := httptest.NewRequest(fiber.MethodPost, "/host/events/"+eventID.String()+"/ticket-scans", bytes.NewBufferString(`{"qr_token":"signed-token"}`))
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")
	req.Header.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	req.Header.Set(clientSurfaceHeader, "MOBILE")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}
	if service.scanHostUserID != userID || service.scanEventID != eventID || service.scanInput.QRToken != "signed-token" {
		t.Fatalf("service received wrong scan input: host=%s event=%s input=%+v", service.scanHostUserID, service.scanEventID, service.scanInput)
	}
	var body ticket.ScanTicketResult
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode response error = %v", err)
	}
	if body.Result != ticket.ScanResultAccepted {
		t.Fatalf("expected ACCEPTED, got %+v", body)
	}
}

func TestListMyTicketsDoesNotRequireMobileHeader(t *testing.T) {
	app := newTicketTestApp(&fakeTicketService{}, uuid.New())
	req := httptest.NewRequest(fiber.MethodGet, "/me/tickets", nil)
	req.Header.Set(fiber.HeaderAuthorization, "Bearer valid.token")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}
}

func TestWriteSSEFlushesEventPayload(t *testing.T) {
	var buf bytes.Buffer
	writer := bufio.NewWriter(&buf)

	ok := writeSSE(writer, "qr_token", fiber.Map{"token": "signed-token"})

	if !ok {
		t.Fatal("expected writeSSE to report success")
	}
	body := buf.String()
	if !strings.Contains(body, "event: qr_token\n") || !strings.Contains(body, `"token":"signed-token"`) {
		t.Fatalf("unexpected SSE payload: %q", body)
	}
}

func TestWriteSSEReturnsFalseWhenFlushFails(t *testing.T) {
	writer := bufio.NewWriter(failingWriter{})

	ok := writeSSE(writer, "qr_token", fiber.Map{"token": "signed-token"})

	if ok {
		t.Fatal("expected writeSSE to report flush failure")
	}
}

func newTicketTestApp(service ticket.UseCase, userID uuid.UUID) *fiber.App {
	app := fiber.New()
	handler := NewHandler(service)
	RegisterRoutes(app, handler, httpapi.RequireAuth(fakeVerifier{claims: &domain.AuthClaims{
		UserID:   userID,
		Username: "user",
		Email:    "user@example.com",
	}}))
	return app
}
