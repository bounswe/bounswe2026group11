package event

import (
	"context"
	"errors"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/join_request"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/participation"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service implements the event use cases.
type Service struct {
	eventRepo            Repository
	participationService participation.UseCase
	joinRequestService   join_request.UseCase
	now                  func() time.Time
}

var _ UseCase = (*Service)(nil)

// NewService constructs an event Service with its own repository and the
// cross-aggregate services it orchestrates.
func NewService(
	eventRepo Repository,
	participationService participation.UseCase,
	joinRequestService join_request.UseCase,
) *Service {
	return &Service{
		eventRepo:            eventRepo,
		participationService: participationService,
		joinRequestService:   joinRequestService,
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

	created, err := s.eventRepo.CreateEvent(ctx, params)
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
		Status:        domain.ParticipationStatusPending,
		CreatedAt:     jr.CreatedAt,
	}, nil
}
