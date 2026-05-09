package profile

import (
	"context"

	"github.com/google/uuid"
)

// UseCase is the inbound application port for profile flows.
type UseCase interface {
	GetMyProfile(ctx context.Context, userID uuid.UUID) (*GetProfileResult, error)
	GetPublicProfile(ctx context.Context, userID uuid.UUID) (*PublicProfileResult, error)
	UpdateMyProfile(ctx context.Context, input UpdateProfileInput) error
	GetMyHostedEvents(ctx context.Context, userID uuid.UUID) ([]EventSummary, error)
	GetMyUpcomingEvents(ctx context.Context, userID uuid.UUID) ([]EventSummary, error)
	GetMyCompletedEvents(ctx context.Context, userID uuid.UUID) ([]EventSummary, error)
	GetMyCanceledEvents(ctx context.Context, userID uuid.UUID) ([]EventSummary, error)
	ListMyEquipment(ctx context.Context, userID uuid.UUID) (*ListEquipmentResult, error)
	CreateMyEquipment(ctx context.Context, input CreateEquipmentInput) (*EquipmentItem, error)
	UpdateMyEquipment(ctx context.Context, input UpdateEquipmentInput) (*EquipmentItem, error)
	DeleteMyEquipment(ctx context.Context, userID, equipmentID uuid.UUID) error
	DeleteMyShowcaseImage(ctx context.Context, userID, showcaseImageID uuid.UUID) error
	SearchUsers(ctx context.Context, input UserSearchInput) (*UserSearchResult, error)
	ChangePassword(ctx context.Context, input ChangePasswordInput) error
}
