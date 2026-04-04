package postgres

import (
	"context"
	"errors"
	"fmt"

	favoritelocationapp "github.com/bounswe/bounswe2026group11/backend/internal/application/favorite_location"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// FavoriteLocationRepository is the Postgres-backed implementation of favorite_location.Repository.
type FavoriteLocationRepository struct {
	pool *pgxpool.Pool
	db   execer
}

// NewFavoriteLocationRepository returns a repository that executes queries against the given connection pool.
func NewFavoriteLocationRepository(pool *pgxpool.Pool) *FavoriteLocationRepository {
	return &FavoriteLocationRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

// ListByUserID returns all favorite locations owned by the given user ordered alphabetically by name.
func (r *FavoriteLocationRepository) ListByUserID(ctx context.Context, userID uuid.UUID) ([]domain.FavoriteLocation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			id,
			user_id,
			name,
			address,
			ST_Y(point::geometry) AS lat,
			ST_X(point::geometry) AS lon,
			created_at,
			updated_at
		FROM favorite_location
		WHERE user_id = $1
		ORDER BY LOWER(name) ASC, name ASC, id ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list favorite locations: %w", err)
	}
	defer rows.Close()

	var locations []domain.FavoriteLocation
	for rows.Next() {
		location, err := scanFavoriteLocation(rows)
		if err != nil {
			return nil, fmt.Errorf("scan favorite location: %w", err)
		}
		locations = append(locations, *location)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate favorite locations: %w", err)
	}
	if locations == nil {
		locations = []domain.FavoriteLocation{}
	}

	return locations, nil
}

// Create inserts a new favorite location while atomically enforcing the per-user maximum.
func (r *FavoriteLocationRepository) Create(ctx context.Context, params favoritelocationapp.CreateFavoriteLocationParams) (*domain.FavoriteLocation, error) {
	if err := r.lockUserRow(ctx, r.db, params.UserID); err != nil {
		return nil, err
	}

	var count int
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM favorite_location
		WHERE user_id = $1
	`, params.UserID).Scan(&count); err != nil {
		return nil, fmt.Errorf("count favorite locations: %w", err)
	}
	if count >= favoritelocationapp.MaxFavoriteLocations {
		return nil, favoritelocationapp.ErrFavoriteLocationLimitExceeded
	}

	location, err := scanFavoriteLocation(r.db.QueryRow(ctx, `
		INSERT INTO favorite_location (
			user_id,
			name,
			address,
			point
		)
		VALUES (
			$1,
			$2,
			$3,
			ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography
		)
		RETURNING
			id,
			user_id,
			name,
			address,
			ST_Y(point::geometry) AS lat,
			ST_X(point::geometry) AS lon,
			created_at,
			updated_at
	`, params.UserID, params.Name, params.Address, params.Lon, params.Lat))
	if err != nil {
		return nil, fmt.Errorf("insert favorite location: %w", err)
	}

	return location, nil
}

// GetByIDForUser returns a single favorite location owned by the given user.
func (r *FavoriteLocationRepository) GetByIDForUser(ctx context.Context, userID, favoriteLocationID uuid.UUID) (*domain.FavoriteLocation, error) {
	location, err := scanFavoriteLocation(r.db.QueryRow(ctx, `
		SELECT
			id,
			user_id,
			name,
			address,
			ST_Y(point::geometry) AS lat,
			ST_X(point::geometry) AS lon,
			created_at,
			updated_at
		FROM favorite_location
		WHERE id = $1
		  AND user_id = $2
	`, favoriteLocationID, userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get favorite location: %w", err)
	}

	return location, nil
}

// Update replaces the persisted fields of a user-owned favorite location.
func (r *FavoriteLocationRepository) Update(ctx context.Context, params favoritelocationapp.UpdateFavoriteLocationParams) (*domain.FavoriteLocation, error) {
	location, err := scanFavoriteLocation(r.db.QueryRow(ctx, `
		UPDATE favorite_location
		SET name = $3,
		    address = $4,
		    point = ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
		    updated_at = now()
		WHERE id = $1
		  AND user_id = $2
		RETURNING
			id,
			user_id,
			name,
			address,
			ST_Y(point::geometry) AS lat,
			ST_X(point::geometry) AS lon,
			created_at,
			updated_at
	`, params.FavoriteLocationID, params.UserID, params.Name, params.Address, params.Lon, params.Lat))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("update favorite location: %w", err)
	}

	return location, nil
}

// Delete removes a favorite location owned by the given user.
func (r *FavoriteLocationRepository) Delete(ctx context.Context, userID, favoriteLocationID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM favorite_location
		WHERE id = $1
		  AND user_id = $2
	`, favoriteLocationID, userID)
	if err != nil {
		return fmt.Errorf("delete favorite location: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}

	return nil
}

func (r *FavoriteLocationRepository) lockUserRow(ctx context.Context, db execer, userID uuid.UUID) error {
	var lockedUserID uuid.UUID
	if err := db.QueryRow(ctx, `
		SELECT id
		FROM app_user
		WHERE id = $1
		FOR UPDATE
	`, userID).Scan(&lockedUserID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		return fmt.Errorf("lock user row: %w", err)
	}

	return nil
}

func scanFavoriteLocation(row pgx.Row) (*domain.FavoriteLocation, error) {
	var (
		location domain.FavoriteLocation
		name     pgtype.Text
		address  pgtype.Text
		lat      pgtype.Float8
		lon      pgtype.Float8
	)

	if err := row.Scan(
		&location.ID,
		&location.UserID,
		&name,
		&address,
		&lat,
		&lon,
		&location.CreatedAt,
		&location.UpdatedAt,
	); err != nil {
		return nil, err
	}

	if !name.Valid || !address.Valid || !lat.Valid || !lon.Valid {
		return nil, fmt.Errorf("favorite_location %s has null required fields", location.ID)
	}

	location.Name = name.String
	location.Address = address.String
	location.Point = domain.GeoPoint{
		Lat: lat.Float64,
		Lon: lon.Float64,
	}

	return &location, nil
}

var _ favoritelocationapp.Repository = (*FavoriteLocationRepository)(nil)
