package domain

import (
	"time"

	"github.com/google/uuid"
)

const (
	ParticipationStatusApproved = "APPROVED"
	ParticipationStatusPending  = "PENDING"
	ParticipationStatusCanceled = "CANCELED"
)

// Participation records a user's membership status in an event.
type Participation struct {
	ID        uuid.UUID
	EventID   uuid.UUID
	UserID    uuid.UUID
	Status    string
	CreatedAt time.Time
	UpdatedAt time.Time
}
