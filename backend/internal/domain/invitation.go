package domain

import (
	"time"

	"github.com/google/uuid"
)

// InvitationStatus defines the lifecycle state of an invitation row.
type InvitationStatus string

const (
	InvitationStatusPending  InvitationStatus = "PENDING"
	InvitationStatusAccepted InvitationStatus = "ACCEPTED"
	InvitationStatusDeclined InvitationStatus = "DECLINED"
	InvitationStatusExpired  InvitationStatus = "EXPIRED"

	InvitationDeclineCooldown = 14 * 24 * time.Hour
)

var invitationStatuses = map[string]InvitationStatus{
	string(InvitationStatusPending):  InvitationStatusPending,
	string(InvitationStatusAccepted): InvitationStatusAccepted,
	string(InvitationStatusDeclined): InvitationStatusDeclined,
	string(InvitationStatusExpired):  InvitationStatusExpired,
}

// ParseInvitationStatus converts a wire or persistence string into an invitation status.
func ParseInvitationStatus(value string) (InvitationStatus, bool) {
	status, ok := invitationStatuses[value]
	return status, ok
}

// String returns the serialized wire value of the invitation status.
func (s InvitationStatus) String() string {
	return string(s)
}

// Invitation records a host-created event invitation.
type Invitation struct {
	ID            uuid.UUID
	EventID       uuid.UUID
	HostID        uuid.UUID
	InvitedUserID uuid.UUID
	Status        InvitationStatus
	Message       *string
	ExpiresAt     *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}
