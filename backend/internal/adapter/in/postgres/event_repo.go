package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	eventapp "github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EventRepository is the Postgres-backed implementation of event.Repository.
type EventRepository struct {
	pool *pgxpool.Pool
}

// NewEventRepository returns a repository that executes queries against the given connection pool.
func NewEventRepository(pool *pgxpool.Pool) *EventRepository {
	return &EventRepository{pool: pool}
}

// CreateEvent persists the event along with its location, tags, and constraints
// in a single transaction, returning the created event.
func (r *EventRepository) CreateEvent(ctx context.Context, params eventapp.CreateEventParams) (*domain.Event, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	event, err := insertEventRow(ctx, tx, params)
	if err != nil {
		return nil, mapEventInsertError(err)
	}

	if err := insertEventLocation(ctx, tx, event.ID, params.Address, params.LocationType, params.Point, params.RoutePoints); err != nil {
		return nil, err
	}

	if err := insertEventTags(ctx, tx, event.ID, params.Tags); err != nil {
		return nil, err
	}

	if err := insertEventConstraints(ctx, tx, event.ID, params.Constraints); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	return event, nil
}

// insertEventRow inserts the core event record and returns the populated Event entity.
func insertEventRow(ctx context.Context, tx pgx.Tx, params eventapp.CreateEventParams) (*domain.Event, error) {
	var (
		id           uuid.UUID
		title        string
		privacyLevel string
		status       string
		startTime    time.Time
		endTime      pgtype.Timestamptz
		createdAt    time.Time
		updatedAt    time.Time
	)

	var preferredGender *string
	if params.PreferredGender != nil {
		preferredGender = new(string(*params.PreferredGender))
	}

	err := tx.QueryRow(ctx, `
		INSERT INTO event (
			host_id, title, description, image_url, category_id,
			start_time, end_time, privacy_level, status,
			capacity, minimum_age, preferred_gender, location_type
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11, $12, $13
		)
		RETURNING id, title, privacy_level, status, start_time, end_time, created_at, updated_at
	`,
		params.HostID, params.Title, params.Description, params.ImageURL, params.CategoryID,
		params.StartTime, params.EndTime, string(params.PrivacyLevel), string(domain.EventStatusActive),
		params.Capacity, params.MinimumAge, preferredGender, string(params.LocationType),
	).Scan(&id, &title, &privacyLevel, &status, &startTime, &endTime, &createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert event: %w", err)
	}

	event := &domain.Event{
		ID:              id,
		HostID:          params.HostID,
		Title:           title,
		Description:     new(params.Description),
		ImageURL:        params.ImageURL,
		CategoryID:      new(params.CategoryID),
		StartTime:       startTime,
		PrivacyLevel:    domain.EventPrivacyLevel(privacyLevel),
		Status:          domain.EventStatus(status),
		Capacity:        params.Capacity,
		MinimumAge:      params.MinimumAge,
		PreferredGender: params.PreferredGender,
		LocationType:    new(params.LocationType),
		CreatedAt:       createdAt,
		UpdatedAt:       updatedAt,
	}
	if endTime.Valid {
		event.EndTime = &endTime.Time
	}

	return event, nil
}

// mapEventInsertError maps Postgres insert constraint violations on events to
// domain errors so clients get actionable 400/409 responses instead of 500.
func mapEventInsertError(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return err
	}

	switch pgErr.Code {
	case "23503":
		if pgErr.ConstraintName == "fk_event_category" {
			return domain.ValidationError(map[string]string{
				"category_id": "must reference an existing event category id",
			})
		}
	case "23505":
		if pgErr.ConstraintName == "uq_event_host_title" {
			return domain.ConflictError(
				domain.ErrorCodeEventTitleExists,
				"The host already has an event with this title.",
			)
		}
	}

	return err
}

// insertEventLocation inserts the PostGIS geography point for the event.
func insertEventLocation(
	ctx context.Context,
	tx pgx.Tx,
	eventID uuid.UUID,
	address *string,
	locationType domain.EventLocationType,
	point *domain.GeoPoint,
	routePoints []domain.GeoPoint,
) error {
	switch locationType {
	case domain.LocationPoint:
		if point == nil {
			return fmt.Errorf("insert event_location: point geometry is required")
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO event_location (event_id, address, geom)
			VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)
		`, eventID, address, point.Lon, point.Lat)
		if err != nil {
			return fmt.Errorf("insert event_location: %w", err)
		}
	case domain.LocationRoute:
		if len(routePoints) < domain.MinRoutePoints {
			return fmt.Errorf("insert event_location: route geometry requires at least %d points", domain.MinRoutePoints)
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO event_location (event_id, address, geom)
			VALUES ($1, $2, ST_GeogFromText($3))
		`, eventID, address, buildRouteWKT(routePoints))
		if err != nil {
			return fmt.Errorf("insert event_location: %w", err)
		}
	default:
		return fmt.Errorf("insert event_location: unsupported location type %q", locationType)
	}

	return nil
}

// insertEventTags inserts each tag row for the event.
func insertEventTags(ctx context.Context, tx pgx.Tx, eventID uuid.UUID, tags []string) error {
	for _, tag := range tags {
		if _, err := tx.Exec(ctx, `
			INSERT INTO event_tag (event_id, name) VALUES ($1, $2)
		`, eventID, tag); err != nil {
			return fmt.Errorf("insert event_tag %q: %w", tag, err)
		}
	}
	return nil
}

// insertEventConstraints inserts each constraint row for the event.
func insertEventConstraints(ctx context.Context, tx pgx.Tx, eventID uuid.UUID, constraints []eventapp.EventConstraintParams) error {
	for _, c := range constraints {
		if _, err := tx.Exec(ctx, `
			INSERT INTO event_constraint (event_id, constraint_type, constraint_info)
			VALUES ($1, $2, $3)
		`, eventID, c.Type, c.Info); err != nil {
			return fmt.Errorf("insert event_constraint: %w", err)
		}
	}
	return nil
}

func buildRouteWKT(points []domain.GeoPoint) string {
	segments := make([]string, len(points))
	for i, point := range points {
		segments[i] = fmt.Sprintf("%f %f", point.Lon, point.Lat)
	}

	return "SRID=4326;LINESTRING(" + strings.Join(segments, ", ") + ")"
}

// GetEventByID fetches a single event row by its primary key.
// Returns domain.ErrNotFound when no matching row exists.
func (r *EventRepository) GetEventByID(ctx context.Context, eventID uuid.UUID) (*domain.Event, error) {
	var (
		id              uuid.UUID
		hostID          uuid.UUID
		title           string
		description     pgtype.Text
		imageURL        pgtype.Text
		categoryID      pgtype.Int4
		startTime       time.Time
		endTime         pgtype.Timestamptz
		privacyLevel    string
		status          string
		capacity        pgtype.Int4
		approvedCount   int
		minimumAge      pgtype.Int4
		preferredGender pgtype.Text
		locationType    pgtype.Text
		createdAt       time.Time
		updatedAt       time.Time
	)

	err := r.pool.QueryRow(ctx, `
		SELECT id, host_id, title, description, image_url, category_id,
		       start_time, end_time, privacy_level, status, capacity,
		       approved_participant_count, minimum_age, preferred_gender,
		       location_type, created_at, updated_at
		FROM event
		WHERE id = $1
	`, eventID).Scan(
		&id, &hostID, &title, &description, &imageURL, &categoryID,
		&startTime, &endTime, &privacyLevel, &status, &capacity,
		&approvedCount, &minimumAge, &preferredGender,
		&locationType, &createdAt, &updatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get event by id: %w", err)
	}

	event := &domain.Event{
		ID:                       id,
		HostID:                   hostID,
		Title:                    title,
		PrivacyLevel:             domain.EventPrivacyLevel(privacyLevel),
		Status:                   domain.EventStatus(status),
		StartTime:                startTime,
		ApprovedParticipantCount: approvedCount,
		CreatedAt:                createdAt,
		UpdatedAt:                updatedAt,
	}
	if endTime.Valid {
		event.EndTime = &endTime.Time
	}
	if description.Valid {
		event.Description = &description.String
	}
	if imageURL.Valid {
		event.ImageURL = &imageURL.String
	}
	if categoryID.Valid {
		event.CategoryID = new(int(categoryID.Int32))
	}
	if capacity.Valid {
		event.Capacity = new(int(capacity.Int32))
	}
	if minimumAge.Valid {
		event.MinimumAge = new(int(minimumAge.Int32))
	}
	if preferredGender.Valid {
		event.PreferredGender = new(domain.EventParticipantGender(preferredGender.String))
	}
	if locationType.Valid {
		event.LocationType = new(domain.EventLocationType(locationType.String))
	}

	return event, nil
}
