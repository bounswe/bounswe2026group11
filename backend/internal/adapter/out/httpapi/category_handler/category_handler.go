package category_handler

import (
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/category"
	"github.com/gofiber/fiber/v2"
)

// CategoryHandler groups HTTP handlers that delegate to the category use-case port.
type CategoryHandler struct {
	service category.UseCase
}

// NewCategoryHandler creates a category handler backed by the given use case.
func NewCategoryHandler(service category.UseCase) *CategoryHandler {
	return &CategoryHandler{service: service}
}

// RegisterCategoryRoutes mounts all category endpoints under /categories.
func RegisterCategoryRoutes(router fiber.Router, handler *CategoryHandler) {
	router.Get("/categories", handler.ListCategories)
}

// ListCategories handles GET /categories.
func (h *CategoryHandler) ListCategories(c *fiber.Ctx) error {
	result, err := h.service.ListCategories(c.UserContext())
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	return c.JSON(result)
}
