package domain

import (
	"time"

	"github.com/google/uuid"
)

// JoinRequest records a pending request to join a protected event.
type JoinRequest struct {
	ID              uuid.UUID
	EventID         uuid.UUID
	UserID          uuid.UUID
	ParticipationID *uuid.UUID
	HostUserID      uuid.UUID
	Status          string
	Message         *string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
