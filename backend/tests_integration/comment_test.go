//go:build integration

package tests_integration

import (
	"context"
	"errors"
	"testing"
	"time"

	commentapp "github.com/bounswe/bounswe2026group11/backend/internal/application/comment"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/bounswe/bounswe2026group11/backend/tests_integration/common"
	"github.com/google/uuid"
)

func TestPublicEventCommentsListTopLevelAndRepliesSeparately(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("comment_host"))
	viewer := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("comment_viewer"))
	eventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Commented Event",
		Description:  "discussion stays open before the event",
		CategoryID:   common.GivenEventCategory(t),
		Lat:          41.01,
		Lon:          29.02,
		StartTime:    time.Now().UTC().Add(2 * time.Hour),
		PrivacyLevel: domain.PrivacyPublic,
	})

	parent, err := harness.CommentService.CreateDiscussionComment(context.Background(), viewer.ID, eventID, commentapp.CreateDiscussionCommentInput{
		Message: "Can I bring a friend?",
	})
	if err != nil {
		t.Fatalf("CreateDiscussionComment() parent error = %v", err)
	}
	parentID := parseUUID(t, parent.ID)
	reply, err := harness.CommentService.CreateDiscussionComment(context.Background(), host.ID, eventID, commentapp.CreateDiscussionCommentInput{
		Message:  "Yes, there is room.",
		ParentID: &parentID,
	})
	if err != nil {
		t.Fatalf("CreateDiscussionComment() reply error = %v", err)
	}

	// when
	comments, err := harness.CommentService.ListEventComments(context.Background(), nil, eventID, commentapp.ListEventCommentsInput{})
	if err != nil {
		t.Fatalf("ListEventComments() error = %v", err)
	}
	replies, err := harness.CommentService.ListCommentReplies(context.Background(), nil, eventID, parentID, commentapp.ListCommentRepliesInput{})
	if err != nil {
		t.Fatalf("ListCommentReplies() error = %v", err)
	}

	// then
	if len(comments.DiscussionComments.Items) != 1 {
		t.Fatalf("expected only top-level discussion comments, got %d", len(comments.DiscussionComments.Items))
	}
	if comments.DiscussionComments.Items[0].ID != parent.ID {
		t.Fatalf("expected parent comment in top-level response, got %s", comments.DiscussionComments.Items[0].ID)
	}
	if comments.DiscussionComments.Items[0].ReplyCount != 1 {
		t.Fatalf("expected reply_count=1, got %d", comments.DiscussionComments.Items[0].ReplyCount)
	}
	if len(replies.Items) != 1 || replies.Items[0].ID != reply.ID {
		t.Fatalf("expected reply %s, got %+v", reply.ID, replies.Items)
	}
}

func TestPrivateEventCommentsRejectedForVisibleHost(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("private_comment_host"))
	eventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Private Comment Event",
		Description:  "private comments are disabled",
		CategoryID:   common.GivenEventCategory(t),
		Lat:          41.03,
		Lon:          29.04,
		StartTime:    time.Now().UTC().Add(2 * time.Hour),
		PrivacyLevel: domain.PrivacyPrivate,
	})

	// when
	_, err := harness.CommentService.ListEventComments(context.Background(), &host.ID, eventID, commentapp.ListEventCommentsInput{})

	// then
	var appErr *domain.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *domain.AppError, got %T: %v", err, err)
	}
	if appErr.Code != domain.ErrorCodeCommentsNotAllowed {
		t.Fatalf("expected %q, got %q", domain.ErrorCodeCommentsNotAllowed, appErr.Code)
	}
}

func TestReviewCommentUpdatesHostScoreAndViewerRating(t *testing.T) {
	t.Parallel()

	// given
	harness := common.NewEventHarness(t)
	host := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("review_comment_host"))
	participant := common.GivenUser(t, harness.AuthRepo, common.WithUserUsername("review_comment_participant"))
	eventID := createDiscoveryEvent(t, harness, discoveryEventSeed{
		HostID:       host.ID,
		Title:        "Reviewed Event",
		Description:  "completed review event",
		CategoryID:   common.GivenEventCategory(t),
		Lat:          41.05,
		Lon:          29.06,
		StartTime:    time.Now().UTC().Add(-2 * time.Hour),
		PrivacyLevel: domain.PrivacyProtected,
	})
	insertParticipation(t, eventID, participant.ID, domain.ParticipationStatusApproved)
	updateEventStatus(t, eventID, string(domain.EventStatusCompleted))

	// when
	review, err := harness.CommentService.UpsertReviewComment(context.Background(), participant.ID, eventID, commentapp.UpsertReviewCommentInput{
		Message: "The host was very helpful.",
		Rating:  5,
	})
	if err != nil {
		t.Fatalf("UpsertReviewComment() error = %v", err)
	}
	detail, err := harness.Service.GetEventDetail(context.Background(), participant.ID, eventID)
	if err != nil {
		t.Fatalf("GetEventDetail() error = %v", err)
	}

	// then
	if review.Rating == nil || *review.Rating != 5 {
		t.Fatalf("expected review rating 5, got %+v", review.Rating)
	}
	if detail.ViewerEventRating == nil || detail.ViewerEventRating.Rating != 5 {
		t.Fatalf("expected viewer_event_rating from review comment, got %+v", detail.ViewerEventRating)
	}
	if detail.HostScore.HostedEventRatingCount != 1 {
		t.Fatalf("expected host rating count 1, got %d", detail.HostScore.HostedEventRatingCount)
	}
	requireApproxFloat(t, detail.HostScore.FinalScore, (5.0*1+4.0*5)/6.0)
}

func parseUUID(t *testing.T, value string) uuid.UUID {
	t.Helper()

	id, err := uuid.Parse(value)
	if err != nil {
		t.Fatalf("uuid.Parse(%q) error = %v", value, err)
	}
	return id
}
