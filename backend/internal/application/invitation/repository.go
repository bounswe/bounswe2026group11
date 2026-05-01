package invitation

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type Repository interface {
	CreateInvitations(ctx context.Context, params CreateInvitationsParams) (*CreateInvitationsRecord, error)
	ListReceivedPendingInvitations(ctx context.Context, userID uuid.UUID) ([]ReceivedInvitationRecord, error)
	AcceptInvitation(ctx context.Context, userID, invitationID uuid.UUID) (*AcceptInvitationRecord, error)
	DeclineInvitation(ctx context.Context, userID, invitationID uuid.UUID) (*domain.Invitation, error)
}
