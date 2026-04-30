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

// NotificationDeliveryMethod identifies how a notification delivery was attempted.
type NotificationDeliveryMethod string

const (
	NotificationDeliveryMethodFCM NotificationDeliveryMethod = "FCM"
	NotificationDeliveryMethodSSE NotificationDeliveryMethod = "SSE"
)

func ParseNotificationDeliveryMethod(value string) (NotificationDeliveryMethod, bool) {
	switch NotificationDeliveryMethod(strings.ToUpper(strings.TrimSpace(value))) {
	case NotificationDeliveryMethodFCM:
		return NotificationDeliveryMethodFCM, true
	case NotificationDeliveryMethodSSE:
		return NotificationDeliveryMethodSSE, true
	default:
		return "", false
	}
}

func (m NotificationDeliveryMethod) String() string {
	return string(m)
}

// NotificationDeliveryStatus identifies the result of one delivery attempt.
type NotificationDeliveryStatus string

// NotificationDeliveryMode identifies which admin-triggered delivery channels
// should be attempted for a custom notification.
type NotificationDeliveryMode string

const (
	NotificationDeliveryStatusSent    NotificationDeliveryStatus = "SENT"
	NotificationDeliveryStatusFailed  NotificationDeliveryStatus = "FAILED"
	NotificationDeliveryStatusSkipped NotificationDeliveryStatus = "SKIPPED"
)

const (
	NotificationDeliveryModeInApp NotificationDeliveryMode = "IN_APP"
	NotificationDeliveryModePush  NotificationDeliveryMode = "PUSH"
	NotificationDeliveryModeBoth  NotificationDeliveryMode = "BOTH"
)

func ParseNotificationDeliveryStatus(value string) (NotificationDeliveryStatus, bool) {
	switch NotificationDeliveryStatus(strings.ToUpper(strings.TrimSpace(value))) {
	case NotificationDeliveryStatusSent:
		return NotificationDeliveryStatusSent, true
	case NotificationDeliveryStatusFailed:
		return NotificationDeliveryStatusFailed, true
	case NotificationDeliveryStatusSkipped:
		return NotificationDeliveryStatusSkipped, true
	default:
		return "", false
	}
}

func (s NotificationDeliveryStatus) String() string {
	return string(s)
}

func ParseNotificationDeliveryMode(value string) (NotificationDeliveryMode, bool) {
	switch NotificationDeliveryMode(strings.ToUpper(strings.TrimSpace(value))) {
	case NotificationDeliveryModeInApp:
		return NotificationDeliveryModeInApp, true
	case NotificationDeliveryModePush:
		return NotificationDeliveryModePush, true
	case NotificationDeliveryModeBoth:
		return NotificationDeliveryModeBoth, true
	default:
		return "", false
	}
}

func (m NotificationDeliveryMode) String() string {
	return string(m)
}

// Notification is the user-facing in-app notification inbox item.
type Notification struct {
	ID             uuid.UUID
	EventID        *uuid.UUID
	ReceiverUserID uuid.UUID
	Title          string
	Type           *string
	Body           string
	DeepLink       *string
	ImageURL       *string
	Data           map[string]string
	IsRead         bool
	ReadAt         *time.Time
	DeletedAt      *time.Time
	IdempotencyKey string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

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
