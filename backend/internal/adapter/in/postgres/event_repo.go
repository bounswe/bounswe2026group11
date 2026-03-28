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

// ListDiscoverableEvents returns nearby ACTIVE PUBLIC/PROTECTED events using
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
	statusPlaceholder := addArg(string(domain.EventStatusActive))
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
	distanceExpr := fmt.Sprintf("ST_Distance(%s, %s)", distanceSourceExpr, originExpr)
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
		fmt.Sprintf("e.status = %s", statusPlaceholder),
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
				el.address AS location_address,
				e.privacy_level,
				e.approved_participant_count,
				(fav.event_id IS NOT NULL) AS is_favorited,
				%s AS distance_meters,
				%s AS relevance_score
			FROM event e
			JOIN event_location el ON el.event_id = e.id
			LEFT JOIN event_category ec ON ec.id = e.category_id
			LEFT JOIN favorite_event fav ON fav.event_id = e.id AND fav.user_id = %s
			WHERE %s
		)
		SELECT
			id,
			title,
			category_name,
			image_url,
			start_time,
			location_address,
			privacy_level,
			approved_participant_count,
			is_favorited,
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
			locationAddress          pgtype.Text
			privacyLevel             string
			approvedParticipantCount int
			isFavorited              bool
			distanceMeters           float64
			relevanceScore           pgtype.Float8
		)

		if err := rows.Scan(
			&id,
			&title,
			&categoryName,
			&imageURL,
			&startTime,
			&locationAddress,
			&privacyLevel,
			&approvedParticipantCount,
			&isFavorited,
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
			PrivacyLevel:             domain.EventPrivacyLevel(privacyLevel),
			ApprovedParticipantCount: approvedParticipantCount,
			IsFavorited:              isFavorited,
			DistanceMeters:           distanceMeters,
		}
		if imageURL.Valid {
			record.ImageURL = &imageURL.String
		}
		if locationAddress.Valid {
			record.LocationAddress = &locationAddress.String
		}
		if relevanceScore.Valid {
			record.RelevanceScore = &relevanceScore.Float64
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
