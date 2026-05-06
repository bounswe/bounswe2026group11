package postgres

import (
	"context"
	"errors"
	"fmt"

	eventreportapp "github.com/bounswe/bounswe2026group11/backend/internal/application/eventreport"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EventReportRepository is the Postgres-backed implementation of eventreport.Repository.
type EventReportRepository struct {
	pool *pgxpool.Pool
	db   execer
}

// NewEventReportRepository returns a repository that executes queries against the given pool.
func NewEventReportRepository(pool *pgxpool.Pool) *EventReportRepository {
	return &EventReportRepository{
		pool: pool,
		db:   contextualRunner{fallback: pool},
	}
}

var _ eventreportapp.Repository = (*EventReportRepository)(nil)

// GetEventReportContext loads event state needed before creating a report.
func (r *EventReportRepository) GetEventReportContext(ctx context.Context, eventID uuid.UUID) (*eventreportapp.EventReportContext, error) {
	var (
		record eventreportapp.EventReportContext
		status string
	)

	err := r.db.QueryRow(ctx, `
		SELECT
			e.id,
			e.host_id,
			CASE
				WHEN e.status = 'ACTIVE' AND e.end_time < NOW() THEN 'COMPLETED'
				WHEN e.status = 'ACTIVE' AND e.start_time < NOW() THEN 'IN_PROGRESS'
				WHEN e.status = 'IN_PROGRESS' AND e.end_time < NOW() THEN 'COMPLETED'
				ELSE e.status
			END AS status
		FROM event e
		WHERE e.id = $1
	`, eventID).Scan(&record.EventID, &record.HostID, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("get event report context: %w", err)
	}

	record.Status = domain.EventStatus(status)
	return &record, nil
}

// CreateEventReport inserts a user-submitted event report.
func (r *EventReportRepository) CreateEventReport(ctx context.Context, params eventreportapp.CreateEventReportParams) (*eventreportapp.EventReportRecord, error) {
	var (
		record   eventreportapp.EventReportRecord
		category string
		status   string
	)

	err := r.db.QueryRow(ctx, `
		INSERT INTO event_report (
			event_id,
			reporter_user_id,
			report_category,
			message,
			image_url,
			status
		) VALUES (
			$1, $2, $3, $4, $5, $6
		)
		RETURNING id, event_id, reporter_user_id, report_category, message, image_url, status, created_at, updated_at
	`,
		params.EventID,
		params.ReporterUserID,
		string(params.Category),
		params.Message,
		params.ImageURL,
		string(domain.EventReportStatusPending),
	).Scan(
		&record.ID,
		&record.EventID,
		&record.ReporterUserID,
		&category,
		&record.Message,
		&record.ImageURL,
		&status,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create event report: %w", err)
	}

	record.Category = domain.EventReportCategory(category)
	record.Status = domain.EventReportStatus(status)
	return &record, nil
}
