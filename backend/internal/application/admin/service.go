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

		if eventState.PrivacyLevel == domain.PrivacyProtected && participation.Status == domain.ParticipationStatusApproved {
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
