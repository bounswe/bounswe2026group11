package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ParticipationRepository is the Postgres-backed implementation of participation.ParticipationRepository.
type ParticipationRepository struct {
	pool *pgxpool.Pool
	db   execer
}

// NewParticipationRepository returns a repository that executes queries against the given connection pool.
func NewParticipationRepository(pool *pgxpool.Pool) *ParticipationRepository {
	return &ParticipationRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

// CreateParticipation inserts an APPROVED participation row.
// Rejoins before start reactivate the existing row instead of inserting a duplicate.
func (r *ParticipationRepository) CreateParticipation(ctx context.Context, eventID, userID uuid.UUID) (*domain.Participation, error) {
	participation, err := scanParticipation(r.db.QueryRow(ctx, `
		WITH joinable_event AS (
			SELECT id, start_time, version_no
			FROM event
			WHERE id = $1
			  AND host_id <> $2
			  AND privacy_level = $3
			  AND (capacity IS NULL OR approved_participant_count + pending_participant_count < capacity)
		),
		reactivated AS (
			UPDATE participation
			SET status = $4,
			    reconfirmed_at = NULL,
			    last_confirmed_event_version = (SELECT version_no FROM joinable_event),
			    created_at = NOW(),
			    updated_at = NOW()
			WHERE event_id = $1
			  AND user_id = $2
			  AND status = $5
			  AND updated_at < (SELECT start_time FROM joinable_event)
			RETURNING id, status, reconfirmed_at, last_confirmed_event_version, created_at, updated_at
		),
		inserted AS (
			INSERT INTO participation (event_id, user_id, status, last_confirmed_event_version)
			SELECT id, $2, $4, version_no
			FROM joinable_event
			WHERE NOT EXISTS (SELECT 1 FROM reactivated)
			ON CONFLICT ON CONSTRAINT uq_event_user DO NOTHING
			RETURNING id, status, reconfirmed_at, last_confirmed_event_version, created_at, updated_at
		)
		SELECT id, status, reconfirmed_at, last_confirmed_event_version, created_at, updated_at
		FROM reactivated
		UNION ALL
		SELECT id, status, reconfirmed_at, last_confirmed_event_version, created_at, updated_at
		FROM inserted
		LIMIT 1
	`, eventID, userID, domain.PrivacyPublic, domain.ParticipationStatusApproved, domain.ParticipationStatusLeaved), eventID, userID, "create participation")
	if err != nil {
		return nil, err
	}

	if participation == nil {
		return nil, r.mapCreateParticipationNoRow(ctx, eventID, userID)
	}

	return participation, nil
}

// LeaveParticipation transitions an APPROVED or PENDING participation to LEAVED.
func (r *ParticipationRepository) LeaveParticipation(ctx context.Context, eventID, userID uuid.UUID) (*domain.Participation, error) {
	participation, err := scanParticipation(r.db.QueryRow(ctx, `
		UPDATE participation
		SET status = $3,
		    updated_at = NOW()
		WHERE event_id = $1
		  AND user_id = $2
		  AND status IN ($4, $5)
		RETURNING id, status, reconfirmed_at, last_confirmed_event_version, created_at, updated_at
	`, eventID, userID, domain.ParticipationStatusLeaved, domain.ParticipationStatusApproved, domain.ParticipationStatusPending), eventID, userID, "leave participation")
	if err != nil {
		return nil, err
	}

	if participation == nil {
		return nil, r.mapLeaveParticipationNoRow(ctx, eventID)
	}

	return participation, nil
}

func (r *ParticipationRepository) mapCreateParticipationNoRow(ctx context.Context, eventID, userID uuid.UUID) error {
	event, err := r.loadEventJoinState(ctx, eventID)
	if err != nil {
		return err
	}

	if event == nil {
		return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
	}
	if event.HostID == userID {
		return domain.ForbiddenError(domain.ErrorCodeHostCannotJoin, "The event host cannot join their own event.")
	}
	if event.PrivacyLevel != domain.PrivacyPublic {
		return domain.ConflictError(domain.ErrorCodeEventJoinNotAllowed, "Only PUBLIC events can be joined directly.")
	}
	if event.Capacity != nil && event.ApprovedParticipantCount+event.PendingParticipantCount >= *event.Capacity {
		return domain.ConflictError(domain.ErrorCodeCapacityExceeded, "This event has reached its maximum capacity.")
	}

	participation, err := loadParticipation(ctx, r.db, eventID, userID, false)
	if err != nil {
		return err
	}
	if participation != nil {
		return mapJoinParticipationConflict(
			participation,
			event.StartTime,
			"You are already participating in this event.",
			"You cannot rejoin an event after leaving once it has started.",
		)
	}

	return fmt.Errorf("create participation: join preconditions changed during insert")
}

func (r *ParticipationRepository) mapLeaveParticipationNoRow(ctx context.Context, eventID uuid.UUID) error {
	event, err := r.loadEventJoinState(ctx, eventID)
	if err != nil {
		return err
	}
	if event == nil {
		return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
	}

	return domain.ConflictError(domain.ErrorCodeEventLeaveNotAllowed, "Only approved or pending participants can leave this event.")
}

func (r *ParticipationRepository) loadEventJoinState(ctx context.Context, eventID uuid.UUID) (*domain.Event, error) {
	var (
		hostID        uuid.UUID
		privacyLevel  string
		capacity      pgtype.Int4
		approvedCount int
		pendingCount  int
		startTime     time.Time
	)

	err := r.db.QueryRow(ctx, `
		SELECT host_id, privacy_level, capacity, approved_participant_count, pending_participant_count, start_time
		FROM event
		WHERE id = $1
	`, eventID).Scan(&hostID, &privacyLevel, &capacity, &approvedCount, &pendingCount, &startTime)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("load event join state: %w", err)
	}

	event := &domain.Event{
		ID:                       eventID,
		HostID:                   hostID,
		PrivacyLevel:             domain.EventPrivacyLevel(privacyLevel),
		ApprovedParticipantCount: approvedCount,
		PendingParticipantCount:  pendingCount,
		StartTime:                startTime,
	}
	if capacity.Valid {
		event.Capacity = new(int(capacity.Int32))
	}

	return event, nil
}

// CancelEventParticipations transitions every non-LEAVED participation for the
// event to CANCELED, preserving historical leave records. It returns the user
// IDs of every participation that was transitioned so callers can fan out
// notifications without a second query.
func (r *ParticipationRepository) CancelEventParticipations(ctx context.Context, eventID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.db.Query(ctx, `
		UPDATE participation
		SET status = $1, updated_at = NOW()
		WHERE event_id = $2
		  AND status <> $3
		RETURNING user_id
	`, domain.ParticipationStatusCanceled, eventID, domain.ParticipationStatusLeaved)
	if err != nil {
		return nil, fmt.Errorf("cancel event participations: %w", err)
	}
	defer rows.Close()

	var userIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scan cancelled participant: %w", err)
		}
		userIDs = append(userIDs, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("cancel event participations rows: %w", err)
	}

	return userIDs, nil
}

// MarkApprovedParticipationsPending moves approved non-host participants to
// PENDING for event-change reconfirmation and returns transitioned user IDs.
func (r *ParticipationRepository) MarkApprovedParticipationsPending(ctx context.Context, eventID, hostUserID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.db.Query(ctx, `
		UPDATE participation
		SET status = $1,
		    reconfirmed_at = NULL,
		    updated_at = NOW()
		WHERE event_id = $2
		  AND user_id <> $3
		  AND status = $4
		RETURNING user_id
	`, domain.ParticipationStatusPending, eventID, hostUserID, domain.ParticipationStatusApproved)
	if err != nil {
		return nil, fmt.Errorf("mark approved participations pending: %w", err)
	}
	defer rows.Close()

	userIDs := []uuid.UUID{}
	for rows.Next() {
		var userID uuid.UUID
		if err := rows.Scan(&userID); err != nil {
			return nil, fmt.Errorf("scan pending participant user: %w", err)
		}
		userIDs = append(userIDs, userID)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate pending participant users: %w", err)
	}
	return userIDs, nil
}

// ReconfirmParticipation transitions one pending participant back to APPROVED
// and records the event version they accepted.
func (r *ParticipationRepository) ReconfirmParticipation(ctx context.Context, eventID, userID uuid.UUID, eventVersion int) (*domain.Participation, error) {
	participation, err := scanParticipation(r.db.QueryRow(ctx, `
		UPDATE participation
		SET status = $4,
		    reconfirmed_at = NOW(),
		    last_confirmed_event_version = $3,
		    updated_at = NOW()
		WHERE event_id = $1
		  AND user_id = $2
		  AND status = $5
		RETURNING id, status, reconfirmed_at, last_confirmed_event_version, created_at, updated_at
	`, eventID, userID, eventVersion, domain.ParticipationStatusApproved, domain.ParticipationStatusPending), eventID, userID, "reconfirm participation")
	if err != nil {
		return nil, err
	}
	if participation == nil {
		return nil, domain.ConflictError(domain.ErrorCodeParticipationReconfirmNotAllowed, "Only PENDING participations can be reconfirmed.")
	}
	return participation, nil
}

// ApprovePendingParticipationsForEvent auto-approves pending participants when
// an event starts without setting reconfirmation metadata.
func (r *ParticipationRepository) ApprovePendingParticipationsForEvent(ctx context.Context, eventID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE participation
		SET status = $2,
		    updated_at = NOW()
		WHERE event_id = $1
		  AND status = $3
	`, eventID, domain.ParticipationStatusApproved, domain.ParticipationStatusPending)
	if err != nil {
		return fmt.Errorf("approve pending participations for event: %w", err)
	}
	return nil
}
