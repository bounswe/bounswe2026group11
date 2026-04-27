package ticket

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// UseCase is the inbound application port for ticket flows.
type UseCase interface {
	LifecycleUseCase
	ListMyTickets(ctx context.Context, userID uuid.UUID) (*ListTicketsResult, error)
	GetMyTicket(ctx context.Context, userID, ticketID uuid.UUID) (*TicketDetailResult, error)
	IssueQRToken(ctx context.Context, userID, ticketID uuid.UUID, input QRTokenInput) (*QRTokenResult, error)
	ScanTicket(ctx context.Context, hostUserID, eventID uuid.UUID, input ScanTicketInput) (*ScanTicketResult, error)
}

// LifecycleUseCase exposes ticket lifecycle mutations used by other application services.
type LifecycleUseCase interface {
	CreateTicketForParticipation(ctx context.Context, participation *domain.Participation, status domain.TicketStatus) (*domain.Ticket, error)
	CancelTicketForParticipation(ctx context.Context, participationID uuid.UUID) error
	CancelTicketsForEvent(ctx context.Context, eventID uuid.UUID) error
	ExpireTicketsForEvent(ctx context.Context, eventID uuid.UUID) error
}
