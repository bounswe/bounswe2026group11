package profile_handler

import (
	"log/slog"
	"strings"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/invitation"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/profile"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// ProfileHandler groups HTTP handlers that delegate to the profile use-case port.
type ProfileHandler struct {
	service           profile.UseCase
	eventService      event.UseCase
	invitationService invitation.UseCase
}

// NewProfileHandler creates a profile handler backed by the given use cases.
func NewProfileHandler(service profile.UseCase, eventService event.UseCase, invitationService ...invitation.UseCase) *ProfileHandler {
	handler := &ProfileHandler{service: service, eventService: eventService}
	if len(invitationService) > 0 {
		handler.invitationService = invitationService[0]
	}
	return handler
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
	me.Get("/favorites", handler.ListFavoriteEvents)
	me.Get("/invitations", handler.ListReceivedInvitations)
	me.Post("/invitations/:invitationId/accept", handler.AcceptInvitation)
	me.Post("/invitations/:invitationId/decline", handler.DeclineInvitation)
}

// GetMyProfile handles GET /me.
func (h *ProfileHandler) GetMyProfile(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)

	result, err := h.service.GetMyProfile(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"my profile fetched",
		httpapi.OperationAttr("profile.get"),
		httpapi.UserIDAttr(claims.UserID),
	)

	return c.JSON(result)
}

// GetMyHostedEvents handles GET /me/events/hosted.
func (h *ProfileHandler) GetMyHostedEvents(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	events, err := h.service.GetMyHostedEvents(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"my hosted events fetched",
		httpapi.OperationAttr("profile.events.hosted"),
		httpapi.UserIDAttr(claims.UserID),
		slog.Int("result_count", len(events)),
	)
	return c.JSON(fiber.Map{"events": events})
}

// GetMyUpcomingEvents handles GET /me/events/upcoming.
func (h *ProfileHandler) GetMyUpcomingEvents(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	events, err := h.service.GetMyUpcomingEvents(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"my upcoming events fetched",
		httpapi.OperationAttr("profile.events.upcoming"),
		httpapi.UserIDAttr(claims.UserID),
		slog.Int("result_count", len(events)),
	)
	return c.JSON(fiber.Map{"events": events})
}

// GetMyCompletedEvents handles GET /me/events/completed.
func (h *ProfileHandler) GetMyCompletedEvents(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	events, err := h.service.GetMyCompletedEvents(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"my completed events fetched",
		httpapi.OperationAttr("profile.events.completed"),
		httpapi.UserIDAttr(claims.UserID),
		slog.Int("result_count", len(events)),
	)
	return c.JSON(fiber.Map{"events": events})
}

// GetMyCanceledEvents handles GET /me/events/canceled.
func (h *ProfileHandler) GetMyCanceledEvents(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	events, err := h.service.GetMyCanceledEvents(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"my canceled events fetched",
		httpapi.OperationAttr("profile.events.canceled"),
		httpapi.UserIDAttr(claims.UserID),
		slog.Int("result_count", len(events)),
	)
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

	httpapi.LogInfo(
		c.UserContext(),
		"my profile updated",
		httpapi.OperationAttr("profile.update"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.QuerySummaryAttr(summarizeUpdatedProfileFields(body)),
	)

	return c.SendStatus(fiber.StatusNoContent)
}

// ListFavoriteEvents handles GET /me/favorites.
func (h *ProfileHandler) ListFavoriteEvents(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	result, err := h.eventService.ListFavoriteEvents(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"my favorite events fetched",
		httpapi.OperationAttr("profile.favorites.list"),
		httpapi.UserIDAttr(claims.UserID),
		slog.Int("result_count", len(result.Items)),
	)

	return c.JSON(result)
}

// ListReceivedInvitations handles GET /me/invitations.
func (h *ProfileHandler) ListReceivedInvitations(c *fiber.Ctx) error {
	if h.invitationService == nil {
		return httpapi.WriteError(c, domain.ConflictError(domain.ErrorCodeInvitationNotAllowed, "Invitations are not available."))
	}
	claims := httpapi.UserClaims(c)
	result, err := h.invitationService.ListReceivedInvitations(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"my invitations fetched",
		httpapi.OperationAttr("profile.invitations.list"),
		httpapi.UserIDAttr(claims.UserID),
		slog.Int("result_count", len(result.Items)),
	)
	return c.JSON(result)
}

// AcceptInvitation handles POST /me/invitations/:invitationId/accept.
func (h *ProfileHandler) AcceptInvitation(c *fiber.Ctx) error {
	if h.invitationService == nil {
		return httpapi.WriteError(c, domain.ConflictError(domain.ErrorCodeInvitationNotAllowed, "Invitations are not available."))
	}
	invitationID, err := parseInvitationIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	claims := httpapi.UserClaims(c)
	result, err := h.invitationService.AcceptInvitation(c.UserContext(), claims.UserID, invitationID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"invitation accepted",
		httpapi.OperationAttr("profile.invitations.accept"),
		httpapi.UserIDAttr(claims.UserID),
		slog.String("invitation_id", invitationID.String()),
		slog.String("participation_id", result.ParticipationID),
	)
	return c.JSON(result)
}

// DeclineInvitation handles POST /me/invitations/:invitationId/decline.
func (h *ProfileHandler) DeclineInvitation(c *fiber.Ctx) error {
	if h.invitationService == nil {
		return httpapi.WriteError(c, domain.ConflictError(domain.ErrorCodeInvitationNotAllowed, "Invitations are not available."))
	}
	invitationID, err := parseInvitationIDParam(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}
	claims := httpapi.UserClaims(c)
	result, err := h.invitationService.DeclineInvitation(c.UserContext(), claims.UserID, invitationID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"invitation declined",
		httpapi.OperationAttr("profile.invitations.decline"),
		httpapi.UserIDAttr(claims.UserID),
		slog.String("invitation_id", invitationID.String()),
	)
	return c.JSON(result)
}

func parseInvitationIDParam(c *fiber.Ctx) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Params("invitationId"))
	if err != nil {
		return uuid.Nil, domain.ValidationError(map[string]string{"invitation_id": "must be a valid UUID"})
	}
	return id, nil
}

func summarizeUpdatedProfileFields(body updateProfileBody) string {
	fields := make([]string, 0, 9)
	if body.PhoneNumber != nil {
		fields = append(fields, "phone_number")
	}
	if body.Gender != nil {
		fields = append(fields, "gender")
	}
	if body.BirthDate != nil {
		fields = append(fields, "birth_date")
	}
	if body.DefaultLocationAddress != nil {
		fields = append(fields, "default_location_address")
	}
	if body.DefaultLocationLat != nil {
		fields = append(fields, "default_location_lat")
	}
	if body.DefaultLocationLon != nil {
		fields = append(fields, "default_location_lon")
	}
	if body.DisplayName != nil {
		fields = append(fields, "display_name")
	}
	if body.Bio != nil {
		fields = append(fields, "bio")
	}
	if body.AvatarURL != nil {
		fields = append(fields, "avatar_url")
	}
	if len(fields) == 0 {
		return "updated_fields=<none>"
	}
	return "updated_fields=" + strings.Join(fields, ",")
}
