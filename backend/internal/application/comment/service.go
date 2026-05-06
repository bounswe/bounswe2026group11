package comment

import (
	"context"
	"errors"
	"log/slog"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	"github.com/bounswe/bounswe2026group11/backend/internal/application/uow"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// Service owns event comment and review application behavior.
type Service struct {
	repo           Repository
	unitOfWork     uow.UnitOfWork
	imageConfirmer ReviewImageConfirmer
	scoreUpdater   ReviewScoreUpdater
}

var _ UseCase = (*Service)(nil)

// NewService constructs a comment service backed by its repository.
func NewService(repo Repository, unitOfWork uow.UnitOfWork) *Service {
	return &Service{
		repo:       repo,
		unitOfWork: unitOfWork,
	}
}

// SetReviewImageConfirmer wires in the image-upload service.
func (s *Service) SetReviewImageConfirmer(confirmer ReviewImageConfirmer) {
	s.imageConfirmer = confirmer
}

// SetReviewScoreUpdater wires in the rating score updater.
func (s *Service) SetReviewScoreUpdater(updater ReviewScoreUpdater) {
	s.scoreUpdater = updater
}

// ListEventComments returns top-level discussion and review comments.
func (s *Service) ListEventComments(ctx context.Context, viewerUserID *uuid.UUID, eventID uuid.UUID, input ListEventCommentsInput) (*ListEventCommentsResult, error) {
	commentContext, err := s.loadReadableContext(ctx, eventID, viewerUserID)
	if err != nil {
		return nil, err
	}
	if commentContext.PrivacyLevel == domain.PrivacyPrivate {
		return nil, domain.ConflictError(domain.ErrorCodeCommentsNotAllowed, "Comments are available only for PUBLIC and PROTECTED events.")
	}

	discussion, err := s.listTopLevelCollection(ctx, eventID, domain.CommentTypeDiscussion, input.DiscussionLimit, input.DiscussionCursor, commentCollectionDiscussion)
	if err != nil {
		return nil, err
	}
	reviews, err := s.listTopLevelCollection(ctx, eventID, domain.CommentTypeReview, input.ReviewLimit, input.ReviewCursor, commentCollectionReview)
	if err != nil {
		return nil, err
	}

	return &ListEventCommentsResult{
		DiscussionComments: *discussion,
		ReviewComments:     *reviews,
	}, nil
}

// ListCommentReplies returns child discussion comments for a parent discussion.
func (s *Service) ListCommentReplies(ctx context.Context, viewerUserID *uuid.UUID, eventID, commentID uuid.UUID, input ListCommentRepliesInput) (*ListCommentRepliesResult, error) {
	commentContext, err := s.loadReadableContext(ctx, eventID, viewerUserID)
	if err != nil {
		return nil, err
	}
	if commentContext.PrivacyLevel == domain.PrivacyPrivate {
		return nil, domain.ConflictError(domain.ErrorCodeCommentsNotAllowed, "Comments are available only for PUBLIC and PROTECTED events.")
	}

	parent, err := s.repo.GetDiscussionParentContext(ctx, eventID, commentID)
	if err != nil {
		return nil, s.mapCommentLookupError(err)
	}
	if parent.Type != domain.CommentTypeDiscussion || parent.ParentID != nil {
		return nil, domain.NotFoundError(domain.ErrorCodeCommentNotFound, "The requested discussion comment does not exist.")
	}

	limit, validationErrs := normalizeLimit(input.Limit)
	if len(validationErrs) > 0 {
		return nil, domain.ValidationError(validationErrs)
	}

	params := ListCommentsParams{
		Limit:                limit,
		RepositoryFetchLimit: limit + 1,
		CommentType:          domain.CommentTypeDiscussion,
	}
	if input.Cursor != nil && *input.Cursor != "" {
		cursor, err := decodeCommentCursor(*input.Cursor)
		if err != nil || cursor.Collection != commentCollectionReplies {
			return nil, domain.ValidationError(map[string]string{"cursor": "cursor is invalid"})
		}
		params.DecodedCursor = cursor
	}

	records, err := s.repo.ListReplies(ctx, eventID, commentID, params)
	if err != nil {
		return nil, err
	}
	hasNext := len(records) > limit
	if hasNext {
		records = records[:limit]
	}
	pageInfo, err := buildPageInfo(records, hasNext, commentCollectionReplies)
	if err != nil {
		return nil, err
	}

	return &ListCommentRepliesResult{
		Items:    toCommentResults(records),
		PageInfo: pageInfo,
	}, nil
}

// CreateDiscussionComment creates a top-level discussion comment or reply.
func (s *Service) CreateDiscussionComment(ctx context.Context, userID, eventID uuid.UUID, input CreateDiscussionCommentInput) (*CommentResult, error) {
	input.Message = normalizeMessage(input.Message)
	if errs := validateMessage(input.Message); len(errs) > 0 {
		return nil, domain.ValidationError(errs)
	}

	var result *CommentRecord
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		commentContext, err := s.loadWritableContext(ctx, eventID, userID)
		if err != nil {
			return err
		}
		if err := s.validateDiscussionWrite(commentContext); err != nil {
			return err
		}

		if input.ParentID != nil {
			parent, err := s.repo.GetDiscussionParentContext(ctx, eventID, *input.ParentID)
			if err != nil {
				return s.mapCommentLookupError(err)
			}
			if parent.Type != domain.CommentTypeDiscussion || parent.ParentID != nil {
				return domain.NotFoundError(domain.ErrorCodeCommentNotFound, "The requested discussion comment does not exist.")
			}
		}

		created, err := s.repo.CreateDiscussionComment(ctx, CreateDiscussionCommentParams{
			EventID:  eventID,
			UserID:   userID,
			Message:  input.Message,
			ParentID: input.ParentID,
		})
		if err != nil {
			return err
		}
		result = created
		return nil
	})
	if err != nil {
		return nil, err
	}

	mapped := toCommentResult(*result)
	return &mapped, nil
}

// UpsertReviewComment creates or updates the caller's completed-event review.
func (s *Service) UpsertReviewComment(ctx context.Context, userID, eventID uuid.UUID, input UpsertReviewCommentInput) (*CommentResult, error) {
	input.Message = normalizeMessage(input.Message)
	errs := validateMessage(input.Message)
	if input.Rating < domain.RatingMin || input.Rating > domain.RatingMax {
		errs["rating"] = "rating must be between 1 and 5"
	}
	if len(errs) > 0 {
		return nil, domain.ValidationError(errs)
	}

	var (
		result *CommentRecord
		hostID uuid.UUID
	)
	err := s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		commentContext, err := s.loadWritableContext(ctx, eventID, userID)
		if err != nil {
			return err
		}
		if err := s.validateReviewWrite(commentContext); err != nil {
			return err
		}

		var imageURL *string
		if input.ImageConfirmToken != nil && *input.ImageConfirmToken != "" {
			if s.imageConfirmer == nil {
				return domain.ForbiddenError(domain.ErrorCodeReviewImageNotAllowed, "Review image uploads are not available.")
			}
			confirmed, err := s.imageConfirmer.ConfirmEventReviewImageUpload(ctx, userID, eventID, imageupload.ConfirmUploadInput{
				ConfirmToken: *input.ImageConfirmToken,
			})
			if err != nil {
				return err
			}
			imageURL = &confirmed.BaseURL
		}

		created, err := s.repo.UpsertReviewComment(ctx, UpsertReviewCommentParams{
			EventID:  eventID,
			UserID:   userID,
			Message:  input.Message,
			Rating:   input.Rating,
			ImageURL: imageURL,
		})
		if err != nil {
			return err
		}
		result = created
		hostID = commentContext.HostUserID
		return s.refreshHostScore(ctx, hostID)
	})
	if err != nil {
		return nil, err
	}

	mapped := toCommentResult(*result)
	return &mapped, nil
}

// DeleteReviewComment hard deletes the caller's completed-event review.
func (s *Service) DeleteReviewComment(ctx context.Context, userID, eventID uuid.UUID) error {
	return s.unitOfWork.RunInTx(ctx, func(ctx context.Context) error {
		commentContext, err := s.loadWritableContext(ctx, eventID, userID)
		if err != nil {
			return err
		}
		if err := s.validateReviewWrite(commentContext); err != nil {
			return err
		}

		deleted, err := s.repo.DeleteReviewComment(ctx, eventID, userID)
		if err != nil {
			return err
		}
		if !deleted {
			return domain.NotFoundError(domain.ErrorCodeEventRatingNotFound, "The requested event rating does not exist.")
		}
		return s.refreshHostScore(ctx, commentContext.HostUserID)
	})
}

func (s *Service) listTopLevelCollection(ctx context.Context, eventID uuid.UUID, commentType domain.CommentType, limitInput *int, cursorInput *string, collection string) (*CommentCollectionResult, error) {
	limit, validationErrs := normalizeLimit(limitInput)
	if len(validationErrs) > 0 {
		return nil, domain.ValidationError(validationErrs)
	}

	params := ListCommentsParams{
		Limit:                limit,
		RepositoryFetchLimit: limit + 1,
		CommentType:          commentType,
	}
	if cursorInput != nil && *cursorInput != "" {
		cursor, err := decodeCommentCursor(*cursorInput)
		if err != nil || cursor.Collection != collection {
			return nil, domain.ValidationError(map[string]string{"cursor": "cursor is invalid"})
		}
		params.DecodedCursor = cursor
	}

	records, err := s.repo.ListTopLevelComments(ctx, eventID, params)
	if err != nil {
		return nil, err
	}
	hasNext := len(records) > limit
	if hasNext {
		records = records[:limit]
	}
	pageInfo, err := buildPageInfo(records, hasNext, collection)
	if err != nil {
		return nil, err
	}

	return &CommentCollectionResult{
		Items:    toCommentResults(records),
		PageInfo: pageInfo,
	}, nil
}

func (s *Service) loadReadableContext(ctx context.Context, eventID uuid.UUID, viewerUserID *uuid.UUID) (*EventCommentContext, error) {
	commentContext, err := s.repo.GetEventCommentContext(ctx, eventID, viewerUserID)
	if err != nil {
		return nil, s.mapEventLookupError(err)
	}
	if !commentContext.IsVisible {
		return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
	}
	return commentContext, nil
}

func (s *Service) loadWritableContext(ctx context.Context, eventID, userID uuid.UUID) (*EventCommentContext, error) {
	return s.loadReadableContext(ctx, eventID, &userID)
}

func (s *Service) validateDiscussionWrite(commentContext *EventCommentContext) error {
	if commentContext.PrivacyLevel == domain.PrivacyPrivate {
		return domain.ConflictError(domain.ErrorCodeCommentsNotAllowed, "Comments are available only for PUBLIC and PROTECTED events.")
	}
	switch commentContext.Status {
	case domain.EventStatusCanceled:
		return domain.ConflictError(domain.ErrorCodeCommentWriteNotAllowed, "Comments are closed for canceled events.")
	case domain.EventStatusCompleted:
		return domain.ConflictError(domain.ErrorCodeCommentWriteNotAllowed, "Only review comments are allowed after the event is completed.")
	case domain.EventStatusInProgress:
		if !commentContext.IsHost && !commentContext.IsQualifyingParticipant {
			return domain.ForbiddenError(domain.ErrorCodeCommentWriteNotAllowed, "Only participants can comment while the event is in progress.")
		}
	}
	return nil
}

func (s *Service) validateReviewWrite(commentContext *EventCommentContext) error {
	if commentContext.PrivacyLevel == domain.PrivacyPrivate {
		return domain.ConflictError(domain.ErrorCodeCommentsNotAllowed, "Reviews are available only for PUBLIC and PROTECTED events.")
	}
	if commentContext.IsHost {
		return domain.ForbiddenError(domain.ErrorCodeHostCannotRateSelf, "The event host cannot rate their own event.")
	}
	if commentContext.Status == domain.EventStatusCanceled {
		return domain.ConflictError(domain.ErrorCodeReviewNotAllowed, "Reviews are not allowed for canceled events.")
	}
	if commentContext.Status != domain.EventStatusCompleted {
		return domain.ConflictError(domain.ErrorCodeReviewNotAllowed, "Review comments are allowed only after the event is completed.")
	}
	if !commentContext.IsQualifyingParticipant {
		return domain.ForbiddenError(domain.ErrorCodeReviewNotAllowed, "Only participants can review this event.")
	}
	return nil
}

func (s *Service) refreshHostScore(ctx context.Context, hostID uuid.UUID) error {
	if s.scoreUpdater == nil {
		return nil
	}
	if err := s.scoreUpdater.RefreshHostedEventScore(ctx, hostID); err != nil {
		slog.WarnContext(ctx, "review score refresh failed",
			slog.String("operation", "comment.review.refresh_host_score"),
			slog.String("host_id", hostID.String()),
			slog.String("error", err.Error()),
		)
		return err
	}
	return nil
}

func (s *Service) mapEventLookupError(err error) error {
	if errors.Is(err, domain.ErrNotFound) {
		return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
	}
	return err
}

func (s *Service) mapCommentLookupError(err error) error {
	if errors.Is(err, domain.ErrNotFound) {
		return domain.NotFoundError(domain.ErrorCodeCommentNotFound, "The requested discussion comment does not exist.")
	}
	return err
}
