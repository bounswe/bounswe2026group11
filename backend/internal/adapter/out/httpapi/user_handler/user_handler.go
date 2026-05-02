package user_handler

import (
	"log/slog"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/profile"
	"github.com/gofiber/fiber/v2"
)

type Handler struct {
	service profile.UseCase
}

func NewHandler(service profile.UseCase) *Handler {
	return &Handler{service: service}
}

func RegisterRoutes(router fiber.Router, handler *Handler, auth fiber.Handler) {
	users := router.Group("/users", auth)
	users.Get("/search", handler.SearchUsers)
}

func (h *Handler) SearchUsers(c *fiber.Ctx) error {
	result, err := h.service.SearchUsers(c.UserContext(), profile.UserSearchInput{Query: c.Query("query")})
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	httpapi.LogInfo(
		c.UserContext(),
		"users searched",
		httpapi.OperationAttr("users.search"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.QuerySummaryAttr("has_query=true"),
		slog.Int("result_count", len(result.Items)),
	)

	return c.JSON(result)
}
