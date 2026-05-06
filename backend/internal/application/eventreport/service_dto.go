package eventreport

import (
	"context"
	"time"

	"github.com/bounswe/bounswe2026group11/backend/internal/application/imageupload"
	"github.com/bounswe/bounswe2026group11/backend/internal/domain"
	"github.com/google/uuid"
)

// ReportImageConfirmer verifies an uploaded report image and returns its public base URL.
type ReportImageConfirmer interface {
	ConfirmEventReportImageUpload(ctx context.Context, userID, eventID uuid.UUID, input imageupload.ConfirmUploadInput) (*imageupload.ConfirmReportImageResult, error)
}

// CreateEventReportInput is the write payload for reporting an event.
type CreateEventReportInput struct {
	Category          domain.EventReportCategory
	Message           string
	ImageConfirmToken *string
}

// EventReportContext contains event state needed to authorize report creation.
type EventReportContext struct {
	EventID uuid.UUID
	HostID  uuid.UUID
	Status  domain.EventStatus
}

// CreateEventReportParams carries data for inserting an event report.
type CreateEventReportParams struct {
	EventID        uuid.UUID
	ReporterUserID uuid.UUID
	Category       domain.EventReportCategory
	Message        string
	ImageURL       *string
}

// EventReportRecord is the persistence-layer report projection.
type EventReportRecord struct {
	ID             uuid.UUID
	EventID        uuid.UUID
	ReporterUserID uuid.UUID
	Category       domain.EventReportCategory
	Message        string
	ImageURL       *string
	Status         domain.EventReportStatus
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// EventReportResult is returned after a report is created.
type EventReportResult struct {
	ID             string    `json:"id"`
	EventID        string    `json:"event_id"`
	ReporterUserID string    `json:"reporter_user_id"`
	Category       string    `json:"report_category"`
	Message        string    `json:"message"`
	ImageURL       *string   `json:"image_url"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}
