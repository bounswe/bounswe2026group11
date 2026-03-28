package participation

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// UseCase is the inbound application port for participation flows.
type UseCase interface {
	CreateApprovedParticipation(ctx context.Context, eventID, userID uuid.UUID) (*domain.Participation, error)
}
