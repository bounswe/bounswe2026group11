package event_handler

import (
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
// decisions remain outside the handler.
func RegisterEventRoutes(router fiber.Router, handler *EventHandler, auth fiber.Handler) {
	group := router.Group("/events")
	group.Post("/", auth, handler.CreateEvent)
	group.Post("/:id/join", auth, handler.JoinEvent)
	group.Post("/:id/join-request", auth, handler.RequestJoin)
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

	return c.Status(fiber.StatusCreated).JSON(result)
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

	return c.Status(fiber.StatusCreated).JSON(result)
}

func parseEventIDParam(c *fiber.Ctx) (uuid.UUID, error) {
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.Nil, domain.ValidationError(map[string]string{"id": "must be a valid UUID"})
	}
	return eventID, nil
}
