package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	eventapp "github.com/bounswe/bounswe2026group11/backend/internal/application/event"
	imageuploadapp "github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
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
	db   execer
}

// NewEventRepository returns a repository that executes queries against the given connection pool.
func NewEventRepository(pool *pgxpool.Pool) *EventRepository {
	return &EventRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

// CreateEvent persists the event along with its location, tags, and constraints
// in a single transaction, returning the created event.
func (r *EventRepository) CreateEvent(ctx context.Context, params eventapp.CreateEventParams) (*domain.Event, error) {
	event, err := insertEventRow(ctx, r.db, params)
	if err != nil {
		return nil, mapEventInsertError(err)
	}

	if err := insertHostParticipation(ctx, r.db, event); err != nil {
		return nil, err
	}

	if err := insertEventLocation(ctx, r.db, event.ID, params.Address, params.LocationType, params.Point, params.RoutePoints); err != nil {
		return nil, err
	}

	if err := insertEventTags(ctx, r.db, event.ID, params.Tags); err != nil {
		return nil, err
	}

	if err := insertEventConstraints(ctx, r.db, event.ID, params.Constraints); err != nil {
		return nil, err
	}

	return event, nil
}

// GetEventEditSnapshot loads and locks the event state needed to evaluate an edit.
func (r *EventRepository) GetEventEditSnapshot(ctx context.Context, eventID uuid.UUID) (*eventapp.EventEditSnapshot, error) {
	var (
		event           domain.Event
		description     pgtype.Text
		imageURL        pgtype.Text
		categoryID      pgtype.Int4
		endTime         pgtype.Timestamptz
		privacyLevel    string
		status          string
		capacity        pgtype.Int4
		minimumAge      pgtype.Int4
		preferredGender pgtype.Text
		locationType    pgtype.Text
		versionNo       int
	)

	err := r.db.QueryRow(ctx, `
		SELECT id, host_id, title, description, image_url, category_id,
		       start_time, end_time, privacy_level, status, capacity,
		       approved_participant_count, pending_participant_count,
		       minimum_age, preferred_gender, location_type,
		       version_no, created_at, updated_at
		FROM event
		WHERE id = $1
		FOR UPDATE
	`, eventID).Scan(
		&event.ID,
		&event.HostID,
		&event.Title,
		&description,
		&imageURL,
		&categoryID,
		&event.StartTime,
		&endTime,
		&privacyLevel,
		&status,
		&capacity,
		&event.ApprovedParticipantCount,
		&event.PendingParticipantCount,
		&minimumAge,
		&preferredGender,
		&locationType,
		&versionNo,
		&event.CreatedAt,
		&event.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get event edit snapshot: %w", err)
	}

	if description.Valid {
		event.Description = &description.String
	}
	event.PrivacyLevel = domain.EventPrivacyLevel(privacyLevel)
	event.Status = domain.EventStatus(status)
	event.VersionNo = versionNo
	if imageURL.Valid {
		event.ImageURL = &imageURL.String
	}
	if categoryID.Valid {
		event.CategoryID = new(int)
		*event.CategoryID = int(categoryID.Int32)
	}
	if endTime.Valid {
		event.EndTime = &endTime.Time
	}
	if capacity.Valid {
		event.Capacity = new(int)
		*event.Capacity = int(capacity.Int32)
	}
	if minimumAge.Valid {
		event.MinimumAge = new(int)
		*event.MinimumAge = int(minimumAge.Int32)
	}
	if preferredGender.Valid {
		gender := domain.EventParticipantGender(preferredGender.String)
		event.PreferredGender = &gender
	}
	if locationType.Valid {
		locType := domain.EventLocationType(locationType.String)
		event.LocationType = &locType
	} else {
		locType := domain.LocationPoint
		event.LocationType = &locType
	}

	location, err := r.loadEventEditLocation(ctx, eventID, *event.LocationType)
	if err != nil {
		return nil, err
	}
	constraints, err := r.loadEventEditConstraints(ctx, eventID)
	if err != nil {
		return nil, err
	}

	return &eventapp.EventEditSnapshot{
		Event:       event,
		VersionNo:   versionNo,
		Location:    location,
		Constraints: constraints,
	}, nil
}

// UpdateEvent persists a fully merged event edit. Related location and
// constraint replacements are expected to run inside the caller's transaction.
func (r *EventRepository) UpdateEvent(ctx context.Context, params eventapp.UpdateEventParams) (*domain.Event, error) {
	updated, err := updateEventRow(ctx, r.db, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, eventapp.ErrEventNotEditable
		}
		return nil, mapEventUpdateError(err)
	}

	if params.LocationChanged {
		if _, err := r.db.Exec(ctx, `DELETE FROM event_location WHERE event_id = $1`, params.EventID); err != nil {
			return nil, fmt.Errorf("delete event location: %w", err)
		}
		if err := insertEventLocation(ctx, r.db, params.EventID, params.Address, params.LocationType, params.Point, params.RoutePoints); err != nil {
			return nil, err
		}
	}
	if params.ConstraintsChanged {
		if _, err := r.db.Exec(ctx, `DELETE FROM event_constraint WHERE event_id = $1`, params.EventID); err != nil {
			return nil, fmt.Errorf("delete event constraints: %w", err)
		}
		if err := insertEventConstraints(ctx, r.db, params.EventID, params.Constraints); err != nil {
			return nil, err
		}
	}
	return updated, nil
}

// CreateEventHistorySnapshot stores an immutable snapshot of the current event
// detail state for one event version.
func (r *EventRepository) CreateEventHistorySnapshot(
	ctx context.Context,
	eventID uuid.UUID,
	versionNo int,
	changedFields []string,
	createdByUserID uuid.UUID,
) error {
	tag, err := r.db.Exec(ctx, `
		WITH event_snapshot AS (
			SELECT
				e.id,
				e.host_id,
				e.title,
				e.description,
				e.image_url,
				e.category_id,
				e.start_time,
				e.end_time,
				e.privacy_level,
				e.status,
				e.capacity,
				e.minimum_age,
				e.preferred_gender,
				e.location_type,
				e.child_friendly,
				e.family_oriented,
				e.updated_at,
				CASE
					WHEN ec.id IS NULL THEN NULL
					ELSE jsonb_build_object('id', ec.id, 'name', ec.name)
				END AS category,
				CASE
					WHEN e.location_type = 'ROUTE' THEN jsonb_build_object(
						'type', e.location_type,
						'address', el.address,
						'route_points', (
							SELECT COALESCE(
								jsonb_agg(jsonb_build_object('lat', ST_Y(dp.geom), 'lon', ST_X(dp.geom)) ORDER BY dp.path),
								'[]'::jsonb
							)
							FROM ST_DumpPoints(el.geom::geometry) AS dp
						)
					)
					ELSE jsonb_build_object(
						'type', e.location_type,
						'address', el.address,
						'point', jsonb_build_object('lat', ST_Y(el.geom::geometry), 'lon', ST_X(el.geom::geometry)),
						'route_points', '[]'::jsonb
					)
				END AS location,
				(
					SELECT COALESCE(jsonb_agg(et.name ORDER BY et.name), '[]'::jsonb)
					FROM event_tag et
					WHERE et.event_id = e.id
				) AS tags,
				(
					SELECT COALESCE(
						jsonb_agg(jsonb_build_object('type', ect.constraint_type, 'info', ect.constraint_info) ORDER BY ect.created_at, ect.id),
						'[]'::jsonb
					)
					FROM event_constraint ect
					WHERE ect.event_id = e.id
				) AS constraints
			FROM event e
			JOIN event_location el ON el.event_id = e.id
			LEFT JOIN event_category ec ON ec.id = e.category_id
			WHERE e.id = $1
		)
		INSERT INTO event_history (
			event_id, host_id, title, category_id, description, start_time,
			end_time, privacy_level, status, capacity, minimum_age,
			preferred_gender, location_type, version_no, snapshot,
			changed_fields, created_by_user_id, event_updated_at, created_at, updated_at
		)
		SELECT
			id,
			host_id,
			title,
			category_id,
			description,
			start_time,
			end_time,
			privacy_level,
			status,
			capacity,
			minimum_age,
			preferred_gender,
			location_type,
			$2,
			jsonb_build_object(
				'title', title,
				'description', description,
				'image_url', image_url,
				'privacy_level', privacy_level,
				'status', status,
				'start_time', start_time,
				'end_time', end_time,
				'capacity', capacity,
				'minimum_age', minimum_age,
				'preferred_gender', preferred_gender,
				'child_friendly', child_friendly,
				'family_oriented', family_oriented,
				'category', category,
				'location', location,
				'tags', tags,
				'constraints', constraints
			),
			COALESCE($3::text[], '{}'::text[]),
			NULLIF($4::uuid, '00000000-0000-0000-0000-000000000000'::uuid),
			updated_at,
			NOW(),
			NOW()
		FROM event_snapshot
	`, eventID, versionNo, changedFields, createdByUserID)
	if err != nil {
		return fmt.Errorf("create event history snapshot: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// GetEventHistorySnapshot loads one stored event version.
func (r *EventRepository) GetEventHistorySnapshot(
	ctx context.Context,
	eventID uuid.UUID,
	versionNo int,
) (*eventapp.EventHistorySnapshotRecord, error) {
	record, err := scanEventHistorySnapshot(r.db.QueryRow(ctx, `
		SELECT event_id, version_no, changed_fields, snapshot, event_updated_at
		FROM event_history
		WHERE event_id = $1
		  AND version_no = $2
	`, eventID, versionNo))
	if err != nil {
		return nil, err
	}
	return record, nil
}

// GetLatestEventHistorySnapshot loads the highest stored event version.
func (r *EventRepository) GetLatestEventHistorySnapshot(
	ctx context.Context,
	eventID uuid.UUID,
) (*eventapp.EventHistorySnapshotRecord, error) {
	record, err := scanEventHistorySnapshot(r.db.QueryRow(ctx, `
		SELECT event_id, version_no, changed_fields, snapshot, event_updated_at
		FROM event_history
		WHERE event_id = $1
		ORDER BY version_no DESC
		LIMIT 1
	`, eventID))
	if err != nil {
		return nil, err
	}
	return record, nil
}

func scanEventHistorySnapshot(row pgx.Row) (*eventapp.EventHistorySnapshotRecord, error) {
	var (
		record      eventapp.EventHistorySnapshotRecord
		snapshotRaw []byte
	)
	if err := row.Scan(
		&record.EventID,
		&record.VersionNo,
		&record.ChangedFields,
		&snapshotRaw,
		&record.EventUpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("scan event history snapshot: %w", err)
	}
	if err := json.Unmarshal(snapshotRaw, &record.Snapshot); err != nil {
		return nil, fmt.Errorf("decode event history snapshot: %w", err)
	}
	if record.Snapshot.Tags == nil {
		record.Snapshot.Tags = []string{}
	}
	if record.Snapshot.Constraints == nil {
		record.Snapshot.Constraints = []eventapp.EventDetailConstraintRecord{}
	}
	if record.Snapshot.Location.RoutePoints == nil {
		record.Snapshot.Location.RoutePoints = []eventapp.EventDetailPoint{}
	}
	return &record, nil
}

// insertEventRow inserts the core event record and returns the populated Event entity.
func insertEventRow(ctx context.Context, db execer, params eventapp.CreateEventParams) (*domain.Event, error) {
	var (
		id           uuid.UUID
		versionNo    int
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

	err := db.QueryRow(ctx, `
		INSERT INTO event (
			host_id, title, description, image_url, category_id,
			start_time, end_time, privacy_level, status,
			capacity, minimum_age, preferred_gender, location_type,
			child_friendly, family_oriented
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11, $12, $13,
			$14, $15
		)
		RETURNING id, version_no, title, privacy_level, status, start_time, end_time, created_at, updated_at
	`,
		params.HostID, params.Title, params.Description, params.ImageURL, params.CategoryID,
		params.StartTime, params.EndTime, string(params.PrivacyLevel), string(domain.EventStatusActive),
		params.Capacity, params.MinimumAge, preferredGender, string(params.LocationType),
		params.ChildFriendly, params.FamilyOriented,
	).Scan(&id, &versionNo, &title, &privacyLevel, &status, &startTime, &endTime, &createdAt, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert event: %w", err)
	}

	event := &domain.Event{
		ID:              id,
		HostID:          params.HostID,
		VersionNo:       versionNo,
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

func updateEventRow(ctx context.Context, db execer, params eventapp.UpdateEventParams) (*domain.Event, error) {
	var (
		event        domain.Event
		description  pgtype.Text
		imageURL     pgtype.Text
		categoryID   pgtype.Int4
		endTime      pgtype.Timestamptz
		capacity     pgtype.Int4
		privacyLevel string
		status       string
		locationType string
	)

	err := db.QueryRow(ctx, `
		UPDATE event
		SET title = $2,
		    description = $3,
		    category_id = $4,
		    start_time = $5,
		    end_time = $6,
		    capacity = $7,
		    location_type = $8,
		    version_no = version_no + 1,
		    updated_at = NOW()
		WHERE id = $1
		  AND status = $9
		RETURNING id, host_id, version_no, title, description, image_url, category_id,
		          start_time, end_time, privacy_level, status, capacity,
		          approved_participant_count, pending_participant_count,
		          location_type, created_at, updated_at
	`,
		params.EventID,
		params.Title,
		params.Description,
		params.CategoryID,
		params.StartTime,
		params.EndTime,
		params.Capacity,
		string(params.LocationType),
		string(domain.EventStatusActive),
	).Scan(
		&event.ID,
		&event.HostID,
		&event.VersionNo,
		&event.Title,
		&description,
		&imageURL,
		&categoryID,
		&event.StartTime,
		&endTime,
		&privacyLevel,
		&status,
		&capacity,
		&event.ApprovedParticipantCount,
		&event.PendingParticipantCount,
		&locationType,
		&event.CreatedAt,
		&event.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("update event: %w", err)
	}

	if description.Valid {
		event.Description = &description.String
	}
	if imageURL.Valid {
		event.ImageURL = &imageURL.String
	}
	if categoryID.Valid {
		event.CategoryID = new(int)
		*event.CategoryID = int(categoryID.Int32)
	}
	if endTime.Valid {
		event.EndTime = &endTime.Time
	}
	if capacity.Valid {
		event.Capacity = new(int)
		*event.Capacity = int(capacity.Int32)
	}
	event.PrivacyLevel = domain.EventPrivacyLevel(privacyLevel)
	event.Status = domain.EventStatus(status)
	locType := domain.EventLocationType(locationType)
	event.LocationType = &locType
	return &event, nil
}

// insertHostParticipation creates the host's internal APPROVED participation
// row so downstream authorization can treat the host as part of the event
// membership set without exposing them as a normal participant.
func insertHostParticipation(ctx context.Context, db execer, event *domain.Event) error {
	if _, err := db.Exec(ctx, `
		INSERT INTO participation (
			event_id, user_id, status, last_confirmed_event_version, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, event.ID, event.HostID, domain.ParticipationStatusApproved, event.VersionNo, event.CreatedAt, event.UpdatedAt); err != nil {
		return fmt.Errorf("insert host participation: %w", err)
	}

	return nil
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

func mapEventUpdateError(err error) error {
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
	db execer,
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
		_, err := db.Exec(ctx, `
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
		_, err := db.Exec(ctx, `
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
func insertEventTags(ctx context.Context, db execer, eventID uuid.UUID, tags []string) error {
	for _, tag := range tags {
		if _, err := db.Exec(ctx, `
			INSERT INTO event_tag (event_id, name) VALUES ($1, $2)
		`, eventID, tag); err != nil {
			return fmt.Errorf("insert event_tag %q: %w", tag, err)
		}
	}
	return nil
}

// insertEventConstraints inserts each constraint row for the event.
func insertEventConstraints(ctx context.Context, db execer, eventID uuid.UUID, constraints []eventapp.EventConstraintParams) error {
	for _, c := range constraints {
		if _, err := db.Exec(ctx, `
			INSERT INTO event_constraint (event_id, constraint_type, constraint_info)
			VALUES ($1, $2, $3)
		`, eventID, c.Type, c.Info); err != nil {
			return fmt.Errorf("insert event_constraint: %w", err)
		}
	}
	return nil
}

func (r *EventRepository) loadEventEditLocation(
	ctx context.Context,
	eventID uuid.UUID,
	locationType domain.EventLocationType,
) (eventapp.EventDetailLocationRecord, error) {
	location := eventapp.EventDetailLocationRecord{
		Type:        locationType,
		RoutePoints: []domain.GeoPoint{},
	}

	var address pgtype.Text
	switch locationType {
	case domain.LocationPoint:
		var point domain.GeoPoint
		err := r.db.QueryRow(ctx, `
			SELECT address, ST_Y(geom::geometry), ST_X(geom::geometry)
			FROM event_location
			WHERE event_id = $1
		`, eventID).Scan(&address, &point.Lat, &point.Lon)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return location, domain.ErrNotFound
			}
			return location, fmt.Errorf("load event edit point: %w", err)
		}
		location.Point = &point
	case domain.LocationRoute:
		err := r.db.QueryRow(ctx, `
			SELECT address
			FROM event_location
			WHERE event_id = $1
		`, eventID).Scan(&address)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return location, domain.ErrNotFound
			}
			return location, fmt.Errorf("load event edit route: %w", err)
		}
		rows, err := r.db.Query(ctx, `
			SELECT ST_Y(dp.geom), ST_X(dp.geom)
			FROM event_location el
			CROSS JOIN LATERAL ST_DumpPoints(el.geom::geometry) AS dp
			WHERE el.event_id = $1
			ORDER BY dp.path
		`, eventID)
		if err != nil {
			return location, fmt.Errorf("load event edit route points: %w", err)
		}
		defer rows.Close()
		for rows.Next() {
			var point domain.GeoPoint
			if err := rows.Scan(&point.Lat, &point.Lon); err != nil {
				return location, fmt.Errorf("scan event edit route point: %w", err)
			}
			location.RoutePoints = append(location.RoutePoints, point)
		}
		if err := rows.Err(); err != nil {
			return location, fmt.Errorf("iterate event edit route points: %w", err)
		}
	default:
		return location, nil
	}
	if address.Valid {
		location.Address = &address.String
	}
	return location, nil
}

func (r *EventRepository) loadEventEditConstraints(ctx context.Context, eventID uuid.UUID) ([]eventapp.EventDetailConstraintRecord, error) {
	rows, err := r.db.Query(ctx, `
		SELECT constraint_type, constraint_info
		FROM event_constraint
		WHERE event_id = $1
		ORDER BY created_at ASC, id ASC
	`, eventID)
	if err != nil {
		return nil, fmt.Errorf("load event edit constraints: %w", err)
	}
	defer rows.Close()

	constraints := []eventapp.EventDetailConstraintRecord{}
	for rows.Next() {
		var (
			constraintType string
			constraintInfo pgtype.Text
		)
		if err := rows.Scan(&constraintType, &constraintInfo); err != nil {
			return nil, fmt.Errorf("scan event edit constraint: %w", err)
		}
		constraint := eventapp.EventDetailConstraintRecord{Type: constraintType}
		if constraintInfo.Valid {
			constraint.Info = constraintInfo.String
		}
		constraints = append(constraints, constraint)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate event edit constraints: %w", err)
	}
	return constraints, nil
}

func buildRouteWKT(points []domain.GeoPoint) string {
	segments := make([]string, len(points))
	for i, point := range points {
		segments[i] = fmt.Sprintf("%f %f", point.Lon, point.Lat)
	}

	return "SRID=4326;LINESTRING(" + strings.Join(segments, ", ") + ")"
}

// ListDiscoverableEvents returns nearby ACTIVE (not IN_PROGRESS) PUBLIC/PROTECTED events using
// combined full-text search, structured filters, and keyset pagination.
func (r *EventRepository) ListDiscoverableEvents(
	ctx context.Context,
	userID uuid.UUID,
	params eventapp.DiscoverEventsParams,
) ([]eventapp.DiscoverableEventRecord, error) {
	args := make([]any, 0, 12)
	addArg := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}

	lonPlaceholder := addArg(params.Origin.Lon)
	latPlaceholder := addArg(params.Origin.Lat)
	userPlaceholder := addArg(userID)
	// Discovery lists joinable upcoming events only (ACTIVE), not IN_PROGRESS.
	statusPlaceholder := addArg([]string{string(domain.EventStatusActive)})
	privacyPlaceholder := addArg(toPrivacyLevelStringSlice(params.PrivacyLevels))
	radiusPlaceholder := addArg(params.RadiusMeters)

	originExpr := fmt.Sprintf("ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography", lonPlaceholder, latPlaceholder)
	searchVectorExpr := "COALESCE(e.search_vector, ''::tsvector)"
	routeAnchorExpr := "ST_StartPoint(el.geom::geometry)::geography"
	distanceSourceExpr := fmt.Sprintf(
		"CASE WHEN e.location_type = '%s' THEN %s ELSE el.geom END",
		domain.LocationRoute,
		routeAnchorExpr,
	)
	distanceExpr := "0::double precision"
	if params.SortBy == domain.EventDiscoverySortDistance || params.SortBy == domain.EventDiscoverySortRelevance {
		distanceExpr = fmt.Sprintf("ST_Distance(%s, %s)", distanceSourceExpr, originExpr)
	}
	routeRadiusExpr := fmt.Sprintf(
		`EXISTS (
			SELECT 1
			FROM ST_DumpPoints(el.geom::geometry) AS route_point
			WHERE ST_DWithin(route_point.geom::geography, %s, %s)
		)`,
		originExpr,
		radiusPlaceholder,
	)
	relevanceExpr := "NULL::double precision"

	filters := []string{
		fmt.Sprintf("e.status = ANY(%s::text[])", statusPlaceholder),
		"(e.end_time IS NULL OR e.end_time > NOW())",
		fmt.Sprintf("e.privacy_level = ANY(%s::text[])", privacyPlaceholder),
		fmt.Sprintf(
			"((e.location_type = '%s' AND %s) OR (e.location_type <> '%s' AND ST_DWithin(el.geom, %s, %s)))",
			domain.LocationRoute,
			routeRadiusExpr,
			domain.LocationRoute,
			originExpr,
			radiusPlaceholder,
		),
	}

	if params.SearchTSQuery != "" {
		queryPlaceholder := addArg(params.SearchTSQuery)
		filters = append(filters, fmt.Sprintf("%s @@ to_tsquery('simple', %s)", searchVectorExpr, queryPlaceholder))
		relevanceExpr = fmt.Sprintf("ts_rank_cd(%s, to_tsquery('simple', %s))::double precision", searchVectorExpr, queryPlaceholder)
	}

	if len(params.CategoryIDs) > 0 {
		filters = append(filters, fmt.Sprintf(
			"e.category_id::bigint = ANY(%s::bigint[])",
			addArg(toInt64Slice(params.CategoryIDs)),
		))
	}

	if params.StartFrom != nil {
		filters = append(filters, fmt.Sprintf("e.start_time >= %s", addArg(*params.StartFrom)))
	}

	if params.StartTo != nil {
		filters = append(filters, fmt.Sprintf("e.start_time <= %s", addArg(*params.StartTo)))
	}

	if len(params.TagNames) > 0 {
		filters = append(filters, fmt.Sprintf(
			`EXISTS (
				SELECT 1
				FROM event_tag et
				WHERE et.event_id = e.id
				  AND LOWER(et.name) = ANY(%s::text[])
			)`,
			addArg(params.TagNames),
		))
	}

	if params.OnlyFavorited {
		filters = append(filters, "fav.event_id IS NOT NULL")
	}

	if params.OnlyChildFriendly {
		filters = append(filters, "e.child_friendly = true")
	}
	if params.OnlyFamilyOriented {
		filters = append(filters, "e.family_oriented = true")
	}

	paginationClause, orderByClause := buildDiscoverEventsPagination(params, addArg)
	limitPlaceholder := addArg(params.RepositoryFetchLimit)

	query := fmt.Sprintf(`
		WITH base AS (
			SELECT
				e.id,
				e.title,
				COALESCE(ec.name, '') AS category_name,
				e.image_url,
				e.start_time,
				e.status,
				el.address AS location_address,
				CASE WHEN e.location_type = 'POINT' THEN ST_Y(el.geom::geometry) ELSE ST_Y(ST_StartPoint(el.geom::geometry)) END AS location_lat,
				CASE WHEN e.location_type = 'POINT' THEN ST_X(el.geom::geometry) ELSE ST_X(ST_StartPoint(el.geom::geometry)) END AS location_lon,
				e.privacy_level,
				e.approved_participant_count,
				e.favorite_count,
				(fav.event_id IS NOT NULL) AS is_favorited,
				e.child_friendly,
				e.family_oriented,
				us.final_score AS host_final_score,
				COALESCE(us.hosted_event_rating_count, 0) AS host_rating_count,
				%s AS distance_meters,
				%s AS relevance_score
			FROM event e
			JOIN event_location el ON el.event_id = e.id
			LEFT JOIN event_category ec ON ec.id = e.category_id
			LEFT JOIN favorite_event fav ON fav.event_id = e.id AND fav.user_id = %s
			LEFT JOIN user_score us ON us.user_id = e.host_id
			WHERE %s
		)
		SELECT
			id,
			title,
			category_name,
			image_url,
			start_time,
			status,
			location_address,
			location_lat,
			location_lon,
			privacy_level,
			approved_participant_count,
			favorite_count,
			is_favorited,
			child_friendly,
			family_oriented,
			host_final_score,
			host_rating_count,
			distance_meters,
			relevance_score
		FROM base
		%s
		ORDER BY %s
		LIMIT %s
	`, distanceExpr, relevanceExpr, userPlaceholder, strings.Join(filters, "\n			AND "), paginationClause, orderByClause, limitPlaceholder)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list discoverable events: %w", err)
	}
	defer rows.Close()

	records := make([]eventapp.DiscoverableEventRecord, 0, params.RepositoryFetchLimit)
	for rows.Next() {
		var (
			id                       uuid.UUID
			title                    string
			categoryName             string
			imageURL                 pgtype.Text
			startTime                time.Time
			eventStatus              string
			locationAddress          pgtype.Text
			locationLat              pgtype.Float8
			locationLon              pgtype.Float8
			privacyLevel             string
			approvedParticipantCount int
			favoriteCount            int
			isFavorited              bool
			childFriendly            bool
			familyOriented           bool
			hostFinalScore           pgtype.Float8
			hostRatingCount          int
			distanceMeters           float64
			relevanceScore           pgtype.Float8
		)

		if err := rows.Scan(
			&id,
			&title,
			&categoryName,
			&imageURL,
			&startTime,
			&eventStatus,
			&locationAddress,
			&locationLat,
			&locationLon,
			&privacyLevel,
			&approvedParticipantCount,
			&favoriteCount,
			&isFavorited,
			&childFriendly,
			&familyOriented,
			&hostFinalScore,
			&hostRatingCount,
			&distanceMeters,
			&relevanceScore,
		); err != nil {
			return nil, fmt.Errorf("scan discoverable event: %w", err)
		}

		record := eventapp.DiscoverableEventRecord{
			ID:                       id,
			Title:                    title,
			CategoryName:             categoryName,
			StartTime:                startTime,
			Status:                   domain.EventStatus(eventStatus),
			PrivacyLevel:             domain.EventPrivacyLevel(privacyLevel),
			ApprovedParticipantCount: approvedParticipantCount,
			FavoriteCount:            favoriteCount,
			IsFavorited:              isFavorited,
			ChildFriendly:            childFriendly,
			FamilyOriented:           familyOriented,
			HostScore: eventapp.EventHostScoreSummaryRecord{
				HostedEventRatingCount: hostRatingCount,
			},
			DistanceMeters: distanceMeters,
		}
		if imageURL.Valid {
			record.ImageURL = &imageURL.String
		}
		if locationAddress.Valid {
			record.LocationAddress = &locationAddress.String
		}
		if locationLat.Valid {
			record.LocationLat = &locationLat.Float64
		}
		if locationLon.Valid {
			record.LocationLon = &locationLon.Float64
		}
		if relevanceScore.Valid {
			record.RelevanceScore = &relevanceScore.Float64
		}
		if hostFinalScore.Valid {
			record.HostScore.FinalScore = &hostFinalScore.Float64
		}

		records = append(records, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate discoverable events: %w", err)
	}

	return records, nil
}

func buildDiscoverEventsPagination(
	params eventapp.DiscoverEventsParams,
	addArg func(value any) string,
) (string, string) {
	switch params.SortBy {
	case domain.EventDiscoverySortDistance:
		if params.DecodedCursor == nil {
			return "", "base.distance_meters ASC, base.start_time ASC, base.id ASC"
		}

		return fmt.Sprintf(
				"WHERE (base.distance_meters, base.start_time, base.id) > (%s, %s, %s)",
				addArg(*params.DecodedCursor.DistanceMeters),
				addArg(params.DecodedCursor.StartTime),
				addArg(params.DecodedCursor.EventID),
			),
			"base.distance_meters ASC, base.start_time ASC, base.id ASC"
	case domain.EventDiscoverySortRelevance:
		if params.DecodedCursor == nil {
			return "", "base.relevance_score DESC, base.distance_meters ASC, base.start_time ASC, base.id ASC"
		}

		return fmt.Sprintf(
				"WHERE ((base.relevance_score * -1), base.distance_meters, base.start_time, base.id) > (%s, %s, %s, %s)",
				addArg(-*params.DecodedCursor.RelevanceScore),
				addArg(*params.DecodedCursor.DistanceMeters),
				addArg(params.DecodedCursor.StartTime),
				addArg(params.DecodedCursor.EventID),
			),
			"base.relevance_score DESC, base.distance_meters ASC, base.start_time ASC, base.id ASC"
	default:
		if params.DecodedCursor == nil {
			return "", "base.start_time ASC, base.id ASC"
		}

		return fmt.Sprintf(
				"WHERE (base.start_time, base.id) > (%s, %s)",
				addArg(params.DecodedCursor.StartTime),
				addArg(params.DecodedCursor.EventID),
			),
			"base.start_time ASC, base.id ASC"
	}
}

func buildEventCollectionCursorClause(
	params eventapp.EventCollectionPageParams,
	args *[]any,
	createdAtExpr, idExpr string,
) string {
	if params.DecodedCursor == nil {
		return ""
	}

	*args = append(*args, params.DecodedCursor.CreatedAt, params.DecodedCursor.EntityID)
	createdAtArgPosition := len(*args) - 1
	idArgPosition := len(*args)

	return fmt.Sprintf(
		" AND (%s, %s) > ($%d, $%d)",
		createdAtExpr,
		idExpr,
		createdAtArgPosition,
		idArgPosition,
	)
}

func toInt64Slice(values []int) []int64 {
	converted := make([]int64, len(values))
	for i, value := range values {
		converted[i] = int64(value)
	}
	return converted
}

func toPrivacyLevelStringSlice(values []domain.EventPrivacyLevel) []string {
	converted := make([]string, len(values))
	for i, value := range values {
		converted[i] = string(value)
	}
	return converted
}

// GetEventDetail loads the full detail projection for an event if the
// authenticated user is allowed to read it.
func (r *EventRepository) GetEventDetail(
	ctx context.Context,
	userID, eventID uuid.UUID,
) (*eventapp.EventDetailRecord, error) {
	record, err := r.loadEventDetailCore(ctx, userID, eventID)
	if err != nil {
		return nil, err
	}

	groupCtx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)

	var (
		location          eventapp.EventDetailLocationRecord
		tags              []string
		constraints       []eventapp.EventDetailConstraintRecord
		viewerEventRating *eventapp.EventDetailRatingRecord
		wg                sync.WaitGroup
		firstErr          error
		errOnce           sync.Once
	)

	runConcurrentLoad := func(load func(context.Context) error) {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := load(groupCtx); err != nil {
				errOnce.Do(func() {
					firstErr = err
					cancel(err)
				})
			}
		}()
	}

	runConcurrentLoad(func(ctx context.Context) error {
		loadedLocation, err := r.loadEventDetailLocation(groupCtx, eventID, record.Location.Type)
		if err != nil {
			return err
		}
		location = loadedLocation
		return nil
	})

	runConcurrentLoad(func(ctx context.Context) error {
		loadedTags, err := r.loadEventTags(groupCtx, eventID)
		if err != nil {
			return err
		}
		tags = loadedTags
		return nil
	})

	runConcurrentLoad(func(ctx context.Context) error {
		loadedConstraints, err := r.loadEventConstraints(groupCtx, eventID)
		if err != nil {
			return err
		}
		constraints = loadedConstraints
		return nil
	})

	runConcurrentLoad(func(ctx context.Context) error {
		loadedViewerEventRating, err := r.loadViewerEventRating(groupCtx, eventID, userID)
		if err != nil {
			return err
		}
		viewerEventRating = loadedViewerEventRating
		return nil
	})

	wg.Wait()
	if firstErr != nil {
		return nil, firstErr
	}

	location.Address = record.Location.Address
	record.Location = location
	record.Tags = tags
	record.Constraints = constraints
	record.ViewerEventRating = viewerEventRating

	return record, nil
}

// GetEventHostContextSummary returns host-only management counters.
func (r *EventRepository) GetEventHostContextSummary(
	ctx context.Context,
	eventID uuid.UUID,
) (*eventapp.EventHostContextSummaryRecord, error) {
	var record eventapp.EventHostContextSummaryRecord

	if err := r.pool.QueryRow(ctx, `
		SELECT
			(
				SELECT COUNT(*)
				FROM participation p
				JOIN event e ON e.id = p.event_id
				WHERE p.event_id = $1
				  AND p.status = $2
				  AND p.user_id <> e.host_id
			) AS approved_participant_count,
			(
				SELECT COUNT(*)
				FROM join_request jr
				WHERE jr.event_id = $1
				  AND jr.status = $3
			) AS pending_join_request_count,
			(
				SELECT COUNT(*)
				FROM invitation inv
				WHERE inv.event_id = $1
			) AS invitation_count
	`,
		eventID,
		domain.ParticipationStatusApproved,
		string(domain.JoinRequestStatusPending),
	).Scan(
		&record.ApprovedParticipantCount,
		&record.PendingJoinRequestCount,
		&record.InvitationCount,
	); err != nil {
		return nil, fmt.Errorf("get event host context summary: %w", err)
	}

	return &record, nil
}

// ListEventApprovedParticipants returns a paginated approved-participant collection.
func (r *EventRepository) ListEventApprovedParticipants(
	ctx context.Context,
	eventID uuid.UUID,
	params eventapp.EventCollectionPageParams,
) ([]eventapp.EventDetailApprovedParticipantRecord, error) {
	return r.loadApprovedParticipants(ctx, eventID, params)
}

// ListEventPendingJoinRequests returns a paginated pending join-request collection.
func (r *EventRepository) ListEventPendingJoinRequests(
	ctx context.Context,
	eventID uuid.UUID,
	params eventapp.EventCollectionPageParams,
) ([]eventapp.EventDetailPendingJoinRequestRecord, error) {
	return r.loadPendingJoinRequests(ctx, eventID, params)
}

// ListEventInvitations returns a paginated invitation collection.
func (r *EventRepository) ListEventInvitations(
	ctx context.Context,
	eventID uuid.UUID,
	params eventapp.EventCollectionPageParams,
) ([]eventapp.EventDetailInvitationRecord, error) {
	return r.loadInvitations(ctx, eventID, params)
}

func (r *EventRepository) loadEventDetailCore(
	ctx context.Context,
	userID, eventID uuid.UUID,
) (*eventapp.EventDetailRecord, error) {
	var (
		id                       uuid.UUID
		versionNo                int
		title                    string
		description              pgtype.Text
		imageURL                 pgtype.Text
		privacyLevel             string
		status                   string
		startTime                time.Time
		endTime                  pgtype.Timestamptz
		capacity                 pgtype.Int4
		minimumAge               pgtype.Int4
		preferredGender          pgtype.Text
		approvedParticipantCount int
		pendingParticipantCount  int
		favoriteCount            int
		createdAt                time.Time
		updatedAt                time.Time
		categoryID               pgtype.Int4
		categoryName             pgtype.Text
		hostID                   uuid.UUID
		hostUsername             string
		hostDisplayName          pgtype.Text
		hostAvatarURL            pgtype.Text
		hostFinalScore           pgtype.Float8
		hostRatingCount          int
		locationType             string
		locationAddress          pgtype.Text
		childFriendly            bool
		familyOriented           bool
		isHost                   bool
		isFavorited              bool
		participationStatus      pgtype.Text
		joinRequestStatus        pgtype.Text
		invitationStatus         pgtype.Text
		lastConfirmedVersion     pgtype.Int4
	)

	err := r.db.QueryRow(ctx, `
		SELECT
			e.id,
			e.version_no,
			e.title,
			e.description,
			e.image_url,
			e.privacy_level,
			CASE
				WHEN e.status = 'ACTIVE' AND e.end_time < NOW() THEN 'COMPLETED'
				WHEN e.status = 'ACTIVE' AND e.start_time < NOW() THEN 'IN_PROGRESS'
				WHEN e.status = 'IN_PROGRESS' AND e.end_time < NOW() THEN 'COMPLETED'
				ELSE e.status
			END AS status,
			e.start_time,
			e.end_time,
			e.capacity,
			e.minimum_age,
			e.preferred_gender,
			e.approved_participant_count,
			e.pending_participant_count,
			e.favorite_count,
			e.created_at,
			e.updated_at,
			ec.id,
			ec.name,
			host.id,
			host.username,
			hp.display_name,
			hp.avatar_url,
			us.final_score,
			COALESCE(us.hosted_event_rating_count, 0),
			e.location_type,
			el.address,
			e.child_friendly,
			e.family_oriented,
			(e.host_id = $2) AS is_host,
			EXISTS (
				SELECT 1
				FROM favorite_event fav
				WHERE fav.event_id = e.id
				  AND fav.user_id = $2
			) AS is_favorited,
			CASE WHEN e.host_id = $2 THEN NULL ELSE p.status END AS participation_status,
			CASE WHEN e.host_id = $2 THEN NULL ELSE jr.status END AS join_request_status,
			CASE WHEN e.host_id = $2 THEN NULL ELSE inv.status END AS invitation_status,
			CASE WHEN e.host_id = $2 THEN NULL ELSE p.last_confirmed_event_version END AS last_confirmed_event_version
		FROM event e
		JOIN event_location el ON el.event_id = e.id
		LEFT JOIN event_category ec ON ec.id = e.category_id
		JOIN app_user host ON host.id = e.host_id
		LEFT JOIN profile hp ON hp.user_id = host.id
		LEFT JOIN user_score us ON us.user_id = host.id
		LEFT JOIN participation p ON p.event_id = e.id AND p.user_id = $2
		LEFT JOIN join_request jr ON jr.event_id = e.id AND jr.user_id = $2
		LEFT JOIN invitation inv ON inv.event_id = e.id AND inv.invited_user_id = $2
		WHERE e.id = $1
		  AND (
			e.privacy_level IN ($3, $4)
			OR e.host_id = $2
			OR p.status IN ($5, $6, $7, $8)
			OR inv.status IN ($9, $10)
		  )
	`,
		eventID,
		userID,
		string(domain.PrivacyPublic),
		string(domain.PrivacyProtected),
		domain.ParticipationStatusApproved,
		domain.ParticipationStatusLeaved,
		domain.ParticipationStatusCanceled,
		domain.ParticipationStatusPending,
		string(domain.InvitationStatusAccepted),
		string(domain.InvitationStatusPending),
	).Scan(
		&id,
		&versionNo,
		&title,
		&description,
		&imageURL,
		&privacyLevel,
		&status,
		&startTime,
		&endTime,
		&capacity,
		&minimumAge,
		&preferredGender,
		&approvedParticipantCount,
		&pendingParticipantCount,
		&favoriteCount,
		&createdAt,
		&updatedAt,
		&categoryID,
		&categoryName,
		&hostID,
		&hostUsername,
		&hostDisplayName,
		&hostAvatarURL,
		&hostFinalScore,
		&hostRatingCount,
		&locationType,
		&locationAddress,
		&childFriendly,
		&familyOriented,
		&isHost,
		&isFavorited,
		&participationStatus,
		&joinRequestStatus,
		&invitationStatus,
		&lastConfirmedVersion,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get event detail: %w", err)
	}

	record := &eventapp.EventDetailRecord{
		ID:                       id,
		VersionNo:                versionNo,
		Title:                    title,
		PrivacyLevel:             domain.EventPrivacyLevel(privacyLevel),
		Status:                   domain.EventStatus(status),
		StartTime:                startTime,
		ApprovedParticipantCount: approvedParticipantCount,
		PendingParticipantCount:  pendingParticipantCount,
		FavoriteCount:            favoriteCount,
		CreatedAt:                createdAt,
		UpdatedAt:                updatedAt,
		Host: eventapp.EventDetailPersonRecord{
			ID:       hostID,
			Username: hostUsername,
		},
		HostScore: eventapp.EventHostScoreSummaryRecord{
			HostedEventRatingCount: hostRatingCount,
		},
		Location: eventapp.EventDetailLocationRecord{
			Type: domain.EventLocationType(locationType),
		},
		ViewerContext: eventapp.EventDetailViewerContextRecord{
			IsHost:             isHost,
			IsFavorited:        isFavorited,
			LatestEventVersion: versionNo,
		},
		Tags:        make([]string, 0),
		Constraints: make([]eventapp.EventDetailConstraintRecord, 0),
	}
	if description.Valid {
		record.Description = &description.String
	}
	if imageURL.Valid {
		record.ImageURL = &imageURL.String
	}
	if endTime.Valid {
		record.EndTime = &endTime.Time
	}
	if capacity.Valid {
		record.Capacity = new(int)
		*record.Capacity = int(capacity.Int32)
	}
	if minimumAge.Valid {
		record.MinimumAge = new(int)
		*record.MinimumAge = int(minimumAge.Int32)
	}
	if preferredGender.Valid {
		gender := domain.EventParticipantGender(preferredGender.String)
		record.PreferredGender = &gender
	}
	if categoryID.Valid {
		record.Category = &eventapp.EventDetailCategoryRecord{
			ID: int(categoryID.Int32),
		}
		if categoryName.Valid {
			record.Category.Name = categoryName.String
		}
	}
	if hostDisplayName.Valid {
		record.Host.DisplayName = &hostDisplayName.String
	}
	if hostAvatarURL.Valid {
		record.Host.AvatarURL = &hostAvatarURL.String
	}
	if hostFinalScore.Valid {
		record.HostScore.FinalScore = &hostFinalScore.Float64
	}
	if locationAddress.Valid {
		record.Location.Address = &locationAddress.String
	}
	if participationStatus.Valid {
		status := domain.ParticipationStatus(participationStatus.String)
		record.ViewerContext.ParticipationStatus = &status
	}
	if joinRequestStatus.Valid {
		status := domain.JoinRequestStatus(joinRequestStatus.String)
		record.ViewerContext.JoinRequestStatus = &status
	}
	if invitationStatus.Valid {
		status := domain.InvitationStatus(invitationStatus.String)
		record.ViewerContext.InvitationStatus = &status
	}
	if lastConfirmedVersion.Valid {
		version := int(lastConfirmedVersion.Int32)
		record.ViewerContext.LastConfirmedEventVersion = &version
	}
	record.ChildFriendly = childFriendly
	record.FamilyOriented = familyOriented

	return record, nil
}

func (r *EventRepository) loadEventDetailLocation(
	ctx context.Context,
	eventID uuid.UUID,
	locationType domain.EventLocationType,
) (eventapp.EventDetailLocationRecord, error) {
	location := eventapp.EventDetailLocationRecord{
		Type:        locationType,
		RoutePoints: make([]domain.GeoPoint, 0),
	}

	switch locationType {
	case domain.LocationPoint:
		var point domain.GeoPoint
		err := r.pool.QueryRow(ctx, `
			SELECT
				ST_Y(el.geom::geometry) AS lat,
				ST_X(el.geom::geometry) AS lon
			FROM event_location el
			WHERE el.event_id = $1
		`, eventID).Scan(&point.Lat, &point.Lon)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return location, domain.ErrNotFound
			}
			return location, fmt.Errorf("load event detail point: %w", err)
		}
		location.Point = &point
	case domain.LocationRoute:
		rows, err := r.pool.Query(ctx, `
			SELECT
				ST_Y(dp.geom) AS lat,
				ST_X(dp.geom) AS lon
			FROM event_location el
			CROSS JOIN LATERAL ST_DumpPoints(el.geom::geometry) AS dp
			WHERE el.event_id = $1
			ORDER BY dp.path
		`, eventID)
		if err != nil {
			return location, fmt.Errorf("load event detail route points: %w", err)
		}
		defer rows.Close()

		for rows.Next() {
			var point domain.GeoPoint
			if err := rows.Scan(&point.Lat, &point.Lon); err != nil {
				return location, fmt.Errorf("scan event detail route point: %w", err)
			}
			location.RoutePoints = append(location.RoutePoints, point)
		}
		if err := rows.Err(); err != nil {
			return location, fmt.Errorf("iterate event detail route points: %w", err)
		}
	default:
		return location, nil
	}

	return location, nil
}

func (r *EventRepository) loadEventTags(ctx context.Context, eventID uuid.UUID) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT name
		FROM event_tag
		WHERE event_id = $1
		ORDER BY name ASC
	`, eventID)
	if err != nil {
		return nil, fmt.Errorf("load event tags: %w", err)
	}
	defer rows.Close()

	tags := make([]string, 0)
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, fmt.Errorf("scan event tag: %w", err)
		}
		tags = append(tags, tag)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate event tags: %w", err)
	}

	return tags, nil
}

func (r *EventRepository) loadEventConstraints(
	ctx context.Context,
	eventID uuid.UUID,
) ([]eventapp.EventDetailConstraintRecord, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT constraint_type, constraint_info
		FROM event_constraint
		WHERE event_id = $1
		ORDER BY created_at ASC, id ASC
	`, eventID)
	if err != nil {
		return nil, fmt.Errorf("load event constraints: %w", err)
	}
	defer rows.Close()

	constraints := make([]eventapp.EventDetailConstraintRecord, 0)
	for rows.Next() {
		var (
			constraintType string
			constraintInfo pgtype.Text
		)
		if err := rows.Scan(&constraintType, &constraintInfo); err != nil {
			return nil, fmt.Errorf("scan event constraint: %w", err)
		}

		constraint := eventapp.EventDetailConstraintRecord{Type: constraintType}
		if constraintInfo.Valid {
			constraint.Info = constraintInfo.String
		}
		constraints = append(constraints, constraint)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate event constraints: %w", err)
	}

	return constraints, nil
}

func (r *EventRepository) loadViewerEventRating(
	ctx context.Context,
	eventID, participantUserID uuid.UUID,
) (*eventapp.EventDetailRatingRecord, error) {
	var (
		record  eventapp.EventDetailRatingRecord
		message pgtype.Text
	)

	err := r.pool.QueryRow(ctx, `
		SELECT id, rating, message, created_at, updated_at
		FROM event_comment
		WHERE event_id = $1
		  AND user_id = $2
		  AND comment_type = $3
	`, eventID, participantUserID, string(domain.CommentTypeReview)).Scan(
		&record.ID,
		&record.Rating,
		&message,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("load viewer event rating: %w", err)
	}

	record.Message = textPtr(message)
	return &record, nil
}

func (r *EventRepository) loadApprovedParticipants(
	ctx context.Context,
	eventID uuid.UUID,
	params eventapp.EventCollectionPageParams,
) ([]eventapp.EventDetailApprovedParticipantRecord, error) {
	status := params.Status
	if status == "" {
		status = domain.ParticipationStatusApproved
	}
	args := []any{eventID, status}
	cursorClause := buildEventCollectionCursorClause(params, &args, "p.created_at", "p.id")
	args = append(args, params.RepositoryFetchLimit)

	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT
			p.id,
			p.status,
			p.created_at,
			p.updated_at,
			u.id,
			u.username,
			pr.display_name,
			pr.avatar_url,
			us.final_score,
			COALESCE(us.participant_rating_count, 0) + COALESCE(us.hosted_event_rating_count, 0) AS rating_count,
			prt.id,
			prt.rating,
			prt.message,
			prt.created_at,
			prt.updated_at
		FROM participation p
		JOIN event e ON e.id = p.event_id
		JOIN app_user u ON u.id = p.user_id
		LEFT JOIN profile pr ON pr.user_id = u.id
		LEFT JOIN user_score us ON us.user_id = u.id
		LEFT JOIN participant_rating prt
			ON prt.event_id = p.event_id
		   AND prt.host_user_id = e.host_id
		   AND prt.participant_user_id = p.user_id
		WHERE p.event_id = $1
		  AND p.status = $2
		  AND p.user_id <> e.host_id
		  %s
		ORDER BY p.created_at ASC, p.id ASC
		LIMIT $%d
	`, cursorClause, len(args)), args...)
	if err != nil {
		return nil, fmt.Errorf("load approved participants: %w", err)
	}
	defer rows.Close()

	participants := make([]eventapp.EventDetailApprovedParticipantRecord, 0)
	for rows.Next() {
		var (
			participationID uuid.UUID
			status          string
			createdAt       time.Time
			updatedAt       time.Time
			userID          uuid.UUID
			username        string
			displayName     pgtype.Text
			avatarURL       pgtype.Text
			userFinalScore  pgtype.Float8
			userRatingCount int
			hostRatingID    pgtype.UUID
			hostRatingValue pgtype.Int4
			hostMessage     pgtype.Text
			hostCreatedAt   pgtype.Timestamptz
			hostUpdatedAt   pgtype.Timestamptz
		)
		if err := rows.Scan(
			&participationID,
			&status,
			&createdAt,
			&updatedAt,
			&userID,
			&username,
			&displayName,
			&avatarURL,
			&userFinalScore,
			&userRatingCount,
			&hostRatingID,
			&hostRatingValue,
			&hostMessage,
			&hostCreatedAt,
			&hostUpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan approved participant: %w", err)
		}

		participationStatus, ok := domain.ParseParticipationStatus(status)
		if !ok {
			return nil, fmt.Errorf("scan approved participant: unknown participation status %q", status)
		}

		participant := eventapp.EventDetailApprovedParticipantRecord{
			ParticipationID: participationID,
			Status:          participationStatus,
			CreatedAt:       createdAt,
			UpdatedAt:       updatedAt,
			User: eventapp.EventDetailHostContextUserRecord{
				ID:          userID,
				Username:    username,
				RatingCount: userRatingCount,
			},
		}
		if displayName.Valid {
			participant.User.DisplayName = &displayName.String
		}
		if avatarURL.Valid {
			participant.User.AvatarURL = &avatarURL.String
		}
		if userFinalScore.Valid {
			participant.User.FinalScore = &userFinalScore.Float64
		}
		if hostRatingID.Valid && hostRatingValue.Valid && hostCreatedAt.Valid && hostUpdatedAt.Valid {
			participant.HostRating = &eventapp.EventDetailRatingRecord{
				ID:        uuid.UUID(hostRatingID.Bytes),
				Rating:    int(hostRatingValue.Int32),
				Message:   textPtr(hostMessage),
				CreatedAt: hostCreatedAt.Time,
				UpdatedAt: hostUpdatedAt.Time,
			}
		}

		participants = append(participants, participant)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate approved participants: %w", err)
	}

	return participants, nil
}

func (r *EventRepository) loadPendingJoinRequests(
	ctx context.Context,
	eventID uuid.UUID,
	params eventapp.EventCollectionPageParams,
) ([]eventapp.EventDetailPendingJoinRequestRecord, error) {
	args := []any{eventID, string(domain.JoinRequestStatusPending)}
	cursorClause := buildEventCollectionCursorClause(params, &args, "jr.created_at", "jr.id")
	args = append(args, params.RepositoryFetchLimit)

	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT
			jr.id,
			jr.status,
			jr.message,
			jr.image_url,
			jr.created_at,
			jr.updated_at,
			u.id,
			u.username,
			pr.display_name,
			pr.avatar_url,
			us.final_score,
			COALESCE(us.participant_rating_count, 0) + COALESCE(us.hosted_event_rating_count, 0) AS rating_count
		FROM join_request jr
		JOIN app_user u ON u.id = jr.user_id
		LEFT JOIN profile pr ON pr.user_id = u.id
		LEFT JOIN user_score us ON us.user_id = u.id
		WHERE jr.event_id = $1
		  AND jr.status = $2
		  %s
		ORDER BY jr.created_at ASC, jr.id ASC
		LIMIT $%d
	`, cursorClause, len(args)), args...)
	if err != nil {
		return nil, fmt.Errorf("load pending join requests: %w", err)
	}
	defer rows.Close()

	requests := make([]eventapp.EventDetailPendingJoinRequestRecord, 0)
	for rows.Next() {
		var (
			joinRequestID uuid.UUID
			status        string
			message       pgtype.Text
			imageURL      pgtype.Text
			createdAt     time.Time
			updatedAt     time.Time
			userID        uuid.UUID
			username      string
			displayName   pgtype.Text
			avatarURL     pgtype.Text
			finalScore    pgtype.Float8
			ratingCount   int
		)
		if err := rows.Scan(
			&joinRequestID,
			&status,
			&message,
			&imageURL,
			&createdAt,
			&updatedAt,
			&userID,
			&username,
			&displayName,
			&avatarURL,
			&finalScore,
			&ratingCount,
		); err != nil {
			return nil, fmt.Errorf("scan pending join request: %w", err)
		}

		request := eventapp.EventDetailPendingJoinRequestRecord{
			JoinRequestID: joinRequestID,
			Status:        status,
			CreatedAt:     createdAt,
			UpdatedAt:     updatedAt,
			User: eventapp.EventDetailHostContextUserRecord{
				ID:          userID,
				Username:    username,
				RatingCount: ratingCount,
			},
		}
		if message.Valid {
			request.Message = &message.String
		}
		if imageURL.Valid {
			request.ImageURL = &imageURL.String
		}
		if displayName.Valid {
			request.User.DisplayName = &displayName.String
		}
		if avatarURL.Valid {
			request.User.AvatarURL = &avatarURL.String
		}
		if finalScore.Valid {
			request.User.FinalScore = &finalScore.Float64
		}

		requests = append(requests, request)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate pending join requests: %w", err)
	}

	return requests, nil
}

func (r *EventRepository) loadInvitations(
	ctx context.Context,
	eventID uuid.UUID,
	params eventapp.EventCollectionPageParams,
) ([]eventapp.EventDetailInvitationRecord, error) {
	args := []any{eventID}
	cursorClause := buildEventCollectionCursorClause(params, &args, "inv.created_at", "inv.id")
	args = append(args, params.RepositoryFetchLimit)

	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT
			inv.id,
			inv.status,
			inv.message,
			inv.expires_at,
			inv.created_at,
			inv.updated_at,
			u.id,
			u.username,
			pr.display_name,
			pr.avatar_url,
			us.final_score,
			COALESCE(us.participant_rating_count, 0) + COALESCE(us.hosted_event_rating_count, 0) AS rating_count
		FROM invitation inv
		JOIN app_user u ON u.id = inv.invited_user_id
		LEFT JOIN profile pr ON pr.user_id = u.id
		LEFT JOIN user_score us ON us.user_id = u.id
		WHERE inv.event_id = $1
		  %s
		ORDER BY inv.created_at ASC, inv.id ASC
		LIMIT $%d
	`, cursorClause, len(args)), args...)
	if err != nil {
		return nil, fmt.Errorf("load invitations: %w", err)
	}
	defer rows.Close()

	invitations := make([]eventapp.EventDetailInvitationRecord, 0)
	for rows.Next() {
		var (
			invitationID uuid.UUID
			status       string
			message      pgtype.Text
			expiresAt    pgtype.Timestamptz
			createdAt    time.Time
			updatedAt    time.Time
			userID       uuid.UUID
			username     string
			displayName  pgtype.Text
			avatarURL    pgtype.Text
			finalScore   pgtype.Float8
			ratingCount  int
		)
		if err := rows.Scan(
			&invitationID,
			&status,
			&message,
			&expiresAt,
			&createdAt,
			&updatedAt,
			&userID,
			&username,
			&displayName,
			&avatarURL,
			&finalScore,
			&ratingCount,
		); err != nil {
			return nil, fmt.Errorf("scan invitation: %w", err)
		}

		invitation := eventapp.EventDetailInvitationRecord{
			InvitationID: invitationID,
			Status:       domain.InvitationStatus(status),
			CreatedAt:    createdAt,
			UpdatedAt:    updatedAt,
			User: eventapp.EventDetailHostContextUserRecord{
				ID:          userID,
				Username:    username,
				RatingCount: ratingCount,
			},
		}
		if message.Valid {
			invitation.Message = &message.String
		}
		if expiresAt.Valid {
			invitation.ExpiresAt = &expiresAt.Time
		}
		if displayName.Valid {
			invitation.User.DisplayName = &displayName.String
		}
		if avatarURL.Valid {
			invitation.User.AvatarURL = &avatarURL.String
		}
		if finalScore.Valid {
			invitation.User.FinalScore = &finalScore.Float64
		}

		invitations = append(invitations, invitation)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate invitations: %w", err)
	}

	return invitations, nil
}

// GetEventByID fetches a single event row by its primary key.
// Returns domain.ErrNotFound when no matching row exists.
func (r *EventRepository) GetEventByID(ctx context.Context, eventID uuid.UUID) (*domain.Event, error) {
	var (
		id              uuid.UUID
		hostID          uuid.UUID
		versionNo       int
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
		pendingCount    int
		minimumAge      pgtype.Int4
		preferredGender pgtype.Text
		locationType    pgtype.Text
		createdAt       time.Time
		updatedAt       time.Time
	)

	err := r.pool.QueryRow(ctx, `
		SELECT id, host_id, version_no, title, description, image_url, category_id,
		       start_time, end_time, privacy_level, status, capacity,
		       approved_participant_count, pending_participant_count, minimum_age, preferred_gender,
		       location_type, created_at, updated_at
		FROM event
		WHERE id = $1
	`, eventID).Scan(
		&id, &hostID, &versionNo, &title, &description, &imageURL, &categoryID,
		&startTime, &endTime, &privacyLevel, &status, &capacity,
		&approvedCount, &pendingCount, &minimumAge, &preferredGender,
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
		VersionNo:                versionNo,
		Title:                    title,
		PrivacyLevel:             domain.EventPrivacyLevel(privacyLevel),
		Status:                   domain.EventStatus(status),
		StartTime:                startTime,
		ApprovedParticipantCount: approvedCount,
		PendingParticipantCount:  pendingCount,
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

// GetRequesterForJoin loads the minimal user fields required to enforce
// participation eligibility checks (age, gender).
func (r *EventRepository) GetRequesterForJoin(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	const query = `SELECT id, gender, birth_date FROM app_user WHERE id = $1`

	var (
		id        uuid.UUID
		gender    pgtype.Text
		birthDate pgtype.Date
	)

	err := r.pool.QueryRow(ctx, query, userID).Scan(&id, &gender, &birthDate)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get requester for join: %w", err)
	}

	user := &domain.User{ID: id}
	if gender.Valid {
		g := gender.String
		user.Gender = &g
	}
	if birthDate.Valid {
		t := birthDate.Time
		user.BirthDate = &t
	}
	return user, nil
}

// GetEventImageState returns the event host and current image version for direct uploads.
func (r *EventRepository) GetEventImageState(ctx context.Context, eventID uuid.UUID) (*imageuploadapp.EventImageState, error) {
	var state imageuploadapp.EventImageState
	err := r.pool.QueryRow(ctx, `
		SELECT id, host_id, image_version
		FROM event
		WHERE id = $1
	`, eventID).Scan(&state.EventID, &state.HostID, &state.CurrentVersion)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get event image state: %w", err)
	}

	return &state, nil
}

// SetEventImageIfVersion updates the event image URL only if the current version matches expectedVersion.
func (r *EventRepository) SetEventImageIfVersion(
	ctx context.Context,
	eventID uuid.UUID,
	expectedVersion, nextVersion int,
	baseURL string,
	updatedAt time.Time,
) (bool, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE event
		SET image_url = $2,
		    image_version = $3,
		    updated_at = $4
		WHERE id = $1
		  AND image_version = $5
	`, eventID, baseURL, nextVersion, updatedAt, expectedVersion)
	if err != nil {
		return false, fmt.Errorf("set event image: %w", err)
	}

	return tag.RowsAffected() == 1, nil
}

var _ imageuploadapp.EventRepository = (*EventRepository)(nil)

// GetEventJoinRequestImageState loads the event state needed to authorize
// join-request image uploads.
func (r *EventRepository) GetEventJoinRequestImageState(ctx context.Context, eventID uuid.UUID) (*imageuploadapp.EventJoinRequestImageState, error) {
	var state imageuploadapp.EventJoinRequestImageState
	err := r.db.QueryRow(ctx, `
		SELECT
			e.id,
			e.host_id,
			CASE
				WHEN e.status = 'ACTIVE' AND e.end_time < NOW() THEN 'COMPLETED'
				WHEN e.status = 'ACTIVE' AND e.start_time < NOW() THEN 'IN_PROGRESS'
				WHEN e.status = 'IN_PROGRESS' AND e.end_time < NOW() THEN 'COMPLETED'
				ELSE e.status
			END AS status,
			e.privacy_level
		FROM event e
		WHERE e.id = $1
	`, eventID).Scan(
		&state.EventID,
		&state.HostID,
		&state.Status,
		&state.PrivacyLevel,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get event join request image state: %w", err)
	}

	return &state, nil
}

// GetEventReviewImageState loads the event and caller relation needed to
// authorize review image uploads.
func (r *EventRepository) GetEventReviewImageState(ctx context.Context, eventID, userID uuid.UUID) (*imageuploadapp.EventReviewImageState, error) {
	var (
		state        imageuploadapp.EventReviewImageState
		status       string
		privacyLevel string
	)

	err := r.db.QueryRow(ctx, `
		SELECT
			e.id,
			e.host_id,
			CASE
				WHEN e.status = 'ACTIVE' AND e.end_time < NOW() THEN 'COMPLETED'
				WHEN e.status = 'ACTIVE' AND e.start_time < NOW() THEN 'IN_PROGRESS'
				WHEN e.status = 'IN_PROGRESS' AND e.end_time < NOW() THEN 'COMPLETED'
				ELSE e.status
			END AS status,
			e.privacy_level,
			EXISTS (
				SELECT 1
				FROM participation p
				WHERE p.event_id = e.id
				  AND p.user_id = $2
				  AND (
					p.status = $3
					OR (p.status = $4 AND p.updated_at >= e.start_time)
				  )
			) AS is_qualifying_participant
		FROM event e
		WHERE e.id = $1
	`, eventID, userID, domain.ParticipationStatusApproved, domain.ParticipationStatusLeaved).Scan(
		&state.EventID,
		&state.HostID,
		&status,
		&privacyLevel,
		&state.IsQualifyingParticipant,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get event review image state: %w", err)
	}

	state.Status = status
	state.PrivacyLevel = privacyLevel
	return &state, nil
}

// GetEventReportImageState loads event state needed to authorize report image uploads.
func (r *EventRepository) GetEventReportImageState(ctx context.Context, eventID uuid.UUID) (*imageuploadapp.EventReportImageState, error) {
	var (
		state  imageuploadapp.EventReportImageState
		status string
	)

	err := r.db.QueryRow(ctx, `
		SELECT
			e.id,
			CASE
				WHEN e.status = 'ACTIVE' AND e.end_time < NOW() THEN 'COMPLETED'
				WHEN e.status = 'ACTIVE' AND e.start_time < NOW() THEN 'IN_PROGRESS'
				WHEN e.status = 'IN_PROGRESS' AND e.end_time < NOW() THEN 'COMPLETED'
				ELSE e.status
			END AS status
		FROM event e
		WHERE e.id = $1
	`, eventID).Scan(&state.EventID, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get event report image state: %w", err)
	}

	state.Status = status
	return &state, nil
}

// CancelEvent sets the event status to CANCELED and transitions active
// participations to CANCELED atomically while preserving historical LEAVED rows.
// Returns ErrEventNotCancelable if the event is not in ACTIVE status.
func (r *EventRepository) CancelEvent(ctx context.Context, eventID uuid.UUID, canceledApprovedParticipantCount int) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE event
		SET status = 'CANCELED',
		    canceled_approved_participant_count = $2
		WHERE id = $1 AND status = 'ACTIVE'
	`, eventID, canceledApprovedParticipantCount)
	if err != nil {
		return fmt.Errorf("cancel event: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return eventapp.ErrEventNotCancelable
	}

	return nil
}

// CompleteEvent sets the event status to COMPLETED when it is ACTIVE or IN_PROGRESS.
// Returns ErrEventNotCompletable when the event is CANCELED, COMPLETED, or any other non-completable status.
func (r *EventRepository) CompleteEvent(ctx context.Context, eventID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE event
		SET status = 'COMPLETED', updated_at = NOW()
		WHERE id = $1 AND status IN ('ACTIVE', 'IN_PROGRESS')
	`, eventID)
	if err != nil {
		return fmt.Errorf("complete event: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return eventapp.ErrEventNotCompletable
	}
	return nil
}

// TransitionEventStatuses moves ACTIVE events to IN_PROGRESS when their
// start_time has passed, and transitions ACTIVE/IN_PROGRESS events to COMPLETED
// when any of the following conditions apply:
//   - end_time has passed
//   - start_time is older than 60 days (max duration, unconditional)
//   - start_time is older than 30 days AND updated_at is older than 7 days (stale/zombie)
//
// updated_at reflects event-level mutations (title, description, cancel, etc.).
// Participation activity does not advance updated_at.
func (r *EventRepository) TransitionEventStatuses(ctx context.Context) ([]eventapp.EventStatusTransitionRecord, error) {
	rows, err := r.db.Query(ctx, `
		WITH transitioned AS (
			UPDATE event
			SET status = CASE
				WHEN end_time IS NOT NULL AND end_time < NOW()                                           THEN 'COMPLETED'
				WHEN start_time < NOW() - INTERVAL '60 days'                                            THEN 'COMPLETED'
				WHEN start_time < NOW() - INTERVAL '30 days' AND updated_at < NOW() - INTERVAL '7 days' THEN 'COMPLETED'
				ELSE 'IN_PROGRESS'
			END
			WHERE status IN ('ACTIVE', 'IN_PROGRESS')
			  AND (
			    start_time < NOW()
			    OR (end_time IS NOT NULL AND end_time < NOW())
			  )
			RETURNING id, host_id, status
		),
		expired_tickets AS (
			UPDATE ticket t
			SET status = 'EXPIRED',
			    updated_at = NOW()
			FROM participation p
			JOIN transitioned e ON e.id = p.event_id
			WHERE t.participation_id = p.id
			  AND e.status = 'COMPLETED'
			  AND t.status IN ('ACTIVE', 'PENDING')
			RETURNING 1
		)
		SELECT id, host_id, status FROM transitioned
	`)
	if err != nil {
		return nil, fmt.Errorf("transition event statuses: %w", err)
	}
	defer rows.Close()

	records := []eventapp.EventStatusTransitionRecord{}
	for rows.Next() {
		var (
			eventID uuid.UUID
			hostID  uuid.UUID
			status  string
		)
		if err := rows.Scan(&eventID, &hostID, &status); err != nil {
			return nil, fmt.Errorf("scan transitioned event status: %w", err)
		}
		records = append(records, eventapp.EventStatusTransitionRecord{
			EventID: eventID,
			HostID:  hostID,
			Status:  domain.EventStatus(status),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate transitioned event statuses: %w", err)
	}
	return records, nil
}

// AddFavorite inserts a row into favorite_event. If the row already exists the
// operation is silently ignored (idempotent).
func (r *EventRepository) AddFavorite(ctx context.Context, userID, eventID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO favorite_event (user_id, event_id)
		VALUES ($1, $2)
		ON CONFLICT (user_id, event_id) DO NOTHING
	`, userID, eventID)
	if err != nil {
		return fmt.Errorf("add favorite: %w", err)
	}
	return nil
}

// RemoveFavorite deletes a row from favorite_event. If no row exists the
// operation is silently ignored (idempotent).
func (r *EventRepository) RemoveFavorite(ctx context.Context, userID, eventID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		DELETE FROM favorite_event
		WHERE user_id = $1 AND event_id = $2
	`, userID, eventID)
	if err != nil {
		return fmt.Errorf("remove favorite: %w", err)
	}
	return nil
}

// ListFavoriteEvents returns all events the user has favorited, ordered by most
// recently favorited first.
func (r *EventRepository) ListFavoriteEvents(ctx context.Context, userID uuid.UUID) ([]eventapp.FavoriteEventRecord, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT e.id, e.title, ec.name, e.image_url, e.status,
		       e.privacy_level, el.address, e.start_time, e.end_time, fav.created_at
		FROM favorite_event fav
		JOIN event e ON e.id = fav.event_id
		JOIN event_location el ON el.event_id = e.id
		LEFT JOIN event_category ec ON ec.id = e.category_id
		WHERE fav.user_id = $1
		ORDER BY fav.created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list favorite events: %w", err)
	}
	defer rows.Close()

	var records []eventapp.FavoriteEventRecord
	for rows.Next() {
		var (
			r               eventapp.FavoriteEventRecord
			status          string
			privacyLevel    string
			catName         *string
			locationAddress pgtype.Text
			endTime         pgtype.Timestamptz
		)
		if err := rows.Scan(&r.ID, &r.Title, &catName, &r.ImageURL, &status,
			&privacyLevel, &locationAddress, &r.StartTime, &endTime, &r.FavoritedAt); err != nil {
			return nil, fmt.Errorf("scan favorite event: %w", err)
		}
		r.Status = domain.EventStatus(status)
		r.PrivacyLevel = domain.EventPrivacyLevel(privacyLevel)
		r.CategoryName = catName
		if locationAddress.Valid {
			r.LocationAddress = &locationAddress.String
		}
		if endTime.Valid {
			r.EndTime = &endTime.Time
		}
		records = append(records, r)
	}
	return records, rows.Err()
}
