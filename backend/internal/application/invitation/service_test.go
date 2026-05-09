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
	lastParams       CreateInvitationsParams
	result           *CreateInvitationsRecord
	acceptResult     *AcceptInvitationRecord
	declineResult    *domain.Invitation
	contexts         map[uuid.UUID]*InvitationNotificationContext
	revokeCallCount  int
	lastRevokeParams RevokeInvitationParams
	revokeErr        error
	// pending and past hold canned responses for the receive-list paths.
	// past returns up to FetchLimit rows, optionally honoring the cursor's
	// strict-less-than (updated_at, id) DESC predicate so tests can drive
	// pagination behavior without spinning up Postgres.
	pending             []ReceivedInvitationRecord
	past                []ReceivedInvitationRecord
	lastPastParams      ListPastInvitationsParams
	pastErr             error
	pendingErr          error
	getReceivedResult   *ReceivedInvitationRecord
	getReceivedErr      error
}

func (r *fakeRepo) CreateInvitations(_ context.Context, params CreateInvitationsParams) (*CreateInvitationsRecord, error) {
	r.lastParams = params
	if r.result != nil {
		return r.result, nil
	}
	return &CreateInvitationsRecord{}, nil
}

func (r *fakeRepo) ListReceivedPendingInvitations(context.Context, uuid.UUID) ([]ReceivedInvitationRecord, error) {
	if r.pendingErr != nil {
		return nil, r.pendingErr
	}
	return r.pending, nil
}

func (r *fakeRepo) ListReceivedPastInvitations(_ context.Context, _ uuid.UUID, params ListPastInvitationsParams) ([]ReceivedInvitationRecord, error) {
	r.lastPastParams = params
	if r.pastErr != nil {
		return nil, r.pastErr
	}
	// Apply the cursor predicate so pagination tests can rely on
	// (updated_at, id) DESC strict-less-than semantics without a real DB.
	rows := r.past
	if params.Cursor != nil {
		filtered := rows[:0:0]
		for _, row := range rows {
			if row.UpdatedAt.Before(params.Cursor.UpdatedAt) ||
				(row.UpdatedAt.Equal(params.Cursor.UpdatedAt) && row.InvitationID.String() < params.Cursor.InvitationID.String()) {
				filtered = append(filtered, row)
			}
		}
		rows = filtered
	}
	if params.FetchLimit > 0 && len(rows) > params.FetchLimit {
		rows = rows[:params.FetchLimit]
	}
	return rows, nil
}

func (r *fakeRepo) AcceptInvitation(context.Context, uuid.UUID, uuid.UUID) (*AcceptInvitationRecord, error) {
	return r.acceptResult, nil
}

func (r *fakeRepo) DeclineInvitation(context.Context, uuid.UUID, uuid.UUID) (*domain.Invitation, error) {
	return r.declineResult, nil
}

func (r *fakeRepo) GetReceivedInvitation(_ context.Context, _ uuid.UUID, _ uuid.UUID) (*ReceivedInvitationRecord, error) {
	if r.getReceivedErr != nil {
		return nil, r.getReceivedErr
	}
	return r.getReceivedResult, nil
}

func (r *fakeRepo) GetInvitationNotificationContext(_ context.Context, invitationID uuid.UUID) (*InvitationNotificationContext, error) {
	if r.contexts == nil {
		return nil, domain.ErrNotFound
	}
	return r.contexts[invitationID], nil
}

func (r *fakeRepo) RevokeInvitation(_ context.Context, params RevokeInvitationParams) (*domain.Invitation, error) {
	r.revokeCallCount++
	r.lastRevokeParams = params
	if r.revokeErr != nil {
		return nil, r.revokeErr
	}
	now := time.Now().UTC()
	return &domain.Invitation{
		ID:        params.InvitationID,
		EventID:   params.EventID,
		HostID:    params.HostID,
		Status:    domain.InvitationStatusCanceled,
		CreatedAt: now.Add(-time.Hour),
		UpdatedAt: now,
	}, nil
}

func TestListReceivedInvitationsBucketsAndPagination(t *testing.T) {
	t1 := time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC)
	t2 := t1.Add(-1 * time.Hour) // older — appears second under updated_at DESC
	pendingID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	pastID1 := uuid.MustParse("00000000-0000-0000-0000-000000000002")
	pastID2 := uuid.MustParse("00000000-0000-0000-0000-000000000003")
	pendingRec := ReceivedInvitationRecord{InvitationID: pendingID, Status: domain.InvitationStatusPending, UpdatedAt: t1}
	pastRec1 := ReceivedInvitationRecord{InvitationID: pastID1, Status: domain.InvitationStatusDeclined, UpdatedAt: t1}
	pastRec2 := ReceivedInvitationRecord{InvitationID: pastID2, Status: domain.InvitationStatusExpired, UpdatedAt: t2}

	t.Run("empty result returns empty buckets and no cursor", func(t *testing.T) {
		// given
		repo := &fakeRepo{}
		service := NewService(repo, fakeUnitOfWork{})

		// when
		result, err := service.ListReceivedInvitations(context.Background(), ListReceivedInvitationsInput{
			UserID: uuid.New(),
		})

		// then
		if err != nil {
			t.Fatalf("ListReceivedInvitations() error = %v", err)
		}
		if len(result.Pending) != 0 {
			t.Errorf("expected empty pending, got %d", len(result.Pending))
		}
		if len(result.Past.Items) != 0 {
			t.Errorf("expected empty past items, got %d", len(result.Past.Items))
		}
		if result.Past.PageInfo.HasNext {
			t.Errorf("expected has_next=false on empty result")
		}
		if result.Past.PageInfo.NextCursor != nil {
			t.Errorf("expected nil next_cursor on empty result")
		}
	})

	t.Run("populated buckets with implicit limit do not produce a cursor", func(t *testing.T) {
		// given
		repo := &fakeRepo{
			pending: []ReceivedInvitationRecord{pendingRec},
			past:    []ReceivedInvitationRecord{pastRec1, pastRec2},
		}
		service := NewService(repo, fakeUnitOfWork{})

		// when
		result, err := service.ListReceivedInvitations(context.Background(), ListReceivedInvitationsInput{
			UserID: uuid.New(),
		})

		// then
		if err != nil {
			t.Fatalf("ListReceivedInvitations() error = %v", err)
		}
		if got, want := len(result.Pending), 1; got != want {
			t.Errorf("pending = %d, want %d", got, want)
		}
		if got, want := len(result.Past.Items), 2; got != want {
			t.Errorf("past items = %d, want %d", got, want)
		}
		if result.Past.PageInfo.HasNext {
			t.Errorf("has_next = true, want false (only 2 items, default limit 25)")
		}
		// FetchLimit asked the repo for limit+1 = 26 to detect overflow.
		if got, want := repo.lastPastParams.FetchLimit, DefaultPastInvitationLimit+1; got != want {
			t.Errorf("FetchLimit = %d, want %d", got, want)
		}
	})

	t.Run("explicit limit produces a next_cursor when more rows exist", func(t *testing.T) {
		// given — past has 2 rows, limit = 1, so first page should be 1 item + has_next=true
		repo := &fakeRepo{
			past: []ReceivedInvitationRecord{pastRec1, pastRec2},
		}
		service := NewService(repo, fakeUnitOfWork{})
		limit := 1

		// when
		result, err := service.ListReceivedInvitations(context.Background(), ListReceivedInvitationsInput{
			UserID:    uuid.New(),
			PastLimit: &limit,
		})

		// then
		if err != nil {
			t.Fatalf("ListReceivedInvitations() error = %v", err)
		}
		if got, want := len(result.Past.Items), 1; got != want {
			t.Fatalf("page1 items = %d, want %d", got, want)
		}
		if !result.Past.PageInfo.HasNext {
			t.Errorf("page1 has_next = false, want true")
		}
		if result.Past.PageInfo.NextCursor == nil {
			t.Fatalf("page1 next_cursor is nil, want non-nil")
		}

		// and — the cursor decodes back to the page tail's (updated_at, id)
		decoded, err := decodePastInvitationCursor(*result.Past.PageInfo.NextCursor)
		if err != nil {
			t.Fatalf("decode round-trip: %v", err)
		}
		if decoded.InvitationID != pastID1 {
			t.Errorf("cursor invitation_id = %s, want %s (newest declined)", decoded.InvitationID, pastID1)
		}
	})

	t.Run("invalid cursor returns validation_error", func(t *testing.T) {
		// given
		repo := &fakeRepo{}
		service := NewService(repo, fakeUnitOfWork{})
		bad := "!!!not-a-cursor!!!"

		// when
		_, err := service.ListReceivedInvitations(context.Background(), ListReceivedInvitationsInput{
			UserID:     uuid.New(),
			PastCursor: &bad,
		})

		// then
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		var appErr *domain.AppError
		if !errors.As(err, &appErr) {
			t.Fatalf("expected *domain.AppError, got %T", err)
		}
		if appErr.Code != domain.ErrorCodeValidation {
			t.Errorf("Code = %s, want %s", appErr.Code, domain.ErrorCodeValidation)
		}
		if _, ok := appErr.Details["past_cursor"]; !ok {
			t.Errorf("expected past_cursor detail, got %v", appErr.Details)
		}
	})

	t.Run("out-of-range past_limit returns validation_error", func(t *testing.T) {
		cases := []struct {
			name  string
			limit int
		}{
			{"zero", 0},
			{"negative", -5},
			{"above max", MaxPastInvitationLimit + 1},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				// given
				repo := &fakeRepo{}
				service := NewService(repo, fakeUnitOfWork{})

				// when
				_, err := service.ListReceivedInvitations(context.Background(), ListReceivedInvitationsInput{
					UserID:    uuid.New(),
					PastLimit: &tc.limit,
				})

				// then
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var appErr *domain.AppError
				if !errors.As(err, &appErr) {
					t.Fatalf("expected *domain.AppError, got %T", err)
				}
				if appErr.Code != domain.ErrorCodeValidation {
					t.Errorf("Code = %s, want %s", appErr.Code, domain.ErrorCodeValidation)
				}
				if _, ok := appErr.Details["past_limit"]; !ok {
					t.Errorf("expected past_limit detail, got %v", appErr.Details)
				}
			})
		}
	})

	t.Run("empty cursor string is ignored (treated as no cursor)", func(t *testing.T) {
		// given — empty string after trim should not trip the decoder
		repo := &fakeRepo{
			past: []ReceivedInvitationRecord{pastRec1},
		}
		service := NewService(repo, fakeUnitOfWork{})
		emptyCursor := "   "

		// when
		result, err := service.ListReceivedInvitations(context.Background(), ListReceivedInvitationsInput{
			UserID:     uuid.New(),
			PastCursor: &emptyCursor,
		})

		// then
		if err != nil {
			t.Fatalf("expected empty cursor to be ignored, got error: %v", err)
		}
		if got, want := len(result.Past.Items), 1; got != want {
			t.Errorf("past items = %d, want %d", got, want)
		}
		if repo.lastPastParams.Cursor != nil {
			t.Errorf("expected nil Cursor passed to repo, got %v", repo.lastPastParams.Cursor)
		}
	})

	t.Run("repository error on past bucket propagates", func(t *testing.T) {
		// given
		expected := errors.New("db down")
		repo := &fakeRepo{pastErr: expected}
		service := NewService(repo, fakeUnitOfWork{})

		// when
		_, err := service.ListReceivedInvitations(context.Background(), ListReceivedInvitationsInput{
			UserID: uuid.New(),
		})

		// then
		if !errors.Is(err, expected) {
			t.Errorf("expected wrapped %v, got %v", expected, err)
		}
	})
}

func TestGetReceivedInvitation(t *testing.T) {
	t.Run("happy path returns translated DTO", func(t *testing.T) {
		// given
		invID := uuid.New()
		eventID := uuid.New()
		hostID := uuid.New()
		repo := &fakeRepo{
			getReceivedResult: &ReceivedInvitationRecord{
				InvitationID: invID,
				Status:       domain.InvitationStatusCanceled,
				CreatedAt:    time.Date(2026, 5, 8, 10, 0, 0, 0, time.UTC),
				UpdatedAt:    time.Date(2026, 5, 8, 12, 0, 0, 0, time.UTC),
				Event: ReceivedInvitationEventRecord{
					ID:           eventID,
					Title:        "Yoga",
					StartTime:    time.Date(2026, 5, 10, 9, 0, 0, 0, time.UTC),
					Status:       domain.EventStatusActive,
					PrivacyLevel: domain.PrivacyPrivate,
				},
				Host: ReceivedInvitationUserRecord{ID: hostID, Username: "ada"},
			},
		}
		service := NewService(repo, fakeUnitOfWork{})

		// when
		result, err := service.GetReceivedInvitation(context.Background(), uuid.New(), invID)

		// then
		if err != nil {
			t.Fatalf("GetReceivedInvitation: %v", err)
		}
		if result.InvitationID != invID.String() {
			t.Errorf("invitation_id = %s, want %s", result.InvitationID, invID)
		}
		// Detail endpoint must surface CANCELED so the client modal can warn.
		if result.Status != string(domain.InvitationStatusCanceled) {
			t.Errorf("status = %s, want CANCELED", result.Status)
		}
		if result.Host.Username != "ada" {
			t.Errorf("host.username = %s, want ada", result.Host.Username)
		}
	})

	t.Run("ErrNotFound from repo maps to invitation_not_found 404", func(t *testing.T) {
		// given
		repo := &fakeRepo{getReceivedErr: domain.ErrNotFound}
		service := NewService(repo, fakeUnitOfWork{})

		// when
		_, err := service.GetReceivedInvitation(context.Background(), uuid.New(), uuid.New())

		// then
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		var appErr *domain.AppError
		if !errors.As(err, &appErr) {
			t.Fatalf("expected *domain.AppError, got %T", err)
		}
		if appErr.Code != domain.ErrorCodeInvitationNotFound {
			t.Errorf("Code = %s, want %s", appErr.Code, domain.ErrorCodeInvitationNotFound)
		}
		if appErr.Status != domain.StatusNotFound {
			t.Errorf("Status = %d, want %d", appErr.Status, domain.StatusNotFound)
		}
	})

	t.Run("unexpected repo error propagates wrapped", func(t *testing.T) {
		// given
		expected := errors.New("db down")
		repo := &fakeRepo{getReceivedErr: expected}
		service := NewService(repo, fakeUnitOfWork{})

		// when
		_, err := service.GetReceivedInvitation(context.Background(), uuid.New(), uuid.New())

		// then
		if !errors.Is(err, expected) {
			t.Errorf("expected wrapped %v, got %v", expected, err)
		}
		// Must NOT be an *AppError — that would silently downgrade to 404/500
		// and lose the wrap chain for upstream observability.
		var appErr *domain.AppError
		if errors.As(err, &appErr) {
			t.Errorf("expected raw error, got *domain.AppError = %v", appErr)
		}
	})
}

func TestRevokeInvitationDelegatesToRepo(t *testing.T) {
	// given
	repo := &fakeRepo{}
	service := NewService(repo, fakeUnitOfWork{})
	hostID := uuid.New()
	eventID := uuid.New()
	invitationID := uuid.New()

	// when
	err := service.RevokeInvitation(context.Background(), hostID, eventID, invitationID)

	// then
	if err != nil {
		t.Fatalf("RevokeInvitation() error = %v", err)
	}
	if repo.revokeCallCount != 1 {
		t.Fatalf("expected repo called once, got %d", repo.revokeCallCount)
	}
	if repo.lastRevokeParams.HostID != hostID || repo.lastRevokeParams.EventID != eventID || repo.lastRevokeParams.InvitationID != invitationID {
		t.Fatalf("repo received wrong params: %+v", repo.lastRevokeParams)
	}
}

func TestRevokeInvitationPropagatesRepoError(t *testing.T) {
	// given
	expected := domain.ConflictError(domain.ErrorCodeInvitationStateInvalid, "Only PENDING invitations can be canceled.")
	repo := &fakeRepo{revokeErr: expected}
	service := NewService(repo, fakeUnitOfWork{})

	// when
	err := service.RevokeInvitation(context.Background(), uuid.New(), uuid.New(), uuid.New())

	// then
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	var appErr *domain.AppError
	if !errors.As(err, &appErr) || appErr.Code != domain.ErrorCodeInvitationStateInvalid {
		t.Fatalf("expected invitation_state_invalid error, got %v", err)
	}
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
