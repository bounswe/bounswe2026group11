package event

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/join_request"
	notificationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/notification"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/participation"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service implements the event use cases.
type Service struct {
	eventRepo            Repository
	participationService participation.UseCase
	joinRequestService   join_request.UseCase
	joinRequestImages    JoinRequestImageConfirmer
	ticketService        ticket.LifecycleUseCase
	badgeEvaluator       BadgeEvaluator
	notifications        notificationapp.UseCase
	unitOfWork           uow.UnitOfWork
	now                  func() time.Time
}

// BadgeEvaluator is the local port for triggering hosting badge evaluation
// after event-completion lifecycle changes. It stays intentionally narrow so
// the event service does not depend on the full badge use case.
type BadgeEvaluator interface {
	EvaluateHostBadges(ctx context.Context, hostID uuid.UUID) error
}

// SetNotificationService wires in the notification use case so the event
// service can fan out notifications for cancellations and other lifecycle events.
func (s *Service) SetNotificationService(notifications notificationapp.UseCase) {
	s.notifications = notifications
}

// SetBadgeEvaluator wires in the badge use case so the event service can
// re-evaluate host badges after events complete.
func (s *Service) SetBadgeEvaluator(evaluator BadgeEvaluator) {
	s.badgeEvaluator = evaluator
}

// SetJoinRequestImageConfirmer wires in the image upload service for optional
// join-request image confirmation.
func (s *Service) SetJoinRequestImageConfirmer(confirmer JoinRequestImageConfirmer) {
	s.joinRequestImages = confirmer
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
	ticketLifecycle ...ticket.LifecycleUseCase,
) *Service {
	service := &Service{
		eventRepo:            eventRepo,
		participationService: participationService,
		joinRequestService:   joinRequestService,
		unitOfWork:           unitOfWork,
		now:                  time.Now,
	}
	if len(ticketLifecycle) > 0 {
		service.ticketService = ticketLifecycle[0]
	}
	return service
}

// CreateEvent validates the input, then persists the event with its location,
// tags, and constraints in a single transaction.
func (s *Service) CreateEvent(ctx context.Context, hostID uuid.UUID, input CreateEventInput) (*CreateEventResult, error) {
	errs := validateCreateEventInput(input, s.now().UTC())
	if len(errs) > 0 {
		return nil, domain.ValidationError(errs)
	}

	params := toCreateEventParams(hostID, input)

	var created *domain.Event
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		created, err = s.eventRepo.CreateEvent(ctx, params)
		if err != nil {
			slog.ErrorContext(ctx, "event create failed before version snapshot",
				"operation", "event.create.version_snapshot",
				"host_user_id", hostID.String(),
				"error", err,
			)
			return err
		}
		if err := s.eventRepo.CreateEventHistorySnapshot(ctx, created.ID, created.VersionNo, nil, hostID); err != nil {
			slog.ErrorContext(ctx, "event initial version snapshot failed",
				"operation", "event.create.version_snapshot",
				"event_id", created.ID.String(),
				"host_user_id", hostID.String(),
				"event_version", created.VersionNo,
				"error", err,
			)
			return err
		}
		slog.InfoContext(ctx, "event initial version snapshot created",
			"operation", "event.create.version_snapshot",
			"event_id", created.ID.String(),
			"host_user_id", hostID.String(),
			"event_version", created.VersionNo,
		)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return toCreateEventResult(created), nil
}

// UpdateEvent edits an ACTIVE event before it starts. Material changes move
// approved participants into PENDING so they can reconfirm against the new
// event details.
func (s *Service) UpdateEvent(ctx context.Context, hostID, eventID uuid.UUID, input UpdateEventInput) (*UpdateEventResult, error) {
	var (
		updated              *domain.Event
		versionNo            int
		versionChangedFields []string
		triggeredFields      []string
		markedPendingUserIDs []uuid.UUID
	)

	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		snapshot, err := s.eventRepo.GetEventEditSnapshot(ctx, eventID)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
			}
			return err
		}
		if snapshot.Event.HostID != hostID {
			return domain.ForbiddenError(domain.ErrorCodeEventHostManagementNotAllowed, "Only the event host can edit this event.")
		}
		if snapshot.Event.Status != domain.EventStatusActive || !s.now().UTC().Before(snapshot.Event.StartTime) {
			return domain.ConflictError(domain.ErrorCodeEventNotEditable, "Only ACTIVE events that have not started can be edited.")
		}

		params, changedFields, triggers, validationErrs := buildUpdateEventParams(snapshot, input, s.now().UTC())
		if len(validationErrs) > 0 {
			return domain.ValidationError(validationErrs)
		}
		if params.Capacity != nil && !intPtrEqual(params.Capacity, snapshot.Event.Capacity) &&
			*params.Capacity < snapshot.Event.ApprovedParticipantCount+snapshot.Event.PendingParticipantCount {
			return domain.ConflictError(domain.ErrorCodeCapacityBelowParticipantCount, "Capacity cannot be lower than the approved plus pending participant count.")
		}
		triggeredFields = triggers
		versionNo = snapshot.VersionNo
		updated = &snapshot.Event
		if len(changedFields) == 0 {
			return nil
		}
		versionChangedFields = changedFields

		updated, err = s.eventRepo.UpdateEvent(ctx, params)
		if err != nil {
			if errors.Is(err, ErrEventNotEditable) {
				return domain.ConflictError(domain.ErrorCodeEventNotEditable, "Only ACTIVE events that have not started can be edited.")
			}
			return err
		}
		versionNo = snapshot.VersionNo + 1
		if err := s.eventRepo.CreateEventHistorySnapshot(ctx, eventID, versionNo, versionChangedFields, hostID); err != nil {
			slog.ErrorContext(ctx, "event version snapshot failed",
				"operation", "event.update.version_snapshot",
				"event_id", eventID.String(),
				"host_user_id", hostID.String(),
				"from_event_version", snapshot.VersionNo,
				"to_event_version", versionNo,
				"changed_field_count", len(versionChangedFields),
				"reconfirmation_required", len(triggeredFields) > 0,
				"error", err,
			)
			return err
		}
		slog.InfoContext(ctx, "event version snapshot created",
			"operation", "event.update.version_snapshot",
			"event_id", eventID.String(),
			"host_user_id", hostID.String(),
			"from_event_version", snapshot.VersionNo,
			"to_event_version", versionNo,
			"changed_field_count", len(versionChangedFields),
			"reconfirmation_required", len(triggeredFields) > 0,
		)

		if len(triggeredFields) == 0 {
			return nil
		}
		markedPendingUserIDs, err = s.participationService.MarkApprovedParticipationsPending(ctx, eventID, hostID)
		if err != nil {
			return err
		}
		if len(markedPendingUserIDs) > 0 && s.ticketService != nil {
			if err := s.ticketService.MarkTicketsPendingForEvent(ctx, eventID); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	s.notifyEventReconfirmationRequired(ctx, updated, versionNo, triggeredFields, markedPendingUserIDs)
	return toUpdateEventResult(updated, versionNo, triggeredFields, len(markedPendingUserIDs)), nil
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

	result := toEventDetailResult(record, s.now().UTC())
	if record.ViewerContext.ParticipationStatus != nil &&
		*record.ViewerContext.ParticipationStatus == domain.ParticipationStatusPending &&
		record.ViewerContext.LastConfirmedEventVersion != nil &&
		*record.ViewerContext.LastConfirmedEventVersion < record.ViewerContext.LatestEventVersion {
		from, err := s.eventRepo.GetEventHistorySnapshot(ctx, eventID, *record.ViewerContext.LastConfirmedEventVersion)
		if err != nil {
			slog.ErrorContext(ctx, "event reconfirmation diff base snapshot failed",
				"operation", "event.detail.reconfirmation_diff",
				"event_id", eventID.String(),
				"user_id", userID.String(),
				"from_event_version", *record.ViewerContext.LastConfirmedEventVersion,
				"to_event_version", record.ViewerContext.LatestEventVersion,
				"error", err,
			)
			return nil, err
		}
		to, err := s.eventRepo.GetLatestEventHistorySnapshot(ctx, eventID)
		if err != nil {
			slog.ErrorContext(ctx, "event reconfirmation diff latest snapshot failed",
				"operation", "event.detail.reconfirmation_diff",
				"event_id", eventID.String(),
				"user_id", userID.String(),
				"from_event_version", *record.ViewerContext.LastConfirmedEventVersion,
				"to_event_version", record.ViewerContext.LatestEventVersion,
				"error", err,
			)
			return nil, err
		}
		result.ViewerContext.NeedsReconfirmation = true
		result.ViewerContext.EventDiff = buildEventDetailDiff(from, to)
		changeCount := 0
		if result.ViewerContext.EventDiff != nil {
			changeCount = len(result.ViewerContext.EventDiff.Changes)
		}
		slog.InfoContext(ctx, "event reconfirmation diff generated",
			"operation", "event.detail.reconfirmation_diff",
			"event_id", eventID.String(),
			"user_id", userID.String(),
			"from_event_version", from.VersionNo,
			"to_event_version", to.VersionNo,
			"diff_change_count", changeCount,
		)
	}

	return result, nil
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
	if params.Status == "" {
		params.Status = domain.ParticipationStatusApproved
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
	acceptedVersion := 0
	if p.LastConfirmedEventVersion != nil {
		acceptedVersion = *p.LastConfirmedEventVersion
	}
	slog.InfoContext(ctx, "event participation created",
		"operation", "event.participation.create",
		"event_id", eventID.String(),
		"user_id", userID.String(),
		"participation_id", p.ID.String(),
		"participation_status", p.Status.String(),
		"accepted_event_version", acceptedVersion,
	)

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

	var p *domain.Participation
	err = s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		p, err = s.participationService.LeaveParticipation(ctx, eventID, userID)
		if err != nil {
			return err
		}
		if s.ticketService != nil {
			return s.ticketService.CancelTicketForParticipation(ctx, p.ID)
		}
		return nil
	})
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

// ReconfirmParticipation moves the caller from PENDING back to APPROVED for
// the latest event version.
func (s *Service) ReconfirmParticipation(ctx context.Context, userID, eventID uuid.UUID) (*ReconfirmParticipationResult, error) {
	var (
		participation *domain.Participation
		ticketStatus  *domain.TicketStatus
		reconfirmedAt time.Time
		latestVersion int
	)

	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		snapshot, err := s.eventRepo.GetEventEditSnapshot(ctx, eventID)
		if err != nil {
			if errors.Is(err, domain.ErrNotFound) {
				return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
			}
			return err
		}
		if snapshot.Event.HostID == userID {
			return domain.ForbiddenError(domain.ErrorCodeHostCannotJoin, "The event host cannot reconfirm as a participant.")
		}
		if snapshot.Event.Status == domain.EventStatusCanceled || snapshot.Event.Status == domain.EventStatusCompleted {
			return domain.ConflictError(domain.ErrorCodeEventNotJoinable, "This event is no longer accepting participant reconfirmations.")
		}
		latestVersion = snapshot.VersionNo

		participation, err = s.participationService.ReconfirmParticipation(ctx, eventID, userID, snapshot.VersionNo)
		if err != nil {
			slog.ErrorContext(ctx, "event participation reconfirm failed",
				"operation", "event.participation.reconfirm",
				"event_id", eventID.String(),
				"user_id", userID.String(),
				"event_version", snapshot.VersionNo,
				"error", err,
			)
			return err
		}
		reconfirmedAt = participation.UpdatedAt
		if participation.ReconfirmedAt != nil {
			reconfirmedAt = *participation.ReconfirmedAt
		}

		if s.ticketService != nil && (snapshot.Event.PrivacyLevel == domain.PrivacyProtected || snapshot.Event.PrivacyLevel == domain.PrivacyPrivate) {
			t, err := s.ticketService.CreateTicketForParticipation(ctx, participation, domain.TicketStatusActive)
			if err != nil {
				return err
			}
			ticketStatus = &t.Status
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	slog.InfoContext(ctx, "event participation reconfirmed",
		"operation", "event.participation.reconfirm",
		"event_id", eventID.String(),
		"user_id", userID.String(),
		"participation_id", participation.ID.String(),
		"event_version", latestVersion,
		"ticket_created", ticketStatus != nil,
	)

	return &ReconfirmParticipationResult{
		ParticipationID:           participation.ID.String(),
		EventID:                   participation.EventID.String(),
		Status:                    participation.Status,
		ReconfirmedAt:             reconfirmedAt,
		UpdatedAt:                 participation.UpdatedAt,
		LastConfirmedEventVersion: latestVersion,
		LatestEventVersion:        latestVersion,
		TicketStatus:              ticketStatus,
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

	imageURL, err := s.confirmJoinRequestImage(ctx, userID, eventID, input.ImageConfirmToken)
	if err != nil {
		return nil, err
	}

	jr, err := s.joinRequestService.CreatePendingJoinRequest(ctx, eventID, userID, event.HostID, join_request.CreatePendingJoinRequestInput{
		Message:  input.Message,
		ImageURL: imageURL,
	})
	if err != nil {
		return nil, err
	}

	slog.InfoContext(ctx, "event join request created",
		"operation", "event.join_request.create",
		"event_id", eventID.String(),
		"user_id", userID.String(),
		"host_user_id", event.HostID.String(),
		"join_request_id", jr.ID.String(),
		"join_request_status", string(domain.JoinRequestStatusPending),
	)

	return &RequestJoinResult{
		JoinRequestID: jr.ID.String(),
		EventID:       jr.EventID.String(),
		Status:        string(domain.JoinRequestStatusPending),
		ImageURL:      jr.ImageURL,
		CreatedAt:     jr.CreatedAt,
	}, nil
}

func (s *Service) confirmJoinRequestImage(ctx context.Context, userID, eventID uuid.UUID, confirmToken *string) (*string, error) {
	if confirmToken == nil || strings.TrimSpace(*confirmToken) == "" {
		return nil, nil
	}
	if s.joinRequestImages == nil {
		return nil, domain.ForbiddenError(domain.ErrorCodeImageUploadNotAllowed, "Join request image uploads are not available.")
	}
	confirmed, err := s.joinRequestImages.ConfirmEventJoinRequestImageUpload(ctx, userID, eventID, imageupload.ConfirmUploadInput{
		ConfirmToken: *confirmToken,
	})
	if err != nil {
		return nil, err
	}
	return &confirmed.BaseURL, nil
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
	acceptedVersion := 0
	if result.Participation.LastConfirmedEventVersion != nil {
		acceptedVersion = *result.Participation.LastConfirmedEventVersion
	}
	slog.InfoContext(ctx, "event join request approved",
		"operation", "event.join_request.approve",
		"event_id", eventID.String(),
		"host_user_id", hostUserID.String(),
		"join_request_id", joinRequestID.String(),
		"participation_id", result.Participation.ID.String(),
		"participant_user_id", result.Participation.UserID.String(),
		"participation_status", result.Participation.Status.String(),
		"accepted_event_version", acceptedVersion,
	)

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

// CancelJoinRequest allows the authenticated user to cancel their own PENDING join request.
func (s *Service) CancelJoinRequest(ctx context.Context, userID, eventID uuid.UUID) error {
	_, err := s.joinRequestService.CancelJoinRequest(ctx, eventID, userID)
	return err
}

// CancelEvent transitions an ACTIVE event to CANCELED. Only the event host may cancel.
func (s *Service) CancelEvent(ctx context.Context, userID, eventID uuid.UUID) error {
	var (
		cancelledUserIDs []uuid.UUID
		event            *domain.Event
	)

	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var err error
		event, err = s.eventRepo.GetEventByID(ctx, eventID)
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

		cancelledUserIDs, err = s.participationService.CancelEventParticipations(ctx, eventID)
		if err != nil {
			return err
		}

		if s.ticketService != nil {
			if err := s.ticketService.CancelTicketsForEvent(ctx, eventID); err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return err
	}

	s.notifyEventCanceled(ctx, event, userID, cancelledUserIDs)
	return nil
}

func (s *Service) notifyEventCanceled(ctx context.Context, event *domain.Event, hostUserID uuid.UUID, cancelledUserIDs []uuid.UUID) {
	if s.notifications == nil || len(cancelledUserIDs) == 0 {
		return
	}

	// Exclude the host — they initiated the cancellation.
	recipients := make([]uuid.UUID, 0, len(cancelledUserIDs))
	for _, id := range cancelledUserIDs {
		if id != hostUserID {
			recipients = append(recipients, id)
		}
	}
	if len(recipients) == 0 {
		return
	}

	notificationType := "EVENT_CANCELED"
	deepLink := fmt.Sprintf("/events/%s", event.ID.String())
	body := fmt.Sprintf("The event \"%s\" has been cancelled by the host.", event.Title)
	data := map[string]string{
		"event_id":         event.ID.String(),
		"event_title":      event.Title,
		"event_start_time": event.StartTime.UTC().Format(time.RFC3339),
	}

	_, err := s.notifications.SendNotificationToUsers(ctx, notificationapp.SendNotificationInput{
		UserIDs:        recipients,
		Title:          "Event cancelled",
		TitleKey:       "notification.event.cancelled.title",
		Body:           body,
		BodyKey:        "notification.event.cancelled.body",
		BodyArgs:       []any{event.Title},
		Type:           &notificationType,
		DeepLink:       &deepLink,
		EventID:        &event.ID,
		ImageURL:       event.ImageURL,
		Data:           data,
		IdempotencyKey: fmt.Sprintf("EVENT_CANCELED:%s", event.ID.String()),
	})
	if err != nil {
		slog.ErrorContext(ctx, "event cancellation notification failed",
			"operation", "event.cancel.notification",
			"event_id", event.ID.String(),
			"recipient_count", len(recipients),
			"error", err,
		)
	}
}

func (s *Service) notifyEventReconfirmationRequired(ctx context.Context, event *domain.Event, versionNo int, changedFields []string, userIDs []uuid.UUID) {
	if s.notifications == nil || event == nil || len(changedFields) == 0 || len(userIDs) == 0 {
		return
	}

	notificationType := "EVENT_RECONFIRMATION_REQUIRED"
	deepLink := fmt.Sprintf("/events/%s", event.ID.String())
	body := fmt.Sprintf("The event \"%s\" has changed. Please reconfirm your attendance.", event.Title)
	data := map[string]string{
		"event_id":         event.ID.String(),
		"event_title":      event.Title,
		"event_start_time": event.StartTime.UTC().Format(time.RFC3339),
		"event_version":    fmt.Sprintf("%d", versionNo),
		"changed_fields":   strings.Join(changedFields, ","),
	}

	_, err := s.notifications.SendNotificationToUsers(ctx, notificationapp.SendNotificationInput{
		UserIDs:        userIDs,
		Title:          "Event details changed",
		Body:           body,
		Type:           &notificationType,
		DeepLink:       &deepLink,
		EventID:        &event.ID,
		ImageURL:       event.ImageURL,
		Data:           data,
		IdempotencyKey: fmt.Sprintf("EVENT_RECONFIRMATION_REQUIRED:%s:v%d", event.ID.String(), versionNo),
	})
	if err != nil {
		slog.ErrorContext(ctx, "event reconfirmation notification failed",
			"operation", "event.update.reconfirmation_notification",
			"event_id", event.ID.String(),
			"recipient_count", len(userIDs),
			"error", err,
		)
	}
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

	if err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		if err := s.eventRepo.CompleteEvent(ctx, eventID); err != nil {
			if errors.Is(err, ErrEventNotCompletable) {
				return domain.ConflictError(domain.ErrorCodeEventNotCompletable, "The event cannot be completed because it is already CANCELED or COMPLETED.")
			}
			return err
		}

		if s.ticketService != nil {
			if err := s.ticketService.ExpireTicketsForEvent(ctx, eventID); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return err
	}

	s.evaluateParticipationBadgesForEvent(ctx, eventID)
	s.evaluateHostBadges(ctx, event.HostID)
	return nil
}

// TransitionExpiredEvents runs the periodic event-status transition (used by
// the event expiry job) and evaluates participation badges for every approved
// participant of every event that just transitioned to COMPLETED.
func (s *Service) TransitionExpiredEvents(ctx context.Context) error {
	return s.TransitionEventStatuses(ctx)
}

// evaluateParticipationBadgesForEvent runs participant-side badge evaluation
// for every approved participant of the given event as a best-effort hook so
// transient failures never fail the parent operation.
func (s *Service) evaluateParticipationBadgesForEvent(ctx context.Context, eventID uuid.UUID) {
	if s.participationService == nil {
		return
	}
	if err := s.participationService.EvaluateBadgesForEventParticipants(ctx, eventID); err != nil {
		slog.WarnContext(ctx, "event participation badge evaluation failed",
			slog.String("operation", "event.evaluate_participation_badges"),
			slog.String("event_id", eventID.String()),
			slog.String("error", err.Error()),
		)
	}
}

// evaluateHostBadges runs host-side badge evaluation after completed-event
// lifecycle changes as a best-effort hook so transient failures never fail the
// parent operation.
func (s *Service) evaluateHostBadges(ctx context.Context, hostID uuid.UUID) {
	if s.badgeEvaluator == nil {
		return
	}
	if err := s.badgeEvaluator.EvaluateHostBadges(ctx, hostID); err != nil {
		slog.WarnContext(ctx, "event host badge evaluation failed",
			slog.String("operation", "event.evaluate_host_badges"),
			slog.String("host_id", hostID.String()),
			slog.String("error", err.Error()),
		)
	}
}

// TransitionEventStatuses advances lifecycle states and applies dependent
// participation/ticket transitions in one transaction.
func (s *Service) TransitionEventStatuses(ctx context.Context) error {
	var records []EventStatusTransitionRecord
	if err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		var txErr error
		records, txErr = s.eventRepo.TransitionEventStatuses(ctx)
		if txErr != nil {
			return txErr
		}
		for _, record := range records {
			switch record.Status {
			case domain.EventStatusInProgress:
				if err := s.participationService.ApprovePendingParticipationsForEvent(ctx, record.EventID); err != nil {
					return err
				}
				if s.ticketService != nil {
					if err := s.ticketService.ActivatePendingTicketsForEvent(ctx, record.EventID); err != nil {
						return err
					}
				}
			case domain.EventStatusCompleted:
				if s.ticketService != nil {
					if err := s.ticketService.ExpireTicketsForEvent(ctx, record.EventID); err != nil {
						return err
					}
				}
			}
		}
		return nil
	}); err != nil {
		return err
	}

	for _, record := range records {
		if record.Status == domain.EventStatusCompleted {
			s.evaluateParticipationBadgesForEvent(ctx, record.EventID)
			s.evaluateHostBadges(ctx, record.HostID)
		}
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
	if input.Status != nil {
		params.Status = *input.Status
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
