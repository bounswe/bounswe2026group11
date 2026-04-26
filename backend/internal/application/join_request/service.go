package join_request

import (
	"context"
	"errors"
	"log/slog"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("github.com/bounswe/bounswe2026group11/backend/internal/application/join_request")

// Service owns join-request-specific application behavior.
type Service struct {
	repo       Repository
	unitOfWork uow.UnitOfWork
	tickets    ticket.LifecycleUseCase
}

var _ UseCase = (*Service)(nil)

// NewService constructs a join request service backed by its own repository.
func NewService(repo Repository, unitOfWork uow.UnitOfWork, ticketLifecycle ...ticket.LifecycleUseCase) *Service {
	service := &Service{
		repo:       repo,
		unitOfWork: unitOfWork,
	}
	if len(ticketLifecycle) > 0 {
		service.tickets = ticketLifecycle[0]
	}
	return service
}

// CreatePendingJoinRequest persists a PENDING join request for the given event,
// requesting user, and host.
func (s *Service) CreatePendingJoinRequest(
	ctx context.Context,
	eventID, userID, hostUserID uuid.UUID,
	input CreatePendingJoinRequestInput,
) (*domain.JoinRequest, error) {
	var result *domain.JoinRequest
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		result, err = s.repo.CreateJoinRequest(ctx, CreateJoinRequestParams{
			EventID:    eventID,
			UserID:     userID,
			HostUserID: hostUserID,
			Message:    input.Message,
		})
		return err
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

// ApproveJoinRequest transitions a pending join request to APPROVED and creates
// the participant's APPROVED participation row atomically.
func (s *Service) ApproveJoinRequest(
	ctx context.Context,
	eventID, joinRequestID, hostUserID uuid.UUID,
) (*ApproveJoinRequestResult, error) {
	ctx, span := tracer.Start(ctx, "join_request.approve")
	defer span.End()
	span.SetAttributes(
		attribute.String("operation", "join_request.approve"),
		attribute.String("event_id", eventID.String()),
		attribute.String("join_request_id", joinRequestID.String()),
		attribute.String("host_user_id", hostUserID.String()),
	)

	var result *ApproveJoinRequestResult
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		result, err = s.repo.ApproveJoinRequest(ctx, ApproveJoinRequestParams{
			EventID:       eventID,
			JoinRequestID: joinRequestID,
			HostUserID:    hostUserID,
		})
		if err != nil {
			slog.ErrorContext(ctx, "join request approval failed",
				"operation", "join_request.approve",
				"event_id", eventID.String(),
				"join_request_id", joinRequestID.String(),
				"host_user_id", hostUserID.String(),
				"error", err,
			)
			return err
		}
		if result == nil || result.Participation == nil {
			err := errors.New("join request approval returned no participation")
			slog.ErrorContext(ctx, "join request approval failed",
				"operation", "join_request.approve",
				"event_id", eventID.String(),
				"join_request_id", joinRequestID.String(),
				"host_user_id", hostUserID.String(),
				"error", err,
			)
			return err
		}
		if s.tickets != nil {
			slog.InfoContext(ctx, "join request approved; creating ticket",
				"operation", "join_request.approve.ticket_create",
				"event_id", eventID.String(),
				"join_request_id", joinRequestID.String(),
				"host_user_id", hostUserID.String(),
				"participation_id", result.Participation.ID.String(),
				"participant_user_id", result.Participation.UserID.String(),
				"ticket_status", domain.TicketStatusActive.String(),
			)
			_, err = s.tickets.CreateTicketForParticipation(ctx, result.Participation, domain.TicketStatusActive)
			if err != nil {
				slog.ErrorContext(ctx, "ticket creation after join request approval failed",
					"operation", "join_request.approve.ticket_create",
					"event_id", eventID.String(),
					"join_request_id", joinRequestID.String(),
					"host_user_id", hostUserID.String(),
					"participation_id", result.Participation.ID.String(),
					"participant_user_id", result.Participation.UserID.String(),
					"ticket_status", domain.TicketStatusActive.String(),
					"error", err,
				)
			}
		}
		return err
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}
	if result != nil && result.Participation != nil {
		span.SetAttributes(
			attribute.String("participation_id", result.Participation.ID.String()),
			attribute.String("participant_user_id", result.Participation.UserID.String()),
		)
	}

	return result, nil
}

// RejectJoinRequest transitions a pending join request to REJECTED and returns
// the resulting cooldown end timestamp.
func (s *Service) RejectJoinRequest(
	ctx context.Context,
	eventID, joinRequestID, hostUserID uuid.UUID,
) (*RejectJoinRequestResult, error) {
	var result *RejectJoinRequestResult
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		result, err = s.repo.RejectJoinRequest(ctx, RejectJoinRequestParams{
			EventID:       eventID,
			JoinRequestID: joinRequestID,
			HostUserID:    hostUserID,
		})
		return err
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}
