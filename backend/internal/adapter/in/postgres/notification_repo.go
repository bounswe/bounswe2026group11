package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	notificationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/notification"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NotificationRepository is the Postgres-backed implementation of notification.Repository.
type NotificationRepository struct {
	pool *pgxpool.Pool
	db   execer
}

func NewNotificationRepository(pool *pgxpool.Pool) *NotificationRepository {
	return &NotificationRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

func NewNotificationRepositoryWithTx(pool *pgxpool.Pool, tx pgx.Tx) *NotificationRepository {
	return &NotificationRepository{
		pool: pool,
		db:   contextualRunner{fallback: tx},
	}
}

func (r *NotificationRepository) LockUser(ctx context.Context, userID uuid.UUID) error {
	var lockedID uuid.UUID
	if err := r.db.QueryRow(ctx, `
		SELECT id
		FROM app_user
		WHERE id = $1
		FOR UPDATE
	`, userID).Scan(&lockedID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return fmt.Errorf("lock user: %w", err)
	}
	return nil
}

func (r *NotificationRepository) UpsertDevice(ctx context.Context, params notificationapp.RegisterDeviceParams) (*domain.PushDevice, error) {
	device, err := scanPushDevice(r.db.QueryRow(ctx, `
		WITH revoked_token AS (
			UPDATE user_push_device
			SET revoked_at = $6,
			    updated_at = $6
			WHERE fcm_token = $4
			  AND revoked_at IS NULL
			  AND NOT (user_id = $1 AND installation_id = $2)
		)
		INSERT INTO user_push_device (
			user_id,
			installation_id,
			platform,
			fcm_token,
			device_info,
			last_seen_at,
			revoked_at,
			created_at,
			updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, NULL, $6, $6)
		ON CONFLICT (user_id, installation_id) WHERE revoked_at IS NULL
		DO UPDATE SET
			platform = EXCLUDED.platform,
			fcm_token = EXCLUDED.fcm_token,
			device_info = EXCLUDED.device_info,
			last_seen_at = EXCLUDED.last_seen_at,
			revoked_at = NULL,
			updated_at = EXCLUDED.updated_at
		RETURNING id, user_id, installation_id, platform, fcm_token, device_info, last_seen_at, revoked_at, created_at, updated_at
	`, params.UserID, params.InstallationID, params.Platform, params.FCMToken, params.DeviceInfo, params.LastSeenAt))
	if err != nil {
		return nil, err
	}
	return device, nil
}

func (r *NotificationRepository) CountActiveDevices(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM user_push_device
		WHERE user_id = $1
		  AND revoked_at IS NULL
	`, userID).Scan(&count); err != nil {
		return 0, fmt.Errorf("count active push devices: %w", err)
	}
	return count, nil
}

func (r *NotificationRepository) RevokeOldestActiveDevices(ctx context.Context, userID uuid.UUID, maxActive int, revokedAt time.Time) (int, error) {
	tag, err := r.db.Exec(ctx, `
		WITH ranked AS (
			SELECT id,
			       ROW_NUMBER() OVER (ORDER BY last_seen_at DESC, updated_at DESC, id DESC) AS keep_rank
			FROM user_push_device
			WHERE user_id = $1
			  AND revoked_at IS NULL
		)
		UPDATE user_push_device d
		SET revoked_at = $3,
		    updated_at = $3
		FROM ranked
		WHERE d.id = ranked.id
		  AND ranked.keep_rank > $2
		  AND d.revoked_at IS NULL
	`, userID, maxActive, revokedAt)
	if err != nil {
		return 0, fmt.Errorf("revoke oldest active push devices: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

func (r *NotificationRepository) RevokeDevice(ctx context.Context, userID, installationID uuid.UUID, revokedAt time.Time) (bool, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE user_push_device
		SET revoked_at = $3,
		    updated_at = $3
		WHERE user_id = $1
		  AND installation_id = $2
		  AND revoked_at IS NULL
	`, userID, installationID, revokedAt)
	if err != nil {
		return false, fmt.Errorf("revoke push device: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

func (r *NotificationRepository) RevokeDeviceByID(ctx context.Context, deviceID uuid.UUID, revokedAt time.Time) error {
	if _, err := r.db.Exec(ctx, `
		UPDATE user_push_device
		SET revoked_at = $2,
		    updated_at = $2
		WHERE id = $1
		  AND revoked_at IS NULL
	`, deviceID, revokedAt); err != nil {
		return fmt.Errorf("revoke push device by id: %w", err)
	}
	return nil
}

func (r *NotificationRepository) ListActiveDevicesForUsers(ctx context.Context, userIDs []uuid.UUID) ([]domain.PushDevice, error) {
	if len(userIDs) == 0 {
		return []domain.PushDevice{}, nil
	}

	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, installation_id, platform, fcm_token, device_info, last_seen_at, revoked_at, created_at, updated_at
		FROM user_push_device
		WHERE user_id = ANY($1)
		  AND revoked_at IS NULL
		ORDER BY user_id ASC, last_seen_at DESC, id ASC
	`, userIDs)
	if err != nil {
		return nil, fmt.Errorf("list active push devices: %w", err)
	}
	defer rows.Close()

	devices := []domain.PushDevice{}
	for rows.Next() {
		device, err := scanPushDevice(rows)
		if err != nil {
			return nil, fmt.Errorf("scan push device: %w", err)
		}
		devices = append(devices, *device)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate push devices: %w", err)
	}
	return devices, nil
}

func (r *NotificationRepository) CreateNotification(ctx context.Context, params notificationapp.CreateNotificationParams) error {
	if _, err := r.db.Exec(ctx, `
		INSERT INTO notification (
			event_id,
			receiver_user_id,
			title,
			type,
			body,
			is_read,
			deep_link,
			delivery_method,
			status,
			sent_at
		)
		VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7, $8, $9)
	`, params.EventID, params.UserID, params.Title, params.Type, params.Body, params.DeepLink, params.DeliveryMethod, params.Status, params.SentAt); err != nil {
		return fmt.Errorf("insert notification: %w", err)
	}
	return nil
}

func scanPushDevice(row pgx.Row) (*domain.PushDevice, error) {
	var (
		device     domain.PushDevice
		platform   string
		deviceInfo pgtype.Text
		revokedAt  pgtype.Timestamptz
	)

	if err := row.Scan(
		&device.ID,
		&device.UserID,
		&device.InstallationID,
		&platform,
		&device.FCMToken,
		&deviceInfo,
		&device.LastSeenAt,
		&revokedAt,
		&device.CreatedAt,
		&device.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}

	parsedPlatform, ok := domain.ParsePushDevicePlatform(platform)
	if !ok {
		return nil, fmt.Errorf("push device %s has invalid platform %q", device.ID, platform)
	}
	device.Platform = parsedPlatform
	device.DeviceInfo = textPtr(deviceInfo)
	device.RevokedAt = timestamptzPtr(revokedAt)
	return &device, nil
}

var _ notificationapp.Repository = (*NotificationRepository)(nil)
