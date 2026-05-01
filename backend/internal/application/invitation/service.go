package invitation

import (
	"context"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

const maxBatchInviteUsernames = 100

type Service struct {
	repo       Repository
	unitOfWork uow.UnitOfWork
	tickets    ticket.LifecycleUseCase
	now        func() time.Time
}

var _ UseCase = (*Service)(nil)

func NewService(repo Repository, unitOfWork uow.UnitOfWork, ticketLifecycle ...ticket.LifecycleUseCase) *Service {
	service := &Service{
		repo:       repo,
		unitOfWork: unitOfWork,
		now:        time.Now,
	}
	if len(ticketLifecycle) > 0 {
		service.tickets = ticketLifecycle[0]
	}
	return service
}

func (s *Service) CreateInvitations(
	ctx context.Context,
	hostID, eventID uuid.UUID,
	input CreateInvitationsInput,
) (*CreateInvitationsResult, error) {
	usernames, errs := normalizeInviteUsernames(input.Usernames)
	if len(errs) > 0 {
		return nil, domain.ValidationError(errs)
	}

	var record *CreateInvitationsRecord
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		record, err = s.repo.CreateInvitations(ctx, CreateInvitationsParams{
			EventID:   eventID,
			HostID:    hostID,
			Usernames: usernames,
			Message:   normalizeOptionalMessage(input.Message),
			Now:       s.now().UTC(),
		})
		return err
	})
	if err != nil {
		return nil, err
	}

	return toCreateInvitationsResult(record), nil
}

func (s *Service) ListReceivedInvitations(ctx context.Context, userID uuid.UUID) (*ReceivedInvitationsResult, error) {
	records, err := s.repo.ListReceivedPendingInvitations(ctx, userID)
	if err != nil {
		return nil, err
	}

	items := make([]ReceivedInvitation, len(records))
	for i, record := range records {
		items[i] = toReceivedInvitation(record)
	}
	return &ReceivedInvitationsResult{Items: items}, nil
}

func (s *Service) AcceptInvitation(ctx context.Context, userID, invitationID uuid.UUID) (*AcceptInvitationResult, error) {
	var record *AcceptInvitationRecord
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		record, err = s.repo.AcceptInvitation(ctx, userID, invitationID)
		if err != nil {
			return err
		}
		if s.tickets != nil {
			_, err = s.tickets.CreateTicketForParticipation(ctx, record.Participation, domain.TicketStatusActive)
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &AcceptInvitationResult{
		InvitationID:        record.Invitation.ID.String(),
		EventID:             record.Invitation.EventID.String(),
		InvitationStatus:    record.Invitation.Status.String(),
		ParticipationID:     record.Participation.ID.String(),
		ParticipationStatus: record.Participation.Status.String(),
		UpdatedAt:           record.Invitation.UpdatedAt,
	}, nil
}

func (s *Service) DeclineInvitation(ctx context.Context, userID, invitationID uuid.UUID) (*DeclineInvitationResult, error) {
	var invitation *domain.Invitation
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		invitation, err = s.repo.DeclineInvitation(ctx, userID, invitationID)
		return err
	})
	if err != nil {
		return nil, err
	}

	return &DeclineInvitationResult{
		InvitationID:   invitation.ID.String(),
		EventID:        invitation.EventID.String(),
		Status:         invitation.Status.String(),
		UpdatedAt:      invitation.UpdatedAt,
		CooldownEndsAt: invitation.UpdatedAt.Add(domain.InvitationDeclineCooldown),
	}, nil
}

func normalizeInviteUsernames(raw []string) ([]string, map[string]string) {
	errs := make(map[string]string)
	if len(raw) == 0 {
		errs["usernames"] = "must contain at least 1 username"
		return nil, errs
	}
	if len(raw) > maxBatchInviteUsernames {
		errs["usernames"] = "must contain at most 100 usernames"
		return nil, errs
	}

	usernames := make([]string, len(raw))
	for i, username := range raw {
		usernames[i] = strings.TrimSpace(username)
	}
	return usernames, errs
}

func normalizeOptionalMessage(message *string) *string {
	if message == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*message)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
