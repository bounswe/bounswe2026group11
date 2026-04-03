package domain

import (
	"time"

	"github.com/google/uuid"
)

// FavoriteLocation is a user-owned saved location with a single named point.
type FavoriteLocation struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	Name      string
	Address   string
	Point     GeoPoint
	CreatedAt time.Time
	UpdatedAt time.Time
}
