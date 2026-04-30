package notification

import (
	"context"

	"github.com/google/uuid"
)

// UseCase is the inbound application port for push notification flows.
type UseCase interface {
	RegisterDevice(ctx context.Context, input RegisterDeviceInput) (*RegisterDeviceResult, error)
	UnregisterDevice(ctx context.Context, userID, installationID uuid.UUID) error
	SendPushToUsers(ctx context.Context, input SendPushInput) (*SendPushResult, error)
}
