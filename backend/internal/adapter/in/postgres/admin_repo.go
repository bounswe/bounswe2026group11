package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	adminapp "github.com/bounswe/bounswe2026group11/backend/internal/application/admin"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
		SELECT id, privacy_level
		FROM event
		WHERE id = $1
	`
	if forUpdate {
		query += ` FOR UPDATE`
	}

	var (
		state        adminapp.AdminEventState
		privacyLevel string
	)
	err := r.db.QueryRow(ctx, query, eventID).Scan(&state.ID, &privacyLevel)
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
			    updated_at = NOW()
			WHERE event_id = $1
			  AND user_id = $2
			RETURNING id, status, created_at, updated_at
		`, eventID, userID, status), eventID, userID, "admin reactivate participation")
		if err != nil {
			return nil, err
		}
		return participation, nil
	}

	participation, err := scanParticipation(r.db.QueryRow(ctx, `
		INSERT INTO participation (event_id, user_id, status)
		VALUES ($1, $2, $3)
		RETURNING id, status, created_at, updated_at
	`, eventID, userID, status), eventID, userID, "admin create participation")
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
		SELECT id, event_id, user_id, status, created_at, updated_at
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
		RETURNING id, event_id, user_id, status, created_at, updated_at
	`, participationID, domain.ParticipationStatusCanceled), "admin cancel participation")
	if err != nil {
		return nil, false, err
	}
	return participation, false, nil
}

func scanAdminParticipation(row pgx.Row, operation string) (*domain.Participation, error) {
	var (
		participation domain.Participation
		status        string
	)
	err := row.Scan(
		&participation.ID,
		&participation.EventID,
		&participation.UserID,
		&status,
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
