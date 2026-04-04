package postgres

import (
	"context"
	"errors"
	"fmt"

	ratingapp "github.com/bounswe/bounswe2026group11/backend/internal/application/rating"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// RatingRepository is the Postgres-backed implementation of rating.Repository.
type RatingRepository struct {
	pool *pgxpool.Pool
	db   execer
}

// NewRatingRepository returns a repository that executes queries against the given connection pool.
func NewRatingRepository(pool *pgxpool.Pool) *RatingRepository {
	return &RatingRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

func (r *RatingRepository) GetEventRatingContext(
	ctx context.Context,
	eventID, participantUserID uuid.UUID,
) (*ratingapp.EventRatingContext, error) {
	var (
		status                string
		endTime               pgtype.Timestamptz
		ratingContext         ratingapp.EventRatingContext
		isRequestingHost      bool
		isApprovedParticipant bool
	)

	err := r.db.QueryRow(ctx, `
		SELECT
			e.id,
			e.host_id,
			e.status,
			e.start_time,
			e.end_time,
			(e.host_id = $2) AS is_requesting_host,
			EXISTS (
				SELECT 1
				FROM participation p
				WHERE p.event_id = e.id
				  AND p.user_id = $2
				  AND p.status = $3
			) AS is_approved_participant
		FROM event e
		WHERE e.id = $1
	`, eventID, participantUserID, domain.ParticipationStatusApproved).Scan(
		&ratingContext.EventID,
		&ratingContext.HostUserID,
		&status,
		&ratingContext.StartTime,
		&endTime,
		&isRequestingHost,
		&isApprovedParticipant,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get event rating context: %w", err)
	}

	ratingContext.Status = domain.EventStatus(status)
	ratingContext.IsRequestingHost = isRequestingHost
	ratingContext.IsApprovedParticipant = isApprovedParticipant
	if endTime.Valid {
		ratingContext.EndTime = &endTime.Time
	}

	return &ratingContext, nil
}

func (r *RatingRepository) UpsertEventRating(
	ctx context.Context,
	params ratingapp.UpsertEventRatingParams,
) (*domain.EventRating, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO event_rating (participant_user_id, event_id, rating, message)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (participant_user_id, event_id)
		DO UPDATE SET
			rating = EXCLUDED.rating,
			message = EXCLUDED.message,
			updated_at = now()
		RETURNING id, participant_user_id, event_id, rating, message, created_at, updated_at
	`, params.ParticipantUserID, params.EventID, params.Rating, params.Message)

	rating, err := scanEventRating(row)
	if err != nil {
		return nil, fmt.Errorf("upsert event rating: %w", err)
	}

	return rating, nil
}

func (r *RatingRepository) DeleteEventRating(ctx context.Context, eventID, participantUserID uuid.UUID) (bool, error) {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM event_rating
		WHERE event_id = $1
		  AND participant_user_id = $2
	`, eventID, participantUserID)
	if err != nil {
		return false, fmt.Errorf("delete event rating: %w", err)
	}

	return tag.RowsAffected() == 1, nil
}

func (r *RatingRepository) GetParticipantRatingContext(
	ctx context.Context,
	eventID, hostUserID, participantUserID uuid.UUID,
) (*ratingapp.ParticipantRatingContext, error) {
	var (
		status                string
		endTime               pgtype.Timestamptz
		ratingContext         ratingapp.ParticipantRatingContext
		isApprovedParticipant bool
		isRequestingHost      bool
	)

	err := r.db.QueryRow(ctx, `
		SELECT
			e.id,
			e.host_id,
			e.status,
			e.start_time,
			e.end_time,
			(e.host_id = $2) AS is_requesting_host,
			EXISTS (
				SELECT 1
				FROM participation p
				WHERE p.event_id = e.id
				  AND p.user_id = $3
				  AND p.status = $4
			) AS is_approved_participant
		FROM event e
		WHERE e.id = $1
	`, eventID, hostUserID, participantUserID, domain.ParticipationStatusApproved).Scan(
		&ratingContext.EventID,
		&ratingContext.HostUserID,
		&status,
		&ratingContext.StartTime,
		&endTime,
		&isRequestingHost,
		&isApprovedParticipant,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get participant rating context: %w", err)
	}

	ratingContext.ParticipantUserID = participantUserID
	ratingContext.Status = domain.EventStatus(status)
	ratingContext.IsRequestingHost = isRequestingHost
	ratingContext.IsApprovedParticipant = isApprovedParticipant
	if endTime.Valid {
		ratingContext.EndTime = &endTime.Time
	}

	return &ratingContext, nil
}

func (r *RatingRepository) UpsertParticipantRating(
	ctx context.Context,
	params ratingapp.UpsertParticipantRatingParams,
) (*domain.ParticipantRating, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO participant_rating (host_user_id, participant_user_id, event_id, rating, message)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (host_user_id, participant_user_id, event_id)
		DO UPDATE SET
			rating = EXCLUDED.rating,
			message = EXCLUDED.message,
			updated_at = now()
		RETURNING id, host_user_id, participant_user_id, event_id, rating, message, created_at, updated_at
	`, params.HostUserID, params.ParticipantUserID, params.EventID, params.Rating, params.Message)

	rating, err := scanParticipantRating(row)
	if err != nil {
		return nil, fmt.Errorf("upsert participant rating: %w", err)
	}

	return rating, nil
}

func (r *RatingRepository) DeleteParticipantRating(
	ctx context.Context,
	eventID, hostUserID, participantUserID uuid.UUID,
) (bool, error) {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM participant_rating
		WHERE event_id = $1
		  AND host_user_id = $2
		  AND participant_user_id = $3
	`, eventID, hostUserID, participantUserID)
	if err != nil {
		return false, fmt.Errorf("delete participant rating: %w", err)
	}

	return tag.RowsAffected() == 1, nil
}

func (r *RatingRepository) CalculateParticipantAggregate(
	ctx context.Context,
	userID uuid.UUID,
) (*ratingapp.ScoreAggregate, error) {
	var (
		average pgtype.Float8
		count   int
	)

	err := r.db.QueryRow(ctx, `
		SELECT AVG(rating)::double precision, COUNT(*)
		FROM participant_rating
		WHERE participant_user_id = $1
	`, userID).Scan(&average, &count)
	if err != nil {
		return nil, fmt.Errorf("calculate participant aggregate: %w", err)
	}

	result := &ratingapp.ScoreAggregate{Count: count}
	if average.Valid {
		result.Average = &average.Float64
	}

	return result, nil
}

func (r *RatingRepository) CalculateHostedEventAggregate(
	ctx context.Context,
	userID uuid.UUID,
) (*ratingapp.ScoreAggregate, error) {
	var (
		average pgtype.Float8
		count   int
	)

	err := r.db.QueryRow(ctx, `
		SELECT AVG(er.rating)::double precision, COUNT(*)
		FROM event_rating er
		JOIN event e ON e.id = er.event_id
		WHERE e.host_id = $1
	`, userID).Scan(&average, &count)
	if err != nil {
		return nil, fmt.Errorf("calculate hosted event aggregate: %w", err)
	}

	result := &ratingapp.ScoreAggregate{Count: count}
	if average.Valid {
		result.Average = &average.Float64
	}

	return result, nil
}

func (r *RatingRepository) UpsertUserScore(ctx context.Context, params ratingapp.UpsertUserScoreParams) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO user_score (
			user_id,
			participant_score,
			participant_rating_count,
			hosted_event_score,
			hosted_event_rating_count,
			final_score
		) VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id)
		DO UPDATE SET
			participant_score = EXCLUDED.participant_score,
			participant_rating_count = EXCLUDED.participant_rating_count,
			hosted_event_score = EXCLUDED.hosted_event_score,
			hosted_event_rating_count = EXCLUDED.hosted_event_rating_count,
			final_score = EXCLUDED.final_score,
			updated_at = now()
	`, params.UserID, params.ParticipantScore, params.ParticipantRatingCount, params.HostedEventScore, params.HostedEventRatingCount, params.FinalScore)
	if err != nil {
		return fmt.Errorf("upsert user score: %w", err)
	}

	return nil
}

func scanEventRating(row pgx.Row) (*domain.EventRating, error) {
	var (
		record  domain.EventRating
		message pgtype.Text
	)

	if err := row.Scan(
		&record.ID,
		&record.ParticipantUserID,
		&record.EventID,
		&record.Rating,
		&message,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return nil, err
	}

	record.Message = textPtr(message)
	return &record, nil
}

func scanParticipantRating(row pgx.Row) (*domain.ParticipantRating, error) {
	var (
		record  domain.ParticipantRating
		message pgtype.Text
	)

	if err := row.Scan(
		&record.ID,
		&record.HostUserID,
		&record.ParticipantUserID,
		&record.EventID,
		&record.Rating,
		&message,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return nil, err
	}

	record.Message = textPtr(message)
	return &record, nil
}
