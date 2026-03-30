package join_request

import (
	"context"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// UseCase is the inbound application port for join-request flows.
type UseCase interface {
	CreatePendingJoinRequest(ctx context.Context, eventID, userID, hostUserID uuid.UUID, input CreatePendingJoinRequestInput) (*domain.JoinRequest, error)
	ApproveJoinRequest(ctx context.Context, eventID, joinRequestID, hostUserID uuid.UUID) (*ApproveJoinRequestResult, error)
	RejectJoinRequest(ctx context.Context, eventID, joinRequestID, hostUserID uuid.UUID) (*RejectJoinRequestResult, error)
}

// ApproveJoinRequestResult contains the persisted moderation state after approval.
type ApproveJoinRequestResult struct {
	JoinRequest   *domain.JoinRequest
	Participation *domain.Participation
}

// RejectJoinRequestResult contains the persisted moderation state after rejection.
type RejectJoinRequestResult struct {
	JoinRequest    *domain.JoinRequest
	CooldownEndsAt time.Time
}
