package bootstrap

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	emailadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/email"
	pushadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/firebasepush"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/hasher"
	jwtadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/jwt"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/otp"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/postgres"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/ratelimit"
	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/security"
	spacesadapter "github.com/bounswe/bounswe2026group11/backend/internal/adapter/in/spaces"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/admin"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/auth"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/badge"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/category"
	emailapp "github.com/bounswe/bounswe2026group11/backend/internal/application/email"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	favoritelocation "github.com/bounswe/bounswe2026group11/backend/internal/application/favorite_location"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/invitation"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/join_request"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/notification"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/participation"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/profile"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/rating"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/internal/infrastructure/config"
	"github.com/bounswe/bounswe2026group11/backend/internal/infrastructure/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Container is the backend composition root. It owns long-lived infrastructure
// dependencies and exposes application services to the delivery layer.
type Container struct {
	Config                  *config.Config
	DB                      *pgxpool.Pool
	UnitOfWork              uow.UnitOfWork
	MailProvider            emailapp.Provider
	TokenIssuer             auth.TokenIssuer
	TokenVerifier           domain.TokenVerifier
	authRepo                *postgres.AuthRepository
	adminRepo               *postgres.AdminRepository
	eventRepo               *postgres.EventRepository
	participationRepo       *postgres.ParticipationRepository
	invitationRepo          *postgres.InvitationRepository
	joinRequestRepo         *postgres.JoinRequestRepository
	ticketRepo              *postgres.TicketRepository
	ratingRepo              *postgres.RatingRepository
	notificationRepo        *postgres.NotificationRepository
	categoryRepo            *postgres.CategoryRepository
	profileRepo             *postgres.ProfileRepository
	favoriteLocationRepo    *postgres.FavoriteLocationRepository
	badgeRepo               *postgres.BadgeRepository
	AuthService             auth.UseCase
	AdminService            admin.UseCase
	EventService            event.UseCase
	ParticipationService    participation.UseCase
	InvitationService       invitation.UseCase
	JoinRequestService      join_request.UseCase
	TicketService           ticket.UseCase
	RatingService           rating.UseCase
	NotificationService     notification.UseCase
	NotificationBroker      *notification.Broker
	CategoryService         category.UseCase
	ProfileService          profile.UseCase
	FavoriteLocationService favoritelocation.UseCase
	ImageUploadService      imageupload.UseCase
	BadgeService            badge.UseCase
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
		UnitOfWork:    postgres.NewUnitOfWork(db),
		MailProvider:  mailProvider,
		TokenIssuer:   buildTokenIssuer(cfg),
		TokenVerifier: buildTokenVerifier(cfg),
	}
	container.authRepo = postgres.NewAuthRepository(container.DB)
	container.adminRepo = postgres.NewAdminRepository(container.DB)
	container.eventRepo = postgres.NewEventRepository(container.DB)
	container.participationRepo = postgres.NewParticipationRepository(container.DB)
	container.invitationRepo = postgres.NewInvitationRepository(container.DB)
	container.joinRequestRepo = postgres.NewJoinRequestRepository(container.DB)
	container.ticketRepo = postgres.NewTicketRepository(container.DB)
	container.ratingRepo = postgres.NewRatingRepository(container.DB)
	container.notificationRepo = postgres.NewNotificationRepository(container.DB)
	container.NotificationBroker = notification.NewBroker()
	container.categoryRepo = postgres.NewCategoryRepository(container.DB)
	container.profileRepo = postgres.NewProfileRepository(container.DB)
	container.favoriteLocationRepo = postgres.NewFavoriteLocationRepository(container.DB)
	container.badgeRepo = postgres.NewBadgeRepository(container.DB)
	notificationService, err := newNotificationService(ctx, container)
	if err != nil {
		db.Close()
		return nil, err
	}
	container.NotificationService = notificationService
	container.BadgeService = newBadgeService(container)
	container.ParticipationService = newParticipationService(container)
	container.TicketService = newTicketService(container)
	container.InvitationService = newInvitationService(container)
	container.JoinRequestService = newJoinRequestService(container)
	container.RatingService = newRatingService(container)
	container.AuthService = newAuthService(container)
	container.AdminService = newAdminService(container)
	container.EventService = newEventService(container)
	container.CategoryService = newCategoryService(container)
	container.ProfileService = newProfileService(container)
	container.FavoriteLocationService = newFavoriteLocationService(container)
	container.ImageUploadService = newImageUploadService(container, spacesStorage)
	return container, nil
}

// StartEventExpiryJob immediately transitions event statuses
// (ACTIVE → IN_PROGRESS → COMPLETED), then repeats every interval until ctx
// is cancelled.
func (c *Container) StartEventExpiryJob(ctx context.Context, interval time.Duration) {
	expire := func() {
		if err := c.eventRepo.TransitionEventStatuses(ctx); err != nil {
			slog.ErrorContext(ctx, "event status transition job failed", "error", err)
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

// StartNotificationRetentionJob deletes inbox notifications older than the
// configured retention window, then repeats until ctx is cancelled.
func (c *Container) StartNotificationRetentionJob(ctx context.Context, interval time.Duration) {
	purge := func() {
		deleted, err := c.NotificationService.DeleteExpiredNotifications(ctx)
		if err != nil {
			slog.ErrorContext(ctx, "notification retention job failed", "error", err)
			return
		}
		if deleted > 0 {
			slog.InfoContext(ctx, "expired notifications deleted",
				"operation", "notification.retention.delete_expired",
				"deleted_count", deleted,
			)
		}
	}
	purge()
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				purge()
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

func buildPushSender(ctx context.Context, cfg *config.Config) (notification.PushSender, error) {
	switch cfg.PushProvider {
	case "mock":
		return pushadapter.MockSender{}, nil
	case "firebase":
		return pushadapter.NewSender(ctx, cfg.FirebaseCredentialsFile, cfg.FirebaseServiceAccountJSONBase64)
	default:
		return nil, fmt.Errorf("unsupported push provider %q", cfg.PushProvider)
	}
}

// newAdminService wires the admin backoffice use case with its read repository.
func newAdminService(c *Container) admin.UseCase {
	return admin.NewService(c.adminRepo, admin.WithMutationDependencies(c.NotificationService, c.TicketService, c.UnitOfWork))
}

// newEventService wires the event use case with its driven adapters.
func newEventService(c *Container) event.UseCase {
	service := event.NewService(c.eventRepo, c.ParticipationService, c.JoinRequestService, c.UnitOfWork, c.TicketService)
	service.SetNotificationService(c.NotificationService)
	return service
}

// newParticipationService wires the participation use-case service with its
// driven adapter.
func newParticipationService(c *Container) participation.UseCase {
	service := participation.NewService(c.participationRepo)
	service.SetBadgeEvaluator(c.BadgeService)
	return service
}

func newInvitationService(c *Container) invitation.UseCase {
	service := invitation.NewService(c.invitationRepo, c.UnitOfWork, c.TicketService)
	service.SetNotificationService(c.NotificationService)
	return service
}

// newJoinRequestService wires the join request use-case service with its
// driven adapter.
func newJoinRequestService(c *Container) join_request.UseCase {
	service := join_request.NewService(c.joinRequestRepo, c.UnitOfWork, c.TicketService)
	service.SetNotificationService(c.NotificationService)
	return service
}

// newTicketService wires the ticket use-case service with its driven adapters.
func newTicketService(c *Container) ticket.UseCase {
	return ticket.NewService(
		c.ticketRepo,
		c.UnitOfWork,
		jwtadapter.TicketTokenManager{Secret: []byte(c.Config.JWTSecret)},
		ticket.Settings{
			QRTokenTTL:      10 * time.Second,
			ProximityMeters: 200,
		},
	)
}

// newCategoryService wires the category use-case service with its driven adapter.
func newCategoryService(c *Container) category.UseCase {
	return category.NewService(c.categoryRepo)
}

// newProfileService wires the profile use-case service with its driven adapter.
func newProfileService(c *Container) profile.UseCase {
	return profile.NewService(c.profileRepo, c.UnitOfWork, hasher.BcryptHasher{})
}

// newFavoriteLocationService wires the favorite-location use-case service with its driven adapter.
func newFavoriteLocationService(c *Container) favoritelocation.UseCase {
	service := favoritelocation.NewService(c.favoriteLocationRepo, c.UnitOfWork)
	service.SetBadgeEvaluator(c.BadgeService)
	return service
}

// newBadgeService wires the badge use-case service with its driven adapter.
func newBadgeService(c *Container) badge.UseCase {
	return badge.NewService(c.badgeRepo)
}

func newNotificationService(ctx context.Context, c *Container) (notification.UseCase, error) {
	sender, err := buildPushSender(ctx, c.Config)
	if err != nil {
		return nil, fmt.Errorf("build push sender: %w", err)
	}
	return notification.NewService(c.notificationRepo, sender, c.UnitOfWork, c.NotificationBroker), nil
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
	service := rating.NewService(c.ratingRepo, c.UnitOfWork, rating.Settings{
		GlobalPrior: c.Config.RatingGlobalPrior,
		BayesianM:   c.Config.RatingBayesianM,
	})
	service.SetBadgeEvaluator(c.BadgeService)
	return service
}

// newAuthService wires the auth use-case service with its driven adapters.
func newAuthService(c *Container) auth.UseCase {
	service := auth.NewService(
		c.authRepo,
		c.UnitOfWork,
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
	service.SetPushDeviceRevoker(c.NotificationService)
	return service
}
