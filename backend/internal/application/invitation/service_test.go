package invitation

import (
	"context"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type fakeUnitOfWork struct{}

func (u fakeUnitOfWork) RunInTx(ctx context.Context, fn func(context.Context) error) error {
	return fn(ctx)
}

type fakeRepo struct {
	lastParams CreateInvitationsParams
	result     *CreateInvitationsRecord
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
	return nil, nil
}

func (r *fakeRepo) DeclineInvitation(context.Context, uuid.UUID, uuid.UUID) (*domain.Invitation, error) {
	return nil, nil
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
