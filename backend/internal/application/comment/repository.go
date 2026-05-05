package comment

import (
	"context"

	"github.com/google/uuid"
)

// Repository is the application-layer persistence port for event comments.
type Repository interface {
	GetEventCommentContext(ctx context.Context, eventID uuid.UUID, viewerUserID *uuid.UUID) (*EventCommentContext, error)
	GetDiscussionParentContext(ctx context.Context, eventID, parentID uuid.UUID) (*DiscussionParentContext, error)
	ListTopLevelComments(ctx context.Context, eventID uuid.UUID, params ListCommentsParams) ([]CommentRecord, error)
	ListReplies(ctx context.Context, eventID, parentID uuid.UUID, params ListCommentsParams) ([]CommentRecord, error)
	CreateDiscussionComment(ctx context.Context, params CreateDiscussionCommentParams) (*CommentRecord, error)
	UpsertReviewComment(ctx context.Context, params UpsertReviewCommentParams) (*CommentRecord, error)
	DeleteReviewComment(ctx context.Context, eventID, userID uuid.UUID) (bool, error)
}
