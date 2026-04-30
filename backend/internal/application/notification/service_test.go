package notification

import (
	"context"
	"errors"
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
	if len(repo.notifications) != 2 {
		t.Fatalf("expected 2 notification rows, got %d", len(repo.notifications))
	}
}

type fakeNotificationRepo struct {
	devices       map[uuid.UUID]*domain.PushDevice
	notifications []CreateNotificationParams
}

type fakeUnitOfWork struct{}

func (fakeUnitOfWork) RunInTx(ctx context.Context, fn func(context.Context) error) error {
	return fn(ctx)
}

func newFakeNotificationRepo() *fakeNotificationRepo {
	return &fakeNotificationRepo{devices: map[uuid.UUID]*domain.PushDevice{}}
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

func (r *fakeNotificationRepo) CreateNotification(_ context.Context, params CreateNotificationParams) error {
	r.notifications = append(r.notifications, params)
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
