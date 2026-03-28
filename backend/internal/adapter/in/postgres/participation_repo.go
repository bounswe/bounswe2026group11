package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ParticipationRepository is the Postgres-backed implementation of participation.ParticipationRepository.
type ParticipationRepository struct {
	pool *pgxpool.Pool
}

// NewParticipationRepository returns a repository that executes queries against the given connection pool.
func NewParticipationRepository(pool *pgxpool.Pool) *ParticipationRepository {
	return &ParticipationRepository{pool: pool}
}

// CreateParticipation inserts an APPROVED participation row.
// Returns a ConflictError with code already_participating on duplicate (event_id, user_id).
func (r *ParticipationRepository) CreateParticipation(ctx context.Context, eventID, userID uuid.UUID) (*domain.Participation, error) {
	var (
		id        uuid.UUID
		status    string
		createdAt time.Time
		updatedAt time.Time
	)

	err := r.pool.QueryRow(ctx, `
		WITH joinable_event AS (
			SELECT id
			FROM event
			WHERE id = $1
			  AND host_id <> $2
			  AND privacy_level = $3
			  AND (capacity IS NULL OR approved_participant_count < capacity)
		)
		INSERT INTO participation (event_id, user_id, status)
		SELECT id, $2, $4
		FROM joinable_event
		ON CONFLICT ON CONSTRAINT uq_event_user DO NOTHING
		RETURNING id, status, created_at, updated_at
	`, eventID, userID, domain.PrivacyPublic, domain.ParticipationStatusApproved).Scan(&id, &status, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, r.mapCreateParticipationNoRow(ctx, eventID, userID)
		}
		return nil, mapParticipationInsertError(err)
	}

	return &domain.Participation{
		ID:        id,
		EventID:   eventID,
		UserID:    userID,
		Status:    status,
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	}, nil
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

	exists, err := r.participationExists(ctx, eventID, userID)
	if err != nil {
		return err
	}
	if exists {
		return domain.ConflictError(domain.ErrorCodeAlreadyParticipating, "You are already participating in this event.")
	}

	return fmt.Errorf("insert participation: join preconditions changed during insert")
}

func (r *ParticipationRepository) loadEventJoinState(ctx context.Context, eventID uuid.UUID) (*domain.Event, error) {
	var (
		hostID        uuid.UUID
		privacyLevel  string
		capacity      pgtype.Int4
		approvedCount int
	)

	err := r.pool.QueryRow(ctx, `
		SELECT host_id, privacy_level, capacity, approved_participant_count
		FROM event
		WHERE id = $1
	`, eventID).Scan(&hostID, &privacyLevel, &capacity, &approvedCount)
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
	}
	if capacity.Valid {
		event.Capacity = new(int(capacity.Int32))
	}

	return event, nil
}

func (r *ParticipationRepository) participationExists(ctx context.Context, eventID, userID uuid.UUID) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM participation
			WHERE event_id = $1 AND user_id = $2
		)
	`, eventID, userID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check participation existence: %w", err)
	}
	return exists, nil
}

// mapParticipationInsertError converts a UNIQUE constraint violation on the
// participation table into a domain ConflictError.
func mapParticipationInsertError(err error) error {
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == "23505" && pgErr.ConstraintName == "uq_event_user" {
		return domain.ConflictError(domain.ErrorCodeAlreadyParticipating, "You are already participating in this event.")
	}
	return fmt.Errorf("insert participation: %w", err)
}
