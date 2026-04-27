package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	ticketapp "github.com/bounswe/bounswe2026group11/backend/internal/application/ticket"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TicketRepository is the Postgres-backed implementation of ticket.Repository.
type TicketRepository struct {
	pool *pgxpool.Pool
	db   execer
}

var _ ticketapp.Repository = (*TicketRepository)(nil)

// NewTicketRepository returns a repository that executes queries against the given connection pool.
func NewTicketRepository(pool *pgxpool.Pool) *TicketRepository {
	return &TicketRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

// CreateTicketForParticipation creates or reactivates a non-terminal ticket for a protected participation.
func (r *TicketRepository) CreateTicketForParticipation(ctx context.Context, participationID uuid.UUID, status domain.TicketStatus) (*domain.Ticket, error) {
	row := r.db.QueryRow(ctx, `
		WITH participation_event AS (
			SELECT p.id AS participation_id,
			       COALESCE(e.end_time, e.start_time + INTERVAL '60 days') AS expires_at
			FROM participation p
			JOIN event e ON e.id = p.event_id
			WHERE p.id = $1
			  AND e.privacy_level = $3
		),
		reactivated AS (
			UPDATE ticket t
			SET status = $2,
			    qr_token_version = 0,
			    last_issued_qr_token_hash = NULL,
			    expires_at = pe.expires_at,
			    used_at = NULL,
			    canceled_at = NULL,
			    updated_at = NOW()
			FROM participation_event pe
			WHERE t.participation_id = pe.participation_id
			  AND t.status IN ($4, $5, $6)
			RETURNING t.id, t.participation_id, t.status, t.qr_token_version, t.last_issued_qr_token_hash,
			          t.expires_at, t.used_at, t.canceled_at, t.created_at, t.updated_at
		),
		inserted AS (
			INSERT INTO ticket (participation_id, status, expires_at)
			SELECT participation_id, $2, expires_at
			FROM participation_event
			WHERE NOT EXISTS (SELECT 1 FROM reactivated)
			ON CONFLICT DO NOTHING
			RETURNING id, participation_id, status, qr_token_version, last_issued_qr_token_hash,
			          expires_at, used_at, canceled_at, created_at, updated_at
		)
		SELECT id, participation_id, status, qr_token_version, last_issued_qr_token_hash,
		       expires_at, used_at, canceled_at, created_at, updated_at
		FROM reactivated
		UNION ALL
		SELECT id, participation_id, status, qr_token_version, last_issued_qr_token_hash,
		       expires_at, used_at, canceled_at, created_at, updated_at
		FROM inserted
		LIMIT 1
	`, participationID, status, domain.PrivacyProtected, domain.TicketStatusExpired, domain.TicketStatusCanceled, domain.TicketStatusUsed)

	ticket, err := scanTicket(row)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.NotFoundError(domain.ErrorCodeTicketNotFound, "The linked protected participation does not exist.")
		}
		return nil, fmt.Errorf("create ticket for participation: %w", err)
	}
	return ticket, nil
}

// CancelTicketForParticipation cancels a non-terminal ticket for the participation.
func (r *TicketRepository) CancelTicketForParticipation(ctx context.Context, participationID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE ticket
		SET status = $2,
		    canceled_at = COALESCE(canceled_at, NOW()),
		    updated_at = NOW()
		WHERE participation_id = $1
		  AND status IN ($3, $4)
	`, participationID, domain.TicketStatusCanceled, domain.TicketStatusActive, domain.TicketStatusPending)
	if err != nil {
		return fmt.Errorf("cancel ticket for participation: %w", err)
	}
	return nil
}

// CancelTicketsForEvent cancels all non-terminal tickets for an event.
func (r *TicketRepository) CancelTicketsForEvent(ctx context.Context, eventID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE ticket t
		SET status = $2,
		    canceled_at = COALESCE(t.canceled_at, NOW()),
		    updated_at = NOW()
		FROM participation p
		WHERE p.id = t.participation_id
		  AND p.event_id = $1
		  AND t.status IN ($3, $4)
	`, eventID, domain.TicketStatusCanceled, domain.TicketStatusActive, domain.TicketStatusPending)
	if err != nil {
		return fmt.Errorf("cancel tickets for event: %w", err)
	}
	return nil
}

// ExpireTicketsForEvent expires all unused non-terminal tickets for an event.
func (r *TicketRepository) ExpireTicketsForEvent(ctx context.Context, eventID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE ticket t
		SET status = $2,
		    updated_at = NOW()
		FROM participation p
		WHERE p.id = t.participation_id
		  AND p.event_id = $1
		  AND t.status IN ($3, $4)
	`, eventID, domain.TicketStatusExpired, domain.TicketStatusActive, domain.TicketStatusPending)
	if err != nil {
		return fmt.Errorf("expire tickets for event: %w", err)
	}
	return nil
}

// ListTicketsByUser returns ticket summaries for the given user.
func (r *TicketRepository) ListTicketsByUser(ctx context.Context, userID uuid.UUID) ([]ticketapp.TicketRecord, error) {
	rows, err := r.db.Query(ctx, ticketRecordSelect(`
		WHERE user_id = $1
		ORDER BY start_time ASC, created_at ASC
	`, "NULL::double precision", "NULL::double precision"), userID)
	if err != nil {
		return nil, fmt.Errorf("list tickets by user: %w", err)
	}
	defer rows.Close()

	records := []ticketapp.TicketRecord{}
	for rows.Next() {
		record, err := scanTicketRecord(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, *record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list tickets by user rows: %w", err)
	}
	return records, nil
}

// GetTicketDetail returns a ticket detail projection when the ticket belongs to the user.
func (r *TicketRepository) GetTicketDetail(ctx context.Context, userID, ticketID uuid.UUID) (*ticketapp.TicketRecord, error) {
	record, err := scanTicketRecord(r.db.QueryRow(ctx, ticketRecordSelect(`
		WHERE user_id = $1
		  AND id = $2
	`, "NULL::double precision", "NULL::double precision"), userID, ticketID))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return record, nil
}

// GetTicketAccessForUser returns ticket state plus distance from the caller's provided coordinates.
func (r *TicketRepository) GetTicketAccessForUser(ctx context.Context, userID, ticketID uuid.UUID, lat, lon float64, forUpdate bool) (*ticketapp.TicketAccessRecord, error) {
	_ = forUpdate
	record, err := scanTicketAccessRecord(r.db.QueryRow(ctx, ticketRecordSelect(`
		WHERE user_id = $1
		  AND id = $2
		`, "$3::double precision", "$4::double precision"), userID, ticketID, lat, lon))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return record, nil
}

// StoreIssuedToken stores only the hash and monotonically increasing token version.
func (r *TicketRepository) StoreIssuedToken(ctx context.Context, ticketID uuid.UUID, version int, tokenHash string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE ticket
		SET qr_token_version = $2,
		    last_issued_qr_token_hash = $3,
		    updated_at = NOW()
		WHERE id = $1
	`, ticketID, version, tokenHash)
	if err != nil {
		return fmt.Errorf("store issued ticket token: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return domain.NotFoundError(domain.ErrorCodeTicketNotFound, "The requested ticket does not exist.")
	}
	return nil
}

// GetTicketForScan returns locked ticket state for host scan validation.
func (r *TicketRepository) GetTicketForScan(ctx context.Context, eventID, ticketID uuid.UUID, forUpdate bool) (*ticketapp.TicketScanRecord, error) {
	query := `
		SELECT t.id, t.participation_id, t.status, t.qr_token_version, t.last_issued_qr_token_hash,
		       t.expires_at, t.used_at, t.canceled_at, t.created_at, t.updated_at,
		       p.id, p.event_id, p.user_id, p.status, p.created_at, p.updated_at,
		       e.id, e.status, e.privacy_level, e.host_id
		FROM ticket t
		JOIN participation p ON p.id = t.participation_id
		JOIN event e ON e.id = p.event_id
		WHERE t.id = $1
		  AND e.id = $2
	`
	if forUpdate {
		query += ` FOR UPDATE OF t`
	}

	record, err := scanTicketScanRecord(r.db.QueryRow(ctx, query, ticketID, eventID))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return record, nil
}

// MarkTicketUsed marks an ACTIVE ticket as USED.
func (r *TicketRepository) MarkTicketUsed(ctx context.Context, ticketID uuid.UUID) (*domain.Ticket, error) {
	ticket, err := scanTicket(r.db.QueryRow(ctx, `
		UPDATE ticket
		SET status = $2,
		    used_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1
		  AND status = $3
		RETURNING id, participation_id, status, qr_token_version, last_issued_qr_token_hash,
		          expires_at, used_at, canceled_at, created_at, updated_at
	`, ticketID, domain.TicketStatusUsed, domain.TicketStatusActive))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.ConflictError(domain.ErrorCodeTicketScanRejected, "The ticket can no longer be used.")
		}
		return nil, fmt.Errorf("mark ticket used: %w", err)
	}
	return ticket, nil
}

func ticketRecordSelect(whereClause, latExpr, lonExpr string) string {
	return `
		WITH ticket_base AS (
			SELECT t.id, t.participation_id, t.status, t.qr_token_version, t.last_issued_qr_token_hash,
			       t.expires_at, t.used_at, t.canceled_at, t.created_at, t.updated_at,
			       p.event_id, p.user_id, p.status AS participation_status, p.created_at AS participation_created_at, p.updated_at AS participation_updated_at,
			       e.title, e.status AS event_status, e.privacy_level, e.start_time, e.end_time, e.location_type,
			       el.address,
			       CASE
			           WHEN e.location_type = 'ROUTE' THEN ST_StartPoint(el.geom::geometry)
			           ELSE el.geom::geometry
			       END AS anchor_geom
			FROM ticket t
			JOIN participation p ON p.id = t.participation_id
			JOIN event e ON e.id = p.event_id
			JOIN event_location el ON el.event_id = e.id
		)
		SELECT id, participation_id, status, qr_token_version, last_issued_qr_token_hash,
		       expires_at, used_at, canceled_at, created_at, updated_at,
		       event_id, user_id, participation_status, participation_created_at, participation_updated_at,
		       title, event_status, privacy_level, start_time, end_time, location_type, address,
		       ST_Y(anchor_geom) AS anchor_lat,
		       ST_X(anchor_geom) AS anchor_lon,
		       CASE
		           WHEN ` + latExpr + ` IS NULL OR ` + lonExpr + ` IS NULL THEN 0::double precision
		           ELSE ST_Distance(anchor_geom::geography, ST_SetSRID(ST_MakePoint(` + lonExpr + `, ` + latExpr + `), 4326)::geography)
		       END AS distance_meters
		FROM ticket_base
	` + whereClause
}

func scanTicket(row pgx.Row) (*domain.Ticket, error) {
	var (
		ticket     domain.Ticket
		status     string
		tokenHash  pgtype.Text
		usedAt     pgtype.Timestamptz
		canceledAt pgtype.Timestamptz
	)
	if err := row.Scan(
		&ticket.ID,
		&ticket.ParticipationID,
		&status,
		&ticket.QRTokenVersion,
		&tokenHash,
		&ticket.ExpiresAt,
		&usedAt,
		&canceledAt,
		&ticket.CreatedAt,
		&ticket.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, err
	}
	parsedStatus, ok := domain.ParseTicketStatus(status)
	if !ok {
		return nil, fmt.Errorf("unknown ticket status %q", status)
	}
	ticket.Status = parsedStatus
	ticket.LastIssuedQRTokenHash = textPtr(tokenHash)
	ticket.UsedAt = timestamptzPtr(usedAt)
	ticket.CanceledAt = timestamptzPtr(canceledAt)
	return &ticket, nil
}

func scanTicketRecord(row pgx.Row) (*ticketapp.TicketRecord, error) {
	accessRecord, err := scanTicketAccessRecord(row)
	if err != nil {
		return nil, err
	}
	return &accessRecord.TicketRecord, nil
}

func scanTicketAccessRecord(row pgx.Row) (*ticketapp.TicketAccessRecord, error) {
	var (
		ticket                 domain.Ticket
		ticketStatus           string
		tokenHash              pgtype.Text
		usedAt                 pgtype.Timestamptz
		canceledAt             pgtype.Timestamptz
		eventID                uuid.UUID
		userID                 uuid.UUID
		participationStatus    string
		participationCreatedAt time.Time
		participationUpdatedAt time.Time
		eventTitle             string
		eventStatus            string
		privacyLevel           string
		startTime              time.Time
		endTime                pgtype.Timestamptz
		locationType           string
		address                pgtype.Text
		anchorLat              float64
		anchorLon              float64
		distanceMeters         float64
	)

	err := row.Scan(
		&ticket.ID,
		&ticket.ParticipationID,
		&ticketStatus,
		&ticket.QRTokenVersion,
		&tokenHash,
		&ticket.ExpiresAt,
		&usedAt,
		&canceledAt,
		&ticket.CreatedAt,
		&ticket.UpdatedAt,
		&eventID,
		&userID,
		&participationStatus,
		&participationCreatedAt,
		&participationUpdatedAt,
		&eventTitle,
		&eventStatus,
		&privacyLevel,
		&startTime,
		&endTime,
		&locationType,
		&address,
		&anchorLat,
		&anchorLon,
		&distanceMeters,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("scan ticket record: %w", err)
	}

	parsedTicketStatus, ok := domain.ParseTicketStatus(ticketStatus)
	if !ok {
		return nil, fmt.Errorf("unknown ticket status %q", ticketStatus)
	}
	parsedParticipationStatus, ok := domain.ParseParticipationStatus(participationStatus)
	if !ok {
		return nil, fmt.Errorf("unknown participation status %q", participationStatus)
	}
	parsedEventStatus := domain.EventStatus(eventStatus)
	parsedPrivacyLevel, ok := domain.ParseEventPrivacyLevel(privacyLevel)
	if !ok {
		return nil, fmt.Errorf("unknown event privacy level %q", privacyLevel)
	}
	parsedLocationType, ok := domain.ParseEventLocationType(locationType)
	if !ok {
		return nil, fmt.Errorf("unknown event location type %q", locationType)
	}

	ticket.Status = parsedTicketStatus
	ticket.LastIssuedQRTokenHash = textPtr(tokenHash)
	ticket.UsedAt = timestamptzPtr(usedAt)
	ticket.CanceledAt = timestamptzPtr(canceledAt)

	record := &ticketapp.TicketAccessRecord{
		TicketRecord: ticketapp.TicketRecord{
			Ticket: ticket,
			Participation: domain.Participation{
				ID:        ticket.ParticipationID,
				EventID:   eventID,
				UserID:    userID,
				Status:    parsedParticipationStatus,
				CreatedAt: participationCreatedAt,
				UpdatedAt: participationUpdatedAt,
			},
			EventID:      eventID,
			EventTitle:   eventTitle,
			EventStatus:  parsedEventStatus,
			PrivacyLevel: parsedPrivacyLevel,
			StartTime:    startTime,
			LocationType: parsedLocationType,
			Address:      textPtr(address),
			Anchor: domain.GeoPoint{
				Lat: anchorLat,
				Lon: anchorLon,
			},
		},
		UserID:         userID,
		DistanceMeters: distanceMeters,
	}
	if endTime.Valid {
		record.EndTime = &endTime.Time
	}
	return record, nil
}

func scanTicketScanRecord(row pgx.Row) (*ticketapp.TicketScanRecord, error) {
	var (
		ticket              domain.Ticket
		ticketStatus        string
		tokenHash           pgtype.Text
		usedAt              pgtype.Timestamptz
		canceledAt          pgtype.Timestamptz
		participation       domain.Participation
		participationStatus string
		eventID             uuid.UUID
		eventStatus         string
		privacyLevel        string
		hostID              uuid.UUID
	)
	err := row.Scan(
		&ticket.ID,
		&ticket.ParticipationID,
		&ticketStatus,
		&ticket.QRTokenVersion,
		&tokenHash,
		&ticket.ExpiresAt,
		&usedAt,
		&canceledAt,
		&ticket.CreatedAt,
		&ticket.UpdatedAt,
		&participation.ID,
		&participation.EventID,
		&participation.UserID,
		&participationStatus,
		&participation.CreatedAt,
		&participation.UpdatedAt,
		&eventID,
		&eventStatus,
		&privacyLevel,
		&hostID,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("scan ticket scan record: %w", err)
	}
	parsedTicketStatus, ok := domain.ParseTicketStatus(ticketStatus)
	if !ok {
		return nil, fmt.Errorf("unknown ticket status %q", ticketStatus)
	}
	parsedParticipationStatus, ok := domain.ParseParticipationStatus(participationStatus)
	if !ok {
		return nil, fmt.Errorf("unknown participation status %q", participationStatus)
	}
	parsedPrivacyLevel, ok := domain.ParseEventPrivacyLevel(privacyLevel)
	if !ok {
		return nil, fmt.Errorf("unknown event privacy level %q", privacyLevel)
	}
	ticket.Status = parsedTicketStatus
	ticket.LastIssuedQRTokenHash = textPtr(tokenHash)
	ticket.UsedAt = timestamptzPtr(usedAt)
	ticket.CanceledAt = timestamptzPtr(canceledAt)
	participation.Status = parsedParticipationStatus

	return &ticketapp.TicketScanRecord{
		Ticket:        ticket,
		Participation: participation,
		EventID:       eventID,
		EventStatus:   domain.EventStatus(eventStatus),
		PrivacyLevel:  parsedPrivacyLevel,
		HostID:        hostID,
		UserID:        participation.UserID,
	}, nil
}
