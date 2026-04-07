package event

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

func encodeEventCollectionCursor(cursor EventCollectionCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	if err != nil {
		return "", fmt.Errorf("marshal event collection cursor: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func decodeEventCollectionCursor(token string) (*EventCollectionCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, fmt.Errorf("decode event collection cursor: %w", err)
	}

	var cursor EventCollectionCursor
	if err := json.Unmarshal(raw, &cursor); err != nil {
		return nil, fmt.Errorf("unmarshal event collection cursor: %w", err)
	}

	if cursor.CreatedAt.IsZero() {
		return nil, fmt.Errorf("cursor is missing created_at")
	}
	if cursor.EntityID == uuid.Nil {
		return nil, fmt.Errorf("cursor is missing entity_id")
	}

	return &cursor, nil
}
