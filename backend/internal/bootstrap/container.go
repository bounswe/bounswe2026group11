package bootstrap

import (
	"context"
	"fmt"
	"log"
	"time"

	emailadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/email"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/hasher"
	jwtadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/jwt"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/otp"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/postgres"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/ratelimit"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/security"
	spacesadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/spaces"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/auth"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/category"
	emailapp "github.com/bounswe/bounswe2026group11/backend/internal/application/email"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/join_request"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/participation"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/profile"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/rating"
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
	MailProvider         emailapp.Provider
	TokenIssuer          auth.TokenIssuer
	TokenVerifier        domain.TokenVerifier
	authRepo             *postgres.AuthRepository
	eventRepo            *postgres.EventRepository
	participationRepo    *postgres.ParticipationRepository
	joinRequestRepo      *postgres.JoinRequestRepository
	ratingRepo           *postgres.RatingRepository
	categoryRepo         *postgres.CategoryRepository
	profileRepo          *postgres.ProfileRepository
	AuthService          auth.UseCase
	EventService         event.UseCase
	ParticipationService participation.UseCase
	JoinRequestService   join_request.UseCase
	RatingService        rating.UseCase
	CategoryService      category.UseCase
	ProfileService       profile.UseCase
	ImageUploadService   imageupload.UseCase
	// Extend with additional services as features are added
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

	mailProvider, err := buildMailProvider(cfg)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("build mail provider: %w", err)
	}
	spacesStorage := buildSpacesStorage(cfg)

	container := &Container{
		Config:        cfg,
		DB:            db,
		MailProvider:  mailProvider,
		TokenIssuer:   buildTokenIssuer(cfg),
		TokenVerifier: buildTokenVerifier(cfg),
	}
	container.authRepo = postgres.NewAuthRepository(container.DB)
	container.eventRepo = postgres.NewEventRepository(container.DB)
	container.participationRepo = postgres.NewParticipationRepository(container.DB)
	container.joinRequestRepo = postgres.NewJoinRequestRepository(container.DB)
	container.ratingRepo = postgres.NewRatingRepository(container.DB)
	container.categoryRepo = postgres.NewCategoryRepository(container.DB)
	container.profileRepo = postgres.NewProfileRepository(container.DB)
	container.ParticipationService = newParticipationService(container)
	container.JoinRequestService = newJoinRequestService(container)
	container.RatingService = newRatingService(container)
	container.AuthService = newAuthService(container)
	container.EventService = newEventService(container)
	container.CategoryService = newCategoryService(container)
	container.ProfileService = newProfileService(container)
	container.ImageUploadService = newImageUploadService(container, spacesStorage)
	return container, nil
}

// StartEventExpiryJob immediately transitions event statuses
// (ACTIVE → IN_PROGRESS → COMPLETED), then repeats every interval until ctx
// is cancelled.
func (c *Container) StartEventExpiryJob(ctx context.Context, interval time.Duration) {
	expire := func() {
		if err := c.eventRepo.TransitionEventStatuses(ctx); err != nil {
			log.Printf("event status transition job: %v", err)
		}
	}
	expire()
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				expire()
			case <-ctx.Done():
				return
			}
		}
	}()
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

func buildMailProvider(cfg *config.Config) (emailapp.Provider, error) {
	switch cfg.MailProvider {
	case "mock":
		return emailadapter.MockProvider{}, nil
	case "resend":
		return emailadapter.NewResendProvider(cfg.ResendClientAPIKey, cfg.MailDomain), nil
	default:
		return nil, fmt.Errorf("unsupported mail provider %q", cfg.MailProvider)
	}
}

func buildSpacesStorage(cfg *config.Config) *spacesadapter.Storage {
	return spacesadapter.NewStorage(spacesadapter.Config{
		AccessKey: cfg.SpacesAccessKey,
		SecretKey: cfg.SpacesSecretKey,
		Endpoint:  cfg.SpacesEndpoint,
		Bucket:    cfg.SpacesBucket,
		Region:    cfg.SpacesS3Region,
	})
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

// newProfileService wires the profile use-case service with its driven adapter.
func newProfileService(c *Container) profile.UseCase {
	return profile.NewService(c.profileRepo)
}

func newImageUploadService(c *Container, storage *spacesadapter.Storage) imageupload.UseCase {
	return imageupload.NewService(
		c.profileRepo,
		c.eventRepo,
		storage,
		jwtadapter.ImageUploadTokenManager{Secret: []byte(c.Config.JWTSecret)},
		imageupload.Settings{
			PresignTTL:      c.Config.SpacesPresignTTL,
			UploadCacheCtrl: c.Config.SpacesUploadCacheCtrl,
			CDNBaseURL:      c.Config.SpacesCDNBaseURL,
		},
	)
}

// newRatingService wires the rating use-case service with its driven adapter.
func newRatingService(c *Container) rating.UseCase {
	return rating.NewService(c.ratingRepo, rating.Settings{
		GlobalPrior: c.Config.RatingGlobalPrior,
		BayesianM:   c.Config.RatingBayesianM,
	})
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
		emailadapter.NewAuthOTPMailer(c.MailProvider),
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
