package event

import (
	"context"
	"errors"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/join_request"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/participation"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service implements the event use cases.
type Service struct {
	eventRepo            Repository
	participationService participation.UseCase
	joinRequestService   join_request.UseCase
	unitOfWork           uow.UnitOfWork
	now                  func() time.Time
}

var _ UseCase = (*Service)(nil)

// NewService constructs an event Service with its own repository and the
// cross-aggregate services it orchestrates.
func NewService(
	eventRepo Repository,
	participationService participation.UseCase,
	joinRequestService join_request.UseCase,
	unitOfWork uow.UnitOfWork,
) *Service {
	return &Service{
		eventRepo:            eventRepo,
		participationService: participationService,
		joinRequestService:   joinRequestService,
		unitOfWork:           unitOfWork,
		now:                  time.Now,
	}
}

// CreateEvent validates the input, then persists the event with its location,
// tags, and constraints in a single transaction.
func (s *Service) CreateEvent(ctx context.Context, hostID uuid.UUID, input CreateEventInput) (*CreateEventResult, error) {
	errs := validateCreateEventInput(input)
	if len(errs) > 0 {
		return nil, domain.ValidationError(errs)
	}

	params := toCreateEventParams(hostID, input)

	var created *domain.Event
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		created, err = s.eventRepo.CreateEvent(ctx, params)
		return err
	})
	if err != nil {
		return nil, err
	}

	return toCreateEventResult(created), nil
}

// DiscoverEvents returns nearby discoverable events using combined full-text,
// structured filters, and keyset pagination.
func (s *Service) DiscoverEvents(ctx context.Context, userID uuid.UUID, input DiscoverEventsInput) (*DiscoverEventsResult, error) {
	params, errs := normalizeAndValidateDiscoverEventsInput(input)
	if len(errs) > 0 {
		return nil, domain.ValidationError(errs)
	}

	fingerprint, err := buildDiscoverEventsFilterFingerprint(params)
	if err != nil {
		return nil, err
	}
	params.FilterFingerprint = fingerprint
	params.RepositoryFetchLimit = params.Limit + 1

	if params.CursorToken != "" {
		cursor, err := decodeDiscoverEventsCursor(params.CursorToken)
		if err != nil {
			return nil, domain.ValidationError(map[string]string{
				"cursor": "cursor is invalid",
			})
		}
		if cursor.SortBy != params.SortBy || cursor.FilterFingerprint != params.FilterFingerprint {
			return nil, domain.ValidationError(map[string]string{
				"cursor": "cursor does not match the active filters or sort order",
			})
		}
		params.DecodedCursor = cursor
	}

	records, err := s.eventRepo.ListDiscoverableEvents(ctx, userID, params)
	if err != nil {
		return nil, err
	}

	hasNext := len(records) > params.Limit
	if hasNext {
		records = records[:params.Limit]
	}

	items := make([]DiscoverableEventItem, len(records))
	for i, record := range records {
		items[i] = toDiscoverableEventItem(record)
	}

	var nextCursor *string
	if hasNext && len(records) > 0 {
		cursor, err := buildNextDiscoverEventsCursor(params, records[len(records)-1])
		if err != nil {
			return nil, err
		}
		encoded, err := encodeDiscoverEventsCursor(cursor)
		if err != nil {
			return nil, err
		}
		nextCursor = &encoded
	}

	return &DiscoverEventsResult{
		Items: items,
		PageInfo: DiscoverEventsPageInfo{
			NextCursor: nextCursor,
			HasNext:    hasNext,
		},
	}, nil
}

// GetEventDetail returns the maximum event detail payload visible to the
// authenticated user, enforcing event visibility rules in the repository read path.
func (s *Service) GetEventDetail(ctx context.Context, userID, eventID uuid.UUID) (*GetEventDetailResult, error) {
	record, err := s.eventRepo.GetEventDetail(ctx, userID, eventID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		return nil, err
	}

	return toEventDetailResult(record, s.now().UTC()), nil
}

// JoinEvent allows a user to join a PUBLIC event directly. The resulting
// participation record has status APPROVED.
//
// Errors:
//   - 404 event_not_found        – event does not exist
//   - 403 host_cannot_join       – caller is the event host
//   - 409 event_join_not_allowed – event is not PUBLIC
//   - 409 capacity_exceeded      – event has reached maximum capacity
//   - 409 already_participating  – caller already has a participation record
func (s *Service) JoinEvent(ctx context.Context, userID, eventID uuid.UUID) (*JoinEventResult, error) {
	event, err := s.eventRepo.GetEventByID(ctx, eventID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		return nil, err
	}

	if event.HostID == userID {
		return nil, domain.ForbiddenError(domain.ErrorCodeHostCannotJoin, "The event host cannot join their own event.")
	}

	if event.Status == domain.EventStatusCanceled || event.Status == domain.EventStatusCompleted {
		return nil, domain.ConflictError(domain.ErrorCodeEventNotJoinable, "This event is no longer accepting participants.")
	}

	if event.PrivacyLevel != domain.PrivacyPublic {
		return nil, domain.ConflictError(domain.ErrorCodeEventJoinNotAllowed, "Only PUBLIC events can be joined directly.")
	}

	if event.Capacity != nil && event.ApprovedParticipantCount >= *event.Capacity {
		return nil, domain.ConflictError(domain.ErrorCodeCapacityExceeded, "This event has reached its maximum capacity.")
	}

	p, err := s.participationService.CreateApprovedParticipation(ctx, eventID, userID)
	if err != nil {
		return nil, err
	}

	return &JoinEventResult{
		ParticipationID: p.ID.String(),
		EventID:         p.EventID.String(),
		Status:          p.Status,
		CreatedAt:       p.CreatedAt,
	}, nil
}

// LeaveEvent allows an approved participant to leave an event before it ends.
// The event host cannot leave their own event.
func (s *Service) LeaveEvent(ctx context.Context, userID, eventID uuid.UUID) (*LeaveEventResult, error) {
	event, err := s.eventRepo.GetEventByID(ctx, eventID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		return nil, err
	}

	if event.HostID == userID {
		return nil, domain.ForbiddenError(domain.ErrorCodeHostCannotLeave, "The event host cannot leave their own event.")
	}

	if !canLeaveEvent(event, s.now().UTC()) {
		return nil, domain.ConflictError(domain.ErrorCodeEventNotLeaveable, "This event can no longer be left.")
	}

	p, err := s.participationService.LeaveParticipation(ctx, eventID, userID)
	if err != nil {
		return nil, err
	}

	return &LeaveEventResult{
		ParticipationID: p.ID.String(),
		EventID:         p.EventID.String(),
		Status:          p.Status,
		UpdatedAt:       p.UpdatedAt,
	}, nil
}

// RequestJoin creates a join request for a PROTECTED event.
// The host must approve the request before the user becomes a participant.
//
// Errors:
//   - 404 event_not_found        – event does not exist
//   - 403 host_cannot_join       – caller is the event host
//   - 409 event_join_not_allowed – event is not PROTECTED
//   - 409 already_requested      – caller already has a pending request
func (s *Service) RequestJoin(ctx context.Context, userID, eventID uuid.UUID, input RequestJoinInput) (*RequestJoinResult, error) {
	event, err := s.eventRepo.GetEventByID(ctx, eventID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		return nil, err
	}

	if event.HostID == userID {
		return nil, domain.ForbiddenError(domain.ErrorCodeHostCannotJoin, "The event host cannot request to join their own event.")
	}

	if event.Status == domain.EventStatusCanceled || event.Status == domain.EventStatusCompleted {
		return nil, domain.ConflictError(domain.ErrorCodeEventNotJoinable, "This event is no longer accepting participants.")
	}

	if event.PrivacyLevel != domain.PrivacyProtected {
		return nil, domain.ConflictError(domain.ErrorCodeEventJoinNotAllowed, "Only PROTECTED events accept join requests.")
	}

	jr, err := s.joinRequestService.CreatePendingJoinRequest(ctx, eventID, userID, event.HostID, join_request.CreatePendingJoinRequestInput{
		Message: input.Message,
	})
	if err != nil {
		return nil, err
	}

	return &RequestJoinResult{
		JoinRequestID: jr.ID.String(),
		EventID:       jr.EventID.String(),
		Status:        string(domain.JoinRequestStatusPending),
		CreatedAt:     jr.CreatedAt,
	}, nil
}

// ApproveJoinRequest allows the authenticated host to approve a pending join
// request for one of their events.
func (s *Service) ApproveJoinRequest(
	ctx context.Context,
	hostUserID, eventID, joinRequestID uuid.UUID,
) (*ApproveJoinRequestResult, error) {
	event, err := s.eventRepo.GetEventByID(ctx, eventID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		return nil, err
	}
	if event.Status == domain.EventStatusCanceled || event.Status == domain.EventStatusCompleted {
		return nil, domain.ConflictError(domain.ErrorCodeEventNotJoinable, "This event is no longer accepting participants.")
	}

	result, err := s.joinRequestService.ApproveJoinRequest(ctx, eventID, joinRequestID, hostUserID)
	if err != nil {
		return nil, err
	}

	return &ApproveJoinRequestResult{
		JoinRequestID:       result.JoinRequest.ID.String(),
		EventID:             result.JoinRequest.EventID.String(),
		JoinRequestStatus:   string(result.JoinRequest.Status),
		ParticipationID:     result.Participation.ID.String(),
		ParticipationStatus: result.Participation.Status,
		UpdatedAt:           result.JoinRequest.UpdatedAt,
	}, nil
}

// RejectJoinRequest allows the authenticated host to reject a pending join
// request for one of their events.
func (s *Service) RejectJoinRequest(
	ctx context.Context,
	hostUserID, eventID, joinRequestID uuid.UUID,
) (*RejectJoinRequestResult, error) {
	result, err := s.joinRequestService.RejectJoinRequest(ctx, eventID, joinRequestID, hostUserID)
	if err != nil {
		return nil, err
	}

	return &RejectJoinRequestResult{
		JoinRequestID:  result.JoinRequest.ID.String(),
		EventID:        result.JoinRequest.EventID.String(),
		Status:         string(result.JoinRequest.Status),
		UpdatedAt:      result.JoinRequest.UpdatedAt,
		CooldownEndsAt: result.CooldownEndsAt,
	}, nil
}

// CancelEvent transitions an ACTIVE event to CANCELED. Only the event host may cancel.
func (s *Service) CancelEvent(ctx context.Context, userID, eventID uuid.UUID) error {
	return s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		event, err := s.eventRepo.GetEventByID(ctx, eventID)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
			}
			return err
		}

		if event.HostID != userID {
			return domain.ForbiddenError(domain.ErrorCodeEventCancelNotAllowed, "Only the event host can cancel this event.")
		}

		if err := s.eventRepo.CancelEvent(ctx, eventID, event.ApprovedParticipantCount); err != nil {
			if errors.Is(err, ErrEventNotCancelable) {
				return domain.ConflictError(domain.ErrorCodeEventNotCancelable, "Only ACTIVE events can be canceled.")
			}
			return err
		}

		if err := s.participationService.CancelEventParticipations(ctx, eventID); err != nil {
			return err
		}

		return nil
	})
}

// CompleteEvent transitions an ACTIVE or IN_PROGRESS event to COMPLETED. Only the host may call this.
func (s *Service) CompleteEvent(ctx context.Context, userID, eventID uuid.UUID) error {
	event, err := s.eventRepo.GetEventByID(ctx, eventID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		return err
	}

	if event.HostID != userID {
		return domain.ForbiddenError(domain.ErrorCodeEventCompleteNotAllowed, "Only the event host can complete this event.")
	}

	if err := s.eventRepo.CompleteEvent(ctx, eventID); err != nil {
		if errors.Is(err, ErrEventNotCompletable) {
			return domain.ConflictError(domain.ErrorCodeEventNotCompletable, "The event cannot be completed because it is already CANCELED or COMPLETED.")
		}
		return err
	}

	return nil
}

// AddFavorite saves an event to the user's favorites list.
func (s *Service) AddFavorite(ctx context.Context, userID, eventID uuid.UUID) error {
	return s.eventRepo.AddFavorite(ctx, userID, eventID)
}

// RemoveFavorite removes an event from the user's favorites list.
func (s *Service) RemoveFavorite(ctx context.Context, userID, eventID uuid.UUID) error {
	return s.eventRepo.RemoveFavorite(ctx, userID, eventID)
}

// ListFavoriteEvents returns events the user has favorited, ordered by most recent.
func (s *Service) ListFavoriteEvents(ctx context.Context, userID uuid.UUID) (*FavoriteEventsResult, error) {
	records, err := s.eventRepo.ListFavoriteEvents(ctx, userID)
	if err != nil {
		return nil, err
	}

	items := make([]FavoriteEventItem, len(records))
	for i, r := range records {
		items[i] = FavoriteEventItem{
			ID:          r.ID.String(),
			Title:       r.Title,
			Category:    r.CategoryName,
			ImageURL:    r.ImageURL,
			Status:      string(r.Status),
			StartTime:   r.StartTime,
			EndTime:     r.EndTime,
			FavoritedAt: r.FavoritedAt,
		}
	}

	return &FavoriteEventsResult{Items: items}, nil
}

func canLeaveEvent(event *domain.Event, now time.Time) bool {
	if event.Status == domain.EventStatusCanceled || event.Status == domain.EventStatusCompleted {
		return false
	}
	if event.EndTime != nil && !now.Before(*event.EndTime) {
		return false
	}
	return true
}
