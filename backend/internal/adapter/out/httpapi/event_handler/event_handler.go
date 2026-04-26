package event_handler

import (
	"fmt"
	"log/slog"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// EventHandler groups HTTP handlers that delegate to the event use-case port.
type EventHandler struct {
	service event.UseCase
}

// NewEventHandler creates an event handler backed by the given event use case.
func NewEventHandler(service event.UseCase) *EventHandler {
	return &EventHandler{service: service}
}

// RegisterEventRoutes mounts all event endpoints under /events.
// The auth middleware is provided by the caller so that route protection
// decisions remain outside the handler. optionalAuth is used for read-only
// public endpoints so unauthenticated users can browse without a token.
func RegisterEventRoutes(router fiber.Router, handler *EventHandler, auth fiber.Handler, optionalAuth fiber.Handler) {
	group := router.Group("/events")
	group.Get("/", optionalAuth, handler.DiscoverEvents)
	group.Get("/:id", optionalAuth, handler.GetEventDetail)
	group.Get("/:id/host-context", auth, handler.GetEventHostContextSummary)
	group.Get("/:id/participants", auth, handler.ListEventApprovedParticipants)
	group.Get("/:id/join-requests", auth, handler.ListEventPendingJoinRequests)
	group.Get("/:id/invitations", auth, handler.ListEventInvitations)
	group.Post("/", auth, handler.CreateEvent)
	group.Post("/:id/join", auth, handler.JoinEvent)
	group.Patch("/:id/leave", auth, handler.LeaveEvent)
	group.Post("/:id/join-request", auth, handler.RequestJoin)
	group.Post("/:id/join-requests/:joinRequestId/approve", auth, handler.ApproveJoinRequest)
	group.Post("/:id/join-requests/:joinRequestId/reject", auth, handler.RejectJoinRequest)
	group.Patch("/:id/cancel", auth, handler.CancelEvent)
	group.Patch("/:id/complete", auth, handler.CompleteEvent)
	group.Post("/:id/favorite", auth, handler.AddFavorite)
	group.Delete("/:id/favorite", auth, handler.RemoveFavorite)
}

// DiscoverEvents handles GET /events.
func (h *EventHandler) DiscoverEvents(c *fiber.Ctx) error {
	input, errs := parseDiscoverEventsInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}

	userID := callerID(c)
	result, err := h.service.DiscoverEvents(c.UserContext(), userID, input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event discovery completed",
		httpapi.OperationAttr("event.discover"),
		httpapi.OptionalUserIDAttr(userID),
		httpapi.QuerySummaryAttr(summarizeDiscoverEventsInput(input)),
		slog.Int("result_count", len(result.Items)),
		slog.Bool("has_next", result.PageInfo.HasNext),
	)

	return c.JSON(result)
}

// GetEventDetail handles GET /events/:id.
func (h *EventHandler) GetEventDetail(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	userID := callerID(c)
	result, err := h.service.GetEventDetail(c.UserContext(), userID, eventID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event detail fetched",
		httpapi.OperationAttr("event.detail"),
		httpapi.OptionalUserIDAttr(userID),
		httpapi.EventIDAttr(eventID),
	)

	c.Set(fiber.HeaderCacheControl, "private, no-store")
	c.Set(fiber.HeaderVary, fiber.HeaderAuthorization)
	return c.JSON(result)
}

// GetEventHostContextSummary handles GET /events/:id/host-context.
func (h *EventHandler) GetEventHostContextSummary(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	result, err := h.service.GetEventHostContextSummary(c.UserContext(), claims.UserID, eventID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event host context fetched",
		httpapi.OperationAttr("event.host_context"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
	)

	return c.JSON(result)
}

// ListEventApprovedParticipants handles GET /events/:id/participants.
func (h *EventHandler) ListEventApprovedParticipants(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	input, errs := parseEventCollectionInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}

	claims := httpapi.UserClaims(c)
	result, err := h.service.ListEventApprovedParticipants(c.UserContext(), claims.UserID, eventID, input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event participants listed",
		httpapi.OperationAttr("event.participants.list"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		httpapi.QuerySummaryAttr(summarizeEventCollectionInput(input)),
		slog.Int("result_count", len(result.Items)),
		slog.Bool("has_next", result.PageInfo.HasNext),
	)

	return c.JSON(result)
}

// ListEventPendingJoinRequests handles GET /events/:id/join-requests.
func (h *EventHandler) ListEventPendingJoinRequests(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	input, errs := parseEventCollectionInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}

	claims := httpapi.UserClaims(c)
	result, err := h.service.ListEventPendingJoinRequests(c.UserContext(), claims.UserID, eventID, input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event join requests listed",
		httpapi.OperationAttr("event.join_requests.list"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		httpapi.QuerySummaryAttr(summarizeEventCollectionInput(input)),
		slog.Int("result_count", len(result.Items)),
		slog.Bool("has_next", result.PageInfo.HasNext),
	)

	return c.JSON(result)
}

// ListEventInvitations handles GET /events/:id/invitations.
func (h *EventHandler) ListEventInvitations(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	input, errs := parseEventCollectionInput(c)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}

	claims := httpapi.UserClaims(c)
	result, err := h.service.ListEventInvitations(c.UserContext(), claims.UserID, eventID, input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event invitations listed",
		httpapi.OperationAttr("event.invitations.list"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		httpapi.QuerySummaryAttr(summarizeEventCollectionInput(input)),
		slog.Int("result_count", len(result.Items)),
		slog.Bool("has_next", result.PageInfo.HasNext),
	)

	return c.JSON(result)
}

// callerID returns the authenticated user's ID, or uuid.Nil for anonymous requests.
func callerID(c *fiber.Ctx) uuid.UUID {
	if claims := httpapi.UserClaims(c); claims != nil {
		return claims.UserID
	}
	return uuid.Nil
}

// CreateEvent handles POST /events.
func (h *EventHandler) CreateEvent(c *fiber.Ctx) error {
	var body createEventBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	claims := httpapi.UserClaims(c)
	input, errs := toCreateEventInput(body)
	if len(errs) > 0 {
		return httpapi.WriteError(c, domain.ValidationError(errs))
	}

	result, err := h.service.CreateEvent(c.UserContext(), claims.UserID, input)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event created",
		httpapi.OperationAttr("event.create"),
		httpapi.UserIDAttr(claims.UserID),
		slog.String("created_event_id", result.ID),
		httpapi.QuerySummaryAttr(summarizeCreateEventInput(input)),
	)

	return c.Status(fiber.StatusCreated).JSON(result)
}

// toCreateEventInput parses wire-format values and maps the request body to the
// application-level create-event DTO.
func toCreateEventInput(body createEventBody) (event.CreateEventInput, map[string]string) {
	input := event.CreateEventInput{
		Title:       body.Title,
		Description: body.Description,
		ImageURL:    body.ImageURL,
		CategoryID:  body.CategoryID,
		Address:     body.Address,
		Lat:         body.Lat,
		Lon:         body.Lon,
		RoutePoints: toRoutePointInputs(body.RoutePoints),
		Capacity:    body.Capacity,
		Tags:        body.Tags,
		Constraints: toConstraintInputs(body.Constraints),
		MinimumAge:  body.MinimumAge,
	}

	errs := make(map[string]string)

	if body.LocationType != "" {
		locationType, ok := domain.ParseEventLocationType(body.LocationType)
		if !ok {
			errs["location_type"] = "must be one of: POINT, ROUTE"
		} else {
			input.LocationType = locationType
		}
	}

	if body.PrivacyLevel != "" {
		privacyLevel, ok := domain.ParseEventPrivacyLevel(body.PrivacyLevel)
		if !ok {
			errs["privacy_level"] = "must be one of: PUBLIC, PROTECTED, PRIVATE"
		} else {
			input.PrivacyLevel = privacyLevel
		}
	}

	if body.StartTime != "" {
		startTime, err := time.Parse(time.RFC3339, body.StartTime)
		if err != nil {
			errs["start_time"] = "must be a valid RFC3339 date-time with timezone"
		} else {
			input.StartTime = startTime
		}
	}

	if body.EndTime != nil {
		endTime, err := time.Parse(time.RFC3339, *body.EndTime)
		if err != nil {
			errs["end_time"] = "must be a valid RFC3339 date-time with timezone"
		} else {
			input.EndTime = &endTime
		}
	}

	if body.PreferredGender != nil {
		gender, ok := domain.ParseEventParticipantGender(*body.PreferredGender)
		if !ok {
			errs["preferred_gender"] = "must be one of: MALE, FEMALE, OTHER"
		} else {
			input.PreferredGender = &gender
		}
	}

	return input, errs
}

// toConstraintInputs converts the HTTP constraint bodies to service-level DTOs.
func toConstraintInputs(bodies []constraintBody) []event.ConstraintInput {
	inputs := make([]event.ConstraintInput, len(bodies))
	for i, b := range bodies {
		inputs[i] = event.ConstraintInput{Type: b.Type, Info: b.Info}
	}
	return inputs
}

// toRoutePointInputs converts HTTP route point bodies to service-level DTOs.
func toRoutePointInputs(points []routePointBody) []event.RoutePointInput {
	inputs := make([]event.RoutePointInput, len(points))
	for i, p := range points {
		inputs[i] = event.RoutePointInput{Lat: p.Lat, Lon: p.Lon}
	}
	return inputs
}

// JoinEvent handles POST /events/:id/join.
// Allows the authenticated user to join a PUBLIC event directly.
func (h *EventHandler) JoinEvent(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	result, err := h.service.JoinEvent(c.UserContext(), claims.UserID, eventID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event joined",
		httpapi.OperationAttr("event.join"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		slog.String("participation_id", result.ParticipationID),
	)

	return c.Status(fiber.StatusCreated).JSON(result)
}

// LeaveEvent handles PATCH /events/:id/leave.
// Allows the authenticated user to leave an event they previously joined.
func (h *EventHandler) LeaveEvent(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	result, err := h.service.LeaveEvent(c.UserContext(), claims.UserID, eventID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event left",
		httpapi.OperationAttr("event.leave"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		slog.String("participation_id", result.ParticipationID),
	)

	return c.JSON(result)
}

// RequestJoin handles POST /events/:id/join-request.
// Allows the authenticated user to submit a join request for a PROTECTED event.
func (h *EventHandler) RequestJoin(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	var body requestJoinBody
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&body); err != nil {
			return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
		}
	}

	claims := httpapi.UserClaims(c)
	result, err := h.service.RequestJoin(c.UserContext(), claims.UserID, eventID, event.RequestJoinInput{
		Message: body.Message,
	})
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event join request created",
		httpapi.OperationAttr("event.join_request.create"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		httpapi.QuerySummaryAttr(httpapi.JoinSummary(httpapi.BoolSummary("has_message", body.Message != nil && strings.TrimSpace(*body.Message) != ""))),
	)

	return c.Status(fiber.StatusCreated).JSON(result)
}

// ApproveJoinRequest handles POST /events/:id/join-requests/:joinRequestId/approve.
// Allows the authenticated host to approve a pending join request.
func (h *EventHandler) ApproveJoinRequest(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	joinRequestID, err := parseJoinRequestIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	result, err := h.service.ApproveJoinRequest(c.UserContext(), claims.UserID, eventID, joinRequestID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event join request approved",
		httpapi.OperationAttr("event.join_request.approve"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		httpapi.JoinRequestIDAttr(joinRequestID),
		slog.String("participation_id", result.ParticipationID),
	)

	return c.JSON(result)
}

// RejectJoinRequest handles POST /events/:id/join-requests/:joinRequestId/reject.
// Allows the authenticated host to reject a pending join request.
func (h *EventHandler) RejectJoinRequest(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	joinRequestID, err := parseJoinRequestIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	result, err := h.service.RejectJoinRequest(c.UserContext(), claims.UserID, eventID, joinRequestID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event join request rejected",
		httpapi.OperationAttr("event.join_request.reject"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		httpapi.JoinRequestIDAttr(joinRequestID),
	)

	return c.JSON(result)
}

// CancelEvent handles PATCH /events/:id/cancel.
// Transitions an ACTIVE event to CANCELED. Only the host may perform this.
func (h *EventHandler) CancelEvent(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	if err := h.service.CancelEvent(c.UserContext(), claims.UserID, eventID); err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event canceled",
		httpapi.OperationAttr("event.cancel"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
	)

	return c.SendStatus(fiber.StatusNoContent)
}

// CompleteEvent handles PATCH /events/:id/complete.
// Transitions an ACTIVE or IN_PROGRESS event to COMPLETED. Only the host may perform this.
func (h *EventHandler) CompleteEvent(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	if err := h.service.CompleteEvent(c.UserContext(), claims.UserID, eventID); err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event completed",
		httpapi.OperationAttr("event.complete"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
	)

	return c.SendStatus(fiber.StatusNoContent)
}

// AddFavorite handles POST /events/:id/favorite.
func (h *EventHandler) AddFavorite(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	if err := h.service.AddFavorite(c.UserContext(), claims.UserID, eventID); err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event favorited",
		httpapi.OperationAttr("event.favorite.add"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
	)

	return c.SendStatus(fiber.StatusNoContent)
}

// RemoveFavorite handles DELETE /events/:id/favorite.
func (h *EventHandler) RemoveFavorite(c *fiber.Ctx) error {
	eventID, err := parseEventIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	if err := h.service.RemoveFavorite(c.UserContext(), claims.UserID, eventID); err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event favorite removed",
		httpapi.OperationAttr("event.favorite.remove"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
	)

	return c.SendStatus(fiber.StatusNoContent)
}

func summarizeDiscoverEventsInput(input event.DiscoverEventsInput) string {
	parts := []string{
		fmt.Sprintf("lat_set=%t", input.Lat != nil),
		fmt.Sprintf("lon_set=%t", input.Lon != nil),
		fmt.Sprintf("radius_meters=%s", optionalIntSummaryValue(input.RadiusMeters)),
		fmt.Sprintf("limit=%s", optionalIntSummaryValue(input.Limit)),
		fmt.Sprintf("q=%s", optionalStringSummaryValue(input.Query)),
		fmt.Sprintf("privacy_levels=%d", len(input.PrivacyLevels)),
		fmt.Sprintf("category_ids=%d", len(input.CategoryIDs)),
		fmt.Sprintf("tag_names=%d", len(input.TagNames)),
		fmt.Sprintf("start_from=%s", optionalTimeSummaryValue(input.StartFrom)),
		fmt.Sprintf("start_to=%s", optionalTimeSummaryValue(input.StartTo)),
		fmt.Sprintf("only_favorited=%t", input.OnlyFavorited),
		fmt.Sprintf("sort_by=%s", optionalSortBySummaryValue(input.SortBy)),
		fmt.Sprintf("cursor=%s", optionalStringSummaryValue(input.Cursor)),
	}
	return strings.Join(parts, " ")
}

func summarizeEventCollectionInput(input event.ListEventCollectionInput) string {
	return httpapi.JoinSummary(
		fmt.Sprintf("limit=%s", optionalIntSummaryValue(input.Limit)),
		fmt.Sprintf("cursor=%s", optionalStringSummaryValue(input.Cursor)),
	)
}

func summarizeCreateEventInput(input event.CreateEventInput) string {
	return httpapi.JoinSummary(
		fmt.Sprintf("category_id=%s", optionalIntSummaryValue(input.CategoryID)),
		fmt.Sprintf("privacy_level=%s", input.PrivacyLevel),
		fmt.Sprintf("location_type=%s", input.LocationType),
		fmt.Sprintf("route_points=%d", len(input.RoutePoints)),
		fmt.Sprintf("tags=%d", len(input.Tags)),
		fmt.Sprintf("constraints=%d", len(input.Constraints)),
		fmt.Sprintf("capacity_set=%t", input.Capacity != nil),
		fmt.Sprintf("minimum_age_set=%t", input.MinimumAge != nil),
		fmt.Sprintf("preferred_gender_set=%t", input.PreferredGender != nil),
		fmt.Sprintf("end_time_set=%t", input.EndTime != nil),
		fmt.Sprintf("image_url_set=%t", input.ImageURL != nil && strings.TrimSpace(*input.ImageURL) != ""),
		fmt.Sprintf("start_time=%s", input.StartTime.UTC().Format(time.RFC3339)),
	)
}

func optionalIntSummaryValue(value *int) string {
	if value == nil {
		return "<nil>"
	}
	return strconv.Itoa(*value)
}

func optionalStringSummaryValue(value *string) string {
	if value == nil {
		return "<nil>"
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return "<empty>"
	}
	return trimmed
}

func optionalTimeSummaryValue(value *time.Time) string {
	if value == nil {
		return "<nil>"
	}
	return value.UTC().Format(time.RFC3339)
}

func optionalSortBySummaryValue(value *domain.EventDiscoverySort) string {
	if value == nil {
		return "<nil>"
	}
	return string(*value)
}

func parseEventIDParam(c *fiber.Ctx) (uuid.UUID, error) {
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.Nil, domain.ValidationError(map[string]string{"id": "must be a valid UUID"})
	}
	return eventID, nil
}

func parseJoinRequestIDParam(c *fiber.Ctx) (uuid.UUID, error) {
	joinRequestID, err := uuid.Parse(c.Params("joinRequestId"))
	if err != nil {
		return uuid.Nil, domain.ValidationError(map[string]string{"joinRequestId": "must be a valid UUID"})
	}
	return joinRequestID, nil
}

func parseDiscoverEventsInput(c *fiber.Ctx) (event.DiscoverEventsInput, map[string]string) {
	values, err := url.ParseQuery(string(c.Context().URI().QueryString()))
	if err != nil {
		return event.DiscoverEventsInput{}, map[string]string{"query": "query string must be valid"}
	}

	input := event.DiscoverEventsInput{}
	errs := make(map[string]string)

	if lat, ok, msg := parseOptionalFloatQuery(c, "lat"); msg != "" {
		errs["lat"] = msg
	} else if ok {
		input.Lat = &lat
	}

	if lon, ok, msg := parseOptionalFloatQuery(c, "lon"); msg != "" {
		errs["lon"] = msg
	} else if ok {
		input.Lon = &lon
	}

	if radius, ok, msg := parseOptionalIntQuery(c, "radius_meters"); msg != "" {
		errs["radius_meters"] = msg
	} else if ok {
		input.RadiusMeters = &radius
	}

	if limit, ok, msg := parseOptionalIntQuery(c, "limit"); msg != "" {
		errs["limit"] = msg
	} else if ok {
		input.Limit = &limit
	}

	if rawQuery := strings.TrimSpace(c.Query("q")); rawQuery != "" {
		input.Query = &rawQuery
	}

	if privacyLevels, msg := parsePrivacyLevels(values, "privacy_levels"); msg != "" {
		errs["privacy_levels"] = msg
	} else {
		input.PrivacyLevels = privacyLevels
	}

	if categoryIDs, msg := parseCategoryIDs(values, "category_ids"); msg != "" {
		errs["category_ids"] = msg
	} else {
		input.CategoryIDs = categoryIDs
	}

	tagNames := parseListQueryValues(values, "tag_names")
	if len(tagNames) > 0 {
		input.TagNames = tagNames
	}

	if startFrom, ok, msg := parseOptionalTimeQuery(c, "start_from"); msg != "" {
		errs["start_from"] = msg
	} else if ok {
		input.StartFrom = &startFrom
	}

	if startTo, ok, msg := parseOptionalTimeQuery(c, "start_to"); msg != "" {
		errs["start_to"] = msg
	} else if ok {
		input.StartTo = &startTo
	}

	if rawOnlyFavorited := strings.TrimSpace(c.Query("only_favorited")); rawOnlyFavorited != "" {
		parsed, err := strconv.ParseBool(rawOnlyFavorited)
		if err != nil {
			errs["only_favorited"] = "only_favorited must be a boolean"
		} else {
			input.OnlyFavorited = parsed
		}
	}

	if rawSortBy := strings.TrimSpace(c.Query("sort_by")); rawSortBy != "" {
		sortBy, ok := domain.ParseEventDiscoverySort(rawSortBy)
		if !ok {
			errs["sort_by"] = "must be one of: START_TIME, DISTANCE, RELEVANCE"
		} else {
			input.SortBy = &sortBy
		}
	}

	if rawCursor := strings.TrimSpace(c.Query("cursor")); rawCursor != "" {
		input.Cursor = &rawCursor
	}

	return input, errs
}

func parseEventCollectionInput(c *fiber.Ctx) (event.ListEventCollectionInput, map[string]string) {
	input := event.ListEventCollectionInput{}
	errs := make(map[string]string)

	if limit, ok, msg := parseOptionalIntQuery(c, "limit"); msg != "" {
		errs["limit"] = msg
	} else if ok {
		input.Limit = &limit
	}

	if rawCursor := strings.TrimSpace(c.Query("cursor")); rawCursor != "" {
		input.Cursor = &rawCursor
	}

	return input, errs
}

func parseOptionalFloatQuery(c *fiber.Ctx, key string) (float64, bool, string) {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return 0, false, ""
	}

	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0, false, key + " must be a valid number"
	}

	return value, true, ""
}

func parseOptionalIntQuery(c *fiber.Ctx, key string) (int, bool, string) {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return 0, false, ""
	}

	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, false, key + " must be a valid integer"
	}

	return value, true, ""
}

func parseOptionalTimeQuery(c *fiber.Ctx, key string) (time.Time, bool, string) {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return time.Time{}, false, ""
	}

	value, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return time.Time{}, false, key + " must be a valid RFC3339 date-time with timezone"
	}

	return value, true, ""
}

func parseCategoryIDs(values url.Values, key string) ([]int, string) {
	rawValues := parseListQueryValues(values, key)
	if len(rawValues) == 0 {
		return nil, ""
	}

	categoryIDs := make([]int, 0, len(rawValues))
	for _, raw := range rawValues {
		value, err := strconv.Atoi(raw)
		if err != nil {
			return nil, "category_ids must contain only integers"
		}
		categoryIDs = append(categoryIDs, value)
	}

	return categoryIDs, ""
}

func parsePrivacyLevels(values url.Values, key string) ([]domain.EventPrivacyLevel, string) {
	rawValues := parseListQueryValues(values, key)
	if len(rawValues) == 0 {
		return nil, ""
	}

	levels := make([]domain.EventPrivacyLevel, 0, len(rawValues))
	for _, raw := range rawValues {
		switch raw {
		case string(domain.PrivacyPublic):
			levels = append(levels, domain.PrivacyPublic)
		case string(domain.PrivacyProtected):
			levels = append(levels, domain.PrivacyProtected)
		default:
			return nil, "privacy_levels must contain only: PUBLIC, PROTECTED"
		}
	}

	return levels, ""
}

func parseListQueryValues(values url.Values, key string) []string {
	rawValues := values[key]
	if len(rawValues) == 0 {
		return nil
	}

	items := make([]string, 0, len(rawValues))
	for _, rawValue := range rawValues {
		parts := strings.Split(rawValue, ",")
		for _, part := range parts {
			trimmed := strings.TrimSpace(part)
			if trimmed == "" {
				continue
			}
			items = append(items, trimmed)
		}
	}

	return items
}
