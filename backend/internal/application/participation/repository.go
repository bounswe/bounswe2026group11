package participation

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Repository is the application-layer persistence port for participations.
type Repository interface {
	CreateParticipation(ctx context.Context, eventID, userID uuid.UUID) (*domain.Participation, error)
	LeaveParticipation(ctx context.Context, eventID, userID uuid.UUID) (*domain.Participation, error)
}
