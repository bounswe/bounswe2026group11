package ticket

import "time"

// QRTokenManager signs, verifies, and hashes short-lived QR tokens.
type QRTokenManager interface {
	Issue(claims QRTokenClaims) (string, error)
	Verify(token string) (*QRTokenClaims, error)
	Hash(token string) string
}

// Settings holds ticket service policy knobs.
type Settings struct {
	QRTokenTTL      time.Duration
	ProximityMeters float64
}
