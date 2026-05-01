package invitation

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	notificationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/notification"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

const maxBatchInviteUsernames = 100

type Service struct {
	repo          Repository
	unitOfWork    uow.UnitOfWork
	tickets       ticket.LifecycleUseCase
	notifications notificationapp.UseCase
	now           func() time.Time
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

func (s *Service) SetNotificationService(notifications notificationapp.UseCase) {
	s.notifications = notifications
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

	s.notifyCreatedInvitations(ctx, record)

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

	s.notifyInvitationResponse(ctx, record.Invitation.ID, domain.InvitationStatusAccepted)

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

	s.notifyInvitationResponse(ctx, invitation.ID, domain.InvitationStatusDeclined)

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

func (s *Service) notifyCreatedInvitations(ctx context.Context, record *CreateInvitationsRecord) {
	if s.notifications == nil || record == nil {
		return
	}
	for _, item := range record.SuccessfulInvitations {
		if item.Invitation == nil {
			continue
		}
		notificationCtx, err := s.repo.GetInvitationNotificationContext(ctx, item.Invitation.ID)
		if err != nil {
			slog.ErrorContext(ctx, "invitation notification context load failed",
				"operation", "invitation.notification.context",
				"invitation_id", item.Invitation.ID.String(),
				"error", err,
			)
			continue
		}
		s.sendInvitationReceivedNotification(ctx, notificationCtx)
	}
}

func (s *Service) notifyInvitationResponse(ctx context.Context, invitationID uuid.UUID, status domain.InvitationStatus) {
	if s.notifications == nil {
		return
	}
	notificationCtx, err := s.repo.GetInvitationNotificationContext(ctx, invitationID)
	if err != nil {
		slog.ErrorContext(ctx, "invitation response notification context load failed",
			"operation", "invitation.response.notification.context",
			"invitation_id", invitationID.String(),
			"status", status.String(),
			"error", err,
		)
		return
	}

	notificationType := "PRIVATE_EVENT_INVITATION_ACCEPTED"
	title := "Invitation accepted"
	body := fmt.Sprintf("%s accepted your invitation to %s.", displayLabel(notificationCtx.InvitedDisplayName, notificationCtx.InvitedUsername), notificationCtx.EventTitle)
	if status == domain.InvitationStatusDeclined {
		notificationType = "PRIVATE_EVENT_INVITATION_DECLINED"
		title = "Invitation declined"
		body = fmt.Sprintf("%s declined your invitation to %s.", displayLabel(notificationCtx.InvitedDisplayName, notificationCtx.InvitedUsername), notificationCtx.EventTitle)
	}

	deepLink := fmt.Sprintf("/events/%s", notificationCtx.EventID.String())
	_, err = s.notifications.SendNotificationToUsers(ctx, notificationapp.SendNotificationInput{
		UserIDs:  []uuid.UUID{notificationCtx.HostUserID},
		Title:    title,
		Type:     &notificationType,
		Body:     body,
		DeepLink: &deepLink,
		EventID:  &notificationCtx.EventID,
		ImageURL: notificationCtx.EventImageURL,
		Data: invitationNotificationData(notificationCtx, map[string]string{
			"invitation_id":  notificationCtx.InvitationID.String(),
			"actor_user_id":  notificationCtx.InvitedUserID.String(),
			"actor_username": notificationCtx.InvitedUsername,
			"status":         status.String(),
		}, notificationCtx.InvitedDisplayName),
		IdempotencyKey: fmt.Sprintf("INVITATION_%s:%s", status.String(), notificationCtx.InvitationID.String()),
	})
	if err != nil {
		slog.ErrorContext(ctx, "invitation response notification send failed",
			"operation", "invitation.response.notification.send",
			"invitation_id", notificationCtx.InvitationID.String(),
			"event_id", notificationCtx.EventID.String(),
			"receiver_user_id", notificationCtx.HostUserID.String(),
			"status", status.String(),
			"error", err,
		)
	}
}

func (s *Service) sendInvitationReceivedNotification(ctx context.Context, notificationCtx *InvitationNotificationContext) {
	if notificationCtx == nil {
		return
	}
	notificationType := "PRIVATE_EVENT_INVITATION_RECEIVED"
	deepLink := fmt.Sprintf("/events/%s", notificationCtx.EventID.String())
	_, err := s.notifications.SendNotificationToUsers(ctx, notificationapp.SendNotificationInput{
		UserIDs:  []uuid.UUID{notificationCtx.InvitedUserID},
		Title:    "Private event invitation",
		Type:     &notificationType,
		Body:     fmt.Sprintf("%s invited you to %s.", displayLabel(notificationCtx.HostDisplayName, notificationCtx.HostUsername), notificationCtx.EventTitle),
		DeepLink: &deepLink,
		EventID:  &notificationCtx.EventID,
		ImageURL: notificationCtx.EventImageURL,
		Data: invitationNotificationData(notificationCtx, map[string]string{
			"invitation_id":  notificationCtx.InvitationID.String(),
			"actor_user_id":  notificationCtx.HostUserID.String(),
			"actor_username": notificationCtx.HostUsername,
			"status":         domain.InvitationStatusPending.String(),
		}, notificationCtx.HostDisplayName),
		IdempotencyKey: fmt.Sprintf("INVITATION_RECEIVED:%s", notificationCtx.InvitationID.String()),
	})
	if err != nil {
		slog.ErrorContext(ctx, "invitation received notification send failed",
			"operation", "invitation.received.notification.send",
			"invitation_id", notificationCtx.InvitationID.String(),
			"event_id", notificationCtx.EventID.String(),
			"receiver_user_id", notificationCtx.InvitedUserID.String(),
			"error", err,
		)
	}
}

func invitationNotificationData(notificationCtx *InvitationNotificationContext, extra map[string]string, actorDisplayName *string) map[string]string {
	data := map[string]string{
		"event_id":         notificationCtx.EventID.String(),
		"event_title":      notificationCtx.EventTitle,
		"event_start_time": notificationCtx.EventStartTime.UTC().Format(time.RFC3339),
	}
	for key, value := range extra {
		data[key] = value
	}
	if actorDisplayName != nil && strings.TrimSpace(*actorDisplayName) != "" {
		data["actor_display_name"] = strings.TrimSpace(*actorDisplayName)
	}
	return data
}

func displayLabel(displayName *string, username string) string {
	if displayName != nil && strings.TrimSpace(*displayName) != "" {
		return strings.TrimSpace(*displayName)
	}
	return username
}
