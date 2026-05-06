package comment

import (
	"context"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// ReviewImageConfirmer verifies an uploaded review image and returns its public
// base URL. The image upload service implements this local port.
type ReviewImageConfirmer interface {
	ConfirmEventReviewImageUpload(ctx context.Context, userID, eventID uuid.UUID, input imageupload.ConfirmUploadInput) (*imageupload.ConfirmReviewImageResult, error)
}

// ReviewScoreUpdater refreshes host scores after review comment mutations.
type ReviewScoreUpdater interface {
	RefreshHostedEventScore(ctx context.Context, hostID uuid.UUID) error
}

// ListEventCommentsInput carries independent pagination for discussions and
// reviews.
type ListEventCommentsInput struct {
	DiscussionLimit  *int
	DiscussionCursor *string
	ReviewLimit      *int
	ReviewCursor     *string
}

// ListCommentRepliesInput carries pagination for a reply collection.
type ListCommentRepliesInput struct {
	Limit  *int
	Cursor *string
}

// CreateDiscussionCommentInput is the write payload for discussion comments.
type CreateDiscussionCommentInput struct {
	Message  string
	ParentID *uuid.UUID
}

// UpsertReviewCommentInput is the write payload for completed-event reviews.
type UpsertReviewCommentInput struct {
	Message           string
	Rating            int
	ImageConfirmToken *string
}

// EventCommentContext contains event state and the viewer/caller relation
// needed to authorize comment reads and writes.
type EventCommentContext struct {
	EventID                 uuid.UUID
	HostUserID              uuid.UUID
	PrivacyLevel            domain.EventPrivacyLevel
	Status                  domain.EventStatus
	StartTime               time.Time
	IsVisible               bool
	IsHost                  bool
	IsApprovedParticipant   bool
	IsQualifyingParticipant bool
}

// DiscussionParentContext contains the state of a candidate reply parent.
type DiscussionParentContext struct {
	ID       uuid.UUID
	EventID  uuid.UUID
	Type     domain.CommentType
	ParentID *uuid.UUID
}

// ListCommentsParams contains repository pagination details.
type ListCommentsParams struct {
	CommentType          domain.CommentType
	Limit                int
	RepositoryFetchLimit int
	DecodedCursor        *CommentCursor
}

// CommentCursor is the opaque keyset cursor payload for comments ordered by
// created_at DESC, id DESC.
type CommentCursor struct {
	Collection string    `json:"collection"`
	CreatedAt  time.Time `json:"created_at"`
	CommentID  uuid.UUID `json:"comment_id"`
}

// CommentAuthorResult is the public author summary embedded in comments.
type CommentAuthorResult struct {
	ID          string  `json:"id"`
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name"`
	AvatarURL   *string `json:"avatar_url"`
}

// CommentResult is returned for discussion and review comments.
type CommentResult struct {
	ID         string              `json:"id"`
	EventID    string              `json:"event_id"`
	User       CommentAuthorResult `json:"user"`
	Type       string              `json:"comment_type"`
	Message    string              `json:"message"`
	ParentID   *string             `json:"parent_id"`
	Rating     *int                `json:"rating"`
	ImageURL   *string             `json:"image_url"`
	LikesCount int                 `json:"likes_count"`
	ReplyCount int                 `json:"reply_count"`
	CreatedAt  time.Time           `json:"created_at"`
	UpdatedAt  time.Time           `json:"updated_at"`
}

// CommentPageInfo contains cursor pagination metadata.
type CommentPageInfo struct {
	NextCursor *string `json:"next_cursor"`
	HasNext    bool    `json:"has_next"`
}

// CommentCollectionResult wraps a comment page.
type CommentCollectionResult struct {
	Items    []CommentResult `json:"items"`
	PageInfo CommentPageInfo `json:"page_info"`
}

// ListEventCommentsResult returns top-level discussion and review collections.
type ListEventCommentsResult struct {
	DiscussionComments CommentCollectionResult `json:"discussion_comments"`
	ReviewComments     CommentCollectionResult `json:"review_comments"`
}

// ListCommentRepliesResult returns one page of replies for a discussion comment.
type ListCommentRepliesResult struct {
	Items    []CommentResult `json:"items"`
	PageInfo CommentPageInfo `json:"page_info"`
}

// CommentAuthorRecord is the persistence-layer author projection.
type CommentAuthorRecord struct {
	ID          uuid.UUID
	Username    string
	DisplayName *string
	AvatarURL   *string
}

// CommentRecord is the persistence-layer comment projection.
type CommentRecord struct {
	ID         uuid.UUID
	EventID    uuid.UUID
	User       CommentAuthorRecord
	Type       domain.CommentType
	Message    string
	ParentID   *uuid.UUID
	Rating     *int
	ImageURL   *string
	LikesCount int
	ReplyCount int
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// CreateDiscussionCommentParams carries data for inserting a discussion comment.
type CreateDiscussionCommentParams struct {
	EventID  uuid.UUID
	UserID   uuid.UUID
	Message  string
	ParentID *uuid.UUID
}

// UpsertReviewCommentParams carries data for inserting or updating a review.
type UpsertReviewCommentParams struct {
	EventID  uuid.UUID
	UserID   uuid.UUID
	Message  string
	Rating   int
	ImageURL *string
}
