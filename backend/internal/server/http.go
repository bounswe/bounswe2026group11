package server

import (
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/auth_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/event_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/bootstrap"
	"github.com/gofiber/fiber/v2"
)

// NewHTTP builds a Fiber application with all registered route groups and middleware.
func NewHTTP(container *bootstrap.Container) *fiber.App {
	app := fiber.New(fiber.Config{
		ProxyHeader:             "X-Real-IP",
		EnableTrustedProxyCheck: true,
		TrustedProxies: []string{
			"127.0.0.1",
			"::1",
			"10.0.0.0/8",
			"172.16.0.0/12",
			"192.168.0.0/16",
		},
	})

	app.Use(httpapi.RequestLogger())

	registerHealthRoute(app)

	// Auth routes
	authHandler := auth_handler.NewAuthHandler(container.AuthService)
	auth_handler.RegisterAuthRoutes(app, authHandler)

	// Event routes
	eventHandler := event_handler.NewEventHandler(container.EventService)
	event_handler.RegisterEventRoutes(app, eventHandler, httpapi.RequireAuth(container.TokenVerifier))

	return app
}

// registerHealthRoute adds GET /health, used by load balancers and container
// orchestrators to verify the server is ready to accept traffic.
func registerHealthRoute(app *fiber.App) {
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})
}
