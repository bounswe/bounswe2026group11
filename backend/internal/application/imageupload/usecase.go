package imageupload

import (
	"context"

	"github.com/google/uuid"
)

// UseCase is the inbound application port for image upload flows.
type UseCase interface {
	CreateProfileAvatarUpload(ctx context.Context, userID uuid.UUID) (*CreateUploadResult, error)
	ConfirmProfileAvatarUpload(ctx context.Context, userID uuid.UUID, input ConfirmUploadInput) error
	CreateEventImageUpload(ctx context.Context, userID, eventID uuid.UUID) (*CreateUploadResult, error)
	ConfirmEventImageUpload(ctx context.Context, userID, eventID uuid.UUID, input ConfirmUploadInput) error
}
