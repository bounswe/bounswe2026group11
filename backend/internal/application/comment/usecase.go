package comment

import (
	"context"

	"github.com/google/uuid"
)

// UseCase is the inbound application port for event comments and reviews.
type UseCase interface {
	ListEventComments(ctx context.Context, viewerUserID *uuid.UUID, eventID uuid.UUID, input ListEventCommentsInput) (*ListEventCommentsResult, error)
	ListCommentReplies(ctx context.Context, viewerUserID *uuid.UUID, eventID, commentID uuid.UUID, input ListCommentRepliesInput) (*ListCommentRepliesResult, error)
	CreateDiscussionComment(ctx context.Context, userID, eventID uuid.UUID, input CreateDiscussionCommentInput) (*CommentResult, error)
	UpsertReviewComment(ctx context.Context, userID, eventID uuid.UUID, input UpsertReviewCommentInput) (*CommentResult, error)
	DeleteReviewComment(ctx context.Context, userID, eventID uuid.UUID) error
}
