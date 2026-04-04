package domain

import (
	"time"

	"github.com/google/uuid"
)

// ParticipationStatus defines the lifecycle state of an event participation row.
type ParticipationStatus string

const (
	// ParticipationStatusApproved means the user is currently participating in the event.
	ParticipationStatusApproved ParticipationStatus = "APPROVED"
	// ParticipationStatusPending is reserved for flows that keep pending participation rows.
	ParticipationStatusPending ParticipationStatus = "PENDING"
	// ParticipationStatusCanceled marks a participation canceled because the event was canceled.
	ParticipationStatusCanceled ParticipationStatus = "CANCELED"
	// ParticipationStatusLeaved marks a participant who explicitly left the event.
	ParticipationStatusLeaved ParticipationStatus = "LEAVED"
)

var participationStatuses = map[string]ParticipationStatus{
	string(ParticipationStatusApproved): ParticipationStatusApproved,
	string(ParticipationStatusPending):  ParticipationStatusPending,
	string(ParticipationStatusCanceled): ParticipationStatusCanceled,
	string(ParticipationStatusLeaved):   ParticipationStatusLeaved,
}

// ParseParticipationStatus converts a wire or persistence string into a domain status.
func ParseParticipationStatus(value string) (ParticipationStatus, bool) {
	status, ok := participationStatuses[value]
	return status, ok
}

// String returns the serialized wire value of the participation status.
func (s ParticipationStatus) String() string {
	return string(s)
}

// Participation records a user's membership status in an event.
type Participation struct {
	ID        uuid.UUID
	EventID   uuid.UUID
	UserID    uuid.UUID
	Status    ParticipationStatus
	CreatedAt time.Time
	UpdatedAt time.Time
}
