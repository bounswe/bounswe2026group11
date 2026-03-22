package jwt

import (
	"fmt"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
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

// VerifyAccessToken parses and validates a signed HS256 JWT, returning the
// embedded claims. Returns an error if the token is malformed or expired.
func (j Issuer) VerifyAccessToken(token string) (*domain.AuthClaims, error) {
	parsed, err := gojwt.Parse(token, func(t *gojwt.Token) (any, error) {
		if _, ok := t.Method.(*gojwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return j.Secret, nil
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
