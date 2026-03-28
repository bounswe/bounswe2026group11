package join_request

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// UseCase is the inbound application port for join-request flows.
type UseCase interface {
	CreatePendingJoinRequest(ctx context.Context, eventID, userID, hostUserID uuid.UUID, input CreatePendingJoinRequestInput) (*domain.JoinRequest, error)
}
