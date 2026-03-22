package server

import (
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driving/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/bootstrap"
	"github.com/gofiber/fiber/v2"
)

// NewHTTP builds a Fiber app with all registered route groups and middleware.
func NewHTTP(container *bootstrap.Container) *fiber.App {
	app := fiber.New()

	app.Use(httpapi.RequestLogger())

	registerHealthRoute(app)

	// Auth routes
	authHandler := httpapi.NewAuthHandler(container.AuthService)
	httpapi.RegisterAuthRoutes(app, authHandler)

	// Register additional route groups below as new services are added, e.g.:
	// eventHandler := httpapi.NewEventHandler(container.EventService)
	// httpapi.RegisterEventRoutes(app, eventHandler)

	return app
}

// registerHealthRoute adds GET /health, used by load balancers and container
// orchestrators to verify the server is ready to accept traffic.
func registerHealthRoute(app *fiber.App) {
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})
}
