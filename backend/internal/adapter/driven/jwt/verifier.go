package jwt

import (
	"fmt"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Verifier implements domain.TokenVerifier using HS256 JWT.
type Verifier struct {
	Secret []byte
}

// VerifyAccessToken parses and validates a signed HS256 JWT, returning the
// embedded claims. Returns an error if the token is malformed or expired.
func (v Verifier) VerifyAccessToken(token string) (*domain.AuthClaims, error) {
	parsed, err := gojwt.Parse(token, func(t *gojwt.Token) (any, error) {
		if _, ok := t.Method.(*gojwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return v.Secret, nil
	}, gojwt.WithExpirationRequired())
	if err != nil || !parsed.Valid {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := parsed.Claims.(gojwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	sub, _ := claims["sub"].(string)
	userID, err := uuid.Parse(sub)
	if err != nil {
		return nil, fmt.Errorf("invalid subject claim: %w", err)
	}

	username, _ := claims["username"].(string)
	email, _ := claims["email"].(string)

	return &domain.AuthClaims{
		UserID:   userID,
		Username: username,
		Email:    email,
	}, nil
}
