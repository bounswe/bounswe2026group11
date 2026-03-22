package jwt

import (
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	gojwt "github.com/golang-jwt/jwt/v5"
)

// Issuer implements domain.TokenIssuer using HS256 JWT.
type Issuer struct {
	Secret []byte
	TTL    time.Duration
}

// IssueAccessToken creates a signed HS256 JWT containing the user's ID, username,
// and email as claims, valid for the configured TTL.
func (j Issuer) IssueAccessToken(user domain.User, issuedAt time.Time) (string, int64, error) {
	expiresAt := issuedAt.Add(j.TTL)
	claims := gojwt.MapClaims{
		"sub":      user.ID.String(),
		"username": user.Username,
		"email":    user.Email,
		"iat":      issuedAt.Unix(),
		"exp":      expiresAt.Unix(),
	}

	token := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(j.Secret)
	if err != nil {
		return "", 0, err
	}

	return signed, int64(j.TTL.Seconds()), nil
}

