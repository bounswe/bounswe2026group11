package notification

import (
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

func validateRegisterDeviceInput(input RegisterDeviceInput) (domain.PushDevicePlatform, string, *domain.AppError) {
	platform, ok := domain.ParsePushDevicePlatform(input.Platform)
	token := strings.TrimSpace(input.FCMToken)
	details := map[string]string{}

	if !ok {
		details["platform"] = "must be IOS or ANDROID"
	}
	if token == "" {
		details["fcm_token"] = "is required"
	}
	if len(token) > 4096 {
		details["fcm_token"] = "must be at most 4096 characters"
	}

	if len(details) > 0 {
		return "", "", domain.ValidationError(details)
	}
	return platform, token, nil
}

func validateSendPushInput(input SendPushInput) *domain.AppError {
	details := map[string]string{}
	if len(input.UserIDs) == 0 {
		details["user_ids"] = "must contain at least one user id"
	}
	if strings.TrimSpace(input.Title) == "" {
		details["title"] = "is required"
	}
	if strings.TrimSpace(input.Body) == "" {
		details["body"] = "is required"
	}
	if len(details) > 0 {
		return domain.ValidationError(details)
	}
	return nil
}

func validateSendNotificationInput(input SendNotificationInput) *domain.AppError {
	details := map[string]string{}
	if len(input.UserIDs) == 0 {
		details["user_ids"] = "must contain at least one user id"
	}
	if strings.TrimSpace(input.Title) == "" {
		details["title"] = "is required"
	}
	if strings.TrimSpace(input.Body) == "" {
		details["body"] = "is required"
	}
	if strings.TrimSpace(input.IdempotencyKey) == "" {
		details["idempotency_key"] = "is required"
	}
	if len(details) > 0 {
		return domain.ValidationError(details)
	}
	return nil
}

func validateSendCustomNotificationInput(input SendCustomNotificationInput) *domain.AppError {
	details := map[string]string{}
	if len(input.UserIDs) == 0 {
		details["user_ids"] = "must contain at least one user id"
	}
	if input.DeliveryMode == "" {
		details["delivery_mode"] = "must be one of: IN_APP, PUSH, BOTH"
	}
	if input.DeliveryMode != "" {
		switch input.DeliveryMode {
		case domain.NotificationDeliveryModeInApp, domain.NotificationDeliveryModePush, domain.NotificationDeliveryModeBoth:
		default:
			details["delivery_mode"] = "must be one of: IN_APP, PUSH, BOTH"
		}
	}
	if strings.TrimSpace(input.Title) == "" {
		details["title"] = "is required"
	}
	if strings.TrimSpace(input.Body) == "" {
		details["body"] = "is required"
	}
	if strings.TrimSpace(input.IdempotencyKey) == "" {
		details["idempotency_key"] = "is required"
	}
	if len(details) > 0 {
		return domain.ValidationError(details)
	}
	return nil
}

func normalizeListNotificationsInput(input ListNotificationsInput, now time.Time) (ListNotificationsParams, error) {
	params := ListNotificationsParams{
		UserID:               input.UserID,
		OnlyUnread:           input.OnlyUnread,
		Limit:                DefaultNotificationLimit,
		VisibleAfter:         now.UTC().AddDate(0, 0, -NotificationRetentionDays),
		RepositoryFetchLimit: DefaultNotificationLimit + 1,
	}

	if input.Limit != nil {
		if *input.Limit < 1 || *input.Limit > MaxNotificationLimit {
			return ListNotificationsParams{}, domain.ValidationError(map[string]string{
				"limit": "limit must be between 1 and 50",
			})
		}
		params.Limit = *input.Limit
		params.RepositoryFetchLimit = params.Limit + 1
	}

	if input.Cursor != nil {
		cursorToken := strings.TrimSpace(*input.Cursor)
		if cursorToken != "" {
			cursor, err := decodeNotificationCursor(cursorToken)
			if err != nil {
				return ListNotificationsParams{}, domain.ValidationError(map[string]string{
					"cursor": "cursor is invalid",
				})
			}
			params.DecodedCursor = cursor
		}
	}

	return params, nil
}
