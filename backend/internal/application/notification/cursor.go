package notification

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

func encodeNotificationCursor(cursor NotificationCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	if err != nil {
		return "", fmt.Errorf("marshal notification cursor: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func decodeNotificationCursor(token string) (*NotificationCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, fmt.Errorf("decode notification cursor: %w", err)
	}

	var cursor NotificationCursor
	if err := json.Unmarshal(raw, &cursor); err != nil {
		return nil, fmt.Errorf("unmarshal notification cursor: %w", err)
	}
	if cursor.CreatedAt.IsZero() {
		return nil, fmt.Errorf("cursor is missing created_at")
	}
	if cursor.NotificationID == uuid.Nil {
		return nil, fmt.Errorf("cursor is missing notification_id")
	}
	return &cursor, nil
}

func buildNextNotificationCursor(items []domain.Notification, hasNext bool) (*string, error) {
	if !hasNext || len(items) == 0 {
		return nil, nil
	}
	last := items[len(items)-1]
	encoded, err := encodeNotificationCursor(NotificationCursor{
		CreatedAt:      last.CreatedAt,
		NotificationID: last.ID,
	})
	if err != nil {
		return nil, err
	}
	return &encoded, nil
}
