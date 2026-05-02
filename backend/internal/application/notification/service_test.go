package notification

import (
	"context"
	"errors"
	"sort"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

func TestRegisterDeviceUpsertsTokenAndEnforcesTwoDeviceLimit(t *testing.T) {
	// given
	repo := newFakeNotificationRepo()
	svc := NewService(repo, fakePushSender{}, fakeUnitOfWork{})
	svc.now = func() time.Time { return time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC) }
	userID := uuid.New()
	firstInstallationID := uuid.New()
	secondInstallationID := uuid.New()
	thirdInstallationID := uuid.New()

	// when
	if _, err := svc.RegisterDevice(context.Background(), RegisterDeviceInput{UserID: userID, InstallationID: firstInstallationID, Platform: "IOS", FCMToken: "token-1"}); err != nil {
		t.Fatalf("RegisterDevice(first) error = %v", err)
	}
	svc.now = func() time.Time { return time.Date(2026, 4, 30, 12, 1, 0, 0, time.UTC) }
	if _, err := svc.RegisterDevice(context.Background(), RegisterDeviceInput{UserID: userID, InstallationID: secondInstallationID, Platform: "ANDROID", FCMToken: "token-2"}); err != nil {
		t.Fatalf("RegisterDevice(second) error = %v", err)
	}
	svc.now = func() time.Time { return time.Date(2026, 4, 30, 12, 2, 0, 0, time.UTC) }
	result, err := svc.RegisterDevice(context.Background(), RegisterDeviceInput{UserID: userID, InstallationID: thirdInstallationID, Platform: "ANDROID", FCMToken: "token-3"})

	// then
	if err != nil {
		t.Fatalf("RegisterDevice(third) error = %v", err)
	}
	if result.ActiveDeviceCount != MaxActiveDevicesPerUser {
		t.Fatalf("expected %d active devices, got %d", MaxActiveDevicesPerUser, result.ActiveDeviceCount)
	}
	if repo.activeByInstallation(userID, firstInstallationID) {
		t.Fatal("expected oldest device to be revoked")
	}
	if !repo.activeByInstallation(userID, secondInstallationID) || !repo.activeByInstallation(userID, thirdInstallationID) {
		t.Fatal("expected the two newest devices to stay active")
	}
}

func TestRegisterDeviceReassignsTokenFromPreviousUser(t *testing.T) {
	// given
	repo := newFakeNotificationRepo()
	svc := NewService(repo, fakePushSender{}, fakeUnitOfWork{})
	now := time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return now }
	firstUserID := uuid.New()
	secondUserID := uuid.New()
	token := "shared-token"

	// when
	if _, err := svc.RegisterDevice(context.Background(), RegisterDeviceInput{UserID: firstUserID, InstallationID: uuid.New(), Platform: "IOS", FCMToken: token}); err != nil {
		t.Fatalf("RegisterDevice(first user) error = %v", err)
	}
	if _, err := svc.RegisterDevice(context.Background(), RegisterDeviceInput{UserID: secondUserID, InstallationID: uuid.New(), Platform: "IOS", FCMToken: token}); err != nil {
		t.Fatalf("RegisterDevice(second user) error = %v", err)
	}

	// then
	if active := repo.activeDeviceCount(firstUserID); active != 0 {
		t.Fatalf("expected first user token assignment to be revoked, active=%d", active)
	}
	if active := repo.activeDeviceCount(secondUserID); active != 1 {
		t.Fatalf("expected second user to own active token, active=%d", active)
	}
}

func TestSendPushToUsersStoresResultsAndRevokesInvalidToken(t *testing.T) {
	// given
	repo := newFakeNotificationRepo()
	sender := fakePushSender{invalidTokens: map[string]bool{"invalid-token": true}}
	svc := NewService(repo, sender, fakeUnitOfWork{})
	svc.now = func() time.Time { return time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC) }
	userID := uuid.New()
	validDeviceID := repo.addDevice(userID, uuid.New(), "valid-token", svc.now())
	invalidDeviceID := repo.addDevice(userID, uuid.New(), "invalid-token", svc.now())

	// when
	result, err := svc.SendPushToUsers(context.Background(), SendPushInput{
		UserIDs: []uuid.UUID{userID},
		Title:   "Event update",
		Body:    "A new update is available.",
	})

	// then
	if err != nil {
		t.Fatalf("SendPushToUsers() error = %v", err)
	}
	if result.SentCount != 1 || result.FailedCount != 1 || result.InvalidTokenCount != 1 {
		t.Fatalf("unexpected send result %#v", result)
	}
	if repo.devices[validDeviceID].RevokedAt != nil {
		t.Fatal("expected valid device to stay active")
	}
	if repo.devices[invalidDeviceID].RevokedAt == nil {
		t.Fatal("expected invalid device to be revoked")
	}
	if len(repo.notifications) != 1 {
		t.Fatalf("expected 1 inbox notification row, got %d", len(repo.notifications))
	}
	if len(repo.deliveryAttempts) != 2 {
		t.Fatalf("expected 2 delivery attempts, got %d", len(repo.deliveryAttempts))
	}
}

func TestSendNotificationToUsersSkipsPushWhenSSEReceivesNotification(t *testing.T) {
	// given
	repo := newFakeNotificationRepo()
	broker := NewBroker()
	sender := &recordingPushSender{}
	svc := NewService(repo, sender, fakeUnitOfWork{}, broker)
	svc.now = func() time.Time { return time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC) }
	userID := uuid.New()
	repo.addDevice(userID, uuid.New(), "push-token", svc.now())
	sub := broker.Subscribe(userID)
	defer sub.Cancel()

	// when
	result, err := svc.SendNotificationToUsers(context.Background(), SendNotificationInput{
		UserIDs:        []uuid.UUID{userID},
		Title:          "Event update",
		Body:           "A new update is available.",
		IdempotencyKey: "event:update:1",
	})

	// then
	if err != nil {
		t.Fatalf("SendNotificationToUsers() error = %v", err)
	}
	if result.SSEDeliveryCount != 1 || result.PushActiveDeviceCount != 0 {
		t.Fatalf("expected SSE delivery and no push, got %#v", result)
	}
	if sender.sentCount != 0 {
		t.Fatalf("expected no push sends, got %d", sender.sentCount)
	}
	select {
	case notification := <-sub.Events:
		if notification.Title != "Event update" {
			t.Fatalf("unexpected notification title %q", notification.Title)
		}
	default:
		t.Fatal("expected notification on SSE subscription")
	}
}

func TestSendNotificationToUsersIsIdempotent(t *testing.T) {
	// given
	repo := newFakeNotificationRepo()
	sender := &recordingPushSender{}
	svc := NewService(repo, sender, fakeUnitOfWork{})
	svc.now = func() time.Time { return time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC) }
	userID := uuid.New()
	repo.addDevice(userID, uuid.New(), "push-token", svc.now())
	input := SendNotificationInput{
		UserIDs:        []uuid.UUID{userID},
		Title:          "Event update",
		Body:           "A new update is available.",
		IdempotencyKey: "event:update:1",
	}

	// when
	if _, err := svc.SendNotificationToUsers(context.Background(), input); err != nil {
		t.Fatalf("SendNotificationToUsers(first) error = %v", err)
	}
	result, err := svc.SendNotificationToUsers(context.Background(), input)

	// then
	if err != nil {
		t.Fatalf("SendNotificationToUsers(second) error = %v", err)
	}
	if result.IdempotentCount != 1 || result.CreatedCount != 0 {
		t.Fatalf("expected idempotent duplicate, got %#v", result)
	}
	if len(repo.notifications) != 1 {
		t.Fatalf("expected one inbox notification, got %d", len(repo.notifications))
	}
	if sender.sentCount != 1 {
		t.Fatalf("expected push to be sent only once, got %d", sender.sentCount)
	}
}

func TestSendNotificationRetriesPushUntilSuccess(t *testing.T) {
	// given
	repo := newFakeNotificationRepo()
	sender := &flakyPushSender{failuresBeforeSuccess: 2}
	svc := NewService(repo, sender, fakeUnitOfWork{})
	svc.now = func() time.Time { return time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC) }
	userID := uuid.New()
	repo.addDevice(userID, uuid.New(), "push-token", svc.now())

	// when
	result, err := svc.SendNotificationToUsers(context.Background(), SendNotificationInput{
		UserIDs:        []uuid.UUID{userID},
		Title:          "Event update",
		Body:           "A new update is available.",
		IdempotencyKey: "event:update:retry-success",
	})

	// then
	if err != nil {
		t.Fatalf("SendNotificationToUsers() error = %v", err)
	}
	if result.PushSentCount != 1 || result.PushFailedCount != 0 {
		t.Fatalf("expected final push success, got %#v", result)
	}
	if sender.sentCount != 3 {
		t.Fatalf("expected three send attempts, got %d", sender.sentCount)
	}
	if len(repo.deliveryAttempts) != 3 {
		t.Fatalf("expected three delivery attempt rows, got %d", len(repo.deliveryAttempts))
	}
	if repo.deliveryAttempts[2].Status != domain.NotificationDeliveryStatusSent {
		t.Fatalf("expected final delivery attempt SENT, got %q", repo.deliveryAttempts[2].Status)
	}
}

func TestSendNotificationStopsAfterTwoPushRetries(t *testing.T) {
	// given
	repo := newFakeNotificationRepo()
	sender := &flakyPushSender{failuresBeforeSuccess: 99}
	svc := NewService(repo, sender, fakeUnitOfWork{})
	svc.now = func() time.Time { return time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC) }
	userID := uuid.New()
	repo.addDevice(userID, uuid.New(), "push-token", svc.now())

	// when
	result, err := svc.SendNotificationToUsers(context.Background(), SendNotificationInput{
		UserIDs:        []uuid.UUID{userID},
		Title:          "Event update",
		Body:           "A new update is available.",
		IdempotencyKey: "event:update:retry-fail",
	})

	// then
	if err != nil {
		t.Fatalf("SendNotificationToUsers() error = %v", err)
	}
	if result.PushSentCount != 0 || result.PushFailedCount != 1 {
		t.Fatalf("expected one final push failure, got %#v", result)
	}
	if sender.sentCount != 3 {
		t.Fatalf("expected three send attempts, got %d", sender.sentCount)
	}
	if len(repo.deliveryAttempts) != 3 {
		t.Fatalf("expected three delivery attempt rows, got %d", len(repo.deliveryAttempts))
	}
}

func TestSendCustomNotificationBothUsesSSEAndPush(t *testing.T) {
	// given
	repo := newFakeNotificationRepo()
	broker := NewBroker()
	sender := &recordingPushSender{}
	svc := NewService(repo, sender, fakeUnitOfWork{}, broker)
	svc.now = func() time.Time { return time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC) }
	userID := uuid.New()
	repo.addDevice(userID, uuid.New(), "push-token", svc.now())
	sub := broker.Subscribe(userID)
	defer sub.Cancel()

	// when
	result, err := svc.SendCustomNotificationToUsers(context.Background(), SendCustomNotificationInput{
		UserIDs:        []uuid.UUID{userID},
		DeliveryMode:   domain.NotificationDeliveryModeBoth,
		Title:          "Admin update",
		Body:           "Please check this.",
		IdempotencyKey: "admin:update:1",
	})

	// then
	if err != nil {
		t.Fatalf("SendCustomNotificationToUsers() error = %v", err)
	}
	if result.SSEDeliveryCount != 1 || result.PushSentCount != 1 {
		t.Fatalf("expected SSE and push delivery, got %#v", result)
	}
	if sender.sentCount != 1 {
		t.Fatalf("expected one push send, got %d", sender.sentCount)
	}
	select {
	case notification := <-sub.Events:
		if notification.Title != "Admin update" {
			t.Fatalf("unexpected notification title %q", notification.Title)
		}
	default:
		t.Fatal("expected notification on SSE subscription")
	}
}

func TestSendCustomNotificationInAppSkipsPush(t *testing.T) {
	// given
	repo := newFakeNotificationRepo()
	sender := &recordingPushSender{}
	svc := NewService(repo, sender, fakeUnitOfWork{})
	svc.now = func() time.Time { return time.Date(2026, 4, 30, 12, 0, 0, 0, time.UTC) }
	userID := uuid.New()
	repo.addDevice(userID, uuid.New(), "push-token", svc.now())

	// when
	result, err := svc.SendCustomNotificationToUsers(context.Background(), SendCustomNotificationInput{
		UserIDs:        []uuid.UUID{userID},
		DeliveryMode:   domain.NotificationDeliveryModeInApp,
		Title:          "Admin update",
		Body:           "Please check this.",
		IdempotencyKey: "admin:update:2",
	})

	// then
	if err != nil {
		t.Fatalf("SendCustomNotificationToUsers() error = %v", err)
	}
	if result.PushActiveDeviceCount != 0 || result.PushSentCount != 0 || sender.sentCount != 0 {
		t.Fatalf("expected no push delivery, result=%#v sends=%d", result, sender.sentCount)
	}
	if len(repo.notifications) != 1 {
		t.Fatalf("expected one inbox notification, got %d", len(repo.notifications))
	}
}

type fakeNotificationRepo struct {
	devices          map[uuid.UUID]*domain.PushDevice
	notifications    map[uuid.UUID]*domain.Notification
	deliveryAttempts []CreateDeliveryAttemptParams
}

type fakeUnitOfWork struct{}

func (fakeUnitOfWork) RunInTx(ctx context.Context, fn func(context.Context) error) error {
	return fn(ctx)
}

func newFakeNotificationRepo() *fakeNotificationRepo {
	return &fakeNotificationRepo{
		devices:       map[uuid.UUID]*domain.PushDevice{},
		notifications: map[uuid.UUID]*domain.Notification{},
	}
}

func (r *fakeNotificationRepo) LockUser(_ context.Context, userID uuid.UUID) error {
	if userID == uuid.Nil {
		return domain.ErrNotFound
	}
	return nil
}

func (r *fakeNotificationRepo) UpsertDevice(_ context.Context, params RegisterDeviceParams) (*domain.PushDevice, error) {
	for _, device := range r.devices {
		if device.FCMToken == params.FCMToken && device.RevokedAt == nil && (device.UserID != params.UserID || device.InstallationID != params.InstallationID) {
			now := params.LastSeenAt
			device.RevokedAt = &now
		}
	}
	for _, device := range r.devices {
		if device.UserID == params.UserID && device.InstallationID == params.InstallationID && device.RevokedAt == nil {
			device.Platform = params.Platform
			device.FCMToken = params.FCMToken
			device.DeviceInfo = params.DeviceInfo
			device.LastSeenAt = params.LastSeenAt
			device.UpdatedAt = params.LastSeenAt
			return device, nil
		}
	}
	id := r.addDevice(params.UserID, params.InstallationID, params.FCMToken, params.LastSeenAt)
	device := r.devices[id]
	device.Platform = params.Platform
	device.DeviceInfo = params.DeviceInfo
	return device, nil
}

func (r *fakeNotificationRepo) CountActiveDevices(_ context.Context, userID uuid.UUID) (int, error) {
	return r.activeDeviceCount(userID), nil
}

func (r *fakeNotificationRepo) RevokeOldestActiveDevices(_ context.Context, userID uuid.UUID, maxActive int, revokedAt time.Time) (int, error) {
	for r.activeDeviceCount(userID) > maxActive {
		var oldest *domain.PushDevice
		for _, device := range r.devices {
			if device.UserID != userID || device.RevokedAt != nil {
				continue
			}
			if oldest == nil || device.LastSeenAt.Before(oldest.LastSeenAt) {
				oldest = device
			}
		}
		if oldest == nil {
			return 0, nil
		}
		oldest.RevokedAt = &revokedAt
	}
	return 0, nil
}

func (r *fakeNotificationRepo) RevokeDevice(_ context.Context, userID, installationID uuid.UUID, revokedAt time.Time) (bool, error) {
	for _, device := range r.devices {
		if device.UserID == userID && device.InstallationID == installationID && device.RevokedAt == nil {
			device.RevokedAt = &revokedAt
			return true, nil
		}
	}
	return false, nil
}

func (r *fakeNotificationRepo) RevokeDeviceByID(_ context.Context, deviceID uuid.UUID, revokedAt time.Time) error {
	device := r.devices[deviceID]
	if device == nil {
		return domain.ErrNotFound
	}
	device.RevokedAt = &revokedAt
	return nil
}

func (r *fakeNotificationRepo) ListActiveDevicesForUsers(_ context.Context, userIDs []uuid.UUID) ([]domain.PushDevice, error) {
	userSet := map[uuid.UUID]struct{}{}
	for _, userID := range userIDs {
		userSet[userID] = struct{}{}
	}
	devices := []domain.PushDevice{}
	for _, device := range r.devices {
		if _, ok := userSet[device.UserID]; ok && device.RevokedAt == nil {
			devices = append(devices, *device)
		}
	}
	return devices, nil
}

func (r *fakeNotificationRepo) CreateNotificationIfAbsent(_ context.Context, params CreateNotificationParams) (*CreateNotificationResult, error) {
	for _, notification := range r.notifications {
		if notification.ReceiverUserID == params.UserID && notification.IdempotencyKey == params.IdempotencyKey {
			return &CreateNotificationResult{Notification: *notification, Created: false}, nil
		}
	}
	notification := &domain.Notification{
		ID:             uuid.New(),
		EventID:        params.EventID,
		ReceiverUserID: params.UserID,
		Title:          params.Title,
		Type:           params.Type,
		Body:           params.Body,
		DeepLink:       params.DeepLink,
		ImageURL:       params.ImageURL,
		Data:           params.Data,
		IdempotencyKey: params.IdempotencyKey,
		CreatedAt:      params.CreatedAt,
		UpdatedAt:      params.CreatedAt,
	}
	if notification.Data == nil {
		notification.Data = map[string]string{}
	}
	r.notifications[notification.ID] = notification
	return &CreateNotificationResult{Notification: *notification, Created: true}, nil
}

func (r *fakeNotificationRepo) ListNotifications(_ context.Context, params ListNotificationsParams) ([]domain.Notification, error) {
	notifications := []domain.Notification{}
	for _, notification := range r.notifications {
		if notification.ReceiverUserID != params.UserID || notification.DeletedAt != nil || notification.CreatedAt.Before(params.VisibleAfter) {
			continue
		}
		if params.OnlyUnread && notification.IsRead {
			continue
		}
		if params.DecodedCursor != nil && !notificationBeforeCursor(*notification, *params.DecodedCursor) {
			continue
		}
		notifications = append(notifications, *notification)
	}
	sort.Slice(notifications, func(i, j int) bool {
		if notifications[i].CreatedAt.Equal(notifications[j].CreatedAt) {
			return notifications[i].ID.String() > notifications[j].ID.String()
		}
		return notifications[i].CreatedAt.After(notifications[j].CreatedAt)
	})
	if len(notifications) > params.RepositoryFetchLimit {
		notifications = notifications[:params.RepositoryFetchLimit]
	}
	return notifications, nil
}

func (r *fakeNotificationRepo) CountUnreadNotifications(_ context.Context, userID uuid.UUID, visibleAfter time.Time) (int, error) {
	count := 0
	for _, notification := range r.notifications {
		if notification.ReceiverUserID == userID && !notification.IsRead && notification.DeletedAt == nil && !notification.CreatedAt.Before(visibleAfter) {
			count++
		}
	}
	return count, nil
}

func (r *fakeNotificationRepo) MarkNotificationRead(_ context.Context, userID, notificationID uuid.UUID, readAt, visibleAfter time.Time) (bool, error) {
	notification := r.notifications[notificationID]
	if notification == nil || notification.ReceiverUserID != userID || notification.DeletedAt != nil || notification.CreatedAt.Before(visibleAfter) {
		return false, nil
	}
	notification.IsRead = true
	if notification.ReadAt == nil {
		notification.ReadAt = &readAt
	}
	notification.UpdatedAt = readAt
	return true, nil
}

func (r *fakeNotificationRepo) MarkAllNotificationsRead(_ context.Context, userID uuid.UUID, readAt, visibleAfter time.Time) (int, error) {
	count := 0
	for _, notification := range r.notifications {
		if notification.ReceiverUserID == userID && !notification.IsRead && notification.DeletedAt == nil && !notification.CreatedAt.Before(visibleAfter) {
			notification.IsRead = true
			notification.ReadAt = &readAt
			notification.UpdatedAt = readAt
			count++
		}
	}
	return count, nil
}

func (r *fakeNotificationRepo) SoftDeleteNotification(_ context.Context, userID, notificationID uuid.UUID, deletedAt, visibleAfter time.Time) error {
	notification := r.notifications[notificationID]
	if notification != nil && notification.ReceiverUserID == userID && notification.DeletedAt == nil && !notification.CreatedAt.Before(visibleAfter) {
		notification.DeletedAt = &deletedAt
		notification.UpdatedAt = deletedAt
	}
	return nil
}

func (r *fakeNotificationRepo) SoftDeleteAllNotifications(_ context.Context, userID uuid.UUID, deletedAt, visibleAfter time.Time) error {
	for _, notification := range r.notifications {
		if notification.ReceiverUserID == userID && notification.DeletedAt == nil && !notification.CreatedAt.Before(visibleAfter) {
			notification.DeletedAt = &deletedAt
			notification.UpdatedAt = deletedAt
		}
	}
	return nil
}

func (r *fakeNotificationRepo) DeleteExpiredNotifications(_ context.Context, cutoff time.Time) (int, error) {
	count := 0
	for id, notification := range r.notifications {
		if notification.CreatedAt.Before(cutoff) {
			delete(r.notifications, id)
			count++
		}
	}
	return count, nil
}

func (r *fakeNotificationRepo) CreateDeliveryAttempt(_ context.Context, params CreateDeliveryAttemptParams) error {
	r.deliveryAttempts = append(r.deliveryAttempts, params)
	return nil
}

func (r *fakeNotificationRepo) addDevice(userID, installationID uuid.UUID, token string, now time.Time) uuid.UUID {
	id := uuid.New()
	r.devices[id] = &domain.PushDevice{
		ID:             id,
		UserID:         userID,
		InstallationID: installationID,
		Platform:       domain.PushDevicePlatformIOS,
		FCMToken:       token,
		LastSeenAt:     now,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	return id
}

func (r *fakeNotificationRepo) activeDeviceCount(userID uuid.UUID) int {
	count := 0
	for _, device := range r.devices {
		if device.UserID == userID && device.RevokedAt == nil {
			count++
		}
	}
	return count
}

func (r *fakeNotificationRepo) activeByInstallation(userID, installationID uuid.UUID) bool {
	for _, device := range r.devices {
		if device.UserID == userID && device.InstallationID == installationID && device.RevokedAt == nil {
			return true
		}
	}
	return false
}

type fakePushSender struct {
	invalidTokens map[string]bool
}

func (s fakePushSender) Send(_ context.Context, message PushSendMessage) (*PushSendResult, error) {
	if s.invalidTokens[message.Token] {
		return &PushSendResult{InvalidToken: true}, errors.New("invalid token")
	}
	return &PushSendResult{}, nil
}

type recordingPushSender struct {
	sentCount int
}

func (s *recordingPushSender) Send(_ context.Context, _ PushSendMessage) (*PushSendResult, error) {
	s.sentCount++
	return &PushSendResult{}, nil
}

type flakyPushSender struct {
	sentCount             int
	failuresBeforeSuccess int
}

func (s *flakyPushSender) Send(context.Context, PushSendMessage) (*PushSendResult, error) {
	s.sentCount++
	if s.sentCount <= s.failuresBeforeSuccess {
		return &PushSendResult{}, errors.New("temporary push failure")
	}
	return &PushSendResult{}, nil
}

func notificationBeforeCursor(notification domain.Notification, cursor NotificationCursor) bool {
	return notification.CreatedAt.Before(cursor.CreatedAt) ||
		(notification.CreatedAt.Equal(cursor.CreatedAt) && notification.ID.String() < cursor.NotificationID.String())
}
