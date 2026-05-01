//go:build integration

package common

import (
	"context"
	"testing"
	"time"

	pushadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/firebasepush"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/hasher"
	jwtadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/jwt"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/otp"
	postgresrepo "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/postgres"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/security"
	authapp "github.com/bounswe/bounswe2026group11/backend/internal/application/auth"
	eventapp "github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	favoritelocationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/favorite_location"
	invitationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/invitation"
	joinrequestapp "github.com/bounswe/bounswe2026group11/backend/internal/application/join_request"
	notificationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/notification"
	participationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/participation"
	profileapp "github.com/bounswe/bounswe2026group11/backend/internal/application/profile"
	ratingapp "github.com/bounswe/bounswe2026group11/backend/internal/application/rating"
	ticketapp "github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
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
	unitOfWork := postgresrepo.NewUnitOfWorkWithTx(pool, tx)
	mailer := &CapturingMailer{}
	refreshTokens := security.RefreshTokenManager{ByteLength: 32}
	now := time.Now().UTC()
	bcryptHasher := hasher.BcryptHasher{Cost: 4}

	service := authapp.NewService(
		repo,
		unitOfWork,
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
	Service             eventapp.UseCase
	InvitationService   invitationapp.UseCase
	NotificationService notificationapp.UseCase
	EventRepo           *postgresrepo.EventRepository
	TicketService       ticketapp.UseCase
	RatingService       ratingapp.UseCase
	ProfileService      profileapp.UseCase
	AuthRepo            authapp.Repository
}

// FavoriteLocationHarness bundles the shared wiring used by favorite-location integration tests.
type FavoriteLocationHarness struct {
	Service  favoritelocationapp.UseCase
	Repo     *postgresrepo.FavoriteLocationRepository
	AuthRepo authapp.Repository
}

// NotificationHarness bundles notification wiring against a rollback-only transaction.
type NotificationHarness struct {
	Service  notificationapp.UseCase
	Repo     *postgresrepo.NotificationRepository
	AuthRepo authapp.Repository
	Tx       pgx.Tx
}

// NewEventHarness creates an event service that shares the package-level pool.
func NewEventHarness(t *testing.T) *EventHarness {
	t.Helper()

	pool := RequirePool(t)
	eventRepo := postgresrepo.NewEventRepository(pool)
	participationRepo := postgresrepo.NewParticipationRepository(pool)
	invitationRepo := postgresrepo.NewInvitationRepository(pool)
	joinRequestRepo := postgresrepo.NewJoinRequestRepository(pool)
	ticketRepo := postgresrepo.NewTicketRepository(pool)
	ratingRepo := postgresrepo.NewRatingRepository(pool)
	profileRepo := postgresrepo.NewProfileRepository(pool)
	notificationRepo := postgresrepo.NewNotificationRepository(pool)
	unitOfWork := postgresrepo.NewUnitOfWork(pool)
	participationService := participationapp.NewService(participationRepo)
	notificationService := notificationapp.NewService(notificationRepo, pushadapter.MockSender{}, unitOfWork)
	ticketService := ticketapp.NewService(
		ticketRepo,
		unitOfWork,
		jwtadapter.TicketTokenManager{Secret: []byte("integration-test-secret")},
		ticketapp.Settings{
			QRTokenTTL:      10 * time.Second,
			ProximityMeters: 200,
		},
	)
	joinRequestService := joinrequestapp.NewService(joinRequestRepo, unitOfWork, ticketService)
	joinRequestService.SetNotificationService(notificationService)
	invitationService := invitationapp.NewService(invitationRepo, unitOfWork, ticketService)
	invitationService.SetNotificationService(notificationService)

	return &EventHarness{
		Service:             eventapp.NewService(eventRepo, participationService, joinRequestService, unitOfWork, ticketService),
		InvitationService:   invitationService,
		NotificationService: notificationService,
		EventRepo:           eventRepo,
		TicketService:       ticketService,
		RatingService: ratingapp.NewService(ratingRepo, unitOfWork, ratingapp.Settings{
			GlobalPrior: 4.0,
			BayesianM:   5,
		}),
		ProfileService: profileapp.NewService(profileRepo, unitOfWork),
		AuthRepo:       postgresrepo.NewAuthRepository(pool),
	}
}

// NewFavoriteLocationHarness creates a favorite-location service backed by the shared integration database.
func NewFavoriteLocationHarness(t *testing.T) *FavoriteLocationHarness {
	t.Helper()

	pool := RequirePool(t)
	repo := postgresrepo.NewFavoriteLocationRepository(pool)
	unitOfWork := postgresrepo.NewUnitOfWork(pool)

	return &FavoriteLocationHarness{
		Service:  favoritelocationapp.NewService(repo, unitOfWork),
		Repo:     repo,
		AuthRepo: postgresrepo.NewAuthRepository(pool),
	}
}

func NewNotificationHarness(t *testing.T) *NotificationHarness {
	t.Helper()

	pool, tx := BeginTx(t)
	repo := postgresrepo.NewNotificationRepositoryWithTx(pool, tx)
	unitOfWork := postgresrepo.NewUnitOfWorkWithTx(pool, tx)

	return &NotificationHarness{
		Service:  notificationapp.NewService(repo, pushadapter.MockSender{}, unitOfWork),
		Repo:     repo,
		AuthRepo: postgresrepo.NewAuthRepositoryWithTx(pool, tx),
		Tx:       tx,
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
