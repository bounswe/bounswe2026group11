package profile_handler

import (
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/profile"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
)

// ProfileHandler groups HTTP handlers that delegate to the profile use-case port.
type ProfileHandler struct {
	service profile.UseCase
}

// NewProfileHandler creates a profile handler backed by the given use case.
func NewProfileHandler(service profile.UseCase) *ProfileHandler {
	return &ProfileHandler{service: service}
}

// RegisterProfileRoutes mounts all profile endpoints under /me.
func RegisterProfileRoutes(router fiber.Router, handler *ProfileHandler, auth fiber.Handler) {
	me := router.Group("/me", auth)
	me.Get("", handler.GetMyProfile)
	me.Patch("", handler.UpdateMyProfile)
	me.Get("/events/hosted", handler.GetMyHostedEvents)
	me.Get("/events/upcoming", handler.GetMyUpcomingEvents)
	me.Get("/events/completed", handler.GetMyCompletedEvents)
	me.Get("/events/canceled", handler.GetMyCanceledEvents)
}

// GetMyProfile handles GET /me.
func (h *ProfileHandler) GetMyProfile(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)

	result, err := h.service.GetMyProfile(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.JSON(result)
}

// GetMyHostedEvents handles GET /me/events/hosted.
func (h *ProfileHandler) GetMyHostedEvents(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	events, err := h.service.GetMyHostedEvents(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(fiber.Map{"events": events})
}

// GetMyUpcomingEvents handles GET /me/events/upcoming.
func (h *ProfileHandler) GetMyUpcomingEvents(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	events, err := h.service.GetMyUpcomingEvents(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(fiber.Map{"events": events})
}

// GetMyCompletedEvents handles GET /me/events/completed.
func (h *ProfileHandler) GetMyCompletedEvents(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	events, err := h.service.GetMyCompletedEvents(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(fiber.Map{"events": events})
}

// GetMyCanceledEvents handles GET /me/events/canceled.
func (h *ProfileHandler) GetMyCanceledEvents(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	events, err := h.service.GetMyCanceledEvents(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	return c.JSON(fiber.Map{"events": events})
}

// updateProfileBody is the request body for PATCH /me.
type updateProfileBody struct {
	PhoneNumber            *string  `json:"phone_number"`
	Gender                 *string  `json:"gender"`
	BirthDate              *string  `json:"birth_date"`
	DefaultLocationAddress *string  `json:"default_location_address"`
	DefaultLocationLat     *float64 `json:"default_location_lat"`
	DefaultLocationLon     *float64 `json:"default_location_lon"`
	DisplayName            *string  `json:"display_name"`
	Bio                    *string  `json:"bio"`
	AvatarURL              *string  `json:"avatar_url"`
}

// UpdateMyProfile handles PATCH /me.
func (h *ProfileHandler) UpdateMyProfile(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)

	var body updateProfileBody
	if err := c.BodyParser(&body); err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"body": "must be valid JSON"}))
	}

	if err := h.service.UpdateMyProfile(c.UserContext(), profile.UpdateProfileInput{
		UserID:                 claims.UserID,
		PhoneNumber:            body.PhoneNumber,
		Gender:                 body.Gender,
		BirthDate:              body.BirthDate,
		DefaultLocationAddress: body.DefaultLocationAddress,
		DefaultLocationLat:     body.DefaultLocationLat,
		DefaultLocationLon:     body.DefaultLocationLon,
		DisplayName:            body.DisplayName,
		Bio:                    body.Bio,
		AvatarURL:              body.AvatarURL,
	}); err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}
