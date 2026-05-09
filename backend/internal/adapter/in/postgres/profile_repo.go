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
			u.locale,
			u.default_location_address,
			ST_Y(u.default_location_point::geometry) AS lat,
			ST_X(u.default_location_point::geometry) AS lon,
			p.display_name,
			p.bio,
			p.avatar_url,
			us.final_score,
			us.hosted_event_score,
			COALESCE(us.hosted_event_rating_count, 0),
			us.participant_score,
			COALESCE(us.participant_rating_count, 0)
		FROM app_user u
		LEFT JOIN profile p ON p.user_id = u.id
		LEFT JOIN user_score us ON us.user_id = u.id
		WHERE u.id = $1
	`, userID)

	var (
		up                     domain.UserProfile
		phoneNumber            pgtype.Text
		gender                 pgtype.Text
		birthDate              pgtype.Date
		emailVerifiedAt        pgtype.Timestamptz
		status                 pgtype.Text
		locale                 pgtype.Text
		defaultLocAddress      pgtype.Text
		lat                    pgtype.Float8
		lon                    pgtype.Float8
		displayName            pgtype.Text
		bio                    pgtype.Text
		avatarURL              pgtype.Text
		finalScore             pgtype.Float8
		hostedEventScore       pgtype.Float8
		hostedEventRatingCount int
		participantScore       pgtype.Float8
		participantRatingCount int
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
		&locale,
		&defaultLocAddress,
		&lat,
		&lon,
		&displayName,
		&bio,
		&avatarURL,
		&finalScore,
		&hostedEventScore,
		&hostedEventRatingCount,
		&participantScore,
		&participantRatingCount,
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
	up.Locale = textValue(locale)
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
	if finalScore.Valid {
		up.FinalScore = &finalScore.Float64
	}
	up.HostScore.RatingCount = hostedEventRatingCount
	if hostedEventScore.Valid {
		up.HostScore.Score = &hostedEventScore.Float64
	}
	up.ParticipantScore.RatingCount = participantRatingCount
	if participantScore.Valid {
		up.ParticipantScore.Score = &participantScore.Float64
	}

	return &up, nil
}

// GetPublicProfile returns the public-safe projection for another user's profile.
func (r *ProfileRepository) GetPublicProfile(ctx context.Context, userID uuid.UUID) (*domain.PublicUserProfile, error) {
	row := r.db.QueryRow(ctx, `
		SELECT
			u.id,
			u.username,
			p.display_name,
			p.avatar_url,
			p.bio,
			us.final_score,
			COALESCE(us.hosted_event_rating_count, 0),
			COALESCE(us.participant_rating_count, 0)
		FROM app_user u
		LEFT JOIN profile p ON p.user_id = u.id
		LEFT JOIN user_score us ON us.user_id = u.id
		WHERE u.id = $1
	`, userID)

	var (
		profileRecord          domain.PublicUserProfile
		displayName            pgtype.Text
		avatarURL              pgtype.Text
		bio                    pgtype.Text
		finalScore             pgtype.Float8
		hostRatingCount        int
		participantRatingCount int
	)

	if err := row.Scan(
		&profileRecord.UserID,
		&profileRecord.Username,
		&displayName,
		&avatarURL,
		&bio,
		&finalScore,
		&hostRatingCount,
		&participantRatingCount,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get public profile: %w", err)
	}

	profileRecord.DisplayName = textPtr(displayName)
	profileRecord.AvatarURL = textPtr(avatarURL)
	profileRecord.Bio = textPtr(bio)
	if finalScore.Valid {
		profileRecord.FinalScore = &finalScore.Float64
	}
	profileRecord.HostRatingCount = hostRatingCount
	profileRecord.ParticipantRatingCount = participantRatingCount

	return &profileRecord, nil
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
			e.privacy_level,
			ec.name AS category,
			e.image_url,
			e.approved_participant_count,
			el.address
		FROM event e
		LEFT JOIN event_category ec ON ec.id = e.category_id
		LEFT JOIN event_location el ON el.event_id = e.id
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
			e.privacy_level,
			ec.name AS category,
			e.image_url,
			e.approved_participant_count,
			el.address
		FROM event e
		JOIN participation p ON p.event_id = e.id
		LEFT JOIN event_category ec ON ec.id = e.category_id
		LEFT JOIN event_location el ON el.event_id = e.id
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
			e.privacy_level,
			ec.name AS category,
			e.image_url,
			e.approved_participant_count,
			el.address
		FROM event e
		JOIN participation p ON p.event_id = e.id
		LEFT JOIN event_category ec ON ec.id = e.category_id
		LEFT JOIN event_location el ON el.event_id = e.id
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
			e.privacy_level,
			ec.name AS category,
			e.image_url,
			e.approved_participant_count,
			el.address
		FROM event e
		JOIN participation p ON p.event_id = e.id
		LEFT JOIN event_category ec ON ec.id = e.category_id
		LEFT JOIN event_location el ON el.event_id = e.id
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

// ListEquipment returns the user's equipment entries ordered newest-first.
func (r *ProfileRepository) ListEquipment(ctx context.Context, userID uuid.UUID) ([]domain.ProfileEquipment, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, name, description, image_url, created_at, updated_at
		FROM profile_equipment
		WHERE user_id = $1
		ORDER BY created_at DESC, id DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list profile equipment: %w", err)
	}
	defer rows.Close()

	items := make([]domain.ProfileEquipment, 0)
	for rows.Next() {
		item, err := scanProfileEquipment(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate profile equipment: %w", err)
	}
	return items, nil
}

// GetEquipmentByID returns one equipment item by its identifier.
func (r *ProfileRepository) GetEquipmentByID(ctx context.Context, equipmentID uuid.UUID) (*domain.ProfileEquipment, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, user_id, name, description, image_url, created_at, updated_at
		FROM profile_equipment
		WHERE id = $1
	`, equipmentID)
	item, err := scanProfileEquipment(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get profile equipment: %w", err)
	}
	return item, nil
}

// CreateEquipment inserts one equipment item for the given user.
func (r *ProfileRepository) CreateEquipment(ctx context.Context, params profileapp.CreateEquipmentParams) (*domain.ProfileEquipment, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO profile_equipment (user_id, name, description, image_url)
		VALUES ($1, $2, $3, $4)
		RETURNING id, user_id, name, description, image_url, created_at, updated_at
	`, params.UserID, params.Name, params.Description, params.ImageURL)
	item, err := scanProfileEquipment(row)
	if err != nil {
		return nil, fmt.Errorf("create profile equipment: %w", err)
	}
	return item, nil
}

// UpdateEquipment updates one equipment item identified by id.
func (r *ProfileRepository) UpdateEquipment(ctx context.Context, params profileapp.UpdateEquipmentParams) (*domain.ProfileEquipment, error) {
	setClauses := "updated_at = now()"
	args := []any{params.EquipmentID}

	if params.Name != nil {
		setClauses += fmt.Sprintf(", name = $%d", len(args)+1)
		args = append(args, *params.Name)
	}
	if params.Description != nil {
		setClauses += fmt.Sprintf(", description = $%d", len(args)+1)
		args = append(args, *params.Description)
	}
	if params.ImageURL != nil {
		setClauses += fmt.Sprintf(", image_url = $%d", len(args)+1)
		args = append(args, *params.ImageURL)
	}

	row := r.db.QueryRow(ctx, fmt.Sprintf(`
		UPDATE profile_equipment
		SET %s
		WHERE id = $1
		RETURNING id, user_id, name, description, image_url, created_at, updated_at
	`, setClauses), args...)
	item, err := scanProfileEquipment(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("update profile equipment: %w", err)
	}
	return item, nil
}

// DeleteEquipment deletes one equipment item by id.
func (r *ProfileRepository) DeleteEquipment(ctx context.Context, equipmentID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM profile_equipment WHERE id = $1`, equipmentID)
	if err != nil {
		return fmt.Errorf("delete profile equipment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// ListShowcaseImages returns the user's showcase images ordered newest-first.
func (r *ProfileRepository) ListShowcaseImages(ctx context.Context, userID uuid.UUID) ([]domain.ProfileShowcaseImage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, image_url, created_at, updated_at
		FROM profile_showcase_image
		WHERE user_id = $1
		ORDER BY created_at DESC, id DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list showcase images: %w", err)
	}
	defer rows.Close()

	items := make([]domain.ProfileShowcaseImage, 0)
	for rows.Next() {
		item, err := scanProfileShowcaseImage(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate showcase images: %w", err)
	}
	return items, nil
}

// GetShowcaseImageByID returns one showcase image by its identifier.
func (r *ProfileRepository) GetShowcaseImageByID(ctx context.Context, showcaseImageID uuid.UUID) (*domain.ProfileShowcaseImage, error) {
	row := r.db.QueryRow(ctx, `
		SELECT id, user_id, image_url, created_at, updated_at
		FROM profile_showcase_image
		WHERE id = $1
	`, showcaseImageID)
	item, err := scanProfileShowcaseImage(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get showcase image: %w", err)
	}
	return item, nil
}

// CreateShowcaseImage inserts a new showcase image row for the given user.
func (r *ProfileRepository) CreateShowcaseImage(ctx context.Context, userID uuid.UUID, imageURL string) (*domain.ProfileShowcaseImage, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO profile_showcase_image (user_id, image_url)
		VALUES ($1, $2)
		RETURNING id, user_id, image_url, created_at, updated_at
	`, userID, imageURL)
	item, err := scanProfileShowcaseImage(row)
	if err != nil {
		return nil, fmt.Errorf("create showcase image: %w", err)
	}
	return item, nil
}

// DeleteShowcaseImage deletes one showcase image by id.
func (r *ProfileRepository) DeleteShowcaseImage(ctx context.Context, showcaseImageID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM profile_showcase_image WHERE id = $1`, showcaseImageID)
	if err != nil {
		return fmt.Errorf("delete showcase image: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// SearchUsers returns lightweight user summaries ordered for username picker relevance.
func (r *ProfileRepository) SearchUsers(ctx context.Context, query string, limit int) ([]profileapp.UserSearchRecord, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT u.id, u.username, p.display_name, p.avatar_url
		FROM app_user u
		LEFT JOIN profile p ON p.user_id = u.id
		WHERE u.username ILIKE '%' || $1 || '%'
		ORDER BY
			CASE WHEN u.username = $1 THEN 0 WHEN u.username ILIKE $1 || '%' THEN 1 ELSE 2 END,
			u.username ASC
		LIMIT $2
	`, query, limit)
	if err != nil {
		return nil, fmt.Errorf("search users: %w", err)
	}
	defer rows.Close()

	records := make([]profileapp.UserSearchRecord, 0)
	for rows.Next() {
		var (
			record      profileapp.UserSearchRecord
			displayName pgtype.Text
			avatarURL   pgtype.Text
		)
		if err := rows.Scan(&record.ID, &record.Username, &displayName, &avatarURL); err != nil {
			return nil, fmt.Errorf("scan user search result: %w", err)
		}
		record.DisplayName = textPtr(displayName)
		record.AvatarURL = textPtr(avatarURL)
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate user search results: %w", err)
	}
	return records, nil
}

func scanProfileEquipment(row interface{ Scan(...any) error }) (*domain.ProfileEquipment, error) {
	var (
		item        domain.ProfileEquipment
		description pgtype.Text
		imageURL    pgtype.Text
	)
	if err := row.Scan(
		&item.ID,
		&item.UserID,
		&item.Name,
		&description,
		&imageURL,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return nil, err
	}
	item.Description = textPtr(description)
	item.ImageURL = textPtr(imageURL)
	return &item, nil
}

func scanProfileShowcaseImage(row interface{ Scan(...any) error }) (*domain.ProfileShowcaseImage, error) {
	var item domain.ProfileShowcaseImage
	if err := row.Scan(
		&item.ID,
		&item.UserID,
		&item.ImageURL,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &item, nil
}

func scanEventSummaries(rows interface {
	Next() bool
	Scan(...any) error
	Err() error
}) ([]domain.EventSummary, error) {
	var events []domain.EventSummary
	for rows.Next() {
		var (
			e               domain.EventSummary
			endTime         pgtype.Timestamptz
			category        pgtype.Text
			imageURL        pgtype.Text
			locationAddress pgtype.Text
		)
		if err := rows.Scan(&e.ID, &e.Title, &e.StartTime, &endTime, &e.Status, &e.PrivacyLevel,
			&category, &imageURL, &e.ApprovedParticipantCount, &locationAddress); err != nil {
			return nil, fmt.Errorf("scan event summary: %w", err)
		}
		if endTime.Valid {
			e.EndTime = endTime.Time
		}
		e.Category = textPtr(category)
		e.ImageURL = textPtr(imageURL)
		e.LocationAddress = textPtr(locationAddress)
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
	if params.Locale != nil {
		setClauses += fmt.Sprintf(", locale = $%d", len(userArgs)+1)
		userArgs = append(userArgs, *params.Locale)
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

// GetLocale returns the persisted locale preference for the given user.
// Returns domain.ErrNotFound when the user does not exist.
func (r *ProfileRepository) GetLocale(ctx context.Context, userID uuid.UUID) (string, error) {
	var locale string
	err := r.pool.QueryRow(ctx, `SELECT locale FROM app_user WHERE id = $1`, userID).Scan(&locale)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", domain.ErrNotFound
		}
		return "", fmt.Errorf("get locale: %w", err)
	}
	return locale, nil
}

// GetPasswordHash returns the bcrypt hash stored for the given user.
func (r *ProfileRepository) GetPasswordHash(ctx context.Context, userID uuid.UUID) (string, error) {
	var hash string
	err := r.pool.QueryRow(ctx, `SELECT password_hash FROM app_user WHERE id = $1`, userID).Scan(&hash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", domain.ErrNotFound
		}
		return "", fmt.Errorf("get password hash: %w", err)
	}
	return hash, nil
}

// UpdatePasswordHash replaces the stored password hash for the given user.
func (r *ProfileRepository) UpdatePasswordHash(ctx context.Context, userID uuid.UUID, newHash string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE app_user SET password_hash = $2, updated_at = now() WHERE id = $1`,
		userID, newHash,
	)
	if err != nil {
		return fmt.Errorf("update password hash: %w", err)
	}
	return nil
}

var _ imageuploadapp.ProfileRepository = (*ProfileRepository)(nil)
