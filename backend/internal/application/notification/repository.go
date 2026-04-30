package notification

import (
	"context"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Repository is the application-layer persistence port for push notifications.
type Repository interface {
	LockUser(ctx context.Context, userID uuid.UUID) error
	UpsertDevice(ctx context.Context, params RegisterDeviceParams) (*domain.PushDevice, error)
	CountActiveDevices(ctx context.Context, userID uuid.UUID) (int, error)
	RevokeOldestActiveDevices(ctx context.Context, userID uuid.UUID, maxActive int, revokedAt time.Time) (int, error)
	RevokeDevice(ctx context.Context, userID, installationID uuid.UUID, revokedAt time.Time) (bool, error)
	RevokeDeviceByID(ctx context.Context, deviceID uuid.UUID, revokedAt time.Time) error
	ListActiveDevicesForUsers(ctx context.Context, userIDs []uuid.UUID) ([]domain.PushDevice, error)
	CreateNotification(ctx context.Context, params CreateNotificationParams) error
}

type PushSendMessage struct {
	Token    string
	Title    string
	Body     string
	DeepLink *string
	Data     map[string]string
}

type PushSendResult struct {
	InvalidToken bool
}

// PushSender sends a single push message through the configured provider.
type PushSender interface {
	Send(ctx context.Context, message PushSendMessage) (*PushSendResult, error)
}
