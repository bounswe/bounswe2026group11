package invitation

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

func (u fakeUnitOfWork) RunInTx(ctx context.Context, fn func(context.Context) error) error {
	return fn(ctx)
}

type fakeRepo struct {
	lastParams    CreateInvitationsParams
	result        *CreateInvitationsRecord
	acceptResult  *AcceptInvitationRecord
	declineResult *domain.Invitation
	contexts      map[uuid.UUID]*InvitationNotificationContext
}

func (r *fakeRepo) CreateInvitations(_ context.Context, params CreateInvitationsParams) (*CreateInvitationsRecord, error) {
	r.lastParams = params
	if r.result != nil {
		return r.result, nil
	}
	return &CreateInvitationsRecord{}, nil
}

func (r *fakeRepo) ListReceivedPendingInvitations(context.Context, uuid.UUID) ([]ReceivedInvitationRecord, error) {
	return nil, nil
}

func (r *fakeRepo) AcceptInvitation(context.Context, uuid.UUID, uuid.UUID) (*AcceptInvitationRecord, error) {
	return r.acceptResult, nil
}

func (r *fakeRepo) DeclineInvitation(context.Context, uuid.UUID, uuid.UUID) (*domain.Invitation, error) {
	return r.declineResult, nil
}

func (r *fakeRepo) GetInvitationNotificationContext(_ context.Context, invitationID uuid.UUID) (*InvitationNotificationContext, error) {
	if r.contexts == nil {
		return nil, domain.ErrNotFound
	}
	return r.contexts[invitationID], nil
}

func TestCreateInvitationsValidatesUsernameCount(t *testing.T) {
	service := NewService(&fakeRepo{}, fakeUnitOfWork{})

	if _, err := service.CreateInvitations(context.Background(), uuid.New(), uuid.New(), CreateInvitationsInput{}); err == nil {
		t.Fatal("expected validation error for empty username list")
	}

	usernames := make([]string, 101)
	for i := range usernames {
		usernames[i] = "user_name"
	}
	if _, err := service.CreateInvitations(context.Background(), uuid.New(), uuid.New(), CreateInvitationsInput{Usernames: usernames}); err == nil {
		t.Fatal("expected validation error for more than 100 usernames")
	}
}

func TestCreateInvitationsNotifiesSuccessfulInvitedUsers(t *testing.T) {
	// given
	eventID := uuid.New()
	hostID := uuid.New()
	invitedID := uuid.New()
	invitationID := uuid.New()
	imageURL := "https://cdn.example.com/event.jpg"
	startTime := time.Date(2026, 5, 2, 12, 0, 0, 0, time.UTC)
	repo := &fakeRepo{
		result: &CreateInvitationsRecord{
			SuccessfulInvitations: []CreatedInvitationRecord{{
				Username: "valid_user",
				Invitation: &domain.Invitation{
					ID:            invitationID,
					EventID:       eventID,
					HostID:        hostID,
					InvitedUserID: invitedID,
					Status:        domain.InvitationStatusPending,
					CreatedAt:     startTime,
				},
			}},
			Failed: []InvitationFailureRecord{{Username: "blocked_user", Code: FailureAlreadyInvited}},
		},
		contexts: map[uuid.UUID]*InvitationNotificationContext{
			invitationID: {
				InvitationID:    invitationID,
				EventID:         eventID,
				EventTitle:      "Trail Run",
				EventImageURL:   &imageURL,
				EventStartTime:  startTime,
				HostUserID:      hostID,
				HostUsername:    "host",
				InvitedUserID:   invitedID,
				InvitedUsername: "valid_user",
			},
		},
	}
	notifications := &fakeNotificationUseCase{}
	service := NewService(repo, fakeUnitOfWork{})
	service.SetNotificationService(notifications)

	// when
	_, err := service.CreateInvitations(context.Background(), hostID, eventID, CreateInvitationsInput{Usernames: []string{"valid_user", "blocked_user"}})

	// then
	if err != nil {
		t.Fatalf("CreateInvitations() error = %v", err)
	}
	if len(notifications.inputs) != 1 {
		t.Fatalf("expected one notification, got %d", len(notifications.inputs))
	}
	input := notifications.inputs[0]
	if input.UserIDs[0] != invitedID || input.EventID == nil || *input.EventID != eventID {
		t.Fatalf("unexpected notification target/event: %#v", input)
	}
	if input.ImageURL == nil || *input.ImageURL != imageURL {
		t.Fatalf("expected event image URL, got %#v", input.ImageURL)
	}
	if input.Type == nil || *input.Type != "PRIVATE_EVENT_INVITATION_RECEIVED" {
		t.Fatalf("unexpected notification type %#v", input.Type)
	}
	if input.Data["invitation_id"] != invitationID.String() || input.Data["actor_user_id"] != hostID.String() {
		t.Fatalf("unexpected notification data %#v", input.Data)
	}
}

func TestAcceptInvitationNotifiesHostWithoutFailingAction(t *testing.T) {
	// given
	eventID := uuid.New()
	hostID := uuid.New()
	invitedID := uuid.New()
	invitationID := uuid.New()
	participationID := uuid.New()
	imageURL := "https://cdn.example.com/event.jpg"
	now := time.Now().UTC()
	repo := &fakeRepo{
		acceptResult: &AcceptInvitationRecord{
			Invitation:    &domain.Invitation{ID: invitationID, EventID: eventID, HostID: hostID, InvitedUserID: invitedID, Status: domain.InvitationStatusAccepted, UpdatedAt: now},
			Participation: &domain.Participation{ID: participationID, EventID: eventID, UserID: invitedID, Status: domain.ParticipationStatusApproved},
		},
		contexts: map[uuid.UUID]*InvitationNotificationContext{
			invitationID: {
				InvitationID:    invitationID,
				EventID:         eventID,
				EventTitle:      "Trail Run",
				EventImageURL:   &imageURL,
				EventStartTime:  now,
				HostUserID:      hostID,
				HostUsername:    "host",
				InvitedUserID:   invitedID,
				InvitedUsername: "guest",
			},
		},
	}
	notifications := &fakeNotificationUseCase{err: errors.New("send failed")}
	service := NewService(repo, fakeUnitOfWork{})
	service.SetNotificationService(notifications)

	// when
	result, err := service.AcceptInvitation(context.Background(), invitedID, invitationID)

	// then
	if err != nil {
		t.Fatalf("AcceptInvitation() error = %v", err)
	}
	if result.InvitationID != invitationID.String() {
		t.Fatalf("unexpected result %#v", result)
	}
	if len(notifications.inputs) != 1 {
		t.Fatalf("expected one notification attempt, got %d", len(notifications.inputs))
	}
	input := notifications.inputs[0]
	if input.UserIDs[0] != hostID || input.Type == nil || *input.Type != "PRIVATE_EVENT_INVITATION_ACCEPTED" {
		t.Fatalf("unexpected notification input %#v", input)
	}
	if input.IdempotencyKey != "INVITATION_ACCEPTED:"+invitationID.String() {
		t.Fatalf("unexpected idempotency key %q", input.IdempotencyKey)
	}
}

func TestDeclineInvitationNotifiesHost(t *testing.T) {
	// given
	eventID := uuid.New()
	hostID := uuid.New()
	invitedID := uuid.New()
	invitationID := uuid.New()
	now := time.Now().UTC()
	repo := &fakeRepo{
		declineResult: &domain.Invitation{ID: invitationID, EventID: eventID, HostID: hostID, InvitedUserID: invitedID, Status: domain.InvitationStatusDeclined, UpdatedAt: now},
		contexts: map[uuid.UUID]*InvitationNotificationContext{
			invitationID: {
				InvitationID:    invitationID,
				EventID:         eventID,
				EventTitle:      "Trail Run",
				EventStartTime:  now,
				HostUserID:      hostID,
				HostUsername:    "host",
				InvitedUserID:   invitedID,
				InvitedUsername: "guest",
			},
		},
	}
	notifications := &fakeNotificationUseCase{}
	service := NewService(repo, fakeUnitOfWork{})
	service.SetNotificationService(notifications)

	// when
	_, err := service.DeclineInvitation(context.Background(), invitedID, invitationID)

	// then
	if err != nil {
		t.Fatalf("DeclineInvitation() error = %v", err)
	}
	if len(notifications.inputs) != 1 {
		t.Fatalf("expected one notification, got %d", len(notifications.inputs))
	}
	input := notifications.inputs[0]
	if input.UserIDs[0] != hostID || input.Type == nil || *input.Type != "PRIVATE_EVENT_INVITATION_DECLINED" {
		t.Fatalf("unexpected notification input %#v", input)
	}
	if input.Data["status"] != domain.InvitationStatusDeclined.String() {
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

func TestCreateInvitationsReturnsPartialCounts(t *testing.T) {
	invited := uuid.New()
	eventID := uuid.New()
	repo := &fakeRepo{
		result: &CreateInvitationsRecord{
			SuccessfulInvitations: []CreatedInvitationRecord{{
				Username: "valid_user",
				Invitation: &domain.Invitation{
					ID:            uuid.New(),
					EventID:       eventID,
					InvitedUserID: invited,
					Status:        domain.InvitationStatusPending,
					CreatedAt:     time.Now().UTC(),
				},
			}},
			InvalidUsernames: []string{"missing_user"},
			Failed: []InvitationFailureRecord{{
				Username: "blocked_user",
				Code:     FailureDeclineCooldown,
			}},
		},
	}
	service := NewService(repo, fakeUnitOfWork{})

	result, err := service.CreateInvitations(context.Background(), uuid.New(), eventID, CreateInvitationsInput{
		Usernames: []string{"valid_user", "missing_user", "blocked_user"},
	})
	if err != nil {
		t.Fatalf("CreateInvitations() error = %v", err)
	}
	if result.SuccessCount != 1 || result.InvalidUsernameCount != 1 || result.FailedCount != 1 {
		t.Fatalf("unexpected counts: %+v", result)
	}
	if result.Failed[0].Code != FailureDeclineCooldown {
		t.Fatalf("expected failure code %q, got %q", FailureDeclineCooldown, result.Failed[0].Code)
	}
}
