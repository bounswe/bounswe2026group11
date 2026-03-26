//go:build integration

package common

import (
	"context"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/hasher"
	jwtadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/jwt"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/otp"
	postgresrepo "github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/postgres"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/driven/security"
	authapp "github.com/bounswe/bounswe2026group11/backend/internal/app/auth"
	eventapp "github.com/bounswe/bounswe2026group11/backend/internal/app/event"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/jackc/pgx/v5"
)

// AuthHarness bundles the shared wiring used by auth integration tests.
type AuthHarness struct {
	Service       *authapp.Service
	Repo          *postgresrepo.AuthRepository
	Tx            pgx.Tx
	Mailer        *CapturingMailer
	RefreshTokens security.RefreshTokenManager
	Now           time.Time
}

// NewAuthHarness creates an auth service wired against a rollback-only test transaction.
func NewAuthHarness(t *testing.T) *AuthHarness {
	t.Helper()

	pool, tx := BeginTx(t)
	repo := postgresrepo.NewAuthRepositoryWithTx(pool, tx)
	mailer := &CapturingMailer{}
	refreshTokens := security.RefreshTokenManager{ByteLength: 32}
	now := time.Now().UTC()
	bcryptHasher := hasher.BcryptHasher{Cost: 4}

	service := authapp.NewService(
		repo,
		bcryptHasher,
		bcryptHasher,
		jwtadapter.Issuer{
			Secret: []byte("integration-test-secret"),
			TTL:    15 * time.Minute,
		},
		refreshTokens,
		otp.CodeGenerator{},
		mailer,
		NoLimitRateLimiter{},
		NoLimitRateLimiter{},
		NoLimitRateLimiter{},
		authapp.Config{
			OTPTTL:            10 * time.Minute,
			OTPMaxAttempts:    5,
			OTPResendCooldown: time.Minute,
			RefreshTokenTTL:   14 * 24 * time.Hour,
			MaxSessionTTL:     60 * 24 * time.Hour,
		},
	)

	return &AuthHarness{
		Service:       service,
		Repo:          repo,
		Tx:            tx,
		Mailer:        mailer,
		RefreshTokens: refreshTokens,
		Now:           now,
	}
}

// EventHarness bundles the shared wiring used by event integration tests.
type EventHarness struct {
	Service  *eventapp.Service
	AuthRepo domain.AuthRepository
}

// NewEventHarness creates an event service that shares the package-level pool.
func NewEventHarness(t *testing.T) *EventHarness {
	t.Helper()

	pool := RequirePool(t)
	return &EventHarness{
		Service:  eventapp.NewService(postgresrepo.NewEventRepository(pool)),
		AuthRepo: postgresrepo.NewAuthRepository(pool),
	}
}

// CapturingMailer stores the last OTP email sent by the auth service.
type CapturingMailer struct {
	LastEmail string
	LastCode  string
}

func (m *CapturingMailer) SendRegistrationOTP(_ context.Context, email, code string) error {
	m.LastEmail = email
	m.LastCode = code
	return nil
}

// NoLimitRateLimiter disables rate limiting for deterministic tests.
type NoLimitRateLimiter struct{}

func (NoLimitRateLimiter) Allow(string, time.Time) (bool, time.Duration) {
	return true, 0
}
