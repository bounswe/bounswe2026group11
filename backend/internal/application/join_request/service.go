package join_request

import (
	"context"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service owns join-request-specific application behavior.
type Service struct {
	repo       Repository
	unitOfWork uow.UnitOfWork
}

var _ UseCase = (*Service)(nil)

// NewService constructs a join request service backed by its own repository.
func NewService(repo Repository, unitOfWork uow.UnitOfWork) *Service {
	return &Service{
		repo:       repo,
		unitOfWork: unitOfWork,
	}
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
	var result *ApproveJoinRequestResult
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		result, err = s.repo.ApproveJoinRequest(ctx, ApproveJoinRequestParams{
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
