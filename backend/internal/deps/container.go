package deps

import (
	"context"
	"fmt"

	"github.com/bounswe/bounswe2026group11/backend/infrastructure"
	httpadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/http"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/postgres"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/auth"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Container is the backend composition root. It owns long-lived infrastructure
// dependencies and exposes application services to the delivery layer.
type Container struct {
	Config      *infrastructure.Config
	DB          *pgxpool.Pool
	AuthService httpadapter.AuthService
}

func New(ctx context.Context) (*Container, error) {
	cfg, err := infrastructure.Load()
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}

	db, err := infrastructure.OpenDB(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	container := &Container{
		Config: cfg,
		DB:     db,
	}

	container.AuthService = newAuthService(container)
	return container, nil
}

func (c *Container) Close() {
	if c == nil || c.DB == nil {
		return
	}
	c.DB.Close()
}

func newAuthService(container *Container) *auth.Service {
	store := postgres.NewAuthStore(container.DB)

	return auth.NewService(
		store,
		infrastructure.BcryptHasher{},
		infrastructure.BcryptHasher{},
		infrastructure.JWTIssuer{
			Secret: []byte(container.Config.JWTSecret),
			TTL:    container.Config.AccessTokenTTL,
		},
		infrastructure.RefreshTokenManager{ByteLength: 32},
		infrastructure.OtpCodeGenerator{},
		infrastructure.MockMailer{},
		infrastructure.NewInMemoryRateLimiter(
			container.Config.OTPRequestLimit,
			container.Config.OTPRequestWindow,
		),
		infrastructure.NewInMemoryRateLimiter(
			container.Config.LoginRateLimit,
			container.Config.LoginRateWindow,
		),
		auth.Config{
			OTPTTL:            container.Config.OTPTTL,
			OTPMaxAttempts:    container.Config.OTPMaxAttempts,
			OTPResendCooldown: container.Config.OTPResendCooldown,
			RefreshTokenTTL:   container.Config.RefreshTokenTTL,
			MaxSessionTTL:     container.Config.MaxSessionTTL,
		},
	)
}
