package profile

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Repository is the application-layer persistence port for profile flows.
type Repository interface {
	GetProfile(ctx context.Context, userID uuid.UUID) (*domain.UserProfile, error)
	GetPublicProfile(ctx context.Context, userID uuid.UUID) (*domain.PublicUserProfile, error)
	UpdateProfile(ctx context.Context, params UpdateProfileParams) error
	GetHostedEvents(ctx context.Context, userID uuid.UUID) ([]domain.EventSummary, error)
	GetUpcomingEvents(ctx context.Context, userID uuid.UUID) ([]domain.EventSummary, error)
	GetCompletedEvents(ctx context.Context, userID uuid.UUID) ([]domain.EventSummary, error)
	GetCanceledEvents(ctx context.Context, userID uuid.UUID) ([]domain.EventSummary, error)
	ListEquipment(ctx context.Context, userID uuid.UUID) ([]domain.ProfileEquipment, error)
	GetEquipmentByID(ctx context.Context, equipmentID uuid.UUID) (*domain.ProfileEquipment, error)
	CreateEquipment(ctx context.Context, params CreateEquipmentParams) (*domain.ProfileEquipment, error)
	UpdateEquipment(ctx context.Context, params UpdateEquipmentParams) (*domain.ProfileEquipment, error)
	DeleteEquipment(ctx context.Context, equipmentID uuid.UUID) error
	ListShowcaseImages(ctx context.Context, userID uuid.UUID) ([]domain.ProfileShowcaseImage, error)
	GetShowcaseImageByID(ctx context.Context, showcaseImageID uuid.UUID) (*domain.ProfileShowcaseImage, error)
	CreateShowcaseImage(ctx context.Context, userID uuid.UUID, imageURL string) (*domain.ProfileShowcaseImage, error)
	DeleteShowcaseImage(ctx context.Context, showcaseImageID uuid.UUID) error
	SearchUsers(ctx context.Context, query string, limit int) ([]UserSearchRecord, error)
	GetPasswordHash(ctx context.Context, userID uuid.UUID) (string, error)
	UpdatePasswordHash(ctx context.Context, userID uuid.UUID, newHash string) error
	// GetLocale returns the persisted locale preference (e.g. "en", "tr") for
	// the given user. Used by the locale resolution middleware as a fallback
	// when the request has no Accept-Language header.
	GetLocale(ctx context.Context, userID uuid.UUID) (string, error)
}
