package imageupload

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// ProfileRepository exposes the persistence required for avatar uploads.
type ProfileRepository interface {
	GetAvatarVersion(ctx context.Context, userID uuid.UUID) (int, error)
	SetAvatarIfVersion(ctx context.Context, userID uuid.UUID, expectedVersion, nextVersion int, baseURL string, updatedAt time.Time) (bool, error)
}

// EventRepository exposes the persistence required for event image uploads.
type EventRepository interface {
	GetEventImageState(ctx context.Context, eventID uuid.UUID) (*EventImageState, error)
	SetEventImageIfVersion(ctx context.Context, eventID uuid.UUID, expectedVersion, nextVersion int, baseURL string, updatedAt time.Time) (bool, error)
}

// Storage presigns uploads and verifies uploaded objects exist.
type Storage interface {
	PresignPutObject(ctx context.Context, key, contentType, cacheControl string, expires time.Duration) (*PresignedRequest, error)
	ObjectExists(ctx context.Context, key string) (bool, error)
}

// TokenManager signs and verifies confirm tokens.
type TokenManager interface {
	Sign(payload ConfirmTokenPayload, ttl time.Duration) (string, error)
	Verify(token string) (*ConfirmTokenPayload, error)
}
