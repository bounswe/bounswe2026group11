package admin_handler

import (
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/admin"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Handler groups web-only admin backoffice handlers.
type Handler struct {
	service admin.UseCase
}

// NewHandler creates an admin handler backed by the given use case.
func NewHandler(service admin.UseCase) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts admin-only read endpoints.
func RegisterRoutes(router fiber.Router, handler *Handler, adminAuth fiber.Handler) {
	group := router.Group("/admin", adminAuth)
	group.Get("/users", handler.ListUsers)
	group.Get("/events", handler.ListEvents)
	group.Get("/participations", handler.ListParticipations)
	group.Get("/tickets", handler.ListTickets)
}

func (h *Handler) ListUsers(c *fiber.Ctx) error {
	input, errs := parseListUsersInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListUsers(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	logAdminList(c, "admin.users.list", len(result.Items), result.PageMeta, summarizeUsers(input))
	return c.JSON(result)
}

func (h *Handler) ListEvents(c *fiber.Ctx) error {
	input, errs := parseListEventsInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListEvents(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	logAdminList(c, "admin.events.list", len(result.Items), result.PageMeta, summarizeEvents(input))
	return c.JSON(result)
}

func (h *Handler) ListParticipations(c *fiber.Ctx) error {
	input, errs := parseListParticipationsInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListParticipations(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	logAdminList(c, "admin.participations.list", len(result.Items), result.PageMeta, summarizeParticipations(input))
	return c.JSON(result)
}

func (h *Handler) ListTickets(c *fiber.Ctx) error {
	input, errs := parseListTicketsInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListTickets(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	logAdminList(c, "admin.tickets.list", len(result.Items), result.PageMeta, summarizeTickets(input))
	return c.JSON(result)
}

func parseListUsersInput(c *fiber.Ctx) (admin.ListUsersInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListUsersInput{PageInput: page}
	input.Query = optionalTrimmed(c.Query("q"))
	input.CreatedFrom = parseOptionalTime(c, "created_from", errs)
	input.CreatedTo = parseOptionalTime(c, "created_to", errs)
	if raw := strings.TrimSpace(c.Query("status")); raw != "" {
		status, ok := domain.ParseUserStatus(raw)
		if !ok {
			errs["status"] = "must be one of: active"
		} else {
			input.Status = &status
		}
	}
	if raw := strings.TrimSpace(c.Query("role")); raw != "" {
		role, ok := domain.ParseUserRole(raw)
		if !ok {
			errs["role"] = "must be one of: USER, ADMIN"
		} else {
			input.Role = &role
		}
	}
	return input, errs
}

func parseListEventsInput(c *fiber.Ctx) (admin.ListEventsInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListEventsInput{PageInput: page}
	input.Query = optionalTrimmed(c.Query("q"))
	input.HostID = parseOptionalUUID(c, "host_id", errs)
	input.CategoryID = parseOptionalInt(c, "category_id", errs)
	input.StartFrom = parseOptionalTime(c, "start_from", errs)
	input.StartTo = parseOptionalTime(c, "start_to", errs)
	if raw := strings.TrimSpace(c.Query("privacy_level")); raw != "" {
		level, ok := domain.ParseEventPrivacyLevel(raw)
		if !ok {
			errs["privacy_level"] = "must be one of: PUBLIC, PROTECTED, PRIVATE"
		} else {
			input.PrivacyLevel = &level
		}
	}
	if raw := strings.TrimSpace(c.Query("status")); raw != "" {
		status, ok := domain.ParseEventStatus(raw)
		if !ok {
			errs["status"] = "must be one of: ACTIVE, IN_PROGRESS, CANCELED, COMPLETED"
		} else {
			input.Status = &status
		}
	}
	return input, errs
}

func parseListParticipationsInput(c *fiber.Ctx) (admin.ListParticipationsInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListParticipationsInput{PageInput: page}
	input.Query = optionalTrimmed(c.Query("q"))
	input.EventID = parseOptionalUUID(c, "event_id", errs)
	input.UserID = parseOptionalUUID(c, "user_id", errs)
	input.CreatedFrom = parseOptionalTime(c, "created_from", errs)
	input.CreatedTo = parseOptionalTime(c, "created_to", errs)
	if raw := strings.TrimSpace(c.Query("status")); raw != "" {
		status, ok := domain.ParseParticipationStatus(raw)
		if !ok {
			errs["status"] = "must be one of: APPROVED, PENDING, CANCELED, LEAVED"
		} else {
			input.Status = &status
		}
	}
	return input, errs
}

func parseListTicketsInput(c *fiber.Ctx) (admin.ListTicketsInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListTicketsInput{PageInput: page}
	input.Query = optionalTrimmed(c.Query("q"))
	input.EventID = parseOptionalUUID(c, "event_id", errs)
	input.UserID = parseOptionalUUID(c, "user_id", errs)
	input.ParticipationID = parseOptionalUUID(c, "participation_id", errs)
	input.CreatedFrom = parseOptionalTime(c, "created_from", errs)
	input.CreatedTo = parseOptionalTime(c, "created_to", errs)
	if raw := strings.TrimSpace(c.Query("status")); raw != "" {
		status, ok := domain.ParseTicketStatus(raw)
		if !ok {
			errs["status"] = "must be one of: ACTIVE, PENDING, EXPIRED, USED, CANCELED"
		} else {
			input.Status = &status
		}
	}
	return input, errs
}

func parsePage(c *fiber.Ctx) (admin.PageInput, map[string]string) {
	errs := map[string]string{}
	page := admin.PageInput{Limit: admin.DefaultLimit}
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > admin.MaxLimit {
			errs["limit"] = "must be an integer between 1 and 100"
		} else {
			page.Limit = limit
		}
	}
	if raw := strings.TrimSpace(c.Query("offset")); raw != "" {
		offset, err := strconv.Atoi(raw)
		if err != nil || offset < 0 {
			errs["offset"] = "must be a non-negative integer"
		} else {
			page.Offset = offset
		}
	}
	return page, errs
}

func optionalTrimmed(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func parseOptionalUUID(c *fiber.Ctx, key string, errs map[string]string) *uuid.UUID {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil
	}
	value, err := uuid.Parse(raw)
	if err != nil {
		errs[key] = "must be a valid UUID"
		return nil
	}
	return &value
}

func parseOptionalInt(c *fiber.Ctx, key string, errs map[string]string) *int {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		errs[key] = "must be an integer"
		return nil
	}
	return &value
}

func parseOptionalTime(c *fiber.Ctx, key string, errs map[string]string) *time.Time {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil
	}
	value, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		errs[key] = "must be an RFC3339 timestamp"
		return nil
	}
	value = value.UTC()
	return &value
}

func logAdminList(c *fiber.Ctx, operation string, resultCount int, page admin.PageMeta, summary string) {
	httpapi.LogInfo(
		c.UserContext(),
		"admin list query completed",
		httpapi.OperationAttr(operation),
		httpapi.UserIDAttr(httpapi.UserClaims(c).UserID),
		slog.Int("result_count", resultCount),
		slog.Int("limit", page.Limit),
		slog.Int("offset", page.Offset),
		slog.Bool("has_next", page.HasNext),
		httpapi.QuerySummaryAttr(summary),
	)
}

func summarizeUsers(input admin.ListUsersInput) string {
	return httpapi.JoinSummary(
		httpapi.CountSummary("limit", input.Limit),
		httpapi.CountSummary("offset", input.Offset),
		httpapi.StringPtrSummary("q", input.Query),
		pointerSummary("status", input.Status),
		pointerSummary("role", input.Role),
		timePointerSummary("created_from", input.CreatedFrom),
		timePointerSummary("created_to", input.CreatedTo),
	)
}

func summarizeEvents(input admin.ListEventsInput) string {
	return httpapi.JoinSummary(
		httpapi.CountSummary("limit", input.Limit),
		httpapi.CountSummary("offset", input.Offset),
		httpapi.StringPtrSummary("q", input.Query),
		uuidPointerSummary("host_id", input.HostID),
		intPointerSummary("category_id", input.CategoryID),
		pointerSummary("privacy_level", input.PrivacyLevel),
		pointerSummary("status", input.Status),
		timePointerSummary("start_from", input.StartFrom),
		timePointerSummary("start_to", input.StartTo),
	)
}

func summarizeParticipations(input admin.ListParticipationsInput) string {
	return httpapi.JoinSummary(
		httpapi.CountSummary("limit", input.Limit),
		httpapi.CountSummary("offset", input.Offset),
		httpapi.StringPtrSummary("q", input.Query),
		pointerSummary("status", input.Status),
		uuidPointerSummary("event_id", input.EventID),
		uuidPointerSummary("user_id", input.UserID),
		timePointerSummary("created_from", input.CreatedFrom),
		timePointerSummary("created_to", input.CreatedTo),
	)
}

func summarizeTickets(input admin.ListTicketsInput) string {
	return httpapi.JoinSummary(
		httpapi.CountSummary("limit", input.Limit),
		httpapi.CountSummary("offset", input.Offset),
		httpapi.StringPtrSummary("q", input.Query),
		pointerSummary("status", input.Status),
		uuidPointerSummary("event_id", input.EventID),
		uuidPointerSummary("user_id", input.UserID),
		uuidPointerSummary("participation_id", input.ParticipationID),
		timePointerSummary("created_from", input.CreatedFrom),
		timePointerSummary("created_to", input.CreatedTo),
	)
}

func pointerSummary[T ~string](label string, value *T) string {
	if value == nil {
		return label + "=<nil>"
	}
	return httpapi.StringSummary(label, string(*value))
}

func uuidPointerSummary(label string, value *uuid.UUID) string {
	if value == nil {
		return label + "=<nil>"
	}
	return httpapi.StringSummary(label, value.String())
}

func intPointerSummary(label string, value *int) string {
	if value == nil {
		return label + "=<nil>"
	}
	return httpapi.CountSummary(label, *value)
}

func timePointerSummary(label string, value *time.Time) string {
	if value == nil {
		return label + "=<nil>"
	}
	return httpapi.StringSummary(label, value.Format(time.RFC3339))
}
