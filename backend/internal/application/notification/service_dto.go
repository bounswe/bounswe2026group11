package notification

import (
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

const MaxActiveDevicesPerUser = 2
const DefaultNotificationLimit = 25
const MaxNotificationLimit = 50
const NotificationRetentionDays = 90
const MaxPushDeliveryRetries = 2

type RegisterDeviceInput struct {
	UserID         uuid.UUID
	InstallationID uuid.UUID
	Platform       string
	FCMToken       string
	DeviceInfo     *string
}

type RegisterDeviceResult struct {
	InstallationID    string                    `json:"installation_id"`
	Platform          domain.PushDevicePlatform `json:"platform"`
	ActiveDeviceCount int                       `json:"active_device_count"`
	UpdatedAt         time.Time                 `json:"updated_at"`
}

type SendPushInput struct {
	UserIDs  []uuid.UUID
	Title    string
	Body     string
	Type     *string
	DeepLink *string
	Data     map[string]string
	EventID  *uuid.UUID
}

type SendNotificationInput struct {
	UserIDs        []uuid.UUID
	Title          string
	Body           string
	Type           *string
	DeepLink       *string
	Data           map[string]string
	EventID        *uuid.UUID
	ImageURL       *string
	IdempotencyKey string
}

type SendCustomNotificationInput struct {
	UserIDs        []uuid.UUID
	DeliveryMode   domain.NotificationDeliveryMode
	Title          string
	Body           string
	Type           *string
	DeepLink       *string
	Data           map[string]string
	EventID        *uuid.UUID
	ImageURL       *string
	IdempotencyKey string
}

type SendPushResult struct {
	TargetUserCount   int
	ActiveDeviceCount int
	SentCount         int
	FailedCount       int
	InvalidTokenCount int
}

type SendNotificationResult struct {
	TargetUserCount       int
	CreatedCount          int
	IdempotentCount       int
	SSEDeliveryCount      int
	PushActiveDeviceCount int
	PushSentCount         int
	PushFailedCount       int
	InvalidTokenCount     int
}

type ListNotificationsInput struct {
	UserID     uuid.UUID
	OnlyUnread bool
	Limit      *int
	Cursor     *string
}

type ListNotificationsResult struct {
	Items    []domain.Notification `json:"items"`
	PageInfo NotificationPageInfo  `json:"page_info"`
}

type NotificationPageInfo struct {
	NextCursor *string `json:"next_cursor"`
	HasNext    bool    `json:"has_next"`
}

type UnreadCountResult struct {
	UnreadCount int `json:"unread_count"`
}

type MarkAllReadResult struct {
	UpdatedCount int `json:"updated_count"`
}

type RegisterDeviceParams struct {
	UserID         uuid.UUID
	InstallationID uuid.UUID
	Platform       domain.PushDevicePlatform
	FCMToken       string
	DeviceInfo     *string
	LastSeenAt     time.Time
}

type CreateNotificationParams struct {
	UserID         uuid.UUID
	EventID        *uuid.UUID
	Title          string
	Type           *string
	Body           string
	DeepLink       *string
	ImageURL       *string
	Data           map[string]string
	IdempotencyKey string
	CreatedAt      time.Time
}

type CreateNotificationResult struct {
	Notification domain.Notification
	Created      bool
}

type ListNotificationsParams struct {
	UserID               uuid.UUID
	OnlyUnread           bool
	Limit                int
	RepositoryFetchLimit int
	DecodedCursor        *NotificationCursor
	VisibleAfter         time.Time
}

type NotificationCursor struct {
	CreatedAt      time.Time `json:"created_at"`
	NotificationID uuid.UUID `json:"notification_id"`
}

type CreateDeliveryAttemptParams struct {
	NotificationID uuid.UUID
	UserID         uuid.UUID
	Method         domain.NotificationDeliveryMethod
	Status         domain.NotificationDeliveryStatus
	PushDeviceID   *uuid.UUID
	ErrorSummary   *string
	SentAt         *time.Time
}
