package participation

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type fakeParticipationRepo struct {
	err               error
	callCount         int
	leaveCallCount    int
	cancelCallCount   int
	lastEventID       uuid.UUID
	lastUserID        uuid.UUID
	lastLeaveEventID  uuid.UUID
	lastLeaveUserID   uuid.UUID
	lastCancelEventID uuid.UUID
	result            *domain.Participation
}

func (r *fakeParticipationRepo) CreateParticipation(_ context.Context, eventID, userID uuid.UUID) (*domain.Participation, error) {
	r.callCount++
	r.lastEventID = eventID
	r.lastUserID = userID

	if r.err != nil {
		return nil, r.err
	}
	if r.result != nil {
		return r.result, nil
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

func (r *fakeParticipationRepo) LeaveParticipation(_ context.Context, eventID, userID uuid.UUID) (*domain.Participation, error) {
	r.leaveCallCount++
	r.lastLeaveEventID = eventID
	r.lastLeaveUserID = userID

	if r.err != nil {
		return nil, r.err
	}
	if r.result != nil {
		return r.result, nil
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

func (r *fakeParticipationRepo) CancelEventParticipations(_ context.Context, eventID uuid.UUID) error {
	r.cancelCallCount++
	r.lastCancelEventID = eventID
	return r.err
}

func TestCreateApprovedParticipationDelegatesToRepo(t *testing.T) {
	// given
	repo := &fakeParticipationRepo{}
	service := NewService(repo)
	eventID := uuid.New()
	userID := uuid.New()

	// when
	result, err := service.CreateApprovedParticipation(context.Background(), eventID, userID)

	// then
	if err != nil {
		t.Fatalf("CreateApprovedParticipation() error = %v", err)
	}
	if result == nil {
		t.Fatal("expected participation result, got nil")
	}
	if repo.callCount != 1 {
		t.Fatalf("expected repo to be called once, got %d", repo.callCount)
	}
	if repo.lastEventID != eventID || repo.lastUserID != userID {
		t.Fatalf("expected repo to receive event %s and user %s", eventID, userID)
	}
}

func TestCreateApprovedParticipationPropagatesRepoError(t *testing.T) {
	// given
	expectedErr := errors.New("boom")
	repo := &fakeParticipationRepo{err: expectedErr}
	service := NewService(repo)

	// when
	_, err := service.CreateApprovedParticipation(context.Background(), uuid.New(), uuid.New())

	// then
	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected error %v, got %v", expectedErr, err)
	}
}

func TestLeaveParticipationDelegatesToRepo(t *testing.T) {
	// given
	repo := &fakeParticipationRepo{}
	service := NewService(repo)
	eventID := uuid.New()
	userID := uuid.New()

	// when
	result, err := service.LeaveParticipation(context.Background(), eventID, userID)

	// then
	if err != nil {
		t.Fatalf("LeaveParticipation() error = %v", err)
	}
	if result == nil {
		t.Fatal("expected participation result, got nil")
	}
	if repo.leaveCallCount != 1 {
		t.Fatalf("expected leave repo to be called once, got %d", repo.leaveCallCount)
	}
	if repo.lastLeaveEventID != eventID || repo.lastLeaveUserID != userID {
		t.Fatalf("expected leave repo to receive event %s and user %s", eventID, userID)
	}
	if result.Status != domain.ParticipationStatusLeaved {
		t.Fatalf("expected status %q, got %q", domain.ParticipationStatusLeaved, result.Status)
	}
}

func TestCancelEventParticipationsDelegatesToRepo(t *testing.T) {
	repo := &fakeParticipationRepo{}
	service := NewService(repo)
	eventID := uuid.New()

	if err := service.CancelEventParticipations(context.Background(), eventID); err != nil {
		t.Fatalf("CancelEventParticipations() error = %v", err)
	}
	if repo.cancelCallCount != 1 || repo.lastCancelEventID != eventID {
		t.Fatalf("expected cancel repo to receive event %s, got calls=%d event=%s", eventID, repo.cancelCallCount, repo.lastCancelEventID)
	}
}
