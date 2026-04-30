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
	CreateNotificationIfAbsent(ctx context.Context, params CreateNotificationParams) (*CreateNotificationResult, error)
	ListNotifications(ctx context.Context, params ListNotificationsParams) ([]domain.Notification, error)
	CountUnreadNotifications(ctx context.Context, userID uuid.UUID, visibleAfter time.Time) (int, error)
	MarkNotificationRead(ctx context.Context, userID, notificationID uuid.UUID, readAt, visibleAfter time.Time) (bool, error)
	MarkAllNotificationsRead(ctx context.Context, userID uuid.UUID, readAt, visibleAfter time.Time) (int, error)
	SoftDeleteNotification(ctx context.Context, userID, notificationID uuid.UUID, deletedAt, visibleAfter time.Time) error
	SoftDeleteAllNotifications(ctx context.Context, userID uuid.UUID, deletedAt, visibleAfter time.Time) error
	DeleteExpiredNotifications(ctx context.Context, cutoff time.Time) (int, error)
	CreateDeliveryAttempt(ctx context.Context, params CreateDeliveryAttemptParams) error
}

type PushSendMessage struct {
	Token    string
	Title    string
	Body     string
	ImageURL *string
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

// RealtimeBroker owns active in-process SSE subscriptions.
type RealtimeBroker interface {
	Publish(ctx context.Context, userID uuid.UUID, notification domain.Notification) int
	Subscribe(userID uuid.UUID) *Subscription
}

// Subscription is one active SSE stream registered for a user.
type Subscription struct {
	ID     uuid.UUID
	UserID uuid.UUID
	Events <-chan domain.Notification
	Cancel func()
}
