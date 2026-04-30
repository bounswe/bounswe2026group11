package notification

import (
	"strings"

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
