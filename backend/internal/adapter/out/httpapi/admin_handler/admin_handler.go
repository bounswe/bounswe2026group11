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
	group.Post("/users/:user_id/deactivate", handler.DeactivateUser)
	group.Get("/events", handler.ListEvents)
	group.Patch("/events/:event_id/status", handler.UpdateEventStatus)
	group.Post("/events/:event_id/cancel", handler.CancelEvent)
	group.Get("/event-reports", handler.ListEventReports)
	group.Patch("/event-reports/:report_id/status", handler.UpdateEventReportStatus)
	group.Get("/categories", handler.ListCategories)
	group.Post("/categories", handler.CreateCategory)
	group.Delete("/categories/:category_id", handler.DeleteCategory)
	group.Get("/participations", handler.ListParticipations)
	group.Post("/participations", handler.CreateParticipation)
	group.Post("/participations/:participation_id/cancel", handler.CancelParticipation)
	group.Get("/tickets", handler.ListTickets)
	group.Get("/notifications", handler.ListNotifications)
	group.Post("/notifications", handler.CreateNotification)
	group.Get("/invitations", handler.ListInvitations)
	group.Patch("/invitations/:invitation_id/status", handler.UpdateInvitationStatus)
	group.Get("/join-requests", handler.ListJoinRequests)
	group.Patch("/join-requests/:join_request_id/status", handler.UpdateJoinRequestStatus)
	group.Get("/comments", handler.ListComments)
	group.Delete("/comments/:comment_id", handler.DeleteComment)
	group.Get("/ratings/events", handler.ListEventRatings)
	group.Delete("/ratings/events/:rating_id", handler.DeleteEventRating)
	group.Get("/ratings/participants", handler.ListParticipantRatings)
	group.Delete("/ratings/participants/:rating_id", handler.DeleteParticipantRating)
	group.Get("/favorites/events", handler.ListFavoriteEvents)
	group.Get("/favorites/locations", handler.ListFavoriteLocations)
	group.Get("/badges/users", handler.ListUserBadges)
	group.Get("/push-devices", handler.ListPushDevices)
	group.Post("/push-devices/:device_id/revoke", handler.RevokePushDevice)
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

func (h *Handler) ListNotifications(c *fiber.Ctx) error {
	input, errs := parseListNotificationsInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListNotifications(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	logAdminList(c, "admin.notifications.list", len(result.Items), result.PageMeta, summarizeNotifications(input))
	return c.JSON(result)
}

func (h *Handler) ListEventReports(c *fiber.Ctx) error {
	input, errs := parseListEventReportsInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListEventReports(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	logAdminList(c, "admin.event_reports.list", len(result.Items), result.PageMeta, summarizeEventReports(input))
	return c.JSON(result)
}

func (h *Handler) ListCategories(c *fiber.Ctx) error {
	result, err := h.service.ListCategories(c.UserContext())
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) CreateCategory(c *fiber.Ctx) error {
	input, errs := parseCreateCategoryInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.CreateCategory(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(result)
}

func (h *Handler) DeleteCategory(c *fiber.Ctx) error {
	input, errs := parseDeleteCategoryInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	if err := h.service.DeleteCategory(c.UserContext(), input); err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) UpdateEventReportStatus(c *fiber.Ctx) error {
	input, errs := parseUpdateEventReportStatusInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.UpdateEventReportStatus(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) UpdateEventStatus(c *fiber.Ctx) error {
	input, errs := parseUpdateEventStatusInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.UpdateEventStatus(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) CancelEvent(c *fiber.Ctx) error {
	input, errs := parseCancelEventInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.CancelEvent(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) DeactivateUser(c *fiber.Ctx) error {
	input, errs := parseDeactivateUserInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.DeactivateUser(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
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

func (h *Handler) ListInvitations(c *fiber.Ctx) error {
	input, errs := parseListInvitationsInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListInvitations(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) UpdateInvitationStatus(c *fiber.Ctx) error {
	input, errs := parseUpdateInvitationStatusInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.UpdateInvitationStatus(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) ListJoinRequests(c *fiber.Ctx) error {
	input, errs := parseListJoinRequestsInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListJoinRequests(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) UpdateJoinRequestStatus(c *fiber.Ctx) error {
	input, errs := parseUpdateJoinRequestStatusInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.UpdateJoinRequestStatus(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) ListComments(c *fiber.Ctx) error {
	input, errs := parseListCommentsInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListComments(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) DeleteComment(c *fiber.Ctx) error {
	input, errs := parseDeleteCommentInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	if err := h.service.DeleteComment(c.UserContext(), input); err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) ListEventRatings(c *fiber.Ctx) error {
	input, errs := parseListEventRatingsInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListEventRatings(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) DeleteEventRating(c *fiber.Ctx) error {
	input, errs := parseDeleteRatingInput(c, "rating_id")
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	if err := h.service.DeleteEventRating(c.UserContext(), input); err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) ListParticipantRatings(c *fiber.Ctx) error {
	input, errs := parseListParticipantRatingsInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListParticipantRatings(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) DeleteParticipantRating(c *fiber.Ctx) error {
	input, errs := parseDeleteRatingInput(c, "rating_id")
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	if err := h.service.DeleteParticipantRating(c.UserContext(), input); err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) ListFavoriteEvents(c *fiber.Ctx) error {
	input, errs := parseListFavoriteEventsInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListFavoriteEvents(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) ListFavoriteLocations(c *fiber.Ctx) error {
	input, errs := parseListFavoriteLocationsInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListFavoriteLocations(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) ListUserBadges(c *fiber.Ctx) error {
	input, errs := parseListUserBadgesInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListUserBadges(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) ListPushDevices(c *fiber.Ctx) error {
	input, errs := parseListPushDevicesInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	result, err := h.service.ListPushDevices(c.UserContext(), input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(result)
}

func (h *Handler) RevokePushDevice(c *fiber.Ctx) error {
	input, errs := parseRevokePushDeviceInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}
	if err := h.service.RevokePushDevice(c.UserContext(), input); err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
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

type reasonRequest struct {
	Reason *string `json:"reason"`
}

type statusRequest struct {
	Status *string `json:"status"`
	Reason *string `json:"reason"`
}

type createCategoryRequest struct {
	Name string `json:"name"`
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

func parseCreateCategoryInput(c *fiber.Ctx) (admin.CreateCategoryInput, map[string]string) {
	var body createCategoryRequest
	errs := map[string]string{}
	if err := c.BodyParser(&body); err != nil {
		errs["body"] = "must be a valid JSON object"
	}
	return admin.CreateCategoryInput{AdminUserID: httpapi.UserClaims(c).UserID, Name: body.Name}, errs
}

func parseDeleteCategoryInput(c *fiber.Ctx) (admin.DeleteCategoryInput, map[string]string) {
	errs := map[string]string{}
	id, err := strconv.Atoi(strings.TrimSpace(c.Params("category_id")))
	if err != nil || id <= 0 {
		errs["category_id"] = "must be a positive integer"
	}
	return admin.DeleteCategoryInput{AdminUserID: httpapi.UserClaims(c).UserID, CategoryID: id}, errs
}

func parseUpdateEventReportStatusInput(c *fiber.Ctx) (admin.UpdateEventReportStatusInput, map[string]string) {
	errs := map[string]string{}
	reportID := parsePathUUID(c, "report_id", errs)
	body := parseStatusBody(c, errs)
	var status domain.EventReportStatus
	if body.Status == nil {
		errs["status"] = "is required"
	} else if parsed, ok := domain.ParseEventReportStatus(strings.TrimSpace(*body.Status)); !ok {
		errs["status"] = "must be one of: PENDING, REVIEWED, DISMISSED"
	} else {
		status = parsed
	}
	return admin.UpdateEventReportStatusInput{AdminUserID: httpapi.UserClaims(c).UserID, ReportID: reportID, Status: status, Reason: optionalTrimmedPtr(body.Reason)}, errs
}

func parseUpdateEventStatusInput(c *fiber.Ctx) (admin.UpdateEventStatusInput, map[string]string) {
	errs := map[string]string{}
	eventID := parsePathUUID(c, "event_id", errs)
	body := parseStatusBody(c, errs)
	var status domain.EventStatus
	if body.Status == nil {
		errs["status"] = "is required"
	} else if parsed, ok := domain.ParseEventStatus(strings.TrimSpace(*body.Status)); !ok {
		errs["status"] = "must be one of: ACTIVE, IN_PROGRESS, CANCELED, COMPLETED"
	} else {
		status = parsed
	}
	return admin.UpdateEventStatusInput{AdminUserID: httpapi.UserClaims(c).UserID, EventID: eventID, Status: status, Reason: optionalTrimmedPtr(body.Reason)}, errs
}

func parseCancelEventInput(c *fiber.Ctx) (admin.CancelEventInput, map[string]string) {
	errs := map[string]string{}
	eventID := parsePathUUID(c, "event_id", errs)
	body := parseReasonBody(c, errs)
	return admin.CancelEventInput{AdminUserID: httpapi.UserClaims(c).UserID, EventID: eventID, Reason: optionalTrimmedPtr(body.Reason)}, errs
}

func parseDeactivateUserInput(c *fiber.Ctx) (admin.DeactivateUserInput, map[string]string) {
	errs := map[string]string{}
	userID := parsePathUUID(c, "user_id", errs)
	body := parseReasonBody(c, errs)
	return admin.DeactivateUserInput{AdminUserID: httpapi.UserClaims(c).UserID, UserID: userID, Reason: optionalTrimmedPtr(body.Reason)}, errs
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

func parseListNotificationsInput(c *fiber.Ctx) (admin.ListNotificationsInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListNotificationsInput{PageInput: page}
	input.Query = optionalTrimmed(c.Query("q"))
	input.UserID = parseOptionalUUID(c, "user_id", errs)
	input.EventID = parseOptionalUUID(c, "event_id", errs)
	input.CreatedFrom = parseOptionalTime(c, "created_from", errs)
	input.CreatedTo = parseOptionalTime(c, "created_to", errs)
	input.Type = optionalTrimmed(c.Query("type"))
	if raw := strings.TrimSpace(c.Query("is_read")); raw != "" {
		value, err := strconv.ParseBool(raw)
		if err != nil {
			errs["is_read"] = "must be true or false"
		} else {
			input.IsRead = &value
		}
	}
	return input, errs
}

func parseListEventReportsInput(c *fiber.Ctx) (admin.ListEventReportsInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListEventReportsInput{PageInput: page}
	input.Query = optionalTrimmed(c.Query("q"))
	input.EventID = parseOptionalUUID(c, "event_id", errs)
	input.ReporterUserID = parseOptionalUUID(c, "reporter_user_id", errs)
	input.CreatedFrom = parseOptionalTime(c, "created_from", errs)
	input.CreatedTo = parseOptionalTime(c, "created_to", errs)
	if raw := strings.TrimSpace(c.Query("status")); raw != "" {
		status, ok := domain.ParseEventReportStatus(raw)
		if !ok {
			errs["status"] = "must be one of: PENDING, REVIEWED, DISMISSED"
		} else {
			input.Status = &status
		}
	}
	if raw := strings.TrimSpace(c.Query("report_category")); raw != "" {
		category, ok := domain.ParseEventReportCategory(raw)
		if !ok {
			errs["report_category"] = "must be a valid report category"
		} else {
			input.ReportCategory = &category
		}
	}
	return input, errs
}

func parseListInvitationsInput(c *fiber.Ctx) (admin.ListInvitationsInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListInvitationsInput{PageInput: page, Query: optionalTrimmed(c.Query("q"))}
	input.EventID = parseOptionalUUID(c, "event_id", errs)
	input.HostID = parseOptionalUUID(c, "host_id", errs)
	input.InvitedUserID = parseOptionalUUID(c, "invited_user_id", errs)
	input.CreatedFrom = parseOptionalTime(c, "created_from", errs)
	input.CreatedTo = parseOptionalTime(c, "created_to", errs)
	if raw := strings.TrimSpace(c.Query("status")); raw != "" {
		status, ok := domain.ParseInvitationStatus(raw)
		if !ok {
			errs["status"] = "must be a valid invitation status"
		} else {
			input.Status = &status
		}
	}
	return input, errs
}

func parseListJoinRequestsInput(c *fiber.Ctx) (admin.ListJoinRequestsInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListJoinRequestsInput{PageInput: page, Query: optionalTrimmed(c.Query("q"))}
	input.EventID = parseOptionalUUID(c, "event_id", errs)
	input.UserID = parseOptionalUUID(c, "user_id", errs)
	input.HostUserID = parseOptionalUUID(c, "host_user_id", errs)
	input.CreatedFrom = parseOptionalTime(c, "created_from", errs)
	input.CreatedTo = parseOptionalTime(c, "created_to", errs)
	if raw := strings.TrimSpace(c.Query("status")); raw != "" {
		status, ok := domain.ParseJoinRequestStatus(raw)
		if !ok {
			errs["status"] = "must be a valid join request status"
		} else {
			input.Status = &status
		}
	}
	return input, errs
}

func parseListCommentsInput(c *fiber.Ctx) (admin.ListCommentsInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListCommentsInput{PageInput: page, Query: optionalTrimmed(c.Query("q")), Type: optionalTrimmed(c.Query("type"))}
	input.EventID = parseOptionalUUID(c, "event_id", errs)
	input.UserID = parseOptionalUUID(c, "user_id", errs)
	input.CreatedFrom = parseOptionalTime(c, "created_from", errs)
	input.CreatedTo = parseOptionalTime(c, "created_to", errs)
	return input, errs
}

func parseListEventRatingsInput(c *fiber.Ctx) (admin.ListEventRatingsInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListEventRatingsInput{PageInput: page}
	input.EventID = parseOptionalUUID(c, "event_id", errs)
	input.UserID = parseOptionalUUID(c, "user_id", errs)
	input.CreatedFrom = parseOptionalTime(c, "created_from", errs)
	input.CreatedTo = parseOptionalTime(c, "created_to", errs)
	return input, errs
}

func parseListParticipantRatingsInput(c *fiber.Ctx) (admin.ListParticipantRatingsInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListParticipantRatingsInput{PageInput: page}
	input.EventID = parseOptionalUUID(c, "event_id", errs)
	input.HostID = parseOptionalUUID(c, "host_id", errs)
	input.UserID = parseOptionalUUID(c, "user_id", errs)
	input.CreatedFrom = parseOptionalTime(c, "created_from", errs)
	input.CreatedTo = parseOptionalTime(c, "created_to", errs)
	return input, errs
}

func parseListFavoriteEventsInput(c *fiber.Ctx) (admin.ListFavoriteEventsInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListFavoriteEventsInput{PageInput: page}
	input.UserID = parseOptionalUUID(c, "user_id", errs)
	input.EventID = parseOptionalUUID(c, "event_id", errs)
	input.CreatedFrom = parseOptionalTime(c, "created_from", errs)
	input.CreatedTo = parseOptionalTime(c, "created_to", errs)
	return input, errs
}

func parseListFavoriteLocationsInput(c *fiber.Ctx) (admin.ListFavoriteLocationsInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListFavoriteLocationsInput{PageInput: page, Query: optionalTrimmed(c.Query("q"))}
	input.UserID = parseOptionalUUID(c, "user_id", errs)
	input.CreatedFrom = parseOptionalTime(c, "created_from", errs)
	input.CreatedTo = parseOptionalTime(c, "created_to", errs)
	return input, errs
}

func parseListUserBadgesInput(c *fiber.Ctx) (admin.ListUserBadgesInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListUserBadgesInput{PageInput: page, Query: optionalTrimmed(c.Query("q"))}
	input.UserID = parseOptionalUUID(c, "user_id", errs)
	return input, errs
}

func parseListPushDevicesInput(c *fiber.Ctx) (admin.ListPushDevicesInput, map[string]string) {
	page, errs := parsePage(c)
	input := admin.ListPushDevicesInput{PageInput: page, Platform: optionalTrimmed(c.Query("platform"))}
	input.UserID = parseOptionalUUID(c, "user_id", errs)
	input.CreatedFrom = parseOptionalTime(c, "created_from", errs)
	input.CreatedTo = parseOptionalTime(c, "created_to", errs)
	if raw := strings.TrimSpace(c.Query("active")); raw != "" {
		value, err := strconv.ParseBool(raw)
		if err != nil {
			errs["active"] = "must be true or false"
		} else {
			input.Active = &value
		}
	}
	return input, errs
}

func parseUpdateInvitationStatusInput(c *fiber.Ctx) (admin.UpdateInvitationStatusInput, map[string]string) {
	errs := map[string]string{}
	invitationID := parsePathUUID(c, "invitation_id", errs)
	body := parseStatusBody(c, errs)
	var status domain.InvitationStatus
	if body.Status == nil {
		errs["status"] = "is required"
	} else if parsed, ok := domain.ParseInvitationStatus(strings.TrimSpace(*body.Status)); !ok {
		errs["status"] = "must be a valid invitation status"
	} else {
		status = parsed
	}
	return admin.UpdateInvitationStatusInput{AdminUserID: httpapi.UserClaims(c).UserID, InvitationID: invitationID, Status: status, Reason: optionalTrimmedPtr(body.Reason)}, errs
}

func parseUpdateJoinRequestStatusInput(c *fiber.Ctx) (admin.UpdateJoinRequestStatusInput, map[string]string) {
	errs := map[string]string{}
	joinRequestID := parsePathUUID(c, "join_request_id", errs)
	body := parseStatusBody(c, errs)
	var status domain.JoinRequestStatus
	if body.Status == nil {
		errs["status"] = "is required"
	} else if parsed, ok := domain.ParseJoinRequestStatus(strings.TrimSpace(*body.Status)); !ok {
		errs["status"] = "must be a valid join request status"
	} else {
		status = parsed
	}
	return admin.UpdateJoinRequestStatusInput{AdminUserID: httpapi.UserClaims(c).UserID, JoinRequestID: joinRequestID, Status: status, Reason: optionalTrimmedPtr(body.Reason)}, errs
}

func parseDeleteCommentInput(c *fiber.Ctx) (admin.DeleteCommentInput, map[string]string) {
	errs := map[string]string{}
	return admin.DeleteCommentInput{AdminUserID: httpapi.UserClaims(c).UserID, CommentID: parsePathUUID(c, "comment_id", errs)}, errs
}

func parseDeleteRatingInput(c *fiber.Ctx, key string) (admin.DeleteRatingInput, map[string]string) {
	errs := map[string]string{}
	body := parseReasonBody(c, errs)
	return admin.DeleteRatingInput{AdminUserID: httpapi.UserClaims(c).UserID, RatingID: parsePathUUID(c, key, errs), Reason: optionalTrimmedPtr(body.Reason)}, errs
}

func parseRevokePushDeviceInput(c *fiber.Ctx) (admin.RevokePushDeviceInput, map[string]string) {
	errs := map[string]string{}
	body := parseReasonBody(c, errs)
	return admin.RevokePushDeviceInput{AdminUserID: httpapi.UserClaims(c).UserID, DeviceID: parsePathUUID(c, "device_id", errs), Reason: optionalTrimmedPtr(body.Reason)}, errs
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

func parsePathUUID(c *fiber.Ctx, key string, errs map[string]string) uuid.UUID {
	value, err := uuid.Parse(strings.TrimSpace(c.Params(key)))
	if err != nil || value == uuid.Nil {
		errs[key] = "must be a valid UUID"
		return uuid.Nil
	}
	return value
}

func parseReasonBody(c *fiber.Ctx, errs map[string]string) reasonRequest {
	var body reasonRequest
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&body); err != nil {
			errs["body"] = "must be a valid JSON object"
		}
	}
	return body
}

func parseStatusBody(c *fiber.Ctx, errs map[string]string) statusRequest {
	var body statusRequest
	if err := c.BodyParser(&body); err != nil {
		errs["body"] = "must be a valid JSON object"
	}
	return body
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

func summarizeNotifications(input admin.ListNotificationsInput) string {
	return httpapi.JoinSummary(
		httpapi.CountSummary("limit", input.Limit),
		httpapi.CountSummary("offset", input.Offset),
		httpapi.StringPtrSummary("q", input.Query),
		uuidPointerSummary("user_id", input.UserID),
		uuidPointerSummary("event_id", input.EventID),
		httpapi.StringPtrSummary("type", input.Type),
		boolPointerSummary("is_read", input.IsRead),
		timePointerSummary("created_from", input.CreatedFrom),
		timePointerSummary("created_to", input.CreatedTo),
	)
}

func summarizeEventReports(input admin.ListEventReportsInput) string {
	return httpapi.JoinSummary(
		httpapi.CountSummary("limit", input.Limit),
		httpapi.CountSummary("offset", input.Offset),
		httpapi.StringPtrSummary("q", input.Query),
		pointerSummary("status", input.Status),
		pointerSummary("report_category", input.ReportCategory),
		uuidPointerSummary("event_id", input.EventID),
		uuidPointerSummary("reporter_user_id", input.ReporterUserID),
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

func boolPointerSummary(label string, value *bool) string {
	if value == nil {
		return label + "=<nil>"
	}
	return httpapi.BoolSummary(label, *value)
}

func timePointerSummary(label string, value *time.Time) string {
	if value == nil {
		return label + "=<nil>"
	}
	return httpapi.StringSummary(label, value.Format(time.RFC3339))
}
