package join_request

import (
	"time"

	"github.com/google/uuid"
)

// CreateJoinRequestParams carries the data needed to persist a join request.
type CreateJoinRequestParams struct {
	EventID    uuid.UUID
	UserID     uuid.UUID
	HostUserID uuid.UUID
	Message    *string
}

// CreatePendingJoinRequestInput carries optional join-request details supplied by the caller.
type CreatePendingJoinRequestInput struct {
	Message *string
}

// ApproveJoinRequestParams carries the identifiers needed to approve a join request.
type ApproveJoinRequestParams struct {
	EventID       uuid.UUID
	JoinRequestID uuid.UUID
	HostUserID    uuid.UUID
}

// RejectJoinRequestParams carries the identifiers needed to reject a join request.
type RejectJoinRequestParams struct {
	EventID       uuid.UUID
	JoinRequestID uuid.UUID
	HostUserID    uuid.UUID
}

type NotificationContext struct {
	JoinRequestID        uuid.UUID
	EventID              uuid.UUID
	EventTitle           string
	EventImageURL        *string
	EventStartTime       time.Time
	HostUserID           uuid.UUID
	HostUsername         string
	HostDisplayName      *string
	RequesterUserID      uuid.UUID
	RequesterUsername    string
	RequesterDisplayName *string
}
