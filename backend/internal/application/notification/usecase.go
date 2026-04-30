package notification

import (
	"context"

	"github.com/google/uuid"
)

// UseCase is the inbound application port for push notification flows.
type UseCase interface {
	RegisterDevice(ctx context.Context, input RegisterDeviceInput) (*RegisterDeviceResult, error)
	UnregisterDevice(ctx context.Context, userID, installationID uuid.UUID) error
	ListNotifications(ctx context.Context, input ListNotificationsInput) (*ListNotificationsResult, error)
	CountUnreadNotifications(ctx context.Context, userID uuid.UUID) (*UnreadCountResult, error)
	MarkNotificationRead(ctx context.Context, userID, notificationID uuid.UUID) error
	MarkAllNotificationsRead(ctx context.Context, userID uuid.UUID) (*MarkAllReadResult, error)
	DeleteNotification(ctx context.Context, userID, notificationID uuid.UUID) error
	DeleteAllNotifications(ctx context.Context, userID uuid.UUID) error
	DeleteExpiredNotifications(ctx context.Context) (int, error)
	SendNotificationToUsers(ctx context.Context, input SendNotificationInput) (*SendNotificationResult, error)
	SendPushToUsers(ctx context.Context, input SendPushInput) (*SendPushResult, error)
}
