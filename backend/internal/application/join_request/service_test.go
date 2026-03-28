package join_request

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type fakeJoinRequestRepo struct {
	err        error
	callCount  int
	lastParams CreateJoinRequestParams
	result     *domain.JoinRequest
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
		Status:     domain.ParticipationStatusPending,
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}

func TestCreatePendingJoinRequestDelegatesToRepo(t *testing.T) {
	// given
	repo := &fakeJoinRequestRepo{}
	service := NewService(repo)
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
	service := NewService(repo)

	// when
	_, err := service.CreatePendingJoinRequest(context.Background(), uuid.New(), uuid.New(), uuid.New(), CreatePendingJoinRequestInput{})

	// then
	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected error %v, got %v", expectedErr, err)
	}
}
