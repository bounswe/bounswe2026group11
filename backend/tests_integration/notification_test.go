//go:build integration

package tests_integration

import (
	"context"
	"testing"

	notificationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/notification"
	"github.com/bounswe/bounswe2026group11/backend/tests_integration/common"
	"github.com/google/uuid"
)

func TestNotificationRegisterDevicePersistsAndEnforcesDeviceLimit(t *testing.T) {
	// given
	h := common.NewNotificationHarness(t)
	user := common.GivenUser(t, h.AuthRepo)
	firstInstallationID := uuid.New()
	secondInstallationID := uuid.New()
	thirdInstallationID := uuid.New()

	// when
	if _, err := h.Service.RegisterDevice(context.Background(), notificationapp.RegisterDeviceInput{
		UserID:         user.ID,
		InstallationID: firstInstallationID,
		Platform:       "IOS",
		FCMToken:       "integration-token-1",
	}); err != nil {
		t.Fatalf("RegisterDevice(first) error = %v", err)
	}
	if _, err := h.Service.RegisterDevice(context.Background(), notificationapp.RegisterDeviceInput{
		UserID:         user.ID,
		InstallationID: secondInstallationID,
		Platform:       "ANDROID",
		FCMToken:       "integration-token-2",
	}); err != nil {
		t.Fatalf("RegisterDevice(second) error = %v", err)
	}
	result, err := h.Service.RegisterDevice(context.Background(), notificationapp.RegisterDeviceInput{
		UserID:         user.ID,
		InstallationID: thirdInstallationID,
		Platform:       "ANDROID",
		FCMToken:       "integration-token-3",
	})

	// then
	if err != nil {
		t.Fatalf("RegisterDevice(third) error = %v", err)
	}
	if result.ActiveDeviceCount != notificationapp.MaxActiveDevicesPerUser {
		t.Fatalf("expected active count %d, got %d", notificationapp.MaxActiveDevicesPerUser, result.ActiveDeviceCount)
	}

	devices, err := h.Repo.ListActiveDevicesForUsers(context.Background(), []uuid.UUID{user.ID})
	if err != nil {
		t.Fatalf("ListActiveDevicesForUsers() error = %v", err)
	}
	if len(devices) != notificationapp.MaxActiveDevicesPerUser {
		t.Fatalf("expected %d active devices, got %d", notificationapp.MaxActiveDevicesPerUser, len(devices))
	}
	for _, device := range devices {
		if device.InstallationID == firstInstallationID {
			t.Fatal("expected oldest installation to be revoked")
		}
	}
}
