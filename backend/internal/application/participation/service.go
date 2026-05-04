package participation

import (
	"context"
	"log/slog"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// BadgeEvaluator is the local port for triggering participation-related badge
// evaluation after a participation status change. It is intentionally minimal
// so the participation service does not depend on the full badge use case.
type BadgeEvaluator interface {
	EvaluateParticipationBadges(ctx context.Context, userID uuid.UUID) error
}

// Service owns participation-specific application behavior.
type Service struct {
	repo           Repository
	badgeEvaluator BadgeEvaluator
}

var _ UseCase = (*Service)(nil)

// NewService constructs a participation service backed by its own repository.
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// SetBadgeEvaluator wires in the badge use case so the participation service
// can re-evaluate participation badges after status changes.
func (s *Service) SetBadgeEvaluator(evaluator BadgeEvaluator) {
	s.badgeEvaluator = evaluator
}

// CreateApprovedParticipation persists an APPROVED participation for the given
// event and user.
func (s *Service) CreateApprovedParticipation(ctx context.Context, eventID, userID uuid.UUID) (*domain.Participation, error) {
	participation, err := s.repo.CreateParticipation(ctx, eventID, userID)
	if err != nil {
		return nil, err
	}
	s.evaluateParticipationBadges(ctx, userID)
	return participation, nil
}

// LeaveParticipation marks an APPROVED participation as LEAVED for the given
// event and user.
func (s *Service) LeaveParticipation(ctx context.Context, eventID, userID uuid.UUID) (*domain.Participation, error) {
	return s.repo.LeaveParticipation(ctx, eventID, userID)
}

// CancelEventParticipations marks all non-LEAVED participations for an event as CANCELED
// and returns the user IDs of every participation that was transitioned.
func (s *Service) CancelEventParticipations(ctx context.Context, eventID uuid.UUID) ([]uuid.UUID, error) {
	return s.repo.CancelEventParticipations(ctx, eventID)
}

// evaluateParticipationBadges runs badge evaluation as a best-effort hook so
// transient badge-evaluation failures never fail the parent operation.
func (s *Service) evaluateParticipationBadges(ctx context.Context, userID uuid.UUID) {
	if s.badgeEvaluator == nil {
		return
	}
	if err := s.badgeEvaluator.EvaluateParticipationBadges(ctx, userID); err != nil {
		slog.WarnContext(ctx, "participation badge evaluation failed",
			slog.String("operation", "participation.evaluate_badges"),
			slog.String("user_id", userID.String()),
			slog.String("error", err.Error()),
		)
	}
}
