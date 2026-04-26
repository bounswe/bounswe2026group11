package jwt

import (
	"testing"
	"time"

	ticketapp "github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	"github.com/google/uuid"
)

func TestTicketTokenManagerIssuesAndVerifiesClaims(t *testing.T) {
	// given
	manager := TicketTokenManager{Secret: []byte("ticket-secret")}
	claims := ticketapp.QRTokenClaims{
		TicketID:        uuid.New(),
		ParticipationID: uuid.New(),
		EventID:         uuid.New(),
		UserID:          uuid.New(),
		Version:         42,
		IssuedAt:        time.Now().UTC().Truncate(time.Second),
		ExpiresAt:       time.Now().UTC().Add(10 * time.Second).Truncate(time.Second),
	}

	// when
	token, err := manager.Issue(claims)
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}
	parsed, err := manager.Verify(token)

	// then
	if err != nil {
		t.Fatalf("Verify() error = %v", err)
	}
	if parsed.TicketID != claims.TicketID || parsed.ParticipationID != claims.ParticipationID || parsed.EventID != claims.EventID || parsed.UserID != claims.UserID {
		t.Fatalf("parsed claims do not match original: %+v", parsed)
	}
	if parsed.Version != claims.Version {
		t.Fatalf("expected version %d, got %d", claims.Version, parsed.Version)
	}
	if manager.Hash(token) == token || manager.Hash(token) == "" {
		t.Fatal("expected token hash to be non-empty and different from plaintext")
	}
}

func TestTicketTokenManagerRejectsExpiredToken(t *testing.T) {
	// given
	manager := TicketTokenManager{Secret: []byte("ticket-secret")}
	token, err := manager.Issue(ticketapp.QRTokenClaims{
		TicketID:        uuid.New(),
		ParticipationID: uuid.New(),
		EventID:         uuid.New(),
		UserID:          uuid.New(),
		Version:         1,
		IssuedAt:        time.Now().UTC().Add(-20 * time.Second),
		ExpiresAt:       time.Now().UTC().Add(-10 * time.Second),
	})
	if err != nil {
		t.Fatalf("Issue() error = %v", err)
	}

	// when
	_, err = manager.Verify(token)

	// then
	if err == nil {
		t.Fatal("expected expired token to be rejected")
	}
}
