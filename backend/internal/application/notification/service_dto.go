package notification

import (
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

const MaxActiveDevicesPerUser = 2

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

type SendPushResult struct {
	TargetUserCount   int
	ActiveDeviceCount int
	SentCount         int
	FailedCount       int
	InvalidTokenCount int
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
	DeliveryMethod string
	Status         string
	SentAt         *time.Time
}
