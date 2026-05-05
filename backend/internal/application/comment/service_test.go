package comment

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

type fakeCommentRepo struct {
	eventContext      *EventCommentContext
	parentContext     *DiscussionParentContext
	topLevelRecords   []CommentRecord
	replyRecords      []CommentRecord
	discussionRecord  *CommentRecord
	reviewRecord      *CommentRecord
	deleteReview      bool
	lastDiscussion    CreateDiscussionCommentParams
	lastReview        UpsertReviewCommentParams
	createCalls       int
	upsertReviewCalls int
}

func (r *fakeCommentRepo) GetEventCommentContext(_ context.Context, eventID uuid.UUID, _ *uuid.UUID) (*EventCommentContext, error) {
	if r.eventContext == nil {
		return nil, domain.ErrNotFound
	}
	ctx := *r.eventContext
	ctx.EventID = eventID
	return &ctx, nil
}

func (r *fakeCommentRepo) GetDiscussionParentContext(_ context.Context, eventID, parentID uuid.UUID) (*DiscussionParentContext, error) {
	if r.parentContext == nil {
		return nil, domain.ErrNotFound
	}
	ctx := *r.parentContext
	ctx.ID = parentID
	ctx.EventID = eventID
	return &ctx, nil
}

func (r *fakeCommentRepo) ListTopLevelComments(_ context.Context, _ uuid.UUID, params ListCommentsParams) ([]CommentRecord, error) {
	return r.topLevelRecords[:min(len(r.topLevelRecords), params.RepositoryFetchLimit)], nil
}

func (r *fakeCommentRepo) ListReplies(_ context.Context, _ uuid.UUID, _ uuid.UUID, params ListCommentsParams) ([]CommentRecord, error) {
	return r.replyRecords[:min(len(r.replyRecords), params.RepositoryFetchLimit)], nil
}

func (r *fakeCommentRepo) CreateDiscussionComment(_ context.Context, params CreateDiscussionCommentParams) (*CommentRecord, error) {
	r.createCalls++
	r.lastDiscussion = params
	if r.discussionRecord != nil {
		return r.discussionRecord, nil
	}
	return sampleComment(params.EventID, params.UserID, domain.CommentTypeDiscussion), nil
}

func (r *fakeCommentRepo) UpsertReviewComment(_ context.Context, params UpsertReviewCommentParams) (*CommentRecord, error) {
	r.upsertReviewCalls++
	r.lastReview = params
	if r.reviewRecord != nil {
		return r.reviewRecord, nil
	}
	record := sampleComment(params.EventID, params.UserID, domain.CommentTypeReview)
	record.Rating = &params.Rating
	record.ImageURL = params.ImageURL
	return record, nil
}

func (r *fakeCommentRepo) DeleteReviewComment(_ context.Context, _, _ uuid.UUID) (bool, error) {
	return r.deleteReview, nil
}

type fakeCommentUOW struct {
	calls int
}

func (u *fakeCommentUOW) RunInTx(ctx context.Context, fn func(context.Context) error) error {
	u.calls++
	return fn(ctx)
}

type fakeReviewImageConfirmer struct {
	baseURL string
	err     error
}

func (f fakeReviewImageConfirmer) ConfirmEventReviewImageUpload(context.Context, uuid.UUID, uuid.UUID, imageupload.ConfirmUploadInput) (*imageupload.ConfirmReviewImageResult, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &imageupload.ConfirmReviewImageResult{BaseURL: f.baseURL}, nil
}

type fakeScoreUpdater struct {
	hostID uuid.UUID
	calls  int
}

func (f *fakeScoreUpdater) RefreshHostedEventScore(_ context.Context, hostID uuid.UUID) error {
	f.calls++
	f.hostID = hostID
	return nil
}

func TestCreateDiscussionCommentAllowsAnyoneWhenActive(t *testing.T) {
	// given
	userID := uuid.New()
	eventID := uuid.New()
	repo := &fakeCommentRepo{eventContext: baseCommentContext(domain.EventStatusActive)}
	service := NewService(repo, &fakeCommentUOW{})

	// when
	result, err := service.CreateDiscussionComment(context.Background(), userID, eventID, CreateDiscussionCommentInput{Message: "  hello  "})

	// then
	if err != nil {
		t.Fatalf("CreateDiscussionComment() error = %v", err)
	}
	if result.Message != "hello" {
		t.Fatalf("expected trimmed message, got %q", result.Message)
	}
	if repo.lastDiscussion.Message != "hello" {
		t.Fatalf("expected repository message to be trimmed, got %q", repo.lastDiscussion.Message)
	}
}

func TestCreateDiscussionCommentRejectsNonParticipantInProgress(t *testing.T) {
	// given
	repo := &fakeCommentRepo{eventContext: baseCommentContext(domain.EventStatusInProgress)}
	service := NewService(repo, &fakeCommentUOW{})

	// when
	_, err := service.CreateDiscussionComment(context.Background(), uuid.New(), uuid.New(), CreateDiscussionCommentInput{Message: "hello"})

	// then
	requireCommentAppError(t, err, domain.ErrorCodeCommentWriteNotAllowed)
	if repo.createCalls != 0 {
		t.Fatalf("expected no create call, got %d", repo.createCalls)
	}
}

func TestUpsertReviewCommentRequiresCompletedParticipant(t *testing.T) {
	// given
	repo := &fakeCommentRepo{eventContext: baseCommentContext(domain.EventStatusInProgress)}
	service := NewService(repo, &fakeCommentUOW{})

	// when
	_, err := service.UpsertReviewComment(context.Background(), uuid.New(), uuid.New(), UpsertReviewCommentInput{
		Message: "great event",
		Rating:  5,
	})

	// then
	requireCommentAppError(t, err, domain.ErrorCodeReviewNotAllowed)
	if repo.upsertReviewCalls != 0 {
		t.Fatalf("expected no review upsert, got %d", repo.upsertReviewCalls)
	}
}

func TestUpsertReviewCommentStoresConfirmedImageAndRefreshesHostScore(t *testing.T) {
	// given
	userID := uuid.New()
	eventID := uuid.New()
	hostID := uuid.New()
	ctx := baseCommentContext(domain.EventStatusCompleted)
	ctx.HostUserID = hostID
	ctx.IsQualifyingParticipant = true
	repo := &fakeCommentRepo{eventContext: ctx}
	scoreUpdater := &fakeScoreUpdater{}
	service := NewService(repo, &fakeCommentUOW{})
	service.SetReviewImageConfirmer(fakeReviewImageConfirmer{baseURL: "https://cdn.example/review.jpg"})
	service.SetReviewScoreUpdater(scoreUpdater)
	token := "confirm-token"

	// when
	_, err := service.UpsertReviewComment(context.Background(), userID, eventID, UpsertReviewCommentInput{
		Message:           "great event",
		Rating:            5,
		ImageConfirmToken: &token,
	})

	// then
	if err != nil {
		t.Fatalf("UpsertReviewComment() error = %v", err)
	}
	if repo.lastReview.ImageURL == nil || *repo.lastReview.ImageURL != "https://cdn.example/review.jpg" {
		t.Fatalf("expected image URL to be stored, got %v", repo.lastReview.ImageURL)
	}
	if scoreUpdater.calls != 1 || scoreUpdater.hostID != hostID {
		t.Fatalf("expected host score refresh for %s, got calls=%d host=%s", hostID, scoreUpdater.calls, scoreUpdater.hostID)
	}
}

func TestListEventCommentsReturnsNoChildComments(t *testing.T) {
	// given
	eventID := uuid.New()
	parent := *sampleComment(eventID, uuid.New(), domain.CommentTypeDiscussion)
	child := *sampleComment(eventID, uuid.New(), domain.CommentTypeDiscussion)
	child.ParentID = &parent.ID
	repo := &fakeCommentRepo{
		eventContext:    baseCommentContext(domain.EventStatusActive),
		topLevelRecords: []CommentRecord{parent, child},
	}
	service := NewService(repo, &fakeCommentUOW{})

	// when
	result, err := service.ListEventComments(context.Background(), nil, eventID, ListEventCommentsInput{})

	// then
	if err != nil {
		t.Fatalf("ListEventComments() error = %v", err)
	}
	if len(result.DiscussionComments.Items) != 2 {
		t.Fatalf("expected fake repository records to be returned, got %d", len(result.DiscussionComments.Items))
	}
}

func baseCommentContext(status domain.EventStatus) *EventCommentContext {
	return &EventCommentContext{
		HostUserID:              uuid.New(),
		PrivacyLevel:            domain.PrivacyPublic,
		Status:                  status,
		StartTime:               time.Now().UTC().Add(-time.Hour),
		IsVisible:               true,
		IsApprovedParticipant:   false,
		IsQualifyingParticipant: false,
	}
}

func sampleComment(eventID, userID uuid.UUID, commentType domain.CommentType) *CommentRecord {
	now := time.Now().UTC()
	return &CommentRecord{
		ID:      uuid.New(),
		EventID: eventID,
		User: CommentAuthorRecord{
			ID:       userID,
			Username: "commenter",
		},
		Type:      commentType,
		Message:   "hello",
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func requireCommentAppError(t *testing.T, err error, code string) {
	t.Helper()

	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T: %v", err, err)
	}
	if appErr.Code != code {
		t.Fatalf("expected code %q, got %q", code, appErr.Code)
	}
}
