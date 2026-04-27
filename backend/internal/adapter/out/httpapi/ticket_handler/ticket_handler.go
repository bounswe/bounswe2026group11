package ticket_handler

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const clientSurfaceHeader = "X-Client-Surface"

// Handler groups HTTP handlers that delegate to the ticket use-case port.
type Handler struct {
	service ticket.UseCase
}

// NewHandler creates a ticket handler backed by the given ticket use case.
func NewHandler(service ticket.UseCase) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts ticket endpoints.
func RegisterRoutes(router fiber.Router, handler *Handler, auth fiber.Handler) {
	me := router.Group("/me", auth)
	me.Get("/tickets", handler.ListMyTickets)
	me.Get("/tickets/:ticketId", handler.GetMyTicket)
	me.Get("/tickets/:ticketId/qr-stream", handler.StreamQRToken)

	host := router.Group("/host", auth)
	host.Post("/events/:eventId/ticket-scans", handler.ScanTicket)
}

// ListMyTickets handles GET /me/tickets.
func (h *Handler) ListMyTickets(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	result, err := h.service.ListMyTickets(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

// GetMyTicket handles GET /me/tickets/:ticketId.
func (h *Handler) GetMyTicket(c *fiber.Ctx) error {
	ticketID, err := parseTicketID(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	result, err := h.service.GetMyTicket(c.UserContext(), claims.UserID, ticketID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

// StreamQRToken handles GET /me/tickets/:ticketId/qr-stream.
func (h *Handler) StreamQRToken(c *fiber.Ctx) error {
	if err := requireMobileClient(c); err != nil {
		return httpapi.WriteError(c, err)
	}

	ticketID, err := parseTicketID(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	input, err := parseQRTokenInput(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	firstToken, err := h.service.IssueQRToken(c.UserContext(), claims.UserID, ticketID, input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"ticket qr stream opened",
		httpapi.OperationAttr("ticket.qr_stream"),
		httpapi.UserIDAttr(claims.UserID),
		slog.String("ticket_id", ticketID.String()),
	)

	done := c.Context().Done()
	c.Set(fiber.HeaderContentType, "text/event-stream")
	c.Set(fiber.HeaderCacheControl, "no-cache, no-store")
	c.Set(fiber.HeaderConnection, "keep-alive")
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		writeSSE(w, "qr_token", firstToken)
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				refreshCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				nextToken, err := h.service.IssueQRToken(refreshCtx, claims.UserID, ticketID, input)
				cancel()
				select {
				case <-done:
					return
				default:
				}
				if err != nil {
					writeSSE(w, "error", fiber.Map{"message": err.Error()})
					return
				}
				writeSSE(w, "qr_token", nextToken)
			}
		}
	})
	return nil
}

// ScanTicket handles POST /host/events/:eventId/ticket-scans.
func (h *Handler) ScanTicket(c *fiber.Ctx) error {
	if err := requireMobileClient(c); err != nil {
		return httpapi.WriteError(c, err)
	}

	eventID, err := parseEventID(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	var body scanTicketBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}
	if strings.TrimSpace(body.QRToken) == "" {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{
			"qr_token": "qr_token is required", // #nosec G101 -- JSON field name and validation text, not a secret
		}))
	}

	claims := httpapi.UserClaims(c)
	result, err := h.service.ScanTicket(c.UserContext(), claims.UserID, eventID, ticket.ScanTicketInput{QRToken: body.QRToken})
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"ticket scan completed",
		httpapi.OperationAttr("ticket.scan"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		slog.String("result", result.Result),
	)

	return c.JSON(result)
}

type scanTicketBody struct {
	QRToken string `json:"qr_token"`
}

func requireMobileClient(c *fiber.Ctx) error {
	if strings.EqualFold(strings.TrimSpace(c.Get(clientSurfaceHeader)), "MOBILE") {
		return nil
	}
	return domain.ForbiddenError(domain.ErrorCodeTicketClientNotSupported, "This ticket operation is supported only by the mobile client.")
}

func parseTicketID(c *fiber.Ctx) (uuid.UUID, error) {
	ticketID, err := uuid.Parse(c.Params("ticketId"))
	if err != nil {
		return uuid.Nil, domain.ValidationError(map[string]string{"ticketId": "must be a valid UUID"})
	}
	return ticketID, nil
}

func parseEventID(c *fiber.Ctx) (uuid.UUID, error) {
	eventID, err := uuid.Parse(c.Params("eventId"))
	if err != nil {
		return uuid.Nil, domain.ValidationError(map[string]string{"eventId": "must be a valid UUID"})
	}
	return eventID, nil
}

func parseQRTokenInput(c *fiber.Ctx) (ticket.QRTokenInput, error) {
	lat, err := parseRequiredFloatQuery(c, "lat")
	if err != nil {
		return ticket.QRTokenInput{}, err
	}
	lon, err := parseRequiredFloatQuery(c, "lon")
	if err != nil {
		return ticket.QRTokenInput{}, err
	}
	return ticket.QRTokenInput{Lat: lat, Lon: lon}, nil
}

func parseRequiredFloatQuery(c *fiber.Ctx, key string) (float64, error) {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return 0, domain.ValidationError(map[string]string{key: key + " is required"})
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0, domain.ValidationError(map[string]string{key: key + " must be a number"})
	}
	return value, nil
}

func writeSSE(w *bufio.Writer, event string, data any) {
	payload, err := json.Marshal(data)
	if err != nil {
		payload = []byte(`{"message":"failed to encode event"}`)
	}
	_, _ = fmt.Fprintf(w, "event: %s\n", event)
	_, _ = fmt.Fprintf(w, "data: %s\n\n", payload)
	_ = w.Flush()
}
