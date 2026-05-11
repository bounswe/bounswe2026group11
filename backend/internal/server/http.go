package server

import (
	"strings"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/admin_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/auth_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/badge_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/category_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/comment_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/event_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/event_report_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/favorite_location_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/image_upload_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/notification_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/profile_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/rating_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/ticket_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi/user_handler"
	"github.com/bounswe/bounswe2026group11/backend/internal/bootstrap"
	"github.com/bounswe/bounswe2026group11/backend/internal/infrastructure/config"
	"github.com/gofiber/contrib/otelfiber/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

const (
	defaultMaxRequestBodyBytes = 4 * 1024 * 1024
	apiContentSecurityPolicy   = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
)

var defaultCORSAllowedOrigins = []string{
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"http://localhost:8081",
	"http://127.0.0.1:8081",
	"exp://localhost:8081",
	"https://socialeventmapper.com",
	"https://www.socialeventmapper.com",
	"https://*.socialeventmapper.com",
}

// NewHTTP builds a Fiber application with all registered route groups and middleware.
func NewHTTP(container *bootstrap.Container) *fiber.App {
	cfg := container.Config
	app := fiber.New(fiber.Config{
		BodyLimit:               maxRequestBodyBytes(cfg),
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

	installGlobalSecurityMiddleware(app, cfg)

	// otelfiber emits request traces and HTTP metrics; application logs stay
	// focused on high-signal business actions inside handlers.
	app.Use(otelfiber.Middleware())

	// Install i18n translator and resolve the request locale early so every
	// route — including unauthenticated ones — can produce localized error
	// envelopes. The user-preference fallback for authenticated requests is
	// applied by the auth middlewares once they attach claims.
	httpapi.SetTranslator(container.Translator)
	httpapi.SetLocalePreferenceLookup(container.LocalePreferenceLookup())
	app.Use(httpapi.ResolveLocale())

	registerHealthRoute(app)

	// Auth routes
	authHandler := auth_handler.NewAuthHandler(container.AuthService)
	auth_handler.RegisterAuthRoutes(app, authHandler)

	// Event routes
	auth := httpapi.RequireAuth(container.TokenVerifier)
	adminAuth := httpapi.RequireAdmin(container.TokenVerifier)
	optionalAuth := httpapi.OptionalAuth(container.TokenVerifier)

	// Admin backoffice routes (authenticated ADMIN role only)
	adminHandler := admin_handler.NewHandler(container.AdminService)
	admin_handler.RegisterRoutes(app, adminHandler, adminAuth)

	eventHandler := event_handler.NewEventHandler(container.EventService, container.InvitationService)
	event_handler.RegisterEventRoutes(app, eventHandler, auth, optionalAuth)

	// Comment routes
	commentHandler := comment_handler.NewHandler(container.CommentService)
	comment_handler.RegisterRoutes(app, commentHandler, auth, optionalAuth)

	// Event report routes
	eventReportHandler := event_report_handler.NewHandler(container.EventReportService)
	event_report_handler.RegisterRoutes(app, eventReportHandler, auth)

	// Rating routes
	ratingHandler := rating_handler.NewRatingHandler(container.RatingService)
	rating_handler.RegisterRatingRoutes(app, ratingHandler, auth)

	// Ticket routes
	ticketHandler := ticket_handler.NewHandler(container.TicketService)
	ticket_handler.RegisterRoutes(app, ticketHandler, auth)

	// Category routes (public, no auth required)
	categoryHandler := category_handler.NewCategoryHandler(container.CategoryService)
	category_handler.RegisterCategoryRoutes(app, categoryHandler)

	// Profile routes (authenticated)
	profileHandler := profile_handler.NewProfileHandler(container.ProfileService, container.EventService, container.InvitationService)
	profile_handler.RegisterProfileRoutes(app, profileHandler, auth)

	userHandler := user_handler.NewHandler(container.ProfileService)
	user_handler.RegisterRoutes(app, userHandler, auth)

	// Favorite location routes (authenticated)
	favoriteLocationHandler := favorite_location_handler.NewHandler(container.FavoriteLocationService)
	favorite_location_handler.RegisterRoutes(app, favoriteLocationHandler, auth)

	// Push notification device routes (authenticated)
	notificationHandler := notification_handler.NewHandler(container.NotificationService, container.NotificationBroker)
	notification_handler.RegisterRoutes(app, notificationHandler, auth)

	// Direct image upload routes (authenticated)
	imageUploadHandler := image_upload_handler.NewHandler(container.ImageUploadService)
	image_upload_handler.RegisterRoutes(app, imageUploadHandler, auth)

	// Badge routes (authenticated)
	badgeHandler := badge_handler.NewHandler(container.BadgeService)
	badge_handler.RegisterRoutes(app, badgeHandler, auth)

	return app
}

func installGlobalSecurityMiddleware(app *fiber.App, cfg *config.Config) {
	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: strings.Join(corsAllowedOrigins(cfg), ","),
		AllowMethods: strings.Join([]string{
			fiber.MethodGet,
			fiber.MethodPost,
			fiber.MethodPut,
			fiber.MethodPatch,
			fiber.MethodDelete,
			fiber.MethodOptions,
		}, ","),
		AllowHeaders: strings.Join([]string{
			fiber.HeaderAuthorization,
			fiber.HeaderContentType,
			fiber.HeaderAccept,
			fiber.HeaderAcceptLanguage,
			"X-Requested-With",
		}, ","),
	}))
	app.Use(func(c *fiber.Ctx) error {
		c.Set(fiber.HeaderXContentTypeOptions, "nosniff")
		c.Set(fiber.HeaderXFrameOptions, "DENY")
		c.Set(fiber.HeaderReferrerPolicy, "no-referrer")
		c.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		c.Set(fiber.HeaderContentSecurityPolicy, apiContentSecurityPolicy)
		return c.Next()
	})
}

func maxRequestBodyBytes(cfg *config.Config) int {
	if cfg != nil && cfg.MaxRequestBodyBytes > 0 {
		return cfg.MaxRequestBodyBytes
	}
	return defaultMaxRequestBodyBytes
}

func corsAllowedOrigins(cfg *config.Config) []string {
	if cfg != nil && len(cfg.CORSAllowedOrigins) > 0 {
		return cfg.CORSAllowedOrigins
	}
	return defaultCORSAllowedOrigins
}

// registerHealthRoute adds GET /health, used by load balancers and container
// orchestrators to verify the server is ready to accept traffic.
func registerHealthRoute(app *fiber.App) {
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})
}
