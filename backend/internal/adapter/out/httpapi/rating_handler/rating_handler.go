package rating_handler

import (
	"log/slog"
	"strings"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	ratingapp "github.com/bounswe/bounswe2026group11/backend/internal/application/rating"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// RatingHandler groups HTTP handlers that delegate to the rating use-case port.
type RatingHandler struct {
	service ratingapp.UseCase
}

// NewRatingHandler creates a rating handler backed by the given rating use case.
func NewRatingHandler(service ratingapp.UseCase) *RatingHandler {
	return &RatingHandler{service: service}
}

// RegisterRatingRoutes mounts all rating endpoints under /events.
func RegisterRatingRoutes(router fiber.Router, handler *RatingHandler, auth fiber.Handler) {
	group := router.Group("/events")
	group.Put("/:id/rating", auth, handler.UpsertEventRating)
	group.Delete("/:id/rating", auth, handler.DeleteEventRating)
	group.Put("/:id/participants/:participantUserId/rating", auth, handler.UpsertParticipantRating)
	group.Delete("/:id/participants/:participantUserId/rating", auth, handler.DeleteParticipantRating)
}

// UpsertEventRating handles PUT /events/:id/rating.
func (h *RatingHandler) UpsertEventRating(c *fiber.Ctx) error {
	eventID, err := parseUUIDParam(c, "id")
	if err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"id": "must be a valid UUID"}))
	}

	input, err := parseUpsertRatingBody(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	result, svcErr := h.service.UpsertEventRating(c.UserContext(), claims.UserID, eventID, input)
	if svcErr != nil {
		return httpapi.WriteError(c, svcErr)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event rating upserted",
		httpapi.OperationAttr("rating.event.upsert"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		slog.Int("rating", input.Rating),
		slog.Bool("has_message", input.Message != nil && strings.TrimSpace(*input.Message) != ""),
	)

	return c.JSON(result)
}

// DeleteEventRating handles DELETE /events/:id/rating.
func (h *RatingHandler) DeleteEventRating(c *fiber.Ctx) error {
	eventID, err := parseUUIDParam(c, "id")
	if err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"id": "must be a valid UUID"}))
	}

	claims := httpapi.UserClaims(c)
	if err := h.service.DeleteEventRating(c.UserContext(), claims.UserID, eventID); err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event rating deleted",
		httpapi.OperationAttr("rating.event.delete"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
	)

	return c.SendStatus(fiber.StatusNoContent)
}

// UpsertParticipantRating handles PUT /events/:id/participants/:participantUserId/rating.
func (h *RatingHandler) UpsertParticipantRating(c *fiber.Ctx) error {
	eventID, err := parseUUIDParam(c, "id")
	if err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"id": "must be a valid UUID"}))
	}
	participantUserID, err := parseUUIDParam(c, "participantUserId")
	if err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"participantUserId": "must be a valid UUID"}))
	}

	input, err := parseUpsertRatingBody(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	result, svcErr := h.service.UpsertParticipantRating(c.UserContext(), claims.UserID, eventID, participantUserID, input)
	if svcErr != nil {
		return httpapi.WriteError(c, svcErr)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"participant rating upserted",
		httpapi.OperationAttr("rating.participant.upsert"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		httpapi.ParticipantUserIDAttr(participantUserID),
		slog.Int("rating", input.Rating),
		slog.Bool("has_message", input.Message != nil && strings.TrimSpace(*input.Message) != ""),
	)

	return c.JSON(result)
}

// DeleteParticipantRating handles DELETE /events/:id/participants/:participantUserId/rating.
func (h *RatingHandler) DeleteParticipantRating(c *fiber.Ctx) error {
	eventID, err := parseUUIDParam(c, "id")
	if err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"id": "must be a valid UUID"}))
	}
	participantUserID, err := parseUUIDParam(c, "participantUserId")
	if err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"participantUserId": "must be a valid UUID"}))
	}

	claims := httpapi.UserClaims(c)
	if err := h.service.DeleteParticipantRating(c.UserContext(), claims.UserID, eventID, participantUserID); err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"participant rating deleted",
		httpapi.OperationAttr("rating.participant.delete"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		httpapi.ParticipantUserIDAttr(participantUserID),
	)

	return c.SendStatus(fiber.StatusNoContent)
}

func parseUUIDParam(c *fiber.Ctx, name string) (uuid.UUID, error) {
	return uuid.Parse(c.Params(name))
}

func parseUpsertRatingBody(c *fiber.Ctx) (ratingapp.UpsertRatingInput, error) {
	var body upsertRatingBody
	if err := c.BodyParser(&body); err != nil {
		return ratingapp.UpsertRatingInput{}, domain.ValidationError(map[string]string{"body": "must be valid JSON"})
	}

	return ratingapp.UpsertRatingInput{
		Rating:  body.Rating,
		Message: body.Message,
	}, nil
}
