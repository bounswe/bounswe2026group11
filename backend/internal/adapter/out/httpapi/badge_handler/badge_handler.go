package badge_handler

import (
	"log/slog"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/badge"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Handler exposes HTTP routes for the badge use cases.
type Handler struct {
	service badge.UseCase
}

// NewHandler constructs a badge handler delegating to the given use case.
func NewHandler(service badge.UseCase) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes wires the badge routes onto the given fiber router.
//
// Routes registered:
//   - GET /me/badges            (authenticated viewer's earned badges)
//   - GET /users/:id/badges     (public profile owner's earned badges)
//   - GET /badges               (full catalog with viewer earned status)
func RegisterRoutes(router fiber.Router, handler *Handler, auth fiber.Handler) {
	router.Get("/me/badges", auth, handler.ListMyBadges)
	router.Get("/users/:id/badges", auth, handler.ListUserBadges)
	router.Get("/badges", auth, handler.ListBadgeCatalog)
}

// ListMyBadges handles GET /me/badges.
func (h *Handler) ListMyBadges(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	result, err := h.service.ListMyBadges(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"my badges fetched",
		httpapi.OperationAttr("badges.list_mine"),
		httpapi.UserIDAttr(claims.UserID),
		slog.Int("result_count", len(result.Items)),
	)
	return c.JSON(result)
}

// ListUserBadges handles GET /users/:id/badges.
func (h *Handler) ListUserBadges(c *fiber.Ctx) error {
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"id": "must be a valid UUID"}))
	}
	result, err := h.service.ListUserBadges(c.UserContext(), userID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	httpapi.LogInfo(
		c.UserContext(),
		"user badges fetched",
		httpapi.OperationAttr("badges.list_user"),
		httpapi.UserIDAttr(claims.UserID),
		slog.String("target_user_id", userID.String()),
		slog.Int("result_count", len(result.Items)),
	)
	return c.JSON(result)
}

// ListBadgeCatalog handles GET /badges.
func (h *Handler) ListBadgeCatalog(c *fiber.Ctx) error {
	claims := httpapi.UserClaims(c)
	result, err := h.service.ListBadges(c.UserContext(), claims.UserID)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"badge catalog fetched",
		httpapi.OperationAttr("badges.list_catalog"),
		httpapi.UserIDAttr(claims.UserID),
		slog.Int("result_count", len(result.Items)),
	)
	return c.JSON(result)
}
