package jwt

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	ticketapp "github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type ticketTokenClaims struct {
	TicketID        string `json:"ticket_id"`
	ParticipationID string `json:"participation_id"`
	EventID         string `json:"event_id"`
	UserID          string `json:"user_id"`
	Version         int    `json:"version"`
	gojwt.RegisteredClaims
}

// TicketTokenManager signs and verifies short-lived QR ticket tokens.
type TicketTokenManager struct {
	Secret []byte
}

var _ ticketapp.QRTokenManager = (*TicketTokenManager)(nil)

// Issue creates a signed HS256 token from ticket QR claims.
func (m TicketTokenManager) Issue(claims ticketapp.QRTokenClaims) (string, error) {
	tokenClaims := ticketTokenClaims{
		TicketID:        claims.TicketID.String(),
		ParticipationID: claims.ParticipationID.String(),
		EventID:         claims.EventID.String(),
		UserID:          claims.UserID.String(),
		Version:         claims.Version,
		RegisteredClaims: gojwt.RegisteredClaims{
			IssuedAt:  gojwt.NewNumericDate(claims.IssuedAt),
			ExpiresAt: gojwt.NewNumericDate(claims.ExpiresAt),
		},
	}

	token := gojwt.NewWithClaims(gojwt.SigningMethodHS256, tokenClaims)
	signed, err := token.SignedString(m.Secret)
	if err != nil {
		return "", err
	}
	return signed, nil
}

// Verify parses and validates a signed ticket QR token.
func (m TicketTokenManager) Verify(tokenString string) (*ticketapp.QRTokenClaims, error) {
	claims := &ticketTokenClaims{}
	token, err := gojwt.ParseWithClaims(tokenString, claims, func(token *gojwt.Token) (any, error) {
		if token.Method != gojwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.Secret, nil
	}, gojwt.WithExpirationRequired(), gojwt.WithIssuedAt())
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid ticket token: %w", err)
	}

	ticketID, err := uuid.Parse(claims.TicketID)
	if err != nil {
		return nil, fmt.Errorf("invalid ticket_id claim: %w", err)
	}
	participationID, err := uuid.Parse(claims.ParticipationID)
	if err != nil {
		return nil, fmt.Errorf("invalid participation_id claim: %w", err)
	}
	eventID, err := uuid.Parse(claims.EventID)
	if err != nil {
		return nil, fmt.Errorf("invalid event_id claim: %w", err)
	}
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id claim: %w", err)
	}
	if claims.ExpiresAt == nil || claims.IssuedAt == nil {
		return nil, fmt.Errorf("ticket token is missing time claims")
	}

	return &ticketapp.QRTokenClaims{
		TicketID:        ticketID,
		ParticipationID: participationID,
		EventID:         eventID,
		UserID:          userID,
		Version:         claims.Version,
		IssuedAt:        claims.IssuedAt.UTC(),
		ExpiresAt:       claims.ExpiresAt.UTC(),
	}, nil
}

// Hash returns a deterministic SHA-256 hash of the plaintext signed token.
func (m TicketTokenManager) Hash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
