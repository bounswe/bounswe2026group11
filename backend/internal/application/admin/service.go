package admin

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/notification"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service implements admin backoffice use cases.
type Service struct {
	repo               Repository
	notifications      notification.UseCase
	tickets            ticket.LifecycleUseCase
	unitOfWork         uow.UnitOfWork
	idempotencyKeyFunc func() string
}

var _ UseCase = (*Service)(nil)

type Option func(*Service)

func WithMutationDependencies(notifications notification.UseCase, tickets ticket.LifecycleUseCase, unitOfWork uow.UnitOfWork) Option {
	return func(s *Service) {
		s.notifications = notifications
		s.tickets = tickets
		s.unitOfWork = unitOfWork
	}
}

// NewService constructs an admin service with the given repository.
func NewService(repo Repository, options ...Option) *Service {
	service := &Service{
		repo:               repo,
		idempotencyKeyFunc: uuid.NewString,
	}
	for _, option := range options {
		option(service)
	}
	return service
}

func (s *Service) SendCustomNotification(ctx context.Context, input SendCustomNotificationInput) (*SendCustomNotificationResult, error) {
	if s.notifications == nil {
		return nil, domain.ConflictError(domain.ErrorCodeAdminDependencyUnavailable, "Admin notification mutations are not configured.")
	}
	if err := s.validateCustomNotification(ctx, input); err != nil {
		return nil, err
	}

	idempotencyKey := ""
	if input.IdempotencyKey != nil {
		idempotencyKey = strings.TrimSpace(*input.IdempotencyKey)
	}
	if idempotencyKey == "" {
		idempotencyKey = "ADMIN:" + s.idempotencyKeyFunc()
	}

	result, err := s.notifications.SendCustomNotificationToUsers(ctx, notification.SendCustomNotificationInput{
		UserIDs:        input.UserIDs,
		DeliveryMode:   input.DeliveryMode,
		Title:          input.Title,
		Body:           input.Body,
		Type:           input.Type,
		DeepLink:       input.DeepLink,
		Data:           input.Data,
		EventID:        input.EventID,
		IdempotencyKey: idempotencyKey,
	})
	if err != nil {
		return nil, err
	}

	slog.InfoContext(ctx, "admin notification mutation completed",
		"operation", "admin.notifications.create",
		"admin_user_id", input.AdminUserID.String(),
		"delivery_mode", input.DeliveryMode.String(),
		"target_user_count", result.TargetUserCount,
		"created_count", result.CreatedCount,
		"idempotent_count", result.IdempotentCount,
		"sse_delivery_count", result.SSEDeliveryCount,
		"push_active_device_count", result.PushActiveDeviceCount,
		"push_sent_count", result.PushSentCount,
		"push_failed_count", result.PushFailedCount,
		"invalid_token_count", result.InvalidTokenCount,
	)

	return &SendCustomNotificationResult{
		TargetUserCount:       result.TargetUserCount,
		CreatedCount:          result.CreatedCount,
		IdempotentCount:       result.IdempotentCount,
		SSEDeliveryCount:      result.SSEDeliveryCount,
		PushActiveDeviceCount: result.PushActiveDeviceCount,
		PushSentCount:         result.PushSentCount,
		PushFailedCount:       result.PushFailedCount,
		InvalidTokenCount:     result.InvalidTokenCount,
	}, nil
}

func (s *Service) CreateManualParticipation(ctx context.Context, input CreateManualParticipationInput) (*CreateManualParticipationResult, error) {
	if s.unitOfWork == nil || s.tickets == nil {
		return nil, domain.ConflictError(domain.ErrorCodeAdminDependencyUnavailable, "Admin participation mutations are not configured.")
	}
	if err := validateManualParticipationInput(input); err != nil {
		return nil, err
	}

	var result *CreateManualParticipationResult
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		eventState, err := s.repo.GetEventState(ctx, input.EventID, true)
		if err != nil {
			return fmt.Errorf("load admin participation event: %w", err)
		}
		if eventState == nil {
			return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		if (input.Status == domain.ParticipationStatusApproved || input.Status == domain.ParticipationStatusPending) &&
			eventState.Capacity != nil &&
			eventState.ApprovedParticipantCount+eventState.PendingParticipantCount >= *eventState.Capacity {
			return domain.ConflictError(domain.ErrorCodeCapacityExceeded, "This event has reached its maximum capacity.")
		}
		if err := s.requireUsersExist(ctx, []uuid.UUID{input.UserID}); err != nil {
			return err
		}

		participation, err := s.repo.CreateManualParticipation(ctx, input.EventID, input.UserID, input.Status)
		if err != nil {
			return err
		}

		result = &CreateManualParticipationResult{
			ParticipationID: participation.ID,
			EventID:         participation.EventID,
			UserID:          participation.UserID,
			Status:          participation.Status,
		}

		if participation.Status == domain.ParticipationStatusApproved {
			createdTicket, err := s.tickets.CreateTicketForParticipation(ctx, participation, domain.TicketStatusActive)
			if err != nil {
				return err
			}
			result.TicketID = &createdTicket.ID
			result.TicketStatus = &createdTicket.Status
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	slog.InfoContext(ctx, "admin participation created",
		"operation", "admin.participations.create",
		"admin_user_id", input.AdminUserID.String(),
		"event_id", result.EventID.String(),
		"participant_user_id", result.UserID.String(),
		"participation_id", result.ParticipationID.String(),
		"participation_status", result.Status.String(),
		"ticket_created", result.TicketID != nil,
		"has_reason", input.Reason != nil && strings.TrimSpace(*input.Reason) != "",
	)
	return result, nil
}

func (s *Service) CancelParticipation(ctx context.Context, input CancelParticipationInput) (*CancelParticipationResult, error) {
	if s.unitOfWork == nil || s.tickets == nil {
		return nil, domain.ConflictError(domain.ErrorCodeAdminDependencyUnavailable, "Admin participation mutations are not configured.")
	}
	if input.ParticipationID == uuid.Nil {
		return nil, domain.ValidationError(map[string]string{"participation_id": "is required"})
	}

	var result *CancelParticipationResult
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		existing, err := s.repo.GetParticipationByID(ctx, input.ParticipationID, true)
		if err != nil {
			return fmt.Errorf("load admin participation: %w", err)
		}
		if existing == nil {
			return domain.NotFoundError(domain.ErrorCodeParticipationNotFound, "The requested participation does not exist.")
		}

		participation, alreadyCanceled, err := s.repo.CancelParticipation(ctx, input.ParticipationID)
		if err != nil {
			return err
		}
		if !alreadyCanceled {
			if err := s.tickets.CancelTicketForParticipation(ctx, input.ParticipationID); err != nil {
				return err
			}
		}

		result = &CancelParticipationResult{
			ParticipationID: participation.ID,
			EventID:         participation.EventID,
			UserID:          participation.UserID,
			Status:          participation.Status,
			AlreadyCanceled: alreadyCanceled,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	slog.InfoContext(ctx, "admin participation canceled",
		"operation", "admin.participations.cancel",
		"admin_user_id", input.AdminUserID.String(),
		"event_id", result.EventID.String(),
		"participant_user_id", result.UserID.String(),
		"participation_id", result.ParticipationID.String(),
		"already_canceled", result.AlreadyCanceled,
		"has_reason", input.Reason != nil && strings.TrimSpace(*input.Reason) != "",
	)
	return result, nil
}

func (s *Service) validateCustomNotification(ctx context.Context, input SendCustomNotificationInput) error {
	details := map[string]string{}
	if len(input.UserIDs) == 0 {
		details["user_ids"] = "must contain at least one user id"
	}
	if input.DeliveryMode == "" {
		details["delivery_mode"] = "must be one of: IN_APP, PUSH, BOTH"
	}
	if strings.TrimSpace(input.Title) == "" {
		details["title"] = "is required"
	}
	if strings.TrimSpace(input.Body) == "" {
		details["body"] = "is required"
	}
	if len(details) > 0 {
		return domain.ValidationError(details)
	}
	if err := s.requireUsersExist(ctx, input.UserIDs); err != nil {
		return err
	}
	if input.EventID != nil {
		eventState, err := s.repo.GetEventState(ctx, *input.EventID, false)
		if err != nil {
			return fmt.Errorf("load admin notification event: %w", err)
		}
		if eventState == nil {
			return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
	}
	return nil
}

func validateManualParticipationInput(input CreateManualParticipationInput) error {
	details := map[string]string{}
	if input.EventID == uuid.Nil {
		details["event_id"] = "is required"
	}
	if input.UserID == uuid.Nil {
		details["user_id"] = "is required"
	}
	switch input.Status {
	case domain.ParticipationStatusApproved, domain.ParticipationStatusPending:
	default:
		details["status"] = "must be one of: APPROVED, PENDING"
	}
	if len(details) > 0 {
		return domain.ValidationError(details)
	}
	return nil
}

func (s *Service) requireUsersExist(ctx context.Context, userIDs []uuid.UUID) error {
	unique := make([]uuid.UUID, 0, len(userIDs))
	seen := map[uuid.UUID]struct{}{}
	for _, userID := range userIDs {
		if userID == uuid.Nil {
			return domain.ValidationError(map[string]string{"user_ids": "must contain valid UUIDs"})
		}
		if _, ok := seen[userID]; ok {
			continue
		}
		seen[userID] = struct{}{}
		unique = append(unique, userID)
	}
	count, err := s.repo.CountExistingUsers(ctx, unique)
	if err != nil {
		return fmt.Errorf("count admin target users: %w", err)
	}
	if count != len(unique) {
		return domain.NotFoundError(domain.ErrorCodeUserNotFound, "One or more requested users do not exist.")
	}
	return nil
}

func (s *Service) CreateCategory(ctx context.Context, input CreateCategoryInput) (*AdminCategoryItem, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, domain.ValidationError(map[string]string{"name": "is required"})
	}
	if len(name) > 50 {
		return nil, domain.ValidationError(map[string]string{"name": "must be at most 50 characters"})
	}
	item, err := s.repo.CreateCategory(ctx, name)
	if err != nil {
		return nil, err
	}
	slog.InfoContext(ctx, "admin category created",
		"operation", "admin.categories.create",
		"admin_user_id", input.AdminUserID.String(),
		"category_id", item.ID,
	)
	return item, nil
}

func (s *Service) DeleteCategory(ctx context.Context, input DeleteCategoryInput) error {
	if input.CategoryID <= 0 {
		return domain.ValidationError(map[string]string{"category_id": "must be a positive integer"})
	}
	if err := s.repo.DeleteCategory(ctx, input.CategoryID); err != nil {
		return err
	}
	slog.InfoContext(ctx, "admin category deleted",
		"operation", "admin.categories.delete",
		"admin_user_id", input.AdminUserID.String(),
		"category_id", input.CategoryID,
	)
	return nil
}

func (s *Service) UpdateEventReportStatus(ctx context.Context, input UpdateEventReportStatusInput) (*AdminEventReportItem, error) {
	if input.ReportID == uuid.Nil {
		return nil, domain.ValidationError(map[string]string{"report_id": "is required"})
	}
	item, err := s.repo.UpdateEventReportStatus(ctx, input.ReportID, input.Status)
	if err != nil {
		return nil, err
	}
	slog.InfoContext(ctx, "admin event report status updated",
		"operation", "admin.event_reports.status",
		"admin_user_id", input.AdminUserID.String(),
		"report_id", input.ReportID.String(),
		"status", input.Status.String(),
		"has_reason", input.Reason != nil && strings.TrimSpace(*input.Reason) != "",
	)
	return item, nil
}

func (s *Service) UpdateEventStatus(ctx context.Context, input UpdateEventStatusInput) (*AdminEventItem, error) {
	if input.EventID == uuid.Nil {
		return nil, domain.ValidationError(map[string]string{"event_id": "is required"})
	}
	if input.Status == domain.EventStatusCanceled {
		if _, err := s.CancelEvent(ctx, CancelEventInput{AdminUserID: input.AdminUserID, EventID: input.EventID, Reason: input.Reason}); err != nil {
			return nil, err
		}
		return s.repo.UpdateEventStatus(ctx, input.EventID, domain.EventStatusCanceled)
	}
	item, err := s.repo.UpdateEventStatus(ctx, input.EventID, input.Status)
	if err != nil {
		return nil, err
	}
	slog.InfoContext(ctx, "admin event status updated",
		"operation", "admin.events.status",
		"admin_user_id", input.AdminUserID.String(),
		"event_id", input.EventID.String(),
		"status", input.Status.String(),
		"has_reason", input.Reason != nil && strings.TrimSpace(*input.Reason) != "",
	)
	return item, nil
}

func (s *Service) CancelEvent(ctx context.Context, input CancelEventInput) (*CancelEventResult, error) {
	if s.unitOfWork == nil || s.tickets == nil {
		return nil, domain.ConflictError(domain.ErrorCodeAdminDependencyUnavailable, "Admin event mutations are not configured.")
	}
	if input.EventID == uuid.Nil {
		return nil, domain.ValidationError(map[string]string{"event_id": "is required"})
	}
	result := &CancelEventResult{EventID: input.EventID, Status: domain.EventStatusCanceled}
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		alreadyCanceled, err := s.repo.CancelEvent(ctx, input.EventID)
		if err != nil {
			return err
		}
		result.AlreadyCanceled = alreadyCanceled
		if alreadyCanceled {
			return nil
		}
		if err := s.repo.CancelEventParticipations(ctx, input.EventID); err != nil {
			return err
		}
		if err := s.tickets.CancelTicketsForEvent(ctx, input.EventID); err != nil {
			return err
		}
		if err := s.repo.CancelPendingInvitationsForEvent(ctx, input.EventID); err != nil {
			return err
		}
		return s.repo.CancelPendingJoinRequestsForEvent(ctx, input.EventID)
	})
	if err != nil {
		return nil, err
	}
	slog.InfoContext(ctx, "admin event canceled",
		"operation", "admin.events.cancel",
		"admin_user_id", input.AdminUserID.String(),
		"event_id", input.EventID.String(),
		"already_canceled", result.AlreadyCanceled,
		"has_reason", input.Reason != nil && strings.TrimSpace(*input.Reason) != "",
	)
	return result, nil
}

func (s *Service) DeactivateUser(ctx context.Context, input DeactivateUserInput) (*DeactivateUserResult, error) {
	if s.unitOfWork == nil || s.tickets == nil {
		return nil, domain.ConflictError(domain.ErrorCodeAdminDependencyUnavailable, "Admin user mutations are not configured.")
	}
	if input.UserID == uuid.Nil {
		return nil, domain.ValidationError(map[string]string{"user_id": "is required"})
	}
	result := &DeactivateUserResult{UserID: input.UserID, Status: domain.UserStatusDeactivated}
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		status, err := s.repo.GetUserStatus(ctx, input.UserID, true)
		if err != nil {
			return err
		}
		if status == nil {
			return domain.NotFoundError(domain.ErrorCodeUserNotFound, "The requested user does not exist.")
		}
		if *status == domain.UserStatusDeactivated {
			result.AlreadyDeactivated = true
			return nil
		}
		if err := s.repo.DeactivateUser(ctx, input.UserID); err != nil {
			return err
		}
		if err := s.repo.RevokeRefreshTokensForUser(ctx, input.UserID); err != nil {
			return err
		}
		if err := s.repo.RevokePushDevicesForUser(ctx, input.UserID); err != nil {
			return err
		}
		eventIDs, err := s.repo.ListHostedCancelableEventIDs(ctx, input.UserID)
		if err != nil {
			return err
		}
		result.CanceledEventCount = len(eventIDs)
		for _, eventID := range eventIDs {
			alreadyCanceled, err := s.repo.CancelEvent(ctx, eventID)
			if err != nil {
				return err
			}
			if alreadyCanceled {
				continue
			}
			if err := s.repo.CancelEventParticipations(ctx, eventID); err != nil {
				return err
			}
			if err := s.tickets.CancelTicketsForEvent(ctx, eventID); err != nil {
				return err
			}
			if err := s.repo.CancelPendingInvitationsForEvent(ctx, eventID); err != nil {
				return err
			}
			if err := s.repo.CancelPendingJoinRequestsForEvent(ctx, eventID); err != nil {
				return err
			}
		}
		if err := s.repo.CancelUserParticipations(ctx, input.UserID); err != nil {
			return err
		}
		if err := s.repo.CancelUserTickets(ctx, input.UserID); err != nil {
			return err
		}
		if err := s.repo.CancelPendingInvitationsForUser(ctx, input.UserID); err != nil {
			return err
		}
		return s.repo.CancelPendingJoinRequestsForUser(ctx, input.UserID)
	})
	if err != nil {
		return nil, err
	}
	slog.InfoContext(ctx, "admin user deactivated",
		"operation", "admin.users.deactivate",
		"admin_user_id", input.AdminUserID.String(),
		"target_user_id", input.UserID.String(),
		"already_deactivated", result.AlreadyDeactivated,
		"canceled_event_count", result.CanceledEventCount,
		"has_reason", input.Reason != nil && strings.TrimSpace(*input.Reason) != "",
	)
	return result, nil
}

func (s *Service) UpdateInvitationStatus(ctx context.Context, input UpdateInvitationStatusInput) (*AdminInvitationItem, error) {
	if input.InvitationID == uuid.Nil {
		return nil, domain.ValidationError(map[string]string{"invitation_id": "is required"})
	}
	if input.Status != domain.InvitationStatusCanceled {
		return nil, domain.ValidationError(map[string]string{"status": "must be CANCELED"})
	}
	return s.repo.UpdateInvitationStatus(ctx, input.InvitationID, input.Status)
}

func (s *Service) UpdateJoinRequestStatus(ctx context.Context, input UpdateJoinRequestStatusInput) (*AdminJoinRequestItem, error) {
	if input.JoinRequestID == uuid.Nil {
		return nil, domain.ValidationError(map[string]string{"join_request_id": "is required"})
	}
	if input.Status != domain.JoinRequestStatusCanceled && input.Status != domain.JoinRequestStatusRejected {
		return nil, domain.ValidationError(map[string]string{"status": "must be one of: CANCELED, REJECTED"})
	}
	return s.repo.UpdateJoinRequestStatus(ctx, input.JoinRequestID, input.Status)
}

func (s *Service) DeleteComment(ctx context.Context, input DeleteCommentInput) error {
	if input.CommentID == uuid.Nil {
		return domain.ValidationError(map[string]string{"comment_id": "is required"})
	}
	return s.repo.DeleteComment(ctx, input.CommentID)
}

func (s *Service) DeleteEventRating(ctx context.Context, input DeleteRatingInput) error {
	if input.RatingID == uuid.Nil {
		return domain.ValidationError(map[string]string{"rating_id": "is required"})
	}
	return s.repo.DeleteEventRating(ctx, input.RatingID)
}

func (s *Service) DeleteParticipantRating(ctx context.Context, input DeleteRatingInput) error {
	if input.RatingID == uuid.Nil {
		return domain.ValidationError(map[string]string{"rating_id": "is required"})
	}
	return s.repo.DeleteParticipantRating(ctx, input.RatingID)
}

func (s *Service) RevokePushDevice(ctx context.Context, input RevokePushDeviceInput) error {
	if input.DeviceID == uuid.Nil {
		return domain.ValidationError(map[string]string{"device_id": "is required"})
	}
	return s.repo.RevokePushDevice(ctx, input.DeviceID)
}
