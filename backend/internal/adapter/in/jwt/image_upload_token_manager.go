package jwt

import (
	"errors"
	"fmt"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const imageUploadTokenSubject = "IMAGE_UPLOAD_CONFIRM" // #nosec G101 -- JWT subject constant, not a credential.

type imageUploadTokenClaims struct {
	Resource    string `json:"resource"`
	OwnerUserID string `json:"owner_user_id"`
	EventID     string `json:"event_id,omitempty"`
	Version     int    `json:"version"`
	UploadID    string `json:"upload_id"`
	BaseURL     string `json:"base_url"`
	OriginalKey string `json:"original_key"`
	SmallKey    string `json:"small_key"`
	gojwt.RegisteredClaims
}

// ImageUploadTokenManager signs and verifies image-upload confirm tokens.
type ImageUploadTokenManager struct {
	Secret []byte
	Now    func() time.Time
}

// Sign produces a signed confirm token for the supplied payload.
func (m ImageUploadTokenManager) Sign(payload imageupload.ConfirmTokenPayload, ttl time.Duration) (string, error) {
	now := time.Now().UTC()
	if m.Now != nil {
		now = m.Now().UTC()
	}

	claims := imageUploadTokenClaims{
		Resource:    payload.Resource,
		OwnerUserID: payload.OwnerUserID.String(),
		Version:     payload.Version,
		UploadID:    payload.UploadID,
		BaseURL:     payload.BaseURL,
		OriginalKey: payload.OriginalKey,
		SmallKey:    payload.SmallKey,
		RegisteredClaims: gojwt.RegisteredClaims{
			Subject:   imageUploadTokenSubject,
			IssuedAt:  gojwt.NewNumericDate(now),
			ExpiresAt: gojwt.NewNumericDate(now.Add(ttl)),
		},
	}
	if payload.EventID != nil {
		claims.EventID = payload.EventID.String()
	}

	token := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims)
	return token.SignedString(m.Secret)
}

// Verify validates the token signature and expiry, then returns the decoded payload.
func (m ImageUploadTokenManager) Verify(tokenString string) (*imageupload.ConfirmTokenPayload, error) {
	claims := &imageUploadTokenClaims{}
	token, err := gojwt.ParseWithClaims(tokenString, claims, func(token *gojwt.Token) (any, error) {
		if token.Method != gojwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method %s", token.Method.Alg())
		}
		return m.Secret, nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid || claims.Subject != imageUploadTokenSubject {
		return nil, errors.New("invalid image upload token")
	}

	ownerUserID, err := uuid.Parse(claims.OwnerUserID)
	if err != nil {
		return nil, fmt.Errorf("parse owner_user_id: %w", err)
	}

	var eventID *uuid.UUID
	if claims.EventID != "" {
		parsedEventID, err := uuid.Parse(claims.EventID)
		if err != nil {
			return nil, fmt.Errorf("parse event_id: %w", err)
		}
		eventID = &parsedEventID
	}

	payload := &imageupload.ConfirmTokenPayload{
		Resource:    claims.Resource,
		OwnerUserID: ownerUserID,
		EventID:     eventID,
		Version:     claims.Version,
		UploadID:    claims.UploadID,
		BaseURL:     claims.BaseURL,
		OriginalKey: claims.OriginalKey,
		SmallKey:    claims.SmallKey,
	}
	if claims.ExpiresAt != nil {
		payload.ExpiresAt = claims.ExpiresAt.Time
	}

	return payload, nil
}
