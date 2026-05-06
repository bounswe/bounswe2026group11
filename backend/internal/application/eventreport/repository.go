package eventreport

import (
	"context"

	"github.com/google/uuid"
)

// Repository is the application-layer persistence port for event reports.
type Repository interface {
	GetEventReportContext(ctx context.Context, eventID uuid.UUID) (*EventReportContext, error)
	CreateEventReport(ctx context.Context, params CreateEventReportParams) (*EventReportRecord, error)
}
