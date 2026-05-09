package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	adminapp "github.com/bounswe/bounswe2026group11/backend/internal/application/admin"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AdminRepository is the Postgres-backed implementation of admin.Repository.
type AdminRepository struct {
	pool *pgxpool.Pool
	db   execer
}

var _ adminapp.Repository = (*AdminRepository)(nil)

// NewAdminRepository returns a repository that executes read-only admin queries.
func NewAdminRepository(pool *pgxpool.Pool) *AdminRepository {
	return &AdminRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

func (r *AdminRepository) ListUsers(ctx context.Context, input adminapp.ListUsersInput) (*adminapp.ListUsersResult, error) {
	args := []any{}
	where := []string{"TRUE"}
	add := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}

	if input.Query != nil {
		placeholder := add("%" + *input.Query + "%")
		where = append(where, "(username ILIKE "+placeholder+" OR email ILIKE "+placeholder+" OR phone_number ILIKE "+placeholder+")")
	}
	if input.Status != nil {
		where = append(where, "status = "+add(input.Status.String()))
	}
	if input.Role != nil {
		where = append(where, "role = "+add(input.Role.String()))
	}
	if input.CreatedFrom != nil {
		where = append(where, "created_at >= "+add(*input.CreatedFrom))
	}
	if input.CreatedTo != nil {
		where = append(where, "created_at <= "+add(*input.CreatedTo))
	}

	limitPlaceholder := add(input.Limit)
	offsetPlaceholder := add(input.Offset)
	query := `
		SELECT id, username, email, phone_number, email_verified_at IS NOT NULL, last_login, status, role, created_at, updated_at, COUNT(*) OVER()
		FROM app_user
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC, id DESC
		LIMIT ` + limitPlaceholder + ` OFFSET ` + offsetPlaceholder

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list users: %w", err)
	}
	defer rows.Close()

	items := []adminapp.AdminUserItem{}
	totalCount := 0
	for rows.Next() {
		var item adminapp.AdminUserItem
		var phone pgtype.Text
		var lastLogin pgtype.Timestamptz
		var status string
		var role string
		if err := rows.Scan(
			&item.ID,
			&item.Username,
			&item.Email,
			&phone,
			&item.EmailVerified,
			&lastLogin,
			&status,
			&role,
			&item.CreatedAt,
			&item.UpdatedAt,
			&totalCount,
		); err != nil {
			return nil, fmt.Errorf("admin scan user: %w", err)
		}
		item.PhoneNumber = textPtr(phone)
		item.LastLogin = timestamptzPtr(lastLogin)
		item.Status = status
		item.Role = role
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list users rows: %w", err)
	}

	return &adminapp.ListUsersResult{Items: items, PageMeta: pageMeta(input.PageInput, totalCount, len(items))}, nil
}

func (r *AdminRepository) ListEvents(ctx context.Context, input adminapp.ListEventsInput) (*adminapp.ListEventsResult, error) {
	args := []any{}
	where := []string{"TRUE"}
	add := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}

	if input.Query != nil {
		placeholder := add("%" + *input.Query + "%")
		where = append(where, "(e.title ILIKE "+placeholder+" OR e.description ILIKE "+placeholder+" OR u.username ILIKE "+placeholder+")")
	}
	if input.HostID != nil {
		where = append(where, "e.host_id = "+add(*input.HostID))
	}
	if input.CategoryID != nil {
		where = append(where, "e.category_id = "+add(*input.CategoryID))
	}
	if input.PrivacyLevel != nil {
		where = append(where, "e.privacy_level = "+add(string(*input.PrivacyLevel)))
	}
	if input.Status != nil {
		where = append(where, "e.status = "+add(string(*input.Status)))
	}
	if input.StartFrom != nil {
		where = append(where, "e.start_time >= "+add(*input.StartFrom))
	}
	if input.StartTo != nil {
		where = append(where, "e.start_time <= "+add(*input.StartTo))
	}

	limitPlaceholder := add(input.Limit)
	offsetPlaceholder := add(input.Offset)
	query := `
		SELECT e.id, e.host_id, u.username, e.title, e.category_id, c.name, e.start_time, e.end_time,
		       e.privacy_level, e.status, e.capacity, e.approved_participant_count, e.pending_participant_count,
		       e.created_at, e.updated_at, COUNT(*) OVER()
		FROM event e
		JOIN app_user u ON u.id = e.host_id
		LEFT JOIN event_category c ON c.id = e.category_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY e.created_at DESC, e.id DESC
		LIMIT ` + limitPlaceholder + ` OFFSET ` + offsetPlaceholder

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list events: %w", err)
	}
	defer rows.Close()

	items := []adminapp.AdminEventItem{}
	totalCount := 0
	for rows.Next() {
		var item adminapp.AdminEventItem
		var categoryID pgtype.Int4
		var categoryName pgtype.Text
		var endTime pgtype.Timestamptz
		var capacity pgtype.Int4
		if err := rows.Scan(
			&item.ID,
			&item.HostID,
			&item.HostUsername,
			&item.Title,
			&categoryID,
			&categoryName,
			&item.StartTime,
			&endTime,
			&item.PrivacyLevel,
			&item.Status,
			&capacity,
			&item.ApprovedParticipantCount,
			&item.PendingParticipantCount,
			&item.CreatedAt,
			&item.UpdatedAt,
			&totalCount,
		); err != nil {
			return nil, fmt.Errorf("admin scan event: %w", err)
		}
		item.CategoryID = intPtr(categoryID)
		item.CategoryName = textPtr(categoryName)
		item.EndTime = timestamptzPtr(endTime)
		item.Capacity = intPtr(capacity)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list events rows: %w", err)
	}

	return &adminapp.ListEventsResult{Items: items, PageMeta: pageMeta(input.PageInput, totalCount, len(items))}, nil
}

func (r *AdminRepository) ListParticipations(ctx context.Context, input adminapp.ListParticipationsInput) (*adminapp.ListParticipationsResult, error) {
	args := []any{}
	where := []string{"TRUE"}
	add := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}

	if input.Query != nil {
		placeholder := add("%" + *input.Query + "%")
		where = append(where, "(e.title ILIKE "+placeholder+" OR u.username ILIKE "+placeholder+" OR u.email ILIKE "+placeholder+")")
	}
	if input.Status != nil {
		where = append(where, "p.status = "+add(input.Status.String()))
	}
	if input.EventID != nil {
		where = append(where, "p.event_id = "+add(*input.EventID))
	}
	if input.UserID != nil {
		where = append(where, "p.user_id = "+add(*input.UserID))
	}
	if input.CreatedFrom != nil {
		where = append(where, "p.created_at >= "+add(*input.CreatedFrom))
	}
	if input.CreatedTo != nil {
		where = append(where, "p.created_at <= "+add(*input.CreatedTo))
	}

	limitPlaceholder := add(input.Limit)
	offsetPlaceholder := add(input.Offset)
	query := `
		SELECT p.id, p.event_id, e.title, p.user_id, u.username, u.email, p.status, p.reconfirmed_at,
		       p.created_at, p.updated_at, COUNT(*) OVER()
		FROM participation p
		JOIN event e ON e.id = p.event_id
		JOIN app_user u ON u.id = p.user_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY p.created_at DESC, p.id DESC
		LIMIT ` + limitPlaceholder + ` OFFSET ` + offsetPlaceholder

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list participations: %w", err)
	}
	defer rows.Close()

	items := []adminapp.AdminParticipationItem{}
	totalCount := 0
	for rows.Next() {
		var item adminapp.AdminParticipationItem
		var reconfirmedAt pgtype.Timestamptz
		if err := rows.Scan(
			&item.ID,
			&item.EventID,
			&item.EventTitle,
			&item.UserID,
			&item.Username,
			&item.UserEmail,
			&item.Status,
			&reconfirmedAt,
			&item.CreatedAt,
			&item.UpdatedAt,
			&totalCount,
		); err != nil {
			return nil, fmt.Errorf("admin scan participation: %w", err)
		}
		item.ReconfirmedAt = timestamptzPtr(reconfirmedAt)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list participations rows: %w", err)
	}

	return &adminapp.ListParticipationsResult{Items: items, PageMeta: pageMeta(input.PageInput, totalCount, len(items))}, nil
}

func (r *AdminRepository) ListTickets(ctx context.Context, input adminapp.ListTicketsInput) (*adminapp.ListTicketsResult, error) {
	args := []any{}
	where := []string{"TRUE"}
	add := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}

	if input.Query != nil {
		placeholder := add("%" + *input.Query + "%")
		where = append(where, "(e.title ILIKE "+placeholder+" OR u.username ILIKE "+placeholder+" OR u.email ILIKE "+placeholder+")")
	}
	if input.Status != nil {
		where = append(where, "t.status = "+add(input.Status.String()))
	}
	if input.EventID != nil {
		where = append(where, "p.event_id = "+add(*input.EventID))
	}
	if input.UserID != nil {
		where = append(where, "p.user_id = "+add(*input.UserID))
	}
	if input.ParticipationID != nil {
		where = append(where, "t.participation_id = "+add(*input.ParticipationID))
	}
	if input.CreatedFrom != nil {
		where = append(where, "t.created_at >= "+add(*input.CreatedFrom))
	}
	if input.CreatedTo != nil {
		where = append(where, "t.created_at <= "+add(*input.CreatedTo))
	}

	limitPlaceholder := add(input.Limit)
	offsetPlaceholder := add(input.Offset)
	query := `
		SELECT t.id, t.participation_id, p.event_id, e.title, p.user_id, u.username, u.email,
		       t.status, t.expires_at, t.used_at, t.canceled_at, t.created_at, t.updated_at, COUNT(*) OVER()
		FROM ticket t
		JOIN participation p ON p.id = t.participation_id
		JOIN event e ON e.id = p.event_id
		JOIN app_user u ON u.id = p.user_id
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY t.created_at DESC, t.id DESC
		LIMIT ` + limitPlaceholder + ` OFFSET ` + offsetPlaceholder

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list tickets: %w", err)
	}
	defer rows.Close()

	items := []adminapp.AdminTicketItem{}
	totalCount := 0
	for rows.Next() {
		var item adminapp.AdminTicketItem
		var usedAt pgtype.Timestamptz
		var canceledAt pgtype.Timestamptz
		if err := rows.Scan(
			&item.ID,
			&item.ParticipationID,
			&item.EventID,
			&item.EventTitle,
			&item.UserID,
			&item.Username,
			&item.UserEmail,
			&item.Status,
			&item.ExpiresAt,
			&usedAt,
			&canceledAt,
			&item.CreatedAt,
			&item.UpdatedAt,
			&totalCount,
		); err != nil {
			return nil, fmt.Errorf("admin scan ticket: %w", err)
		}
		item.UsedAt = timestamptzPtr(usedAt)
		item.CanceledAt = timestamptzPtr(canceledAt)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list tickets rows: %w", err)
	}

	return &adminapp.ListTicketsResult{Items: items, PageMeta: pageMeta(input.PageInput, totalCount, len(items))}, nil
}

func (r *AdminRepository) ListNotifications(ctx context.Context, input adminapp.ListNotificationsInput) (*adminapp.ListNotificationsResult, error) {
	args := []any{}
	where := []string{"TRUE"}
	add := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}

	if input.Query != nil {
		placeholder := add("%" + *input.Query + "%")
		where = append(where, "(n.title ILIKE "+placeholder+" OR n.body ILIKE "+placeholder+" OR u.username ILIKE "+placeholder+" OR u.email ILIKE "+placeholder+")")
	}
	if input.UserID != nil {
		where = append(where, "n.receiver_user_id = "+add(*input.UserID))
	}
	if input.EventID != nil {
		where = append(where, "n.event_id = "+add(*input.EventID))
	}
	if input.Type != nil {
		where = append(where, "n.type = "+add(*input.Type))
	}
	if input.IsRead != nil {
		where = append(where, "n.is_read = "+add(*input.IsRead))
	}
	if input.CreatedFrom != nil {
		where = append(where, "n.created_at >= "+add(*input.CreatedFrom))
	}
	if input.CreatedTo != nil {
		where = append(where, "n.created_at <= "+add(*input.CreatedTo))
	}

	limitPlaceholder := add(input.Limit)
	offsetPlaceholder := add(input.Offset)
	query := `
		SELECT n.id, n.receiver_user_id, u.username, u.email, n.event_id, e.title, n.title, n.type,
		       n.body, n.deep_link, n.data, n.is_read, n.read_at, n.deleted_at,
		       COUNT(a.id) FILTER (WHERE a.method = 'SSE' AND a.status = 'SENT') AS sse_sent_count,
		       COUNT(a.id) FILTER (WHERE a.method = 'FCM' AND a.status = 'SENT') AS push_sent_count,
		       COUNT(a.id) FILTER (WHERE a.method = 'FCM' AND a.status = 'FAILED') AS push_failed_count,
		       n.created_at, n.updated_at, COUNT(*) OVER()
		FROM notification n
		JOIN app_user u ON u.id = n.receiver_user_id
		LEFT JOIN event e ON e.id = n.event_id
		LEFT JOIN notification_delivery_attempt a ON a.notification_id = n.id
		WHERE ` + strings.Join(where, " AND ") + `
		GROUP BY n.id, u.username, u.email, e.title
		ORDER BY n.created_at DESC, n.id DESC
		LIMIT ` + limitPlaceholder + ` OFFSET ` + offsetPlaceholder

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list notifications: %w", err)
	}
	defer rows.Close()

	items := []adminapp.AdminNotificationItem{}
	totalCount := 0
	for rows.Next() {
		var (
			item       adminapp.AdminNotificationItem
			eventID    pgtype.UUID
			eventTitle pgtype.Text
			typ        pgtype.Text
			deepLink   pgtype.Text
			data       []byte
			readAt     pgtype.Timestamptz
			deletedAt  pgtype.Timestamptz
		)
		if err := rows.Scan(
			&item.ID,
			&item.ReceiverUserID,
			&item.Username,
			&item.UserEmail,
			&eventID,
			&eventTitle,
			&item.Title,
			&typ,
			&item.Body,
			&deepLink,
			&data,
			&item.IsRead,
			&readAt,
			&deletedAt,
			&item.SSESentCount,
			&item.PushSentCount,
			&item.PushFailedCount,
			&item.CreatedAt,
			&item.UpdatedAt,
			&totalCount,
		); err != nil {
			return nil, fmt.Errorf("admin scan notification: %w", err)
		}
		item.EventID = uuidPtr(eventID)
		item.EventTitle = textPtr(eventTitle)
		item.Type = textPtr(typ)
		item.DeepLink = textPtr(deepLink)
		item.ReadAt = timestamptzPtr(readAt)
		item.DeletedAt = timestamptzPtr(deletedAt)
		item.Data = map[string]string{}
		if len(data) > 0 {
			if err := json.Unmarshal(data, &item.Data); err != nil {
				return nil, fmt.Errorf("admin unmarshal notification data: %w", err)
			}
		}
		if item.Data == nil {
			item.Data = map[string]string{}
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list notifications rows: %w", err)
	}

	return &adminapp.ListNotificationsResult{Items: items, PageMeta: pageMeta(input.PageInput, totalCount, len(items))}, nil
}

func (r *AdminRepository) ListEventReports(ctx context.Context, input adminapp.ListEventReportsInput) (*adminapp.ListEventReportsResult, error) {
	args := []any{}
	where := []string{"TRUE"}
	add := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}
	if input.Query != nil {
		placeholder := add("%" + *input.Query + "%")
		where = append(where, "(e.title ILIKE "+placeholder+" OR u.username ILIKE "+placeholder+" OR u.email ILIKE "+placeholder+" OR er.message ILIKE "+placeholder+")")
	}
	if input.Status != nil {
		where = append(where, "er.status = "+add(input.Status.String()))
	}
	if input.ReportCategory != nil {
		where = append(where, "er.report_category = "+add(string(*input.ReportCategory)))
	}
	if input.EventID != nil {
		where = append(where, "er.event_id = "+add(*input.EventID))
	}
	if input.ReporterUserID != nil {
		where = append(where, "er.reporter_user_id = "+add(*input.ReporterUserID))
	}
	if input.CreatedFrom != nil {
		where = append(where, "er.created_at >= "+add(*input.CreatedFrom))
	}
	if input.CreatedTo != nil {
		where = append(where, "er.created_at <= "+add(*input.CreatedTo))
	}
	limitPlaceholder := add(input.Limit)
	offsetPlaceholder := add(input.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT er.id, er.event_id, e.title, er.reporter_user_id, u.username, u.email,
		       er.report_category, er.message, er.image_url, er.status, er.created_at, er.updated_at, COUNT(*) OVER()
		FROM event_report er
		LEFT JOIN event e ON e.id = er.event_id
		LEFT JOIN app_user u ON u.id = er.reporter_user_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY er.created_at DESC, er.id DESC
		LIMIT `+limitPlaceholder+` OFFSET `+offsetPlaceholder, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list event reports: %w", err)
	}
	defer rows.Close()
	items := []adminapp.AdminEventReportItem{}
	totalCount := 0
	for rows.Next() {
		item, err := scanAdminEventReport(rows, &totalCount)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list event reports rows: %w", err)
	}
	return &adminapp.ListEventReportsResult{Items: items, PageMeta: pageMeta(input.PageInput, totalCount, len(items))}, nil
}

func (r *AdminRepository) ListCategories(ctx context.Context) (*adminapp.ListCategoriesResult, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, created_at, updated_at
		FROM event_category
		ORDER BY id ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("admin list categories: %w", err)
	}
	defer rows.Close()
	items := []adminapp.AdminCategoryItem{}
	for rows.Next() {
		var item adminapp.AdminCategoryItem
		if err := rows.Scan(&item.ID, &item.Name, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("admin scan category: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list categories rows: %w", err)
	}
	return &adminapp.ListCategoriesResult{Items: items}, nil
}

func (r *AdminRepository) CreateCategory(ctx context.Context, name string) (*adminapp.AdminCategoryItem, error) {
	var item adminapp.AdminCategoryItem
	err := r.db.QueryRow(ctx, `
		INSERT INTO event_category (name)
		VALUES ($1)
		RETURNING id, name, created_at, updated_at
	`, name).Scan(&item.ID, &item.Name, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, domain.ConflictError("category_already_exists", "The category already exists.")
		}
		return nil, fmt.Errorf("admin create category: %w", err)
	}
	return &item, nil
}

func (r *AdminRepository) DeleteCategory(ctx context.Context, categoryID int) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM event_category WHERE id = $1`, categoryID)
	if err != nil {
		if isForeignKeyViolation(err) {
			return domain.ConflictError("category_in_use", "This category is used by one or more events.")
		}
		return fmt.Errorf("admin delete category: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFoundError("category_not_found", "The requested category does not exist.")
	}
	return nil
}

func (r *AdminRepository) UpdateEventReportStatus(ctx context.Context, reportID uuid.UUID, status domain.EventReportStatus) (*adminapp.AdminEventReportItem, error) {
	item, err := scanAdminEventReportRow(r.db.QueryRow(ctx, `
		WITH er AS (
			UPDATE event_report
			SET status = $2, updated_at = NOW()
			WHERE id = $1
			RETURNING id, event_id, reporter_user_id, report_category, message, image_url, status, created_at, updated_at
		)
		SELECT er.id, er.event_id, e.title, er.reporter_user_id, u.username, u.email,
		       er.report_category, er.message, er.image_url, er.status, er.created_at, er.updated_at
		FROM er
		LEFT JOIN event e ON e.id = er.event_id
		LEFT JOIN app_user u ON u.id = er.reporter_user_id
	`, reportID, status))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.NotFoundError("event_report_not_found", "The requested event report does not exist.")
		}
		return nil, err
	}
	return item, nil
}

func (r *AdminRepository) UpdateEventStatus(ctx context.Context, eventID uuid.UUID, status domain.EventStatus) (*adminapp.AdminEventItem, error) {
	item, err := scanAdminEventRow(r.db.QueryRow(ctx, `
		WITH e AS (
			UPDATE event
			SET status = $2, updated_at = NOW()
			WHERE id = $1
			RETURNING id, host_id, title, category_id, start_time, end_time, privacy_level, status,
			          capacity, approved_participant_count, pending_participant_count, created_at, updated_at
		)
		SELECT e.id, e.host_id, u.username, e.title, e.category_id, c.name, e.start_time, e.end_time,
		       e.privacy_level, e.status, e.capacity, e.approved_participant_count, e.pending_participant_count,
		       e.created_at, e.updated_at
		FROM e
		JOIN app_user u ON u.id = e.host_id
		LEFT JOIN event_category c ON c.id = e.category_id
	`, eventID, status))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		return nil, err
	}
	return item, nil
}

func (r *AdminRepository) CancelEvent(ctx context.Context, eventID uuid.UUID) (bool, error) {
	var current string
	err := r.db.QueryRow(ctx, `SELECT status FROM event WHERE id = $1 FOR UPDATE`, eventID).Scan(&current)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		return false, fmt.Errorf("admin lock event: %w", err)
	}
	if current == string(domain.EventStatusCanceled) {
		return true, nil
	}
	if _, err := r.db.Exec(ctx, `UPDATE event SET status = $2, updated_at = NOW() WHERE id = $1`, eventID, domain.EventStatusCanceled); err != nil {
		return false, fmt.Errorf("admin cancel event: %w", err)
	}
	return false, nil
}

func (r *AdminRepository) CancelEventParticipations(ctx context.Context, eventID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE participation
		SET status = $2, updated_at = NOW()
		WHERE event_id = $1
		  AND status IN ($3, $4)
	`, eventID, domain.ParticipationStatusCanceled, domain.ParticipationStatusApproved, domain.ParticipationStatusPending)
	if err != nil {
		return fmt.Errorf("admin cancel event participations: %w", err)
	}
	return nil
}

func (r *AdminRepository) CancelPendingInvitationsForEvent(ctx context.Context, eventID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE invitation SET status = $2, updated_at = NOW()
		WHERE event_id = $1 AND status = $3
	`, eventID, domain.InvitationStatusCanceled, domain.InvitationStatusPending)
	return wrapExecErr(err, "admin cancel event invitations")
}

func (r *AdminRepository) CancelPendingJoinRequestsForEvent(ctx context.Context, eventID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE join_request SET status = $2, updated_at = NOW()
		WHERE event_id = $1 AND status = $3
	`, eventID, domain.JoinRequestStatusCanceled, domain.JoinRequestStatusPending)
	return wrapExecErr(err, "admin cancel event join requests")
}

func (r *AdminRepository) GetUserStatus(ctx context.Context, userID uuid.UUID, forUpdate bool) (*domain.UserStatus, error) {
	query := `SELECT status FROM app_user WHERE id = $1`
	if forUpdate {
		query += ` FOR UPDATE`
	}
	var raw string
	err := r.db.QueryRow(ctx, query, userID).Scan(&raw)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("admin get user status: %w", err)
	}
	status, ok := domain.ParseUserStatus(raw)
	if !ok {
		return nil, fmt.Errorf("admin get user status: unknown user status %q", raw)
	}
	return &status, nil
}

func (r *AdminRepository) DeactivateUser(ctx context.Context, userID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `UPDATE app_user SET status = $2, updated_at = NOW() WHERE id = $1`, userID, domain.UserStatusDeactivated)
	if err != nil {
		return fmt.Errorf("admin deactivate user: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFoundError(domain.ErrorCodeUserNotFound, "The requested user does not exist.")
	}
	return nil
}

func (r *AdminRepository) RevokeRefreshTokensForUser(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE refresh_token SET revoked_at = COALESCE(revoked_at, NOW()), updated_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, userID)
	return wrapExecErr(err, "admin revoke refresh tokens")
}

func (r *AdminRepository) RevokePushDevicesForUser(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE user_push_device SET revoked_at = COALESCE(revoked_at, NOW()), updated_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, userID)
	return wrapExecErr(err, "admin revoke push devices")
}

func (r *AdminRepository) ListHostedCancelableEventIDs(ctx context.Context, hostID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.db.Query(ctx, `SELECT id FROM event WHERE host_id = $1 AND status IN ($2, $3) ORDER BY created_at ASC FOR UPDATE`, hostID, domain.EventStatusActive, domain.EventStatusInProgress)
	if err != nil {
		return nil, fmt.Errorf("admin list hosted cancelable events: %w", err)
	}
	defer rows.Close()
	ids := []uuid.UUID{}
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("admin scan hosted event id: %w", err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list hosted event ids rows: %w", err)
	}
	return ids, nil
}

func (r *AdminRepository) CancelUserParticipations(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE participation p
		SET status = $2, updated_at = NOW()
		FROM event e
		WHERE e.id = p.event_id
		  AND p.user_id = $1
		  AND e.host_id <> $1
		  AND p.status IN ($3, $4)
	`, userID, domain.ParticipationStatusCanceled, domain.ParticipationStatusApproved, domain.ParticipationStatusPending)
	return wrapExecErr(err, "admin cancel user participations")
}

func (r *AdminRepository) CancelUserTickets(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE ticket t
		SET status = $2,
		    canceled_at = COALESCE(t.canceled_at, NOW()),
		    updated_at = NOW()
		FROM participation p
		JOIN event e ON e.id = p.event_id
		WHERE p.id = t.participation_id
		  AND p.user_id = $1
		  AND e.host_id <> $1
		  AND t.status IN ($3, $4)
	`, userID, domain.TicketStatusCanceled, domain.TicketStatusActive, domain.TicketStatusPending)
	return wrapExecErr(err, "admin cancel user tickets")
}

func (r *AdminRepository) CancelPendingInvitationsForUser(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE invitation SET status = $2, updated_at = NOW()
		WHERE status = $3 AND (host_id = $1 OR invited_user_id = $1)
	`, userID, domain.InvitationStatusCanceled, domain.InvitationStatusPending)
	return wrapExecErr(err, "admin cancel user invitations")
}

func (r *AdminRepository) CancelPendingJoinRequestsForUser(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE join_request SET status = $2, updated_at = NOW()
		WHERE status = $3 AND (user_id = $1 OR host_user_id = $1)
	`, userID, domain.JoinRequestStatusCanceled, domain.JoinRequestStatusPending)
	return wrapExecErr(err, "admin cancel user join requests")
}

func (r *AdminRepository) ListInvitations(ctx context.Context, input adminapp.ListInvitationsInput) (*adminapp.ListInvitationsResult, error) {
	args, where := []any{}, []string{"TRUE"}
	add := func(value any) string { args = append(args, value); return fmt.Sprintf("$%d", len(args)) }
	if input.Query != nil {
		p := add("%" + *input.Query + "%")
		where = append(where, "(e.title ILIKE "+p+" OR hu.username ILIKE "+p+" OR iu.username ILIKE "+p+" OR iu.email ILIKE "+p+")")
	}
	if input.Status != nil {
		where = append(where, "i.status = "+add(input.Status.String()))
	}
	if input.EventID != nil {
		where = append(where, "i.event_id = "+add(*input.EventID))
	}
	if input.HostID != nil {
		where = append(where, "i.host_id = "+add(*input.HostID))
	}
	if input.InvitedUserID != nil {
		where = append(where, "i.invited_user_id = "+add(*input.InvitedUserID))
	}
	if input.CreatedFrom != nil {
		where = append(where, "i.created_at >= "+add(*input.CreatedFrom))
	}
	if input.CreatedTo != nil {
		where = append(where, "i.created_at <= "+add(*input.CreatedTo))
	}
	limit, offset := add(input.Limit), add(input.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT i.id, i.event_id, e.title, i.host_id, hu.username, i.invited_user_id, iu.username, iu.email,
		       i.status, i.message, i.expires_at, i.created_at, i.updated_at, COUNT(*) OVER()
		FROM invitation i
		JOIN event e ON e.id = i.event_id
		JOIN app_user hu ON hu.id = i.host_id
		JOIN app_user iu ON iu.id = i.invited_user_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY i.created_at DESC, i.id DESC
		LIMIT `+limit+` OFFSET `+offset, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list invitations: %w", err)
	}
	defer rows.Close()
	items, total := []adminapp.AdminInvitationItem{}, 0
	for rows.Next() {
		var item adminapp.AdminInvitationItem
		var message pgtype.Text
		var expiresAt pgtype.Timestamptz
		if err := rows.Scan(&item.ID, &item.EventID, &item.EventTitle, &item.HostID, &item.HostUsername, &item.InvitedUserID, &item.InvitedUsername, &item.InvitedEmail, &item.Status, &message, &expiresAt, &item.CreatedAt, &item.UpdatedAt, &total); err != nil {
			return nil, fmt.Errorf("admin scan invitation: %w", err)
		}
		item.Message = textPtr(message)
		item.ExpiresAt = timestamptzPtr(expiresAt)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list invitations rows: %w", err)
	}
	return &adminapp.ListInvitationsResult{Items: items, PageMeta: pageMeta(input.PageInput, total, len(items))}, nil
}

func (r *AdminRepository) UpdateInvitationStatus(ctx context.Context, invitationID uuid.UUID, status domain.InvitationStatus) (*adminapp.AdminInvitationItem, error) {
	tag, err := r.db.Exec(ctx, `UPDATE invitation SET status = $2, updated_at = NOW() WHERE id = $1 AND status = $3`, invitationID, status, domain.InvitationStatusPending)
	if err != nil {
		return nil, fmt.Errorf("admin update invitation status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, domain.NotFoundError(domain.ErrorCodeInvitationNotFound, "The requested pending invitation does not exist.")
	}
	var item adminapp.AdminInvitationItem
	var message pgtype.Text
	var expiresAt pgtype.Timestamptz
	err = r.db.QueryRow(ctx, `
		SELECT i.id, i.event_id, e.title, i.host_id, hu.username, i.invited_user_id, iu.username, iu.email,
		       i.status, i.message, i.expires_at, i.created_at, i.updated_at
		FROM invitation i
		JOIN event e ON e.id = i.event_id
		JOIN app_user hu ON hu.id = i.host_id
		JOIN app_user iu ON iu.id = i.invited_user_id
		WHERE i.id = $1
	`, invitationID).Scan(&item.ID, &item.EventID, &item.EventTitle, &item.HostID, &item.HostUsername, &item.InvitedUserID, &item.InvitedUsername, &item.InvitedEmail, &item.Status, &message, &expiresAt, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("admin load updated invitation: %w", err)
	}
	item.Message = textPtr(message)
	item.ExpiresAt = timestamptzPtr(expiresAt)
	return &item, nil
}

func (r *AdminRepository) ListJoinRequests(ctx context.Context, input adminapp.ListJoinRequestsInput) (*adminapp.ListJoinRequestsResult, error) {
	args, where := []any{}, []string{"TRUE"}
	add := func(value any) string { args = append(args, value); return fmt.Sprintf("$%d", len(args)) }
	if input.Query != nil {
		p := add("%" + *input.Query + "%")
		where = append(where, "(e.title ILIKE "+p+" OR u.username ILIKE "+p+" OR u.email ILIKE "+p+" OR hu.username ILIKE "+p+")")
	}
	if input.Status != nil {
		where = append(where, "jr.status = "+add(input.Status.String()))
	}
	if input.EventID != nil {
		where = append(where, "jr.event_id = "+add(*input.EventID))
	}
	if input.UserID != nil {
		where = append(where, "jr.user_id = "+add(*input.UserID))
	}
	if input.HostUserID != nil {
		where = append(where, "jr.host_user_id = "+add(*input.HostUserID))
	}
	if input.CreatedFrom != nil {
		where = append(where, "jr.created_at >= "+add(*input.CreatedFrom))
	}
	if input.CreatedTo != nil {
		where = append(where, "jr.created_at <= "+add(*input.CreatedTo))
	}
	limit, offset := add(input.Limit), add(input.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT jr.id, jr.event_id, e.title, jr.user_id, u.username, u.email, jr.host_user_id, hu.username,
		       jr.status, jr.message, jr.image_url, jr.created_at, jr.updated_at, COUNT(*) OVER()
		FROM join_request jr
		JOIN event e ON e.id = jr.event_id
		JOIN app_user u ON u.id = jr.user_id
		JOIN app_user hu ON hu.id = jr.host_user_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY jr.created_at DESC, jr.id DESC
		LIMIT `+limit+` OFFSET `+offset, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list join requests: %w", err)
	}
	defer rows.Close()
	items, total := []adminapp.AdminJoinRequestItem{}, 0
	for rows.Next() {
		var item adminapp.AdminJoinRequestItem
		var message, imageURL pgtype.Text
		if err := rows.Scan(&item.ID, &item.EventID, &item.EventTitle, &item.UserID, &item.Username, &item.UserEmail, &item.HostUserID, &item.HostUsername, &item.Status, &message, &imageURL, &item.CreatedAt, &item.UpdatedAt, &total); err != nil {
			return nil, fmt.Errorf("admin scan join request: %w", err)
		}
		item.Message = textPtr(message)
		item.ImageURL = textPtr(imageURL)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list join requests rows: %w", err)
	}
	return &adminapp.ListJoinRequestsResult{Items: items, PageMeta: pageMeta(input.PageInput, total, len(items))}, nil
}

func (r *AdminRepository) UpdateJoinRequestStatus(ctx context.Context, joinRequestID uuid.UUID, status domain.JoinRequestStatus) (*adminapp.AdminJoinRequestItem, error) {
	tag, err := r.db.Exec(ctx, `UPDATE join_request SET status = $2, updated_at = NOW() WHERE id = $1 AND status = $3`, joinRequestID, status, domain.JoinRequestStatusPending)
	if err != nil {
		return nil, fmt.Errorf("admin update join request status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, domain.NotFoundError(domain.ErrorCodeJoinRequestNotFound, "The requested pending join request does not exist.")
	}
	var item adminapp.AdminJoinRequestItem
	var message, imageURL pgtype.Text
	err = r.db.QueryRow(ctx, `
		SELECT jr.id, jr.event_id, e.title, jr.user_id, u.username, u.email, jr.host_user_id, hu.username,
		       jr.status, jr.message, jr.image_url, jr.created_at, jr.updated_at
		FROM join_request jr
		JOIN event e ON e.id = jr.event_id
		JOIN app_user u ON u.id = jr.user_id
		JOIN app_user hu ON hu.id = jr.host_user_id
		WHERE jr.id = $1
	`, joinRequestID).Scan(&item.ID, &item.EventID, &item.EventTitle, &item.UserID, &item.Username, &item.UserEmail, &item.HostUserID, &item.HostUsername, &item.Status, &message, &imageURL, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("admin load updated join request: %w", err)
	}
	item.Message = textPtr(message)
	item.ImageURL = textPtr(imageURL)
	return &item, nil
}

func (r *AdminRepository) ListComments(ctx context.Context, input adminapp.ListCommentsInput) (*adminapp.ListCommentsResult, error) {
	args, where := []any{}, []string{"TRUE"}
	add := func(value any) string { args = append(args, value); return fmt.Sprintf("$%d", len(args)) }
	if input.Query != nil {
		p := add("%" + *input.Query + "%")
		where = append(where, "(ec.message ILIKE "+p+" OR e.title ILIKE "+p+" OR u.username ILIKE "+p+" OR u.email ILIKE "+p+")")
	}
	if input.EventID != nil {
		where = append(where, "ec.event_id = "+add(*input.EventID))
	}
	if input.UserID != nil {
		where = append(where, "ec.user_id = "+add(*input.UserID))
	}
	if input.Type != nil {
		where = append(where, "ec.comment_type = "+add(*input.Type))
	}
	if input.CreatedFrom != nil {
		where = append(where, "ec.created_at >= "+add(*input.CreatedFrom))
	}
	if input.CreatedTo != nil {
		where = append(where, "ec.created_at <= "+add(*input.CreatedTo))
	}
	limit, offset := add(input.Limit), add(input.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT ec.id, ec.event_id, e.title, ec.user_id, u.username, u.email, ec.comment_type, ec.parent_id, ec.message, ec.created_at, ec.updated_at, COUNT(*) OVER()
		FROM event_comment ec JOIN event e ON e.id = ec.event_id JOIN app_user u ON u.id = ec.user_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY ec.created_at DESC, ec.id DESC LIMIT `+limit+` OFFSET `+offset, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list comments: %w", err)
	}
	defer rows.Close()
	items, total := []adminapp.AdminCommentItem{}, 0
	for rows.Next() {
		var item adminapp.AdminCommentItem
		var parentID pgtype.UUID
		if err := rows.Scan(&item.ID, &item.EventID, &item.EventTitle, &item.UserID, &item.Username, &item.UserEmail, &item.Type, &parentID, &item.Message, &item.CreatedAt, &item.UpdatedAt, &total); err != nil {
			return nil, fmt.Errorf("admin scan comment: %w", err)
		}
		item.ParentID = uuidPtr(parentID)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list comments rows: %w", err)
	}
	return &adminapp.ListCommentsResult{Items: items, PageMeta: pageMeta(input.PageInput, total, len(items))}, nil
}

func (r *AdminRepository) DeleteComment(ctx context.Context, commentID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM event_comment WHERE id = $1`, commentID)
	if err != nil {
		return fmt.Errorf("admin delete comment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFoundError("comment_not_found", "The requested comment does not exist.")
	}
	return nil
}

func (r *AdminRepository) ListEventRatings(ctx context.Context, input adminapp.ListEventRatingsInput) (*adminapp.ListEventRatingsResult, error) {
	args, where := []any{}, []string{"TRUE"}
	add := func(value any) string { args = append(args, value); return fmt.Sprintf("$%d", len(args)) }
	if input.EventID != nil {
		where = append(where, "er.event_id = "+add(*input.EventID))
	}
	if input.UserID != nil {
		where = append(where, "er.participant_user_id = "+add(*input.UserID))
	}
	if input.CreatedFrom != nil {
		where = append(where, "er.created_at >= "+add(*input.CreatedFrom))
	}
	if input.CreatedTo != nil {
		where = append(where, "er.created_at <= "+add(*input.CreatedTo))
	}
	limit, offset := add(input.Limit), add(input.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT er.id, er.event_id, e.title, er.participant_user_id, u.username, u.email, er.rating::double precision, er.created_at, er.updated_at, COUNT(*) OVER()
		FROM event_rating er JOIN event e ON e.id = er.event_id JOIN app_user u ON u.id = er.participant_user_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY er.created_at DESC, er.id DESC LIMIT `+limit+` OFFSET `+offset, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list event ratings: %w", err)
	}
	defer rows.Close()
	items, total := []adminapp.AdminEventRatingItem{}, 0
	for rows.Next() {
		var item adminapp.AdminEventRatingItem
		if err := rows.Scan(&item.ID, &item.EventID, &item.EventTitle, &item.ParticipantUserID, &item.Username, &item.UserEmail, &item.Score, &item.CreatedAt, &item.UpdatedAt, &total); err != nil {
			return nil, fmt.Errorf("admin scan event rating: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list event ratings rows: %w", err)
	}
	return &adminapp.ListEventRatingsResult{Items: items, PageMeta: pageMeta(input.PageInput, total, len(items))}, nil
}

func (r *AdminRepository) ListParticipantRatings(ctx context.Context, input adminapp.ListParticipantRatingsInput) (*adminapp.ListParticipantRatingsResult, error) {
	args, where := []any{}, []string{"TRUE"}
	add := func(value any) string { args = append(args, value); return fmt.Sprintf("$%d", len(args)) }
	if input.EventID != nil {
		where = append(where, "pr.event_id = "+add(*input.EventID))
	}
	if input.HostID != nil {
		where = append(where, "pr.host_user_id = "+add(*input.HostID))
	}
	if input.UserID != nil {
		where = append(where, "pr.participant_user_id = "+add(*input.UserID))
	}
	if input.CreatedFrom != nil {
		where = append(where, "pr.created_at >= "+add(*input.CreatedFrom))
	}
	if input.CreatedTo != nil {
		where = append(where, "pr.created_at <= "+add(*input.CreatedTo))
	}
	limit, offset := add(input.Limit), add(input.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT pr.id, pr.event_id, e.title, pr.host_user_id, hu.username, pr.participant_user_id, pu.username,
		       pr.rating::double precision, pr.created_at, pr.updated_at, COUNT(*) OVER()
		FROM participant_rating pr
		JOIN event e ON e.id = pr.event_id
		JOIN app_user hu ON hu.id = pr.host_user_id
		JOIN app_user pu ON pu.id = pr.participant_user_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY pr.created_at DESC, pr.id DESC LIMIT `+limit+` OFFSET `+offset, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list participant ratings: %w", err)
	}
	defer rows.Close()
	items, total := []adminapp.AdminParticipantRatingItem{}, 0
	for rows.Next() {
		var item adminapp.AdminParticipantRatingItem
		if err := rows.Scan(&item.ID, &item.EventID, &item.EventTitle, &item.HostUserID, &item.HostUsername, &item.ParticipantUserID, &item.ParticipantUsername, &item.Score, &item.CreatedAt, &item.UpdatedAt, &total); err != nil {
			return nil, fmt.Errorf("admin scan participant rating: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list participant ratings rows: %w", err)
	}
	return &adminapp.ListParticipantRatingsResult{Items: items, PageMeta: pageMeta(input.PageInput, total, len(items))}, nil
}

func (r *AdminRepository) DeleteEventRating(ctx context.Context, ratingID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM event_rating WHERE id = $1`, ratingID)
	if err != nil {
		return fmt.Errorf("admin delete event rating: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFoundError("rating_not_found", "The requested rating does not exist.")
	}
	return nil
}

func (r *AdminRepository) DeleteParticipantRating(ctx context.Context, ratingID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM participant_rating WHERE id = $1`, ratingID)
	if err != nil {
		return fmt.Errorf("admin delete participant rating: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFoundError("rating_not_found", "The requested rating does not exist.")
	}
	return nil
}

func (r *AdminRepository) ListFavoriteEvents(ctx context.Context, input adminapp.ListFavoriteEventsInput) (*adminapp.ListFavoriteEventsResult, error) {
	args, where := []any{}, []string{"TRUE"}
	add := func(value any) string { args = append(args, value); return fmt.Sprintf("$%d", len(args)) }
	if input.UserID != nil {
		where = append(where, "fe.user_id = "+add(*input.UserID))
	}
	if input.EventID != nil {
		where = append(where, "fe.event_id = "+add(*input.EventID))
	}
	if input.CreatedFrom != nil {
		where = append(where, "fe.created_at >= "+add(*input.CreatedFrom))
	}
	if input.CreatedTo != nil {
		where = append(where, "fe.created_at <= "+add(*input.CreatedTo))
	}
	limit, offset := add(input.Limit), add(input.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT fe.id, fe.user_id, u.username, u.email, fe.event_id, e.title, fe.created_at, fe.updated_at, COUNT(*) OVER()
		FROM favorite_event fe JOIN app_user u ON u.id = fe.user_id JOIN event e ON e.id = fe.event_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY fe.created_at DESC, fe.id DESC LIMIT `+limit+` OFFSET `+offset, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list favorite events: %w", err)
	}
	defer rows.Close()
	items, total := []adminapp.AdminFavoriteEventItem{}, 0
	for rows.Next() {
		var item adminapp.AdminFavoriteEventItem
		if err := rows.Scan(&item.ID, &item.UserID, &item.Username, &item.UserEmail, &item.EventID, &item.EventTitle, &item.CreatedAt, &item.UpdatedAt, &total); err != nil {
			return nil, fmt.Errorf("admin scan favorite event: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list favorite events rows: %w", err)
	}
	return &adminapp.ListFavoriteEventsResult{Items: items, PageMeta: pageMeta(input.PageInput, total, len(items))}, nil
}

func (r *AdminRepository) ListFavoriteLocations(ctx context.Context, input adminapp.ListFavoriteLocationsInput) (*adminapp.ListFavoriteLocationsResult, error) {
	args, where := []any{}, []string{"TRUE"}
	add := func(value any) string { args = append(args, value); return fmt.Sprintf("$%d", len(args)) }
	if input.UserID != nil {
		where = append(where, "fl.user_id = "+add(*input.UserID))
	}
	if input.Query != nil {
		p := add("%" + *input.Query + "%")
		where = append(where, "(fl.name ILIKE "+p+" OR fl.address ILIKE "+p+" OR u.username ILIKE "+p+" OR u.email ILIKE "+p+")")
	}
	if input.CreatedFrom != nil {
		where = append(where, "fl.created_at >= "+add(*input.CreatedFrom))
	}
	if input.CreatedTo != nil {
		where = append(where, "fl.created_at <= "+add(*input.CreatedTo))
	}
	limit, offset := add(input.Limit), add(input.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT fl.id, fl.user_id, u.username, u.email, fl.name, fl.address, fl.created_at, fl.updated_at, COUNT(*) OVER()
		FROM favorite_location fl JOIN app_user u ON u.id = fl.user_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY fl.created_at DESC, fl.id DESC LIMIT `+limit+` OFFSET `+offset, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list favorite locations: %w", err)
	}
	defer rows.Close()
	items, total := []adminapp.AdminFavoriteLocationItem{}, 0
	for rows.Next() {
		var item adminapp.AdminFavoriteLocationItem
		var name, address pgtype.Text
		if err := rows.Scan(&item.ID, &item.UserID, &item.Username, &item.UserEmail, &name, &address, &item.CreatedAt, &item.UpdatedAt, &total); err != nil {
			return nil, fmt.Errorf("admin scan favorite location: %w", err)
		}
		item.Name = textPtr(name)
		item.Address = textPtr(address)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list favorite locations rows: %w", err)
	}
	return &adminapp.ListFavoriteLocationsResult{Items: items, PageMeta: pageMeta(input.PageInput, total, len(items))}, nil
}

func (r *AdminRepository) ListUserBadges(ctx context.Context, input adminapp.ListUserBadgesInput) (*adminapp.ListUserBadgesResult, error) {
	args, where := []any{}, []string{"TRUE"}
	add := func(value any) string { args = append(args, value); return fmt.Sprintf("$%d", len(args)) }
	if input.UserID != nil {
		where = append(where, "ub.user_id = "+add(*input.UserID))
	}
	if input.Query != nil {
		p := add("%" + *input.Query + "%")
		where = append(where, "(b.name ILIKE "+p+" OR b.slug ILIKE "+p+" OR u.username ILIKE "+p+" OR u.email ILIKE "+p+")")
	}
	limit, offset := add(input.Limit), add(input.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT ub.user_id, u.username, u.email, b.id, b.slug, b.name, b.category, ub.earned_at, COUNT(*) OVER()
		FROM user_badge ub JOIN app_user u ON u.id = ub.user_id JOIN badge b ON b.id = ub.badge_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY ub.earned_at DESC, ub.user_id DESC LIMIT `+limit+` OFFSET `+offset, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list user badges: %w", err)
	}
	defer rows.Close()
	items, total := []adminapp.AdminUserBadgeItem{}, 0
	for rows.Next() {
		var item adminapp.AdminUserBadgeItem
		if err := rows.Scan(&item.UserID, &item.Username, &item.UserEmail, &item.BadgeID, &item.BadgeSlug, &item.BadgeName, &item.BadgeCategory, &item.EarnedAt, &total); err != nil {
			return nil, fmt.Errorf("admin scan user badge: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list user badges rows: %w", err)
	}
	return &adminapp.ListUserBadgesResult{Items: items, PageMeta: pageMeta(input.PageInput, total, len(items))}, nil
}

func (r *AdminRepository) ListPushDevices(ctx context.Context, input adminapp.ListPushDevicesInput) (*adminapp.ListPushDevicesResult, error) {
	args, where := []any{}, []string{"TRUE"}
	add := func(value any) string { args = append(args, value); return fmt.Sprintf("$%d", len(args)) }
	if input.UserID != nil {
		where = append(where, "d.user_id = "+add(*input.UserID))
	}
	if input.Platform != nil {
		where = append(where, "d.platform = "+add(*input.Platform))
	}
	if input.Active != nil {
		if *input.Active {
			where = append(where, "d.revoked_at IS NULL")
		} else {
			where = append(where, "d.revoked_at IS NOT NULL")
		}
	}
	if input.CreatedFrom != nil {
		where = append(where, "d.created_at >= "+add(*input.CreatedFrom))
	}
	if input.CreatedTo != nil {
		where = append(where, "d.created_at <= "+add(*input.CreatedTo))
	}
	limit, offset := add(input.Limit), add(input.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT d.id, d.user_id, u.username, u.email, d.installation_id, d.platform, d.last_seen_at, d.revoked_at, d.created_at, d.updated_at, COUNT(*) OVER()
		FROM user_push_device d JOIN app_user u ON u.id = d.user_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY d.last_seen_at DESC, d.id DESC LIMIT `+limit+` OFFSET `+offset, args...)
	if err != nil {
		return nil, fmt.Errorf("admin list push devices: %w", err)
	}
	defer rows.Close()
	items, total := []adminapp.AdminPushDeviceItem{}, 0
	for rows.Next() {
		var item adminapp.AdminPushDeviceItem
		var revokedAt pgtype.Timestamptz
		if err := rows.Scan(&item.ID, &item.UserID, &item.Username, &item.UserEmail, &item.InstallationID, &item.Platform, &item.LastSeenAt, &revokedAt, &item.CreatedAt, &item.UpdatedAt, &total); err != nil {
			return nil, fmt.Errorf("admin scan push device: %w", err)
		}
		item.RevokedAt = timestamptzPtr(revokedAt)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("admin list push devices rows: %w", err)
	}
	return &adminapp.ListPushDevicesResult{Items: items, PageMeta: pageMeta(input.PageInput, total, len(items))}, nil
}

func (r *AdminRepository) RevokePushDevice(ctx context.Context, deviceID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `UPDATE user_push_device SET revoked_at = COALESCE(revoked_at, NOW()), updated_at = NOW() WHERE id = $1`, deviceID)
	if err != nil {
		return fmt.Errorf("admin revoke push device: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFoundError("push_device_not_found", "The requested push device does not exist.")
	}
	return nil
}

func (r *AdminRepository) CountExistingUsers(ctx context.Context, userIDs []uuid.UUID) (int, error) {
	if len(userIDs) == 0 {
		return 0, nil
	}
	var count int
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM app_user
		WHERE id = ANY($1)
	`, userIDs).Scan(&count); err != nil {
		return 0, fmt.Errorf("admin count existing users: %w", err)
	}
	return count, nil
}

func (r *AdminRepository) GetEventState(ctx context.Context, eventID uuid.UUID, forUpdate bool) (*adminapp.AdminEventState, error) {
	query := `
		SELECT id, privacy_level, capacity, approved_participant_count, pending_participant_count
		FROM event
		WHERE id = $1
	`
	if forUpdate {
		query += ` FOR UPDATE`
	}

	var (
		state        adminapp.AdminEventState
		privacyLevel string
		capacity     pgtype.Int4
	)
	err := r.db.QueryRow(ctx, query, eventID).Scan(&state.ID, &privacyLevel, &capacity, &state.ApprovedParticipantCount, &state.PendingParticipantCount)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("admin get event state: %w", err)
	}
	parsed, ok := domain.ParseEventPrivacyLevel(privacyLevel)
	if !ok {
		return nil, fmt.Errorf("admin get event state: unknown privacy level %q", privacyLevel)
	}
	state.PrivacyLevel = parsed
	if capacity.Valid {
		state.Capacity = new(int)
		*state.Capacity = int(capacity.Int32)
	}
	return &state, nil
}

func (r *AdminRepository) CreateManualParticipation(ctx context.Context, eventID, userID uuid.UUID, status domain.ParticipationStatus) (*domain.Participation, error) {
	existing, err := loadParticipation(ctx, r.db, eventID, userID, true)
	if err != nil {
		return nil, fmt.Errorf("admin load existing participation: %w", err)
	}
	if existing != nil && (existing.Status == domain.ParticipationStatusApproved || existing.Status == domain.ParticipationStatusPending) {
		return nil, domain.ConflictError(domain.ErrorCodeAlreadyParticipating, "The user already has an active participation for this event.")
	}

	if existing != nil {
		participation, err := scanParticipation(r.db.QueryRow(ctx, `
			UPDATE participation
			SET status = $3,
			    reconfirmed_at = NULL,
			    last_confirmed_event_version = CASE
			        WHEN $3 = $4 THEN (SELECT version_no FROM event WHERE id = $1)
			        ELSE last_confirmed_event_version
			    END,
			    updated_at = NOW()
			WHERE event_id = $1
			  AND user_id = $2
			RETURNING id, status, reconfirmed_at, last_confirmed_event_version, created_at, updated_at
		`, eventID, userID, status, domain.ParticipationStatusApproved), eventID, userID, "admin reactivate participation")
		if err != nil {
			return nil, err
		}
		return participation, nil
	}

	participation, err := scanParticipation(r.db.QueryRow(ctx, `
		INSERT INTO participation (event_id, user_id, status, last_confirmed_event_version)
		VALUES (
			$1,
			$2,
			$3,
			CASE WHEN $3 = $4 THEN (SELECT version_no FROM event WHERE id = $1) ELSE NULL END
		)
		RETURNING id, status, reconfirmed_at, last_confirmed_event_version, created_at, updated_at
	`, eventID, userID, status, domain.ParticipationStatusApproved), eventID, userID, "admin create participation")
	if err != nil {
		return nil, mapAdminParticipationMutationError(err)
	}
	if participation == nil {
		return nil, fmt.Errorf("admin create participation: no row returned")
	}
	return participation, nil
}

func (r *AdminRepository) GetParticipationByID(ctx context.Context, participationID uuid.UUID, forUpdate bool) (*domain.Participation, error) {
	query := `
		SELECT id, event_id, user_id, status, reconfirmed_at, last_confirmed_event_version, created_at, updated_at
		FROM participation
		WHERE id = $1
	`
	if forUpdate {
		query += ` FOR UPDATE`
	}
	return scanAdminParticipation(r.db.QueryRow(ctx, query, participationID), "admin get participation")
}

func (r *AdminRepository) CancelParticipation(ctx context.Context, participationID uuid.UUID) (*domain.Participation, bool, error) {
	existing, err := r.GetParticipationByID(ctx, participationID, true)
	if err != nil {
		return nil, false, err
	}
	if existing == nil {
		return nil, false, domain.NotFoundError(domain.ErrorCodeParticipationNotFound, "The requested participation does not exist.")
	}
	if existing.Status == domain.ParticipationStatusCanceled {
		return existing, true, nil
	}

	participation, err := scanAdminParticipation(r.db.QueryRow(ctx, `
		UPDATE participation
		SET status = $2,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING id, event_id, user_id, status, reconfirmed_at, last_confirmed_event_version, created_at, updated_at
	`, participationID, domain.ParticipationStatusCanceled), "admin cancel participation")
	if err != nil {
		return nil, false, err
	}
	return participation, false, nil
}

func scanAdminParticipation(row pgx.Row, operation string) (*domain.Participation, error) {
	var (
		participation        domain.Participation
		status               string
		reconfirmedAt        pgtype.Timestamptz
		lastConfirmedVersion pgtype.Int4
	)
	err := row.Scan(
		&participation.ID,
		&participation.EventID,
		&participation.UserID,
		&status,
		&reconfirmedAt,
		&lastConfirmedVersion,
		&participation.CreatedAt,
		&participation.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("%s: %w", operation, err)
	}
	parsed, ok := domain.ParseParticipationStatus(status)
	if !ok {
		return nil, fmt.Errorf("%s: unknown participation status %q", operation, status)
	}
	participation.Status = parsed
	participation.ReconfirmedAt = timestamptzPtr(reconfirmedAt)
	if lastConfirmedVersion.Valid {
		value := int(lastConfirmedVersion.Int32)
		participation.LastConfirmedEventVersion = &value
	}
	return &participation, nil
}

func mapAdminParticipationMutationError(err error) error {
	if err == nil {
		return nil
	}
	if strings.Contains(err.Error(), "fk_participation_event") {
		return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
	}
	if strings.Contains(err.Error(), "fk_participation_user") {
		return domain.NotFoundError(domain.ErrorCodeUserNotFound, "The requested user does not exist.")
	}
	return err
}

func pageMeta(page adminapp.PageInput, totalCount, itemCount int) adminapp.PageMeta {
	return adminapp.PageMeta{
		Limit:      page.Limit,
		Offset:     page.Offset,
		TotalCount: totalCount,
		HasNext:    page.Offset+itemCount < totalCount,
	}
}

func intPtr(value pgtype.Int4) *int {
	if !value.Valid {
		return nil
	}
	converted := int(value.Int32)
	return &converted
}

func scanAdminEventReport(rows pgx.Rows, totalCount *int) (*adminapp.AdminEventReportItem, error) {
	var item adminapp.AdminEventReportItem
	var eventTitle, reporterUsername, reporterEmail, imageURL pgtype.Text
	if err := rows.Scan(
		&item.ID,
		&item.EventID,
		&eventTitle,
		&item.ReporterUserID,
		&reporterUsername,
		&reporterEmail,
		&item.ReportCategory,
		&item.Message,
		&imageURL,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
		totalCount,
	); err != nil {
		return nil, fmt.Errorf("admin scan event report: %w", err)
	}
	item.EventTitle = textPtr(eventTitle)
	item.ReporterUsername = textPtr(reporterUsername)
	item.ReporterEmail = textPtr(reporterEmail)
	item.ImageURL = textPtr(imageURL)
	return &item, nil
}

func scanAdminEventReportRow(row pgx.Row) (*adminapp.AdminEventReportItem, error) {
	var item adminapp.AdminEventReportItem
	var eventTitle, reporterUsername, reporterEmail, imageURL pgtype.Text
	err := row.Scan(
		&item.ID,
		&item.EventID,
		&eventTitle,
		&item.ReporterUserID,
		&reporterUsername,
		&reporterEmail,
		&item.ReportCategory,
		&item.Message,
		&imageURL,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("admin scan event report row: %w", err)
	}
	item.EventTitle = textPtr(eventTitle)
	item.ReporterUsername = textPtr(reporterUsername)
	item.ReporterEmail = textPtr(reporterEmail)
	item.ImageURL = textPtr(imageURL)
	return &item, nil
}

func scanAdminEventRow(row pgx.Row) (*adminapp.AdminEventItem, error) {
	var item adminapp.AdminEventItem
	var categoryID pgtype.Int4
	var categoryName pgtype.Text
	var endTime pgtype.Timestamptz
	var capacity pgtype.Int4
	err := row.Scan(
		&item.ID,
		&item.HostID,
		&item.HostUsername,
		&item.Title,
		&categoryID,
		&categoryName,
		&item.StartTime,
		&endTime,
		&item.PrivacyLevel,
		&item.Status,
		&capacity,
		&item.ApprovedParticipantCount,
		&item.PendingParticipantCount,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("admin scan event row: %w", err)
	}
	item.CategoryID = intPtr(categoryID)
	item.CategoryName = textPtr(categoryName)
	item.EndTime = timestamptzPtr(endTime)
	item.Capacity = intPtr(capacity)
	return &item, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

func wrapExecErr(err error, operation string) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", operation, err)
}
