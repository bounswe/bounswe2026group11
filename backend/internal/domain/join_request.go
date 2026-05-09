package domain

import (
	"time"

	"github.com/google/uuid"
)

// JoinRequestStatus defines the lifecycle of a protected-event join request.
type JoinRequestStatus string

const (
	JoinRequestStatusPending  JoinRequestStatus = "PENDING"
	JoinRequestStatusApproved JoinRequestStatus = "APPROVED"
	JoinRequestStatusRejected JoinRequestStatus = "REJECTED"
	JoinRequestStatusCanceled JoinRequestStatus = "CANCELED"

	JoinRequestCooldown = 72 * time.Hour
)

var joinRequestStatuses = map[string]JoinRequestStatus{
	string(JoinRequestStatusPending):  JoinRequestStatusPending,
	string(JoinRequestStatusApproved): JoinRequestStatusApproved,
	string(JoinRequestStatusRejected): JoinRequestStatusRejected,
	string(JoinRequestStatusCanceled): JoinRequestStatusCanceled,
}

// ParseJoinRequestStatus converts a wire string to a JoinRequestStatus.
func ParseJoinRequestStatus(value string) (JoinRequestStatus, bool) {
	status, ok := joinRequestStatuses[value]
	return status, ok
}

func (s JoinRequestStatus) String() string {
	return string(s)
}

// JoinRequest records a pending request to join a protected event.
type JoinRequest struct {
	ID              uuid.UUID
	EventID         uuid.UUID
	UserID          uuid.UUID
	ParticipationID *uuid.UUID
	HostUserID      uuid.UUID
	Status          JoinRequestStatus
	Message         *string
	ImageURL        *string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
