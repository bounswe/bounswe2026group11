package join_request

import "github.com/google/uuid"

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
