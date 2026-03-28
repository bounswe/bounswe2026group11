package join_request

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service owns join-request-specific application behavior.
type Service struct {
	repo Repository
}

var _ UseCase = (*Service)(nil)

// NewService constructs a join request service backed by its own repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// CreatePendingJoinRequest persists a PENDING join request for the given event,
// requesting user, and host.
func (s *Service) CreatePendingJoinRequest(
	ctx context.Context,
	eventID, userID, hostUserID uuid.UUID,
	input CreatePendingJoinRequestInput,
) (*domain.JoinRequest, error) {
	return s.repo.CreateJoinRequest(ctx, CreateJoinRequestParams{
		EventID:    eventID,
		UserID:     userID,
		HostUserID: hostUserID,
		Message:    input.Message,
	})
}
