package security

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
)

// RefreshTokenManager implements domain.RefreshTokenManager.
type RefreshTokenManager struct {
	ByteLength int
}

// NewToken generates a random refresh token, returning both the base64url-encoded
// plaintext (sent to the client) and its SHA-256 hash (stored in the database).
func (m RefreshTokenManager) NewToken() (string, string, error) {
	size := m.ByteLength
	if size <= 0 {
		size = 32
	}

	tokenBytes := make([]byte, size)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", "", err
	}

	plain := base64.RawURLEncoding.EncodeToString(tokenBytes)
	return plain, m.HashToken(plain), nil
}

// HashToken returns the hex-encoded SHA-256 digest of a plaintext refresh token.
func (m RefreshTokenManager) HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
