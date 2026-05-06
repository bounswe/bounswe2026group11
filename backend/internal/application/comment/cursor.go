package comment

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

const (
	commentCollectionDiscussion = "DISCUSSION"
	commentCollectionReview     = "REVIEW"
	commentCollectionReplies    = "REPLIES"
)

func encodeCommentCursor(cursor CommentCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	if err != nil {
		return "", fmt.Errorf("marshal comment cursor: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func decodeCommentCursor(token string) (*CommentCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, fmt.Errorf("decode comment cursor: %w", err)
	}

	var cursor CommentCursor
	if err := json.Unmarshal(raw, &cursor); err != nil {
		return nil, fmt.Errorf("unmarshal comment cursor: %w", err)
	}
	if cursor.Collection == "" {
		return nil, fmt.Errorf("cursor is missing collection")
	}
	if cursor.CreatedAt.IsZero() {
		return nil, fmt.Errorf("cursor is missing created_at")
	}
	if cursor.CommentID == uuid.Nil {
		return nil, fmt.Errorf("cursor is missing comment_id")
	}
	return &cursor, nil
}
