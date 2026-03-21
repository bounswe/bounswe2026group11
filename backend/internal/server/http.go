package server

import (
	httpadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/http"
	"github.com/gofiber/fiber/v2"
)

func NewHTTP(authService httpadapter.AuthService) *fiber.App {
	app := fiber.New()

	registerHealthRoute(app)
	httpadapter.RegisterAuthRoutes(app, httpadapter.NewHandler(authService))

	return app
}

func registerHealthRoute(app *fiber.App) {
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})
}
