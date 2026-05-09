package invitation

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
)

func encodePastInvitationCursor(cursor PastInvitationCursor) (string, error) {
	raw, err := json.Marshal(cursor)
	if err != nil {
		return "", fmt.Errorf("marshal past invitation cursor: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

// decodePastInvitationCursor parses an opaque token. It enforces both
// fields are populated so callers cannot smuggle a partial cursor that
// would skip pages or scan from the start of the index.
func decodePastInvitationCursor(token string) (*PastInvitationCursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, fmt.Errorf("decode past invitation cursor: %w", err)
	}

	var cursor PastInvitationCursor
	if err := json.Unmarshal(raw, &cursor); err != nil {
		return nil, fmt.Errorf("unmarshal past invitation cursor: %w", err)
	}
	if cursor.UpdatedAt.IsZero() {
		return nil, fmt.Errorf("cursor is missing updated_at")
	}
	if cursor.InvitationID == uuid.Nil {
		return nil, fmt.Errorf("cursor is missing invitation_id")
	}
	return &cursor, nil
}

// buildNextPastInvitationCursor returns nil when there is no next page,
// avoiding unnecessary cursors in the response.
func buildNextPastInvitationCursor(items []ReceivedInvitation, hasNext bool) (*string, error) {
	if !hasNext || len(items) == 0 {
		return nil, nil
	}
	last := items[len(items)-1]
	id, err := uuid.Parse(last.InvitationID)
	if err != nil {
		return nil, fmt.Errorf("parse last invitation id: %w", err)
	}
	encoded, err := encodePastInvitationCursor(PastInvitationCursor{
		UpdatedAt:    last.UpdatedAt,
		InvitationID: id,
	})
	if err != nil {
		return nil, err
	}
	return &encoded, nil
}
