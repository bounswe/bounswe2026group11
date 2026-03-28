package bootstrap

import (
	"context"
	"fmt"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/hasher"
	jwtadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/jwt"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/otp"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/postgres"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/ratelimit"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/security"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/auth"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/category"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/join_request"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/participation"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/internal/infrastructure/config"
	"github.com/bounswe/bounswe2026group11/backend/internal/infrastructure/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Container is the backend composition root. It owns long-lived infrastructure
// dependencies and exposes application services to the delivery layer.
type Container struct {
	Config               *config.Config
	DB                   *pgxpool.Pool
	TokenIssuer          auth.TokenIssuer
	TokenVerifier        domain.TokenVerifier
	authRepo             *postgres.AuthRepository
	eventRepo            *postgres.EventRepository
	participationRepo    *postgres.ParticipationRepository
	joinRequestRepo      *postgres.JoinRequestRepository
	categoryRepo         *postgres.CategoryRepository
	AuthService          auth.UseCase
	EventService         event.UseCase
	ParticipationService participation.UseCase
	JoinRequestService   join_request.UseCase
	CategoryService      category.UseCase
	// Extend with additional services as features are added, for example:
	// SearchService httpapi.SearchService
}

// New initializes infrastructure (config, database) and wires all application
// services. The returned Container must be closed when the application exits.
func New(ctx context.Context) (*Container, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}

	db, err := database.OpenDB(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	container := &Container{
		Config:        cfg,
		DB:            db,
		TokenIssuer:   buildTokenIssuer(cfg),
		TokenVerifier: buildTokenVerifier(cfg),
	}
	container.authRepo = postgres.NewAuthRepository(container.DB)
	container.eventRepo = postgres.NewEventRepository(container.DB)
	container.participationRepo = postgres.NewParticipationRepository(container.DB)
	container.joinRequestRepo = postgres.NewJoinRequestRepository(container.DB)
	container.categoryRepo = postgres.NewCategoryRepository(container.DB)
	container.ParticipationService = newParticipationService(container)
	container.JoinRequestService = newJoinRequestService(container)
	container.AuthService = newAuthService(container)
	container.EventService = newEventService(container)
	container.CategoryService = newCategoryService(container)
	return container, nil
}

// Close releases all long-lived resources (e.g. database connections).
func (c *Container) Close() {
	if c == nil || c.DB == nil {
		return
	}
	c.DB.Close()
}

// buildTokenIssuer constructs the JWT token issuer adapter.
func buildTokenIssuer(cfg *config.Config) jwtadapter.Issuer {
	return jwtadapter.Issuer{
		Secret: []byte(cfg.JWTSecret),
		TTL:    cfg.AccessTokenTTL,
	}
}

// buildTokenVerifier constructs the JWT token verifier adapter.
func buildTokenVerifier(cfg *config.Config) jwtadapter.Verifier {
	return jwtadapter.Verifier{
		Secret: []byte(cfg.JWTSecret),
	}
}

// newEventService wires the event use case with its driven adapters.
func newEventService(c *Container) event.UseCase {
	return event.NewService(c.eventRepo, c.ParticipationService, c.JoinRequestService)
}

// newParticipationService wires the participation use-case service with its
// driven adapter.
func newParticipationService(c *Container) participation.UseCase {
	return participation.NewService(c.participationRepo)
}

// newJoinRequestService wires the join request use-case service with its
// driven adapter.
func newJoinRequestService(c *Container) join_request.UseCase {
	return join_request.NewService(c.joinRequestRepo)
}

// newCategoryService wires the category use-case service with its driven adapter.
func newCategoryService(c *Container) category.UseCase {
	return category.NewService(c.categoryRepo)
}

// newAuthService wires the auth use-case service with its driven adapters.
func newAuthService(c *Container) auth.UseCase {
	return auth.NewService(
		c.authRepo,
		hasher.BcryptHasher{},
		hasher.BcryptHasher{},
		c.TokenIssuer,
		security.RefreshTokenManager{ByteLength: 32},
		otp.CodeGenerator{},
		otp.MockMailer{},
		ratelimit.NewInMemoryRateLimiter(
			c.Config.OTPRequestLimit,
			c.Config.OTPRequestWindow,
		),
		ratelimit.NewInMemoryRateLimiter(
			c.Config.LoginRateLimit,
			c.Config.LoginRateWindow,
		),
		ratelimit.NewInMemoryRateLimiter(
			c.Config.AvailabilityRateLimit,
			c.Config.AvailabilityRateWindow,
		),
		auth.Config{
			OTPTTL:            c.Config.OTPTTL,
			OTPMaxAttempts:    c.Config.OTPMaxAttempts,
			OTPResendCooldown: c.Config.OTPResendCooldown,
			RefreshTokenTTL:   c.Config.RefreshTokenTTL,
			MaxSessionTTL:     c.Config.MaxSessionTTL,
		},
	)
}
