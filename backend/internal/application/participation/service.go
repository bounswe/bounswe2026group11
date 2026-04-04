package participation

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service owns participation-specific application behavior.
type Service struct {
	repo Repository
}

var _ UseCase = (*Service)(nil)

// NewService constructs a participation service backed by its own repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// CreateApprovedParticipation persists an APPROVED participation for the given
// event and user.
func (s *Service) CreateApprovedParticipation(ctx context.Context, eventID, userID uuid.UUID) (*domain.Participation, error) {
	return s.repo.CreateParticipation(ctx, eventID, userID)
}

// LeaveParticipation marks an APPROVED participation as LEAVED for the given
// event and user.
func (s *Service) LeaveParticipation(ctx context.Context, eventID, userID uuid.UUID) (*domain.Participation, error) {
	return s.repo.LeaveParticipation(ctx, eventID, userID)
}

// CancelEventParticipations marks all non-LEAVED participations for an event as CANCELED.
func (s *Service) CancelEventParticipations(ctx context.Context, eventID uuid.UUID) error {
	return s.repo.CancelEventParticipations(ctx, eventID)
}
