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
}

// NewJoinRequestRepository returns a repository that executes queries against the given connection pool.
func NewJoinRequestRepository(pool *pgxpool.Pool) *JoinRequestRepository {
	return &JoinRequestRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

// CreateJoinRequest inserts or reactivates a join_request row for a protected event.
func (r *JoinRequestRepository) CreateJoinRequest(ctx context.Context, params joinrequestapp.CreateJoinRequestParams) (*domain.JoinRequest, error) {
	event, err := r.loadEventState(ctx, params.EventID, false)
	if err != nil {
		return nil, err
	}
	if event == nil {
		return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
	}
	if event.HostID == params.UserID {
		return nil, domain.ForbiddenError(domain.ErrorCodeHostCannotJoin, "The event host cannot request to join their own event.")
	}
	if event.PrivacyLevel != domain.PrivacyProtected {
		return nil, domain.ConflictError(domain.ErrorCodeEventJoinNotAllowed, "Only PROTECTED events accept join requests.")
	}

	participation, err := loadParticipation(ctx, r.db, params.EventID, params.UserID, false)
	if err != nil {
		return nil, err
	}
	if participation != nil && !canReactivateLeavedParticipation(participation, event.StartTime) {
		return nil, mapJoinParticipationConflict(
			participation,
			event.StartTime,
			"You are already participating in this event.",
			"You cannot request to join again after leaving once the event has started.",
		)
	}

	existing, err := r.loadJoinRequestByEventAndUser(ctx, params.EventID, params.UserID, true)
	if err != nil {
		return nil, err
	}

	if existing == nil {
		created, err := r.insertJoinRequest(ctx, params)
		if err == nil {
			return created, nil
		}
		if !isConstraintError(err, "uq_join") {
			return nil, fmt.Errorf("insert join_request: %w", err)
		}

		existing, err = r.loadJoinRequestByEventAndUser(ctx, params.EventID, params.UserID, true)
		if err != nil {
			return nil, err
		}
		if existing == nil {
			return nil, fmt.Errorf("insert join_request: unique violation without matching row")
		}
	}

	return r.handleExistingJoinRequestForCreate(ctx, existing, participation, event.StartTime, params)
}

// ApproveJoinRequest approves a pending join request and creates the corresponding
// APPROVED participation row in the same transaction.
func (r *JoinRequestRepository) ApproveJoinRequest(
	ctx context.Context,
	params joinrequestapp.ApproveJoinRequestParams,
) (*joinrequestapp.ApproveJoinRequestResult, error) {
	event, err := r.loadEventState(ctx, params.EventID, true)
	if err != nil {
		return nil, err
	}
	if event == nil {
		return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
	}
	if event.HostID != params.HostUserID {
		return nil, domain.ForbiddenError(domain.ErrorCodeJoinRequestModerationNotAllowed, "Only the event host can moderate join requests.")
	}

	request, err := r.loadJoinRequestByID(ctx, params.EventID, params.JoinRequestID, true)
	if err != nil {
		return nil, err
	}
	if request == nil {
		return nil, domain.NotFoundError(domain.ErrorCodeJoinRequestNotFound, "The requested join request does not exist.")
	}
	if request.Status != domain.JoinRequestStatusPending {
		return nil, domain.ConflictError(domain.ErrorCodeJoinRequestStateInvalid, "Only PENDING join requests can be approved.")
	}

	if event.Capacity != nil && event.ApprovedParticipantCount >= *event.Capacity {
		return nil, domain.ConflictError(domain.ErrorCodeCapacityExceeded, "This event has reached its maximum capacity.")
	}

	participation, err := r.insertOrReactivateApprovedParticipation(ctx, event, request.UserID)
	if err != nil {
		return nil, err
	}

	updatedRequest, err := r.updateJoinRequestStatus(ctx, request.ID, domain.JoinRequestStatusApproved, &participation.ID)
	if err != nil {
		return nil, err
	}

	return &joinrequestapp.ApproveJoinRequestResult{
		JoinRequest:   updatedRequest,
		Participation: participation,
	}, nil
}

// RejectJoinRequest rejects a pending join request and returns the resulting cooldown end time.
func (r *JoinRequestRepository) RejectJoinRequest(
	ctx context.Context,
	params joinrequestapp.RejectJoinRequestParams,
) (*joinrequestapp.RejectJoinRequestResult, error) {
	event, err := r.loadEventState(ctx, params.EventID, false)
	if err != nil {
		return nil, err
	}
	if event == nil {
		return nil, domain.NotFoundError(domain.ErrorCodeEventNotFound, "The requested event does not exist.")
	}
	if event.HostID != params.HostUserID {
		return nil, domain.ForbiddenError(domain.ErrorCodeJoinRequestModerationNotAllowed, "Only the event host can moderate join requests.")
	}

	request, err := r.loadJoinRequestByID(ctx, params.EventID, params.JoinRequestID, true)
	if err != nil {
		return nil, err
	}
	if request == nil {
		return nil, domain.NotFoundError(domain.ErrorCodeJoinRequestNotFound, "The requested join request does not exist.")
	}
	if request.Status != domain.JoinRequestStatusPending {
		return nil, domain.ConflictError(domain.ErrorCodeJoinRequestStateInvalid, "Only PENDING join requests can be rejected.")
	}

	updatedRequest, err := r.updateJoinRequestStatus(ctx, request.ID, domain.JoinRequestStatusRejected, nil)
	if err != nil {
		return nil, err
	}

	return &joinrequestapp.RejectJoinRequestResult{
		JoinRequest:    updatedRequest,
		CooldownEndsAt: updatedRequest.UpdatedAt.Add(domain.JoinRequestCooldown),
	}, nil
}

func (r *JoinRequestRepository) handleExistingJoinRequestForCreate(
	ctx context.Context,
	existing *domain.JoinRequest,
	participation *domain.Participation,
	eventStart time.Time,
	params joinrequestapp.CreateJoinRequestParams,
) (*domain.JoinRequest, error) {
	switch existing.Status {
	case domain.JoinRequestStatusPending:
		return nil, domain.ConflictError(domain.ErrorCodeAlreadyRequested, "You already have a pending join request for this event.")
	case domain.JoinRequestStatusApproved:
		if canReactivateLeavedParticipation(participation, eventStart) {
			return r.reactivateJoinRequest(ctx, existing.ID, params.HostUserID, params.Message)
		}
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
		SELECT host_id, privacy_level, capacity, approved_participant_count, start_time
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
		startTime     time.Time
	)

	err := r.db.QueryRow(ctx, query, eventID).Scan(&hostID, &privacyLevel, &capacity, &approvedCount, &startTime)
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
		StartTime:                startTime,
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

func (r *JoinRequestRepository) insertOrReactivateApprovedParticipation(
	ctx context.Context,
	event *domain.Event,
	userID uuid.UUID,
) (*domain.Participation, error) {
	participation, err := scanParticipation(r.db.QueryRow(ctx, `
		WITH reactivated AS (
			UPDATE participation
			SET status = $3,
			    created_at = NOW(),
			    updated_at = NOW()
			WHERE event_id = $1
			  AND user_id = $2
			  AND status = $4
			  AND updated_at < $5
			RETURNING id, status, created_at, updated_at
		),
		inserted AS (
			INSERT INTO participation (event_id, user_id, status)
			SELECT $1, $2, $3
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
	`, event.ID, userID, domain.ParticipationStatusApproved, domain.ParticipationStatusLeaved, event.StartTime), event.ID, userID, "approve join request participation")
	if err != nil {
		return nil, err
	}

	if participation != nil {
		return participation, nil
	}

	existing, err := loadParticipation(ctx, r.db, event.ID, userID, true)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, mapJoinParticipationConflict(
			existing,
			event.StartTime,
			"The requester is already participating in this event.",
			"The requester cannot rejoin this event after leaving once it has started.",
		)
	}

	return nil, fmt.Errorf("approve join request participation: no row returned and no existing participation found")
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
