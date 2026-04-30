package domain

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// PushDevicePlatform identifies the mobile platform that owns an FCM token.
type PushDevicePlatform string

const (
	PushDevicePlatformIOS     PushDevicePlatform = "IOS"
	PushDevicePlatformAndroid PushDevicePlatform = "ANDROID"
)

func ParsePushDevicePlatform(value string) (PushDevicePlatform, bool) {
	switch PushDevicePlatform(strings.ToUpper(strings.TrimSpace(value))) {
	case PushDevicePlatformIOS:
		return PushDevicePlatformIOS, true
	case PushDevicePlatformAndroid:
		return PushDevicePlatformAndroid, true
	default:
		return "", false
	}
}

func (p PushDevicePlatform) String() string {
	return string(p)
}

// Notification delivery method and status values stored in notification rows.
const (
	NotificationDeliveryMethodFCM = "FCM"
	NotificationStatusSent        = "SENT"
	NotificationStatusFailed      = "FAILED"
)

// PushDevice stores the current push-token assignment for one app installation.
type PushDevice struct {
	ID             uuid.UUID
	UserID         uuid.UUID
	InstallationID uuid.UUID
	Platform       PushDevicePlatform
	FCMToken       string
	DeviceInfo     *string
	LastSeenAt     time.Time
	RevokedAt      *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}
