package domain

import (
	"time"

	"github.com/google/uuid"
)

const (
	CommentMessageMinLength = 1
	CommentMessageMaxLength = 1000
)

const (
	ErrorCodeCommentsNotAllowed     = "comments_not_allowed"
	ErrorCodeCommentNotFound        = "comment_not_found"
	ErrorCodeCommentWriteNotAllowed = "comment_write_not_allowed"
	ErrorCodeReviewNotAllowed       = "review_not_allowed"
	ErrorCodeReviewImageNotAllowed  = "review_image_not_allowed"
)

// CommentType defines whether an event comment belongs to discussion or review
// content.
type CommentType string

const (
	CommentTypeDiscussion CommentType = "DISCUSSION"
	CommentTypeReview     CommentType = "REVIEW"
)

var commentTypes = map[string]CommentType{
	string(CommentTypeDiscussion): CommentTypeDiscussion,
	string(CommentTypeReview):     CommentTypeReview,
}

// ParseCommentType converts a wire string to a CommentType.
func ParseCommentType(value string) (CommentType, bool) {
	commentType, ok := commentTypes[value]
	return commentType, ok
}

// EventComment stores a discussion comment or completed-event review.
type EventComment struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	EventID    uuid.UUID
	Type       CommentType
	Message    string
	ParentID   *uuid.UUID
	Rating     *int
	ImageURL   *string
	LikesCount int
	ReplyCount int
	CreatedAt  time.Time
	UpdatedAt  time.Time
}
