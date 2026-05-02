package join_request

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Repository is the application-layer persistence port for join requests.
type Repository interface {
	CreateJoinRequest(ctx context.Context, params CreateJoinRequestParams) (*domain.JoinRequest, error)
	ApproveJoinRequest(ctx context.Context, params ApproveJoinRequestParams) (*ApproveJoinRequestResult, error)
	RejectJoinRequest(ctx context.Context, params RejectJoinRequestParams) (*RejectJoinRequestResult, error)
	GetNotificationContext(ctx context.Context, joinRequestID uuid.UUID) (*NotificationContext, error)
}
