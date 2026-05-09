package invitation

import (
	"context"
	"errors"
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

func (s *Service) ListReceivedInvitations(ctx context.Context, input ListReceivedInvitationsInput) (*ReceivedInvitationsResult, error) {
	limit, cursor, appErr := normalizeListReceivedInvitationsInput(input)
	if appErr != nil {
		return nil, appErr
	}

	pendingRecords, err := s.repo.ListReceivedPendingInvitations(ctx, input.UserID)
	if err != nil {
		return nil, err
	}
	pending := make([]ReceivedInvitation, len(pendingRecords))
	for i, record := range pendingRecords {
		pending[i] = toReceivedInvitation(record)
	}

	pastRecords, err := s.repo.ListReceivedPastInvitations(ctx, input.UserID, ListPastInvitationsParams{
		Cursor:     cursor,
		FetchLimit: limit + 1,
	})
	if err != nil {
		return nil, err
	}
	hasNext := len(pastRecords) > limit
	if hasNext {
		pastRecords = pastRecords[:limit]
	}
	pastItems := make([]ReceivedInvitation, len(pastRecords))
	for i, record := range pastRecords {
		pastItems[i] = toReceivedInvitation(record)
	}
	nextCursor, err := buildNextPastInvitationCursor(pastItems, hasNext)
	if err != nil {
		return nil, err
	}

	return &ReceivedInvitationsResult{
		Pending: pending,
		Past: ReceivedInvitationsPastResult{
			Items: pastItems,
			PageInfo: InvitationPageInfo{
				NextCursor: nextCursor,
				HasNext:    hasNext,
			},
		},
	}, nil
}

// GetReceivedInvitation fetches the latest state of one invitation owned
// by the caller. It deliberately returns no event-status or invitation-
// status filter so the modal flow can render warnings for CANCELED,
// EXPIRED, or already-actioned invitations. domain.ErrNotFound from the
// repo (missing row, wrong recipient, non-PRIVATE event) maps to a 404
// with the standard invitation_not_found code; the caller's identity is
// never leaked via a 403.
func (s *Service) GetReceivedInvitation(ctx context.Context, userID, invitationID uuid.UUID) (*ReceivedInvitation, error) {
	record, err := s.repo.GetReceivedInvitation(ctx, userID, invitationID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.NotFoundError(domain.ErrorCodeInvitationNotFound, "The requested invitation does not exist.")
		}
		return nil, fmt.Errorf("get received invitation: %w", err)
	}
	dto := toReceivedInvitation(*record)
	return &dto, nil
}

// normalizeListReceivedInvitationsInput resolves the past-bucket page size
// and decodes the cursor token. A bad cursor produces a 400 with code
// `validation_error` so clients can react predictably; a missing cursor or
// limit falls back to safe defaults.
func normalizeListReceivedInvitationsInput(input ListReceivedInvitationsInput) (int, *PastInvitationCursor, *domain.AppError) {
	limit := DefaultPastInvitationLimit
	if input.PastLimit != nil {
		v := *input.PastLimit
		if v < 1 || v > MaxPastInvitationLimit {
			return 0, nil, domain.ValidationError(map[string]string{
				"past_limit": fmt.Sprintf("must be between 1 and %d", MaxPastInvitationLimit),
			})
		}
		limit = v
	}

	var cursor *PastInvitationCursor
	if input.PastCursor != nil {
		token := strings.TrimSpace(*input.PastCursor)
		if token != "" {
			decoded, err := decodePastInvitationCursor(token)
			if err != nil {
				return 0, nil, domain.ValidationError(map[string]string{
					"past_cursor": "cursor is invalid",
				})
			}
			cursor = decoded
		}
	}
	return limit, cursor, nil
}

func (s *Service) AcceptInvitation(ctx context.Context, userID, invitationID uuid.UUID) (*AcceptInvitationResult, error) {
	var record *AcceptInvitationRecord
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		record, err = s.repo.AcceptInvitation(ctx, userID, invitationID)
		if err != nil {
			slog.ErrorContext(ctx, "invitation accept failed",
				"operation", "invitation.accept",
				"invitation_id", invitationID.String(),
				"user_id", userID.String(),
				"error", err,
			)
			return err
		}
		if s.tickets != nil {
			_, err = s.tickets.CreateTicketForParticipation(ctx, record.Participation, domain.TicketStatusActive)
			if err != nil {
				slog.ErrorContext(ctx, "ticket creation after invitation accept failed",
					"operation", "invitation.accept.ticket_create",
					"invitation_id", invitationID.String(),
					"event_id", record.Invitation.EventID.String(),
					"user_id", userID.String(),
					"participation_id", record.Participation.ID.String(),
					"error", err,
				)
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	s.notifyInvitationResponse(ctx, record.Invitation.ID, domain.InvitationStatusAccepted)
	acceptedVersion := 0
	if record.Participation.LastConfirmedEventVersion != nil {
		acceptedVersion = *record.Participation.LastConfirmedEventVersion
	}
	slog.InfoContext(ctx, "invitation accepted",
		"operation", "invitation.accept",
		"invitation_id", record.Invitation.ID.String(),
		"event_id", record.Invitation.EventID.String(),
		"user_id", userID.String(),
		"participation_id", record.Participation.ID.String(),
		"participation_status", record.Participation.Status.String(),
		"accepted_event_version", acceptedVersion,
		"ticket_created", s.tickets != nil,
	)

	return &AcceptInvitationResult{
		InvitationID:        record.Invitation.ID.String(),
		EventID:             record.Invitation.EventID.String(),
		InvitationStatus:    record.Invitation.Status.String(),
		ParticipationID:     record.Participation.ID.String(),
		ParticipationStatus: record.Participation.Status.String(),
		UpdatedAt:           record.Invitation.UpdatedAt,
	}, nil
}

func (s *Service) RevokeInvitation(
	ctx context.Context,
	hostID, eventID, invitationID uuid.UUID,
) error {
	return s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		_, err := s.repo.RevokeInvitation(ctx, RevokeInvitationParams{
			EventID:      eventID,
			HostID:       hostID,
			InvitationID: invitationID,
		})
		return err
	})
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
	titleKey := "notification.invitation.accepted.title"
	bodyKey := "notification.invitation.accepted.body"
	invitedLabel := displayLabel(notificationCtx.InvitedDisplayName, notificationCtx.InvitedUsername)
	body := fmt.Sprintf("%s accepted your invitation to %s.", invitedLabel, notificationCtx.EventTitle)
	if status == domain.InvitationStatusDeclined {
		notificationType = "PRIVATE_EVENT_INVITATION_DECLINED"
		title = "Invitation declined"
		titleKey = "notification.invitation.declined.title"
		bodyKey = "notification.invitation.declined.body"
		body = fmt.Sprintf("%s declined your invitation to %s.", invitedLabel, notificationCtx.EventTitle)
	}

	deepLink := fmt.Sprintf("/events/%s", notificationCtx.EventID.String())
	_, err = s.notifications.SendNotificationToUsers(ctx, notificationapp.SendNotificationInput{
		UserIDs:  []uuid.UUID{notificationCtx.HostUserID},
		Title:    title,
		TitleKey: titleKey,
		Type:     &notificationType,
		Body:     body,
		BodyKey:  bodyKey,
		BodyArgs: []any{invitedLabel, notificationCtx.EventTitle},
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
	hostLabel := displayLabel(notificationCtx.HostDisplayName, notificationCtx.HostUsername)
	_, err := s.notifications.SendNotificationToUsers(ctx, notificationapp.SendNotificationInput{
		UserIDs:  []uuid.UUID{notificationCtx.InvitedUserID},
		Title:    "Private event invitation",
		TitleKey: "notification.invitation.received.title",
		Type:     &notificationType,
		Body:     fmt.Sprintf("%s invited you to %s.", hostLabel, notificationCtx.EventTitle),
		BodyKey:  "notification.invitation.received.body",
		BodyArgs: []any{hostLabel, notificationCtx.EventTitle},
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
