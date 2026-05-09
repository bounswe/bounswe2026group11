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
	err                  error
	listApprovedErr      error
	callCount            int
	leaveCallCount       int
	cancelCallCount      int
	listApprovedCount    int
	lastEventID          uuid.UUID
	lastUserID           uuid.UUID
	lastLeaveEventID     uuid.UUID
	lastLeaveUserID      uuid.UUID
	lastCancelEventID    uuid.UUID
	lastListApprovedEvID uuid.UUID
	approvedUserIDs      []uuid.UUID
	result               *domain.Participation
}

type fakeBadgeEvaluator struct {
	err         error
	callCount   int
	userIDCalls []uuid.UUID
}

func (e *fakeBadgeEvaluator) EvaluateParticipationBadges(_ context.Context, userID uuid.UUID) error {
	e.callCount++
	e.userIDCalls = append(e.userIDCalls, userID)
	return e.err
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

func (r *fakeParticipationRepo) CancelEventParticipations(_ context.Context, eventID uuid.UUID) ([]uuid.UUID, error) {
	r.cancelCallCount++
	r.lastCancelEventID = eventID
	return nil, r.err
}

func (r *fakeParticipationRepo) ListApprovedParticipantUserIDs(_ context.Context, eventID uuid.UUID) ([]uuid.UUID, error) {
	r.listApprovedCount++
	r.lastListApprovedEvID = eventID
	if r.listApprovedErr != nil {
		return nil, r.listApprovedErr
	}
	return r.approvedUserIDs, nil
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

	if _, err := service.CancelEventParticipations(context.Background(), eventID); err != nil {
		t.Fatalf("CancelEventParticipations() error = %v", err)
	}
	if repo.cancelCallCount != 1 || repo.lastCancelEventID != eventID {
		t.Fatalf("expected cancel repo to receive event %s, got calls=%d event=%s", eventID, repo.cancelCallCount, repo.lastCancelEventID)
	}
}

func TestEvaluateBadgesForEventParticipantsDelegatesToRepoAndEvaluator(t *testing.T) {
	// given
	eventID := uuid.New()
	userOne := uuid.New()
	userTwo := uuid.New()
	repo := &fakeParticipationRepo{approvedUserIDs: []uuid.UUID{userOne, userTwo}}
	evaluator := &fakeBadgeEvaluator{}
	service := NewService(repo)
	service.SetBadgeEvaluator(evaluator)

	// when
	err := service.EvaluateBadgesForEventParticipants(context.Background(), eventID)

	// then
	if err != nil {
		t.Fatalf("EvaluateBadgesForEventParticipants() error = %v", err)
	}
	if repo.listApprovedCount != 1 || repo.lastListApprovedEvID != eventID {
		t.Fatalf("expected approved-participant lookup for event %s, got calls=%d event=%s", eventID, repo.listApprovedCount, repo.lastListApprovedEvID)
	}
	if evaluator.callCount != 2 {
		t.Fatalf("expected evaluator to be called twice, got %d", evaluator.callCount)
	}
	if len(evaluator.userIDCalls) != 2 || evaluator.userIDCalls[0] != userOne || evaluator.userIDCalls[1] != userTwo {
		t.Fatalf("expected evaluator calls [%s %s], got %v", userOne, userTwo, evaluator.userIDCalls)
	}
}

func TestEvaluateBadgesForEventParticipantsPropagatesRepoError(t *testing.T) {
	// given
	expectedErr := errors.New("lookup failed")
	repo := &fakeParticipationRepo{listApprovedErr: expectedErr}
	evaluator := &fakeBadgeEvaluator{}
	service := NewService(repo)
	service.SetBadgeEvaluator(evaluator)

	// when
	err := service.EvaluateBadgesForEventParticipants(context.Background(), uuid.New())

	// then
	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected error %v, got %v", expectedErr, err)
	}
	if evaluator.callCount != 0 {
		t.Fatalf("expected evaluator not to run after repo error, got %d calls", evaluator.callCount)
	}
}

func TestEvaluateBadgesForEventParticipantsIgnoresEvaluatorErrors(t *testing.T) {
	// given
	userOne := uuid.New()
	userTwo := uuid.New()
	repo := &fakeParticipationRepo{approvedUserIDs: []uuid.UUID{userOne, userTwo}}
	evaluator := &fakeBadgeEvaluator{err: errors.New("badge backend down")}
	service := NewService(repo)
	service.SetBadgeEvaluator(evaluator)

	// when
	err := service.EvaluateBadgesForEventParticipants(context.Background(), uuid.New())

	// then
	if err != nil {
		t.Fatalf("expected evaluator errors to be ignored, got %v", err)
	}
	if evaluator.callCount != 2 {
		t.Fatalf("expected evaluator to be attempted for every user, got %d calls", evaluator.callCount)
	}
}
