package join_request

import (
	"context"
	"errors"
	"testing"
	"time"

	notificationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/notification"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type fakeUnitOfWork struct{}

func (u *fakeUnitOfWork) RunInTx(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}

type fakeTicketLifecycle struct {
	createCallCount   int
	lastParticipation *domain.Participation
	lastStatus        domain.TicketStatus
	err               error
}

func (f *fakeTicketLifecycle) CreateTicketForParticipation(_ context.Context, participation *domain.Participation, status domain.TicketStatus) (*domain.Ticket, error) {
	f.createCallCount++
	f.lastParticipation = participation
	f.lastStatus = status
	if f.err != nil {
		return nil, f.err
	}
	return &domain.Ticket{ID: uuid.New(), ParticipationID: participation.ID, Status: status}, nil
}

func (f *fakeTicketLifecycle) CancelTicketForParticipation(context.Context, uuid.UUID) error {
	return nil
}

func (f *fakeTicketLifecycle) CancelTicketsForEvent(context.Context, uuid.UUID) error {
	return nil
}

func (f *fakeTicketLifecycle) ExpireTicketsForEvent(context.Context, uuid.UUID) error {
	return nil
}

type fakeJoinRequestRepo struct {
	err               error
	callCount         int
	approveCallCount  int
	rejectCallCount   int
	lastParams        CreateJoinRequestParams
	lastApproveParams ApproveJoinRequestParams
	lastRejectParams  RejectJoinRequestParams
	result            *domain.JoinRequest
	approveResult     *ApproveJoinRequestResult
	rejectResult      *RejectJoinRequestResult
	notificationCtx   *NotificationContext
}

func (r *fakeJoinRequestRepo) CreateJoinRequest(_ context.Context, params CreateJoinRequestParams) (*domain.JoinRequest, error) {
	r.callCount++
	r.lastParams = params

	if r.err != nil {
		return nil, r.err
	}
	if r.result != nil {
		return r.result, nil
	}

	now := time.Now().UTC()
	return &domain.JoinRequest{
		ID:         uuid.New(),
		EventID:    params.EventID,
		UserID:     params.UserID,
		HostUserID: params.HostUserID,
		Status:     domain.JoinRequestStatusPending,
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}

func (r *fakeJoinRequestRepo) ApproveJoinRequest(_ context.Context, params ApproveJoinRequestParams) (*ApproveJoinRequestResult, error) {
	r.approveCallCount++
	r.lastApproveParams = params

	if r.err != nil {
		return nil, r.err
	}
	if r.approveResult != nil {
		return r.approveResult, nil
	}

	now := time.Now().UTC()
	participationID := uuid.New()
	return &ApproveJoinRequestResult{
		JoinRequest: &domain.JoinRequest{
			ID:              params.JoinRequestID,
			EventID:         params.EventID,
			UserID:          uuid.New(),
			ParticipationID: &participationID,
			HostUserID:      params.HostUserID,
			Status:          domain.JoinRequestStatusApproved,
			CreatedAt:       now.Add(-time.Hour),
			UpdatedAt:       now,
		},
		Participation: &domain.Participation{
			ID:        participationID,
			EventID:   params.EventID,
			UserID:    uuid.New(),
			Status:    domain.ParticipationStatusApproved,
			CreatedAt: now,
			UpdatedAt: now,
		},
	}, nil
}

func (r *fakeJoinRequestRepo) RejectJoinRequest(_ context.Context, params RejectJoinRequestParams) (*RejectJoinRequestResult, error) {
	r.rejectCallCount++
	r.lastRejectParams = params

	if r.err != nil {
		return nil, r.err
	}
	if r.rejectResult != nil {
		return r.rejectResult, nil
	}

	now := time.Now().UTC()
	return &RejectJoinRequestResult{
		JoinRequest: &domain.JoinRequest{
			ID:         params.JoinRequestID,
			EventID:    params.EventID,
			UserID:     uuid.New(),
			HostUserID: params.HostUserID,
			Status:     domain.JoinRequestStatusRejected,
			CreatedAt:  now.Add(-time.Hour),
			UpdatedAt:  now,
		},
		CooldownEndsAt: now.Add(domain.JoinRequestCooldown),
	}, nil
}

func (r *fakeJoinRequestRepo) GetNotificationContext(context.Context, uuid.UUID) (*NotificationContext, error) {
	if r.notificationCtx == nil {
		return nil, domain.ErrNotFound
	}
	return r.notificationCtx, nil
}

func TestCreatePendingJoinRequestDelegatesToRepo(t *testing.T) {
	// given
	repo := &fakeJoinRequestRepo{}
	service := NewService(repo, &fakeUnitOfWork{})
	eventID := uuid.New()
	userID := uuid.New()
	hostUserID := uuid.New()
	message := "Please let me join."

	// when
	result, err := service.CreatePendingJoinRequest(context.Background(), eventID, userID, hostUserID, CreatePendingJoinRequestInput{
		Message: &message,
	})

	// then
	if err != nil {
		t.Fatalf("CreatePendingJoinRequest() error = %v", err)
	}
	if result == nil {
		t.Fatal("expected join request result, got nil")
	}
	if repo.callCount != 1 {
		t.Fatalf("expected repo to be called once, got %d", repo.callCount)
	}
	if repo.lastParams.EventID != eventID || repo.lastParams.UserID != userID || repo.lastParams.HostUserID != hostUserID {
		t.Fatalf("expected repo params to match event %s, user %s, host %s", eventID, userID, hostUserID)
	}
	if repo.lastParams.Message == nil || *repo.lastParams.Message != message {
		t.Fatalf("expected repo message %q, got %v", message, repo.lastParams.Message)
	}
}

func TestCreatePendingJoinRequestPropagatesRepoError(t *testing.T) {
	// given
	expectedErr := errors.New("boom")
	repo := &fakeJoinRequestRepo{err: expectedErr}
	service := NewService(repo, &fakeUnitOfWork{})

	// when
	_, err := service.CreatePendingJoinRequest(context.Background(), uuid.New(), uuid.New(), uuid.New(), CreatePendingJoinRequestInput{})

	// then
	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected error %v, got %v", expectedErr, err)
	}
}

func TestApproveJoinRequestDelegatesToRepo(t *testing.T) {
	// given
	repo := &fakeJoinRequestRepo{}
	service := NewService(repo, &fakeUnitOfWork{})
	eventID := uuid.New()
	joinRequestID := uuid.New()
	hostUserID := uuid.New()

	// when
	result, err := service.ApproveJoinRequest(context.Background(), eventID, joinRequestID, hostUserID)

	// then
	if err != nil {
		t.Fatalf("ApproveJoinRequest() error = %v", err)
	}
	if result == nil || result.JoinRequest == nil || result.Participation == nil {
		t.Fatal("expected approval result with join request and participation")
	}
	if repo.approveCallCount != 1 {
		t.Fatalf("expected approve repo to be called once, got %d", repo.approveCallCount)
	}
	if repo.lastApproveParams.EventID != eventID || repo.lastApproveParams.JoinRequestID != joinRequestID || repo.lastApproveParams.HostUserID != hostUserID {
		t.Fatalf("expected approve params to match event %s, join request %s, host %s", eventID, joinRequestID, hostUserID)
	}
}

func TestApproveJoinRequestCreatesActiveTicket(t *testing.T) {
	// given
	repo := &fakeJoinRequestRepo{}
	tickets := &fakeTicketLifecycle{}
	service := NewService(repo, &fakeUnitOfWork{}, tickets)
	eventID := uuid.New()
	joinRequestID := uuid.New()
	hostUserID := uuid.New()

	// when
	result, err := service.ApproveJoinRequest(context.Background(), eventID, joinRequestID, hostUserID)

	// then
	if err != nil {
		t.Fatalf("ApproveJoinRequest() error = %v", err)
	}
	if tickets.createCallCount != 1 {
		t.Fatalf("expected ticket creation once, got %d", tickets.createCallCount)
	}
	if tickets.lastParticipation == nil || tickets.lastParticipation.ID != result.Participation.ID {
		t.Fatalf("expected ticket participation %s, got %+v", result.Participation.ID, tickets.lastParticipation)
	}
	if tickets.lastStatus != domain.TicketStatusActive {
		t.Fatalf("expected ticket status ACTIVE, got %q", tickets.lastStatus)
	}
}

func TestRejectJoinRequestDelegatesToRepo(t *testing.T) {
	// given
	repo := &fakeJoinRequestRepo{}
	service := NewService(repo, &fakeUnitOfWork{})
	eventID := uuid.New()
	joinRequestID := uuid.New()
	hostUserID := uuid.New()

	// when
	result, err := service.RejectJoinRequest(context.Background(), eventID, joinRequestID, hostUserID)

	// then
	if err != nil {
		t.Fatalf("RejectJoinRequest() error = %v", err)
	}
	if result == nil || result.JoinRequest == nil {
		t.Fatal("expected reject result with join request")
	}
	if repo.rejectCallCount != 1 {
		t.Fatalf("expected reject repo to be called once, got %d", repo.rejectCallCount)
	}
	if repo.lastRejectParams.EventID != eventID || repo.lastRejectParams.JoinRequestID != joinRequestID || repo.lastRejectParams.HostUserID != hostUserID {
		t.Fatalf("expected reject params to match event %s, join request %s, host %s", eventID, joinRequestID, hostUserID)
	}
}

func TestApproveJoinRequestNotifiesRequester(t *testing.T) {
	// given
	eventID := uuid.New()
	joinRequestID := uuid.New()
	hostUserID := uuid.New()
	requesterID := uuid.New()
	participationID := uuid.New()
	imageURL := "https://cdn.example.com/event.jpg"
	now := time.Now().UTC()
	repo := &fakeJoinRequestRepo{
		approveResult: &ApproveJoinRequestResult{
			JoinRequest: &domain.JoinRequest{
				ID:              joinRequestID,
				EventID:         eventID,
				UserID:          requesterID,
				ParticipationID: &participationID,
				HostUserID:      hostUserID,
				Status:          domain.JoinRequestStatusApproved,
				UpdatedAt:       now,
			},
			Participation: &domain.Participation{ID: participationID, EventID: eventID, UserID: requesterID, Status: domain.ParticipationStatusApproved},
		},
		notificationCtx: &NotificationContext{
			JoinRequestID:     joinRequestID,
			EventID:           eventID,
			EventTitle:        "Trail Run",
			EventImageURL:     &imageURL,
			EventStartTime:    now,
			HostUserID:        hostUserID,
			HostUsername:      "host",
			RequesterUserID:   requesterID,
			RequesterUsername: "guest",
		},
	}
	notifications := &fakeNotificationUseCase{}
	service := NewService(repo, &fakeUnitOfWork{})
	service.SetNotificationService(notifications)

	// when
	_, err := service.ApproveJoinRequest(context.Background(), eventID, joinRequestID, hostUserID)

	// then
	if err != nil {
		t.Fatalf("ApproveJoinRequest() error = %v", err)
	}
	if len(notifications.inputs) != 1 {
		t.Fatalf("expected one notification, got %d", len(notifications.inputs))
	}
	input := notifications.inputs[0]
	if input.UserIDs[0] != requesterID || input.EventID == nil || *input.EventID != eventID {
		t.Fatalf("unexpected notification target/event %#v", input)
	}
	if input.ImageURL == nil || *input.ImageURL != imageURL {
		t.Fatalf("expected event image URL, got %#v", input.ImageURL)
	}
	if input.Type == nil || *input.Type != "PROTECTED_EVENT_JOIN_REQUEST_APPROVED" {
		t.Fatalf("unexpected notification type %#v", input.Type)
	}
	if input.IdempotencyKey != "JOIN_REQUEST_APPROVED:"+joinRequestID.String() {
		t.Fatalf("unexpected idempotency key %q", input.IdempotencyKey)
	}
}

func TestRejectJoinRequestNotifiesRequesterWithoutFailingAction(t *testing.T) {
	// given
	eventID := uuid.New()
	joinRequestID := uuid.New()
	hostUserID := uuid.New()
	requesterID := uuid.New()
	now := time.Now().UTC()
	cooldownEndsAt := now.Add(domain.JoinRequestCooldown)
	repo := &fakeJoinRequestRepo{
		rejectResult: &RejectJoinRequestResult{
			JoinRequest:    &domain.JoinRequest{ID: joinRequestID, EventID: eventID, UserID: requesterID, HostUserID: hostUserID, Status: domain.JoinRequestStatusRejected, UpdatedAt: now},
			CooldownEndsAt: cooldownEndsAt,
		},
		notificationCtx: &NotificationContext{
			JoinRequestID:     joinRequestID,
			EventID:           eventID,
			EventTitle:        "Trail Run",
			EventStartTime:    now,
			HostUserID:        hostUserID,
			HostUsername:      "host",
			RequesterUserID:   requesterID,
			RequesterUsername: "guest",
		},
	}
	notifications := &fakeNotificationUseCase{err: errors.New("send failed")}
	service := NewService(repo, &fakeUnitOfWork{})
	service.SetNotificationService(notifications)

	// when
	result, err := service.RejectJoinRequest(context.Background(), eventID, joinRequestID, hostUserID)

	// then
	if err != nil {
		t.Fatalf("RejectJoinRequest() error = %v", err)
	}
	if !result.CooldownEndsAt.Equal(cooldownEndsAt) {
		t.Fatalf("unexpected cooldown %s", result.CooldownEndsAt)
	}
	if len(notifications.inputs) != 1 {
		t.Fatalf("expected one notification attempt, got %d", len(notifications.inputs))
	}
	input := notifications.inputs[0]
	if input.Type == nil || *input.Type != "PROTECTED_EVENT_JOIN_REQUEST_REJECTED" {
		t.Fatalf("unexpected notification type %#v", input.Type)
	}
	if input.Data["status"] != string(domain.JoinRequestStatusRejected) || input.Data["cooldown_ends_at"] == "" {
		t.Fatalf("unexpected notification data %#v", input.Data)
	}
}

type fakeNotificationUseCase struct {
	inputs []notificationapp.SendNotificationInput
	err    error
}

func (f *fakeNotificationUseCase) RegisterDevice(context.Context, notificationapp.RegisterDeviceInput) (*notificationapp.RegisterDeviceResult, error) {
	return nil, nil
}
func (f *fakeNotificationUseCase) UnregisterDevice(context.Context, uuid.UUID, uuid.UUID) error {
	return nil
}
func (f *fakeNotificationUseCase) ListNotifications(context.Context, notificationapp.ListNotificationsInput) (*notificationapp.ListNotificationsResult, error) {
	return nil, nil
}
func (f *fakeNotificationUseCase) CountUnreadNotifications(context.Context, uuid.UUID) (*notificationapp.UnreadCountResult, error) {
	return nil, nil
}
func (f *fakeNotificationUseCase) MarkNotificationRead(context.Context, uuid.UUID, uuid.UUID) error {
	return nil
}
func (f *fakeNotificationUseCase) MarkAllNotificationsRead(context.Context, uuid.UUID) (*notificationapp.MarkAllReadResult, error) {
	return nil, nil
}
func (f *fakeNotificationUseCase) DeleteNotification(context.Context, uuid.UUID, uuid.UUID) error {
	return nil
}
func (f *fakeNotificationUseCase) DeleteAllNotifications(context.Context, uuid.UUID) error {
	return nil
}
func (f *fakeNotificationUseCase) DeleteExpiredNotifications(context.Context) (int, error) {
	return 0, nil
}
func (f *fakeNotificationUseCase) SendNotificationToUsers(_ context.Context, input notificationapp.SendNotificationInput) (*notificationapp.SendNotificationResult, error) {
	f.inputs = append(f.inputs, input)
	if f.err != nil {
		return nil, f.err
	}
	return &notificationapp.SendNotificationResult{TargetUserCount: len(input.UserIDs), CreatedCount: len(input.UserIDs)}, nil
}
func (f *fakeNotificationUseCase) SendCustomNotificationToUsers(context.Context, notificationapp.SendCustomNotificationInput) (*notificationapp.SendNotificationResult, error) {
	return nil, nil
}
func (f *fakeNotificationUseCase) SendPushToUsers(context.Context, notificationapp.SendPushInput) (*notificationapp.SendPushResult, error) {
	return nil, nil
}
