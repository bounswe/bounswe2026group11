//go:build integration

package tests_integration

import (
	"context"
	"testing"
	"time"

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

func TestNotificationInboxLifecycleAndIdempotency(t *testing.T) {
	// given
	h := common.NewNotificationHarness(t)
	user := common.GivenUser(t, h.AuthRepo)
	ctx := context.Background()
	key := "integration:" + uuid.NewString()

	// when
	firstSend, err := h.Service.SendNotificationToUsers(ctx, notificationapp.SendNotificationInput{
		UserIDs:        []uuid.UUID{user.ID},
		Title:          "Event update",
		Body:           "A new update is available.",
		IdempotencyKey: key,
		Data:           map[string]string{"source": "integration"},
	})
	if err != nil {
		t.Fatalf("SendNotificationToUsers(first) error = %v", err)
	}
	secondSend, err := h.Service.SendNotificationToUsers(ctx, notificationapp.SendNotificationInput{
		UserIDs:        []uuid.UUID{user.ID},
		Title:          "Event update",
		Body:           "A new update is available.",
		IdempotencyKey: key,
	})

	// then
	if err != nil {
		t.Fatalf("SendNotificationToUsers(second) error = %v", err)
	}
	if firstSend.CreatedCount != 1 || secondSend.IdempotentCount != 1 {
		t.Fatalf("unexpected send results first=%#v second=%#v", firstSend, secondSend)
	}

	list, err := h.Service.ListNotifications(ctx, notificationapp.ListNotificationsInput{UserID: user.ID})
	if err != nil {
		t.Fatalf("ListNotifications() error = %v", err)
	}
	if len(list.Items) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(list.Items))
	}
	if list.Items[0].Data["source"] != "integration" {
		t.Fatalf("expected notification data to round-trip, got %#v", list.Items[0].Data)
	}

	unread, err := h.Service.CountUnreadNotifications(ctx, user.ID)
	if err != nil {
		t.Fatalf("CountUnreadNotifications() error = %v", err)
	}
	if unread.UnreadCount != 1 {
		t.Fatalf("expected unread count 1, got %d", unread.UnreadCount)
	}

	if err := h.Service.MarkNotificationRead(ctx, user.ID, list.Items[0].ID); err != nil {
		t.Fatalf("MarkNotificationRead() error = %v", err)
	}
	unread, err = h.Service.CountUnreadNotifications(ctx, user.ID)
	if err != nil {
		t.Fatalf("CountUnreadNotifications(after read) error = %v", err)
	}
	if unread.UnreadCount != 0 {
		t.Fatalf("expected unread count 0, got %d", unread.UnreadCount)
	}

	if err := h.Service.DeleteNotification(ctx, user.ID, list.Items[0].ID); err != nil {
		t.Fatalf("DeleteNotification() error = %v", err)
	}
	list, err = h.Service.ListNotifications(ctx, notificationapp.ListNotificationsInput{UserID: user.ID})
	if err != nil {
		t.Fatalf("ListNotifications(after delete) error = %v", err)
	}
	if len(list.Items) != 0 {
		t.Fatalf("expected deleted notification to be hidden, got %d items", len(list.Items))
	}
}

func TestNotificationRetentionDeletesExpiredRows(t *testing.T) {
	// given
	h := common.NewNotificationHarness(t)
	user := common.GivenUser(t, h.AuthRepo)
	ctx := context.Background()
	expiredAt := time.Now().UTC().AddDate(0, 0, -(notificationapp.NotificationRetentionDays + 1))
	var notificationID uuid.UUID
	if err := h.Tx.QueryRow(ctx, `
		INSERT INTO notification (
			receiver_user_id,
			title,
			body,
			is_read,
			data,
			idempotency_key,
			created_at,
			updated_at
		)
		VALUES ($1, 'Expired', 'Expired body', FALSE, '{}'::jsonb, $2, $3, $3)
		RETURNING id
	`, user.ID, "expired:"+uuid.NewString(), expiredAt).Scan(&notificationID); err != nil {
		t.Fatalf("insert expired notification error = %v", err)
	}

	// when
	deleted, err := h.Service.DeleteExpiredNotifications(ctx)

	// then
	if err != nil {
		t.Fatalf("DeleteExpiredNotifications() error = %v", err)
	}
	if deleted != 1 {
		t.Fatalf("expected 1 deleted notification, got %d", deleted)
	}
	var exists bool
	if err := h.Tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM notification WHERE id = $1)`, notificationID).Scan(&exists); err != nil {
		t.Fatalf("lookup expired notification error = %v", err)
	}
	if exists {
		t.Fatal("expected expired notification to be hard-deleted")
	}
}
