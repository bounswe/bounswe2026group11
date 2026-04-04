package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	imageuploadapp "github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	profileapp "github.com/bounswe/bounswe2026group11/backend/internal/application/profile"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ProfileRepository is the Postgres-backed implementation of profile.Repository.
type ProfileRepository struct {
	pool *pgxpool.Pool
	db   execer
}

// NewProfileRepository returns a repository that executes queries against the given connection pool.
func NewProfileRepository(pool *pgxpool.Pool) *ProfileRepository {
	return &ProfileRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

// GetProfile returns the combined app_user + profile data for the given user.
func (r *ProfileRepository) GetProfile(ctx context.Context, userID uuid.UUID) (*domain.UserProfile, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT
			u.id,
			u.username,
			u.email,
			u.phone_number,
			u.gender,
			u.birth_date,
			u.email_verified_at,
			u.status,
			u.default_location_address,
			ST_Y(u.default_location_point::geometry) AS lat,
			ST_X(u.default_location_point::geometry) AS lon,
			p.display_name,
			p.bio,
			p.avatar_url
		FROM app_user u
		LEFT JOIN profile p ON p.user_id = u.id
		WHERE u.id = $1
	`, userID)

	var (
		up                domain.UserProfile
		phoneNumber       pgtype.Text
		gender            pgtype.Text
		birthDate         pgtype.Date
		emailVerifiedAt   pgtype.Timestamptz
		status            pgtype.Text
		defaultLocAddress pgtype.Text
		lat               pgtype.Float8
		lon               pgtype.Float8
		displayName       pgtype.Text
		bio               pgtype.Text
		avatarURL         pgtype.Text
	)

	if err := row.Scan(
		&up.ID,
		&up.Username,
		&up.Email,
		&phoneNumber,
		&gender,
		&birthDate,
		&emailVerifiedAt,
		&status,
		&defaultLocAddress,
		&lat,
		&lon,
		&displayName,
		&bio,
		&avatarURL,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get profile: %w", err)
	}

	up.PhoneNumber = textPtr(phoneNumber)
	up.Gender = textPtr(gender)
	up.BirthDate = datePtr(birthDate)
	up.EmailVerified = emailVerifiedAt.Valid
	up.Status = textValue(status)
	up.DefaultLocationAddress = textPtr(defaultLocAddress)
	if lat.Valid {
		up.DefaultLocationLat = &lat.Float64
	}
	if lon.Valid {
		up.DefaultLocationLon = &lon.Float64
	}
	up.DisplayName = textPtr(displayName)
	up.Bio = textPtr(bio)
	up.AvatarURL = textPtr(avatarURL)

	return &up, nil
}

// GetHostedEvents returns a summary of all events created by the given user.
func (r *ProfileRepository) GetHostedEvents(ctx context.Context, userID uuid.UUID) ([]domain.EventSummary, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			e.id,
			e.title,
			e.start_time,
			e.end_time,
			e.status,
			ec.name AS category,
			e.image_url
		FROM event e
		LEFT JOIN event_category ec ON ec.id = e.category_id
		WHERE e.host_id = $1
		ORDER BY e.start_time DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("get hosted events: %w", err)
	}
	defer rows.Close()
	return scanEventSummaries(rows)
}

// GetUpcomingEvents returns events the user has an APPROVED participation in
// that are still ACTIVE or IN_PROGRESS.
func (r *ProfileRepository) GetUpcomingEvents(ctx context.Context, userID uuid.UUID) ([]domain.EventSummary, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			e.id,
			e.title,
			e.start_time,
			e.end_time,
			e.status,
			ec.name AS category,
			e.image_url
		FROM event e
		JOIN participation p ON p.event_id = e.id
		LEFT JOIN event_category ec ON ec.id = e.category_id
		WHERE p.user_id = $1
		  AND p.status = $2
		  AND e.status IN ($3, $4)
		ORDER BY e.start_time ASC
	`, userID, domain.ParticipationStatusApproved, domain.EventStatusActive, domain.EventStatusInProgress)
	if err != nil {
		return nil, fmt.Errorf("get upcoming events: %w", err)
	}
	defer rows.Close()
	return scanEventSummaries(rows)
}

// GetCompletedEvents returns events the user either completed as an APPROVED
// participant or left after the event had already started.
func (r *ProfileRepository) GetCompletedEvents(ctx context.Context, userID uuid.UUID) ([]domain.EventSummary, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			e.id,
			e.title,
			e.start_time,
			e.end_time,
			e.status,
			ec.name AS category,
			e.image_url
		FROM event e
		JOIN participation p ON p.event_id = e.id
		LEFT JOIN event_category ec ON ec.id = e.category_id
		WHERE p.user_id = $1
		  AND (
			p.status = $2
			OR (p.status = $3 AND p.updated_at >= e.start_time)
		  )
		  AND e.status = $4
		ORDER BY e.start_time DESC
	`, userID, domain.ParticipationStatusApproved, domain.ParticipationStatusLeaved, domain.EventStatusCompleted)
	if err != nil {
		return nil, fmt.Errorf("get completed events: %w", err)
	}
	defer rows.Close()
	return scanEventSummaries(rows)
}

// GetCanceledEvents returns events the user was part of (participation CANCELED)
// that are CANCELED, covering both host and participant views.
func (r *ProfileRepository) GetCanceledEvents(ctx context.Context, userID uuid.UUID) ([]domain.EventSummary, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			e.id,
			e.title,
			e.start_time,
			e.end_time,
			e.status,
			ec.name AS category,
			e.image_url
		FROM event e
		JOIN participation p ON p.event_id = e.id
		LEFT JOIN event_category ec ON ec.id = e.category_id
		WHERE p.user_id = $1
		  AND p.status = $2
		  AND e.status = $3
		ORDER BY e.start_time DESC
	`, userID, domain.ParticipationStatusCanceled, domain.EventStatusCanceled)
	if err != nil {
		return nil, fmt.Errorf("get canceled events: %w", err)
	}
	defer rows.Close()
	return scanEventSummaries(rows)
}

func scanEventSummaries(rows interface {
	Next() bool
	Scan(...any) error
	Err() error
}) ([]domain.EventSummary, error) {
	var events []domain.EventSummary
	for rows.Next() {
		var (
			e        domain.EventSummary
			endTime  pgtype.Timestamptz
			category pgtype.Text
			imageURL pgtype.Text
		)
		if err := rows.Scan(&e.ID, &e.Title, &e.StartTime, &endTime, &e.Status, &category, &imageURL); err != nil {
			return nil, fmt.Errorf("scan event summary: %w", err)
		}
		if endTime.Valid {
			e.EndTime = endTime.Time
		}
		e.Category = textPtr(category)
		e.ImageURL = textPtr(imageURL)
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate event summaries: %w", err)
	}
	if events == nil {
		events = []domain.EventSummary{}
	}
	return events, nil
}

// UpdateProfile persists editable profile fields across app_user and profile tables.
func (r *ProfileRepository) UpdateProfile(ctx context.Context, params profileapp.UpdateProfileParams) error {
	// Update app_user fields.
	var locationExpr string
	var userArgs []any
	userArgs = append(userArgs, params.UserID)

	setClauses := "updated_at = now()"

	if params.PhoneNumber != nil {
		setClauses += fmt.Sprintf(", phone_number = $%d", len(userArgs)+1)
		userArgs = append(userArgs, *params.PhoneNumber)
	}
	if params.Gender != nil {
		setClauses += fmt.Sprintf(", gender = $%d", len(userArgs)+1)
		userArgs = append(userArgs, *params.Gender)
	}
	if params.BirthDate != nil {
		setClauses += fmt.Sprintf(", birth_date = $%d", len(userArgs)+1)
		userArgs = append(userArgs, *params.BirthDate)
	}
	if params.DefaultLocationAddress != nil {
		setClauses += fmt.Sprintf(", default_location_address = $%d", len(userArgs)+1)
		userArgs = append(userArgs, *params.DefaultLocationAddress)
	}
	if params.DefaultLocationLat != nil && params.DefaultLocationLon != nil {
		locationExpr = fmt.Sprintf(", default_location_point = ST_SetSRID(ST_MakePoint($%d, $%d), 4326)::geography",
			len(userArgs)+1, len(userArgs)+2)
		userArgs = append(userArgs, *params.DefaultLocationLon, *params.DefaultLocationLat)
	}

	setClauses += locationExpr

	if _, err := r.db.Exec(ctx,
		fmt.Sprintf(`UPDATE app_user SET %s WHERE id = $1`, setClauses),
		userArgs...,
	); err != nil {
		return fmt.Errorf("update app_user: %w", err)
	}

	// Update profile fields.
	profileSet := "updated_at = now()"
	var profileArgs []any
	profileArgs = append(profileArgs, params.UserID)

	if params.DisplayName != nil {
		profileSet += fmt.Sprintf(", display_name = $%d", len(profileArgs)+1)
		profileArgs = append(profileArgs, *params.DisplayName)
	}
	if params.Bio != nil {
		profileSet += fmt.Sprintf(", bio = $%d", len(profileArgs)+1)
		profileArgs = append(profileArgs, *params.Bio)
	}
	if params.AvatarURL != nil {
		profileSet += fmt.Sprintf(", avatar_url = $%d", len(profileArgs)+1)
		profileArgs = append(profileArgs, *params.AvatarURL)
	}

	if _, err := r.db.Exec(ctx,
		fmt.Sprintf(`UPDATE profile SET %s WHERE user_id = $1`, profileSet),
		profileArgs...,
	); err != nil {
		return fmt.Errorf("update profile: %w", err)
	}
	return nil
}

// GetAvatarVersion returns the current avatar version of the given user profile.
func (r *ProfileRepository) GetAvatarVersion(ctx context.Context, userID uuid.UUID) (int, error) {
	var version int
	err := r.pool.QueryRow(ctx, `
		SELECT avatar_version
		FROM profile
		WHERE user_id = $1
	`, userID).Scan(&version)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, domain.ErrNotFound
		}
		return 0, fmt.Errorf("get avatar version: %w", err)
	}

	return version, nil
}

// SetAvatarIfVersion updates the avatar URL only if the current version matches expectedVersion.
func (r *ProfileRepository) SetAvatarIfVersion(
	ctx context.Context,
	userID uuid.UUID,
	expectedVersion, nextVersion int,
	baseURL string,
	updatedAt time.Time,
) (bool, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE profile
		SET avatar_url = $2,
		    avatar_version = $3,
		    updated_at = $4
		WHERE user_id = $1
		  AND avatar_version = $5
	`, userID, baseURL, nextVersion, updatedAt, expectedVersion)
	if err != nil {
		return false, fmt.Errorf("set avatar image: %w", err)
	}

	return tag.RowsAffected() == 1, nil
}

var _ imageuploadapp.ProfileRepository = (*ProfileRepository)(nil)
