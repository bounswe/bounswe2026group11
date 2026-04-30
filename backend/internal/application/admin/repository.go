package admin

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Repository is the persistence port for read-only backoffice list queries.
type Repository interface {
	ListUsers(ctx context.Context, input ListUsersInput) (*ListUsersResult, error)
	ListEvents(ctx context.Context, input ListEventsInput) (*ListEventsResult, error)
	ListParticipations(ctx context.Context, input ListParticipationsInput) (*ListParticipationsResult, error)
	ListTickets(ctx context.Context, input ListTicketsInput) (*ListTicketsResult, error)
	ListNotifications(ctx context.Context, input ListNotificationsInput) (*ListNotificationsResult, error)
	CountExistingUsers(ctx context.Context, userIDs []uuid.UUID) (int, error)
	GetEventState(ctx context.Context, eventID uuid.UUID, forUpdate bool) (*AdminEventState, error)
	CreateManualParticipation(ctx context.Context, eventID, userID uuid.UUID, status domain.ParticipationStatus) (*domain.Participation, error)
	GetParticipationByID(ctx context.Context, participationID uuid.UUID, forUpdate bool) (*domain.Participation, error)
	CancelParticipation(ctx context.Context, participationID uuid.UUID) (*domain.Participation, bool, error)
}
