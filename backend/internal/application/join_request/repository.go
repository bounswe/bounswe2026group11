package join_request

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
)

// Repository is the application-layer persistence port for join requests.
type Repository interface {
	CreateJoinRequest(ctx context.Context, params CreateJoinRequestParams) (*domain.JoinRequest, error)
}
