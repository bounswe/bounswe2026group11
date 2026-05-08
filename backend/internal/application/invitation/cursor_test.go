package invitation

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestPastInvitationCursorRoundTrip(t *testing.T) {
	original := PastInvitationCursor{
		UpdatedAt:    time.Date(2026, 5, 8, 10, 30, 45, 0, time.UTC),
		InvitationID: uuid.MustParse("11111111-1111-1111-1111-111111111111"),
	}

	token, err := encodePastInvitationCursor(original)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}

	decoded, err := decodePastInvitationCursor(token)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !decoded.UpdatedAt.Equal(original.UpdatedAt) {
		t.Fatalf("updated_at mismatch: got %v, want %v", decoded.UpdatedAt, original.UpdatedAt)
	}
	if decoded.InvitationID != original.InvitationID {
		t.Fatalf("invitation_id mismatch: got %v, want %v", decoded.InvitationID, original.InvitationID)
	}
}

func TestDecodePastInvitationCursorRejectsInvalid(t *testing.T) {
	cases := []struct {
		name  string
		token string
	}{
		{"empty token", ""},
		{"non-base64", "!!!not-base64!!!"},
		{"valid base64 of garbage json", "Z2FyYmFnZQ"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := decodePastInvitationCursor(tc.token); err == nil {
				t.Fatal("expected error, got nil")
			}
		})
	}
}

func TestDecodePastInvitationCursorRejectsZeroFields(t *testing.T) {
	zeroTime, err := encodePastInvitationCursor(PastInvitationCursor{
		InvitationID: uuid.New(),
	})
	if err != nil {
		t.Fatalf("encode zero-time: %v", err)
	}
	if _, err := decodePastInvitationCursor(zeroTime); err == nil {
		t.Fatal("expected error for zero updated_at, got nil")
	}

	zeroID, err := encodePastInvitationCursor(PastInvitationCursor{
		UpdatedAt: time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("encode zero-id: %v", err)
	}
	if _, err := decodePastInvitationCursor(zeroID); err == nil {
		t.Fatal("expected error for nil invitation_id, got nil")
	}
}

func TestBuildNextPastInvitationCursor(t *testing.T) {
	items := []ReceivedInvitation{
		{InvitationID: "11111111-1111-1111-1111-111111111111", UpdatedAt: time.Date(2026, 5, 8, 10, 0, 0, 0, time.UTC)},
		{InvitationID: "22222222-2222-2222-2222-222222222222", UpdatedAt: time.Date(2026, 5, 7, 10, 0, 0, 0, time.UTC)},
	}

	got, err := buildNextPastInvitationCursor(items, true)
	if err != nil {
		t.Fatalf("buildNext hasNext=true: %v", err)
	}
	if got == nil {
		t.Fatal("expected non-nil cursor when hasNext=true")
	}
	decoded, err := decodePastInvitationCursor(*got)
	if err != nil {
		t.Fatalf("decode round-trip: %v", err)
	}
	if decoded.InvitationID.String() != items[1].InvitationID {
		t.Fatalf("cursor encodes wrong tail: got %v, want %v", decoded.InvitationID, items[1].InvitationID)
	}

	none, err := buildNextPastInvitationCursor(items, false)
	if err != nil {
		t.Fatalf("buildNext hasNext=false: %v", err)
	}
	if none != nil {
		t.Fatal("expected nil cursor when hasNext=false")
	}

	empty, err := buildNextPastInvitationCursor(nil, true)
	if err != nil {
		t.Fatalf("buildNext empty: %v", err)
	}
	if empty != nil {
		t.Fatal("expected nil cursor for empty items even when hasNext=true")
	}
}
