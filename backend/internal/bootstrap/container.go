package bootstrap

import (
	"context"
	"fmt"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/hasher"
	jwtadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/jwt"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/otp"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/postgres"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/ratelimit"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/security"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driving/httpapi"
	"github.com/bounswe/bounswe2026group11/backend/internal/app/auth"
	"github.com/bounswe/bounswe2026group11/backend/internal/platform/config"
	"github.com/bounswe/bounswe2026group11/backend/internal/platform/database"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Container is the backend composition root. It owns long-lived infrastructure
// dependencies and exposes application services to the delivery layer.
type Container struct {
	Config      *config.Config
	DB          *pgxpool.Pool
	AuthService httpapi.AuthService
	TokenIssuer   domain.TokenIssuer
	TokenVerifier domain.TokenVerifier
	// Extend with additional services as features are added, for example:
	// EventService httpapi.EventService
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

    jwtIssuer := jwtadapter.Issuer{
        Secret: []byte(cfg.JWTSecret),
        TTL:    cfg.AccessTokenTTL,
    }

    container := &Container{
        Config:        cfg,
        DB:            db,
		TokenIssuer:   jwtIssuer,
        TokenVerifier: jwtIssuer,
    }
    container.AuthService = newAuthService(container)
    return container, nil
}

// Close releases all long-lived resources (e.g. database connections).
func (c *Container) Close() {
	if c == nil || c.DB == nil {
		return
	}
	c.DB.Close()
}

// newAuthService wires the auth use-case service with its driven adapters.
func newAuthService(c *Container) *auth.Service {
    repo := postgres.NewAuthRepository(c.DB)
    return auth.NewService(
        repo,
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
        auth.Config{
            OTPTTL:            c.Config.OTPTTL,
            OTPMaxAttempts:    c.Config.OTPMaxAttempts,
            OTPResendCooldown: c.Config.OTPResendCooldown,
            RefreshTokenTTL:   c.Config.RefreshTokenTTL,
            MaxSessionTTL:     c.Config.MaxSessionTTL,
        },
    )
}
