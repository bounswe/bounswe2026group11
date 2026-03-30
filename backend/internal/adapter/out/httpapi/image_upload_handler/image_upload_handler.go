package image_upload_handler

import (
	"strings"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Handler groups HTTP handlers that delegate to the image-upload use case.
type Handler struct {
	service imageupload.UseCase
}

// NewHandler constructs an image upload handler.
func NewHandler(service imageupload.UseCase) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts all image-upload endpoints under /me and /events.
func RegisterRoutes(router fiber.Router, handler *Handler, auth fiber.Handler) {
	me := router.Group("/me", auth)
	me.Post("/avatar/upload-url", handler.CreateProfileAvatarUpload)
	me.Post("/avatar/confirm", handler.ConfirmProfileAvatarUpload)

	events := router.Group("/events", auth)
	events.Post("/:id/image/upload-url", handler.CreateEventImageUpload)
	events.Post("/:id/image/confirm", handler.ConfirmEventImageUpload)
}

// CreateProfileAvatarUpload handles POST /me/avatar/upload-url.
func (h *Handler) CreateProfileAvatarUpload(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)

	result, err := h.service.CreateProfileAvatarUpload(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.JSON(result)
}

// ConfirmProfileAvatarUpload handles POST /me/avatar/confirm.
func (h *Handler) ConfirmProfileAvatarUpload(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)

	body, err := parseConfirmBody(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	if err := h.service.ConfirmProfileAvatarUpload(c.UserContext(), claims.UserID, body); err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// CreateEventImageUpload handles POST /events/:id/image/upload-url.
func (h *Handler) CreateEventImageUpload(c *fiber.Ctx) error {
	eventID, err := parseEventID(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	result, err := h.service.CreateEventImageUpload(c.UserContext(), claims.UserID, eventID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.JSON(result)
}

// ConfirmEventImageUpload handles POST /events/:id/image/confirm.
func (h *Handler) ConfirmEventImageUpload(c *fiber.Ctx) error {
	eventID, err := parseEventID(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	body, err := parseConfirmBody(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	if err := h.service.ConfirmEventImageUpload(c.UserContext(), claims.UserID, eventID, body); err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

type confirmBody struct {
	ConfirmToken string `json:"confirm_token"`
}

func parseConfirmBody(c *fiber.Ctx) (imageupload.ConfirmUploadInput, error) {
	var body confirmBody
	if err := c.BodyParser(&body); err != nil {
		return imageupload.ConfirmUploadInput{}, domain.ValidationError(map[string]string{"body": "must be valid JSON"})
	}
	if strings.TrimSpace(body.ConfirmToken) == "" {
		return imageupload.ConfirmUploadInput{}, domain.ValidationError(map[string]string{"confirm_token": "confirm_token is required"})
	}

	return imageupload.ConfirmUploadInput{ConfirmToken: body.ConfirmToken}, nil
}

func parseEventID(c *fiber.Ctx) (uuid.UUID, error) {
	eventID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.Nil, domain.ValidationError(map[string]string{"id": "must be a valid UUID"})
	}
	return eventID, nil
}
