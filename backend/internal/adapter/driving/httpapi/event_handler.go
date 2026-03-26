package httpapi

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/app/event"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// EventService is the driving port consumed by the event HTTP adapter.
type EventService interface {
	CreateEvent(ctx context.Context, hostID uuid.UUID, input event.CreateEventInput) (*event.CreateEventResult, error)
}

// EventHandler groups HTTP handlers that delegate to the EventService port.
type EventHandler struct {
	service EventService
}

// createEventBody is the JSON request body for POST /events.
type createEventBody struct {
	Title           string           `json:"title"`
	Description     *string          `json:"description"`
	ImageURL        *string          `json:"image_url"`
	CategoryID      *int             `json:"category_id"`
	Address         *string          `json:"address"`
	Lat             *float64         `json:"lat"`
	Lon             *float64         `json:"lon"`
	RoutePoints     []routePointBody `json:"route_points"`
	LocationType    string           `json:"location_type"`
	StartTime       string           `json:"start_time"`
	EndTime         *string          `json:"end_time"`
	Capacity        *int             `json:"capacity"`
	PrivacyLevel    string           `json:"privacy_level"`
	Tags            []string         `json:"tags"`
	Constraints     []constraintBody `json:"constraints"`
	MinimumAge      *int             `json:"minimum_age"`
	PreferredGender *string          `json:"preferred_gender"`
}

// constraintBody represents a single participation constraint in the request.
type constraintBody struct {
	Type string `json:"type"`
	Info string `json:"info"`
}

// routePointBody represents a single route coordinate in the request.
type routePointBody struct {
	Lat *float64 `json:"lat"`
	Lon *float64 `json:"lon"`
}

// NewEventHandler creates an event handler backed by the given service.
func NewEventHandler(service EventService) *EventHandler {
	return &EventHandler{service: service}
}

// RegisterEventRoutes mounts all event endpoints under /events.
// The auth middleware is provided by the caller so that route protection
// decisions remain outside the handler.
func RegisterEventRoutes(router fiber.Router, handler *EventHandler, auth fiber.Handler) {
	group := router.Group("/events")
	group.Post("/", auth, handler.CreateEvent)
}

// CreateEvent handles POST /events.
func (h *EventHandler) CreateEvent(c *fiber.Ctx) error {
	var body createEventBody
	if err := c.BodyParser(&body); err != nil {
		return writeError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	claims := UserClaims(c)
	input := toCreateEventInput(body)

	result, err := h.service.CreateEvent(c.UserContext(), claims.UserID, input)
	if err != nil {
		return writeError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(result)
}

// toCreateEventInput maps the parsed request body to the service input DTO.
func toCreateEventInput(body createEventBody) event.CreateEventInput {
	return event.CreateEventInput{
		Title:           body.Title,
		Description:     body.Description,
		ImageURL:        body.ImageURL,
		CategoryID:      body.CategoryID,
		Address:         body.Address,
		Lat:             body.Lat,
		Lon:             body.Lon,
		RoutePoints:     toRoutePointInputs(body.RoutePoints),
		LocationType:    body.LocationType,
		StartTime:       body.StartTime,
		EndTime:         body.EndTime,
		Capacity:        body.Capacity,
		PrivacyLevel:    body.PrivacyLevel,
		Tags:            body.Tags,
		Constraints:     toConstraintInputs(body.Constraints),
		MinimumAge:      body.MinimumAge,
		PreferredGender: body.PreferredGender,
	}
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
