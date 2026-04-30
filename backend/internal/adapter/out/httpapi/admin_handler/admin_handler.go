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
	group.Post("/participations", handler.CreateParticipation)
	group.Post("/participations/:participation_id/cancel", handler.CancelParticipation)
	group.Get("/tickets", handler.ListTickets)
	group.Post("/notifications", handler.CreateNotification)
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

func (h *Handler) CreateNotification(c *fiber.Ctx) error {
	input, errs := parseCreateNotificationInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.SendCustomNotification(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(result)
}

func (h *Handler) CreateParticipation(c *fiber.Ctx) error {
	input, errs := parseCreateParticipationInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.CreateManualParticipation(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(result)
}

func (h *Handler) CancelParticipation(c *fiber.Ctx) error {
	input, errs := parseCancelParticipationInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.CancelParticipation(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

type createNotificationRequest struct {
	UserIDs        []string          `json:"user_ids"`
	DeliveryMode   string            `json:"delivery_mode"`
	Title          string            `json:"title"`
	Body           string            `json:"body"`
	Type           *string           `json:"type"`
	DeepLink       *string           `json:"deep_link"`
	EventID        *string           `json:"event_id"`
	Data           map[string]string `json:"data"`
	IdempotencyKey *string           `json:"idempotency_key"`
}

type createParticipationRequest struct {
	EventID string  `json:"event_id"`
	UserID  string  `json:"user_id"`
	Status  *string `json:"status"`
	Reason  *string `json:"reason"`
}

type cancelParticipationRequest struct {
	Reason *string `json:"reason"`
}

func parseCreateNotificationInput(c *fiber.Ctx) (admin.SendCustomNotificationInput, map[string]string) {
	var body createNotificationRequest
	errs := map[string]string{}
	if err := c.BodyParser(&body); err != nil {
		errs["body"] = "must be a valid JSON object"
		return admin.SendCustomNotificationInput{}, errs
	}

	input := admin.SendCustomNotificationInput{
		AdminUserID:    httpapi.UserClaims(c).UserID,
		Title:          body.Title,
		Body:           body.Body,
		Type:           optionalTrimmedPtr(body.Type),
		DeepLink:       optionalTrimmedPtr(body.DeepLink),
		Data:           body.Data,
		IdempotencyKey: optionalTrimmedPtr(body.IdempotencyKey),
	}
	if len(body.UserIDs) == 0 {
		errs["user_ids"] = "must contain at least one user id"
	} else {
		input.UserIDs = make([]uuid.UUID, 0, len(body.UserIDs))
		for _, raw := range body.UserIDs {
			value, err := uuid.Parse(strings.TrimSpace(raw))
			if err != nil {
				errs["user_ids"] = "must contain only valid UUIDs"
				break
			}
			if value == uuid.Nil {
				errs["user_ids"] = "must contain only valid UUIDs"
				break
			}
			input.UserIDs = append(input.UserIDs, value)
		}
	}
	mode, ok := domain.ParseNotificationDeliveryMode(body.DeliveryMode)
	if !ok {
		errs["delivery_mode"] = "must be one of: IN_APP, PUSH, BOTH"
	} else {
		input.DeliveryMode = mode
	}
	if strings.TrimSpace(body.Title) == "" {
		errs["title"] = "is required"
	}
	if strings.TrimSpace(body.Body) == "" {
		errs["body"] = "is required"
	}
	if body.EventID != nil && strings.TrimSpace(*body.EventID) != "" {
		eventID, err := uuid.Parse(strings.TrimSpace(*body.EventID))
		if err != nil || eventID == uuid.Nil {
			errs["event_id"] = "must be a valid UUID"
		} else {
			input.EventID = &eventID
		}
	}
	return input, errs
}

func parseCreateParticipationInput(c *fiber.Ctx) (admin.CreateManualParticipationInput, map[string]string) {
	var body createParticipationRequest
	errs := map[string]string{}
	if err := c.BodyParser(&body); err != nil {
		errs["body"] = "must be a valid JSON object"
		return admin.CreateManualParticipationInput{}, errs
	}

	input := admin.CreateManualParticipationInput{
		AdminUserID: httpapi.UserClaims(c).UserID,
		Status:      domain.ParticipationStatusApproved,
		Reason:      optionalTrimmedPtr(body.Reason),
	}
	eventID, err := uuid.Parse(strings.TrimSpace(body.EventID))
	if err != nil || eventID == uuid.Nil {
		errs["event_id"] = "must be a valid UUID"
	} else {
		input.EventID = eventID
	}
	userID, err := uuid.Parse(strings.TrimSpace(body.UserID))
	if err != nil || userID == uuid.Nil {
		errs["user_id"] = "must be a valid UUID"
	} else {
		input.UserID = userID
	}
	if body.Status != nil && strings.TrimSpace(*body.Status) != "" {
		status, ok := domain.ParseParticipationStatus(strings.TrimSpace(*body.Status))
		if !ok || (status != domain.ParticipationStatusApproved && status != domain.ParticipationStatusPending) {
			errs["status"] = "must be one of: APPROVED, PENDING"
		} else {
			input.Status = status
		}
	}
	return input, errs
}

func parseCancelParticipationInput(c *fiber.Ctx) (admin.CancelParticipationInput, map[string]string) {
	errs := map[string]string{}
	participationID, err := uuid.Parse(strings.TrimSpace(c.Params("participation_id")))
	if err != nil || participationID == uuid.Nil {
		errs["participation_id"] = "must be a valid UUID"
	}

	var body cancelParticipationRequest
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&body); err != nil {
			errs["body"] = "must be a valid JSON object"
		}
	}
	return admin.CancelParticipationInput{
		AdminUserID:     httpapi.UserClaims(c).UserID,
		ParticipationID: participationID,
		Reason:          optionalTrimmedPtr(body.Reason),
	}, errs
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

func optionalTrimmedPtr(value *string) *string {
	if value == nil {
		return nil
	}
	return optionalTrimmed(*value)
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
