package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	joinrequestapp "github.com/bounswe/bounswe2026group11/backend/internal/application/join_request"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// JoinRequestRepository is the Postgres-backed implementation of join_request.Repository.
type JoinRequestRepository struct {
	pool *pgxpool.Pool
}

// NewJoinRequestRepository returns a repository that executes queries against the given connection pool.
func NewJoinRequestRepository(pool *pgxpool.Pool) *JoinRequestRepository {
	return &JoinRequestRepository{pool: pool}
}

// CreateJoinRequest inserts a join_request row for a protected event.
// Returns a ConflictError with code already_requested on duplicate (event_id, user_id).
func (r *JoinRequestRepository) CreateJoinRequest(ctx context.Context, params joinrequestapp.CreateJoinRequestParams) (*domain.JoinRequest, error) {
	var (
		id        uuid.UUID
		createdAt time.Time
		updatedAt time.Time
	)

	err := r.pool.QueryRow(ctx, `
		WITH joinable_event AS (
			SELECT id, host_id
			FROM event
			WHERE id = $1
			  AND host_id <> $2
			  AND privacy_level = $3
		)
		INSERT INTO join_request (event_id, user_id, host_user_id, status, message)
		SELECT id, $2, host_id, $4, $5
		FROM joinable_event
		ON CONFLICT ON CONSTRAINT uq_join DO NOTHING
		RETURNING id, created_at, updated_at
	`, params.EventID, params.UserID, domain.PrivacyProtected, domain.ParticipationStatusPending, params.Message).Scan(&id, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, r.mapCreateJoinRequestNoRow(ctx, params.EventID, params.UserID)
		}
		return nil, mapJoinRequestInsertError(err)
	}

	return &domain.JoinRequest{
		ID:         id,
		EventID:    params.EventID,
		UserID:     params.UserID,
		HostUserID: params.HostUserID,
		Status:     domain.ParticipationStatusPending,
		Message:    params.Message,
		CreatedAt:  createdAt,
		UpdatedAt:  updatedAt,
	}, nil
}

func (r *JoinRequestRepository) mapCreateJoinRequestNoRow(ctx context.Context, eventID, userID uuid.UUID) error {
	event, err := r.loadEventRequestState(ctx, eventID)
	if err != nil {
		return err
	}

	if event == nil {
		return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
	}
	if event.HostID == userID {
		return domain.ForbiddenError(domain.ErrorCodeHostCannotJoin, "The event host cannot request to join their own event.")
	}
	if event.PrivacyLevel != domain.PrivacyProtected {
		return domain.ConflictError(domain.ErrorCodeEventJoinNotAllowed, "Only PROTECTED events accept join requests.")
	}

	exists, err := r.joinRequestExists(ctx, eventID, userID)
	if err != nil {
		return err
	}
	if exists {
		return domain.ConflictError(domain.ErrorCodeAlreadyRequested, "You already have a pending join request for this event.")
	}

	return fmt.Errorf("insert join_request: request preconditions changed during insert")
}

func (r *JoinRequestRepository) loadEventRequestState(ctx context.Context, eventID uuid.UUID) (*domain.Event, error) {
	var (
		hostID       uuid.UUID
		privacyLevel string
	)

	err := r.pool.QueryRow(ctx, `
		SELECT host_id, privacy_level
		FROM event
		WHERE id = $1
	`, eventID).Scan(&hostID, &privacyLevel)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("load event request state: %w", err)
	}

	return &domain.Event{
		ID:           eventID,
		HostID:       hostID,
		PrivacyLevel: domain.EventPrivacyLevel(privacyLevel),
	}, nil
}

func (r *JoinRequestRepository) joinRequestExists(ctx context.Context, eventID, userID uuid.UUID) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM join_request
			WHERE event_id = $1 AND user_id = $2 AND status = $3
		)
	`, eventID, userID, domain.ParticipationStatusPending).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check join_request existence: %w", err)
	}
	return exists, nil
}

// mapJoinRequestInsertError converts a UNIQUE constraint violation on the
// join_request table into a domain ConflictError.
func mapJoinRequestInsertError(err error) error {
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == "23505" && pgErr.ConstraintName == "uq_join" {
		return domain.ConflictError(domain.ErrorCodeAlreadyRequested, "You already have a pending join request for this event.")
	}
	return fmt.Errorf("insert join_request: %w", err)
}
