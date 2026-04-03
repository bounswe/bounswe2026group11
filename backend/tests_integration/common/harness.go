//go:build integration

package common

import (
	"context"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/hasher"
	jwtadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/jwt"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/otp"
	postgresrepo "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/postgres"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/security"
	authapp "github.com/bounswe/bounswe2026group11/backend/internal/application/auth"
	eventapp "github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	joinrequestapp "github.com/bounswe/bounswe2026group11/backend/internal/application/join_request"
	participationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/participation"
	profileapp "github.com/bounswe/bounswe2026group11/backend/internal/application/profile"
	ratingapp "github.com/bounswe/bounswe2026group11/backend/internal/application/rating"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/jackc/pgx/v5"
)

// AuthHarness bundles the shared wiring used by auth integration tests.
type AuthHarness struct {
	Service       authapp.UseCase
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
	Service        eventapp.UseCase
	EventRepo      *postgresrepo.EventRepository
	RatingService  ratingapp.UseCase
	ProfileService profileapp.UseCase
	AuthRepo       authapp.Repository
}

// NewEventHarness creates an event service that shares the package-level pool.
func NewEventHarness(t *testing.T) *EventHarness {
	t.Helper()

	pool := RequirePool(t)
	eventRepo := postgresrepo.NewEventRepository(pool)
	participationRepo := postgresrepo.NewParticipationRepository(pool)
	joinRequestRepo := postgresrepo.NewJoinRequestRepository(pool)
	ratingRepo := postgresrepo.NewRatingRepository(pool)
	profileRepo := postgresrepo.NewProfileRepository(pool)
	participationService := participationapp.NewService(participationRepo)
	joinRequestService := joinrequestapp.NewService(joinRequestRepo)

	return &EventHarness{
		Service:   eventapp.NewService(eventRepo, participationService, joinRequestService),
		EventRepo: eventRepo,
		RatingService: ratingapp.NewService(ratingRepo, ratingapp.Settings{
			GlobalPrior: 4.0,
			BayesianM:   5,
		}),
		ProfileService: profileapp.NewService(profileRepo),
		AuthRepo:       postgresrepo.NewAuthRepository(pool),
	}
}

// CapturingMailer stores the last OTP email sent by the auth service.
type CapturingMailer struct {
	LastEmail   string
	LastCode    string
	LastExpiry  time.Duration
	LastPurpose string
}

func (m *CapturingMailer) SendRegistrationOTP(_ context.Context, input authapp.OTPMailInput) error {
	m.LastEmail = input.Email
	m.LastCode = input.Code
	m.LastExpiry = input.ExpiresIn
	m.LastPurpose = domain.OTPPurposeRegistration
	return nil
}

func (m *CapturingMailer) SendPasswordResetOTP(_ context.Context, input authapp.OTPMailInput) error {
	m.LastEmail = input.Email
	m.LastCode = input.Code
	m.LastExpiry = input.ExpiresIn
	m.LastPurpose = domain.OTPPurposePasswordReset
	return nil
}

// NoLimitRateLimiter disables rate limiting for deterministic tests.
type NoLimitRateLimiter struct{}

func (NoLimitRateLimiter) Allow(string, time.Time) (bool, time.Duration) {
	return true, 0
}
