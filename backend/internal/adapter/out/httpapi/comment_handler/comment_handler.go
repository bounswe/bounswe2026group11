package comment_handler

import (
	"log/slog"
	"strconv"

	"github.com/bounswe/bounswe2026group11/backend/internal/adapter/out/httpapi"
	commentapp "github.com/bounswe/bounswe2026group11/backend/internal/application/comment"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Handler groups HTTP handlers for event comments and reviews.
type Handler struct {
	service commentapp.UseCase
}

// NewHandler constructs a comment handler.
func NewHandler(service commentapp.UseCase) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts comment routes under /events.
func RegisterRoutes(router fiber.Router, handler *Handler, auth fiber.Handler, optionalAuth fiber.Handler) {
	events := router.Group("/events")
	events.Get("/:id/comments", optionalAuth, handler.ListEventComments)
	events.Get("/:id/comments/:commentId/replies", optionalAuth, handler.ListCommentReplies)
	events.Post("/:id/comments", auth, handler.CreateDiscussionComment)
	events.Post("/:id/review-comments", auth, handler.UpsertReviewComment)
}

// ListEventComments handles GET /events/:id/comments.
func (h *Handler) ListEventComments(c *fiber.Ctx) error {
	eventID, err := parseUUIDParam(c, "id")
	if err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"id": "must be a valid UUID"}))
	}

	claims := httpapi.UserClaims(c)
	var viewerUserID *uuid.UUID
	if claims != nil {
		viewerUserID = &claims.UserID
	}

	result, svcErr := h.service.ListEventComments(c.UserContext(), viewerUserID, eventID, commentapp.ListEventCommentsInput{
		DiscussionLimit:  parseOptionalInt(c, "discussion_limit"),
		DiscussionCursor: parseOptionalString(c, "discussion_cursor"),
		ReviewLimit:      parseOptionalInt(c, "review_limit"),
		ReviewCursor:     parseOptionalString(c, "review_cursor"),
	})
	if svcErr != nil {
		return httpapi.WriteError(c, svcErr)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"event comments listed",
		httpapi.OperationAttr("comment.event.list"),
		httpapi.EventIDAttr(eventID),
		slog.Int("discussion_count", len(result.DiscussionComments.Items)),
		slog.Int("review_count", len(result.ReviewComments.Items)),
		slog.Bool("discussion_has_next", result.DiscussionComments.PageInfo.HasNext),
		slog.Bool("review_has_next", result.ReviewComments.PageInfo.HasNext),
	)

	return c.JSON(result)
}

// ListCommentReplies handles GET /events/:id/comments/:commentId/replies.
func (h *Handler) ListCommentReplies(c *fiber.Ctx) error {
	eventID, err := parseUUIDParam(c, "id")
	if err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"id": "must be a valid UUID"}))
	}
	commentID, err := parseUUIDParam(c, "commentId")
	if err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"commentId": "must be a valid UUID"}))
	}

	claims := httpapi.UserClaims(c)
	var viewerUserID *uuid.UUID
	if claims != nil {
		viewerUserID = &claims.UserID
	}

	result, svcErr := h.service.ListCommentReplies(c.UserContext(), viewerUserID, eventID, commentID, commentapp.ListCommentRepliesInput{
		Limit:  parseOptionalInt(c, "limit"),
		Cursor: parseOptionalString(c, "cursor"),
	})
	if svcErr != nil {
		return httpapi.WriteError(c, svcErr)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"comment replies listed",
		httpapi.OperationAttr("comment.replies.list"),
		httpapi.EventIDAttr(eventID),
		slog.String("comment_id", commentID.String()),
		slog.Int("result_count", len(result.Items)),
		slog.Bool("has_next", result.PageInfo.HasNext),
	)

	return c.JSON(result)
}

// CreateDiscussionComment handles POST /events/:id/comments.
func (h *Handler) CreateDiscussionComment(c *fiber.Ctx) error {
	eventID, err := parseUUIDParam(c, "id")
	if err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"id": "must be a valid UUID"}))
	}

	input, err := parseCreateDiscussionCommentBody(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	result, svcErr := h.service.CreateDiscussionComment(c.UserContext(), claims.UserID, eventID, input)
	if svcErr != nil {
		return httpapi.WriteError(c, svcErr)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"discussion comment created",
		httpapi.OperationAttr("comment.discussion.create"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		slog.Bool("is_reply", input.ParentID != nil),
	)

	return c.Status(fiber.StatusCreated).JSON(result)
}

// UpsertReviewComment handles POST /events/:id/review-comments.
func (h *Handler) UpsertReviewComment(c *fiber.Ctx) error {
	eventID, err := parseUUIDParam(c, "id")
	if err != nil {
		return httpapi.WriteError(c, domain.ValidationError(map[string]string{"id": "must be a valid UUID"}))
	}

	input, err := parseUpsertReviewCommentBody(c)
	if err != nil {
		return httpapi.WriteError(c, err)
	}

	claims := httpapi.UserClaims(c)
	result, svcErr := h.service.UpsertReviewComment(c.UserContext(), claims.UserID, eventID, input)
	if svcErr != nil {
		return httpapi.WriteError(c, svcErr)
	}

	httpapi.LogInfo(
		c.UserContext(),
		"review comment upserted",
		httpapi.OperationAttr("comment.review.upsert"),
		httpapi.UserIDAttr(claims.UserID),
		httpapi.EventIDAttr(eventID),
		slog.Int("rating", input.Rating),
		slog.Bool("has_image_token", input.ImageConfirmToken != nil && *input.ImageConfirmToken != ""),
	)

	return c.JSON(result)
}

func parseCreateDiscussionCommentBody(c *fiber.Ctx) (commentapp.CreateDiscussionCommentInput, error) {
	var body createDiscussionCommentBody
	if err := c.BodyParser(&body); err != nil {
		return commentapp.CreateDiscussionCommentInput{}, domain.ValidationError(map[string]string{"body": "must be valid JSON"})
	}

	var parentID *uuid.UUID
	if body.ParentID != nil && *body.ParentID != "" {
		parsed, err := uuid.Parse(*body.ParentID)
		if err != nil {
			return commentapp.CreateDiscussionCommentInput{}, domain.ValidationError(map[string]string{"parent_id": "must be a valid UUID"})
		}
		parentID = &parsed
	}

	return commentapp.CreateDiscussionCommentInput{
		Message:  body.Message,
		ParentID: parentID,
	}, nil
}

func parseUpsertReviewCommentBody(c *fiber.Ctx) (commentapp.UpsertReviewCommentInput, error) {
	var body upsertReviewCommentBody
	if err := c.BodyParser(&body); err != nil {
		return commentapp.UpsertReviewCommentInput{}, domain.ValidationError(map[string]string{"body": "must be valid JSON"})
	}

	return commentapp.UpsertReviewCommentInput{
		Message:           body.Message,
		Rating:            body.Rating,
		ImageConfirmToken: body.ImageConfirmToken,
	}, nil
}

func parseUUIDParam(c *fiber.Ctx, name string) (uuid.UUID, error) {
	return uuid.Parse(c.Params(name))
}

func parseOptionalString(c *fiber.Ctx, name string) *string {
	value := c.Query(name)
	if value == "" {
		return nil
	}
	return &value
}

func parseOptionalInt(c *fiber.Ctx, name string) *int {
	value := c.Query(name)
	if value == "" {
		return nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		invalid := 0
		return &invalid
	}
	return &parsed
}
