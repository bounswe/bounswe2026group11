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
			SELECT id, start_time
			FROM event
			WHERE id = $1
			  AND host_id <> $2
			  AND privacy_level = $3
			  AND (capacity IS NULL OR approved_participant_count < capacity)
		),
		reactivated AS (
			UPDATE participation
			SET status = $4,
			    created_at = NOW(),
			    updated_at = NOW()
			WHERE event_id = $1
			  AND user_id = $2
			  AND status = $5
			  AND updated_at < (SELECT start_time FROM joinable_event)
			RETURNING id, status, created_at, updated_at
		),
		inserted AS (
			INSERT INTO participation (event_id, user_id, status)
			SELECT id, $2, $4
			FROM joinable_event
			WHERE NOT EXISTS (SELECT 1 FROM reactivated)
			ON CONFLICT ON CONSTRAINT uq_event_user DO NOTHING
			RETURNING id, status, created_at, updated_at
		)
		SELECT id, status, created_at, updated_at
		FROM reactivated
		UNION ALL
		SELECT id, status, created_at, updated_at
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

// LeaveParticipation transitions an APPROVED participation to LEAVED.
func (r *ParticipationRepository) LeaveParticipation(ctx context.Context, eventID, userID uuid.UUID) (*domain.Participation, error) {
	participation, err := scanParticipation(r.db.QueryRow(ctx, `
		UPDATE participation
		SET status = $3,
		    updated_at = NOW()
		WHERE event_id = $1
		  AND user_id = $2
		  AND status = $4
		RETURNING id, status, created_at, updated_at
	`, eventID, userID, domain.ParticipationStatusLeaved, domain.ParticipationStatusApproved), eventID, userID, "leave participation")
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
	if event.Capacity != nil && event.ApprovedParticipantCount >= *event.Capacity {
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

	return domain.ConflictError(domain.ErrorCodeEventLeaveNotAllowed, "Only approved participants can leave this event.")
}

func (r *ParticipationRepository) loadEventJoinState(ctx context.Context, eventID uuid.UUID) (*domain.Event, error) {
	var (
		hostID        uuid.UUID
		privacyLevel  string
		capacity      pgtype.Int4
		approvedCount int
		startTime     time.Time
	)

	err := r.db.QueryRow(ctx, `
		SELECT host_id, privacy_level, capacity, approved_participant_count, start_time
		FROM event
		WHERE id = $1
	`, eventID).Scan(&hostID, &privacyLevel, &capacity, &approvedCount, &startTime)
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
