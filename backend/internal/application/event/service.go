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

const (
	defaultEventCollectionLimit = 25
	maxEventCollectionLimit     = 50
)

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

// GetEventHostContextSummary returns host-only management counters without
// loading the underlying collections.
func (s *Service) GetEventHostContextSummary(ctx context.Context, userID, eventID uuid.UUID) (*EventHostContextSummary, error) {
	if _, err := s.requireEventHost(ctx, userID, eventID); err != nil {
		return nil, err
	}

	record, err := s.eventRepo.GetEventHostContextSummary(ctx, eventID)
	if err != nil {
		return nil, err
	}

	return toEventHostContextSummary(record), nil
}

// ListEventApprovedParticipants returns the host-only approved-participant collection.
func (s *Service) ListEventApprovedParticipants(
	ctx context.Context,
	userID, eventID uuid.UUID,
	input ListEventCollectionInput,
) (*ListEventApprovedParticipantsResult, error) {
	if _, err := s.requireEventHost(ctx, userID, eventID); err != nil {
		return nil, err
	}

	params, err := normalizeEventCollectionInput(input)
	if err != nil {
		return nil, err
	}

	records, nextCursor, hasNext, err := s.loadEventApprovedParticipantsPage(ctx, eventID, params)
	if err != nil {
		return nil, err
	}

	return &ListEventApprovedParticipantsResult{
		Items:    toEventDetailApprovedParticipants(records),
		PageInfo: toEventCollectionPageInfo(nextCursor, hasNext),
	}, nil
}

// ListEventPendingJoinRequests returns the host-only pending join-request collection.
func (s *Service) ListEventPendingJoinRequests(
	ctx context.Context,
	userID, eventID uuid.UUID,
	input ListEventCollectionInput,
) (*ListEventPendingJoinRequestsResult, error) {
	if _, err := s.requireEventHost(ctx, userID, eventID); err != nil {
		return nil, err
	}

	params, err := normalizeEventCollectionInput(input)
	if err != nil {
		return nil, err
	}

	records, nextCursor, hasNext, err := s.loadEventPendingJoinRequestsPage(ctx, eventID, params)
	if err != nil {
		return nil, err
	}

	return &ListEventPendingJoinRequestsResult{
		Items:    toEventDetailPendingJoinRequests(records),
		PageInfo: toEventCollectionPageInfo(nextCursor, hasNext),
	}, nil
}

// ListEventInvitations returns the host-only invitation collection.
func (s *Service) ListEventInvitations(
	ctx context.Context,
	userID, eventID uuid.UUID,
	input ListEventCollectionInput,
) (*ListEventInvitationsResult, error) {
	if _, err := s.requireEventHost(ctx, userID, eventID); err != nil {
		return nil, err
	}

	params, err := normalizeEventCollectionInput(input)
	if err != nil {
		return nil, err
	}

	records, nextCursor, hasNext, err := s.loadEventInvitationsPage(ctx, eventID, params)
	if err != nil {
		return nil, err
	}

	return &ListEventInvitationsResult{
		Items:    toEventDetailInvitations(records),
		PageInfo: toEventCollectionPageInfo(nextCursor, hasNext),
	}, nil
}

// JoinEvent allows a user to join a PUBLIC event directly. The resulting
// participation record has status APPROVED.
//
// Errors:
//   - 404 event_not_found            – event does not exist
//   - 403 host_cannot_join           – caller is the event host
//   - 409 event_join_not_allowed     – event is not PUBLIC
//   - 409 capacity_exceeded          – event has reached maximum capacity
//   - 409 already_participating      – caller already has a participation record
//   - 400 profile_incomplete         – event has an age/gender restriction but user profile is missing the required field
//   - 409 age_requirement_not_met    – user is below the event's minimum age
//   - 409 gender_requirement_not_met – user gender does not match the event's preferred gender
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

	if err := s.ensureRequesterEligible(ctx, userID, event); err != nil {
		return nil, err
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
//   - 404 event_not_found            – event does not exist
//   - 403 host_cannot_join           – caller is the event host
//   - 409 event_join_not_allowed     – event is not PROTECTED
//   - 409 already_requested          – caller already has a pending request
//   - 400 profile_incomplete         – event has an age/gender restriction but user profile is missing the required field
//   - 409 age_requirement_not_met    – user is below the event's minimum age
//   - 409 gender_requirement_not_met – user gender does not match the event's preferred gender
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

	if err := s.ensureRequesterEligible(ctx, userID, event); err != nil {
		return nil, err
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
			ID:              r.ID.String(),
			Title:           r.Title,
			Category:        r.CategoryName,
			ImageURL:        r.ImageURL,
			Status:          string(r.Status),
			PrivacyLevel:    string(r.PrivacyLevel),
			LocationAddress: r.LocationAddress,
			StartTime:       r.StartTime,
			EndTime:         r.EndTime,
			FavoritedAt:     r.FavoritedAt,
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

func normalizeEventCollectionInput(input ListEventCollectionInput) (EventCollectionPageParams, error) {
	params := EventCollectionPageParams{
		Limit: defaultEventCollectionLimit,
	}

	if input.Limit != nil {
		if *input.Limit < 1 || *input.Limit > maxEventCollectionLimit {
			return EventCollectionPageParams{}, domain.ValidationError(map[string]string{
				"limit": "limit must be between 1 and 50",
			})
		}
		params.Limit = *input.Limit
	}

	if input.Cursor != nil {
		params.CursorToken = *input.Cursor
	}
	params.RepositoryFetchLimit = params.Limit + 1

	if params.CursorToken != "" {
		cursor, err := decodeEventCollectionCursor(params.CursorToken)
		if err != nil {
			return EventCollectionPageParams{}, domain.ValidationError(map[string]string{
				"cursor": "cursor is invalid",
			})
		}
		params.DecodedCursor = cursor
	}

	return params, nil
}

func (s *Service) requireEventHost(ctx context.Context, userID, eventID uuid.UUID) (*domain.Event, error) {
	event, err := s.eventRepo.GetEventByID(ctx, eventID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		return nil, err
	}

	if event.HostID != userID {
		return nil, domain.ForbiddenError(
			domain.ErrorCodeEventHostManagementNotAllowed,
			"Only the event host can access this management resource.",
		)
	}

	return event, nil
}

func (s *Service) loadEventApprovedParticipantsPage(
	ctx context.Context,
	eventID uuid.UUID,
	params EventCollectionPageParams,
) ([]EventDetailApprovedParticipantRecord, *string, bool, error) {
	records, err := s.eventRepo.ListEventApprovedParticipants(ctx, eventID, params)
	if err != nil {
		return nil, nil, false, err
	}

	hasNext := len(records) > params.Limit
	if hasNext {
		records = records[:params.Limit]
	}

	nextCursor, err := buildNextApprovedParticipantsCursor(records, hasNext)
	if err != nil {
		return nil, nil, false, err
	}

	return records, nextCursor, hasNext, nil
}

func (s *Service) loadEventPendingJoinRequestsPage(
	ctx context.Context,
	eventID uuid.UUID,
	params EventCollectionPageParams,
) ([]EventDetailPendingJoinRequestRecord, *string, bool, error) {
	records, err := s.eventRepo.ListEventPendingJoinRequests(ctx, eventID, params)
	if err != nil {
		return nil, nil, false, err
	}

	hasNext := len(records) > params.Limit
	if hasNext {
		records = records[:params.Limit]
	}

	nextCursor, err := buildNextPendingJoinRequestsCursor(records, hasNext)
	if err != nil {
		return nil, nil, false, err
	}

	return records, nextCursor, hasNext, nil
}

func (s *Service) loadEventInvitationsPage(
	ctx context.Context,
	eventID uuid.UUID,
	params EventCollectionPageParams,
) ([]EventDetailInvitationRecord, *string, bool, error) {
	records, err := s.eventRepo.ListEventInvitations(ctx, eventID, params)
	if err != nil {
		return nil, nil, false, err
	}

	hasNext := len(records) > params.Limit
	if hasNext {
		records = records[:params.Limit]
	}

	nextCursor, err := buildNextInvitationsCursor(records, hasNext)
	if err != nil {
		return nil, nil, false, err
	}

	return records, nextCursor, hasNext, nil
}

func buildNextApprovedParticipantsCursor(records []EventDetailApprovedParticipantRecord, hasNext bool) (*string, error) {
	if !hasNext || len(records) == 0 {
		return nil, nil
	}

	return encodeNextEventCollectionCursor(records[len(records)-1].CreatedAt, records[len(records)-1].ParticipationID)
}

func buildNextPendingJoinRequestsCursor(records []EventDetailPendingJoinRequestRecord, hasNext bool) (*string, error) {
	if !hasNext || len(records) == 0 {
		return nil, nil
	}

	return encodeNextEventCollectionCursor(records[len(records)-1].CreatedAt, records[len(records)-1].JoinRequestID)
}

func buildNextInvitationsCursor(records []EventDetailInvitationRecord, hasNext bool) (*string, error) {
	if !hasNext || len(records) == 0 {
		return nil, nil
	}

	return encodeNextEventCollectionCursor(records[len(records)-1].CreatedAt, records[len(records)-1].InvitationID)
}

func encodeNextEventCollectionCursor(createdAt time.Time, entityID uuid.UUID) (*string, error) {
	encoded, err := encodeEventCollectionCursor(EventCollectionCursor{
		CreatedAt: createdAt,
		EntityID:  entityID,
	})
	if err != nil {
		return nil, err
	}

	return &encoded, nil
}

// ensureRequesterEligible loads the requester's profile fields and runs the
// shared domain eligibility check. It returns nil when the user is eligible
// to join or request to join the given event.
func (s *Service) ensureRequesterEligible(ctx context.Context, userID uuid.UUID, ev *domain.Event) error {
	if ev.MinimumAge == nil && ev.PreferredGender == nil {
		return nil
	}
	user, err := s.eventRepo.GetRequesterForJoin(ctx, userID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return domain.BadRequestError(domain.ErrorCodeProfileIncomplete, "Your account was not found.")
		}
		return err
	}
	if appErr := domain.CheckParticipationEligibility(user, ev, s.now().UTC()); appErr != nil {
		return appErr
	}
	return nil
}
