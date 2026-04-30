package notification

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service owns push-device registration and push notification delivery.
type Service struct {
	repo       Repository
	sender     PushSender
	unitOfWork uow.UnitOfWork
	now        func() time.Time
}

var _ UseCase = (*Service)(nil)

func NewService(repo Repository, sender PushSender, unitOfWork uow.UnitOfWork) *Service {
	return &Service{
		repo:       repo,
		sender:     sender,
		unitOfWork: unitOfWork,
		now:        time.Now,
	}
}

func (s *Service) RegisterDevice(ctx context.Context, input RegisterDeviceInput) (*RegisterDeviceResult, error) {
	platform, token, appErr := validateRegisterDeviceInput(input)
	if appErr != nil {
		return nil, appErr
	}

	now := s.now().UTC()
	var (
		device      *domain.PushDevice
		activeCount int
	)
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		if err := s.repo.LockUser(ctx, input.UserID); err != nil {
			return fmt.Errorf("lock push-device user: %w", err)
		}

		var err error
		device, err = s.repo.UpsertDevice(ctx, RegisterDeviceParams{
			UserID:         input.UserID,
			InstallationID: input.InstallationID,
			Platform:       platform,
			FCMToken:       token,
			DeviceInfo:     input.DeviceInfo,
			LastSeenAt:     now,
		})
		if err != nil {
			return fmt.Errorf("upsert push device: %w", err)
		}
		if _, err := s.repo.RevokeOldestActiveDevices(ctx, input.UserID, MaxActiveDevicesPerUser, now); err != nil {
			return fmt.Errorf("enforce push-device limit: %w", err)
		}
		activeCount, err = s.repo.CountActiveDevices(ctx, input.UserID)
		if err != nil {
			return fmt.Errorf("count active push devices: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &RegisterDeviceResult{
		InstallationID:    device.InstallationID.String(),
		Platform:          device.Platform,
		ActiveDeviceCount: activeCount,
		UpdatedAt:         device.UpdatedAt,
	}, nil
}

func (s *Service) UnregisterDevice(ctx context.Context, userID, installationID uuid.UUID) error {
	now := s.now().UTC()
	return s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		if _, err := s.repo.RevokeDevice(ctx, userID, installationID, now); err != nil {
			return fmt.Errorf("revoke push device: %w", err)
		}
		return nil
	})
}

func (s *Service) SendPushToUsers(ctx context.Context, input SendPushInput) (*SendPushResult, error) {
	if appErr := validateSendPushInput(input); appErr != nil {
		return nil, appErr
	}

	devices, err := s.repo.ListActiveDevicesForUsers(ctx, input.UserIDs)
	if err != nil {
		return nil, fmt.Errorf("list active push devices: %w", err)
	}

	result := &SendPushResult{
		TargetUserCount:   len(uniqueUserIDs(input.UserIDs)),
		ActiveDeviceCount: len(devices),
	}
	now := s.now().UTC()

	for _, device := range devices {
		sendResult, sendErr := s.sender.Send(ctx, PushSendMessage{
			Token:    device.FCMToken,
			Title:    input.Title,
			Body:     input.Body,
			DeepLink: input.DeepLink,
			Data:     input.Data,
		})

		status := domain.NotificationStatusSent
		sentAt := &now
		if sendErr != nil {
			slog.ErrorContext(ctx, "push notification delivery failed",
				"operation", "notification.push.device_send",
				"user_id", device.UserID.String(),
				"device_id", device.ID.String(),
				"error", sendErr,
			)
			status = domain.NotificationStatusFailed
			sentAt = nil
			result.FailedCount++
		} else {
			result.SentCount++
		}
		if sendResult != nil && sendResult.InvalidToken {
			result.InvalidTokenCount++
			if err := s.repo.RevokeDeviceByID(ctx, device.ID, now); err != nil {
				return nil, fmt.Errorf("revoke invalid push device: %w", err)
			}
		}

		if err := s.repo.CreateNotification(ctx, CreateNotificationParams{
			UserID:         device.UserID,
			EventID:        input.EventID,
			Title:          input.Title,
			Type:           input.Type,
			Body:           input.Body,
			DeepLink:       input.DeepLink,
			DeliveryMethod: domain.NotificationDeliveryMethodFCM,
			Status:         status,
			SentAt:         sentAt,
		}); err != nil {
			return nil, fmt.Errorf("store push notification result: %w", err)
		}
	}

	slog.InfoContext(ctx, "push notifications sent",
		"operation", "notification.push.send",
		"target_user_count", result.TargetUserCount,
		"active_device_count", result.ActiveDeviceCount,
		"sent_count", result.SentCount,
		"failed_count", result.FailedCount,
		"invalid_token_count", result.InvalidTokenCount,
	)

	return result, nil
}

func uniqueUserIDs(userIDs []uuid.UUID) map[uuid.UUID]struct{} {
	seen := make(map[uuid.UUID]struct{}, len(userIDs))
	for _, userID := range userIDs {
		seen[userID] = struct{}{}
	}
	return seen
}
