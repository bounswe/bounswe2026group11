package invitation

import (
	"context"

	"github.com/google/uuid"
)

type UseCase interface {
	CreateInvitations(ctx context.Context, hostID, eventID uuid.UUID, input CreateInvitationsInput) (*CreateInvitationsResult, error)
	ListReceivedInvitations(ctx context.Context, userID uuid.UUID) (*ReceivedInvitationsResult, error)
	AcceptInvitation(ctx context.Context, userID, invitationID uuid.UUID) (*AcceptInvitationResult, error)
	DeclineInvitation(ctx context.Context, userID, invitationID uuid.UUID) (*DeclineInvitationResult, error)
}
