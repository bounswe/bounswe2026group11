package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
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

	if err := insertHostParticipation(ctx, tx, event); err != nil {
		return nil, err
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

// insertHostParticipation creates the host's internal APPROVED participation
// row so downstream authorization can treat the host as part of the event
// membership set without exposing them as a normal participant.
func insertHostParticipation(ctx context.Context, tx pgx.Tx, event *domain.Event) error {
	if _, err := tx.Exec(ctx, `
		INSERT INTO participation (event_id, user_id, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
	`, event.ID, event.HostID, domain.ParticipationStatusApproved, event.CreatedAt, event.UpdatedAt); err != nil {
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
	statusPlaceholder := addArg([]string{string(domain.EventStatusActive), string(domain.EventStatusInProgress)})
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
				e.favorite_count,
				(fav.event_id IS NOT NULL) AS is_favorited,
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
			location_address,
			privacy_level,
			approved_participant_count,
			favorite_count,
			is_favorited,
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
			locationAddress          pgtype.Text
			privacyLevel             string
			approvedParticipantCount int
			favoriteCount            int
			isFavorited              bool
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
			&locationAddress,
			&privacyLevel,
			&approvedParticipantCount,
			&favoriteCount,
			&isFavorited,
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
			PrivacyLevel:             domain.EventPrivacyLevel(privacyLevel),
			ApprovedParticipantCount: approvedParticipantCount,
			FavoriteCount:            favoriteCount,
			IsFavorited:              isFavorited,
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

	location, err := r.loadEventDetailLocation(ctx, eventID, record.Location.Type)
	if err != nil {
		return nil, err
	}
	location.Address = record.Location.Address
	record.Location = location

	tags, err := r.loadEventTags(ctx, eventID)
	if err != nil {
		return nil, err
	}
	record.Tags = tags

	constraints, err := r.loadEventConstraints(ctx, eventID)
	if err != nil {
		return nil, err
	}
	record.Constraints = constraints

	viewerEventRating, err := r.loadViewerEventRating(ctx, eventID, userID)
	if err != nil {
		return nil, err
	}
	record.ViewerEventRating = viewerEventRating

	if record.ViewerContext.IsHost {
		hostContext, err := r.loadEventHostContext(ctx, eventID)
		if err != nil {
			return nil, err
		}
		record.HostContext = hostContext
	}

	return record, nil
}

func (r *EventRepository) loadEventDetailCore(
	ctx context.Context,
	userID, eventID uuid.UUID,
) (*eventapp.EventDetailRecord, error) {
	var (
		id                       uuid.UUID
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
		isHost                   bool
		isFavorited              bool
		participationStatus      string
	)

	err := r.pool.QueryRow(ctx, `
		SELECT
			e.id,
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
			(e.host_id = $2) AS is_host,
			EXISTS (
				SELECT 1
				FROM favorite_event fav
				WHERE fav.event_id = e.id
				  AND fav.user_id = $2
			) AS is_favorited,
			CASE
				WHEN e.host_id = $2 THEN $3
				WHEN EXISTS (
					SELECT 1
					FROM participation p
					WHERE p.event_id = e.id
					  AND p.user_id = $2
					  AND p.status = $4
				) THEN $5
				WHEN EXISTS (
					SELECT 1
					FROM join_request jr
					WHERE jr.event_id = e.id
					  AND jr.user_id = $2
					  AND jr.status = $6
				) THEN $7
				WHEN EXISTS (
					SELECT 1
					FROM invitation inv
					WHERE inv.event_id = e.id
					  AND inv.invited_user_id = $2
				) THEN $8
				ELSE $3
			END AS participation_status
		FROM event e
		JOIN event_location el ON el.event_id = e.id
		LEFT JOIN event_category ec ON ec.id = e.category_id
		JOIN app_user host ON host.id = e.host_id
		LEFT JOIN profile hp ON hp.user_id = host.id
		LEFT JOIN user_score us ON us.user_id = host.id
		WHERE e.id = $1
		  AND (
			e.privacy_level IN ($9, $10)
			OR e.host_id = $2
			OR EXISTS (
				SELECT 1
				FROM participation p
				WHERE p.event_id = e.id
				  AND p.user_id = $2
				  AND p.status = $4
			)
			OR EXISTS (
				SELECT 1
				FROM invitation inv
				WHERE inv.event_id = e.id
				  AND inv.invited_user_id = $2
				  AND inv.status = $11
			)
		  )
	`,
		eventID,
		userID,
		string(domain.EventDetailParticipationStatusNone),
		domain.ParticipationStatusApproved,
		string(domain.EventDetailParticipationStatusJoined),
		string(domain.JoinRequestStatusPending),
		string(domain.EventDetailParticipationStatusPending),
		string(domain.EventDetailParticipationStatusInvited),
		string(domain.PrivacyPublic),
		string(domain.PrivacyProtected),
		string(domain.InvitationStatusAccepted),
	).Scan(
		&id,
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
		&isHost,
		&isFavorited,
		&participationStatus,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get event detail: %w", err)
	}

	record := &eventapp.EventDetailRecord{
		ID:                       id,
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
			IsHost:              isHost,
			IsFavorited:         isFavorited,
			ParticipationStatus: domain.EventDetailParticipationStatus(participationStatus),
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

func (r *EventRepository) loadEventHostContext(
	ctx context.Context,
	eventID uuid.UUID,
) (*eventapp.EventDetailHostContextRecord, error) {
	approvedParticipants, err := r.loadApprovedParticipants(ctx, eventID)
	if err != nil {
		return nil, err
	}

	pendingJoinRequests, err := r.loadPendingJoinRequests(ctx, eventID)
	if err != nil {
		return nil, err
	}

	invitations, err := r.loadInvitations(ctx, eventID)
	if err != nil {
		return nil, err
	}

	return &eventapp.EventDetailHostContextRecord{
		ApprovedParticipants: approvedParticipants,
		PendingJoinRequests:  pendingJoinRequests,
		Invitations:          invitations,
	}, nil
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
		FROM event_rating
		WHERE event_id = $1
		  AND participant_user_id = $2
	`, eventID, participantUserID).Scan(
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
) ([]eventapp.EventDetailApprovedParticipantRecord, error) {
	rows, err := r.pool.Query(ctx, `
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
		ORDER BY p.created_at ASC, p.id ASC
	`, eventID, domain.ParticipationStatusApproved)
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

		participant := eventapp.EventDetailApprovedParticipantRecord{
			ParticipationID: participationID,
			Status:          status,
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
) ([]eventapp.EventDetailPendingJoinRequestRecord, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			jr.id,
			jr.status,
			jr.message,
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
		ORDER BY jr.created_at ASC, jr.id ASC
	`, eventID, string(domain.JoinRequestStatusPending))
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
) ([]eventapp.EventDetailInvitationRecord, error) {
	rows, err := r.pool.Query(ctx, `
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
		ORDER BY inv.created_at ASC, inv.id ASC
	`, eventID)
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

// CancelEvent sets the event status to CANCELED and cancels all its participations atomically.
// Returns ErrEventNotCancelable if the event is not in ACTIVE status.
func (r *EventRepository) CancelEvent(ctx context.Context, eventID uuid.UUID) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("cancel event: begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	tag, err := tx.Exec(ctx, `
		UPDATE event
		SET status = 'CANCELED'
		WHERE id = $1 AND status = 'ACTIVE'
	`, eventID)
	if err != nil {
		return fmt.Errorf("cancel event: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return eventapp.ErrEventNotCancelable
	}

	_, err = tx.Exec(ctx, `
		UPDATE participation
		SET status = $1, updated_at = NOW()
		WHERE event_id = $2
	`, domain.ParticipationStatusCanceled, eventID)
	if err != nil {
		return fmt.Errorf("cancel event participations: %w", err)
	}

	return tx.Commit(ctx)
}

// TransitionEventStatuses moves ACTIVE events to IN_PROGRESS when their
// start_time has passed and IN_PROGRESS (or ACTIVE) events to COMPLETED when
// their end_time has passed.
func (r *EventRepository) TransitionEventStatuses(ctx context.Context) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE event
		SET status = CASE
			WHEN end_time < NOW() THEN 'COMPLETED'
			ELSE 'IN_PROGRESS'
		END
		WHERE (status = 'ACTIVE' AND start_time < NOW())
		   OR (status = 'IN_PROGRESS' AND end_time < NOW())
	`)
	return err
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
		       e.start_time, e.end_time, fav.created_at
		FROM favorite_event fav
		JOIN event e ON e.id = fav.event_id
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
			r       eventapp.FavoriteEventRecord
			status  string
			catName *string
			endTime pgtype.Timestamptz
		)
		if err := rows.Scan(&r.ID, &r.Title, &catName, &r.ImageURL, &status,
			&r.StartTime, &endTime, &r.FavoritedAt); err != nil {
			return nil, fmt.Errorf("scan favorite event: %w", err)
		}
		r.Status = domain.EventStatus(status)
		r.CategoryName = catName
		if endTime.Valid {
			r.EndTime = &endTime.Time
		}
		records = append(records, r)
	}
	return records, rows.Err()
}


