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
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// JoinRequestRepository is the Postgres-backed implementation of join_request.Repository.
type JoinRequestRepository struct {
	pool *pgxpool.Pool
	db   execer
	tx   pgx.Tx
}

// NewJoinRequestRepository returns a repository that executes queries against the given connection pool.
func NewJoinRequestRepository(pool *pgxpool.Pool) *JoinRequestRepository {
	return &JoinRequestRepository{
		pool: pool,
		db:   pool,
	}
}

func (r *JoinRequestRepository) withTx(ctx context.Context, fn func(repo *JoinRequestRepository) error) error {
	if r.tx != nil {
		return fn(r)
	}

	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}

	txRepo := &JoinRequestRepository{
		pool: r.pool,
		db:   tx,
		tx:   tx,
	}

	if err := fn(txRepo); err != nil {
		_ = tx.Rollback(ctx)
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// CreateJoinRequest inserts or reactivates a join_request row for a protected event.
func (r *JoinRequestRepository) CreateJoinRequest(ctx context.Context, params joinrequestapp.CreateJoinRequestParams) (*domain.JoinRequest, error) {
	var created *domain.JoinRequest

	err := r.withTx(ctx, func(repo *JoinRequestRepository) error {
		event, err := repo.loadEventState(ctx, params.EventID, false)
		if err != nil {
			return err
		}
		if event == nil {
			return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		if event.HostID == params.UserID {
			return domain.ForbiddenError(domain.ErrorCodeHostCannotJoin, "The event host cannot request to join their own event.")
		}
		if event.PrivacyLevel != domain.PrivacyProtected {
			return domain.ConflictError(domain.ErrorCodeEventJoinNotAllowed, "Only PROTECTED events accept join requests.")
		}

		participating, err := repo.participationExists(ctx, params.EventID, params.UserID)
		if err != nil {
			return err
		}
		if participating {
			return domain.ConflictError(domain.ErrorCodeAlreadyParticipating, "You are already participating in this event.")
		}

		existing, err := repo.loadJoinRequestByEventAndUser(ctx, params.EventID, params.UserID, true)
		if err != nil {
			return err
		}

		if existing == nil {
			created, err = repo.insertJoinRequest(ctx, params)
			if err == nil {
				return nil
			}
			if !isConstraintError(err, "uq_join") {
				return fmt.Errorf("insert join_request: %w", err)
			}

			existing, err = repo.loadJoinRequestByEventAndUser(ctx, params.EventID, params.UserID, true)
			if err != nil {
				return err
			}
			if existing == nil {
				return fmt.Errorf("insert join_request: unique violation without matching row")
			}
		}

		created, err = repo.handleExistingJoinRequestForCreate(ctx, existing, params)
		return err
	})
	if err != nil {
		return nil, err
	}

	return created, nil
}

// ApproveJoinRequest approves a pending join request and creates the corresponding
// APPROVED participation row in the same transaction.
func (r *JoinRequestRepository) ApproveJoinRequest(
	ctx context.Context,
	params joinrequestapp.ApproveJoinRequestParams,
) (*joinrequestapp.ApproveJoinRequestResult, error) {
	var result *joinrequestapp.ApproveJoinRequestResult

	err := r.withTx(ctx, func(repo *JoinRequestRepository) error {
		event, err := repo.loadEventState(ctx, params.EventID, true)
		if err != nil {
			return err
		}
		if event == nil {
			return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		if event.HostID != params.HostUserID {
			return domain.ForbiddenError(domain.ErrorCodeJoinRequestModerationNotAllowed, "Only the event host can moderate join requests.")
		}

		request, err := repo.loadJoinRequestByID(ctx, params.EventID, params.JoinRequestID, true)
		if err != nil {
			return err
		}
		if request == nil {
			return domain.NotFoundError(domain.ErrorCodeJoinRequestNotFound, "The requested join request does not exist.")
		}
		if request.Status != domain.JoinRequestStatusPending {
			return domain.ConflictError(domain.ErrorCodeJoinRequestStateInvalid, "Only PENDING join requests can be approved.")
		}

		participating, err := repo.participationExists(ctx, params.EventID, request.UserID)
		if err != nil {
			return err
		}
		if participating {
			return domain.ConflictError(domain.ErrorCodeAlreadyParticipating, "The requester is already participating in this event.")
		}
		if event.Capacity != nil && event.ApprovedParticipantCount >= *event.Capacity {
			return domain.ConflictError(domain.ErrorCodeCapacityExceeded, "This event has reached its maximum capacity.")
		}

		participation, err := repo.insertApprovedParticipation(ctx, params.EventID, request.UserID)
		if err != nil {
			return err
		}

		updatedRequest, err := repo.updateJoinRequestStatus(ctx, request.ID, domain.JoinRequestStatusApproved, &participation.ID)
		if err != nil {
			return err
		}

		result = &joinrequestapp.ApproveJoinRequestResult{
			JoinRequest:   updatedRequest,
			Participation: participation,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

// RejectJoinRequest rejects a pending join request and returns the resulting cooldown end time.
func (r *JoinRequestRepository) RejectJoinRequest(
	ctx context.Context,
	params joinrequestapp.RejectJoinRequestParams,
) (*joinrequestapp.RejectJoinRequestResult, error) {
	var result *joinrequestapp.RejectJoinRequestResult

	err := r.withTx(ctx, func(repo *JoinRequestRepository) error {
		event, err := repo.loadEventState(ctx, params.EventID, false)
		if err != nil {
			return err
		}
		if event == nil {
			return domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
		}
		if event.HostID != params.HostUserID {
			return domain.ForbiddenError(domain.ErrorCodeJoinRequestModerationNotAllowed, "Only the event host can moderate join requests.")
		}

		request, err := repo.loadJoinRequestByID(ctx, params.EventID, params.JoinRequestID, true)
		if err != nil {
			return err
		}
		if request == nil {
			return domain.NotFoundError(domain.ErrorCodeJoinRequestNotFound, "The requested join request does not exist.")
		}
		if request.Status != domain.JoinRequestStatusPending {
			return domain.ConflictError(domain.ErrorCodeJoinRequestStateInvalid, "Only PENDING join requests can be rejected.")
		}

		updatedRequest, err := repo.updateJoinRequestStatus(ctx, request.ID, domain.JoinRequestStatusRejected, nil)
		if err != nil {
			return err
		}

		result = &joinrequestapp.RejectJoinRequestResult{
			JoinRequest:    updatedRequest,
			CooldownEndsAt: updatedRequest.UpdatedAt.Add(domain.JoinRequestCooldown),
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (r *JoinRequestRepository) handleExistingJoinRequestForCreate(
	ctx context.Context,
	existing *domain.JoinRequest,
	params joinrequestapp.CreateJoinRequestParams,
) (*domain.JoinRequest, error) {
	switch existing.Status {
	case domain.JoinRequestStatusPending:
		return nil, domain.ConflictError(domain.ErrorCodeAlreadyRequested, "You already have a pending join request for this event.")
	case domain.JoinRequestStatusApproved:
		return nil, domain.ConflictError(domain.ErrorCodeAlreadyParticipating, "You are already participating in this event.")
	case domain.JoinRequestStatusRejected:
		if time.Now().UTC().Before(existing.UpdatedAt.Add(domain.JoinRequestCooldown)) {
			return nil, domain.ConflictError(domain.ErrorCodeJoinRequestCooldownActive, "You must wait 3 days after rejection before requesting to join this event again.")
		}
		return r.reactivateJoinRequest(ctx, existing.ID, params.HostUserID, params.Message)
	default:
		return nil, fmt.Errorf("unsupported join request status %q", existing.Status)
	}
}

func (r *JoinRequestRepository) loadEventState(ctx context.Context, eventID uuid.UUID, forUpdate bool) (*domain.Event, error) {
	query := `
		SELECT host_id, privacy_level, capacity, approved_participant_count
		FROM event
		WHERE id = $1
	`
	if forUpdate {
		query += ` FOR UPDATE`
	}

	var (
		hostID        uuid.UUID
		privacyLevel  string
		capacity      pgtype.Int4
		approvedCount int
	)

	err := r.db.QueryRow(ctx, query, eventID).Scan(&hostID, &privacyLevel, &capacity, &approvedCount)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("load event join request state: %w", err)
	}

	event := &domain.Event{
		ID:                       eventID,
		HostID:                   hostID,
		PrivacyLevel:             domain.EventPrivacyLevel(privacyLevel),
		ApprovedParticipantCount: approvedCount,
	}
	if capacity.Valid {
		value := int(capacity.Int32)
		event.Capacity = &value
	}

	return event, nil
}

func (r *JoinRequestRepository) loadJoinRequestByEventAndUser(
	ctx context.Context,
	eventID, userID uuid.UUID,
	forUpdate bool,
) (*domain.JoinRequest, error) {
	query := `
		SELECT id, event_id, user_id, participation_id, host_user_id, status, message, created_at, updated_at
		FROM join_request
		WHERE event_id = $1
		  AND user_id = $2
	`
	if forUpdate {
		query += ` FOR UPDATE`
	}

	return scanJoinRequest(r.db.QueryRow(ctx, query, eventID, userID))
}

func (r *JoinRequestRepository) loadJoinRequestByID(
	ctx context.Context,
	eventID, joinRequestID uuid.UUID,
	forUpdate bool,
) (*domain.JoinRequest, error) {
	query := `
		SELECT id, event_id, user_id, participation_id, host_user_id, status, message, created_at, updated_at
		FROM join_request
		WHERE event_id = $1
		  AND id = $2
	`
	if forUpdate {
		query += ` FOR UPDATE`
	}

	return scanJoinRequest(r.db.QueryRow(ctx, query, eventID, joinRequestID))
}

func (r *JoinRequestRepository) participationExists(ctx context.Context, eventID, userID uuid.UUID) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
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

func (r *JoinRequestRepository) insertJoinRequest(
	ctx context.Context,
	params joinrequestapp.CreateJoinRequestParams,
) (*domain.JoinRequest, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO join_request (event_id, user_id, host_user_id, status, message)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, event_id, user_id, participation_id, host_user_id, status, message, created_at, updated_at
	`, params.EventID, params.UserID, params.HostUserID, domain.JoinRequestStatusPending, params.Message)

	request, err := scanJoinRequest(row)
	if err != nil {
		return nil, err
	}

	return request, nil
}

func (r *JoinRequestRepository) reactivateJoinRequest(
	ctx context.Context,
	joinRequestID, hostUserID uuid.UUID,
	message *string,
) (*domain.JoinRequest, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE join_request
		SET host_user_id = $2,
			status = $3,
			participation_id = NULL,
			message = $4,
			created_at = now(),
			updated_at = now()
		WHERE id = $1
		RETURNING id, event_id, user_id, participation_id, host_user_id, status, message, created_at, updated_at
	`, joinRequestID, hostUserID, domain.JoinRequestStatusPending, message)

	request, err := scanJoinRequest(row)
	if err != nil {
		return nil, fmt.Errorf("reactivate join_request: %w", err)
	}

	return request, nil
}

func (r *JoinRequestRepository) insertApprovedParticipation(
	ctx context.Context,
	eventID, userID uuid.UUID,
) (*domain.Participation, error) {
	var (
		id        uuid.UUID
		status    string
		createdAt time.Time
		updatedAt time.Time
	)

	err := r.db.QueryRow(ctx, `
		INSERT INTO participation (event_id, user_id, status)
		VALUES ($1, $2, $3)
		RETURNING id, status, created_at, updated_at
	`, eventID, userID, domain.ParticipationStatusApproved).Scan(&id, &status, &createdAt, &updatedAt)
	if err != nil {
		if isConstraintError(err, "uq_event_user") {
			return nil, domain.ConflictError(domain.ErrorCodeAlreadyParticipating, "The requester is already participating in this event.")
		}
		return nil, fmt.Errorf("insert participation: %w", err)
	}

	parsedStatus, ok := domain.ParseParticipationStatus(status)
	if !ok {
		return nil, fmt.Errorf("insert participation: unknown participation status %q", status)
	}

	return &domain.Participation{
		ID:        id,
		EventID:   eventID,
		UserID:    userID,
		Status:    parsedStatus,
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	}, nil
}

func (r *JoinRequestRepository) updateJoinRequestStatus(
	ctx context.Context,
	joinRequestID uuid.UUID,
	status domain.JoinRequestStatus,
	participationID *uuid.UUID,
) (*domain.JoinRequest, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE join_request
		SET status = $2,
			participation_id = $3,
			updated_at = now()
		WHERE id = $1
		RETURNING id, event_id, user_id, participation_id, host_user_id, status, message, created_at, updated_at
	`, joinRequestID, status, participationID)

	request, err := scanJoinRequest(row)
	if err != nil {
		return nil, fmt.Errorf("update join_request status: %w", err)
	}

	return request, nil
}

func scanJoinRequest(row pgx.Row) (*domain.JoinRequest, error) {
	var (
		requestID       uuid.UUID
		eventID         uuid.UUID
		userID          uuid.UUID
		participationID pgtype.UUID
		hostUserID      uuid.UUID
		status          string
		message         pgtype.Text
		createdAt       time.Time
		updatedAt       time.Time
	)

	err := row.Scan(
		&requestID,
		&eventID,
		&userID,
		&participationID,
		&hostUserID,
		&status,
		&message,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	parsedStatus, ok := domain.ParseJoinRequestStatus(status)
	if !ok {
		return nil, fmt.Errorf("unknown join_request status %q", status)
	}

	request := &domain.JoinRequest{
		ID:         requestID,
		EventID:    eventID,
		UserID:     userID,
		HostUserID: hostUserID,
		Status:     parsedStatus,
		CreatedAt:  createdAt,
		UpdatedAt:  updatedAt,
	}
	if participationID.Valid {
		parsedParticipationID := uuid.UUID(participationID.Bytes)
		request.ParticipationID = &parsedParticipationID
	}
	if message.Valid {
		request.Message = &message.String
	}

	return request, nil
}

func isConstraintError(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == constraint
}
