package postgres

import (
	"context"
	"errors"
	"fmt"

	commentapp "github.com/bounswe/bounswe2026group11/backend/internal/application/comment"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CommentRepository is the Postgres-backed implementation of comment.Repository.
type CommentRepository struct {
	pool *pgxpool.Pool
	db   execer
}

// NewCommentRepository returns a repository that executes queries against the
// given connection pool.
func NewCommentRepository(pool *pgxpool.Pool) *CommentRepository {
	return &CommentRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

var _ commentapp.Repository = (*CommentRepository)(nil)

func (r *CommentRepository) GetEventCommentContext(ctx context.Context, eventID uuid.UUID, viewerUserID *uuid.UUID) (*commentapp.EventCommentContext, error) {
	var (
		record                  commentapp.EventCommentContext
		privacyLevel            string
		status                  string
		viewer                  pgtype.UUID
		isVisible               bool
		isHost                  bool
		isApprovedParticipant   bool
		isQualifyingParticipant bool
	)
	if viewerUserID != nil {
		viewer = pgtype.UUID{Bytes: *viewerUserID, Valid: true}
	}

	err := r.db.QueryRow(ctx, `
		SELECT
			e.id,
			e.host_id,
			e.privacy_level,
			CASE
				WHEN e.status = 'ACTIVE' AND e.end_time < NOW() THEN 'COMPLETED'
				WHEN e.status = 'ACTIVE' AND e.start_time < NOW() THEN 'IN_PROGRESS'
				WHEN e.status = 'IN_PROGRESS' AND e.end_time < NOW() THEN 'COMPLETED'
				ELSE e.status
			END AS status,
			e.start_time,
			(
				e.privacy_level IN ($2, $3)
				OR ($4::uuid IS NOT NULL AND e.host_id = $4)
				OR EXISTS (
					SELECT 1 FROM participation p
					WHERE p.event_id = e.id
					  AND p.user_id = $4
					  AND p.status IN ($5, $6, $7)
				)
				OR EXISTS (
					SELECT 1 FROM invitation inv
					WHERE inv.event_id = e.id
					  AND inv.invited_user_id = $4
					  AND inv.status IN ($8, $9)
				)
			) AS is_visible,
			($4::uuid IS NOT NULL AND e.host_id = $4) AS is_host,
			EXISTS (
				SELECT 1 FROM participation p
				WHERE p.event_id = e.id
				  AND p.user_id = $4
				  AND p.status = $5
			) AS is_approved_participant,
			EXISTS (
				SELECT 1 FROM participation p
				WHERE p.event_id = e.id
				  AND p.user_id = $4
				  AND (
					p.status = $5
					OR (p.status = $6 AND p.updated_at >= e.start_time)
				  )
			) AS is_qualifying_participant
		FROM event e
		WHERE e.id = $1
	`,
		eventID,
		domain.PrivacyPublic,
		domain.PrivacyProtected,
		viewer,
		domain.ParticipationStatusApproved,
		domain.ParticipationStatusLeaved,
		domain.ParticipationStatusCanceled,
		string(domain.InvitationStatusAccepted),
		string(domain.InvitationStatusPending),
	).Scan(
		&record.EventID,
		&record.HostUserID,
		&privacyLevel,
		&status,
		&record.StartTime,
		&isVisible,
		&isHost,
		&isApprovedParticipant,
		&isQualifyingParticipant,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get event comment context: %w", err)
	}

	record.PrivacyLevel = domain.EventPrivacyLevel(privacyLevel)
	record.Status = domain.EventStatus(status)
	record.IsVisible = isVisible
	record.IsHost = isHost
	record.IsApprovedParticipant = isApprovedParticipant
	record.IsQualifyingParticipant = isQualifyingParticipant
	return &record, nil
}

func (r *CommentRepository) GetDiscussionParentContext(ctx context.Context, eventID, parentID uuid.UUID) (*commentapp.DiscussionParentContext, error) {
	var (
		record      commentapp.DiscussionParentContext
		commentType string
		parent      pgtype.UUID
	)
	err := r.db.QueryRow(ctx, `
		SELECT id, event_id, comment_type, parent_id
		FROM event_comment
		WHERE id = $1
		  AND event_id = $2
	`, parentID, eventID).Scan(&record.ID, &record.EventID, &commentType, &parent)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get discussion parent context: %w", err)
	}

	record.Type = domain.CommentType(commentType)
	record.ParentID = uuidPtr(parent)
	return &record, nil
}

func (r *CommentRepository) ListTopLevelComments(ctx context.Context, eventID uuid.UUID, params commentapp.ListCommentsParams) ([]commentapp.CommentRecord, error) {
	args := []any{eventID, string(params.CommentType)}
	cursorClause := buildCommentCursorClause(params, &args, "ec.created_at", "ec.id")
	args = append(args, params.RepositoryFetchLimit)

	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT
			ec.id,
			ec.event_id,
			ec.user_id,
			u.username,
			pr.display_name,
			pr.avatar_url,
			ec.comment_type,
			ec.message,
			ec.parent_id,
			ec.rating,
			ec.image_url,
			ec.likes_count,
			ec.reply_count,
			ec.created_at,
			ec.updated_at
		FROM event_comment ec
		JOIN app_user u ON u.id = ec.user_id
		LEFT JOIN profile pr ON pr.user_id = u.id
		WHERE ec.event_id = $1
		  AND ec.comment_type = $2
		  AND ec.parent_id IS NULL
		  %s
		ORDER BY ec.created_at DESC, ec.id DESC
		LIMIT $%d
	`, cursorClause, len(args)), args...)
	if err != nil {
		return nil, fmt.Errorf("list top-level comments: %w", err)
	}
	defer rows.Close()

	return scanCommentRecords(rows, "list top-level comments")
}

func (r *CommentRepository) ListReplies(ctx context.Context, eventID, parentID uuid.UUID, params commentapp.ListCommentsParams) ([]commentapp.CommentRecord, error) {
	args := []any{eventID, parentID, string(domain.CommentTypeDiscussion)}
	cursorClause := buildCommentCursorClause(params, &args, "ec.created_at", "ec.id")
	args = append(args, params.RepositoryFetchLimit)

	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT
			ec.id,
			ec.event_id,
			ec.user_id,
			u.username,
			pr.display_name,
			pr.avatar_url,
			ec.comment_type,
			ec.message,
			ec.parent_id,
			ec.rating,
			ec.image_url,
			ec.likes_count,
			ec.reply_count,
			ec.created_at,
			ec.updated_at
		FROM event_comment ec
		JOIN app_user u ON u.id = ec.user_id
		LEFT JOIN profile pr ON pr.user_id = u.id
		WHERE ec.event_id = $1
		  AND ec.parent_id = $2
		  AND ec.comment_type = $3
		  %s
		ORDER BY ec.created_at DESC, ec.id DESC
		LIMIT $%d
	`, cursorClause, len(args)), args...)
	if err != nil {
		return nil, fmt.Errorf("list comment replies: %w", err)
	}
	defer rows.Close()

	return scanCommentRecords(rows, "list comment replies")
}

func (r *CommentRepository) CreateDiscussionComment(ctx context.Context, params commentapp.CreateDiscussionCommentParams) (*commentapp.CommentRecord, error) {
	return scanCommentRecord(r.db.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO event_comment (event_id, user_id, comment_type, message, parent_id)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, event_id, user_id, comment_type, message, parent_id, rating, image_url, likes_count, reply_count, created_at, updated_at
		)
		SELECT
			i.id,
			i.event_id,
			i.user_id,
			u.username,
			pr.display_name,
			pr.avatar_url,
			i.comment_type,
			i.message,
			i.parent_id,
			i.rating,
			i.image_url,
			i.likes_count,
			i.reply_count,
			i.created_at,
			i.updated_at
		FROM inserted i
		JOIN app_user u ON u.id = i.user_id
		LEFT JOIN profile pr ON pr.user_id = u.id
	`, params.EventID, params.UserID, string(domain.CommentTypeDiscussion), params.Message, params.ParentID), "create discussion comment")
}

func (r *CommentRepository) UpsertReviewComment(ctx context.Context, params commentapp.UpsertReviewCommentParams) (*commentapp.CommentRecord, error) {
	return scanCommentRecord(r.db.QueryRow(ctx, `
		WITH upserted AS (
			INSERT INTO event_comment (event_id, user_id, comment_type, message, rating, image_url)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (event_id, user_id) WHERE comment_type = 'REVIEW'
			DO UPDATE SET
				message = EXCLUDED.message,
				rating = EXCLUDED.rating,
				image_url = COALESCE(EXCLUDED.image_url, event_comment.image_url),
				updated_at = now()
			RETURNING id, event_id, user_id, comment_type, message, parent_id, rating, image_url, likes_count, reply_count, created_at, updated_at
		)
		SELECT
			uo.id,
			uo.event_id,
			uo.user_id,
			u.username,
			pr.display_name,
			pr.avatar_url,
			uo.comment_type,
			uo.message,
			uo.parent_id,
			uo.rating,
			uo.image_url,
			uo.likes_count,
			uo.reply_count,
			uo.created_at,
			uo.updated_at
		FROM upserted uo
		JOIN app_user u ON u.id = uo.user_id
		LEFT JOIN profile pr ON pr.user_id = u.id
	`, params.EventID, params.UserID, string(domain.CommentTypeReview), params.Message, params.Rating, params.ImageURL), "upsert review comment")
}

func (r *CommentRepository) DeleteReviewComment(ctx context.Context, eventID, userID uuid.UUID) (bool, error) {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM event_comment
		WHERE event_id = $1
		  AND user_id = $2
		  AND comment_type = $3
	`, eventID, userID, string(domain.CommentTypeReview))
	if err != nil {
		return false, fmt.Errorf("delete review comment: %w", err)
	}

	return tag.RowsAffected() == 1, nil
}

func buildCommentCursorClause(params commentapp.ListCommentsParams, args *[]any, createdAtColumn, idColumn string) string {
	if params.DecodedCursor == nil {
		return ""
	}
	*args = append(*args, params.DecodedCursor.CreatedAt, params.DecodedCursor.CommentID)
	createdAtIndex := len(*args) - 1
	idIndex := len(*args)
	return fmt.Sprintf("AND (%s, %s) < ($%d, $%d)", createdAtColumn, idColumn, createdAtIndex, idIndex)
}

func scanCommentRecords(rows pgx.Rows, operation string) ([]commentapp.CommentRecord, error) {
	records := make([]commentapp.CommentRecord, 0)
	for rows.Next() {
		record, err := scanCommentRecord(rows, operation)
		if err != nil {
			return nil, err
		}
		records = append(records, *record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("%s rows: %w", operation, err)
	}
	return records, nil
}

func scanCommentRecord(row pgx.Row, operation string) (*commentapp.CommentRecord, error) {
	var (
		record      commentapp.CommentRecord
		commentType string
		parentID    pgtype.UUID
		rating      pgtype.Int4
		imageURL    pgtype.Text
		displayName pgtype.Text
		avatarURL   pgtype.Text
	)

	if err := row.Scan(
		&record.ID,
		&record.EventID,
		&record.User.ID,
		&record.User.Username,
		&displayName,
		&avatarURL,
		&commentType,
		&record.Message,
		&parentID,
		&rating,
		&imageURL,
		&record.LikesCount,
		&record.ReplyCount,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("%s: %w", operation, err)
	}

	record.Type = domain.CommentType(commentType)
	record.ParentID = uuidPtr(parentID)
	if rating.Valid {
		value := int(rating.Int32)
		record.Rating = &value
	}
	record.ImageURL = textPtr(imageURL)
	record.User.DisplayName = textPtr(displayName)
	record.User.AvatarURL = textPtr(avatarURL)
	return &record, nil
}
