package event_report_handler

import (
	"log/slog"
	"strings"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	eventreportapp "github.com/bounswe/bounswe2026group11/backend/internal/application/eventreport"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Handler groups HTTP handlers for event reports.
type Handler struct {
	service eventreportapp.UseCase
}

// NewHandler constructs an event-report handler.
func NewHandler(service eventreportapp.UseCase) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts event-report routes under /events.
func RegisterRoutes(router fiber.Router, handler *Handler, auth fiber.Handler) {
	events := router.Group("/events", auth)
	events.Post("/:id/reports", handler.CreateEventReport)
}

// CreateEventReport handles POST /events/:id/reports.
func (h *Handler) CreateEventReport(c *fiber.Ctx) error {
	eventID, err := parseEventID(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	input, err := parseCreateEventReportBody(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	result, svcErr := h.service.CreateEventReport(c.UserContext(), claims.UserID, eventID, input)
	if svcErr != nil {
		return httpapi.WriteError(c, svcErr)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event report created",
		httpapi.OperationAttr("event_report.create"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		slog.String("report_category", result.Category),
		slog.Bool("has_image_token", input.ImageConfirmToken != nil && strings.TrimSpace(*input.ImageConfirmToken) != ""),
	)

	return c.Status(fiber.StatusCreated).JSON(result)
}

func parseCreateEventReportBody(c *fiber.Ctx) (eventreportapp.CreateEventReportInput, error) {
	var body createEventReportBody
	if err := c.BodyParser(&body); err != nil {
		return eventreportapp.CreateEventReportInput{}, domain.ValidationError(map[string]string{"body": "must be valid JSON"})
	}

	category, ok := domain.ParseEventReportCategory(body.ReportCategory)
	if !ok {
		return eventreportapp.CreateEventReportInput{}, domain.ValidationError(map[string]string{
			"report_category": "must be one of: SAFETY, HARASSMENT, SPAM_OR_SCAM, INAPPROPRIATE_CONTENT, EVENT_NOT_AS_DESCRIBED, ILLEGAL_OR_DANGEROUS, OTHER",
		})
	}

	return eventreportapp.CreateEventReportInput{
		Category:          category,
		Message:           body.Message,
		ImageConfirmToken: body.ImageConfirmToken,
	}, nil
}

func parseEventID(c *fiber.Ctx) (uuid.UUID, error) {
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.Nil, domain.ValidationError(map[string]string{"id": "must be a valid UUID"})
	}
	return eventID, nil
}
