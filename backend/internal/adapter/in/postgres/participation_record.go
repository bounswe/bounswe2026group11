package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func loadParticipation(
	ctx context.Context,
	db execer,
	eventID, userID uuid.UUID,
	forUpdate bool,
) (*domain.Participation, error) {
	query := `
		SELECT id, status, created_at, updated_at
		FROM participation
		WHERE event_id = $1 AND user_id = $2
	`
	if forUpdate {
		query += ` FOR UPDATE`
	}

	return scanParticipation(db.QueryRow(ctx, query, eventID, userID), eventID, userID, "load participation")
}

func scanParticipation(
	row pgx.Row,
	eventID, userID uuid.UUID,
	operation string,
) (*domain.Participation, error) {
	var (
		id        uuid.UUID
		status    string
		createdAt time.Time
		updatedAt time.Time
	)

	err := row.Scan(&id, &status, &createdAt, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("%s: %w", operation, err)
	}

	parsedStatus, ok := domain.ParseParticipationStatus(status)
	if !ok {
		return nil, fmt.Errorf("%s: unknown participation status %q", operation, status)
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

func canReactivateLeavedParticipation(participation *domain.Participation, eventStart time.Time) bool {
	return participation != nil &&
		participation.Status == domain.ParticipationStatusLeaved &&
		participation.UpdatedAt.Before(eventStart)
}

func mapJoinParticipationConflict(
	participation *domain.Participation,
	eventStart time.Time,
	activeMessage string,
	leftAfterStartMessage string,
) error {
	if participation == nil {
		return fmt.Errorf("map join participation conflict: missing participation")
	}

	if participation.Status == domain.ParticipationStatusLeaved {
		if canReactivateLeavedParticipation(participation, eventStart) {
			return fmt.Errorf("map join participation conflict: expected pre-start LEAVED participation to be reactivated")
		}

		return domain.ConflictError(domain.ErrorCodeAlreadyParticipating, leftAfterStartMessage)
	}

	return domain.ConflictError(domain.ErrorCodeAlreadyParticipating, activeMessage)
}
