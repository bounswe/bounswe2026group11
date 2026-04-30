package notification

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service owns push-device registration and push notification delivery.
type Service struct {
	repo       Repository
	sender     PushSender
	realtime   RealtimeBroker
	unitOfWork uow.UnitOfWork
	now        func() time.Time
}

var _ UseCase = (*Service)(nil)

func NewService(repo Repository, sender PushSender, unitOfWork uow.UnitOfWork, realtime ...RealtimeBroker) *Service {
	service := &Service{
		repo:       repo,
		sender:     sender,
		unitOfWork: unitOfWork,
		now:        time.Now,
	}
	if len(realtime) > 0 {
		service.realtime = realtime[0]
	}
	return service
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

func (s *Service) ListNotifications(ctx context.Context, input ListNotificationsInput) (*ListNotificationsResult, error) {
	params, err := normalizeListNotificationsInput(input, s.now().UTC())
	if err != nil {
		return nil, err
	}

	records, err := s.repo.ListNotifications(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}

	hasNext := len(records) > params.Limit
	if hasNext {
		records = records[:params.Limit]
	}
	nextCursor, err := buildNextNotificationCursor(records, hasNext)
	if err != nil {
		return nil, err
	}

	return &ListNotificationsResult{
		Items: records,
		PageInfo: NotificationPageInfo{
			NextCursor: nextCursor,
			HasNext:    hasNext,
		},
	}, nil
}

func (s *Service) CountUnreadNotifications(ctx context.Context, userID uuid.UUID) (*UnreadCountResult, error) {
	count, err := s.repo.CountUnreadNotifications(ctx, userID, s.visibleAfter())
	if err != nil {
		return nil, fmt.Errorf("count unread notifications: %w", err)
	}
	return &UnreadCountResult{UnreadCount: count}, nil
}

func (s *Service) MarkNotificationRead(ctx context.Context, userID, notificationID uuid.UUID) error {
	readAt := s.now().UTC()
	updated, err := s.repo.MarkNotificationRead(ctx, userID, notificationID, readAt, s.visibleAfter())
	if err != nil {
		return fmt.Errorf("mark notification read: %w", err)
	}
	if !updated {
		return domain.NotFoundError(domain.ErrorCodeNotificationNotFound, "The requested notification does not exist.")
	}
	return nil
}

func (s *Service) MarkAllNotificationsRead(ctx context.Context, userID uuid.UUID) (*MarkAllReadResult, error) {
	readAt := s.now().UTC()
	updated, err := s.repo.MarkAllNotificationsRead(ctx, userID, readAt, s.visibleAfter())
	if err != nil {
		return nil, fmt.Errorf("mark all notifications read: %w", err)
	}
	return &MarkAllReadResult{UpdatedCount: updated}, nil
}

func (s *Service) DeleteNotification(ctx context.Context, userID, notificationID uuid.UUID) error {
	now := s.now().UTC()
	if err := s.repo.SoftDeleteNotification(ctx, userID, notificationID, now, s.visibleAfter()); err != nil {
		return fmt.Errorf("delete notification: %w", err)
	}
	return nil
}

func (s *Service) DeleteAllNotifications(ctx context.Context, userID uuid.UUID) error {
	now := s.now().UTC()
	if err := s.repo.SoftDeleteAllNotifications(ctx, userID, now, s.visibleAfter()); err != nil {
		return fmt.Errorf("delete all notifications: %w", err)
	}
	return nil
}

func (s *Service) DeleteExpiredNotifications(ctx context.Context) (int, error) {
	deleted, err := s.repo.DeleteExpiredNotifications(ctx, s.visibleAfter())
	if err != nil {
		return 0, fmt.Errorf("delete expired notifications: %w", err)
	}
	return deleted, nil
}

func (s *Service) SendNotificationToUsers(ctx context.Context, input SendNotificationInput) (*SendNotificationResult, error) {
	if appErr := validateSendNotificationInput(input); appErr != nil {
		return nil, appErr
	}

	now := s.now().UTC()
	result := &SendNotificationResult{
		TargetUserCount: len(uniqueUserIDs(input.UserIDs)),
	}

	for userID := range uniqueUserIDs(input.UserIDs) {
		createResult, err := s.repo.CreateNotificationIfAbsent(ctx, CreateNotificationParams{
			UserID:         userID,
			EventID:        input.EventID,
			Title:          strings.TrimSpace(input.Title),
			Type:           input.Type,
			Body:           strings.TrimSpace(input.Body),
			DeepLink:       input.DeepLink,
			ImageURL:       input.ImageURL,
			Data:           input.Data,
			IdempotencyKey: strings.TrimSpace(input.IdempotencyKey),
			CreatedAt:      now,
		})
		if err != nil {
			return nil, fmt.Errorf("create notification: %w", err)
		}
		if !createResult.Created {
			result.IdempotentCount++
			continue
		}
		result.CreatedCount++

		delivered := 0
		if s.realtime != nil {
			delivered = s.realtime.Publish(ctx, userID, createResult.Notification)
		}
		if delivered > 0 {
			result.SSEDeliveryCount += delivered
			for i := 0; i < delivered; i++ {
				sentAt := now
				if err := s.repo.CreateDeliveryAttempt(ctx, CreateDeliveryAttemptParams{
					NotificationID: createResult.Notification.ID,
					UserID:         userID,
					Method:         domain.NotificationDeliveryMethodSSE,
					Status:         domain.NotificationDeliveryStatusSent,
					SentAt:         &sentAt,
				}); err != nil {
					return nil, fmt.Errorf("store sse delivery attempt: %w", err)
				}
			}
			continue
		}

		pushResult, err := s.sendPushForNotification(ctx, createResult.Notification)
		if err != nil {
			return nil, err
		}
		result.PushActiveDeviceCount += pushResult.ActiveDeviceCount
		result.PushSentCount += pushResult.SentCount
		result.PushFailedCount += pushResult.FailedCount
		result.InvalidTokenCount += pushResult.InvalidTokenCount
	}

	slog.InfoContext(ctx, "notifications sent",
		"operation", "notification.send",
		"target_user_count", result.TargetUserCount,
		"created_count", result.CreatedCount,
		"idempotent_count", result.IdempotentCount,
		"sse_delivery_count", result.SSEDeliveryCount,
		"push_active_device_count", result.PushActiveDeviceCount,
		"push_sent_count", result.PushSentCount,
		"push_failed_count", result.PushFailedCount,
		"invalid_token_count", result.InvalidTokenCount,
	)

	return result, nil
}

func (s *Service) SendPushToUsers(ctx context.Context, input SendPushInput) (*SendPushResult, error) {
	if appErr := validateSendPushInput(input); appErr != nil {
		return nil, appErr
	}

	result, err := s.SendNotificationToUsers(ctx, SendNotificationInput{
		UserIDs:        input.UserIDs,
		Title:          input.Title,
		Body:           input.Body,
		Type:           input.Type,
		DeepLink:       input.DeepLink,
		Data:           input.Data,
		EventID:        input.EventID,
		IdempotencyKey: "PUSH:" + uuid.NewString(),
	})
	if err != nil {
		return nil, err
	}

	return &SendPushResult{
		TargetUserCount:   result.TargetUserCount,
		ActiveDeviceCount: result.PushActiveDeviceCount,
		SentCount:         result.PushSentCount,
		FailedCount:       result.PushFailedCount,
		InvalidTokenCount: result.InvalidTokenCount,
	}, nil
}

func (s *Service) sendPushForNotification(ctx context.Context, notification domain.Notification) (*SendPushResult, error) {
	devices, err := s.repo.ListActiveDevicesForUsers(ctx, []uuid.UUID{notification.ReceiverUserID})
	if err != nil {
		return nil, fmt.Errorf("list active push devices: %w", err)
	}

	result := &SendPushResult{
		TargetUserCount:   1,
		ActiveDeviceCount: len(devices),
	}
	now := s.now().UTC()

	for _, device := range devices {
		sendResult, sendErr := s.sender.Send(ctx, PushSendMessage{
			Token:    device.FCMToken,
			Title:    notification.Title,
			Body:     notification.Body,
			ImageURL: notification.ImageURL,
			DeepLink: notification.DeepLink,
			Data:     notification.Data,
		})

		status := domain.NotificationDeliveryStatusSent
		sentAt := &now
		var errorSummary *string
		if sendErr != nil {
			slog.ErrorContext(ctx, "push notification delivery failed",
				"operation", "notification.push.device_send",
				"user_id", device.UserID.String(),
				"device_id", device.ID.String(),
				"error", sendErr,
			)
			status = domain.NotificationDeliveryStatusFailed
			sentAt = nil
			errorSummary = shortErrorSummary(sendErr)
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

		if err := s.repo.CreateDeliveryAttempt(ctx, CreateDeliveryAttemptParams{
			NotificationID: notification.ID,
			UserID:         device.UserID,
			Method:         domain.NotificationDeliveryMethodFCM,
			Status:         status,
			PushDeviceID:   &device.ID,
			ErrorSummary:   errorSummary,
			SentAt:         sentAt,
		}); err != nil {
			return nil, fmt.Errorf("store push delivery attempt: %w", err)
		}
	}

	return result, nil
}

func uniqueUserIDs(userIDs []uuid.UUID) map[uuid.UUID]struct{} {
	seen := make(map[uuid.UUID]struct{}, len(userIDs))
	for _, userID := range userIDs {
		seen[userID] = struct{}{}
	}
	return seen
}

func (s *Service) visibleAfter() time.Time {
	return s.now().UTC().AddDate(0, 0, -NotificationRetentionDays)
}

func shortErrorSummary(err error) *string {
	if err == nil {
		return nil
	}
	value := err.Error()
	if len(value) > 512 {
		value = value[:512]
	}
	return &value
}
