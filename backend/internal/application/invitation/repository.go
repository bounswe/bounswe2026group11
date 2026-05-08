package invitation

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type Repository interface {
	CreateInvitations(ctx context.Context, params CreateInvitationsParams) (*CreateInvitationsRecord, error)
	ListReceivedPendingInvitations(ctx context.Context, userID uuid.UUID) ([]ReceivedInvitationRecord, error)
	// ListReceivedPastInvitations returns the recipient's DECLINED+EXPIRED
	// invitations for PRIVATE events, ordered (updated_at DESC, id DESC) for
	// keyset pagination. Event status is intentionally not filtered so a
	// declined invitation for an event that has since ended remains visible.
	ListReceivedPastInvitations(ctx context.Context, userID uuid.UUID, params ListPastInvitationsParams) ([]ReceivedInvitationRecord, error)
	AcceptInvitation(ctx context.Context, userID, invitationID uuid.UUID) (*AcceptInvitationRecord, error)
	DeclineInvitation(ctx context.Context, userID, invitationID uuid.UUID) (*domain.Invitation, error)
	GetInvitationNotificationContext(ctx context.Context, invitationID uuid.UUID) (*InvitationNotificationContext, error)
	RevokeInvitation(ctx context.Context, params RevokeInvitationParams) (*domain.Invitation, error)
}
