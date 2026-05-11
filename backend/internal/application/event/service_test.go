package event

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/join_request"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type fakeTxContextKey struct{}

type fakeUnitOfWork struct {
	callCount     int
	commitCount   int
	rollbackCount int
}

func (u *fakeUnitOfWork) RunInTx(ctx context.Context, fn func(ctx context.Context) error) error {
	u.callCount++
	txCtx := context.WithValue(ctx, fakeTxContextKey{}, true)
	if err := fn(txCtx); err != nil {
		u.rollbackCount++
		return err
	}

	u.commitCount++
	return nil
}

// fakeEventRepo is an in-memory implementation of Repository.
type fakeEventRepo struct {
	err                    error
	discoverErr            error
	detailErr              error
	events                 map[uuid.UUID]*domain.Event
	favoriteRecords        []FavoriteEventRecord
	discoverRecords        []DiscoverableEventRecord
	detailRecord           *EventDetailRecord
	hostSummaryRecord      *EventHostContextSummaryRecord
	participantRecords     []EventDetailApprovedParticipantRecord
	joinRequestRecords     []EventDetailPendingJoinRequestRecord
	invitationRecords      []EventDetailInvitationRecord
	discoverCallCount      int
	lastDiscoverUserID     uuid.UUID
	lastDiscoverParams     DiscoverEventsParams
	lastDetailUserID       uuid.UUID
	lastDetailEventID      uuid.UUID
	lastCollectionPage     EventCollectionPageParams
	lastCancelCtx          context.Context
	lastCancelCount        int
	requesters             map[uuid.UUID]*domain.User
	getRequesterForJoinErr error
	editSnapshot           *EventEditSnapshot
	updateParams           UpdateEventParams
	transitionRecords      []EventStatusTransitionRecord
	historySnapshots       map[int]*EventHistorySnapshotRecord
	historyCreateCount     int
}

func (r *fakeEventRepo) CreateEvent(_ context.Context, params CreateEventParams) (*domain.Event, error) {
	if r.err != nil {
		return nil, r.err
	}
	now := time.Now().UTC()
	return &domain.Event{
		ID:           uuid.New(),
		HostID:       params.HostID,
		VersionNo:    1,
		Title:        params.Title,
		PrivacyLevel: params.PrivacyLevel,
		Status:       domain.EventStatusActive,
		StartTime:    params.StartTime,
		EndTime:      params.EndTime,
		LocationType: new(params.LocationType),
		CreatedAt:    now,
		UpdatedAt:    now,
	}, nil
}

func (r *fakeEventRepo) GetEventEditSnapshot(_ context.Context, eventID uuid.UUID) (*EventEditSnapshot, error) {
	if r.editSnapshot != nil {
		return r.editSnapshot, nil
	}
	if e, ok := r.events[eventID]; ok {
		locType := domain.LocationPoint
		if e.LocationType != nil {
			locType = *e.LocationType
		}
		return &EventEditSnapshot{
			Event:     *e,
			VersionNo: 1,
			Location: EventDetailLocationRecord{
				Type:  locType,
				Point: &domain.GeoPoint{Lat: 41, Lon: 29},
			},
			Constraints: []EventDetailConstraintRecord{},
		}, nil
	}
	return nil, domain.ErrNotFound
}

func (r *fakeEventRepo) UpdateEvent(_ context.Context, params UpdateEventParams) (*domain.Event, error) {
	r.updateParams = params
	if r.err != nil {
		return nil, r.err
	}
	e, ok := r.events[params.EventID]
	if !ok {
		return nil, domain.ErrNotFound
	}
	e.Title = params.Title
	e.Description = params.Description
	e.CategoryID = params.CategoryID
	e.StartTime = params.StartTime
	e.EndTime = params.EndTime
	e.Capacity = params.Capacity
	e.LocationType = &params.LocationType
	e.VersionNo++
	e.UpdatedAt = time.Now().UTC()
	return e, nil
}

func (r *fakeEventRepo) CreateEventHistorySnapshot(_ context.Context, eventID uuid.UUID, versionNo int, changedFields []string, _ uuid.UUID) error {
	r.historyCreateCount++
	if r.historySnapshots == nil {
		r.historySnapshots = map[int]*EventHistorySnapshotRecord{}
	}
	r.historySnapshots[versionNo] = &EventHistorySnapshotRecord{
		EventID:       eventID,
		VersionNo:     versionNo,
		ChangedFields: append([]string{}, changedFields...),
	}
	return r.err
}

func (r *fakeEventRepo) GetEventHistorySnapshot(_ context.Context, eventID uuid.UUID, versionNo int) (*EventHistorySnapshotRecord, error) {
	if snapshot, ok := r.historySnapshots[versionNo]; ok {
		return snapshot, nil
	}
	return &EventHistorySnapshotRecord{EventID: eventID, VersionNo: versionNo}, nil
}

func (r *fakeEventRepo) GetLatestEventHistorySnapshot(_ context.Context, eventID uuid.UUID) (*EventHistorySnapshotRecord, error) {
	var latest *EventHistorySnapshotRecord
	for _, snapshot := range r.historySnapshots {
		if latest == nil || snapshot.VersionNo > latest.VersionNo {
			latest = snapshot
		}
	}
	if latest != nil {
		return latest, nil
	}
	return &EventHistorySnapshotRecord{EventID: eventID, VersionNo: 1}, nil
}

func (r *fakeEventRepo) GetEventByID(_ context.Context, id uuid.UUID) (*domain.Event, error) {
	if e, ok := r.events[id]; ok {
		return e, nil
	}
	return nil, domain.ErrNotFound
}

func (r *fakeEventRepo) GetEventDetail(_ context.Context, userID, eventID uuid.UUID) (*EventDetailRecord, error) {
	r.lastDetailUserID = userID
	r.lastDetailEventID = eventID

	if r.detailErr != nil {
		return nil, r.detailErr
	}
	if r.detailRecord != nil {
		return r.detailRecord, nil
	}
	return nil, domain.ErrNotFound
}

func (r *fakeEventRepo) GetEventHostContextSummary(_ context.Context, _ uuid.UUID) (*EventHostContextSummaryRecord, error) {
	if r.err != nil {
		return nil, r.err
	}
	if r.hostSummaryRecord != nil {
		return r.hostSummaryRecord, nil
	}
	return &EventHostContextSummaryRecord{}, nil
}

func (r *fakeEventRepo) ListEventApprovedParticipants(
	_ context.Context,
	_ uuid.UUID,
	params EventCollectionPageParams,
) ([]EventDetailApprovedParticipantRecord, error) {
	r.lastCollectionPage = params
	if r.err != nil {
		return nil, r.err
	}
	return r.participantRecords, nil
}

func (r *fakeEventRepo) ListEventPendingJoinRequests(
	_ context.Context,
	_ uuid.UUID,
	params EventCollectionPageParams,
) ([]EventDetailPendingJoinRequestRecord, error) {
	r.lastCollectionPage = params
	if r.err != nil {
		return nil, r.err
	}
	return r.joinRequestRecords, nil
}

func (r *fakeEventRepo) ListEventInvitations(
	_ context.Context,
	_ uuid.UUID,
	params EventCollectionPageParams,
) ([]EventDetailInvitationRecord, error) {
	r.lastCollectionPage = params
	if r.err != nil {
		return nil, r.err
	}
	return r.invitationRecords, nil
}

func (r *fakeEventRepo) TransitionEventStatuses(_ context.Context) ([]EventStatusTransitionRecord, error) {
	return r.transitionRecords, r.err
}

func (r *fakeEventRepo) CancelEvent(ctx context.Context, eventID uuid.UUID, canceledApprovedParticipantCount int) error {
	r.lastCancelCtx = ctx
	r.lastCancelCount = canceledApprovedParticipantCount
	if r.err != nil {
		return r.err
	}
	e, ok := r.events[eventID]
	if !ok || e.Status != domain.EventStatusActive {
		return ErrEventNotCancelable
	}
	e.Status = domain.EventStatusCanceled
	return nil
}

func (r *fakeEventRepo) CompleteEvent(_ context.Context, eventID uuid.UUID) error {
	if r.err != nil {
		return r.err
	}
	e, ok := r.events[eventID]
	if !ok || (e.Status != domain.EventStatusActive && e.Status != domain.EventStatusInProgress) {
		return ErrEventNotCompletable
	}
	e.Status = domain.EventStatusCompleted
	return nil
}

func (r *fakeEventRepo) AddFavorite(_ context.Context, _, _ uuid.UUID) error {
	return r.err
}

func (r *fakeEventRepo) RemoveFavorite(_ context.Context, _, _ uuid.UUID) error {
	return r.err
}

func (r *fakeEventRepo) ListFavoriteEvents(_ context.Context, _ uuid.UUID) ([]FavoriteEventRecord, error) {
	if r.err != nil {
		return nil, r.err
	}
	return r.favoriteRecords, nil
}

func (r *fakeEventRepo) ListDiscoverableEvents(_ context.Context, userID uuid.UUID, params DiscoverEventsParams) ([]DiscoverableEventRecord, error) {
	r.discoverCallCount++
	r.lastDiscoverUserID = userID
	r.lastDiscoverParams = params

	if r.discoverErr != nil {
		return nil, r.discoverErr
	}

	return r.discoverRecords, nil
}

func (r *fakeEventRepo) GetRequesterForJoin(_ context.Context, userID uuid.UUID) (*domain.User, error) {
	if r.getRequesterForJoinErr != nil {
		return nil, r.getRequesterForJoinErr
	}
	if user, ok := r.requesters[userID]; ok {
		return user, nil
	}
	return nil, domain.ErrNotFound
}

// fakeParticipationService is an in-memory implementation of ParticipationService.
type fakeParticipationService struct {
	err                          error
	callCount                    int
	leaveCallCount               int
	cancelCallCount              int
	evaluateBadgesCallCount      int
	lastEventID                  uuid.UUID
	lastUserID                   uuid.UUID
	lastLeaveEventID             uuid.UUID
	lastLeaveUserID              uuid.UUID
	lastCancelEventID            uuid.UUID
	lastCancelCtx                context.Context
	lastEvaluateBadgesEventID    uuid.UUID
	evaluateBadgesEventIDHistory []uuid.UUID
	pendingUserIDs               []uuid.UUID
}

type fakeEventBadgeEvaluator struct {
	err               error
	callCount         int
	lastHostID        uuid.UUID
	hostIDCallHistory []uuid.UUID
}

func (e *fakeEventBadgeEvaluator) EvaluateHostBadges(_ context.Context, hostID uuid.UUID) error {
	e.callCount++
	e.lastHostID = hostID
	e.hostIDCallHistory = append(e.hostIDCallHistory, hostID)
	return e.err
}

func (s *fakeParticipationService) CreateApprovedParticipation(_ context.Context, eventID, userID uuid.UUID) (*domain.Participation, error) {
	s.callCount++
	s.lastEventID = eventID
	s.lastUserID = userID

	if s.err != nil {
		return nil, s.err
	}
	now := time.Now().UTC()
	return &domain.Participation{
		ID:        uuid.New(),
		EventID:   eventID,
		UserID:    userID,
		Status:    domain.ParticipationStatusApproved,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func (s *fakeParticipationService) LeaveParticipation(_ context.Context, eventID, userID uuid.UUID) (*domain.Participation, error) {
	s.leaveCallCount++
	s.lastLeaveEventID = eventID
	s.lastLeaveUserID = userID

	if s.err != nil {
		return nil, s.err
	}
	now := time.Now().UTC()
	return &domain.Participation{
		ID:        uuid.New(),
		EventID:   eventID,
		UserID:    userID,
		Status:    domain.ParticipationStatusLeaved,
		CreatedAt: now.Add(-time.Hour),
		UpdatedAt: now,
	}, nil
}

func (s *fakeParticipationService) CancelEventParticipations(ctx context.Context, eventID uuid.UUID) ([]uuid.UUID, error) {
	s.cancelCallCount++
	s.lastCancelEventID = eventID
	s.lastCancelCtx = ctx
	return nil, s.err
}

func (s *fakeParticipationService) EvaluateBadgesForEventParticipants(_ context.Context, eventID uuid.UUID) error {
	s.evaluateBadgesCallCount++
	s.lastEvaluateBadgesEventID = eventID
	s.evaluateBadgesEventIDHistory = append(s.evaluateBadgesEventIDHistory, eventID)
	return s.err
}

func (s *fakeParticipationService) MarkApprovedParticipationsPending(_ context.Context, eventID, _ uuid.UUID) ([]uuid.UUID, error) {
	s.lastEventID = eventID
	return s.pendingUserIDs, s.err
}

func (s *fakeParticipationService) ReconfirmParticipation(_ context.Context, eventID, userID uuid.UUID, _ int) (*domain.Participation, error) {
	s.lastEventID = eventID
	s.lastUserID = userID
	if s.err != nil {
		return nil, s.err
	}
	now := time.Now().UTC()
	return &domain.Participation{ID: uuid.New(), EventID: eventID, UserID: userID, Status: domain.ParticipationStatusApproved, CreatedAt: now, UpdatedAt: now}, nil
}

func (s *fakeParticipationService) ApprovePendingParticipationsForEvent(_ context.Context, eventID uuid.UUID) error {
	s.lastEventID = eventID
	return s.err
}

// fakeJoinRequestService is an in-memory implementation of JoinRequestService.
type fakeJoinRequestService struct {
	err               error
	callCount         int
	approveCallCount  int
	rejectCallCount   int
	lastEventID       uuid.UUID
	lastUserID        uuid.UUID
	lastHostUserID    uuid.UUID
	lastJoinRequestID uuid.UUID
	lastInput         join_request.CreatePendingJoinRequestInput
}

type fakeJoinRequestImageConfirmer struct {
	baseURL          string
	err              error
	callCount        int
	lastUserID       uuid.UUID
	lastEventID      uuid.UUID
	lastConfirmToken string
}

func (f *fakeJoinRequestImageConfirmer) ConfirmEventJoinRequestImageUpload(_ context.Context, userID, eventID uuid.UUID, input imageupload.ConfirmUploadInput) (*imageupload.ConfirmJoinRequestImageResult, error) {
	f.callCount++
	f.lastUserID = userID
	f.lastEventID = eventID
	f.lastConfirmToken = input.ConfirmToken
	if f.err != nil {
		return nil, f.err
	}
	return &imageupload.ConfirmJoinRequestImageResult{BaseURL: f.baseURL}, nil
}

type fakeTicketLifecycle struct {
	createCallCount              int
	cancelParticipationCallCount int
	cancelEventCallCount         int
	expireEventCallCount         int
	lastCreatedParticipation     *domain.Participation
	lastCreatedStatus            domain.TicketStatus
	lastParticipationID          uuid.UUID
	lastCancelEventID            uuid.UUID
	lastExpireEventID            uuid.UUID
	pendingEventID               uuid.UUID
	activateEventID              uuid.UUID
	err                          error
}

func (s *fakeTicketLifecycle) CreateTicketForParticipation(_ context.Context, participation *domain.Participation, status domain.TicketStatus) (*domain.Ticket, error) {
	s.createCallCount++
	s.lastCreatedParticipation = participation
	s.lastCreatedStatus = status
	if s.err != nil {
		return nil, s.err
	}
	return &domain.Ticket{ID: uuid.New(), ParticipationID: participation.ID, Status: status}, nil
}

func (s *fakeTicketLifecycle) CancelTicketForParticipation(_ context.Context, participationID uuid.UUID) error {
	s.cancelParticipationCallCount++
	s.lastParticipationID = participationID
	return s.err
}

func (s *fakeTicketLifecycle) CancelTicketsForEvent(_ context.Context, eventID uuid.UUID) error {
	s.cancelEventCallCount++
	s.lastCancelEventID = eventID
	return s.err
}

func (s *fakeTicketLifecycle) ExpireTicketsForEvent(_ context.Context, eventID uuid.UUID) error {
	s.expireEventCallCount++
	s.lastExpireEventID = eventID
	return s.err
}

func (s *fakeTicketLifecycle) MarkTicketsPendingForEvent(_ context.Context, eventID uuid.UUID) error {
	s.pendingEventID = eventID
	return s.err
}

func (s *fakeTicketLifecycle) ActivatePendingTicketsForEvent(_ context.Context, eventID uuid.UUID) error {
	s.activateEventID = eventID
	return s.err
}

func (s *fakeJoinRequestService) CreatePendingJoinRequest(
	_ context.Context,
	eventID, userID, hostUserID uuid.UUID,
	input join_request.CreatePendingJoinRequestInput,
) (*domain.JoinRequest, error) {
	s.callCount++
	s.lastEventID = eventID
	s.lastUserID = userID
	s.lastHostUserID = hostUserID
	s.lastInput = input

	if s.err != nil {
		return nil, s.err
	}
	now := time.Now().UTC()
	return &domain.JoinRequest{
		ID:         uuid.New(),
		EventID:    eventID,
		UserID:     userID,
		HostUserID: hostUserID,
		Status:     domain.JoinRequestStatusPending,
		ImageURL:   input.ImageURL,
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}

func (s *fakeJoinRequestService) ApproveJoinRequest(
	_ context.Context,
	eventID, joinRequestID, hostUserID uuid.UUID,
) (*join_request.ApproveJoinRequestResult, error) {
	s.approveCallCount++
	s.lastEventID = eventID
	s.lastJoinRequestID = joinRequestID
	s.lastHostUserID = hostUserID

	if s.err != nil {
		return nil, s.err
	}

	now := time.Now().UTC()
	participationID := uuid.New()
	requesterID := uuid.New()
	return &join_request.ApproveJoinRequestResult{
		JoinRequest: &domain.JoinRequest{
			ID:              joinRequestID,
			EventID:         eventID,
			UserID:          requesterID,
			ParticipationID: &participationID,
			HostUserID:      hostUserID,
			Status:          domain.JoinRequestStatusApproved,
			CreatedAt:       now.Add(-time.Hour),
			UpdatedAt:       now,
		},
		Participation: &domain.Participation{
			ID:        participationID,
			EventID:   eventID,
			UserID:    requesterID,
			Status:    domain.ParticipationStatusApproved,
			CreatedAt: now,
			UpdatedAt: now,
		},
	}, nil
}

func (s *fakeJoinRequestService) RejectJoinRequest(
	_ context.Context,
	eventID, joinRequestID, hostUserID uuid.UUID,
) (*join_request.RejectJoinRequestResult, error) {
	s.rejectCallCount++
	s.lastEventID = eventID
	s.lastJoinRequestID = joinRequestID
	s.lastHostUserID = hostUserID

	if s.err != nil {
		return nil, s.err
	}

	now := time.Now().UTC()
	return &join_request.RejectJoinRequestResult{
		JoinRequest: &domain.JoinRequest{
			ID:         joinRequestID,
			EventID:    eventID,
			UserID:     uuid.New(),
			HostUserID: hostUserID,
			Status:     domain.JoinRequestStatusRejected,
			CreatedAt:  now.Add(-time.Hour),
			UpdatedAt:  now,
		},
		CooldownEndsAt: now.Add(domain.JoinRequestCooldown),
	}, nil
}

func (s *fakeJoinRequestService) CancelJoinRequest(_ context.Context, _, _ uuid.UUID) (*domain.JoinRequest, error) {
	return nil, nil
}

func newTestEventService() (*Service, *fakeEventRepo, *fakeParticipationService, *fakeJoinRequestService) {
	eventRepo := &fakeEventRepo{
		events:     make(map[uuid.UUID]*domain.Event),
		requesters: map[uuid.UUID]*domain.User{},
	}
	participationService := &fakeParticipationService{}
	joinRequestService := &fakeJoinRequestService{}
	return NewService(eventRepo, participationService, joinRequestService, &fakeUnitOfWork{}), eventRepo, participationService, joinRequestService
}

func attachEventBadgeEvaluator(svc *Service) *fakeEventBadgeEvaluator {
	evaluator := &fakeEventBadgeEvaluator{}
	svc.SetBadgeEvaluator(evaluator)
	return evaluator
}

func validInput() CreateEventInput {
	start := time.Now().UTC().Add(time.Hour)
	return CreateEventInput{
		Title:        "Test Event",
		Description:  stringPtr("A test description"),
		CategoryID:   new(3),
		PrivacyLevel: domain.PrivacyPublic,
		LocationType: domain.LocationPoint,
		Lat:          new(41.0082),
		Lon:          new(28.9784),
		StartTime:    start,
	}
}

func assertValidationDetail(t *testing.T, err error, field string) {
	t.Helper()
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T: %v", err, err)
	}
	if appErr.Code != domain.ErrorCodeValidation {
		t.Fatalf("expected error code %q, got %q", domain.ErrorCodeValidation, appErr.Code)
	}
	if appErr.Details[field] == "" {
		t.Fatalf("expected validation detail for field %q, details: %v", field, appErr.Details)
	}
}

func TestCreateEventSuccessReturnsID(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()

	// when
	result, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	if err != nil {
		t.Fatalf("CreateEvent() error = %v", err)
	}
	if result.ID == "" {
		t.Fatal("expected non-empty event ID")
	}
	if result.Status != string(domain.EventStatusActive) {
		t.Fatalf("expected status %q, got %q", domain.EventStatusActive, result.Status)
	}
}

func TestCreateEventWithEndTime(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.EndTime = new(time.Now().UTC().Add(2 * time.Hour))

	// when
	result, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	if err != nil {
		t.Fatalf("CreateEvent() error = %v", err)
	}
	if result.EndTime == nil {
		t.Fatal("expected non-nil end_time")
	}
}

func TestGetEventDetailMapsRepositoryRecord(t *testing.T) {
	// given
	svc, eventRepo, _, _ := newTestEventService()
	userID := uuid.New()
	eventID := uuid.New()
	createdAt := time.Now().UTC().Add(-time.Hour)
	updatedAt := createdAt.Add(10 * time.Minute)
	startTime := time.Now().UTC().Add(24 * time.Hour)
	fixedNow := time.Now().UTC()
	categoryID := 7
	preferredGender := domain.GenderOther
	hostFinalScore := 4.3
	viewerRatingMessage := "Great event host."
	viewerRatingCreatedAt := createdAt.Add(5 * time.Minute)
	viewerRatingUpdatedAt := viewerRatingCreatedAt.Add(2 * time.Minute)
	joinRequestImageURL := "https://cdn.example/join-request.jpg"
	svc.now = func() time.Time { return fixedNow }

	eventRepo.detailRecord = &EventDetailRecord{
		ID:                       eventID,
		VersionNo:                1,
		Title:                    "Detail Event",
		Description:              stringPtr("Full payload"),
		ImageURL:                 stringPtr("https://example.com/event.png"),
		PrivacyLevel:             domain.PrivacyPrivate,
		Status:                   domain.EventStatusCanceled,
		StartTime:                startTime,
		Capacity:                 intPtr(15),
		MinimumAge:               intPtr(21),
		PreferredGender:          &preferredGender,
		ApprovedParticipantCount: 3,
		PendingParticipantCount:  1,
		FavoriteCount:            5,
		CreatedAt:                createdAt,
		UpdatedAt:                updatedAt,
		Category: &EventDetailCategoryRecord{
			ID:   categoryID,
			Name: "Outdoors",
		},
		Host: EventDetailPersonRecord{
			ID:          uuid.New(),
			Username:    "host_user",
			DisplayName: stringPtr("Host User"),
			AvatarURL:   stringPtr("https://example.com/avatar.png"),
		},
		HostScore: EventHostScoreSummaryRecord{
			FinalScore:             &hostFinalScore,
			HostedEventRatingCount: 12,
		},
		Location: EventDetailLocationRecord{
			Type:    domain.LocationRoute,
			Address: stringPtr("Belgrad Forest"),
			RoutePoints: []domain.GeoPoint{
				{Lat: 41.01, Lon: 29.02},
				{Lat: 41.02, Lon: 29.03},
			},
		},
		Tags: []string{"trail", "forest"},
		Constraints: []EventDetailConstraintRecord{
			{Type: "equipment", Info: "Bring hiking boots"},
		},
		ViewerContext: EventDetailViewerContextRecord{
			IsHost:              false,
			IsFavorited:         true,
			ParticipationStatus: ptrParticipationStatus(domain.ParticipationStatusApproved),
			LatestEventVersion:  1,
		},
		ViewerEventRating: &EventDetailRatingRecord{
			ID:        uuid.New(),
			Rating:    5,
			Message:   &viewerRatingMessage,
			CreatedAt: viewerRatingCreatedAt,
			UpdatedAt: viewerRatingUpdatedAt,
		},
		HostContext: &EventDetailHostContextRecord{
			PendingJoinRequests: []EventDetailPendingJoinRequestRecord{
				{
					JoinRequestID: uuid.New(),
					Status:        string(domain.JoinRequestStatusPending),
					ImageURL:      &joinRequestImageURL,
					CreatedAt:     createdAt,
					UpdatedAt:     updatedAt,
					User: EventDetailHostContextUserRecord{
						ID:       uuid.New(),
						Username: "requester_user",
					},
				},
			},
		},
	}

	// when
	result, err := svc.GetEventDetail(context.Background(), userID, eventID)

	// then
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}
	if eventRepo.lastDetailUserID != userID || eventRepo.lastDetailEventID != eventID {
		t.Fatalf("expected detail repo to receive user %s and event %s", userID, eventID)
	}
	if result.ID != eventID.String() {
		t.Fatalf("expected event id %s, got %s", eventID, result.ID)
	}
	if result.Status != string(domain.EventStatusCanceled) {
		t.Fatalf("expected status %q, got %q", domain.EventStatusCanceled, result.Status)
	}
	if result.HostScore.FinalScore == nil || *result.HostScore.FinalScore != hostFinalScore {
		t.Fatalf("expected host final score %v, got %v", hostFinalScore, result.HostScore.FinalScore)
	}
	if result.HostScore.HostedEventRatingCount != 12 {
		t.Fatalf("expected host rating count 12, got %d", result.HostScore.HostedEventRatingCount)
	}
	if result.ViewerEventRating == nil || result.ViewerEventRating.Rating != 5 {
		t.Fatalf("expected viewer_event_rating to be mapped, got %+v", result.ViewerEventRating)
	}
	if result.ViewerContext.ParticipationStatus == nil || *result.ViewerContext.ParticipationStatus != domain.ParticipationStatusApproved {
		t.Fatalf("expected participation_status %q, got %v", domain.ParticipationStatusApproved, result.ViewerContext.ParticipationStatus)
	}
	if result.RatingWindow.IsActive {
		t.Fatal("expected canceled event rating window to be inactive")
	}
	if len(result.Location.RoutePoints) != 2 {
		t.Fatalf("expected 2 route points, got %d", len(result.Location.RoutePoints))
	}
	if result.HostContext == nil || len(result.HostContext.PendingJoinRequests) != 1 || result.HostContext.PendingJoinRequests[0].ImageURL == nil || *result.HostContext.PendingJoinRequests[0].ImageURL != joinRequestImageURL {
		t.Fatalf("expected host context join request image URL %q, got %+v", joinRequestImageURL, result.HostContext)
	}
}

func TestGetEventHostContextSummaryRequiresHost(t *testing.T) {
	// given
	svc, eventRepo, _, _ := newTestEventService()
	eventID := uuid.New()
	hostID := uuid.New()
	eventRepo.events[eventID] = &domain.Event{ID: eventID, HostID: hostID}

	// when
	_, err := svc.GetEventHostContextSummary(context.Background(), uuid.New(), eventID)

	// then
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T", err)
	}
	if appErr.Code != domain.ErrorCodeEventHostManagementNotAllowed {
		t.Fatalf("expected error code %q, got %q", domain.ErrorCodeEventHostManagementNotAllowed, appErr.Code)
	}
}

func TestGetEventHostContextSummaryReturnsCountsForHost(t *testing.T) {
	// given
	svc, eventRepo, _, _ := newTestEventService()
	eventID := uuid.New()
	hostID := uuid.New()
	eventRepo.events[eventID] = &domain.Event{ID: eventID, HostID: hostID}
	eventRepo.hostSummaryRecord = &EventHostContextSummaryRecord{
		ApprovedParticipantCount: 8,
		PendingJoinRequestCount:  3,
		InvitationCount:          5,
	}

	// when
	result, err := svc.GetEventHostContextSummary(context.Background(), hostID, eventID)

	// then
	if err != nil {
		t.Fatalf("GetEventHostContextSummary() error = %v", err)
	}
	if result.ApprovedParticipantCount != 8 || result.PendingJoinRequestCount != 3 || result.InvitationCount != 5 {
		t.Fatalf("unexpected host summary: %+v", result)
	}
}

func TestListEventApprovedParticipantsBuildsCursorPage(t *testing.T) {
	// given
	svc, eventRepo, _, _ := newTestEventService()
	eventID := uuid.New()
	hostID := uuid.New()
	participantID := uuid.New()
	eventRepo.events[eventID] = &domain.Event{ID: eventID, HostID: hostID}
	now := time.Now().UTC()
	eventRepo.participantRecords = []EventDetailApprovedParticipantRecord{
		{
			ParticipationID: participantID,
			Status:          domain.ParticipationStatusApproved,
			CreatedAt:       now,
			UpdatedAt:       now,
			User: EventDetailHostContextUserRecord{
				ID:       uuid.New(),
				Username: "participant_user",
			},
		},
		{
			ParticipationID: uuid.New(),
			Status:          domain.ParticipationStatusApproved,
			CreatedAt:       now.Add(time.Minute),
			UpdatedAt:       now.Add(time.Minute),
			User: EventDetailHostContextUserRecord{
				ID:       uuid.New(),
				Username: "second_user",
			},
		},
	}
	limit := 1

	// when
	result, err := svc.ListEventApprovedParticipants(context.Background(), hostID, eventID, ListEventCollectionInput{
		Limit: &limit,
	})

	// then
	if err != nil {
		t.Fatalf("ListEventApprovedParticipants() error = %v", err)
	}
	if len(result.Items) != 1 {
		t.Fatalf("expected 1 participant, got %d", len(result.Items))
	}
	if result.Items[0].ParticipationID != participantID.String() {
		t.Fatalf("expected first participant id %s, got %s", participantID, result.Items[0].ParticipationID)
	}
	if !result.PageInfo.HasNext || result.PageInfo.NextCursor == nil {
		t.Fatalf("expected next cursor, got %+v", result.PageInfo)
	}
	if eventRepo.lastCollectionPage.Limit != 1 {
		t.Fatalf("expected repo limit 1, got %d", eventRepo.lastCollectionPage.Limit)
	}
	if eventRepo.lastCollectionPage.RepositoryFetchLimit != 2 {
		t.Fatalf("expected repo fetch limit 2, got %d", eventRepo.lastCollectionPage.RepositoryFetchLimit)
	}
}

func TestGetEventDetailReturnsNotFoundWhenRepositoryMisses(t *testing.T) {
	// given
	svc, eventRepo, _, _ := newTestEventService()
	eventRepo.detailErr = domain.ErrNotFound

	// when
	_, err := svc.GetEventDetail(context.Background(), uuid.New(), uuid.New())

	// then
	commonAppErrCode := domain.ErrorCodeEventNotFound
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T", err)
	}
	if appErr.Code != commonAppErrCode {
		t.Fatalf("expected error code %q, got %q", commonAppErrCode, appErr.Code)
	}
}

func TestCreateEventValidationEmptyTitle(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Title = ""

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "title")
}

func TestCreateEventValidationInvalidPrivacyLevel(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.PrivacyLevel = domain.EventPrivacyLevel("secret")

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "privacy_level")
}

func TestCreateEventValidationInvalidLocationType(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.LocationType = domain.EventLocationType("spaceship")
	input.Lat = nil
	input.Lon = nil

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "location_type")
}

func TestCreateEventValidationMissingStartTime(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.StartTime = time.Time{}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "start_time")
}

func TestCreateEventValidationPastStartTime(t *testing.T) {
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.StartTime = time.Now().UTC().Add(-time.Hour)

	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	assertValidationDetail(t, err, "start_time")
}

func TestCreateEventValidationEndTimeBeforeStartTime(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.EndTime = new(input.StartTime.Add(-time.Hour))

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "end_time")
}

func TestCreateEventValidationEndTimeEqualToStartTime(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	now := time.Now().UTC().Add(time.Hour)
	input := validInput()
	input.StartTime = now
	input.EndTime = &now

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "end_time")
}

func TestCreateEventValidationTooManyTags(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Tags = []string{"a", "b", "c", "d", "e", "f"}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "tags")
}

func TestCreateEventValidationEmptyTag(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Tags = []string{"valid", ""}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "tags")
}

func TestCreateEventValidationTagTooLong(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Tags = []string{"this-tag-is-way-too-long-to-be-valid"}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "tags")
}

func TestCreateEventValidationInvalidGender(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.PreferredGender = new(domain.EventParticipantGender("unknown"))

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "preferred_gender")
}

func TestCreateEventValidationNegativeCapacity(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Capacity = new(-1)

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "capacity")
}

func TestCreateEventValidationZeroCapacity(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Capacity = new(0)

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "capacity")
}

func TestCreateEventValidationInvalidMinimumAge(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.MinimumAge = new(200)

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "minimum_age")
}

func TestCreateEventValidationConstraintMissingType(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Constraints = []ConstraintInput{{Type: "", Info: "some info"}}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "constraints[0].type")
}

func TestCreateEventValidationConstraintMissingInfo(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Constraints = []ConstraintInput{{Type: "equipment", Info: ""}}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "constraints[0].info")
}

func TestCreateEventValidationMissingDescription(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Description = nil

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "description")
}

func TestCreateEventValidationMissingCategoryID(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.CategoryID = nil

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "category_id")
}

func TestCreateEventValidationPointRequiresCoordinates(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Lat = nil
	input.Lon = nil

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "lat")
	assertValidationDetail(t, err, "lon")
}

func TestCreateEventValidationRouteRequiresRoutePoints(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.LocationType = domain.LocationRoute
	input.Lat = nil
	input.Lon = nil
	input.RoutePoints = nil

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "route_points")
}

func TestCreateEventValidationRoutePointMissingLatitude(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.LocationType = domain.LocationRoute
	input.Lat = nil
	input.Lon = nil
	input.RoutePoints = []RoutePointInput{
		{Lat: nil, Lon: floatPtr(29.0)},
		{Lat: floatPtr(41.1), Lon: floatPtr(29.1)},
	}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "route_points[0].lat")
}

func TestCreateEventValidationTooManyConstraints(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	input := validInput()
	input.Constraints = []ConstraintInput{
		{Type: "a", Info: "1"},
		{Type: "b", Info: "2"},
		{Type: "c", Info: "3"},
		{Type: "d", Info: "4"},
		{Type: "e", Info: "5"},
		{Type: "f", Info: "6"},
	}

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	assertValidationDetail(t, err, "constraints")
}

func TestCreateEventRepoErrorPropagates(t *testing.T) {
	// given
	svc, eventRepo, _, _ := newTestEventService()
	eventRepo.err = errors.New("database down")
	input := validInput()

	// when
	_, err := svc.CreateEvent(context.Background(), uuid.New(), input)

	// then
	if err == nil {
		t.Fatal("expected error from repo, got nil")
	}
}

func TestDiscoverEventsAppliesDefaultsAndMapsResults(t *testing.T) {
	// given
	svc, eventRepo, _, _ := newTestEventService()
	userID := uuid.New()
	lat := 41.0082
	lon := 28.9784
	startTime := time.Date(2030, time.January, 1, 18, 0, 0, 0, time.UTC)
	imageURL := "https://example.com/event.jpg"
	address := "Bebek, Istanbul"

	eventRepo.discoverRecords = []DiscoverableEventRecord{
		{
			ID:                       uuid.New(),
			Title:                    "Nearby Event",
			CategoryName:             "Sports",
			ImageURL:                 &imageURL,
			StartTime:                startTime,
			Status:                   domain.EventStatusActive,
			LocationAddress:          &address,
			PrivacyLevel:             domain.PrivacyPublic,
			ApprovedParticipantCount: 7,
			IsFavorited:              true,
			DistanceMeters:           1200,
		},
	}

	// when
	result, err := svc.DiscoverEvents(context.Background(), userID, DiscoverEventsInput{
		Lat: &lat,
		Lon: &lon,
	})

	// then
	if err != nil {
		t.Fatalf("DiscoverEvents() error = %v", err)
	}
	if eventRepo.discoverCallCount != 1 {
		t.Fatalf("expected repository to be called once, got %d", eventRepo.discoverCallCount)
	}
	if eventRepo.lastDiscoverUserID != userID {
		t.Fatalf("expected repository to receive user %s, got %s", userID, eventRepo.lastDiscoverUserID)
	}
	if eventRepo.lastDiscoverParams.RadiusMeters != defaultDiscoverRadiusMeters {
		t.Fatalf("expected default radius %d, got %d", defaultDiscoverRadiusMeters, eventRepo.lastDiscoverParams.RadiusMeters)
	}
	if eventRepo.lastDiscoverParams.MinimumAge != nil {
		t.Fatalf("expected default minimum_age filter nil, got %v", eventRepo.lastDiscoverParams.MinimumAge)
	}
	if eventRepo.lastDiscoverParams.Limit != defaultDiscoverLimit {
		t.Fatalf("expected default limit %d, got %d", defaultDiscoverLimit, eventRepo.lastDiscoverParams.Limit)
	}
	if eventRepo.lastDiscoverParams.RepositoryFetchLimit != defaultDiscoverLimit+1 {
		t.Fatalf("expected fetch limit %d, got %d", defaultDiscoverLimit+1, eventRepo.lastDiscoverParams.RepositoryFetchLimit)
	}
	if eventRepo.lastDiscoverParams.SortBy != domain.EventDiscoverySortStartTime {
		t.Fatalf("expected default sort %q, got %q", domain.EventDiscoverySortStartTime, eventRepo.lastDiscoverParams.SortBy)
	}
	if len(eventRepo.lastDiscoverParams.PrivacyLevels) != 2 ||
		eventRepo.lastDiscoverParams.PrivacyLevels[0] != domain.PrivacyPublic ||
		eventRepo.lastDiscoverParams.PrivacyLevels[1] != domain.PrivacyProtected {
		t.Fatalf("expected default privacy levels [PUBLIC PROTECTED], got %v", eventRepo.lastDiscoverParams.PrivacyLevels)
	}
	if len(result.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(result.Items))
	}
	if result.Items[0].Title != "Nearby Event" {
		t.Fatalf("expected title %q, got %q", "Nearby Event", result.Items[0].Title)
	}
	if result.Items[0].CategoryName != "Sports" {
		t.Fatalf("expected category name %q, got %q", "Sports", result.Items[0].CategoryName)
	}
	if result.Items[0].Status != string(domain.EventStatusActive) {
		t.Fatalf("expected status %q, got %q", domain.EventStatusActive, result.Items[0].Status)
	}
	if !result.Items[0].IsFavorited {
		t.Fatal("expected event to be favorited")
	}
	if result.PageInfo.HasNext {
		t.Fatal("expected has_next to be false")
	}
	if result.PageInfo.NextCursor != nil {
		t.Fatalf("expected nil next_cursor, got %v", result.PageInfo.NextCursor)
	}
}

func TestListFavoriteEventsMapsPrivacyLevelAndLocationAddress(t *testing.T) {
	// given
	svc, eventRepo, _, _ := newTestEventService()
	category := "Music"
	imageURL := "https://example.com/favorite.jpg"
	locationAddress := "Kadikoy, Istanbul"
	startTime := time.Date(2030, time.January, 2, 18, 0, 0, 0, time.UTC)
	endTime := time.Date(2030, time.January, 2, 21, 0, 0, 0, time.UTC)
	favoritedAt := time.Date(2030, time.January, 1, 12, 0, 0, 0, time.UTC)
	eventID := uuid.New()

	eventRepo.favoriteRecords = []FavoriteEventRecord{
		{
			ID:              eventID,
			Title:           "Sunset Concert",
			CategoryName:    &category,
			ImageURL:        &imageURL,
			Status:          domain.EventStatusActive,
			PrivacyLevel:    domain.PrivacyProtected,
			LocationAddress: &locationAddress,
			StartTime:       startTime,
			EndTime:         &endTime,
			FavoritedAt:     favoritedAt,
		},
	}

	// when
	result, err := svc.ListFavoriteEvents(context.Background(), uuid.New())

	// then
	if err != nil {
		t.Fatalf("ListFavoriteEvents() error = %v", err)
	}
	if len(result.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(result.Items))
	}

	item := result.Items[0]
	if item.ID != eventID.String() {
		t.Fatalf("expected id %s, got %s", eventID, item.ID)
	}
	if item.PrivacyLevel != string(domain.PrivacyProtected) {
		t.Fatalf("expected privacy_level %q, got %q", domain.PrivacyProtected, item.PrivacyLevel)
	}
	if item.LocationAddress == nil || *item.LocationAddress != locationAddress {
		t.Fatalf("expected location_address %q, got %v", locationAddress, item.LocationAddress)
	}
}

func TestDiscoverEventsDefaultsToRelevanceWhenQueryProvided(t *testing.T) {
	// given
	svc, eventRepo, _, _ := newTestEventService()
	lat := 41.0082
	lon := 28.9784
	query := "live music"

	// when
	_, err := svc.DiscoverEvents(context.Background(), uuid.New(), DiscoverEventsInput{
		Lat:   &lat,
		Lon:   &lon,
		Query: &query,
	})

	// then
	if err != nil {
		t.Fatalf("DiscoverEvents() error = %v", err)
	}
	if eventRepo.lastDiscoverParams.SortBy != domain.EventDiscoverySortRelevance {
		t.Fatalf("expected default sort %q, got %q", domain.EventDiscoverySortRelevance, eventRepo.lastDiscoverParams.SortBy)
	}
	if eventRepo.lastDiscoverParams.Query != query {
		t.Fatalf("expected query %q, got %q", query, eventRepo.lastDiscoverParams.Query)
	}
}

func TestDiscoverEventsRejectsRelevanceWithoutQuery(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	lat := 41.0082
	lon := 28.9784
	sortBy := domain.EventDiscoverySortRelevance

	// when
	_, err := svc.DiscoverEvents(context.Background(), uuid.New(), DiscoverEventsInput{
		Lat:    &lat,
		Lon:    &lon,
		SortBy: &sortBy,
	})

	// then
	assertValidationDetail(t, err, "sort_by")
}

func TestDiscoverEventsRejectsInvalidCursor(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	lat := 41.0082
	lon := 28.9784
	cursor := "%%%invalid%%%"

	// when
	_, err := svc.DiscoverEvents(context.Background(), uuid.New(), DiscoverEventsInput{
		Lat:    &lat,
		Lon:    &lon,
		Cursor: &cursor,
	})

	// then
	assertValidationDetail(t, err, "cursor")
}

func TestDiscoverEventsRejectsCursorMismatch(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	lat := 41.0082
	lon := 28.9784
	cursorValue, err := encodeDiscoverEventsCursor(DiscoverEventsCursor{
		SortBy:            domain.EventDiscoverySortStartTime,
		FilterFingerprint: "different-filter",
		StartTime:         time.Now().UTC(),
		EventID:           uuid.New(),
	})
	if err != nil {
		t.Fatalf("encodeDiscoverEventsCursor() error = %v", err)
	}

	// when
	_, err = svc.DiscoverEvents(context.Background(), uuid.New(), DiscoverEventsInput{
		Lat:    &lat,
		Lon:    &lon,
		Cursor: &cursorValue,
	})

	// then
	assertValidationDetail(t, err, "cursor")
}

func TestDiscoverEventsRejectsOutOfRangeRadiusAndLimit(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	lat := 41.0082
	lon := 28.9784
	radius := 50001
	limit := 0
	minimumAge := 121

	// when
	_, err := svc.DiscoverEvents(context.Background(), uuid.New(), DiscoverEventsInput{
		Lat:          &lat,
		Lon:          &lon,
		RadiusMeters: &radius,
		MinimumAge:   &minimumAge,
		Limit:        &limit,
	})

	// then
	assertValidationDetail(t, err, "radius_meters")
	assertValidationDetail(t, err, "minimum_age")
	assertValidationDetail(t, err, "limit")
}

func TestDiscoverEventsPassesMinimumAgeFilterToRepo(t *testing.T) {
	// given
	svc, eventRepo, _, _ := newTestEventService()
	lat := 41.0082
	lon := 28.9784
	minimumAge := 18

	// when
	_, err := svc.DiscoverEvents(context.Background(), uuid.New(), DiscoverEventsInput{
		Lat:        &lat,
		Lon:        &lon,
		MinimumAge: &minimumAge,
	})

	// then
	if err != nil {
		t.Fatalf("DiscoverEvents() error = %v", err)
	}
	if eventRepo.lastDiscoverParams.MinimumAge == nil || *eventRepo.lastDiscoverParams.MinimumAge != minimumAge {
		t.Fatalf("expected repo minimum_age filter %d, got %v", minimumAge, eventRepo.lastDiscoverParams.MinimumAge)
	}
}

func TestDiscoverEventsRejectsPrivateVisibilityFilter(t *testing.T) {
	// given
	svc, _, _, _ := newTestEventService()
	lat := 41.0082
	lon := 28.9784

	// when
	_, err := svc.DiscoverEvents(context.Background(), uuid.New(), DiscoverEventsInput{
		Lat:           &lat,
		Lon:           &lon,
		PrivacyLevels: []domain.EventPrivacyLevel{domain.PrivacyPrivate},
	})

	// then
	assertValidationDetail(t, err, "privacy_levels")
}

func TestDiscoverEventsBuildsNextCursorFromLastReturnedItem(t *testing.T) {
	// given
	svc, eventRepo, _, _ := newTestEventService()
	lat := 41.0082
	lon := 28.9784
	limit := 1
	first := DiscoverableEventRecord{
		ID:                       uuid.New(),
		Title:                    "First Event",
		CategoryName:             "Sports",
		StartTime:                time.Date(2030, time.January, 1, 18, 0, 0, 0, time.UTC),
		Status:                   domain.EventStatusActive,
		PrivacyLevel:             domain.PrivacyPublic,
		ApprovedParticipantCount: 5,
		DistanceMeters:           100,
	}
	second := DiscoverableEventRecord{
		ID:                       uuid.New(),
		Title:                    "Second Event",
		CategoryName:             "Sports",
		StartTime:                time.Date(2030, time.January, 2, 18, 0, 0, 0, time.UTC),
		Status:                   domain.EventStatusActive,
		PrivacyLevel:             domain.PrivacyPublic,
		ApprovedParticipantCount: 6,
		DistanceMeters:           200,
	}
	eventRepo.discoverRecords = []DiscoverableEventRecord{first, second}

	// when
	result, err := svc.DiscoverEvents(context.Background(), uuid.New(), DiscoverEventsInput{
		Lat:   &lat,
		Lon:   &lon,
		Limit: &limit,
	})

	// then
	if err != nil {
		t.Fatalf("DiscoverEvents() error = %v", err)
	}
	if !result.PageInfo.HasNext {
		t.Fatal("expected has_next to be true")
	}
	if result.PageInfo.NextCursor == nil {
		t.Fatal("expected next_cursor to be present")
	}

	cursor, err := decodeDiscoverEventsCursor(*result.PageInfo.NextCursor)
	if err != nil {
		t.Fatalf("decodeDiscoverEventsCursor() error = %v", err)
	}
	if cursor.EventID != first.ID {
		t.Fatalf("expected cursor event_id %s, got %s", first.ID, cursor.EventID)
	}
	if cursor.StartTime != first.StartTime {
		t.Fatalf("expected cursor start_time %v, got %v", first.StartTime, cursor.StartTime)
	}
}

// newTestEventServiceWithEvent wires a service with a pre-loaded event in the fake repo.
func newTestEventServiceWithEvent(e *domain.Event) (*Service, *fakeEventRepo, *fakeParticipationService, *fakeJoinRequestService) {
	eventRepo := &fakeEventRepo{
		events:     map[uuid.UUID]*domain.Event{e.ID: e},
		requesters: map[uuid.UUID]*domain.User{},
	}
	participationService := &fakeParticipationService{}
	joinRequestService := &fakeJoinRequestService{}
	return NewService(eventRepo, participationService, joinRequestService, &fakeUnitOfWork{}), eventRepo, participationService, joinRequestService
}

func newTestEventServiceWithEventAndTickets(e *domain.Event) (*Service, *fakeEventRepo, *fakeParticipationService, *fakeJoinRequestService, *fakeTicketLifecycle) {
	eventRepo := &fakeEventRepo{
		events:     map[uuid.UUID]*domain.Event{e.ID: e},
		requesters: map[uuid.UUID]*domain.User{},
	}
	participationService := &fakeParticipationService{}
	joinRequestService := &fakeJoinRequestService{}
	ticketService := &fakeTicketLifecycle{}
	return NewService(eventRepo, participationService, joinRequestService, &fakeUnitOfWork{}, ticketService), eventRepo, participationService, joinRequestService, ticketService
}

func publicEvent(hostID uuid.UUID) *domain.Event {
	return &domain.Event{
		ID:           uuid.New(),
		HostID:       hostID,
		PrivacyLevel: domain.PrivacyPublic,
		Status:       domain.EventStatusActive,
	}
}

func publicEventWithCapacity(hostID uuid.UUID, capacity, approvedCount int) *domain.Event {
	return &domain.Event{
		ID:                       uuid.New(),
		HostID:                   hostID,
		PrivacyLevel:             domain.PrivacyPublic,
		Status:                   domain.EventStatusActive,
		Capacity:                 &capacity,
		ApprovedParticipantCount: approvedCount,
	}
}

func editableEvent(hostID uuid.UUID) *domain.Event {
	categoryID := 1
	capacity := 10
	description := "Original description"
	locationType := domain.LocationPoint
	now := time.Now().UTC()
	return &domain.Event{
		ID:                       uuid.New(),
		HostID:                   hostID,
		Title:                    "Original title",
		Description:              &description,
		CategoryID:               &categoryID,
		PrivacyLevel:             domain.PrivacyProtected,
		Status:                   domain.EventStatusActive,
		StartTime:                now.Add(2 * time.Hour),
		EndTime:                  timePtr(now.Add(3 * time.Hour)),
		Capacity:                 &capacity,
		ApprovedParticipantCount: 2,
		PendingParticipantCount:  1,
		LocationType:             &locationType,
		CreatedAt:                now.Add(-time.Hour),
		UpdatedAt:                now.Add(-time.Hour),
	}
}

func TestGetEventDetailReturnsDiffFromViewerLastConfirmedVersion(t *testing.T) {
	// given
	svc, eventRepo, _, _ := newTestEventService()
	eventID := uuid.New()
	userID := uuid.New()
	lastConfirmed := 3
	eventRepo.detailRecord = &EventDetailRecord{
		ID:           eventID,
		VersionNo:    5,
		Title:        "New title",
		PrivacyLevel: domain.PrivacyPublic,
		Status:       domain.EventStatusActive,
		StartTime:    time.Now().UTC().Add(24 * time.Hour),
		CreatedAt:    time.Now().UTC().Add(-time.Hour),
		UpdatedAt:    time.Now().UTC(),
		Host:         EventDetailPersonRecord{ID: uuid.New(), Username: "host"},
		Location: EventDetailLocationRecord{
			Type:  domain.LocationPoint,
			Point: &domain.GeoPoint{Lat: 41, Lon: 29},
		},
		ViewerContext: EventDetailViewerContextRecord{
			ParticipationStatus:       ptrParticipationStatus(domain.ParticipationStatusPending),
			LastConfirmedEventVersion: &lastConfirmed,
			LatestEventVersion:        5,
		},
	}
	eventRepo.historySnapshots = map[int]*EventHistorySnapshotRecord{
		3: {
			EventID:   eventID,
			VersionNo: 3,
			Snapshot: EventHistorySnapshot{
				Title:        "Old title",
				PrivacyLevel: string(domain.PrivacyPublic),
				Status:       string(domain.EventStatusActive),
				StartTime:    eventRepo.detailRecord.StartTime,
				Location:     EventHistoryLocationSnapshot{Type: string(domain.LocationPoint)},
				Tags:         []string{"old"},
				Constraints:  []EventDetailConstraintRecord{},
			},
		},
		5: {
			EventID:   eventID,
			VersionNo: 5,
			Snapshot: EventHistorySnapshot{
				Title:        "New title",
				PrivacyLevel: string(domain.PrivacyPublic),
				Status:       string(domain.EventStatusActive),
				StartTime:    eventRepo.detailRecord.StartTime,
				Location:     EventHistoryLocationSnapshot{Type: string(domain.LocationPoint)},
				Tags:         []string{"new"},
				Constraints:  []EventDetailConstraintRecord{},
			},
		},
	}

	// when
	result, err := svc.GetEventDetail(context.Background(), userID, eventID)

	// then
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}
	if !result.ViewerContext.NeedsReconfirmation {
		t.Fatal("expected needs_reconfirmation=true")
	}
	if result.ViewerContext.EventDiff == nil {
		t.Fatal("expected event_diff")
	}
	if result.ViewerContext.EventDiff.FromVersionNo != 3 || result.ViewerContext.EventDiff.ToVersionNo != 5 {
		t.Fatalf("unexpected diff versions: %+v", result.ViewerContext.EventDiff)
	}
	if len(result.ViewerContext.EventDiff.Changes) != 2 {
		t.Fatalf("expected title and tags changes, got %+v", result.ViewerContext.EventDiff.Changes)
	}
}

func TestUpdateEventTriggeringChangeMarksApprovedParticipantsPendingAndTickets(t *testing.T) {
	// given
	hostID := uuid.New()
	ev := editableEvent(hostID)
	svc, _, participationService, _, ticketService := newTestEventServiceWithEventAndTickets(ev)
	participantID := uuid.New()
	participationService.pendingUserIDs = []uuid.UUID{participantID}
	newTitle := "Updated title"

	// when
	result, err := svc.UpdateEvent(context.Background(), hostID, ev.ID, UpdateEventInput{Title: &newTitle})

	// then
	if err != nil {
		t.Fatalf("UpdateEvent() error = %v", err)
	}
	if result.VersionNo != 2 {
		t.Fatalf("expected version 2, got %d", result.VersionNo)
	}
	if !result.ReconfirmationRequired || len(result.ReconfirmationTriggeredFields) != 1 || result.ReconfirmationTriggeredFields[0] != "title" {
		t.Fatalf("unexpected triggered fields: %+v", result.ReconfirmationTriggeredFields)
	}
	if result.ParticipantsMarkedPending != 1 {
		t.Fatalf("expected one marked pending, got %d", result.ParticipantsMarkedPending)
	}
	if participationService.lastEventID != ev.ID {
		t.Fatalf("expected participation transition for event %s, got %s", ev.ID, participationService.lastEventID)
	}
	if ticketService.pendingEventID != ev.ID {
		t.Fatalf("expected tickets pending for event %s, got %s", ev.ID, ticketService.pendingEventID)
	}
}

func TestUpdateEventRemovingConstraintDoesNotRequireReconfirmation(t *testing.T) {
	// given
	hostID := uuid.New()
	ev := editableEvent(hostID)
	svc, repo, participationService, _ := newTestEventServiceWithEvent(ev)
	repo.editSnapshot = &EventEditSnapshot{
		Event:     *ev,
		VersionNo: 4,
		Location: EventDetailLocationRecord{
			Type:  domain.LocationPoint,
			Point: &domain.GeoPoint{Lat: 41, Lon: 29},
		},
		Constraints: []EventDetailConstraintRecord{{Type: "equipment", Info: "Shoes"}},
	}
	constraints := []ConstraintInput{}

	// when
	result, err := svc.UpdateEvent(context.Background(), hostID, ev.ID, UpdateEventInput{Constraints: &constraints})

	// then
	if err != nil {
		t.Fatalf("UpdateEvent() error = %v", err)
	}
	if result.ReconfirmationRequired {
		t.Fatalf("expected no reconfirmation for constraint removal, got %+v", result.ReconfirmationTriggeredFields)
	}
	if participationService.lastEventID != uuid.Nil {
		t.Fatalf("expected no participation transition, got %s", participationService.lastEventID)
	}
}

func TestUpdateEventRejectsCapacityBelowApprovedAndPendingCount(t *testing.T) {
	// given
	hostID := uuid.New()
	ev := editableEvent(hostID)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)
	capacity := 2

	// when
	_, err := svc.UpdateEvent(context.Background(), hostID, ev.ID, UpdateEventInput{Capacity: OptionalInt{Set: true, Value: &capacity}})

	// then
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeCapacityBelowParticipantCount {
		t.Fatalf("expected capacity_below_participant_count, got %v", err)
	}
}

func TestReconfirmParticipationCreatesActiveTicketForPublicEvent(t *testing.T) {
	// given
	hostID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, participationService, _, ticketService := newTestEventServiceWithEventAndTickets(ev)
	userID := uuid.New()

	// when
	result, err := svc.ReconfirmParticipation(context.Background(), userID, ev.ID)

	// then
	if err != nil {
		t.Fatalf("ReconfirmParticipation() error = %v", err)
	}
	if result.Status != domain.ParticipationStatusApproved {
		t.Fatalf("expected APPROVED, got %q", result.Status)
	}
	if participationService.lastEventID != ev.ID || participationService.lastUserID != userID {
		t.Fatalf("expected reconfirm for event %s user %s, got event %s user %s", ev.ID, userID, participationService.lastEventID, participationService.lastUserID)
	}
	if ticketService.createCallCount == 0 || result.TicketStatus == nil || *result.TicketStatus != domain.TicketStatusActive {
		t.Fatalf("expected active ticket creation, got count=%d status=%v", ticketService.createCallCount, result.TicketStatus)
	}
}

func TestTransitionEventStatusesAutoApprovesPendingWhenEventStarts(t *testing.T) {
	// given
	hostID := uuid.New()
	ev := editableEvent(hostID)
	svc, repo, participationService, _, ticketService := newTestEventServiceWithEventAndTickets(ev)
	repo.transitionRecords = []EventStatusTransitionRecord{{EventID: ev.ID, Status: domain.EventStatusInProgress}}

	// when
	err := svc.TransitionEventStatuses(context.Background())

	// then
	if err != nil {
		t.Fatalf("TransitionEventStatuses() error = %v", err)
	}
	if participationService.lastEventID != ev.ID {
		t.Fatalf("expected pending approvals for event %s, got %s", ev.ID, participationService.lastEventID)
	}
	if ticketService.activateEventID != ev.ID {
		t.Fatalf("expected pending ticket activation for event %s, got %s", ev.ID, ticketService.activateEventID)
	}
}

func protectedEvent(hostID uuid.UUID) *domain.Event {
	return &domain.Event{
		ID:           uuid.New(),
		HostID:       hostID,
		PrivacyLevel: domain.PrivacyProtected,
		Status:       domain.EventStatusActive,
	}
}

func ptrInt(v int) *int {
	return &v
}

func ptrTime(v time.Time) *time.Time {
	return &v
}

func ptrString(v string) *string {
	return &v
}

func ptrGender(v domain.EventParticipantGender) *domain.EventParticipantGender {
	return &v
}

func TestCancelEventRunsEventAndParticipationUpdatesInsideOneUnitOfWork(t *testing.T) {
	hostID := uuid.New()
	ev := publicEventWithCapacity(hostID, 10, 3)
	svc, eventRepo, participationService, _ := newTestEventServiceWithEvent(ev)

	if err := svc.CancelEvent(context.Background(), hostID, ev.ID); err != nil {
		t.Fatalf("CancelEvent() error = %v", err)
	}

	uow := svc.unitOfWork.(*fakeUnitOfWork)
	if uow.callCount != 1 || uow.commitCount != 1 {
		t.Fatalf("expected one committed unit of work, got calls=%d commits=%d", uow.callCount, uow.commitCount)
	}
	if eventRepo.lastCancelCount != 3 {
		t.Fatalf("expected canceled snapshot count 3, got %d", eventRepo.lastCancelCount)
	}
	if eventRepo.lastCancelCtx != participationService.lastCancelCtx {
		t.Fatal("expected event and participation operations to share the same transaction context")
	}
	if eventRepo.lastCancelCtx.Value(fakeTxContextKey{}) != true {
		t.Fatal("expected cancel flow to run inside transactional context")
	}
	if participationService.cancelCallCount != 1 || participationService.lastCancelEventID != ev.ID {
		t.Fatalf("expected participation cancellation for event %s, got calls=%d event=%s", ev.ID, participationService.cancelCallCount, participationService.lastCancelEventID)
	}
}

func TestCancelEventCancelsTicketsInsideUnitOfWork(t *testing.T) {
	hostID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, _, _, ticketService := newTestEventServiceWithEventAndTickets(ev)

	if err := svc.CancelEvent(context.Background(), hostID, ev.ID); err != nil {
		t.Fatalf("CancelEvent() error = %v", err)
	}

	if ticketService.cancelEventCallCount != 1 || ticketService.lastCancelEventID != ev.ID {
		t.Fatalf("expected ticket cancellation for event %s, got calls=%d event=%s", ev.ID, ticketService.cancelEventCallCount, ticketService.lastCancelEventID)
	}
}

func TestCancelEventRollsBackUnitOfWorkWhenParticipationCancelFails(t *testing.T) {
	hostID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, participationService, _ := newTestEventServiceWithEvent(ev)
	participationService.err = errors.New("db write failed")

	err := svc.CancelEvent(context.Background(), hostID, ev.ID)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	uow := svc.unitOfWork.(*fakeUnitOfWork)
	if uow.rollbackCount != 1 || uow.commitCount != 0 {
		t.Fatalf("expected rollback without commit, got rollbacks=%d commits=%d", uow.rollbackCount, uow.commitCount)
	}
}

func TestCompleteEventHostSuccess(t *testing.T) {
	hostID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, participationService, _ := newTestEventServiceWithEvent(ev)
	badgeEvaluator := attachEventBadgeEvaluator(svc)

	if err := svc.CompleteEvent(context.Background(), hostID, ev.ID); err != nil {
		t.Fatalf("CompleteEvent() error = %v", err)
	}
	if ev.Status != domain.EventStatusCompleted {
		t.Fatalf("expected status COMPLETED, got %q", ev.Status)
	}
	if participationService.evaluateBadgesCallCount != 1 || participationService.lastEvaluateBadgesEventID != ev.ID {
		t.Fatalf("expected badge evaluation for event %s, got calls=%d event=%s", ev.ID, participationService.evaluateBadgesCallCount, participationService.lastEvaluateBadgesEventID)
	}
	if badgeEvaluator.callCount != 1 || badgeEvaluator.lastHostID != hostID {
		t.Fatalf("expected host badge evaluation for host %s, got calls=%d host=%s", hostID, badgeEvaluator.callCount, badgeEvaluator.lastHostID)
	}
}

func TestCompleteEventExpiresTickets(t *testing.T) {
	hostID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, _, _, ticketService := newTestEventServiceWithEventAndTickets(ev)

	if err := svc.CompleteEvent(context.Background(), hostID, ev.ID); err != nil {
		t.Fatalf("CompleteEvent() error = %v", err)
	}

	if ticketService.expireEventCallCount != 1 || ticketService.lastExpireEventID != ev.ID {
		t.Fatalf("expected ticket expiry for event %s, got calls=%d event=%s", ev.ID, ticketService.expireEventCallCount, ticketService.lastExpireEventID)
	}
}

func TestCompleteEventHostSuccessInProgress(t *testing.T) {
	hostID := uuid.New()
	ev := publicEvent(hostID)
	ev.Status = domain.EventStatusInProgress
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	if err := svc.CompleteEvent(context.Background(), hostID, ev.ID); err != nil {
		t.Fatalf("CompleteEvent() error = %v", err)
	}
	if ev.Status != domain.EventStatusCompleted {
		t.Fatalf("expected status COMPLETED, got %q", ev.Status)
	}
}

func TestCompleteEventForbiddenForNonHost(t *testing.T) {
	hostID := uuid.New()
	other := uuid.New()
	ev := publicEvent(hostID)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	err := svc.CompleteEvent(context.Background(), other, ev.ID)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Status != 403 || appErr.Code != domain.ErrorCodeEventCompleteNotAllowed {
		t.Fatalf("expected 403 event_complete_not_allowed, got %v", err)
	}
}

func TestCompleteEventConflictWhenTerminal(t *testing.T) {
	hostID := uuid.New()
	ev := publicEvent(hostID)
	ev.Status = domain.EventStatusCompleted
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	err := svc.CompleteEvent(context.Background(), hostID, ev.ID)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Status != 409 || appErr.Code != domain.ErrorCodeEventNotCompletable {
		t.Fatalf("expected 409 event_not_completable, got %v", err)
	}
}

func TestCompleteEventIgnoresBadgeEvaluationErrors(t *testing.T) {
	hostID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, participationService, _ := newTestEventServiceWithEvent(ev)
	participationService.err = errors.New("badge evaluation failed")
	badgeEvaluator := attachEventBadgeEvaluator(svc)
	badgeEvaluator.err = errors.New("host badge evaluation failed")

	err := svc.CompleteEvent(context.Background(), hostID, ev.ID)

	if err != nil {
		t.Fatalf("expected badge-evaluation errors to be ignored, got %v", err)
	}
	if participationService.evaluateBadgesCallCount != 1 {
		t.Fatalf("expected one badge-evaluation attempt, got %d", participationService.evaluateBadgesCallCount)
	}
	if badgeEvaluator.callCount != 1 {
		t.Fatalf("expected one host badge-evaluation attempt, got %d", badgeEvaluator.callCount)
	}
}

func TestTransitionExpiredEventsEvaluatesBadgesForEachCompletedEvent(t *testing.T) {
	completedOne := uuid.New()
	completedTwo := uuid.New()
	hostOne := uuid.New()
	hostTwo := uuid.New()
	svc, eventRepo, participationService, _ := newTestEventService()
	badgeEvaluator := attachEventBadgeEvaluator(svc)
	eventRepo.transitionRecords = []EventStatusTransitionRecord{
		{EventID: completedOne, HostID: hostOne, Status: domain.EventStatusCompleted},
		{EventID: completedTwo, HostID: hostTwo, Status: domain.EventStatusCompleted},
	}

	err := svc.TransitionExpiredEvents(context.Background())

	if err != nil {
		t.Fatalf("TransitionExpiredEvents() error = %v", err)
	}
	if participationService.evaluateBadgesCallCount != 2 {
		t.Fatalf("expected 2 badge-evaluation calls, got %d", participationService.evaluateBadgesCallCount)
	}
	if len(participationService.evaluateBadgesEventIDHistory) != 2 ||
		participationService.evaluateBadgesEventIDHistory[0] != completedOne ||
		participationService.evaluateBadgesEventIDHistory[1] != completedTwo {
		t.Fatalf("expected badge evaluation for [%s %s], got %v", completedOne, completedTwo, participationService.evaluateBadgesEventIDHistory)
	}
	if badgeEvaluator.callCount != 2 ||
		len(badgeEvaluator.hostIDCallHistory) != 2 ||
		badgeEvaluator.hostIDCallHistory[0] != hostOne ||
		badgeEvaluator.hostIDCallHistory[1] != hostTwo {
		t.Fatalf("expected host badge evaluation for [%s %s], got %v", hostOne, hostTwo, badgeEvaluator.hostIDCallHistory)
	}
}

func TestTransitionExpiredEventsPropagatesRepositoryError(t *testing.T) {
	expectedErr := errors.New("transition failed")
	svc, eventRepo, participationService, _ := newTestEventService()
	badgeEvaluator := attachEventBadgeEvaluator(svc)
	eventRepo.err = expectedErr

	err := svc.TransitionExpiredEvents(context.Background())

	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected error %v, got %v", expectedErr, err)
	}
	if participationService.evaluateBadgesCallCount != 0 {
		t.Fatalf("expected no badge evaluation after repo failure, got %d calls", participationService.evaluateBadgesCallCount)
	}
	if badgeEvaluator.callCount != 0 {
		t.Fatalf("expected no host badge evaluation after repo failure, got %d calls", badgeEvaluator.callCount)
	}
}

func leaveableEvent(hostID uuid.UUID) *domain.Event {
	start := time.Now().UTC().Add(time.Hour)
	end := start.Add(2 * time.Hour)
	return &domain.Event{
		ID:           uuid.New(),
		HostID:       hostID,
		PrivacyLevel: domain.PrivacyPublic,
		Status:       domain.EventStatusActive,
		StartTime:    start,
		EndTime:      &end,
	}
}

func TestJoinEventSuccessReturnsApproved(t *testing.T) {
	hostID := uuid.New()
	joinerID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, participationService, _ := newTestEventServiceWithEvent(ev)

	result, err := svc.JoinEvent(context.Background(), joinerID, ev.ID)

	if err != nil {
		t.Fatalf("JoinEvent() error = %v", err)
	}
	if result.Status != domain.ParticipationStatusApproved {
		t.Fatalf("expected status APPROVED, got %q", result.Status)
	}
	if participationService.callCount != 1 {
		t.Fatalf("expected participation service to be called once")
	}
	if participationService.lastEventID != ev.ID || participationService.lastUserID != joinerID {
		t.Fatalf("expected participation service to receive event %s and user %s", ev.ID, joinerID)
	}
}

func TestJoinEventCreatesActiveTicketForPublicEvent(t *testing.T) {
	hostID := uuid.New()
	joinerID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, participationService, _, ticketService := newTestEventServiceWithEventAndTickets(ev)

	result, err := svc.JoinEvent(context.Background(), joinerID, ev.ID)

	if err != nil {
		t.Fatalf("JoinEvent() error = %v", err)
	}
	if ticketService.createCallCount != 1 {
		t.Fatalf("expected ticket creation once, got %d", ticketService.createCallCount)
	}
	if ticketService.lastCreatedStatus != domain.TicketStatusActive {
		t.Fatalf("expected ACTIVE ticket status, got %q", ticketService.lastCreatedStatus)
	}
	if ticketService.lastCreatedParticipation == nil {
		t.Fatal("expected participation to be forwarded to ticket service")
	}
	if ticketService.lastCreatedParticipation.ID != uuid.MustParse(result.ParticipationID) {
		t.Fatalf("expected ticket participation %s, got %s", result.ParticipationID, ticketService.lastCreatedParticipation.ID)
	}
	if participationService.callCount != 1 {
		t.Fatalf("expected participation service to be called once")
	}
}

func TestJoinEventRollsBackUnitOfWorkWhenTicketCreationFails(t *testing.T) {
	hostID := uuid.New()
	joinerID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, participationService, _, ticketService := newTestEventServiceWithEventAndTickets(ev)
	ticketService.err = errors.New("ticket create failed")

	_, err := svc.JoinEvent(context.Background(), joinerID, ev.ID)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	uow := svc.unitOfWork.(*fakeUnitOfWork)
	if uow.rollbackCount != 1 || uow.commitCount != 0 {
		t.Fatalf("expected rollback without commit, got rollbacks=%d commits=%d", uow.rollbackCount, uow.commitCount)
	}
	if participationService.callCount != 1 {
		t.Fatalf("expected participation service to be called once before ticket creation failure")
	}
}

func TestJoinEventRejectsNonExistentEvent(t *testing.T) {
	svc, _, _, _ := newTestEventService()

	_, err := svc.JoinEvent(context.Background(), uuid.New(), uuid.New())

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeEventNotFound {
		t.Fatalf("expected event_not_found, got %v", err)
	}
}

func TestJoinEventRejectsHost(t *testing.T) {
	hostID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	_, err := svc.JoinEvent(context.Background(), hostID, ev.ID)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeHostCannotJoin {
		t.Fatalf("expected host_cannot_join, got %v", err)
	}
}

func TestJoinEventRejectsProtectedEvent(t *testing.T) {
	hostID := uuid.New()
	ev := protectedEvent(hostID)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	_, err := svc.JoinEvent(context.Background(), uuid.New(), ev.ID)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeEventJoinNotAllowed {
		t.Fatalf("expected event_join_not_allowed, got %v", err)
	}
}

func TestJoinEventRejectsFullCapacity(t *testing.T) {
	hostID := uuid.New()
	ev := publicEventWithCapacity(hostID, 10, 10)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	_, err := svc.JoinEvent(context.Background(), uuid.New(), ev.ID)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeCapacityExceeded {
		t.Fatalf("expected capacity_exceeded, got %v", err)
	}
}

func TestJoinEventAllowsWhenUnderCapacity(t *testing.T) {
	hostID := uuid.New()
	ev := publicEventWithCapacity(hostID, 10, 9)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	result, err := svc.JoinEvent(context.Background(), uuid.New(), ev.ID)

	if err != nil {
		t.Fatalf("JoinEvent() error = %v", err)
	}
	if result.Status != domain.ParticipationStatusApproved {
		t.Fatalf("expected status APPROVED, got %q", result.Status)
	}
}

func TestJoinEventRejectsUnderageUser(t *testing.T) {
	hostID := uuid.New()
	joinerID := uuid.New()
	ev := publicEvent(hostID)
	ev.MinimumAge = ptrInt(18)
	svc, repo, _, _ := newTestEventServiceWithEvent(ev)
	repo.requesters[joinerID] = &domain.User{
		ID:        joinerID,
		BirthDate: ptrTime(time.Date(2015, 1, 1, 0, 0, 0, 0, time.UTC)),
	}

	_, err := svc.JoinEvent(context.Background(), joinerID, ev.ID)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeAgeRequirementNotMet {
		t.Fatalf("expected age_requirement_not_met, got %v", err)
	}
}

func TestJoinEventRejectsMismatchedGender(t *testing.T) {
	hostID := uuid.New()
	joinerID := uuid.New()
	ev := publicEvent(hostID)
	ev.PreferredGender = ptrGender(domain.GenderFemale)
	svc, repo, _, _ := newTestEventServiceWithEvent(ev)
	repo.requesters[joinerID] = &domain.User{
		ID:     joinerID,
		Gender: ptrString(string(domain.GenderMale)),
	}

	_, err := svc.JoinEvent(context.Background(), joinerID, ev.ID)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeGenderRequirementNotMet {
		t.Fatalf("expected gender_requirement_not_met, got %v", err)
	}
}

func TestJoinEventRejectsMissingBirthDateWhenAgeRestricted(t *testing.T) {
	hostID := uuid.New()
	joinerID := uuid.New()
	ev := publicEvent(hostID)
	ev.MinimumAge = ptrInt(18)
	svc, repo, _, _ := newTestEventServiceWithEvent(ev)
	repo.requesters[joinerID] = &domain.User{ID: joinerID}

	_, err := svc.JoinEvent(context.Background(), joinerID, ev.ID)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeProfileIncomplete {
		t.Fatalf("expected profile_incomplete, got %v", err)
	}
}

func TestLeaveEventSuccessReturnsLeaved(t *testing.T) {
	hostID := uuid.New()
	participantID := uuid.New()
	ev := leaveableEvent(hostID)
	svc, _, participationService, _ := newTestEventServiceWithEvent(ev)

	result, err := svc.LeaveEvent(context.Background(), participantID, ev.ID)

	if err != nil {
		t.Fatalf("LeaveEvent() error = %v", err)
	}
	if result.Status != domain.ParticipationStatusLeaved {
		t.Fatalf("expected status %q, got %q", domain.ParticipationStatusLeaved, result.Status)
	}
	if participationService.leaveCallCount != 1 {
		t.Fatalf("expected leave participation service to be called once")
	}
	if participationService.lastLeaveEventID != ev.ID || participationService.lastLeaveUserID != participantID {
		t.Fatalf("expected leave participation service to receive event %s and user %s", ev.ID, participantID)
	}
}

func TestLeaveEventCancelsLinkedTicket(t *testing.T) {
	hostID := uuid.New()
	participantID := uuid.New()
	ev := leaveableEvent(hostID)
	svc, _, participationService, _, ticketService := newTestEventServiceWithEventAndTickets(ev)

	result, err := svc.LeaveEvent(context.Background(), participantID, ev.ID)

	if err != nil {
		t.Fatalf("LeaveEvent() error = %v", err)
	}
	if ticketService.cancelParticipationCallCount != 1 {
		t.Fatalf("expected ticket cancellation once, got %d", ticketService.cancelParticipationCallCount)
	}
	if ticketService.lastParticipationID != uuid.MustParse(result.ParticipationID) {
		t.Fatalf("expected ticket cancellation for participation %s, got %s", result.ParticipationID, ticketService.lastParticipationID)
	}
	if participationService.leaveCallCount != 1 {
		t.Fatalf("expected leave participation service to be called once")
	}
}

func TestLeaveEventRejectsHost(t *testing.T) {
	hostID := uuid.New()
	ev := leaveableEvent(hostID)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	_, err := svc.LeaveEvent(context.Background(), hostID, ev.ID)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeHostCannotLeave {
		t.Fatalf("expected host_cannot_leave, got %v", err)
	}
}

func TestLeaveEventRejectsEndedEvent(t *testing.T) {
	hostID := uuid.New()
	participantID := uuid.New()
	end := time.Now().UTC().Add(-time.Minute)
	ev := &domain.Event{
		ID:           uuid.New(),
		HostID:       hostID,
		PrivacyLevel: domain.PrivacyPublic,
		Status:       domain.EventStatusActive,
		StartTime:    end.Add(-2 * time.Hour),
		EndTime:      &end,
	}
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	_, err := svc.LeaveEvent(context.Background(), participantID, ev.ID)

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeEventNotLeaveable {
		t.Fatalf("expected event_not_leaveable, got %v", err)
	}
}

func TestRequestJoinSuccessReturnsPending(t *testing.T) {
	hostID := uuid.New()
	requesterID := uuid.New()
	ev := protectedEvent(hostID)
	svc, _, _, joinRequestService := newTestEventServiceWithEvent(ev)
	message := "I would like to attend."

	result, err := svc.RequestJoin(context.Background(), requesterID, ev.ID, RequestJoinInput{
		Message: &message,
	})

	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}
	if result.Status != string(domain.JoinRequestStatusPending) {
		t.Fatalf("expected status PENDING, got %q", result.Status)
	}
	if joinRequestService.callCount != 1 {
		t.Fatalf("expected join request service to be called once")
	}
	if joinRequestService.lastEventID != ev.ID || joinRequestService.lastUserID != requesterID || joinRequestService.lastHostUserID != hostID {
		t.Fatalf("expected join request service to receive event %s, user %s, and host %s", ev.ID, requesterID, hostID)
	}
	if joinRequestService.lastInput.Message == nil || *joinRequestService.lastInput.Message != message {
		t.Fatalf("expected join request service to receive message %q, got %v", message, joinRequestService.lastInput.Message)
	}
}

func TestRequestJoinWithImageTokenConfirmsAndStoresImageURL(t *testing.T) {
	// given
	hostID := uuid.New()
	requesterID := uuid.New()
	ev := protectedEvent(hostID)
	svc, _, _, joinRequestService := newTestEventServiceWithEvent(ev)
	confirmer := &fakeJoinRequestImageConfirmer{baseURL: "https://cdn.example/join-request.jpg"}
	svc.SetJoinRequestImageConfirmer(confirmer)
	token := "confirm-token"

	// when
	result, err := svc.RequestJoin(context.Background(), requesterID, ev.ID, RequestJoinInput{
		ImageConfirmToken: &token,
	})

	// then
	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}
	if confirmer.callCount != 1 {
		t.Fatalf("expected image confirmer to be called once, got %d", confirmer.callCount)
	}
	if confirmer.lastUserID != requesterID || confirmer.lastEventID != ev.ID || confirmer.lastConfirmToken != token {
		t.Fatalf("unexpected image confirmer input: user=%s event=%s token=%q", confirmer.lastUserID, confirmer.lastEventID, confirmer.lastConfirmToken)
	}
	if joinRequestService.lastInput.ImageURL == nil || *joinRequestService.lastInput.ImageURL != confirmer.baseURL {
		t.Fatalf("expected join request image URL %q, got %v", confirmer.baseURL, joinRequestService.lastInput.ImageURL)
	}
	if result.ImageURL == nil || *result.ImageURL != confirmer.baseURL {
		t.Fatalf("expected response image URL %q, got %v", confirmer.baseURL, result.ImageURL)
	}
}

func TestRequestJoinWithoutImageTokenDoesNotConfirmImage(t *testing.T) {
	// given
	hostID := uuid.New()
	requesterID := uuid.New()
	ev := protectedEvent(hostID)
	svc, _, _, joinRequestService := newTestEventServiceWithEvent(ev)
	confirmer := &fakeJoinRequestImageConfirmer{baseURL: "https://cdn.example/join-request.jpg"}
	svc.SetJoinRequestImageConfirmer(confirmer)

	// when
	_, err := svc.RequestJoin(context.Background(), requesterID, ev.ID, RequestJoinInput{})

	// then
	if err != nil {
		t.Fatalf("RequestJoin() error = %v", err)
	}
	if confirmer.callCount != 0 {
		t.Fatalf("expected image confirmer not to be called, got %d", confirmer.callCount)
	}
	if joinRequestService.lastInput.ImageURL != nil {
		t.Fatalf("expected no join request image URL, got %v", joinRequestService.lastInput.ImageURL)
	}
}

func TestRequestJoinRejectsHost(t *testing.T) {
	hostID := uuid.New()
	ev := protectedEvent(hostID)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	_, err := svc.RequestJoin(context.Background(), hostID, ev.ID, RequestJoinInput{})

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeHostCannotJoin {
		t.Fatalf("expected host_cannot_join, got %v", err)
	}
}

func TestRequestJoinRejectsPublicEvent(t *testing.T) {
	hostID := uuid.New()
	ev := publicEvent(hostID)
	svc, _, _, _ := newTestEventServiceWithEvent(ev)

	_, err := svc.RequestJoin(context.Background(), uuid.New(), ev.ID, RequestJoinInput{})

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeEventJoinNotAllowed {
		t.Fatalf("expected event_join_not_allowed, got %v", err)
	}
}

func TestRequestJoinRejectsUnderageUser(t *testing.T) {
	hostID := uuid.New()
	joinerID := uuid.New()
	ev := protectedEvent(hostID)
	ev.MinimumAge = ptrInt(18)
	svc, repo, _, _ := newTestEventServiceWithEvent(ev)
	repo.requesters[joinerID] = &domain.User{
		ID:        joinerID,
		BirthDate: ptrTime(time.Date(2015, 1, 1, 0, 0, 0, 0, time.UTC)),
	}

	_, err := svc.RequestJoin(context.Background(), joinerID, ev.ID, RequestJoinInput{})

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeAgeRequirementNotMet {
		t.Fatalf("expected age_requirement_not_met, got %v", err)
	}
}

func TestRequestJoinRejectsMismatchedGender(t *testing.T) {
	hostID := uuid.New()
	joinerID := uuid.New()
	ev := protectedEvent(hostID)
	ev.PreferredGender = ptrGender(domain.GenderFemale)
	svc, repo, _, _ := newTestEventServiceWithEvent(ev)
	repo.requesters[joinerID] = &domain.User{
		ID:     joinerID,
		Gender: ptrString(string(domain.GenderMale)),
	}

	_, err := svc.RequestJoin(context.Background(), joinerID, ev.ID, RequestJoinInput{})

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if appErr, ok := errors.AsType[*domain.AppError](err); !ok || appErr.Code != domain.ErrorCodeGenderRequirementNotMet {
		t.Fatalf("expected gender_requirement_not_met, got %v", err)
	}
}

func TestApproveJoinRequestDelegatesToJoinRequestService(t *testing.T) {
	hostID := uuid.New()
	ev := protectedEvent(hostID)
	joinRequestID := uuid.New()
	svc, _, _, joinRequestService := newTestEventServiceWithEvent(ev)

	result, err := svc.ApproveJoinRequest(context.Background(), hostID, ev.ID, joinRequestID)

	if err != nil {
		t.Fatalf("ApproveJoinRequest() error = %v", err)
	}
	if result.JoinRequestStatus != string(domain.JoinRequestStatusApproved) {
		t.Fatalf("expected join request status APPROVED, got %q", result.JoinRequestStatus)
	}
	if result.ParticipationStatus != domain.ParticipationStatusApproved {
		t.Fatalf("expected participation status APPROVED, got %q", result.ParticipationStatus)
	}
	if joinRequestService.approveCallCount != 1 {
		t.Fatalf("expected approve join request service to be called once")
	}
	if joinRequestService.lastEventID != ev.ID || joinRequestService.lastJoinRequestID != joinRequestID || joinRequestService.lastHostUserID != hostID {
		t.Fatalf("expected approve join request service to receive event %s, join request %s, and host %s", ev.ID, joinRequestID, hostID)
	}
}

func TestRejectJoinRequestDelegatesToJoinRequestService(t *testing.T) {
	hostID := uuid.New()
	ev := protectedEvent(hostID)
	joinRequestID := uuid.New()
	svc, _, _, joinRequestService := newTestEventServiceWithEvent(ev)

	result, err := svc.RejectJoinRequest(context.Background(), hostID, ev.ID, joinRequestID)

	if err != nil {
		t.Fatalf("RejectJoinRequest() error = %v", err)
	}
	if result.Status != string(domain.JoinRequestStatusRejected) {
		t.Fatalf("expected join request status REJECTED, got %q", result.Status)
	}
	if !result.CooldownEndsAt.After(result.UpdatedAt) {
		t.Fatalf("expected cooldown_ends_at %v to be after updated_at %v", result.CooldownEndsAt, result.UpdatedAt)
	}
	if joinRequestService.rejectCallCount != 1 {
		t.Fatalf("expected reject join request service to be called once")
	}
	if joinRequestService.lastEventID != ev.ID || joinRequestService.lastJoinRequestID != joinRequestID || joinRequestService.lastHostUserID != hostID {
		t.Fatalf("expected reject join request service to receive event %s, join request %s, and host %s", ev.ID, joinRequestID, hostID)
	}
}

func stringPtr(v string) *string { return &v }

func timePtr(v time.Time) *time.Time { return &v }

func intPtr(v int) *int { return &v }

func ptrParticipationStatus(v domain.ParticipationStatus) *domain.ParticipationStatus { return &v }

func floatPtr(v float64) *float64 { return &v }
